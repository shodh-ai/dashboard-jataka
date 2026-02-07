"use client";

import { useAuth, useUser, SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  Activity,
  ShieldCheck,
  BookOpen,
  AlertTriangle,
  Clock,
  Send,
  ChevronDown,
  Crown,
  Code2,
  Maximize2,
  Minimize2,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Key,
  Sparkles,
  Users,
  Plug,
  Brain,
  Terminal,
  ExternalLink,
} from "lucide-react";
import GraphVisualizer from "./components/GraphVisualizer";
import { useOrganizationList } from "@clerk/nextjs";
import Sidebar from "./components/Sidebar";

interface Metrics {
  senior_deflection_rate: number;
  drift_score: number;
  avg_hours_to_mastery: number;
  knowledge_coverage_files: number;
  context_injection_rate: number;
}

interface TrendData {
  change: number;
  direction: 'up' | 'down';
  period: string;
}

interface WorkflowSummary {
  name: string;
  status?: string;
  drift_reason?: string;
  last_drift_detected?: string;
  step_count?: number;
  file_count?: number;
}

interface HealerLogEntry {
  workflow_name?: string;
  new_step: string;
  old_step?: string;
  step_order?: number;
  expert_intent?: string;
  created_at?: string;
  action_count?: number;
}

interface BusFactorWorkflow {
  workflow: string;
  step_count?: number;
  file_count?: number;
  capture_count?: number;
  risk_level: 'ok' | 'warning' | 'critical';
}

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

const GITHUB_APP_NAME =
  process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "jataka-ai";
