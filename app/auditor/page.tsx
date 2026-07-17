"use client";

import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  FileCode2,
  Fingerprint,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  UserRoundCheck,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AuditorHashStatus, {
  isServerVerificationValid,
  type ServerHashVerification,
} from "../components/AuditorHashStatus";
import { HashBadge } from "../components/RichApprovalEvidence";
import { auditorEndpoints } from "./contracts";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;

export type AutoResolutionAuditEvent = {
  id: string;
  caseId: string;
  source?: string;
  sourceMessageId?: string;
  actorType?: string;
  actorId?: string;
  eventType: string;
  supportLevel?: string;
  intent?: string;
  policyDecision?: string;
  approvalTier?: string;
  evidenceRefs?: unknown;
  proposalSnapshot?: Record<string, unknown> | null;
  executionSnapshot?: Record<string, unknown> | null;
  redactionMetadata?: Record<string, unknown> | null;
  certificateUri?: string | null;
  certificateHash?: string | null;
  traceId?: string;
  createdAt: string;
  // Forward-compatible fields that may be added to the event presenter.
  originalRequest?: string;
  llmPrompt?: string;
  prompt?: string;
};

type AuditPresentation = {
  request?: string;
  prompt?: string;
  diff?: { filePath?: string; before?: string; after?: string; patch?: string };
  approver?: string;
  execution?: Record<string, unknown>;
  videoUrl?: string;
  proposalHash?: string;
  evidenceHash?: string;
};

