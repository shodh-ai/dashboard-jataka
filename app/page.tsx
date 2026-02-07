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
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
      </div>
    );
  }

  if (viewState === 'onboarding' && isSignedIn) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-lg bg-white flex items-center justify-center mb-4">
              <img src="/WhiteLOGO.svg" alt="Jataka" className="w-5 h-5 invert" />
            </div>
            <h2 className="text-xl font-semibold text-white">Create your workspace</h2>
            <p className="text-sm text-[#888]">Set up your organization to get started.</p>
          </div>

          <div className="space-y-3">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#111] text-white text-sm border border-[#222] focus:border-[#444] outline-none placeholder-[#555] transition-colors"
              placeholder="Acme Corp"
            />
            <button
              onClick={handleOnboarding}
              disabled={loading}
              className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
      {!isSignedIn ? (
        /* ─── Sign-In Screen ─── */
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <img src="/WhiteLOGO.svg" alt="Jataka" className="w-5 h-5 invert" />
              </div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">Jataka</h1>
              <p className="text-sm text-[#888]">Developer Context & Guardrails</p>
            </div>
            <SignInButton mode="modal">
              <button className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90">
                Sign in with Google / GitHub
              </button>
            </SignInButton>
            <p className="text-center text-xs text-[#555]">
              Sign in to verify your organization access.
            </p>
          </div>
        </div>
      ) : (
        /* ─── Dashboard Layout with Sidebar ─── */
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <Sidebar orgName={orgName} userRole={userRole} />

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Top Bar */}
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a]/80 backdrop-blur-md px-6 lg:px-10 py-4">
              <div>
                <h1 className="text-lg font-semibold text-white">Overview</h1>
                <p className="text-xs text-[#666] mt-0.5">
                  {orgName ? `${orgName} · ` : ''}{user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {userRole === 'ARCHITECT' && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#1a1a1a] border border-[#222] px-2.5 py-1 text-xs font-medium text-[#ccc]">
                    <Crown size={12} className="text-amber-400" /> Architect
                  </span>
                )}
                {userRole === 'DEVELOPER' && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#1a1a1a] border border-[#222] px-2.5 py-1 text-xs font-medium text-[#ccc]">
                    <Code2 size={12} className="text-blue-400" /> Developer
                  </span>
                )}
              </div>
            </header>

            <div className="px-6 lg:px-10 py-8 max-w-[1200px]">
              {/* ─── Metrics Section ─── */}
              <section className="mb-8">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider">Team Brain Health</h2>
                  <div className="relative">
                    <button
                      onClick={() => setOpen(!open)}
                      className="flex items-center gap-2 rounded-lg bg-[#111] px-3 py-1.5 text-xs text-[#aaa] border border-[#222] hover:border-[#333] transition-colors"
                    >
                      {timePeriod}
                      <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="absolute right-0 z-50 mt-1 min-w-[140px] rounded-lg bg-[#111] border border-[#222] shadow-2xl overflow-hidden">
                        {timeOptions.filter((option) => option !== timePeriod).map((item) => (
                          <button
                            key={item}
                            onClick={() => { setTimePeriod(item); setOpen(false); }}
                            className="block w-full px-3 py-2 text-left text-xs text-[#aaa] hover:bg-[#1a1a1a] hover:text-white transition-colors"
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
                      <div key={key} className="h-24 rounded-lg bg-[#111] border border-[#1f1f1f] animate-pulse" />
                    ))}
                  </div>
                )}

                {!metricsLoading && metrics && (() => {
                  const metricCards = [
                    {
                      title: "Senior Deflection Rate",
                      value: `${metrics.senior_deflection_rate.toFixed(1)}%`,
                      metricKey: 'senior_deflection_rate' as keyof Metrics,
                      currentValue: metrics.senior_deflection_rate,
                      icon: ShieldCheck,
                      color: "text-emerald-400",
                      trendText: (trend: TrendData) => `+${trend.change}% from ${trend.period}`
                    },
                    {
                      title: "Files Documented",
                      value: metrics.knowledge_coverage_files.toString(),
                      metricKey: 'knowledge_coverage_files' as keyof Metrics,
                      currentValue: metrics.knowledge_coverage_files,
                      icon: BookOpen,
                      color: "text-blue-400",
                      trendText: (trend: TrendData) => `+${trend.change}% from ${trend.period}`
                    },
                    {
                      title: "Knowledge Drift",
                      value: `${metrics.drift_score.toFixed(1)}%`,
                      metricKey: 'drift_score' as keyof Metrics,
                      currentValue: metrics.drift_score,
                      icon: AlertTriangle,
                      color: "text-orange-400",
                      trendText: (trend: TrendData) => `-${trend.change}% from ${trend.period}`
                    },
                    {
                      title: "Avg Mastery Time",
                      value: `${metrics.avg_hours_to_mastery.toFixed(1)}h`,
                      metricKey: 'avg_hours_to_mastery' as keyof Metrics,
                      currentValue: metrics.avg_hours_to_mastery,
                      icon: Clock,
                      color: "text-purple-400",
                      trendText: (trend: TrendData) => `+${trend.change}% from ${trend.period}`
                    },
                    {
                      title: "Context Success",
                      value: `${metrics.context_injection_rate.toFixed(1)}%`,
                      metricKey: 'context_injection_rate' as keyof Metrics,
                      currentValue: metrics.context_injection_rate,
                      icon: Activity,
                      color: "text-teal-400",
                      trendText: (trend: TrendData) => `+${trend.change}% from ${trend.period}`
                    }
                  ];

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {metricCards.map((card) => {
                        const trend = getTrend(card.metricKey, card.currentValue);
                        const displayValue = card.metricKey === 'avg_hours_to_mastery'
                          ? `${Math.round(card.currentValue)} hrs`
                          : card.metricKey === 'knowledge_coverage_files'
                          ? card.currentValue.toString()
                          : card.value;
                        const Icon = card.icon;

                        return (
                          <div key={card.metricKey} className="rounded-lg bg-[#111] border border-[#1f1f1f] p-4 hover:border-[#333] transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs text-[#666] font-medium">{card.title}</p>
                              <Icon size={14} className={card.color} />
                            </div>
                            <p className="text-2xl font-semibold text-white tracking-tight">{displayValue}</p>
                            <p className="mt-1.5 text-[11px] text-[#555]">{card.trendText(trend)}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </section>

              {/* ─── Brain Context + Actions ─── */}
              <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Active Brain */}
                <div className="rounded-lg bg-[#111] border border-[#1f1f1f] p-5 hover:border-[#333] transition-colors">
                  <h3 className="text-sm font-medium text-white mb-4">Active Brain Context</h3>
                  <div className="relative mb-3">
                    <select
                      className="w-full appearance-none rounded-md bg-[#0a0a0a] px-3 py-2.5 pr-8 text-sm text-white border border-[#222] focus:border-[#444] outline-none"
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
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555]" />
                  </div>
                  <button
                    onClick={handleConnectVsCode}
                    className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
                  >
                    Connect VS Code
                  </button>
                </div>

                {/* Create Brain / Integrations */}
                {userRole === 'ARCHITECT' ? (
                  <div className="rounded-lg bg-[#111] border border-[#1f1f1f] p-5 hover:border-[#333] transition-colors">
                    <h3 className="text-sm font-medium text-white mb-4">Create New Brain</h3>
                    <input
                      type="text"
                      className="w-full mb-3 rounded-md bg-[#0a0a0a] px-3 py-2.5 text-sm text-white border border-[#222] focus:border-[#444] outline-none placeholder-[#444]"
                      placeholder="e.g. Mobile App V2"
                      value={newBrainName}
                      onChange={(e) => setNewBrainName(e.target.value)}
                    />
                    <button
                      onClick={handleCreateBrain}
                      className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
                    >
                      Create
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#111] border border-[#1f1f1f] p-5 flex items-center justify-center">
                    <p className="text-xs text-[#555]">Brain creation requires Architect role.</p>
                  </div>
                )}

                {/* Connect Workspace */}
                {userRole === 'ARCHITECT' ? (
                  <div className="rounded-lg bg-[#111] border border-[#1f1f1f] p-5 hover:border-[#333] transition-colors">
                    <h3 className="text-sm font-medium text-white mb-4">Integrations</h3>
                    <div className="space-y-2">
                      <button
                        onClick={handleSlackInstall}
                        className="w-full flex items-center gap-2.5 rounded-md border border-[#222] px-3 py-2 text-sm text-[#ccc] hover:border-[#444] hover:text-white transition-colors"
                      >
                        <img src="/slack-new.png" alt="Slack" className="w-4 h-4" />
                        Add to Slack
                      </button>
                      <button
                        onClick={handleGithubInstall}
                        className="w-full flex items-center gap-2.5 rounded-md border border-[#222] px-3 py-2 text-sm text-[#ccc] hover:border-[#444] hover:text-white transition-colors"
                      >
                        <img src="/github.png" alt="GitHub" className="w-4 h-4" />
                        Connect GitHub
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#111] border border-[#1f1f1f] p-5 hover:border-[#333] transition-colors">
                    <h3 className="text-sm font-medium text-white mb-4">Slack Command</h3>
                    <div className="flex items-center gap-2 rounded-md bg-[#0a0a0a] px-3 py-2.5 border border-[#222]">
                      <code className="flex-1 text-xs text-[#888] font-mono truncate">
                        /connect {user?.primaryEmailAddress?.emailAddress || 'user@example.com'}
                      </code>
                      <button onClick={handleCopySlackCommand} className="text-[#555] hover:text-white transition-colors" title="Copy">
                        {copiedSlackCommand ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* ─── Graph Visualizer ─── */}
              <section id="graph" className="mb-8">
                <div
                  className={`${
                    isGraphFullScreen
                      ? "fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col"
                      : "relative"
                  } transition-all duration-200`}
                >
                  <div className={`w-full ${isGraphFullScreen ? "flex-1 h-full [&>div]:h-full" : ""}`}>
                    <GraphVisualizer baseUrl={BASE_API} activeBrainId={activeBrain} />
                  </div>
                  <div className={`absolute z-[110] flex gap-2 ${isGraphFullScreen ? "bottom-2 right-4" : "bottom-2 right-4"}`}>
                    <button
                      onClick={() => setIsGraphFullScreen(!isGraphFullScreen)}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition-colors ${
                        isGraphFullScreen
                          ? "bg-white/10 hover:bg-white/20 backdrop-blur-sm"
                          : "bg-[#1a1a1a] hover:bg-[#222] border border-[#333]"
                      }`}
                      title={isGraphFullScreen ? "Minimize" : "Full Screen"}
                    >
                      {isGraphFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      <span className="hidden sm:inline">{isGraphFullScreen ? "Minimize" : "Expand"}</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* ─── Utility Cards ─── */}
              <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Invite Team */}
                {userRole === 'ARCHITECT' ? (
                  <div className="rounded-lg bg-[#111] border border-[#1f1f1f] p-5 hover:border-[#333] transition-colors">
                    <h3 className="text-sm font-medium text-white mb-4">Invite Team</h3>
                    <div className="relative mb-3">
                      <input
                        type="email"
                        className="w-full rounded-md bg-[#0a0a0a] px-3 py-2.5 pr-9 text-sm text-white border border-[#222] focus:border-[#444] outline-none placeholder-[#444]"
                        placeholder="team@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                      <button
                        onClick={handleInvite}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
                        title="Send invite"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setInviteRole('developer')}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                          inviteRole === 'developer'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                            : 'bg-[#0a0a0a] border-[#222] text-[#555]'
                        }`}
                      >
                        Developer
                      </button>
                      <button
                        onClick={() => setInviteRole('architect')}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                          inviteRole === 'architect'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-[#0a0a0a] border-[#222] text-[#555]'
                        }`}
                      >
                        Architect
                      </button>
                    </div>
                    {inviteStatus && (
                      <p className="mt-2 text-xs text-[#666]">{inviteStatus}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#111] border border-[#1f1f1f] p-5 flex items-center justify-center">
                    <p className="text-xs text-[#555] text-center">Contact an Architect to invite members.</p>
                  </div>
                )}

                {/* Slack Command */}
                <div className="rounded-lg bg-[#111] border border-[#1f1f1f] p-5 hover:border-[#333] transition-colors">
                  <h3 className="text-sm font-medium text-white mb-4">Slack Command</h3>
                  <div className="flex items-center gap-2 rounded-md bg-[#0a0a0a] px-3 py-2.5 border border-[#222]">
                    <code className="flex-1 text-xs text-[#888] font-mono truncate">
                      /connect {user?.primaryEmailAddress?.emailAddress || 'user@example.com'}
                    </code>
                    <button onClick={handleCopySlackCommand} className="text-[#555] hover:text-white transition-colors" title="Copy">
                      {copiedSlackCommand ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Access Token */}
                <div className="rounded-lg bg-[#111] border border-[#1f1f1f] p-5 hover:border-[#333] transition-colors">
                  <h3 className="text-sm font-medium text-white mb-4">Access Token</h3>
                  <div className="flex items-center gap-2 rounded-md bg-[#0a0a0a] px-3 py-2.5 border border-[#222]">
                    <code className="flex-1 truncate text-xs text-[#888] font-mono">
                      {loading ? 'Loading...' : token ? `${token.substring(0, 24)}...` : 'No token'}
                    </code>
                    <button onClick={handleCopy} className="text-[#555] hover:text-white transition-colors" title="Copy token">
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </section>

              {/* QA Command Center Section - commented out in original */}
              {/* <section className="mb-8">...</section> */}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
