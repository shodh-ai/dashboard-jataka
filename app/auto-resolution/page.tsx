"use client";

import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  GitPullRequestArrow,
  Loader2,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;

const L1_DEMO_ISSUE =
  "What list view should I use to find unpublished Spanish Knowledge drafts?";
const L2_DEMO_ISSUE =
  "Why does the Spanish Knowledge draft throw a validation error during save?";

type EvidenceRef = {
  type: string;
  id: string;
  label?: string;
  score?: number;
  preview?: string;
  metadata?: Record<string, unknown>;
};

type EvidenceBundle = {
  refs?: EvidenceRef[];
  snapshot?: {
    curriculumId?: string;
    branch?: string;
    topScore?: number;
    minScore?: number;
    retrievalIsWeak?: boolean;
    retrievalSummary?: {
      qa_resolution_matches?: number;
      vector_hits?: number;
      full_files?: number;
      graph_dependencies?: number;
      jira_context?: number;
      concepts?: number;
    };
    qaResolutionMatches?: Array<{ preview: string }>;
    vectorHits?: Array<{
      asset_id?: string | null;
      score?: number | null;
      preview?: string;
    }>;
    fullFiles?: Array<{ name: string; preview?: string }>;
    graphDependencies?: Array<{
      target?: string;
      name?: string;
      type?: string;
      relationship?: string;
    }>;
    jiraContext?: Array<{
      jira_key?: string;
      found?: boolean;
      preview?: string;
    }>;
    concepts?: Array<{ name?: string; definition?: string }>;
  };
  topScore?: number;
  minScore?: number;
  shouldEscalate?: boolean;
  reason?: string;
};

type Brain = {
  id: string;
  name?: string;
  knowledgeBaseId: string;
};

type PipelineStep = {
  id: string;
  label: string;
  status: "complete" | "pending";
  detail?: string;
};

type Approval = {
  id: string;
  status: string;
  approvalTier: string;
  proposalHash: string;
  requestedAt: string;
};

type AuditEvent = {
  id: string;
  eventType: string;
  actorType: string;
  actorId?: string;
  policyDecision?: string;
  approvalTier?: string;
  confidence?: number;
  evidenceRefs?: EvidenceBundle | EvidenceRef[];
  createdAt: string;
};

type AutoResolutionCase = {
  id: string;
  issueText: string;
  status: string;
  source: string;
  intent?: string;
  supportLevel?: string;
  approvalTier?: string;
  confidenceScore?: number;
  requesterId?: string;
  proposalHash?: string;
  evidenceRefs?: EvidenceBundle | EvidenceRef[];
  proposalSnapshot?: {
    answer?: string;
    proposedActionType?: string;
    actionInputSummary?: string;
    risk?: string;
    rollbackNotes?: string;
    validationPlan?: string;
    evidenceRefs?: EvidenceRef[];
  };
  executionSnapshot?: {
    ok?: boolean;
    actionType?: string;
    validated?: boolean;
    validationDetail?: string;
    error?: string;
  };
  createdAt: string;
  resolvedAt?: string;
};

type CaseDetail = {
  case: AutoResolutionCase;
  approvals: Approval[];
  auditEvents: AuditEvent[];
  steps: PipelineStep[];
};

function resolveKnowledgeBaseId(brains: Brain[], activeBrainId?: string) {
  if (!brains.length) return "";
  if (activeBrainId) {
    const byKnowledgeBaseId = brains.find((b) => b.knowledgeBaseId === activeBrainId);
    if (byKnowledgeBaseId) return byKnowledgeBaseId.knowledgeBaseId;
    const byId = brains.find((b) => b.id === activeBrainId);
    if (byId) return byId.knowledgeBaseId;
  }
  return brains[0].knowledgeBaseId;
}