const GITHUB_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`;

const SYNC_URL = BASE_API ? `${BASE_API}/auth/sync` : undefined;
const METRICS_URL = BASE_API ? `${BASE_API}/brum-proxy/dashboard-metrics` : undefined;
const WORKFLOWS_URL = BASE_API ? `${BASE_API}/brum-proxy/workflows` : undefined;
const HEALER_LOG_URL = BASE_API ? `${BASE_API}/brum-proxy/healer-log` : undefined;
const BUS_FACTOR_URL = BASE_API ? `${BASE_API}/brum-proxy/bus-factor` : undefined;
const INVITE_URL = BASE_API ? `${BASE_API}/team/invite` : undefined;
const ONBOARD_URL = BASE_API ? `${BASE_API}/auth/onboard` : undefined;

const DEFAULT_METRICS: Metrics = {
  senior_deflection_rate: 0,
  drift_score: 0,
  avg_hours_to_mastery: 0,
  knowledge_coverage_files: 0,
  context_injection_rate: 0,
};

const orgListParams = {
  userMemberships: {
    infinite: true,
  },
};

export default function Home() {
  const { setActive, userMemberships, isLoaded: isOrgListLoaded } = useOrganizationList(orgListParams); 
  const { isLoaded, isSignedIn, getToken, orgId } = useAuth();
  const { user } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [inviteStatus, setInviteStatus] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [healerLog, setHealerLog] = useState<HealerLogEntry[]>([]);
  const [busFactor, setBusFactor] = useState<BusFactorWorkflow[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<'loading' | 'dashboard' | 'onboarding'>('loading');
  const [companyName, setCompanyName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [brains, setBrains] = useState<any[]>([]);
  const [activeBrain, setActiveBrain] = useState<string>("");
  const [newBrainName, setNewBrainName] = useState("");
  const [hasLoadedQa, setHasLoadedQa] = useState(false);
  const [timePeriod, setTimePeriod] = useState("7 days");
  const [open, setOpen] = useState(false);
  const timeOptions = ["Last 7 days", "Last 15 days", "Last Month", "Last Year"];
  const [copiedSlackCommand, setCopiedSlackCommand] = useState(false);
  const [previousMetrics, setPreviousMetrics] = useState<Metrics | null>(null);
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("");
  
  useEffect(() => {
    if (!isLoaded || !isOrgListLoaded || !isSignedIn) return;

    // If user has organizations but none is currently active
    if (!orgId && userMemberships.count > 0) {
      const firstOrgId = userMemberships.data[0].organization.id;
      console.log("Auto-switching to Organization:", firstOrgId);
      
      if (setActive) {
        setActive({ organization: firstOrgId });
      }
    }
  }, [isLoaded, isOrgListLoaded, isSignedIn, orgId, userMemberships, setActive]);

  // Fetch the token when the user signs in
  useEffect(() => {
    async function fetchToken() {
      if (isSignedIn) {
        setLoading(true);
        try {
          // Get the raw JWT to send to One-Backend / VS Code
          const jwt = await getToken();
          if (jwt !== token) {
            setToken(jwt || null);
          }
        } catch (err) {
          console.error("Failed to get token", err);
        } finally {
          setLoading(false);
        }
      } else {
        setToken(null);
      }
    }
    fetchToken();
  }, [isSignedIn, getToken, orgId, token]);

  // Sync user with backend to determine whether they need onboarding
  useEffect(() => {
    async function syncUser() {
      if (isSignedIn && token) {
        try {
          if (!SYNC_URL) {
            console.error("Missing env var: NEXT_PUBLIC_API_BASE_URL");
            setViewState('dashboard');
            return;
          }

          const res = await fetch(SYNC_URL, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();

          // Try multiple possible locations for org name
          const orgNameValue = 
            data.org?.name || 
            data.organization?.name || 
            data.orgName || 
            data.organizationName ||
            data.company?.name ||
            data.companyName ||
            '';

          if (orgNameValue) {
            setOrgName(orgNameValue);
          } else {
            // Log the response structure for debugging
            console.log('Sync API response (no org name found):', JSON.stringify(data, null, 2));
            // Check if response has organization data at all
            if (data.org) {
              console.log('data.org structure:', JSON.stringify(data.org, null, 2));
            }
          }

          const rawRole = data.user?.role || data.orgRole || ''; 
          if (rawRole === 'senior' || rawRole === 'org:admin' || rawRole === 'admin' || rawRole === 'teacher') {
            setUserRole("ARCHITECT");
          } else {
            setUserRole("DEVELOPER");
          }

          if (data.status === 'active') {
            setViewState('dashboard');
          } else if (data.status === 'needs_onboarding') {
            setViewState('onboarding');
          } else {
            setViewState('dashboard');
          }
        } catch (e) {
          console.error('Sync failed', e);
          setViewState('dashboard');
        }
      } else if (!isSignedIn) {
        setViewState('loading');
        setOrgName("");
      }
    }
    syncUser();
  }, [isSignedIn, token]);

  useEffect(() => {
    async function fetchMetrics() {
      if (isSignedIn && token && viewState === 'dashboard' && orgId) {
        setMetricsLoading(true);
        setMetricsError(null);
        try {
          if (!METRICS_URL) {
            console.error("Missing env var: NEXT_PUBLIC_API_BASE_URL");
            setMetrics(DEFAULT_METRICS);
            setMetricsError("Metrics endpoint isn't configured. Showing placeholder numbers for now.");
            return;
          }

          // Fetch current metrics
          const res = await fetch(METRICS_URL, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const currentMetrics = await res.json();
            setMetrics(currentMetrics);

            // Fetch historical metrics for trend calculation
            // Calculate the date based on timePeriod
            let days = 7;
            if (timePeriod === "Last 15 days") days = 15;
            else if (timePeriod === "Last Month") days = 30;
            else if (timePeriod === "Last Year") days = 365;
            
            const historicalDate = new Date();
            historicalDate.setDate(historicalDate.getDate() - days);
            
            // Try to fetch historical data if API supports it
            // For now, we'll calculate trends by comparing with stored previous values
            // In a real implementation, you'd fetch from a history endpoint
            try {
              // If your API has a history endpoint, uncomment and use this:
              // const historyRes = await fetch(`${METRICS_URL}?date=${historicalDate.toISOString()}`, {
              //   headers: { Authorization: `Bearer ${token}` },
              // });
              // if (historyRes.ok) {
              //   const historicalData = await historyRes.json();
              //   setPreviousMetrics(historicalData);
              // }
              
              // For now, we'll use localStorage to store previous metrics as a fallback
              const storedMetrics = localStorage.getItem('previousMetrics');
              if (storedMetrics) {
                const parsed = JSON.parse(storedMetrics);
                const storedDate = new Date(parsed.timestamp);
                const daysSinceStored = Math.floor((Date.now() - storedDate.getTime()) / (1000 * 60 * 60 * 24));
                
                // Use stored metrics if they're within the selected time period
                if (daysSinceStored <= days) {
                  setPreviousMetrics(parsed.metrics);
                }
              }
              
              // Store current metrics for next time
              localStorage.setItem('previousMetrics', JSON.stringify({
                metrics: currentMetrics,
                timestamp: new Date().toISOString()
              }));
            } catch (e) {
              console.warn("Could not fetch historical metrics", e);
            }
          } else {
            // Backend responded but not OK – show placeholder metrics
            setMetrics(DEFAULT_METRICS);
            setMetricsError("Showing placeholder metrics while we connect to your backend.");
          }
        } catch (e) {
          console.error("Failed to load metrics", e);
          // Network or other error – also fallback to placeholder metrics
          setMetrics(DEFAULT_METRICS);
          setMetricsError("We couldn't reach your metrics backend. Showing placeholder numbers for now.");
        } finally {
          setMetricsLoading(false);
        }
      } else {
        setMetrics(null);
        setMetricsError(null);
        setPreviousMetrics(null);
      }
    }
    fetchMetrics();
  }, [isSignedIn, token, viewState, timePeriod, orgId]);

  // Load available brains (curriculums) for the org
  useEffect(() => {
    async function fetchBrains() {
      if (!isSignedIn || !token) return;
      if (!BASE_API) return;

      try {
        const res = await fetch(`${BASE_API}/curriculum/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        const list = Array.isArray(data.brains) ? data.brains : [];
        setBrains(list);

        if (list.length > 0) {
          const current = list.find((b: any) => b.id === data.activeBrainId);
          const selected = current || list[0];
          setActiveBrain(selected.knowledgeBaseId);
        }
      } catch (e) {
        console.error('Failed to load brains', e);
      }
    }

    fetchBrains();
  }, [isSignedIn, token]);

  const refreshQaData = useCallback(async () => {
    if (!isSignedIn || !token || viewState !== 'dashboard' || !orgId) return;

    setQaLoading(true);
    setQaError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      if (!WORKFLOWS_URL || !HEALER_LOG_URL || !BUS_FACTOR_URL) {
        setQaError('QA Command Center endpoints are not configured.');
        return;
      }

      const [wfRes, logRes, bfRes] = await Promise.all([
        fetch(`${WORKFLOWS_URL}?branch=main&limit=50`, { headers }),
        fetch(`${HEALER_LOG_URL}?limit=25`, { headers }),
        fetch(`${BUS_FACTOR_URL}?branch=main&limit=50`, { headers }),
      ]);

      if (wfRes.ok) {
        const wfJson = await wfRes.json();
        setWorkflows(Array.isArray(wfJson?.workflows) ? wfJson.workflows : []);
      }
      if (logRes.ok) {
        const logJson = await logRes.json();
        setHealerLog(Array.isArray(logJson?.healer_log) ? logJson.healer_log : []);
      }
      if (bfRes.ok) {
        const bfJson = await bfRes.json();
        setBusFactor(Array.isArray(bfJson?.workflows) ? bfJson.workflows : []);
      }
    } catch (e) {
      console.error('Failed to load QA Command Center', e);
      setQaError("Couldn't load QA Command Center data. Server might be busy.");
    } finally {
      setQaLoading(false);
      setHasLoadedQa(true);
    }
  }, [isSignedIn, token, viewState, orgId]);

  useEffect(() => {
    if (isSignedIn && token && viewState === 'dashboard' && !hasLoadedQa) {
      refreshQaData();
    }
  }, [isSignedIn, token, viewState, hasLoadedQa, refreshQaData]);


  const handleCopy = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySlackCommand = () => {
    const command = `/connect ${user?.primaryEmailAddress?.emailAddress || 'teacher@example.com'}`;
    navigator.clipboard.writeText(command);
    setCopiedSlackCommand(true);
    setTimeout(() => setCopiedSlackCommand(false), 2000);
  };

  // Calculate trend indicators for metrics based on historical data
  const getTrend = (metricName: string, currentValue: number): TrendData => {
    if (!previousMetrics || !metrics) {
      // No historical data available, return neutral trend
      return { change: 0, direction: 'up', period: timePeriod };
    }

    const previousValue = previousMetrics[metricName as keyof Metrics];
    if (previousValue === undefined || previousValue === null) {
      return { change: 0, direction: 'up', period: timePeriod };
    }

    // Calculate percentage change
    let change: number;
    let direction: 'up' | 'down';

    if (previousValue === 0) {
      // Avoid division by zero
      change = currentValue > 0 ? 100 : 0;
      direction = currentValue > previousValue ? 'up' : 'down';
    } else {
      change = Math.abs(((currentValue - previousValue) / previousValue) * 100);
      direction = currentValue > previousValue ? 'up' : 'down';
    }

    // Format period string
    const periodMap: Record<string, string> = {
      'Last 7 days': 'last week',
      'Last 15 days': 'last 15 days',
      'Last Month': 'last month',
      'Last Year': 'last year',
    };

    return {
      change: Math.round(change * 100) / 100, // Round to 2 decimal places
      direction,
      period: periodMap[timePeriod] || timePeriod,
    };
  };

  const handleSlackInstall = () => {
    // Delegate OAuth flow + state handling to backend Bolt receiver
    if (!BASE_API) {
      console.error("Missing env var: NEXT_PUBLIC_API_BASE_URL");
      return;
    }
    window.location.href = `${BASE_API}/slack/install`;
  };

  const handleGithubInstall = () => {
    window.location.href = GITHUB_INSTALL_URL;
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteStatus("Sending...");

    try {
      // Always fetch a fresh token to avoid expiry issues
      const freshToken = await getToken();

      if (!freshToken) {
        setInviteStatus("❌ Error: You are not signed in.");
        return;
      }

      if (!INVITE_URL) {
        console.error("Missing env var: NEXT_PUBLIC_API_BASE_URL");
        setInviteStatus("❌ Invite endpoint isn't configured.");
        return;
      }

      const res = await fetch(INVITE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole}),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse errors; fall back to generic messages
      }

      if (res.ok) {
        const msg = data.message || `Invited ${inviteEmail} successfully.`;
        setInviteStatus(`✅ Invited as ${inviteRole}.`);
        setInviteEmail("");
      } else {
        const errorMsg = data.message || "Failed to send invite";
        setInviteStatus(`❌ ${errorMsg}`);
      }
    } catch (e: any) {
      console.error(e);
      setInviteStatus("❌ Network Connection Error");
    }
  };

  const handleOnboarding = async () => {
    if (!companyName.trim() || !token) return;
    setLoading(true);
    try {
      if (!ONBOARD_URL) {
        console.error("Missing env var: NEXT_PUBLIC_API_BASE_URL");
        return;
      }

      const res = await fetch(ONBOARD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyName }),
      });

      const data = await res.json();

      if (res.ok && data.clerkOrgId) {
        console.log("✅ Org Created via Backend. Switching Context...");
        
        // 2. CRITICAL: Tell Clerk to switch to the new Org.
        // This forces a token refresh. The new token will have org_id.
        if (setActive) {
            await setActive({ organization: data.clerkOrgId });
        }
        
        // 3. Update View
        setViewState('dashboard');
        // Optional: Reload page to ensure clean state
        window.location.reload(); 
      } else {
        console.error("Failed to create org:", data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeepLink = () => {
    // Optional: implement deep linking later using NEXT_PUBLIC_VSCODE_URI_SCHEME
    // if (token) {
    //   window.location.href = `${process.env.NEXT_PUBLIC_VSCODE_URI_SCHEME}/auth?token=${encodeURIComponent(token)}`;
    // }
  };

  const handleConnectVsCode = async () => {
    if (!token) return;

    const extensionId = "ShodhAI.Jataka";
    const params = new URLSearchParams({ token });
    if (activeBrain) {
      params.append('curriculumId', activeBrain);
    }
    const uri = `vscode://${extensionId}/auth?${params.toString()}`;
    window.location.href = uri;
  };

  const handleCreateBrain = async () => {
    if (!token || !newBrainName.trim()) return;
    if (!BASE_API) return;

    try {
      await fetch(`${BASE_API}/curriculum/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newBrainName.trim() }),
      });
      setNewBrainName("");
      window.location.reload();
    } catch (e) {
      console.error('Failed to create brain', e);
    }
  };

  if (!isLoaded) {
    return (
      <div className="auth-bg flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-in">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles size={20} className="text-white animate-pulse" />
          </div>
          <div className="h-1 w-16 rounded-full overflow-hidden bg-[var(--bg-elevated)]">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'onboarding' && isSignedIn) {
    return (
      <main className="auth-bg min-h-screen flex items-center justify-center px-4">
        <div className="relative z-10 w-full max-w-md animate-in">
          <div className="card p-8 backdrop-blur-xl bg-[var(--bg-card)]/80">
            <div className="text-center mb-8">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/25">
                <Sparkles size={24} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Create your workspace</h2>
              <p className="text-sm text-[var(--text-muted)] mt-2">Name your organization to get started with Jataka.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Organization name</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input"
                  placeholder="Acme Corp"
                />
              </div>
              <button
                onClick={handleOnboarding}
                disabled={loading}
                className="btn-primary w-full py-3"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating...
                  </span>
                ) : 'Create Workspace'}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {!isSignedIn ? (
        /* ─── Sign-In Screen ─── */
        <div className="auth-bg flex min-h-screen items-center justify-center px-4">
          <div className="relative z-10 w-full max-w-md animate-in">
            <div className="card p-8 backdrop-blur-xl bg-[var(--bg-card)]/80 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/25">
                <Sparkles size={28} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Jataka</h1>
              <p className="text-[var(--text-muted)] text-sm mb-8 max-w-xs mx-auto">Developer context & guardrails for your engineering team.</p>
              <SignInButton mode="modal">
                <button className="btn-primary w-full py-3 text-[15px]">
                  Get Started
                </button>
              </SignInButton>
              <p className="mt-5 text-xs text-[var(--text-faint)]">
                Sign in with Google or GitHub to continue.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Dashboard Layout ─── */
        <div className="flex min-h-screen">
          <Sidebar orgName={orgName} userRole={userRole} />

          <div className="flex-1 overflow-y-auto">
            {/* ─── Top Bar ─── */}
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/80 backdrop-blur-xl px-6 lg:px-10 h-16">
              <div>
                <h1 className="text-[17px] font-semibold text-[var(--text-primary)] tracking-tight">Overview</h1>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {orgName ? `${orgName} · ` : ''}{user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {userRole === 'ARCHITECT' && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300">
                    <Crown size={12} /> Architect
                  </span>
                )}
                {userRole === 'DEVELOPER' && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-300">
                    <Code2 size={12} /> Developer
                  </span>
                )}
              </div>
            </header>

            <div className="px-6 lg:px-10 py-8 max-w-[1280px] mx-auto">
              {/* ─── Metrics Section ─── */}
              <section className="mb-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Team Brain Health</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Key metrics for your engineering knowledge base</p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setOpen(!open)}
                      className="flex items-center gap-2 rounded-lg bg-[var(--bg-card)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-all duration-200"
                    >
                      {timePeriod}
                      <ChevronDown size={13} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="absolute right-0 z-50 mt-2 min-w-[160px] rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] shadow-2xl shadow-black/40 overflow-hidden backdrop-blur-xl">
                        {timeOptions.filter((option) => option !== timePeriod).map((item) => (
                          <button
                            key={item}
                            onClick={() => { setTimePeriod(item); setOpen(false); }}
                            className="block w-full px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors duration-150"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {metricsLoading && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((key) => (
                      <div key={key} className="skeleton h-[120px]" />
                    ))}
                  </div>
                )}

                {!metricsLoading && metrics && (() => {
                  const metricCards = [
                    {
                      title: "Senior Deflection",
                      value: `${metrics.senior_deflection_rate.toFixed(1)}%`,
                      metricKey: 'senior_deflection_rate' as keyof Metrics,
                      currentValue: metrics.senior_deflection_rate,
                      icon: ShieldCheck,
                      colorClass: "text-emerald-400",
                      bgClass: "bg-emerald-500/10",
                      stripClass: "metric-emerald",
                    },
                    {
                      title: "Files Documented",
                      value: metrics.knowledge_coverage_files.toString(),
                      metricKey: 'knowledge_coverage_files' as keyof Metrics,
                      currentValue: metrics.knowledge_coverage_files,
                      icon: BookOpen,
                      colorClass: "text-blue-400",
                      bgClass: "bg-blue-500/10",
                      stripClass: "metric-blue",
                    },
                    {
                      title: "Knowledge Drift",
                      value: `${metrics.drift_score.toFixed(1)}%`,
                      metricKey: 'drift_score' as keyof Metrics,
                      currentValue: metrics.drift_score,
                      icon: AlertTriangle,
                      colorClass: "text-amber-400",
                      bgClass: "bg-amber-500/10",
                      stripClass: "metric-amber",
                    },
                    {
                      title: "Avg Mastery Time",
                      value: `${metrics.avg_hours_to_mastery.toFixed(1)}h`,
                      metricKey: 'avg_hours_to_mastery' as keyof Metrics,
                      currentValue: metrics.avg_hours_to_mastery,
                      icon: Clock,
                      colorClass: "text-purple-400",
                      bgClass: "bg-purple-500/10",
                      stripClass: "metric-purple",
                    },
                    {
                      title: "Context Success",
                      value: `${metrics.context_injection_rate.toFixed(1)}%`,
                      metricKey: 'context_injection_rate' as keyof Metrics,
                      currentValue: metrics.context_injection_rate,
                      icon: Activity,
                      colorClass: "text-teal-400",
                      bgClass: "bg-teal-500/10",
                      stripClass: "metric-teal",
                    }
                  ];

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {metricCards.map((card, idx) => {
                        const trend = getTrend(card.metricKey, card.currentValue);
                        const displayValue = card.metricKey === 'avg_hours_to_mastery'
                          ? `${Math.round(card.currentValue)} hrs`
                          : card.metricKey === 'knowledge_coverage_files'
                          ? card.currentValue.toString()
                          : card.value;
                        const Icon = card.icon;
                        const isPositive = card.metricKey === 'drift_score' ? trend.direction === 'down' : trend.direction === 'up';
                        const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

                        return (
                          <div
                            key={card.metricKey}
                            className={`card metric-card ${card.stripClass} p-5 animate-in`}
                            style={{ animationDelay: `${idx * 80}ms` }}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className={`w-8 h-8 rounded-lg ${card.bgClass} flex items-center justify-center`}>
                                <Icon size={16} className={card.colorClass} />
                              </div>
                            </div>
                            <p className="text-[26px] font-bold text-[var(--text-primary)] tracking-tight leading-none">{displayValue}</p>
                            <p className="text-[11px] font-medium text-[var(--text-muted)] mt-1.5 mb-3">{card.title}</p>
                            {trend.change > 0 && (
                              <div className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                <TrendIcon size={12} />
                                {trend.change}%
                                <span className="text-[var(--text-faint)] font-normal ml-0.5">vs {trend.period}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {metricsError && (
                  <div className="mt-4 rounded-xl bg-amber-500/5 border border-amber-500/15 px-4 py-3 text-xs text-amber-300/80">
                    {metricsError}
                  </div>
                )}
              </section>

              {/* ─── Brain Context + Actions ─── */}
              <section className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Active Brain */}
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                      <Brain size={18} className="text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Active Brain</h3>
                      <p className="text-[11px] text-[var(--text-muted)]">Current knowledge context</p>
                    </div>
                  </div>
                  <div className="relative mb-4">
                    <select
                      className="input appearance-none pr-9 cursor-pointer"
                      value={activeBrain}
                      onChange={async (e) => {
                        const kb = e.target.value;
                        setActiveBrain(kb);
                        const brain = brains.find((b: any) => b.knowledgeBaseId === kb);
                        if (brain && token && BASE_API) {
                          try {
                            await fetch(`${BASE_API}/curriculum/switch`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ curriculumId: brain.id }),
                            });
                          } catch (err) {
                            console.error('Failed to switch brain', err);
                          }
                        }
                      }}
                    >
                      {brains.length > 0 ? (
                        brains.map((b) => (
                          <option key={b.id} value={b.knowledgeBaseId}>
                            {b.name} ({b.knowledgeBaseId?.substring(0, 15)}...)
                          </option>
                        ))
                      ) : (
                        <option value="">No brains available</option>
                      )}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  </div>
                  <button
                    onClick={handleConnectVsCode}
                    className="btn-primary w-full"
                  >
                    <ExternalLink size={14} />
                    Connect VS Code
                  </button>
                </div>

                {/* Create Brain / Dev Placeholder */}
                {userRole === 'ARCHITECT' ? (
                  <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                        <Plus size={18} className="text-violet-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">New Brain</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">Create a knowledge context</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      className="input mb-4"
                      placeholder="e.g. Mobile App V2"
                      value={newBrainName}
                      onChange={(e) => setNewBrainName(e.target.value)}
                    />
                    <button
                      onClick={handleCreateBrain}
                      disabled={!newBrainName.trim()}
                      className="btn-primary w-full"
                    >
                      <Plus size={14} />
                      Create Brain
                    </button>
                  </div>
                ) : (
                  <div className="card p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center mb-3">
                      <Brain size={18} className="text-[var(--text-faint)]" />
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">Brain creation requires<br /><span className="text-[var(--text-secondary)] font-medium">Architect</span> role.</p>
                  </div>
                )}

                {/* Integrations / Slack Command */}
                {userRole === 'ARCHITECT' ? (
                  <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
                        <Plug size={18} className="text-sky-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Integrations</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">Connect your tools</p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <button
                        onClick={handleSlackInstall}
                        className="w-full flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all duration-200"
                      >
                        <img src="/slack-new.png" alt="Slack" className="w-5 h-5" />
                        <span className="font-medium">Add to Slack</span>
                        <ExternalLink size={13} className="ml-auto text-[var(--text-faint)]" />
                      </button>
                      <button
                        onClick={handleGithubInstall}
                        className="w-full flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all duration-200"
                      >
                        <img src="/github.png" alt="GitHub" className="w-5 h-5" />
                        <span className="font-medium">Connect GitHub</span>
                        <ExternalLink size={13} className="ml-auto text-[var(--text-faint)]" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Terminal size={18} className="text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Slack Command</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">Connect your Slack account</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-[var(--bg-input)] px-4 py-3 border border-[var(--border-default)]">
                      <code className="flex-1 text-xs text-[var(--text-secondary)] font-mono truncate">
                        /connect {user?.primaryEmailAddress?.emailAddress || 'user@example.com'}
                      </code>
                      <button onClick={handleCopySlackCommand} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors" title="Copy">
                        {copiedSlackCommand ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* ─── Graph Visualizer ─── */}
              <section id="graph" className="mb-10">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Knowledge Graph</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Explore your codebase relationships</p>
                  </div>
                  <button
                    onClick={() => setIsGraphFullScreen(!isGraphFullScreen)}
                    className="btn-ghost text-xs py-1.5 px-3"
                    title={isGraphFullScreen ? "Minimize" : "Full Screen"}
                  >
                    {isGraphFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    <span className="hidden sm:inline">{isGraphFullScreen ? "Minimize" : "Expand"}</span>
                  </button>
                </div>
                <div
                  className={`${
                    isGraphFullScreen
                      ? "fixed inset-0 z-[100] bg-[var(--bg-base)] flex flex-col"
                      : "relative card overflow-hidden"
                  } transition-all duration-200`}
                >
                  <div className={`w-full ${isGraphFullScreen ? "flex-1 h-full [&>div]:h-full" : ""}`}>
                    <GraphVisualizer baseUrl={BASE_API} activeBrainId={activeBrain} />
                  </div>
                  {isGraphFullScreen && (
                    <div className="absolute z-[110] bottom-4 right-4">
                      <button
                        onClick={() => setIsGraphFullScreen(false)}
                        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-white bg-[var(--bg-card)]/90 hover:bg-[var(--bg-elevated)] backdrop-blur-md border border-[var(--border-default)] transition-all duration-200"
                      >
                        <Minimize2 size={14} />
                        Exit Full Screen
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* ─── Utility Cards ─── */}
              <section className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Invite Team */}
                {userRole === 'ARCHITECT' ? (
                  <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                        <Users size={18} className="text-rose-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Invite Team</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">Add members to your org</p>
                      </div>
                    </div>
                    <div className="relative mb-3">
                      <input
                        type="email"
                        className="input pr-10"
                        placeholder="team@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                      <button
                        onClick={handleInvite}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-indigo-400 transition-colors"
                        title="Send invite"
                      >
                        <Send size={15} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setInviteRole('developer')}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all duration-200 ${
                          inviteRole === 'developer'
                            ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300'
                            : 'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-faint)] hover:text-[var(--text-secondary)]'
                        }`}
                      >
                        Developer
                      </button>
                      <button
                        onClick={() => setInviteRole('architect')}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all duration-200 ${
                          inviteRole === 'architect'
                            ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                            : 'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-faint)] hover:text-[var(--text-secondary)]'
                        }`}
                      >
                        Architect
                      </button>
                    </div>
                    {inviteStatus && (
                      <p className="mt-3 text-xs text-[var(--text-muted)] bg-[var(--bg-input)] rounded-lg px-3 py-2">{inviteStatus}</p>
                    )}
                  </div>
                ) : (
                  <div className="card p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center mb-3">
                      <Users size={18} className="text-[var(--text-faint)]" />
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">Contact an <span className="text-[var(--text-secondary)] font-medium">Architect</span> to invite team members.</p>
                  </div>
                )}

                {/* Slack Command */}
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Terminal size={18} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Slack Command</h3>
                      <p className="text-[11px] text-[var(--text-muted)]">Link your Slack identity</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-[var(--bg-input)] px-4 py-3 border border-[var(--border-default)]">
                    <code className="flex-1 text-xs text-[var(--text-secondary)] font-mono truncate">
                      /connect {user?.primaryEmailAddress?.emailAddress || 'user@example.com'}
                    </code>
                    <button onClick={handleCopySlackCommand} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors" title="Copy">
                      {copiedSlackCommand ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>

                {/* Access Token */}
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Key size={18} className="text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Access Token</h3>
                      <p className="text-[11px] text-[var(--text-muted)]">For CLI & API access</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-[var(--bg-input)] px-4 py-3 border border-[var(--border-default)]">
                    <code className="flex-1 truncate text-xs text-[var(--text-secondary)] font-mono">
                      {loading ? 'Loading...' : token ? `${token.substring(0, 24)}...` : 'No token'}
                    </code>
                    <button onClick={handleCopy} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors" title="Copy token">
                      {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
