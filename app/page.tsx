"use client";

import { useAuth, useUser, SignInButton, SignOutButton } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  Terminal,
  Shield,
  UserPlus,
  Activity,
  ShieldCheck,
  BookOpen,
  AlertTriangle,
  Clock,
  RefreshCcw,
  Send,
  ChevronDown,
  Play,
  Maximize2,
  Minimize2,
} from "lucide-react";
import GraphVisualizer from "./components/GraphVisualizer";

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

export default function Home() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
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
  const [copiedSlackCommand, setCopiedSlackCommand] = useState(false);
  const [previousMetrics, setPreviousMetrics] = useState<Metrics | null>(null);
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);

  // Fetch the token when the user signs in
  useEffect(() => {
    async function fetchToken() {
      if (isSignedIn) {
        setLoading(true);
        try {
          // Get the raw JWT to send to One-Backend / VS Code
          const jwt = await getToken();
          setToken(jwt || null);
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
  }, [isSignedIn, getToken]);

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
      if (isSignedIn && token && viewState === 'dashboard') {
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
            const days = timePeriod === "7 days" ? 7 : timePeriod === "30 days" ? 30 : 90;
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
  }, [isSignedIn, token, viewState, timePeriod]);

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
    if (!isSignedIn || !token || viewState !== 'dashboard') return;

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
  }, [isSignedIn, token, viewState]);

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
      '7 days': 'last week',
      '30 days': 'last month',
      '90 days': 'last quarter',
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
        body: JSON.stringify({ email: inviteEmail }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse errors; fall back to generic messages
      }

      if (res.ok) {
        const msg = data.message || `Invited ${inviteEmail} successfully.`;
        setInviteStatus(`✅ ${msg}`);
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

      if (res.ok) {
        setViewState('dashboard');
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
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (viewState === 'onboarding' && isSignedIn) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-8 rounded-2xl bg-slate-900 p-8 shadow-2xl border border-blue-500/30">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Setup Workspace</h2>
            <p className="text-white text-lg pt-2.5 font-bold">Create a new organization to start.</p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full mt-1 p-3 rounded bg-slate-950 text-white border border-slate-700 focus:border-white-500 outline-none"
                placeholder="Acme Corp"
              />
            </div>
            <button
              onClick={handleOnboarding}
              disabled={loading}
              className="items-center gradient-border-button w-full rounded-md px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 relative overflow-hidden">
      {/* Background Spheres */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Sphere 1 - Top Right */}
        <div className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-blue-200/80 via-blue-500/40 to-blue-900/30 blur-[100px]"></div>
        {/* Sphere 2 - Bottom Left */}
        <div className="absolute -bottom-32 -left-32 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-blue-200/80 via-blue-500/40 to-blue-900/30 blur-[100px]"></div>
      </div>
      
      {/* Blurred Rectangle Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[400px] pointer-events-none"></div>
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header Section */}
        <div className="mx-auto max-w-[1400px] xl:max-w-[1400px] 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-12 xl:px-16 pt-6 sm:pt-8 pb-2 2xl:pt-10">
          {isSignedIn && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
            <div className="flex flex-col">
              {/* Dashboard label */}
              <h1 className="text-base font-medium text-blue-500">
                {orgName || 'Dashboard'}
              </h1>
              {/* User name */}
              {isSignedIn && user && (
                <span className="text-2xl sm:text-3xl font-semibold text-white leading-tight">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
              <div className="flex flex-col gap-2 ml-auto sm:ml-0">
                {/* JATAKA */}
                <div className="flex items-center justify-end gap-2 text-right w-full">
                  <img src="/WhiteLOGO.svg" alt="up" className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-xl sm:text-2xl font-bold text-white">JATAKA</span>
                </div>

                {/* Integrations */}
                  <div className="flex flex-col gap-2 text-sm text-slate-400 mt-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-2 sm:gap-3 w-full">
                      <span className="font-medium text-sm sm:text-base text-white">Integrations</span>
                      {/* GitHub */}
                      <div className="flex items-center divide-x divide-white/20 flex-wrap">
                      <div className="flex items-center gap-1.5 px-2 sm:px-3">
                        <img src="/github.png" alt="up" className="w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="text-xs sm:text-sm text-white">GitHub</span>
                      </div>

                      {/* Slack */}
                      <div className="flex items-center gap-1.5 px-2 sm:px-3">
                        <img src="/slack-new.png" alt="up" className="w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="text-xs sm:text-sm text-white">Slack</span>
                      </div>

                      {/* Jira */}
                      <div
                        className="flex items-center gap-1.5 px-2 sm:px-3 cursor-pointer hover:bg-white/10 rounded transition"
                        onClick={() => window.location.href = '/settings/integrations'}
                        title="Configure Jira Integration"
                      >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.757a1 1 0 0 0-1-1zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1a1 1 0 0 0-0.987-1z" fill="#2684FF"/>
                        </svg>
                        <span className="text-xs sm:text-sm text-white">Jira</span>
                      </div>

                      {/* VS Code */}
                      <div className="flex items-center gap-1.5 pl-2 sm:pl-3">
                        <img src="/code-stable-white.png" alt="up" className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="xs:hidden text-xs sm:text-sm text-white">Visual Studio Code</span>
                      </div>
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          </div>
          )}
        </div>

      <div className="mx-auto max-w-[1400px] xl:max-w-[1400px] 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-12 xl:px-16 py-6 sm:py-8 2xl-pt-10">
        {!isSignedIn ? (
          <div className="flex min-h-[80vh] items-center justify-center">
            <div className="w-full max-w-md space-y-6 rounded-xl bg-slate-900 p-8 shadow-2xl ring-1 ring-white">
              <div className="text-center">
              <div className="mx-auto mb-4 flex items-center justify-center gap-3">
                  <img src="/WhiteLOGO.svg" alt="up" className="h-7 w-7" />
                <h2 className="text-4xl font-bold tracking-tight text-white">
                  JATAKA
                </h2>
              </div>

              <p className="mt-2 text-white text-xl pt-2.5 font-bold">
                Developer Context & Guardrails
              </p>
            </div>
              <div className="ml-10 text-sm pt-2.5">
                <p className="flex items-center gap-2 text-white">
                  <Shield size={16} className="text-white" />
                  Sign in to verify your organization access.
                </p>
              </div>
              <SignInButton mode="modal">
                <button className="items-center gradient-border-button w-full rounded-md px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20">
                  Sign in with Google / GitHub
                </button>
              </SignInButton>
            </div>
          </div>
        ) : (
          <>
            {/* Team Brain Health Section */}
            <div className="mb-5 rounded-xl bg-slate-900 p-4 sm:p-6 border border-white/10 hover:border-white transition-colors">
              <div className="mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <h2 className="ml-0 sm:ml-4 text-lg font-bold text-white">Team Brain Health</h2>
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => setOpen(!open)}
                    className=" flex w-full items-center justify-between rounded-lg bg-slate-800 px-4 py-2 text-sm text-white border border-white/10 hover:border-white transition"
                  >
                    {timePeriod}
                    <ChevronDown
                      size={16}
                      className={`ml-2 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  {open && (
                    <div className=" absolute z-50 mt-2 w-full min-w-[120px] rounded-xl bg-slate-900 border border-white/10 shadow-xl overflow-hidden
                    ">
                      {["Last 15 days", "Last Month", "Last Year"].map((item) => (
                        <button
                          key={item}
                          onClick={() => {
                            setTimePeriod(item);
                            setOpen(false);
                          }}
                          className=" block w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition
                          "
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {metricsLoading && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  {[1, 2, 3, 4, 5].map((key) => (
                    <div
                      key={key}
                      className="h-32 rounded-xl bg-slate-800/60 ring-1 ring-white/5 animate-pulse"
                    ></div>
                  ))}
                </div>
              )}

              {/* {!metricsLoading && metricsError && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <div className="mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-amber-300" />
                  </div>
                  <div>
                    <p className="font-medium">Live metrics are temporarily unavailable</p>
                    <p className="mt-1 text-xs text-amber-200/80">{metricsError}</p>
                  </div>
                </div>
              )} */}

              {!metricsLoading && metrics && (() => {
                // MetricCard configuration - same logic as before but structured
                const metricCards = [
                  {
                    title: "Senior Deflection Rate",
                    value: `${metrics.senior_deflection_rate.toFixed(1)}%`,
                    metricKey: 'senior_deflection_rate' as keyof Metrics,
                    currentValue: metrics.senior_deflection_rate,
                    icon: ShieldCheck,
                    color: "bg-green-500",
                    arrowIcon: "/arrow_circle_up.svg",
                    trendText: (trend: TrendData) => `+ ${trend.change}% improved as of ${trend.period}`
                  },
                  {
                    title: "Files Documented",
                    value: metrics.knowledge_coverage_files.toString(),
                    metricKey: 'knowledge_coverage_files' as keyof Metrics,
                    currentValue: metrics.knowledge_coverage_files,
                    icon: BookOpen,
                    color: "bg-blue-500",
                    arrowIcon: "/arrow_circle_up.svg",
                    trendText: (trend: TrendData) => `+ ${trend.change}% higher than ${trend.period}`
                  },
                  {
                    title: "Knowledge Drift",
                    value: `${metrics.drift_score.toFixed(1)}%`,
                    metricKey: 'drift_score' as keyof Metrics,
                    currentValue: metrics.drift_score,
                    icon: AlertTriangle,
                    color: "bg-orange-500",
                    arrowIcon: "/arrow_circle_down.svg",
                    trendText: (trend: TrendData) => `- ${trend.change}% decreased as of ${trend.period}`
                  },
                  {
                    title: "Avg Mastery Time",
                    value: `${metrics.avg_hours_to_mastery.toFixed(1)}h`,
                    metricKey: 'avg_hours_to_mastery' as keyof Metrics,
                    currentValue: metrics.avg_hours_to_mastery,
                    icon: Clock,
                    color: "bg-purple-500",
                    arrowIcon: "/arrow_circle_up.svg",
                    trendText: (trend: TrendData) => `+ ${trend.change}% from ${trend.period}`
                  },
                  {
                    title: "Context Success",
                    value: `${metrics.context_injection_rate.toFixed(1)}%`,
                    metricKey: 'context_injection_rate' as keyof Metrics,
                    currentValue: metrics.context_injection_rate,
                    icon: Activity,
                    color: "bg-teal-500",
                    arrowIcon: "/arrow_circle_up.svg",
                    trendText: (trend: TrendData) => `+ ${trend.change}% higher than ${trend.period}`
                  }
                ];

                // Build array with cards and dividers for proper grid layout
                const gridItems: Array<{ type: 'card' | 'divider'; card?: typeof metricCards[0]; index?: number }> = [];
                metricCards.forEach((card, index) => {
                  if (index > 0) {
                    gridItems.push({ type: 'divider' });
                  }
                  gridItems.push({ type: 'card', card, index });
                });

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] gap-4 sm:gap-6 lg:gap-0">
                    {gridItems.map((item, idx) => {
                      if (item.type === 'divider') {
                        return (
                          <div key={`divider-${idx}`} className="hidden lg:flex items-center justify-center">
                            <span className="h-20 w-px bg-white/10" />
                          </div>
                        );
                      }

                      const card = item.card!;
                      const trend = getTrend(card.metricKey, card.currentValue);
                      const displayValue = card.metricKey === 'avg_hours_to_mastery' 
                        ? `${Math.round(card.currentValue)} hrs`
                        : card.metricKey === 'knowledge_coverage_files'
                        ? card.currentValue.toString()
                        : card.value;

                      return (
                        <div key={card.metricKey} className={`p-3 sm:p-4 h-full flex flex-col ${item.index! > 0 ? 'lg:ml-9' : ''}`}>
                          <p className="text-xs sm:text-sm font-medium text-slate-400">
                            {card.title}
                          </p>

                          <div className="mt-2 flex items-center gap-2">
                            <p className="text-2xl sm:text-3xl font-bold text-white">
                              {displayValue}
                            </p>
                            <img src={card.arrowIcon} alt={trend.direction} className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                          </div>

                          <p className="mt-2 text-xs text-white break-words">
                            {card.trendText(trend)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Cards Row 1 */}
            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Combined: Active Brain Context + Create New Brain */}
              <div className="rounded-lg bg-slate-900 p-4 sm:p-6 ring-1 ring-white/10 md:col-span-2 border border-white/10 hover:border-white transition-colors">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6">
                  {/* Active Brain Context Section */}
                  <div>
                    <h3 className="ml-0 md:ml-1 mb-4 text-base sm:text-lg font-semibold text-white">Active Brain Context</h3>
                    <div className="relative mb-4">
                    <select
                      className="w-full appearance-none rounded-lg bg-slate-950 px-3 py-3 pr-10 text-sm text-white ring-1 ring-white/10 focus:white-500"
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
                    <Play
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-white/80 fill-white"
                    />
                      </div>
                    <button
                      onClick={handleConnectVsCode}
                      className="gradient-border-button w-full rounded-md px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                    >
                      Connect VS Code to Brain
                    </button>
                  </div>

                  {/* Vertical Divider */}
                  <div className="hidden md:flex items-stretch">
                    <span className="w-px bg-white/10"></span>
                  </div>
                  {/* Horizontal Divider for mobile */}
                  <div className="md:hidden w-full h-px bg-white/10"></div>

                  {/* Create New Brain Section */}
                  <div>
                    <h3 className="mb-4 text-base sm:text-lg font-semibold text-white">Create New Brain</h3>
                    <input
                      type="text"
                      className="mb-4 w-full rounded-md bg-slate-950 px-3 py-3 text-sm text-white placeholder-slate-500 ring-1 ring-white/10 focus:white-500"
                      placeholder="e.g. Mobile App for Bank of New York V2"
                      value={newBrainName}
                      onChange={(e) => setNewBrainName(e.target.value)}
                    />
                    <button
                      onClick={handleCreateBrain}
                      className="gradient-border-button w-full rounded-md px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>

              {/* Connect Your Workspace */}
              <div className="rounded-lg bg-slate-900 p-4 sm:p-6 ring-1 ring-white/10 border border-white/10 hover:border-white transition-colors ">
                <h3 className="mb-4 text-base sm:text-lg font-semibold text-white">Connect Your Workspace</h3>
                <div className="space-y-3">
                  <button
                      onClick={handleSlackInstall}
                      className="gradient-border-button w-full rounded-md px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                    >
                      Add to Slack
                    </button>
                  <button
                    onClick={handleGithubInstall}
                    className="gradient-border-button w-full rounded-md px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    Connect GitHub Repository
                  </button>
                </div>
              </div>
            </div>

            {/* Dependency Explorer / Graph Visualizer */}
            <div
                className={`${
                  isGraphFullScreen
                    ? "fixed inset-0 z-[100] bg-slate-950 flex flex-col"
                    : "relative mb-8"
                } transition-all duration-300 ease-in-out`}
              >
                {/* Graph Component Wrapper */}
                <div className={`w-full ${isGraphFullScreen ? "flex-1 h-full [&>div]:h-full" : ""}`}>
                  <GraphVisualizer baseUrl={BASE_API} />
                </div>

                {/* Toggle Button */}
                <div
                  className={`absolute z-[110] flex gap-2 transition-all duration-500 ${
                    isGraphFullScreen ? "bottom-1 right-4" : "bottom-1 right-4"
                  }`}
                >
                  <button
                    onClick={() => setIsGraphFullScreen(!isGraphFullScreen)}
                    // Updated classes: Reduced padding (px-2.5 py-1) and text size (text-xs)
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition-colors shadow-lg
                      ${isGraphFullScreen 
                        ? "bg-blue-600 hover:bg-blue-500 ring-0 rounded-full" 
                        : "bg-slate-800 hover:bg-slate-700 ring-1 ring-white/20"
                      }
                    `}
                    title={isGraphFullScreen ? "Minimize" : "Full Screen"}
                  >
                    {isGraphFullScreen ? (
                      <>
                        <Minimize2 size={14} />
                        <span className="hidden sm:inline">Minimize</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 size={14} />
                        <span className="hidden sm:inline">Full Screen</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            {/* Cards Row 2 */}
            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Invite Team */}
              <div className="rounded-lg bg-slate-900 p-4 sm:p-6 ring-1 ring-white/10 border border-white/10 hover:border-white transition-colors">
                <h3 className="mb-4 text-base sm:text-lg font-semibold text-white">Invite Team</h3>

                <div className="relative">
                  <input type="email" className=" w-full rounded-md bg-slate-950 px-3 py-3 pr-10 text-sm text-white placeholder-slate-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white/20" placeholder="sachin@shodh.ai" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  {/* Send icon inside input */}
                  <button
                    onClick={handleInvite}
                    className=" absolute mr-2 right-2 top-1/2 -translate-y-1/2 text-white-400 hover:text-white transition-colors"
                    title="Send invite"
                  >
                    <Send size={16} />
                  </button>
                </div>

                {inviteStatus && (
                  <p className="mt-2 text-xs text-slate-400">{inviteStatus}</p>
                )}
              </div>
              {/* To connect Slack, run: */}
              <div className="rounded-lg bg-slate-900 p-4 sm:p-6 ring-1 ring-white/10 border border-white/10 hover:border-white transition-colors">
                <h3 className="mb-4 text-base sm:text-lg font-semibold text-white">To connect Slack, run:</h3>
                <div className="flex items-center gap-2 rounded-md bg-slate-950 px-3 py-3 ring-1 ring-white/10">
                  <code className="flex-1 text-sm text-slate-400">
                    /connect {user?.primaryEmailAddress?.emailAddress || 'teacher@example.com'}
                  </code>
                  <button
                    onClick={handleCopySlackCommand}
                    className="text-white-400 transition-colors hover:text-white"
                    title="Copy command"
                  >
                    {copiedSlackCommand ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* Access Token for VS Code */}
              <div className="rounded-lg bg-slate-900 p-4 sm:p-6 ring-1 ring-white/10 border border-white/10 hover:border-white transition-colors">
                <h3 className="mb-4 text-base sm:text-lg font-semibold text-white">Access Token for VS Code</h3>
                <div className="flex items-center gap-2 rounded-md bg-slate-950 px-3 py-3 ring-1 ring-white/10">
                  <code className="flex-1 truncate text-sm text-slate-400">
                    {loading ? 'Loading...' : token ? `${token.substring(0, 20)}......` : 'No token available'}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="text-white-400 transition-colors hover:text-white"
                    title="Copy token"
                  >
                    {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>


            {/* QA Command Center Section */}
            {/* <div className="mb-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">QA Command Center</h2>
                  <p className="mt-1 text-sm text-slate-400">Workflow drift, healing activity, and coverage risk</p>
                </div>
                <button
                  onClick={refreshQaData}
                  disabled={qaLoading}
                  className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 ring-1 ring-white/10"
                >
                  <RefreshCcw size={16} className={qaLoading ? "animate-spin" : ""} />
                  {qaLoading ? "Refreshing..." : "Refresh Data"}
                </button>
              </div>

            {qaLoading && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((key) => (
                  <div
                    key={key}
                    className="h-28 rounded-xl bg-slate-900/60 ring-1 ring-white/5 animate-pulse"
                  ></div>
                ))}
              </div>
            )}

            {!qaLoading && qaError && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                </div>
                <div>
                  <p className="font-medium">QA telemetry is temporarily unavailable</p>
                  <p className="mt-1 text-xs text-amber-200/80">{qaError}</p>
                </div>
              </div>
            )}

            {!qaLoading && !qaError && (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-xl bg-slate-900 p-6 ring-1 ring-white/10">
                  <p className="text-sm font-medium text-slate-400">Coverage Risk</p>
                  <p className="mt-2 text-xs text-slate-500">Workflows with low documentation density</p>
                  <div className="mt-4 space-y-3">
                    {busFactor.slice(0, 5).map((wf) => (
                      <div key={wf.workflow} className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-200">{wf.workflow}</p>
                          <p className="text-xs text-slate-500">
                            {wf.file_count || 0} files · {wf.step_count || 0} steps · {wf.capture_count || 0} captures
                          </p>
                        </div>
                        <span
                          className={
                            "ml-3 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 " +
                            (wf.risk_level === 'critical'
                              ? 'bg-red-500/10 text-red-200 ring-red-400/30'
                              : wf.risk_level === 'warning'
                              ? 'bg-amber-500/10 text-amber-200 ring-amber-400/30'
                              : 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/30')
                          }
                        >
                          {wf.risk_level}
                        </span>
                      </div>
                    ))}
                    {busFactor.length === 0 && (
                      <p className="text-sm text-slate-500">No workflows found yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 p-6 ring-1 ring-white/10">
                  <p className="text-sm font-medium text-slate-400">Drift Watchlist</p>
                  <p className="mt-2 text-xs text-slate-500">Workflows marked as needs_review</p>
                  <div className="mt-4 space-y-3">
                    {workflows
                      .filter((w) => (w.status || '').toLowerCase() === 'needs_review')
                      .slice(0, 6)
                      .map((w) => (
                        <div key={w.name} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-slate-200">{w.name}</p>
                            <p className="text-xs text-slate-500 truncate">{w.drift_reason || 'No drift reason recorded'}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-200 ring-1 ring-orange-400/30">
                            needs_review
                          </span>
                        </div>
                      ))}
                    {workflows.filter((w) => (w.status || '').toLowerCase() === 'needs_review').length === 0 && (
                      <p className="text-sm text-slate-500">No drifted workflows detected.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 p-6 ring-1 ring-white/10">
                  <p className="text-sm font-medium text-slate-400">Healer Log</p>
                  <p className="mt-2 text-xs text-slate-500">Recent workflow step updates</p>
                  <div className="mt-4 space-y-3">
                    {healerLog.slice(0, 6).map((h) => (
                      <div key={h.new_step} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-200">
                            {(h.workflow_name || 'Workflow') + ' · Step ' + (h.step_order ?? '?')}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {(h.expert_intent || '').toString() || 'Updated step'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-200 ring-1 ring-blue-400/30">
                          {h.action_count || 0} actions
                        </span>
                      </div>
                    ))}
                    {healerLog.length === 0 && (
                      <p className="text-sm text-slate-500">No healer updates recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            </div> */}

            {/* Sign Out */}
            <div className="mt-6 sm:mt-8 flex justify-end border-t border-white/10 pt-4 sm:pt-6">
              <SignOutButton>
                <button className="text-md font-bold text-red-400 transition-colors hover:text-red-300">
                  Sign out
                </button>
              </SignOutButton>
            </div>
          </>
        )}
      </div>
      </div>
    </main>
  );
}