function badgeClasses(value?: string) {
  if (!value) return "bg-slate-800 text-slate-300 border-slate-700";
  if (["RESOLVED", "AUTO_ANSWER", "L1", "complete"].includes(value)) {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  }
  if (["PENDING_APPROVAL", "HUMAN_ONLY", "L2", "pending"].includes(value)) {
    return "bg-amber-500/10 text-amber-300 border-amber-500/30";
  }
  if (["FAILED", "REJECTED", "ESCALATED", "L3"].includes(value)) {
    return "bg-red-500/10 text-red-300 border-red-500/30";
  }
  return "bg-blue-500/10 text-blue-300 border-blue-500/30";
}

function StepIcon({ complete }: { complete: boolean }) {
  return complete ? (
    <CheckCircle2 size={18} className="text-emerald-400" />
  ) : (
    <Clock size={18} className="text-slate-500" />
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeEvidenceBundle(
  value?: EvidenceBundle | EvidenceRef[],
): EvidenceBundle | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return { refs: value };
  return value;
}

function getAuditEvent(detail: CaseDetail | null, eventType: string) {
  return detail?.auditEvents.find((event) => event.eventType === eventType);
}

export default function AutoResolutionPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgName, setOrgName] = useState("Jataka");
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("");
  const [brains, setBrains] = useState<Brain[]>([]);
  const [activeBrain, setActiveBrain] = useState("");
  const [issueText, setIssueText] = useState(L1_DEMO_ISSUE);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [recentCases, setRecentCases] = useState<AutoResolutionCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [bypassing, setBypassing] = useState(false);
  const [error, setError] = useState("");

  const pendingApproval = useMemo(
    () => detail?.approvals.find((approval) => approval.status === "PENDING"),
    [detail],
  );

  const activeKnowledgeBaseId = useMemo(
    () => resolveKnowledgeBaseId(brains, activeBrain),
    [brains, activeBrain],
  );

  const evidenceBundle = useMemo(
    () =>
      normalizeEvidenceBundle(detail?.case.evidenceRefs) ||
      normalizeEvidenceBundle(getAuditEvent(detail, "EVIDENCE_RETRIEVED")?.evidenceRefs),
    [detail],
  );

  const classifiedEvent = useMemo(
    () => getAuditEvent(detail, "CLASSIFIED"),
    [detail],
  );
  const policyEvent = useMemo(() => getAuditEvent(detail, "POLICY_DECIDED"), [detail]);

  async function runDemoIssue(text: string) {
    setIssueText(text);
    setError("");
    if (!activeKnowledgeBaseId) {
      setError("Select a brain before running the demo.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/auto-resolution/cases", {
        method: "POST",
        body: JSON.stringify({
          source: "PORTAL",
          curriculumId: activeKnowledgeBaseId,
          issueText: text,
        }),
      });
      await loadCase(data.case_id);
      await loadRecentCases();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to run demo issue."));
    } finally {
      setLoading(false);
    }
  }

  async function apiFetch(path: string, options: RequestInit = {}) {
    if (!BASE_API) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
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
      throw new Error(data.message || data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  async function loadCase(caseId: string) {
    const data = await apiFetch(`/auto-resolution/cases/${caseId}`);
    setDetail(data);
    return data as CaseDetail;
  }

  async function loadRecentCases() {
    const data = await apiFetch("/auto-resolution/cases?limit=10");
    setRecentCases(Array.isArray(data.cases) ? data.cases : []);
  }

  useEffect(() => {
    async function bootstrap() {
      if (!isLoaded || !isSignedIn || !BASE_API) return;
      try {
        const sync = await apiFetch("/auth/sync");
        const orgData = sync.org || sync.organization || {};
        const rawRole = sync.user?.role || sync.orgRole || "";
        setOrgName(orgData.name || sync.orgName || sync.organizationName || "Jataka");
        setUserRole(
          rawRole === "senior" || rawRole === "org:admin" || rawRole === "admin"
            ? "ARCHITECT"
            : "DEVELOPER",
        );

        const brainsData = await apiFetch("/curriculum/list");
        const list = Array.isArray(brainsData.brains) ? brainsData.brains : [];
        setBrains(list);
        if (list.length > 0) {
          setActiveBrain(resolveKnowledgeBaseId(list, brainsData.activeBrainId));
        }

        await loadRecentCases();
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Failed to load auto-resolution page."));
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  async function raiseIssue() {
    if (!issueText.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/auto-resolution/cases", {
        method: "POST",
        body: JSON.stringify({
          source: "PORTAL",
          curriculumId: activeKnowledgeBaseId,
          issueText: issueText.trim(),
        }),
      });
      await loadCase(data.case_id);
      await loadRecentCases();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to raise issue."));
    } finally {
      setLoading(false);
    }
  }

  async function requesterBypass() {
    if (!detail?.case.proposalHash) return;
    setBypassing(true);
    setError("");
    try {
      const data = await apiFetch(`/auto-resolution/cases/${detail.case.id}/requester-bypass`, {
        method: "POST",
        body: JSON.stringify({
          proposalHash: detail.case.proposalHash,
          decisionNote: "Requester clicked dashboard master bypass.",
        }),
      });
      setDetail(data.detail);
      await loadRecentCases();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Requester bypass failed."));
    } finally {
      setBypassing(false);
    }
  }

  if (!isLoaded || !isSignedIn) {
    return <div className="min-h-screen bg-[var(--bg-base)]" />;
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName={orgName} userRole={userRole} />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2">
                <Sparkles className="text-blue-300" size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Auto Resolution Pipeline</h1>
                <p className="text-sm text-slate-400">
                  Raise a customer issue, inspect classification and evidence, approve execution,
                  and review the audit trail in one place.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Raise Issue</h2>
                  <p className="text-sm text-slate-400">
                    This creates a `PORTAL` source case and runs the backend pipeline.
                  </p>
                </div>
                <FileText className="text-slate-500" size={22} />
              </div>

              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Brain / curriculum
              </label>
              <select
                value={activeBrain}
                onChange={(e) => setActiveBrain(e.target.value)}
                className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                {brains.length === 0 ? (
                  <option value="">No brains found</option>
                ) : (
                  brains.map((brain) => (
                    <option key={brain.knowledgeBaseId} value={brain.knowledgeBaseId}>
                      {brain.name || brain.knowledgeBaseId}
                    </option>
                  ))
                )}
              </select>

              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Customer issue
              </label>
              <textarea
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-blue-500"
                placeholder="Describe the issue..."
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => runDemoIssue(L1_DEMO_ISSUE)}
                  disabled={loading || !activeKnowledgeBaseId}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  Run L1 Auto Resolution Demo
                </button>
                <button
                  onClick={() => runDemoIssue(L2_DEMO_ISSUE)}
                  disabled={loading || !activeKnowledgeBaseId}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  Run L2 Diagnosis Demo
                </button>
                <button
                  onClick={raiseIssue}
                  disabled={loading || !issueText.trim() || !activeKnowledgeBaseId}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  Raise Issue
                </button>
                <button
                  onClick={loadRecentCases}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-900"
                >
                  <RefreshCcw size={16} />
                  Refresh cases
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
              <h2 className="mb-4 text-lg font-semibold text-white">Recent Cases</h2>
              <div className="space-y-2">
                {recentCases.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                    No cases yet. Raise an issue to start the pipeline.
                  </p>
                ) : (
                  recentCases.map((caseRow) => (
                    <button
                      key={caseRow.id}
                      onClick={() => loadCase(caseRow.id)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left transition hover:border-slate-600"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-slate-200">
                          {caseRow.issueText}
                        </span>
                        <span
                          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${badgeClasses(caseRow.status)}`}
                        >
                          {caseRow.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {caseRow.supportLevel || "unclassified"} ·{" "}
                        {new Date(caseRow.createdAt).toLocaleString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          {detail && (
            <>
              <section className="grid gap-4 md:grid-cols-4">
                <SummaryCard label="Status" value={detail.case.status} />
                <SummaryCard label="Category" value={detail.case.supportLevel || "Pending"} />
                <SummaryCard label="Intent" value={detail.case.intent || "Pending"} />
                <SummaryCard
                  label="Confidence"
                  value={
                    typeof detail.case.confidenceScore === "number"
                      ? detail.case.confidenceScore.toFixed(2)
                      : "N/A"
                  }
                />
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Pipeline</h2>
                    <p className="text-sm text-slate-400">
                      Case `{detail.case.id}` moving through intake, policy, evidence, approval,
                      execution, validation, and audit.
                    </p>
                  </div>
                  <GitPullRequestArrow className="text-slate-500" size={22} />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {detail.steps.map((step) => (
                    <div
                      key={step.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <StepIcon complete={step.status === "complete"} />
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${badgeClasses(step.status)}`}
                        >
                          {step.status}
                        </span>
                      </div>
                      <p className="font-medium text-slate-100">{step.label}</p>
                      {step.detail && (
                        <p className="mt-1 line-clamp-3 text-xs text-slate-400">{step.detail}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="text-blue-300" size={20} />
                  <h2 className="text-lg font-semibold text-white">How It Happened</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <HowItHappenedCard
                    title="Classification"
                    value={`${detail.case.supportLevel || "Pending"} / ${detail.case.intent || "Pending"}`}
                    detail={classifiedEvent?.policyDecision}
                  />
                  <HowItHappenedCard
                    title="Policy decision"
                    value={detail.case.approvalTier || "Pending"}
                    detail={policyEvent?.policyDecision}
                  />
                  <HowItHappenedCard
                    title="Resolution path"
                    value={
                      detail.case.status === "RESOLVED" && detail.case.approvalTier === "AUTO_ANSWER"
                        ? "Auto-resolved without approval"
                        : detail.case.status === "PENDING_APPROVAL"
                          ? "Waiting for approval before execution"
                          : detail.case.status
                    }
                    detail={detail.case.proposalSnapshot?.actionInputSummary}
                  />
                  <HowItHappenedCard
                    title="Final outcome"
                    value={detail.case.status}
                    detail={
                      detail.case.executionSnapshot?.validationDetail ||
                      detail.case.proposalSnapshot?.answer
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="text-violet-300" size={20} />
                  <h2 className="text-lg font-semibold text-white">Evidence Retrieval</h2>
                </div>
                {!evidenceBundle ? (
                  <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                    No evidence payload stored for this case yet.
                  </p>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-4">
                      <Meta
                        label="Top score"
                        value={
                          typeof evidenceBundle.topScore === "number"
                            ? evidenceBundle.topScore.toFixed(2)
                            : evidenceBundle.snapshot?.topScore?.toFixed(2)
                        }
                      />
                      <Meta
                        label="Min score"
                        value={
                          typeof evidenceBundle.minScore === "number"
                            ? evidenceBundle.minScore.toFixed(2)
                            : evidenceBundle.snapshot?.minScore?.toFixed(2)
                        }
                      />
                      <Meta
                        label="Should escalate"
                        value={String(Boolean(evidenceBundle.shouldEscalate))}
                      />
                      <Meta label="Reason" value={evidenceBundle.reason} />
                    </div>

                    {evidenceBundle.snapshot?.retrievalSummary && (
                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        <SummaryCard
                          label="QA memory"
                          value={String(evidenceBundle.snapshot.retrievalSummary.qa_resolution_matches ?? 0)}
                        />
                        <SummaryCard
                          label="Vector hits"
                          value={String(evidenceBundle.snapshot.retrievalSummary.vector_hits ?? 0)}
                        />
                        <SummaryCard
                          label="Full files"
                          value={String(evidenceBundle.snapshot.retrievalSummary.full_files ?? 0)}
                        />
                        <SummaryCard
                          label="Graph deps"
                          value={String(evidenceBundle.snapshot.retrievalSummary.graph_dependencies ?? 0)}
                        />
                        <SummaryCard
                          label="Jira context"
                          value={String(evidenceBundle.snapshot.retrievalSummary.jira_context ?? 0)}
                        />
                        <SummaryCard
                          label="Concepts"
                          value={String(evidenceBundle.snapshot.retrievalSummary.concepts ?? 0)}
                        />
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      {(evidenceBundle.refs || []).map((ref) => (
                        <div
                          key={`${ref.type}-${ref.id}`}
                          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-100">
                              {ref.label || ref.id}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${badgeClasses(ref.type)}`}>
                              {ref.type}
                            </span>
                          </div>
                          {typeof ref.score === "number" && (
                            <p className="mb-2 text-xs text-slate-500">score: {ref.score.toFixed(2)}</p>
                          )}
                          <p className="text-xs leading-5 text-slate-400">{ref.preview || "No preview available."}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-emerald-400" size={20} />
                    <h2 className="text-lg font-semibold text-white">Proposed Resolution</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Answer</p>
                      <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm leading-6 text-slate-200">
                        {detail.case.proposalSnapshot?.answer || "No proposal yet."}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Meta label="Action" value={detail.case.proposalSnapshot?.proposedActionType} />
                      <Meta label="Risk" value={detail.case.proposalSnapshot?.risk} />
                      <Meta label="Approval tier" value={detail.case.approvalTier} />
                      <Meta label="Proposal hash" value={detail.case.proposalHash} mono />
                    </div>
                    <Meta
                      label="Validation plan"
                      value={detail.case.proposalSnapshot?.validationPlan}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                  <h2 className="mb-2 text-lg font-semibold text-white">Approval Layer</h2>
                  <p className="mb-4 text-sm text-slate-400">
                    Requester bypass is a demo approval path. It is proposal-hash-bound and logged
                    explicitly in the audit trail.
                  </p>

                  {pendingApproval ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                        <p className="text-sm font-medium text-amber-200">
                          Pending approval: {pendingApproval.approvalTier}
                        </p>
                        <p className="mt-1 break-all text-xs text-amber-100/70">
                          proposalHash={pendingApproval.proposalHash}
                        </p>
                      </div>
                      <button
                        onClick={requesterBypass}
                        disabled={bypassing}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {bypassing ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <ShieldCheck size={16} />
                        )}
                        Approve as requester bypass
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                      No pending approval. Current case status is{" "}
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${badgeClasses(detail.case.status)}`}>
                        {detail.case.status}
                      </span>
                    </div>
                  )}

                  {detail.case.executionSnapshot && (
                    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="mb-2 text-sm font-medium text-white">Execution / validation</p>
                      <div className="space-y-2 text-sm text-slate-300">
                        <Meta label="Action" value={detail.case.executionSnapshot.actionType} />
                        <Meta
                          label="Validated"
                          value={String(Boolean(detail.case.executionSnapshot.validated))}
                        />
                        <Meta
                          label="Detail"
                          value={
                            detail.case.executionSnapshot.validationDetail ||
                            detail.case.executionSnapshot.error
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                <h2 className="mb-4 text-lg font-semibold text-white">Audit Trail</h2>
                <div className="space-y-3">
                  {detail.auditEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-sm text-slate-100">{event.eventType}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-4">
                        <span>actor: {event.actorType}</span>
                        <span className="truncate">id: {event.actorId || "system"}</span>
                        <span>tier: {event.approvalTier || "N/A"}</span>
                        <span>
                          confidence:{" "}
                          {typeof event.confidence === "number" ? event.confidence.toFixed(2) : "N/A"}
                        </span>
                      </div>
                      {event.policyDecision && (
                        <p className="mt-2 text-xs text-slate-500">{event.policyDecision}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-sm ${badgeClasses(value)}`}>
        {value}
      </p>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`break-words rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value || "N/A"}
      </p>
    </div>
  );
}

function HowItHappenedCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`inline-flex rounded-full border px-2.5 py-1 text-sm ${badgeClasses(value)}`}>
        {value}
      </p>
      {detail && <p className="mt-3 text-sm leading-6 text-slate-400">{detail}</p>}
    </div>
  );
}
