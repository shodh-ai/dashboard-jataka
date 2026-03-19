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
  Network,
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
import Link from "next/link";

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
    // } Empty commit 
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
              {/* ─── Real Snapshot ─── */}
              <section className="mb-8">
                <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">System Snapshot</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="card p-5 border-l-4 border-[var(--accent)]">
                    <div className="text-sm text-[var(--text-secondary)]">Total Workflows</div>
                    <div className="text-3xl font-bold text-[var(--text-primary)] mt-1">{workflows.length}</div>
                  </div>
                  <div className="card p-5 border-l-4 border-emerald-500">
                    <div className="text-sm text-[var(--text-secondary)]">Healthy Workflows</div>
                    <div className="text-3xl font-bold text-[var(--text-primary)] mt-1">
                      {
                        workflows.filter((wf) =>
                          ["healthy", "verified", "success", "ok"].includes(
                            String(wf.status || "").toLowerCase(),
                          ),
                        ).length
                      }
                    </div>
                  </div>
                  <div className="card p-5 border-l-4 border-amber-500">
                    <div className="text-sm text-[var(--text-secondary)]">Needs Attention</div>
                    <div className="text-3xl font-bold text-[var(--text-primary)] mt-1">
                      {
                        workflows.filter((wf) =>
                          ["drifted", "broken", "failed", "warning", "critical"].includes(
                            String(wf.status || "").toLowerCase(),
                          ),
                        ).length
                      }
                    </div>
                  </div>
                  <div className="card p-5 border-l-4 border-indigo-500">
                    <div className="text-sm text-[var(--text-secondary)]">Healer Patches</div>
                    <div className="text-3xl font-bold text-[var(--text-primary)] mt-1">{healerLog.length}</div>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <div className="card p-4 flex flex-wrap items-center gap-3">
                  <Link href="/dependency-graph" className="btn-secondary text-xs py-1.5">
                    <Network size={14} /> Dependency Graph
                  </Link>
                  <Link href="/integrations" className="btn-secondary text-xs py-1.5">
                    <Plug size={14} /> Integrations
                  </Link>
                  <Link href="/active-tests" className="btn-secondary text-xs py-1.5">
                    <Activity size={14} /> Active Tests
                  </Link>
                  <button
                    onClick={refreshQaData}
                    className="btn-secondary text-xs py-1.5"
                    disabled={qaLoading}
                  >
                    {qaLoading ? "Refreshing..." : "Refresh Live Data"}
                  </button>
                </div>
              </section>

              {/* ─── Live Workflows Table ─── */}
              <section className="mb-8">
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--border-default)] flex justify-between items-center bg-[var(--bg-surface)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[var(--accent)]" />
                      Workflow Health (Live)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-[var(--bg-base)] text-[var(--text-secondary)] uppercase text-[11px] tracking-wider">
                        <tr>
                          <th className="px-5 py-3 font-medium">Workflow</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">Steps</th>
                          <th className="px-5 py-3 font-medium">Files</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-default)]">
                        {workflows.slice(0, 10).map((wf) => {
                          const status = String(wf.status || "unknown").toLowerCase();
                          const good = ["healthy", "verified", "success", "ok"].includes(status);
                          return (
                            <tr key={wf.name} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                              <td className="px-5 py-4">
                                <div className="font-medium text-[var(--text-primary)]">{wf.name}</div>
                                {wf.drift_reason ? (
                                  <div className="text-xs text-[var(--text-muted)] mt-1 truncate max-w-[420px]">
                                    {wf.drift_reason}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-5 py-4">
                                {good ? (
                                  <span className="badge badge-emerald bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    <Check size={12} className="mr-1" /> {wf.status || "healthy"}
                                  </span>
                                ) : (
                                  <span className="badge badge-rose bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                    <AlertTriangle size={12} className="mr-1" /> {wf.status || "unknown"}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-[var(--text-secondary)]">{wf.step_count ?? "—"}</td>
                              <td className="px-5 py-4 text-[var(--text-secondary)]">{wf.file_count ?? "—"}</td>
                            </tr>
                          );
                        })}
                        {workflows.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-5 py-8 text-center text-[var(--text-muted)]">
                              {qaError || "No workflow data yet. Seed tests from Integrations to populate this."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* ─── Recent Healer Patches ─── */}
              <section className="mb-8">
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Recent Healer Activity</h3>
                  {healerLog.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">No self-healing updates recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {healerLog.slice(0, 5).map((entry, idx) => (
                        <div key={`${entry.workflow_name || "wf"}-${idx}`} className="rounded border border-[var(--border-default)] p-3">
                          <div className="text-sm font-medium text-[var(--text-primary)]">{entry.workflow_name || "Workflow"}</div>
                          <div className="text-xs text-[var(--text-secondary)] mt-1">{entry.new_step}</div>
                        </div>
                      ))}
                    </div>
                  )}
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