export default function AuditorPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [events, setEvents] = useState<AutoResolutionAuditEvent[]>([]);
  const [detail, setDetail] = useState<AutoResolutionAuditEvent | null>(null);
  const [verification, setVerification] = useState<ServerHashVerification>();
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!BASE_API) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
      const token = await getToken();
      const response = await fetch(`${BASE_API}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || `Request failed (${response.status})`);
      }
      return data;
    },
    [getToken],
  );

  const verifyEvent = useCallback(
    async (eventId: string) => {
      setVerifying(true);
      setVerification(undefined);
      try {
        const result = await apiFetch(auditorEndpoints.verify(eventId), {
          method: "POST",
        });
        setVerification(result as ServerHashVerification);
      } catch (reason: unknown) {
        setVerification({
          valid: false,
          reason: reason instanceof Error ? reason.message : "Server verification failed.",
        });
      } finally {
        setVerifying(false);
      }
    },
    [apiFetch],
  );

  const openEvent = useCallback(
    async (eventId: string) => {
      setLoadingDetail(true);
      setError("");
      setVerification(undefined);
      try {
        const data = await apiFetch(auditorEndpoints.detail(eventId));
        const nextDetail = (data.event || data) as AutoResolutionAuditEvent;
        setDetail(nextDetail);
        await verifyEvent(eventId);
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : "Failed to load audit event.");
      } finally {
        setLoadingDetail(false);
      }
    },
    [apiFetch, verifyEvent],
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(auditorEndpoints.list);
      const rows: AutoResolutionAuditEvent[] = Array.isArray(data.events) ? data.events : [];
      const l3Events = rows.filter((event) => event.supportLevel === "L3");
      setEvents(l3Events);
      if (l3Events[0]) await openEvent(l3Events[0].id);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Failed to load L3 audit events.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, openEvent]);

  useEffect(() => {
    if (isLoaded && isSignedIn) void loadEvents();
  }, [isLoaded, isSignedIn, loadEvents]);

  const presentation = detail ? presentAuditEventDetail(detail) : undefined;

  if (!isLoaded || !isSignedIn) {
    return <div className="min-h-screen bg-[var(--bg-base)]" />;
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName="Jataka" userRole="ARCHITECT" />
      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
                <ShieldCheck className="text-indigo-400" />
                Auditor
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Read-only L3 audit evidence and server-side certificate verification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadEvents()}
              className="btn-secondary"
              disabled={loading}
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </header>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="self-start overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
              <div className="border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                L3 audit events
              </div>
              {loading && events.length === 0 ? (
                <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
                  <Loader2 size={15} className="animate-spin" />
                  Loading audit events…
                </div>
              ) : events.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No L3 audit events found.</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {events.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => void openEvent(event.id)}
                        className={`w-full px-4 py-3 text-left transition hover:bg-slate-900 ${
                          detail?.id === event.id ? "bg-indigo-500/10" : ""
                        }`}
                      >
                        <p className="truncate text-sm font-medium text-slate-200">
                          {event.eventType.replaceAll("_", " ")} · Case {event.caseId}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {event.actorType || "system"} ·{" "}
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>

            <section className="min-w-0">
              {loadingDetail && !detail ? (
                <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  Loading evidence…
                </div>
              ) : detail ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500">
                          Case {detail.caseId}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-white">
                          {detail.eventType.replaceAll("_", " ")} audit evidence
                        </h2>
                      </div>
                      <AuditorHashStatus verification={verification} loading={verifying} />
                    </div>
                    {verification && !isServerVerificationValid(verification) && (
                      <p className="mt-3 text-xs text-red-300">
                        {verification.reason ||
                          verification.errors?.join(", ") ||
                          "Certificate verification failed."}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <HashBadge
                        label="Proposal"
                        value={verification?.proposalHash || presentation?.proposalHash}
                      />
                      <HashBadge
                        label="Evidence"
                        value={verification?.evidenceHash || presentation?.evidenceHash}
                      />
                      <HashBadge
                        label="Execution"
                        value={verification?.executionHash}
                      />
                      <HashBadge
                        label="Certificate"
                        value={detail.certificateHash || undefined}
                      />
                    </div>
                  </div>

                  <ReadOnlyPanel title="Original request" icon={Fingerprint}>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                      {presentation?.request || "Unavailable"}
                    </p>
                  </ReadOnlyPanel>

                  <ReadOnlyPanel title="Agent prompt" icon={Fingerprint}>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-300">
                      {presentation?.prompt || "Unavailable"}
                    </pre>
                  </ReadOnlyPanel>

                  <ReadOnlyPanel title="Deployment diff" icon={FileCode2}>
                    {presentation?.diff?.filePath && (
                      <p className="mb-2 font-mono text-xs text-slate-400">
                        {presentation.diff.filePath}
                      </p>
                    )}
                    <pre className="max-h-[520px] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-300">
                      {presentation?.diff?.patch ||
                        formatSideBySideFallback(
                          presentation?.diff?.before,
                          presentation?.diff?.after,
                        )}
                    </pre>
                  </ReadOnlyPanel>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ReadOnlyPanel title="Approver" icon={UserRoundCheck}>
                      <p className="text-sm text-slate-200">
                        {presentation?.approver || "Unavailable"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {detail.policyDecision || "No decision note recorded."}
                      </p>
                    </ReadOnlyPanel>
                    <ReadOnlyPanel title="Execution" icon={ShieldCheck}>
                      <p className="text-sm text-slate-200">
                        {stringField(presentation?.execution, "status") ||
                          (detail.eventType === "EXECUTED" ? "EXECUTED" : "Unavailable")}
                      </p>
                      {presentation?.execution && (
                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          {safeJson(presentation.execution)}
                        </p>
                      )}
                    </ReadOnlyPanel>
                  </div>

                  <ReadOnlyPanel title="Execution video" icon={Video}>
                    <AuditVideo url={presentation?.videoUrl} />
                  </ReadOnlyPanel>
                </div>
              ) : (
                <p className="p-12 text-center text-sm text-slate-500">
                  Select a deployment to inspect.
                </p>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function ReadOnlyPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof ShieldCheck;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Icon size={14} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function AuditVideo({ url }: { url?: string }) {
  if (!url) return <p className="text-sm text-slate-500">No execution video recorded.</p>;
  if (!url.startsWith("/") && !url.startsWith("https://")) {
    return <p className="text-sm text-red-300">Video blocked: a secure URL is required.</p>;
  }
  return (
    <div>
      <video
        className="max-h-[520px] w-full rounded-lg bg-black"
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        preload="metadata"
        crossOrigin="anonymous"
      >
        <source src={url} type="video/mp4" />
        Your browser does not support secure video playback.
      </video>
    </div>
  );
}

function formatSideBySideFallback(before?: string, after?: string) {
  if (!before && !after) return "Unavailable";
  return `--- before\n${before || ""}\n\n+++ after\n${after || ""}`;
}

function presentAuditEventDetail(event: AutoResolutionAuditEvent): AuditPresentation {
  const eventRecord = event as unknown as Record<string, unknown>;
  const proposal = asRecord(event.proposalSnapshot);
  const richEvidence = asRecord(proposal.richEvidence);
  const astDiff = asRecord(
    richEvidence.astDiff || proposal.astDiff || eventRecord.diff,
  );
  const approver = asRecord(eventRecord.approver);
  const executionAlias = asRecord(eventRecord.execution);
  const execution =
    event.executionSnapshot ||
    (Object.keys(executionAlias).length > 0 ? executionAlias : undefined);
  const video = asRecord(eventRecord.video);
  const operations = Array.isArray(astDiff.operations) ? astDiff.operations : [];
  const firstOperation = asRecord(operations[0]);

  return {
    request: firstString(
      event.originalRequest,
      eventRecord.request,
      proposal.originalRequest,
      proposal.issueText,
      asRecord(event.redactionMetadata).originalRequest,
    ),
    prompt: firstString(
      event.llmPrompt,
      event.prompt,
      proposal.llmPrompt,
      proposal.prompt,
      richEvidence.teeGeneratedInstruction,
    ),
    diff:
      Object.keys(astDiff).length > 0
        ? {
            filePath: firstString(
              astDiff.filePath,
              firstOperation.path,
              asRecord(richEvidence.blastRadiusGraph).entityName,
            ),
            before: firstString(astDiff.before),
            after: firstString(astDiff.after),
            patch: firstString(astDiff.patch),
          }
        : undefined,
    approver:
      firstString(approver.name, approver.email) ||
      (event.eventType === "APPROVED"
        ? [event.actorType, event.actorId].filter(Boolean).join(":")
        : undefined),
    execution,
    videoUrl: firstString(
      richEvidence.sandboxVideoUrl,
      video.url,
      asRecord(execution).videoUrl,
    ),
    proposalHash: firstString(eventRecord.proposalHash, proposal.proposalHash),
    evidenceHash: firstString(richEvidence.evidenceHash, proposal.evidenceHash),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]): string | undefined {
  const value = values.find(
    (candidate) => typeof candidate === "string" && candidate.trim().length > 0,
  );
  return typeof value === "string" ? value : undefined;
}

function stringField(record: Record<string, unknown> | undefined, key: string) {
  return firstString(record?.[key]);
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
