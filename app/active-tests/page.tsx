"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Loader2, AlertTriangle } from "lucide-react";
import Sidebar from "../components/Sidebar";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
const WORKFLOWS_URL = BASE_API ? `${BASE_API}/brum-proxy/workflows` : undefined;

interface WorkflowSummary {
  name: string;
  status?: string;
  drift_reason?: string;
  last_drift_detected?: string;
  step_count?: number;
  file_count?: number;
}

const HEALTHY = ["healthy", "verified", "success", "ok"];
const ACTIVE = ["queued", "in_progress", "running", "pending", "draft"];

export default function ActiveTestsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgName, setOrgName] = useState("Jataka");
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("ARCHITECT");
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
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

      const [syncRes, wfRes] = await Promise.all([
        fetch(`${BASE_API}/auth/sync`, { headers }),
        fetch(`${WORKFLOWS_URL}?branch=main&limit=200`, { headers }),
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

      if (!wfRes.ok) {
        throw new Error("Could not load workflow status list");
      }

      const wfJson = await wfRes.json();
      setWorkflows(Array.isArray(wfJson?.workflows) ? wfJson.workflows : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load active tests");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      load();
    }
  }, [isLoaded, isSignedIn, load]);

  const healthyTests = useMemo(
    () => workflows.filter((wf) => HEALTHY.includes(String(wf.status || "").toLowerCase())),
    [workflows],
  );

  const activeTests = useMemo(
    () => workflows.filter((wf) => ACTIVE.includes(String(wf.status || "").toLowerCase())),
    [workflows],
  );

  const needsAttention = useMemo(
    () => workflows.filter((wf) => !HEALTHY.includes(String(wf.status || "").toLowerCase()) && !ACTIVE.includes(String(wf.status || "").toLowerCase())),
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Activity size={18} /> Active Tests
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Real-time seeded test visibility from workflow status.
              </p>
            </div>
            <button onClick={load} className="btn-secondary text-xs" disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
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
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
              <h2 className="text-sm font-semibold">Seeded Tests Status</h2>
            </div>

            {loading ? (
              <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : error ? (
              <div className="p-6 text-sm text-rose-500">{error}</div>
            ) : workflows.length === 0 ? (
              <div className="p-6 text-sm text-[var(--text-muted)]">No test workflows found yet. Seed from Integrations → Salesforce Impact Graph sync.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[var(--bg-base)] text-[var(--text-secondary)] uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3 font-medium">Workflow</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Steps</th>
                      <th className="px-5 py-3 font-medium">Files</th>
                      <th className="px-5 py-3 font-medium">Drift Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {workflows.map((wf) => {
                      const status = String(wf.status || "unknown").toLowerCase();
                      const isHealthy = HEALTHY.includes(status);
                      const isActive = ACTIVE.includes(status);
                      return (
                        <tr key={wf.name} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                          <td className="px-5 py-4 font-medium">{wf.name}</td>
                          <td className="px-5 py-4">
                            {isHealthy ? (
                              <span className="badge badge-emerald"><CheckCircle2 size={12} /> {wf.status || "healthy"}</span>
                            ) : isActive ? (
                              <span className="badge badge-indigo"><Clock3 size={12} /> {wf.status || "running"}</span>
                            ) : (
                              <span className="badge badge-rose"><AlertTriangle size={12} /> {wf.status || "unknown"}</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-[var(--text-secondary)]">{wf.step_count ?? "—"}</td>
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
