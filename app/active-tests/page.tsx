"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Loader2, AlertTriangle, GitBranch } from "lucide-react";
import Sidebar from "../components/Sidebar";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
const WORKFLOWS_URL = BASE_API ? `${BASE_API}/brum-proxy/workflows` : undefined;

interface WorkflowSummary {
  name: string;
  status?: string;
  health?: string;
  drift_reason?: string;
  last_drift_detected?: string;
  step_count?: number;
  total_steps?: number;
  file_count?: number;
  github_repo?: string;
  test_tier?: string;
  seed_priority_score?: number;
  seed_centrality_score?: number;
  seed_record_count?: number;
  seed_git_churn?: number;
  seed_reason?: string;
  seed_context_window_days?: number;
}

interface Repository {
  id: number;
  full_name: string;
  brain_id: string;
}

const HEALTHY = ["healthy", "verified", "success", "ok"];
const ACTIVE = ["queued", "in_progress", "running", "pending", "draft"];

const TEST_TIER_LABELS: Record<string, string> = {
  backend_only: "Backend",
  ui_only: "UI",
  backend_then_ui: "Hybrid",
};

function formatCompactNumber(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export default function ActiveTestsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgName, setOrgName] = useState("Jataka");
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("ARCHITECT");
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [totalTests, setTotalTests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSignedIn || !WORKFLOWS_URL || !BASE_API) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      let fetchUrl = `${WORKFLOWS_URL}?branch=main&limit=200`;
      if (selectedRepo) {
        fetchUrl += `&github_repo=${encodeURIComponent(selectedRepo)}`;
      }

      const [syncRes, reposRes, wfRes] = await Promise.all([
        fetch(`${BASE_API}/auth/sync`, { headers }),
        fetch(`${BASE_API}/integrations/github/linked-repos`, { headers }),
        fetch(fetchUrl, { headers }),
      ]);

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        const orgData = syncData.org || syncData.organization || {};
        const rawRole = syncData.user?.role || syncData.orgRole || "";
        setOrgName(orgData.name || syncData.orgName || syncData.organizationName || "Jataka");
        if (rawRole === "senior" || rawRole === "org:admin" || rawRole === "admin" || rawRole === "teacher") {
          setUserRole("ARCHITECT");
        } else {
          setUserRole("DEVELOPER");
        }
      }

      if (reposRes.ok) {
        const reposData = await reposRes.json();
        setRepos(reposData.repositories || []);
      }

      if (!wfRes.ok) {
        throw new Error("Could not load workflow status list");
      }

      const wfJson = await wfRes.json();
      const parsedWorkflows = Array.isArray(wfJson?.workflows) ? wfJson.workflows : [];
      setWorkflows(parsedWorkflows);
      setTotalTests(Number(wfJson?.total_tests) || parsedWorkflows.length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load active tests");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, getToken, selectedRepo]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      load();
    }
  }, [isLoaded, isSignedIn, load]);

  const healthyTests = useMemo(
    () => workflows.filter((wf) => HEALTHY.includes(String(wf.health || wf.status || "").toLowerCase())),
    [workflows],
  );

  const activeTests = useMemo(
    () => workflows.filter((wf) => ACTIVE.includes(String(wf.health || wf.status || "").toLowerCase())),
    [workflows],
  );

  const needsAttention = useMemo(
    () => workflows.filter((wf) => {
      const status = String(wf.health || wf.status || "").toLowerCase();
      return !HEALTHY.includes(status) && !ACTIVE.includes(status);
    }),
    [workflows],
  );

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName={orgName} userRole={userRole} />
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Activity size={18} /> Active Tests
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Real-time seeded test visibility from workflow status.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="input select text-sm py-1.5 pl-8 pr-8 bg-[var(--bg-surface)] border-[var(--border-default)] rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  <option value="">All Repositories</option>
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.full_name}>
                      {repo.full_name}
                    </option>
                  ))}
                </select>
                <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
              </div>

              <button onClick={load} className="btn-secondary text-sm py-1.5" disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : "Refresh"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 border-l-4 border-emerald-500">
              <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Healthy</div>
              <div className="text-3xl font-bold mt-1">{healthyTests.length}</div>
            </div>
            <div className="card p-4 border-l-4 border-indigo-500">
              <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Active / Running</div>
              <div className="text-3xl font-bold mt-1">{activeTests.length}</div>
            </div>
            <div className="card p-4 border-l-4 border-amber-500">
              <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Needs Attention</div>
              <div className="text-3xl font-bold mt-1">{needsAttention.length}</div>
            </div>
            <div className="card p-4 border-l-4 border-cyan-500">
              <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Tests in Brain</div>
              <div className="text-3xl font-bold mt-1">{totalTests}</div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
              <h2 className="text-sm font-semibold">
                {selectedRepo ? `Tests for ${selectedRepo}` : "All Seeded Tests Status"}
              </h2>
            </div>

            {loading ? (
              <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : error ? (
              <div className="p-6 text-sm text-rose-500">{error}</div>
            ) : workflows.length === 0 ? (
              <div className="p-6 text-sm text-[var(--text-muted)]">
                {selectedRepo
                  ? `No tests found for repository: ${selectedRepo}.`
                  : "No test workflows found yet. Seed from Integrations → Salesforce Impact Graph sync."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[var(--bg-base)] text-[var(--text-secondary)] uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3 font-medium">Workflow</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Seed Signals</th>
                      <th className="px-5 py-3 font-medium">Steps</th>
                      <th className="px-5 py-3 font-medium">Files</th>
                      <th className="px-5 py-3 font-medium">Drift Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {workflows.map((wf) => {
                      const status = String(wf.health || wf.status || "draft").toLowerCase();
                      const isHealthy = HEALTHY.includes(status);
                      const isActive = ACTIVE.includes(status);
                      const tier = String(wf.test_tier || "ui_only");
                      const typeLabel = TEST_TIER_LABELS[tier] || tier;
                      return (
                        <tr key={wf.name} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                          <td className="px-5 py-4 font-medium flex flex-col">
                            {wf.name}
                            {!selectedRepo && wf.github_repo && (
                              <span className="text-[10px] text-[var(--text-muted)] flex items-center mt-1">
                                <GitBranch size={10} className="mr-1" /> {wf.github_repo}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="badge badge-indigo">{typeLabel}</span>
                          </td>
                          <td className="px-5 py-4">
                            {isHealthy ? (
                              <span className="badge badge-emerald"><CheckCircle2 size={12} /> {status}</span>
                            ) : isActive ? (
                              <span className="badge badge-indigo"><Clock3 size={12} /> {status}</span>
                            ) : (
                              <span className="badge badge-rose"><AlertTriangle size={12} /> {status}</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {typeof wf.seed_priority_score === "number" ? (
                              <div className="flex flex-col gap-1 text-xs">
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="badge badge-amber">P {wf.seed_priority_score.toFixed(1)}</span>
                                  <span className="badge badge-indigo">{formatCompactNumber(wf.seed_record_count)} records</span>
                                  <span className="badge badge-indigo">{formatCompactNumber(wf.seed_git_churn)} churn</span>
                                </div>
                                <span className="max-w-[260px] truncate text-[var(--text-muted)]" title={wf.seed_reason || ""}>
                                  {wf.seed_reason || `Last ${wf.seed_context_window_days || 15} days`}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-[var(--text-secondary)]">{wf.step_count ?? wf.total_steps ?? "—"}</td>
                          <td className="px-5 py-4 text-[var(--text-secondary)]">{wf.file_count ?? "—"}</td>
                          <td className="px-5 py-4 text-xs text-[var(--text-muted)] max-w-[360px] truncate">
                            {wf.drift_reason || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
