"use client";

import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RefreshCcw,
  TicketCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  normalizeDashboardRole,
  type DashboardRole,
} from "../lib/dashboard-role";
import {
  formatMttr,
  normalizeRoiAnalytics,
  ROI_ANALYTICS_ENDPOINT,
  type RoiAnalytics,
} from "./contracts";

const BASE_API =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;

interface AuthSyncPayload {
  org?: { name?: unknown };
  organization?: { name?: unknown };
  orgName?: unknown;
  organizationName?: unknown;
  orgRole?: unknown;
  user?: { role?: unknown };
}

type IdentityStatus = "loading" | "ready" | "error";

function organizationName(payload: AuthSyncPayload): string {
  const candidates = [
    payload.org?.name,
    payload.organization?.name,
    payload.orgName,
    payload.organizationName,
  ];
  const match = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );
  return match?.trim() || "Workspace";
}

const metricCards = [
  {
    key: "tickets" as const,
    label: "Total Tickets Deflected",
    detail: "Requests resolved without manual support handling",
    icon: TicketCheck,
    accent: "text-cyan-300",
    glow: "from-cyan-400/15",
  },
  {
    key: "mttr" as const,
    label: "Average Time to Resolve (MTTR)",
    detail: "Mean elapsed time from ticket creation to resolution",
    icon: Clock3,
    accent: "text-amber-300",
    glow: "from-amber-400/15",
  },
  {
    key: "accuracy" as const,
    label: "First-Pass Accuracy",
    detail: "Resolutions validated successfully on the first attempt",
    icon: CheckCircle2,
    accent: "text-emerald-300",
    glow: "from-emerald-400/15",
  },
];

function metricValue(metric: (typeof metricCards)[number]["key"], roi: RoiAnalytics) {
  if (metric === "tickets") {
    return Math.round(roi.totalTicketsDeflected).toLocaleString();
  }
  if (metric === "mttr") {
    return roi.averageTimeToResolveSeconds === null
      ? "No data"
      : formatMttr(roi.averageTimeToResolveSeconds);
  }
  return roi.firstPassAccuracy === null
    ? "No data"
    : `${roi.firstPassAccuracy.toFixed(1).replace(/\.0$/, "")}%`;
}

export default function RoiAnalyticsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [analytics, setAnalytics] = useState<RoiAnalytics | null>(null);
  const [orgName, setOrgName] = useState("");
  const [userRole, setUserRole] = useState<DashboardRole>("");
  const [identityStatus, setIdentityStatus] =
    useState<IdentityStatus>("loading");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Persona preview is intentionally a frontend-only testing control.
  // The existing API remains responsible for any real data authorization.
  const hasRoiAccess = true;

  const loadIdentity = useCallback(async () => {
    if (!BASE_API) {
      setError("NEXT_PUBLIC_API_BASE_URL is not configured.");
      setIdentityStatus("error");
      setLoading(false);
      return;
    }

    setIdentityStatus("loading");
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_API}/auth/sync`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const payload = (await response.json().catch(() => ({}))) as AuthSyncPayload & {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(
          payload.message ||
            payload.error ||
            `Identity sync failed (${response.status}).`,
        );
      }

      const role = normalizeDashboardRole(
        payload.user?.role ?? payload.orgRole,
      );
      setOrgName(organizationName(payload));
      setUserRole(role);
      setIdentityStatus("ready");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Failed to load dashboard access.",
      );
      setIdentityStatus("error");
      setLoading(false);
    }
  }, [getToken]);

  const loadAnalytics = useCallback(async () => {
    if (!BASE_API) return;

    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_API}${ROI_ANALYTICS_ENDPOINT}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.message ||
            payload.error ||
            `ROI analytics request failed (${response.status}).`,
        );
      }
      setAnalytics(normalizeRoiAnalytics(payload));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Failed to load ROI analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn) void loadIdentity();
  }, [isLoaded, isSignedIn, loadIdentity]);

  useEffect(() => {
    if (identityStatus === "ready" && hasRoiAccess) void loadAnalytics();
  }, [hasRoiAccess, identityStatus, loadAnalytics]);

  if (!isLoaded || !isSignedIn) {
    return <div className="min-h-screen bg-[var(--bg-base)]" />;
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName={orgName} userRole={userRole} />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.09),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.08),transparent_30%)]"
        />

        <div className="relative mx-auto w-full max-w-6xl px-6 py-10">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                <ChartNoAxesCombined size={15} />
                CIO performance view
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                ROI Analytics
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Live outcomes from the auto-resolution audit trail, presented
                for operational and executive review.
              </p>
            </div>
            {identityStatus === "ready" && hasRoiAccess && (
              <button
                type="button"
                onClick={() => void loadAnalytics()}
                disabled={loading}
                className="btn-secondary"
              >
                <RefreshCcw size={15} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            )}
          </header>

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100"
            >
              <span className="flex items-start gap-2">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={() =>
                  void (identityStatus === "error"
                    ? loadIdentity()
                    : loadAnalytics())
                }
                className="font-medium text-rose-200 underline underline-offset-4 hover:text-white"
              >
                Retry
              </button>
            </div>
          )}

          {identityStatus === "ready" && !hasRoiAccess ? (
            <section
              role="alert"
              aria-labelledby="roi-access-denied"
              className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-400/10 via-slate-900/90 to-slate-950 p-8 shadow-[0_20px_70px_rgba(2,6,23,0.32)]"
            >
              <div className="flex max-w-2xl items-start gap-4">
                <span className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-200">
                  <LockKeyhole size={22} />
                </span>
                <div>
                  <h2
                    id="roi-access-denied"
                    className="text-xl font-semibold text-white"
                  >
                    Access denied
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    ROI Analytics is available only to workspace architects and
                    auditors. Your current role does not include access to this
                    executive reporting view.
                  </p>
                </div>
              </div>
            </section>
          ) : identityStatus !== "error" ? (
            <section
              aria-label="ROI metrics"
              className="grid gap-5 lg:grid-cols-3"
            >
              {metricCards.map(({ key, label, detail, icon: Icon, accent, glow }) => (
                <article
                  key={key}
                  className={`relative min-h-56 overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br ${glow} via-slate-900/90 to-slate-950 p-6 shadow-[0_20px_70px_rgba(2,6,23,0.32)]`}
                >
                  <div className="mb-10 flex items-start justify-between gap-3">
                    <p className="max-w-[220px] text-xs font-semibold uppercase leading-5 tracking-[0.14em] text-slate-400">
                      {label}
                    </p>
                    <span className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                      <Icon size={19} className={accent} />
                    </span>
                  </div>
                  {loading && !analytics ? (
                    <div
                      aria-label={`Loading ${label}`}
                      className="skeleton h-11 w-32"
                    />
                  ) : (
                    <p className={`text-4xl font-semibold tracking-tight ${accent}`}>
                      {analytics ? metricValue(key, analytics) : "—"}
                    </p>
                  )}
                  <p className="mt-4 text-xs leading-5 text-slate-500">{detail}</p>
                </article>
              ))}
            </section>
          ) : null}

          {hasRoiAccess && analytics && (
            <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs text-slate-500">
              <span>Source: Auto-resolution audit events</span>
              <span>
                {analytics.generatedAt
                  ? `Generated ${new Date(analytics.generatedAt).toLocaleString()}`
                  : "Current reporting period"}
              </span>
            </footer>
          )}
        </div>
      </main>
    </div>
  );
}
