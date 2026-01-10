"use client";

import { useAuth, useUser, SignInButton, SignOutButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";
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
} from "lucide-react";

interface Metrics {
  senior_deflection_rate: number;
  drift_score: number;
  avg_hours_to_mastery: number;
  knowledge_coverage_files: number;
  context_injection_rate: number;
}

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
  const [viewState, setViewState] = useState<'loading' | 'dashboard' | 'onboarding'>('loading');
  const [companyName, setCompanyName] = useState("");

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
          const res = await fetch('http://localhost:3001/api/auth/sync', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();

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
          const res = await fetch(
            "http://localhost:3001/api/proxy/brum/dashboard-metrics",
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (res.ok) {
            setMetrics(await res.json());
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
      }
    }
    fetchMetrics();
  }, [isSignedIn, token, viewState]);

  const MetricCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="rounded-xl bg-slate-900 p-6 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${color} bg-opacity-10`}>
          <Icon size={24} className={color.replace("bg-", "text-")} />
        </div>
      </div>
    </div>
  );

  const handleCopy = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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

      const res = await fetch("http://localhost:3001/api/team/invite", {
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
      const res = await fetch('http://localhost:3001/api/auth/onboard', {
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
            <p className="text-slate-400 mt-2">Create a new organization to start.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300">Company Name</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full mt-1 p-3 rounded bg-slate-950 text-white border border-slate-700 focus:border-blue-500 outline-none"
                placeholder="Acme Corp"
              />
            </div>
            <button
              onClick={handleOnboarding}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-all"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-200 flex flex-col items-center">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-slate-900 p-8 shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <Terminal size={24} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Kamikaze</h2>
          <p className="mt-2 text-slate-400">Developer Context & Guardrails</p>
        </div>

        {!isSignedIn ? (
          // State: Logged Out
          <div className="mt-8 space-y-6">
            <div className="rounded-lg bg-slate-800/50 p-4 text-sm text-slate-300">
              <p className="flex items-center gap-2">
                <Shield size={16} className="text-green-400" />
                Sign in to verify your organization access.
              </p>
            </div>
            <SignInButton mode="modal">
              <button className="flex w-full items-center justify-center rounded-lg bg-white px-8 py-3 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-200">
                Sign in with Google / GitHub
              </button>
            </SignInButton>
          </div>
        ) : (
          // State: Logged In
          <div className="mt-8 space-y-6">
            <div className="text-center">
              <p className="text-sm text-slate-400">Welcome back,</p>
              <p className="font-medium text-white">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-slate-950 p-4 ring-1 ring-white/10">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Access Token for VS Code
                </label>

                {loading ? (
                  <div className="h-10 animate-pulse rounded bg-slate-800"></div>
                ) : (
                  <div className="group relative flex items-center justify-between rounded bg-slate-900 px-3 py-2 font-mono text-sm text-slate-300">
                    <span className="truncate pr-8 opacity-60">
                      {token ? `${token.substring(0, 20)}...` : "Error generating token"}
                    </span>

                    <button
                      onClick={handleCopy}
                      className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                      title="Copy to Clipboard"
                    >
                      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-500">
                  Paste this token into the input box in VS Code.
                </p>
              </div>
            </div>

            {/* NEW: Invite Section */}
            <div className="mt-4 w-full rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-white/10">
              <div className="mb-4 flex items-center gap-3">
                <UserPlus className="text-blue-400" />
                <h3 className="text-xl font-bold text-white">Invite Team</h3>
              </div>

              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="junior@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded bg-slate-950 px-4 py-2 text-white ring-1 ring-slate-700 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={handleInvite}
                  className="w-full rounded bg-blue-600 py-2 font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  Send Invite
                </button>
                {inviteStatus && (
                  <p className="text-center text-sm text-slate-400">{inviteStatus}</p>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <SignOutButton>
                <button className="w-full text-sm font-medium text-red-400 transition-colors hover:text-red-300">
                  Sign out
                </button>
              </SignOutButton>
            </div>
          </div>
        )}
      </div>

      {isSignedIn && (
        <div className="mx-auto max-w-5xl mt-10 w-full space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Team Brain Health</h3>
            <p className="text-xs text-slate-500">Live view of how your team brain is performing</p>
          </div>

          {metricsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((key) => (
                <div
                  key={key}
                  className="h-28 rounded-xl bg-slate-900/60 ring-1 ring-white/5 animate-pulse"
                ></div>
              ))}
            </div>
          )}

          {!metricsLoading && metricsError && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="mt-0.5">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              </div>
              <div>
                <p className="font-medium">Live metrics are temporarily unavailable</p>
                <p className="mt-1 text-xs text-amber-200/80">{metricsError}</p>
              </div>
            </div>
          )}

          {!metricsLoading && metrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                title="Senior Deflection Rate"
                value={`${metrics.senior_deflection_rate.toFixed(1)}%`}
                icon={ShieldCheck}
                color="bg-green-500"
              />

              <MetricCard
                title="Files Documented"
                value={metrics.knowledge_coverage_files}
                icon={BookOpen}
                color="bg-blue-500"
              />

              <MetricCard
                title="Knowledge Drift"
                value={`${metrics.drift_score.toFixed(1)}%`}
                icon={AlertTriangle}
                color="bg-orange-500"
              />

              <MetricCard
                title="Avg Mastery Time"
                value={`${metrics.avg_hours_to_mastery.toFixed(1)}h`}
                icon={Clock}
                color="bg-purple-500"
              />

              <MetricCard
                title="Context Success"
                value={`${metrics.context_injection_rate.toFixed(1)}%`}
                icon={Activity}
                color="bg-teal-500"
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-8 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} Shodh AI. Secure Connection.
      </div>
    </main>
  );
}
