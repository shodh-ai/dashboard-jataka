"use client";

import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  GitBranch,
  Loader2,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;

type DriftStatus =
  | "IN_SYNC"
  | "CONFIGURATION_DRIFT"
  | "ORPHANED_STATE"
  | "GITHUB_AHEAD";

type DriftAlert = {
  salesforceOrgId: string;
  componentType: string;
  componentName: string;
  status: DriftStatus;
  drifted: boolean;
  githubHash?: string;
  liveHash?: string;
  githubTransactionTime?: string;
  liveValidTime?: string;
  githubEventId?: string;
  liveEventId?: string;
};

type DriftResponse = {
  generatedAt: string;
  drifted: number;
  inSync: number;
  alerts: DriftAlert[];
};

export default function ConfigurationDriftPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [result, setResult] = useState<DriftResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!BASE_API) {
      setError("NEXT_PUBLIC_API_BASE_URL is not configured.");
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_API}/salesforce-temporal/drift-alerts`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || `Drift query failed (${response.status}).`);
      }
      setResult(body as DriftResponse);
      setError("");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Drift query failed.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void load();
    const interval = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(interval);
  }, [isLoaded, isSignedIn, load]);

  if (!isLoaded || !isSignedIn) {
    return <div className="min-h-screen bg-[var(--bg-base)]" />;
  }

  const alerts = result?.alerts || [];
  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName="Jataka" userRole="ARCHITECT" />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="relative overflow-hidden border-b border-slate-800 bg-[radial-gradient(circle_at_85%_10%,rgba(14,116,144,0.18),transparent_36%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(8,47,73,0.7))] px-6 py-9">
          <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                <GitBranch size={13} /> Bitemporal control plane
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Configuration Drift
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                GitHub transaction state compared with live Salesforce valid-time events. The
                console refreshes every 15 seconds.
              </p>
            </div>
            <button type="button" onClick={() => void load()} className="btn-secondary">
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} /> Refresh now
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl space-y-5 p-6">
          {error && (
            <div role="alert" className="flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              <AlertTriangle size={18} className="shrink-0" /> {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Active drift" value={result?.drifted} tone="danger" />
            <Metric label="Verified in sync" value={result?.inSync} tone="safe" />
            <Metric
              label="Last comparison"
              value={result?.generatedAt ? new Date(result.generatedAt).toLocaleTimeString() : undefined}
              tone="neutral"
            />
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/45">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Source comparison</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Live-only changes are orphaned state; hash mismatches are configuration drift.
                </p>
              </div>
              {result?.generatedAt && (
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock3 size={12} /> {new Date(result.generatedAt).toLocaleString()}
                </span>
              )}
            </div>

            {loading && !result ? (
              <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Comparing timelines...
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-14 text-center">
                <CheckCircle2 className="mx-auto text-emerald-400" size={34} />
                <p className="mt-3 text-sm font-medium text-emerald-100">No actionable drift</p>
                <p className="mt-1 text-xs text-slate-500">
                  GitHub and live Salesforce timelines have no unresolved differences.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {alerts.map((alert) => (
                  <DriftRow
                    key={`${alert.salesforceOrgId}:${alert.componentType}:${alert.componentName}`}
                    alert={alert}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string | number;
  tone: "danger" | "safe" | "neutral";
}) {
  const color =
    tone === "danger"
      ? "text-red-300 border-red-500/20"
      : tone === "safe"
        ? "text-emerald-300 border-emerald-500/20"
        : "text-cyan-200 border-cyan-500/20";
  return (
    <div className={`rounded-2xl border bg-slate-950/45 p-5 ${color}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value ?? "--"}</p>
    </div>
  );
}

function DriftRow({ alert }: { alert: DriftAlert }) {
  const isDrift = alert.status === "CONFIGURATION_DRIFT";
  const isOrphan = alert.status === "ORPHANED_STATE";
  return (
    <article className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <ShieldAlert size={16} className={alert.drifted ? "text-red-400" : "text-amber-400"} />
          <p className="font-mono text-sm font-medium text-slate-100">{alert.componentName}</p>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
            alert.drifted
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}>
            {alert.status.replaceAll("_", " ")}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {alert.componentType} · Org {alert.salesforceOrgId}
        </p>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          {isDrift
            ? "The live component hash differs from the latest merged GitHub version."
            : isOrphan
              ? "Salesforce changed without a matching GitHub transaction."
              : "GitHub contains a change that has not appeared in the live org timeline."}
        </p>
      </div>
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <TimelineCard
          label="GitHub transaction time"
          hash={alert.githubHash}
          timestamp={alert.githubTransactionTime}
        />
        <ArrowRight className="mx-auto rotate-90 text-slate-600 sm:rotate-0" size={17} />
        <TimelineCard label="Salesforce valid time" hash={alert.liveHash} timestamp={alert.liveValidTime} />
      </div>
    </article>
  );
}

function TimelineCard({ label, hash, timestamp }: { label: string; hash?: string; timestamp?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 truncate font-mono text-xs text-slate-300" title={hash}>
        {hash || "No matching event"}
      </p>
      <p className="mt-1 text-[11px] text-slate-600">
        {timestamp ? new Date(timestamp).toLocaleString() : "Not observed"}
      </p>
    </div>
  );
}
