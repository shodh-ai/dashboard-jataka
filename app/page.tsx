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
  Play,
  X,
  Database,
} from "lucide-react";
import GraphVisualizer from "./components/GraphVisualizer";
import ReplayPlayer from "./components/ReplayPlayer";
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
  const [billingTier, setBillingTier] = useState<string>("FREE");
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
  const [selectedReplay, setSelectedReplay] = useState<string | null>(null);

  const MOCK_PR_SCANS = [
    { id: 'pr-108', name: 'fix/revenue-schedule-trigger', branch: 'main', status: 'Blocked', limits: '102/100 SOQL', eventsUrl: '/mock-replay.json', time: '10 mins ago' },
    { id: 'pr-107', name: 'feat/cpq-discount-automation', branch: 'main', status: 'Passed', limits: '45/100 SOQL', eventsUrl: null, time: '2 hours ago' },
    { id: 'pr-106', name: 'chore/update-api-version', branch: 'main', status: 'Passed', limits: '12/100 SOQL', eventsUrl: null, time: '5 hours ago' },
    { id: 'pr-105', name: 'feat/batch-lead-routing', branch: 'main', status: 'Blocked', limits: '150/100 SOQL', eventsUrl: '/mock-replay-2.json', time: '1 day ago' },
  ];
  
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
          const orgData = data.org || data.organization || {}; // <--- Helper for org data
          const orgNameValue = 
            orgData.name || 
            data.orgName || 
            data.organizationName ||
            data.company?.name ||
            data.companyName ||
            '';

          if (orgNameValue) {
            setOrgName(orgNameValue);
          } 
          
          // ---> ADD THESE TWO LINES <---
          const tier = orgData.billingTier || 'FREE';
          setBillingTier(tier);

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
      <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
      </div>
    );
  }

  if (viewState === 'onboarding' && isSignedIn) {
    return (
      <main className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Create workspace</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-2">Set up your organization to continue</p>
          </div>
          <div className="space-y-4">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="input"
              placeholder="Acme Inc"
            />
            <button
              onClick={handleOnboarding}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {!isSignedIn ? (
        /* ─── Sign-In Screen ─── */
        <div className="flex min-h-screen items-center justify-center px-4 bg-[var(--bg-base)]">
          <div className="w-full max-w-sm text-center">
            <h1 className="text-3xl font-semibold text-[var(--text-primary)] mb-2">Jataka</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-8">Developer context & guardrails</p>
            <SignInButton mode="modal">
              <button className="btn-primary w-full">
                Sign in to continue
              </button>
            </SignInButton>
          </div>
        </div>
      ) : (
        /* ─── Dashboard Layout ─── */
        <div className="flex min-h-screen">
          <Sidebar orgName={orgName} userRole={userRole} />

          <div className="flex-1 overflow-y-auto">
            {/* ─── Top Bar ─── */}
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-base)] px-6 lg:px-10 h-14">
              <div>
                <h1 className="text-sm font-medium text-[var(--text-primary)]">Overview</h1>
                <p className="text-xs text-[var(--text-muted)]">
                  {orgName ? `${orgName} · ` : ''}{user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* ---> ADD THIS NEW TIER BADGE <--- */}
                <span className={`badge ${['ENTERPRISE', 'VIP_BETA', 'PRO'].includes(billingTier) ? 'badge-emerald' : 'badge-indigo'}`}>
                  {billingTier === 'FREE' ? 'Free Tier' : billingTier}
                </span>

                {userRole === 'ARCHITECT' && (
                  <span className="badge badge-amber">
                    <Crown size={10} /> Architect
                  </span>
                )}
                {userRole === 'DEVELOPER' && (
                  <span className="badge badge-indigo">
                    <Code2 size={10} /> Developer
                  </span>
                )}
              </div>
            </header>

            <div className="px-6 lg:px-10 py-6 max-w-6xl mx-auto">
              {/* ─── Command Center Wallet ─── */}
              <section className="mb-8">
                <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Command Center</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card p-6 border-l-4 border-[var(--accent)] flex flex-col justify-center">
                    <div className="text-sm text-[var(--text-secondary)] font-medium mb-1">PRs Protected This Month</div>
                    <div className="text-4xl font-bold text-[var(--text-primary)]">124</div>
                  </div>
                  <div className="card p-6 border-l-4 border-emerald-500 flex flex-col justify-center">
                    <div className="text-sm text-[var(--text-secondary)] font-medium mb-1">Governor Limits Prevented</div>
                    <div className="text-4xl font-bold text-[var(--text-primary)]">18</div>
                  </div>
                  <div className="card p-6 border-l-4 border-amber-500 flex flex-col justify-center">
                    <div className="text-sm text-[var(--text-secondary)] font-medium mb-1">Credits Remaining</div>
                    <div className="flex items-end justify-between mt-1 mb-2">
                       <span className="text-4xl font-bold text-[var(--text-primary)]">85<span className="text-xl text-[var(--text-muted)] font-normal">/100</span></span>
                       <span className="text-sm font-medium text-amber-500 mb-2">85%</span>
                    </div>
                    <div className="w-full bg-[var(--bg-base)] rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full transition-all duration-1000" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ─── Recent PR Scans Table ─── */}
              <section className="mb-8">
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--border-default)] flex justify-between items-center bg-[var(--bg-surface)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[var(--accent)]" />
                      Recent PR Scans
                    </h3>
                    <button className="text-xs btn-secondary py-1 px-3">View All</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-[var(--bg-base)] text-[var(--text-secondary)] uppercase text-[11px] tracking-wider">
                        <tr>
                          <th className="px-5 py-3 font-medium">PR Name / Branch</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">SOQL Limits</th>
                          <th className="px-5 py-3 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-default)]">
                        {MOCK_PR_SCANS.map(scan => (
                          <tr key={scan.id} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                                {scan.name}
                                <span className="text-[11px] text-[var(--text-muted)] font-normal">{scan.time}</span>
                              </div>
                              <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-1 font-mono">
                                <Code2 size={12} /> {scan.branch}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {scan.status === 'Passed' ? (
                                <span className="badge badge-emerald bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><Check size={12} className="mr-1"/> Passed</span>
                              ) : (
                                <span className="badge badge-rose bg-rose-500/10 text-rose-500 border border-rose-500/20"><AlertTriangle size={12} className="mr-1"/> Blocked</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                <Database size={14} className={scan.status === 'Blocked' ? 'text-rose-500' : 'text-[var(--text-muted)]'} />
                                <span className={`font-mono text-xs ${scan.status === 'Blocked' ? 'text-rose-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>
                                  {scan.limits}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              {scan.status === 'Blocked' && (
                                 <button 
                                   onClick={() => setSelectedReplay(scan.eventsUrl || '/mock-replay.json')}
                                   className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)]"
                                 >
                                   <Play size={14} fill="currentColor" /> Play Video
                                 </button>
                              )}
                              {scan.status === 'Passed' && (
                                 <button className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1.5 font-medium">Details</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* ─── Graph Visualizer ─── */}
              <section id="graph" className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="section-title mb-0">Knowledge Graph</h2>
                  <button
                    onClick={() => setIsGraphFullScreen(!isGraphFullScreen)}
                    className="btn-secondary text-xs py-1.5"
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
                        className="btn-secondary"
                      >
                        <Minimize2 size={14} />
                        Exit Full Screen
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* ─── Developer Tools / Integrations (Compact) ─── */}
              <section className="mb-8">
                <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Developer Tools</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Active Brain */}
                  <div className="card p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wide"><Brain size={12}/> Active Base</h3>
                    </div>
                    <select
                      className="input select text-xs py-1 px-2 min-h-0 h-7 mb-2"
                      value={activeBrain}
                      onChange={async (e) => {
                        const kb = e.target.value;
                        setActiveBrain(kb);
                        const brain = brains.find((b: any) => b.knowledgeBaseId === kb);
                        if (brain && token && BASE_API) {
                          try {
                            await fetch(`${BASE_API}/curriculum/switch`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ curriculumId: brain.id }),
                            });
                          } catch (err) {}
                        }
                      }}
                    >
                      {brains.length > 0 ? brains.map((b) => (<option key={b.id} value={b.knowledgeBaseId}>{b.name}</option>)) : <option value="">No brains</option>}
                    </select>
                    <button onClick={handleConnectVsCode} className="btn-secondary text-[11px] w-full py-1"><ExternalLink size={10} /> VS Code</button>
                  </div>
                  
                  {/* Integrations */}
                  {userRole === 'ARCHITECT' && (
                    <div className="card p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[11px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wide"><Plug size={12}/> Install</h3>
                      </div>
                      <div className="flex gap-2 h-full flex-col justify-end">
                        <button onClick={handleSlackInstall} className="btn-secondary w-full text-[11px] py-1 px-0 justify-center"><img src="/slack-new.png" alt="Slack" className="w-3 h-3 mr-1" /> Slack</button>
                        <button onClick={handleGithubInstall} className="btn-secondary w-full text-[11px] py-1 px-0 justify-center"><img src="/github.png" alt="GitHub" className="w-3 h-3 mr-1" /> GitHub</button>
                      </div>
                    </div>
                  )}

                  {/* Slack Command */}
                  <div className="card p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wide"><Terminal size={12}/> Slack Connect</h3>
                    </div>
                    <div className="flex items-center gap-2 rounded bg-[var(--bg-base)] px-2 py-1.5 border border-[var(--border-default)] mt-auto">
                      <code className="flex-1 text-[10px] text-[var(--text-secondary)] font-mono truncate">/connect {user?.primaryEmailAddress?.emailAddress || 'user'}</code>
                      <button onClick={handleCopySlackCommand} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        {copiedSlackCommand ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Access Token */}
                  <div className="card p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wide"><Key size={12}/> API Token</h3>
                    </div>
                    <div className="flex items-center gap-2 rounded bg-[var(--bg-base)] px-2 py-1.5 border border-[var(--border-default)] mt-auto">
                      <code className="flex-1 truncate text-[10px] text-[var(--text-secondary)] font-mono">
                        {loading ? '...' : token ? `${token.substring(0, 16)}...` : 'None'}
                      </code>
                      <button onClick={handleCopy} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        {copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* ─── Replay Modal ─── */}
          {selectedReplay && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-[var(--bg-surface)] w-full max-w-5xl rounded-xl shadow-2xl border border-[var(--border-default)] flex flex-col max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)] bg-[var(--bg-base)]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-lg">
                      <AlertTriangle className="text-rose-500" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">Incident Replay</h3>
                      <p className="text-xs text-[var(--text-secondary)]">Watch the AI bot trace execution and crash in Sandbox</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedReplay(null)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-lg transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-black relative p-0 min-h-[500px]">
                   <ReplayPlayer eventsUrl={selectedReplay} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
