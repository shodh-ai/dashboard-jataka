"use client";

import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Filter,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import RichApprovalEvidence, {
  evaluateApprovalEvidence,
  HashBadge,
} from "../components/RichApprovalEvidence";
import {
  describeApprovalTier,
  describeConfidence,
  describeIntent,
  describeSupportLevel,
  presentAuditEvent,
  toneClasses,
} from "../auto-resolution/audit-presenter";
import {
  type AutoResolutionCase,
  type CaseDetail,
  estimateResolutionTime,
  getErrorMessage,
  isResolvableProposal,
  statusBadgeClasses,
  truncateIssue,
} from "../auto-resolution/types";
import { normalizeRichApprovalEvidence } from "../auto-resolution/evidence-normalizer";

const BASE_API =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;

type QueueFilter = "needs_attention" | "all" | "resolved";

export default function SupportOpsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgName, setOrgName] = useState("Jataka");
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("");
  const [cases, setCases] = useState<AutoResolutionCase[]>([]);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("needs_attention");
  const [decisionNote, setDecisionNote] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState("");

  async function apiFetch(path: string, options: RequestInit = {}) {
    if (!BASE_API)
      throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
    const token = await getToken();
    const res = await fetch(`${BASE_API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        data.message || data.error || `Request failed (${res.status})`,
      );
    }
    return data;
  }

  const loadCases = useCallback(async () => {
    setLoadingList(true);
    setError("");
    try {
      const data = await apiFetch("/auto-resolution/cases?limit=50");
      setCases(Array.isArray(data.cases) ? data.cases : []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load support queue."));
    } finally {
      setLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  async function openCase(caseId: string) {
    setLoadingDetail(true);
    setError("");
    setDecisionNote("");
    try {
      const data = (await apiFetch(
        `/auto-resolution/cases/${caseId}`,
      )) as CaseDetail;
      setDetail(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load case detail."));
    } finally {
      setLoadingDetail(false);
    }
  }

  const filteredCases = useMemo(() => {
    if (filter === "resolved") {
      return cases.filter((c) => c.status === "RESOLVED");
    }
    if (filter === "needs_attention") {
      return cases.filter((c) =>
        ["PENDING_APPROVAL", "ESCALATED", "FAILED"].includes(c.status),
      );
    }
    return cases;
  }, [cases, filter]);

  const pendingApproval = useMemo(
    () => detail?.approvals.find((a) => a.status === "PENDING"),
    [detail],
  );

  const proposedActionType = detail?.case.proposalSnapshot?.proposedActionType;
  const rawRichEvidence =
    detail?.case.richEvidence || detail?.case.proposalSnapshot?.richEvidence;
  const richEvidence = useMemo(
    () => normalizeRichApprovalEvidence(rawRichEvidence),
    [rawRichEvidence],
  );
  const approvalEvidenceGate = useMemo(
    () =>
      evaluateApprovalEvidence({
        supportLevel: detail?.case.supportLevel,
        actionType: proposedActionType,
        approvalProposalHash: pendingApproval?.proposalHash,
        caseProposalHash: detail?.case.proposalHash,
        evidence: richEvidence,
      }),
    [
      detail?.case.proposalHash,
      detail?.case.supportLevel,
      pendingApproval?.proposalHash,
      proposedActionType,
      richEvidence,
    ],
  );
  const willExecute = isResolvableProposal(proposedActionType);
  const eta = estimateResolutionTime(detail?.case);

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!detail || !pendingApproval) return;
    if (decision === "APPROVED" && !approvalEvidenceGate.allowed) return;
    setDeciding(true);
    setError("");
    try {
      await apiFetch(
        `/auto-resolution/approvals/${pendingApproval.id}/decide`,
        {
          method: "POST",
          body: JSON.stringify({
            proposalHash: pendingApproval.proposalHash,
            decision,
            decisionNote: decisionNote.trim() || undefined,
          }),
        },
      );
      await openCase(detail.case.id);
      await loadCases();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Approval decision failed."));
    } finally {
      setDeciding(false);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      if (!isLoaded || !isSignedIn || !BASE_API) return;
      try {
        const sync = await apiFetch("/auth/sync");
        const orgData = sync.org || sync.organization || {};
        const rawRole = sync.user?.role || sync.orgRole || "";
        setOrgName(
          orgData.name || sync.orgName || sync.organizationName || "Jataka",
        );
        setUserRole(
          rawRole === "senior" || rawRole === "org:admin" || rawRole === "admin"
            ? "ARCHITECT"
            : "DEVELOPER",
        );
        await loadCases();
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Failed to load Support Ops."));
        setLoadingList(false);
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!detail && filteredCases[0]) {
      openCase(filteredCases[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCases.length]);

  if (!isLoaded || !isSignedIn) {
    return <div className="min-h-screen bg-[var(--bg-base)]" />;
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName={orgName} userRole={userRole} />

      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(16,185,129,0.08),_transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(99,102,241,0.07),_transparent_45%)]"
        />

        {/* Queue */}
        <aside className="relative z-10 flex h-screen w-[340px] shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/50 backdrop-blur-sm">
          <div className="border-b border-slate-800/80 px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">Support Ops</p>
                <p className="text-xs text-slate-500">
                  Approvals · audit · execution
                </p>
              </div>
              <button
                type="button"
                onClick={loadCases}
                className="rounded-md p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                title="Refresh queue"
              >
                <RefreshCcw
                  size={15}
                  className={loadingList ? "animate-spin" : ""}
                />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
              {(
                [
                  ["needs_attention", "Needs you"],
                  ["all", "All"],
                  ["resolved", "Resolved"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                    filter === id
                      ? "bg-slate-700 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loadingList && cases.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Loading queue…
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Filter className="mx-auto mb-2 text-slate-600" size={20} />
                <p className="text-sm text-slate-500">Nothing in this view.</p>
              </div>
            ) : (
              filteredCases.map((row) => {
                const active = detail?.case.id === row.id;
                const rowEta = estimateResolutionTime(row);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => openCase(row.id)}
                    className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${
                      active
                        ? "bg-emerald-500/10 ring-1 ring-emerald-400/25"
                        : "hover:bg-slate-900/70"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] ${statusBadgeClasses(row.status)}`}
                      >
                        {row.status.replaceAll("_", " ")}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {rowEta.label}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm leading-5 text-slate-200">
                      {truncateIssue(row.issueText, 90)}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {row.supportLevel || "—"} ·{" "}
                      {row.approvalTier || "unassigned"} ·{" "}
                      {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Case workspace */}
        <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
          {error && (
            <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {!detail && !loadingDetail ? (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-500">
              <FileSearch size={28} className="mb-3 opacity-50" />
              <p className="text-sm">Select a case from the queue.</p>
            </div>
          ) : loadingDetail && !detail ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading case…
            </div>
          ) : (
            detail && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={detail.case.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <header className="shrink-0 border-b border-slate-800/70 px-6 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 max-w-3xl">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[11px] ${statusBadgeClasses(detail.case.status)}`}
                          >
                            {detail.case.status}
                          </span>
                          {detail.case.supportLevel && (
                            <span className="text-xs text-slate-500">
                              {describeSupportLevel(detail.case.supportLevel)}
                            </span>
                          )}
                          {detail.case.intent && (
                            <span className="text-xs text-slate-500">
                              · {describeIntent(detail.case.intent)}
                            </span>
                          )}
                        </div>
                        <h1 className="text-lg font-medium leading-7 text-white">
                          {detail.case.issueText}
                        </h1>
                        <p className="mt-2 font-mono text-[11px] text-slate-600">
                          case {detail.case.id}
                          {detail.case.proposalHash
                            ? ` · hash ${detail.case.proposalHash.slice(0, 16)}…`
                            : ""}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-right">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          ETA
                        </p>
                        <p className="text-sm font-medium text-slate-200">
                          {eta.label}
                        </p>
                        <p className="mt-0.5 max-w-[180px] text-[11px] text-slate-500">
                          {eta.detail}
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                      {/* Left: proposal + approval */}
                      <section className="min-w-0 space-y-6 border-b border-slate-800/60 px-6 py-6 lg:border-b-0 lg:border-r">
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                            Proposed resolution
                          </p>
                          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 px-4 py-4 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
                            {detail.case.proposalSnapshot?.answer ||
                              "No proposal drafted yet."}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <TechMeta
                            label="Action"
                            value={
                              detail.case.proposalSnapshot?.proposedActionType
                            }
                          />
                          <TechMeta
                            label="Risk"
                            value={detail.case.proposalSnapshot?.risk}
                          />
                          <TechMeta
                            label="Approval tier"
                            value={detail.case.approvalTier}
                            hint={describeApprovalTier(
                              detail.case.approvalTier,
                            )}
                          />
                          <TechMeta
                            label="Confidence"
                            value={
                              typeof detail.case.confidenceScore === "number"
                                ? detail.case.confidenceScore.toFixed(2)
                                : undefined
                            }
                            hint={describeConfidence(
                              detail.case.confidenceScore,
                            )}
                          />
                        </div>

                        {detail.case.proposalSnapshot?.actionInputSummary && (
                          <TechMeta
                            label="Action input"
                            value={
                              detail.case.proposalSnapshot.actionInputSummary
                            }
                          />
                        )}
                        {detail.case.proposalSnapshot?.validationPlan && (
                          <TechMeta
                            label="Validation plan"
                            value={detail.case.proposalSnapshot.validationPlan}
                          />
                        )}
                        {detail.case.proposalSnapshot?.rollbackNotes && (
                          <TechMeta
                            label="Rollback"
                            value={detail.case.proposalSnapshot.rollbackNotes}
                          />
                        )}

                        {detail.case.executionSnapshot && (
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                              Execution / validation
                            </p>
                            <div className="space-y-2 font-mono text-[11px] leading-5 text-slate-400">
                              <p>
                                ok:{" "}
                                {String(
                                  Boolean(detail.case.executionSnapshot.ok),
                                )}
                              </p>
                              <p>
                                action:{" "}
                                {detail.case.executionSnapshot.actionType ||
                                  "—"}
                              </p>
                              <p>
                                validated:{" "}
                                {String(
                                  Boolean(
                                    detail.case.executionSnapshot.validated,
                                  ),
                                )}
                              </p>
                              <p className="whitespace-pre-wrap text-slate-300">
                                {detail.case.executionSnapshot
                                  .validationDetail ||
                                  detail.case.executionSnapshot.error ||
                                  "No detail"}
                              </p>
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                            Approval evidence
                          </p>
                          <RichApprovalEvidence
                            evidence={richEvidence}
                            gate={approvalEvidenceGate}
                            originalIntent={detail.case.issueText}
                            finalized={
                              detail.case.status === "RESOLVED" &&
                              detail.case.executionSnapshot?.validated === true
                            }
                          />
                        </div>

                        {/* Approval layer */}
                        <div className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-5">
                          <div className="mb-3 flex items-center gap-2">
                            <ShieldCheck
                              size={18}
                              className="text-emerald-400"
                            />
                            <p className="text-sm font-semibold text-white">
                              Approval layer
                            </p>
                          </div>

                          {!pendingApproval ? (
                            <p className="text-sm text-slate-400">
                              No pending approval on this case.
                            </p>
                          ) : (
                            <>
                              {willExecute ? (
                                <p className="mb-3 text-sm leading-6 text-emerald-100/90">
                                  Approving runs the proposed external action,
                                  then validates against Salesforce / execution
                                  checks.
                                </p>
                              ) : (
                                <p className="mb-3 text-sm leading-6 text-amber-100/90">
                                  Approving routes this for human follow-up — no
                                  automated external mutation.
                                </p>
                              )}

                              <p className="mb-2 font-mono text-[10px] break-all text-slate-500">
                                approval {pendingApproval.id} · tier{" "}
                                {pendingApproval.approvalTier}
                              </p>
                              <div className="mb-3 flex flex-wrap gap-2">
                                <HashBadge
                                  label="Bound proposal"
                                  value={pendingApproval.proposalHash}
                                />
                                {richEvidence?.evidenceHash ||
                                pendingApproval.evidenceHash ? (
                                  <HashBadge
                                    label="Bound evidence"
                                    value={
                                      richEvidence?.evidenceHash ||
                                      pendingApproval.evidenceHash
                                    }
                                  />
                                ) : (
                                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-400">
                                    Evidence hash not required for this human
                                    handoff
                                  </span>
                                )}
                              </div>

                              <textarea
                                value={decisionNote}
                                onChange={(e) =>
                                  setDecisionNote(e.target.value)
                                }
                                rows={2}
                                placeholder="Decision note (optional, written to audit)"
                                className="input mb-3 w-full resize-none text-sm"
                              />

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={
                                    deciding || !approvalEvidenceGate.allowed
                                  }
                                  aria-describedby={
                                    !approvalEvidenceGate.allowed
                                      ? "approval-evidence-block-reason"
                                      : undefined
                                  }
                                  title={
                                    !approvalEvidenceGate.allowed
                                      ? approvalEvidenceGate.reasons.join(" ")
                                      : undefined
                                  }
                                  onClick={() => decide("APPROVED")}
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  {deciding ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <CheckCircle2 size={16} />
                                  )}
                                  {willExecute
                                    ? "Authorize & deploy"
                                    : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  disabled={deciding}
                                  onClick={() => decide("REJECTED")}
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                                >
                                  <XCircle size={16} />
                                  Reject
                                </button>
                              </div>
                              {!approvalEvidenceGate.allowed && (
                                <p
                                  id="approval-evidence-block-reason"
                                  className="mt-2 text-xs text-amber-300"
                                >
                                  Approve is disabled until required evidence is
                                  verified and hash-bound. Reject remains
                                  available.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </section>

                      {/* Right: audit trail */}
                      <section className="min-w-0 px-6 py-6">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                          Audit trail
                        </p>
                        <p className="mb-5 text-xs text-slate-600">
                          Full technical timeline for this case.
                        </p>

                        <div className="space-y-0">
                          {detail.auditEvents.map((event, index) => {
                            const presentation = presentAuditEvent(event);
                            const tone = toneClasses(presentation.tone);
                            const Icon = presentation.icon;
                            const isLast =
                              index === detail.auditEvents.length - 1;
                            return (
                              <div key={event.id} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${tone.ring}`}
                                  >
                                    <Icon size={14} className={tone.icon} />
                                  </div>
                                  {!isLast && (
                                    <div className="my-1 w-px flex-1 bg-slate-800" />
                                  )}
                                </div>
                                <div
                                  className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-5"}`}
                                >
                                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="text-sm font-medium text-slate-100">
                                      {presentation.title}
                                    </p>
                                    <time className="font-mono text-[10px] text-slate-600">
                                      {new Date(
                                        event.createdAt,
                                      ).toLocaleString()}
                                    </time>
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-slate-400">
                                    {presentation.summary}
                                  </p>
                                  <div className="mt-2 space-y-0.5 font-mono text-[10px] leading-4 text-slate-600">
                                    <p>event={event.eventType}</p>
                                    <p>
                                      actor={event.actorType}
                                      {event.actorId
                                        ? `:${event.actorId.slice(0, 12)}`
                                        : ""}
                                    </p>
                                    {event.approvalTier && (
                                      <p>tier={event.approvalTier}</p>
                                    )}
                                    {typeof event.confidence === "number" && (
                                      <p>
                                        confidence={event.confidence.toFixed(3)}
                                      </p>
                                    )}
                                    {event.policyDecision && (
                                      <p className="whitespace-pre-wrap text-slate-500">
                                        note={event.policyDecision}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {detail.steps.length > 0 && (
                          <div className="mt-8">
                            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                              Pipeline steps
                            </p>
                            <ul className="space-y-2">
                              {detail.steps.map((step) => (
                                <li
                                  key={step.id}
                                  className="flex items-start gap-2 text-xs text-slate-400"
                                >
                                  <span
                                    className={`mt-0.5 rounded border px-1.5 py-0.5 text-[10px] ${statusBadgeClasses(step.status)}`}
                                  >
                                    {step.status}
                                  </span>
                                  <span>
                                    <span className="text-slate-200">
                                      {step.label}
                                    </span>
                                    {step.detail ? ` — ${step.detail}` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </section>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )
          )}
        </main>
      </div>
    </div>
  );
}

function TechMeta({
  label,
  value,
  hint,
}: {
  label: string;
  value?: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="break-words rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
        {value || "—"}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] leading-4 text-slate-600">{hint}</p>
      )}
    </div>
  );
}
