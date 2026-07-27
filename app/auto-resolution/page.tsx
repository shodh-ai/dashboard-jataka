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
import {
  presentAuditEvent,
  toneClasses,
  type AuditEventLike,
} from "./audit-presenter";
import { getApiErrorMessage } from "../lib/api-error";

const BASE_API =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;

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

type AuditEvent = AuditEventLike & {
  id: string;
  evidenceRefs?: EvidenceBundle | EvidenceRef[];
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
    actionInput?: {
      translationRequestId?: string;
      salesforceOperation?: "submit_for_review" | "authorize_publication";
    };
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
    const byKnowledgeBaseId = brains.find(
      (b) => b.knowledgeBaseId === activeBrainId,
    );
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
  return getApiErrorMessage(error, fallback);
}

function isResolvableProposal(actionType?: string) {
  return Boolean(
    actionType &&
    actionType !== "REQUEST_MORE_INFO" &&
    actionType !== "PREPARE_PATCH" &&
    actionType !== "DEPLOY_CHANGE",
  );
}

function describeSalesforceOperation(
  operation?: "submit_for_review" | "authorize_publication",
) {
  if (operation === "submit_for_review") {
    return "Submit translation draft for review in Salesforce";
  }
  if (operation === "authorize_publication") {
    return "Authorize publication in Salesforce";
  }
  return "Not specified";
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
  const [issueText, setIssueText] = useState("");
  const [salesforceCaseRef, setSalesforceCaseRef] = useState("");
  const [externalSystem, setExternalSystem] = useState<"salesforce" | "jira">(
    "salesforce",
  );
  const [loadedCaseLabel, setLoadedCaseLabel] = useState("");
  const [translationRequestId, setTranslationRequestId] = useState("");
  const [salesforceOperation, setSalesforceOperation] = useState<
    "" | "submit_for_review" | "authorize_publication"
  >("");
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [recentCases, setRecentCases] = useState<AutoResolutionCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [bypassing, setBypassing] = useState(false);
  const [error, setError] = useState("");
  const [evalSuites, setEvalSuites] = useState<
    Array<{ id: string; label: string; ticketCount: number }>
  >([]);
  const [evalSuiteId, setEvalSuiteId] = useState("all_l1");
  const [evalTickets, setEvalTickets] = useState<
    Array<{
      id: string;
      cloud: string;
      subject: string;
      functionalArea: string;
      priority: string;
      repoGrounded: boolean;
      linkedScenarioIds: string[];
    }>
  >([]);
  const [evalRunningId, setEvalRunningId] = useState("");
  const [evalResult, setEvalResult] = useState<{
    ticketId: string;
    caseId: string;
    status: string;
    supportLevel?: string | null;
    proposedAction?: string | null;
    requiresHuman: boolean;
    finalAnswer?: string | null;
    score: {
      passed: boolean;
      answerCoverage: number;
      mutationGuardOk: boolean;
      notes: string[];
    };
  } | null>(null);

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
      normalizeEvidenceBundle(
        getAuditEvent(detail, "EVIDENCE_RETRIEVED")?.evidenceRefs,
      ),
    [detail],
  );

  const classifiedEvent = useMemo(
    () => getAuditEvent(detail, "CLASSIFIED"),
    [detail],
  );
  const policyEvent = useMemo(
    () => getAuditEvent(detail, "POLICY_DECIDED"),
    [detail],
  );

  const proposedActionType = detail?.case.proposalSnapshot?.proposedActionType;
  const approvalWillExecuteExternalAction =
    isResolvableProposal(proposedActionType);

  function buildIntakePayload(issue: string) {
    const payload: Record<string, unknown> = {
      source: "PORTAL",
      curriculumId: activeKnowledgeBaseId,
    };

    if (salesforceCaseRef.trim()) {
      payload.externalSystem = externalSystem;
      payload.externalRecordId = salesforceCaseRef.trim();
      // Back-compat for older backends.
      if (externalSystem === "salesforce") {
        payload.salesforceCaseId = salesforceCaseRef.trim();
      }
    }
    if (issue.trim()) {
      payload.issueText = issue.trim();
    }

    const actionInput: Record<string, string> = {};
    if (translationRequestId.trim() && salesforceOperation) {
      actionInput.translationRequestId = translationRequestId.trim();
      actionInput.salesforceOperation = salesforceOperation;
    }
    if (Object.keys(actionInput).length > 0) {
      payload.actionInput = actionInput;
    }

    return payload;
  }

  async function loadFromSalesforceTicket() {
    const ref = salesforceCaseRef.trim();
    if (!ref) {
      setError(
        externalSystem === "salesforce"
          ? "Enter a Salesforce Case Id or Case Number."
          : "Enter an external record id.",
      );
      return;
    }
    setError("");
    setLoadingTicket(true);
    try {
      const data = await apiFetch(
        `/auto-resolution/external/${encodeURIComponent(externalSystem)}/records/${encodeURIComponent(ref)}${
          externalSystem === "salesforce" ? "?objectType=Case" : ""
        }`,
      );
      setIssueText(data.issueText || "");
      const record = data.record || data.case;
      setLoadedCaseLabel(
        record
          ? `Loaded ${externalSystem} ${record.objectType || "Case"} ${record.displayId || record.caseNumber || record.externalId || record.id}`
          : `Loaded ${externalSystem} record`,
      );
      if (record?.externalId || record?.id) {
        setSalesforceCaseRef(record.externalId || record.id);
      }
    } catch (e) {
      // Fall back to legacy Salesforce endpoint.
      if (externalSystem === "salesforce") {
        try {
          const data = await apiFetch(
            `/auto-resolution/salesforce/cases/${encodeURIComponent(ref)}`,
          );
          setIssueText(data.issueText || "");
          setLoadedCaseLabel(
            data.case
              ? `Loaded Case ${data.case.caseNumber} (${data.case.id}) · ${data.case.status}`
              : "Loaded Case",
          );
          if (data.case?.id) setSalesforceCaseRef(data.case.id);
          return;
        } catch (legacyError) {
          setError(
            getErrorMessage(legacyError, "Failed to load external record."),
          );
          return;
        }
      }
      setError(getErrorMessage(e, "Failed to load external record."));
    } finally {
      setLoadingTicket(false);
    }
  }

  async function apiFetch(path: string, options: RequestInit = {}) {
    if (!BASE_API)
      throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
    const token = await getToken();
    const res = await fetch(`${BASE_API}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        getApiErrorMessage(data, `Request failed (${res.status})`),
      );
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

  async function loadEvalSuites() {
    const data = await apiFetch("/auto-resolution/ticket-eval/suites");
    const suites = Array.isArray(data.suites) ? data.suites : [];
    setEvalSuites(suites);
    if (
      suites.length > 0 &&
      !suites.some((s: { id: string }) => s.id === evalSuiteId)
    ) {
      setEvalSuiteId(suites[0].id);
    }
  }

  async function loadEvalTickets(suiteId: string) {
    const data = await apiFetch(
      `/auto-resolution/ticket-eval/tickets?suite=${encodeURIComponent(suiteId)}`,
    );
    setEvalTickets(Array.isArray(data.tickets) ? data.tickets : []);
  }

  async function runEvalTicket(ticketId: string) {
    setError("");
    setEvalRunningId(ticketId);
    setEvalResult(null);
    try {
      const data = await apiFetch(
        `/auto-resolution/ticket-eval/tickets/${encodeURIComponent(ticketId)}/run`,
        {
          method: "POST",
          body: JSON.stringify({
            curriculumId: activeKnowledgeBaseId || undefined,
          }),
        },
      );
      setEvalResult({
        ticketId: data.ticket?.id || ticketId,
        caseId: data.caseId,
        status: data.status,
        supportLevel: data.supportLevel,
        proposedAction: data.proposedAction,
        requiresHuman: Boolean(data.requiresHuman),
        finalAnswer: data.finalAnswer,
        score: data.score,
      });
      if (data.caseId) {
        await loadCase(data.caseId);
        await loadRecentCases();
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to run ticket eval."));
    } finally {
      setEvalRunningId("");
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

        const brainsData = await apiFetch("/curriculum/list");
        const list = Array.isArray(brainsData.brains) ? brainsData.brains : [];
        setBrains(list);
        if (list.length > 0) {
          setActiveBrain(
            resolveKnowledgeBaseId(list, brainsData.activeBrainId),
          );
        }

        await loadRecentCases();
        await loadEvalSuites();
        await loadEvalTickets(evalSuiteId || "all_l1");
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Failed to load auto-resolution page."));
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !BASE_API || !evalSuiteId) return;
    loadEvalTickets(evalSuiteId).catch((e: unknown) => {
      setError(getErrorMessage(e, "Failed to load eval tickets."));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalSuiteId, isLoaded, isSignedIn]);

  async function raiseIssue() {
    if (!issueText.trim() && !salesforceCaseRef.trim()) {
      setError("Load a Salesforce Case or enter issue text.");
      return;
    }
    if (!activeKnowledgeBaseId) {
      setError("Select a brain before raising an issue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const queued = (await apiFetch("/auto-resolution/cases/async", {
        method: "POST",
        body: JSON.stringify(buildIntakePayload(issueText)),
      })) as { job_id: string };
      const deadline = Date.now() + 10 * 60 * 1000;
      let lastCaseId = "";

      while (Date.now() < deadline) {
        const status = (await apiFetch(
          `/auto-resolution/cases/async/${encodeURIComponent(queued.job_id)}`,
        )) as {
          case_id?: string;
          status: string;
          ready: boolean;
        };

        if (status.case_id) {
          lastCaseId = status.case_id;
          const current = await loadCase(status.case_id);
          if (status.ready) {
            await loadRecentCases();
            if (current.case.status === "FAILED") {
              setError(
                current.case.executionSnapshot?.error ||
                  "Auto-resolution failed. Open the case for details.",
              );
            }
            return;
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      throw new Error(
        lastCaseId
          ? "Auto-resolution is still running. Open the case from Recent Cases to continue tracking it."
          : "Auto-resolution did not start within ten minutes.",
      );
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
      const data = await apiFetch(
        `/auto-resolution/cases/${detail.case.id}/requester-bypass`,
        {
          method: "POST",
          body: JSON.stringify({
            proposalHash: detail.case.proposalHash,
            decisionNote: "Requester clicked dashboard master bypass.",
          }),
        },
      );
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

      <main className="min-w-0 flex-1 overflow-y-auto p-8">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2">
                <Sparkles className="text-blue-300" size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">
                  Auto Resolution Pipeline
                </h1>
                <p className="text-sm text-slate-400">
                  Feed an external ticket into the pipeline, inspect
                  classification and evidence, approve execution, and optionally
                  write the answer back.
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

          <section className="grid min-w-0 gap-6 lg:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Raise from ticket
                  </h2>
                  <p className="text-sm text-slate-400">
                    Choose a connected system and load a record. Issue text
                    comes from the ticket; resolution can post back through that
                    connector.
                  </p>
                </div>
                <FileText className="text-slate-500" size={22} />
              </div>

              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                External system
              </label>
              <select
                value={externalSystem}
                onChange={(e) =>
                  setExternalSystem(e.target.value as "salesforce" | "jira")
                }
                className="input select mb-4 w-full text-sm"
              >
                <option value="salesforce">Salesforce</option>
                <option value="jira">Jira</option>
              </select>

              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Brain / curriculum
              </label>
              <select
                value={activeBrain}
                onChange={(e) => setActiveBrain(e.target.value)}
                className="input select mb-4 w-full text-sm"
              >
                {brains.length === 0 ? (
                  <option value="">No brains found</option>
                ) : (
                  brains.map((brain) => (
                    <option
                      key={brain.knowledgeBaseId}
                      value={brain.knowledgeBaseId}
                    >
                      {brain.name || brain.knowledgeBaseId}
                    </option>
                  ))
                )}
              </select>

              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                {externalSystem === "salesforce"
                  ? "Salesforce Case Id or Case Number"
                  : "Jira issue key"}
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                <input
                  value={salesforceCaseRef}
                  onChange={(e) => {
                    setSalesforceCaseRef(e.target.value);
                    setLoadedCaseLabel("");
                  }}
                  className="input min-w-0 flex-1 text-sm"
                  placeholder="500… or 00001047"
                />
                <button
                  type="button"
                  onClick={loadFromSalesforceTicket}
                  disabled={loadingTicket || !salesforceCaseRef.trim()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingTicket ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCcw size={16} />
                  )}
                  Load ticket
                </button>
              </div>
              {loadedCaseLabel ? (
                <p className="mb-4 text-xs text-emerald-300/90">
                  {loadedCaseLabel}
                </p>
              ) : (
                <p className="mb-4 text-xs text-slate-500">
                  Works for any Case — no scenario-specific demos.
                </p>
              )}

              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Issue text (from ticket; editable)
              </label>
              <textarea
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                rows={6}
                className="input min-h-[9rem] w-full resize-y text-sm leading-6"
                placeholder={
                  externalSystem === "salesforce"
                    ? "Load a Salesforce Case to fill this from Subject + Description…"
                    : "Enter issue text or load an external record…"
                }
              />

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Optional: Knowledge translation mutation
                </p>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Translation request ID
                </label>
                <input
                  value={translationRequestId}
                  onChange={(e) => setTranslationRequestId(e.target.value)}
                  className="input mb-4 w-full text-sm"
                  placeholder="a0X..."
                />
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Salesforce operation
                </label>
                <select
                  value={salesforceOperation}
                  onChange={(e) =>
                    setSalesforceOperation(
                      e.target.value as
                        "" | "submit_for_review" | "authorize_publication",
                    )
                  }
                  className="input select w-full text-sm"
                >
                  <option value="">No translation action</option>
                  <option value="submit_for_review">
                    Submit draft for review
                  </option>
                  <option value="authorize_publication">
                    Authorize publication
                  </option>
                </select>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Only needed when approving a change to a
                  `Knowledge_Translation_Request__c` record. Case writeback uses
                  the Case Id above.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={raiseIssue}
                  disabled={
                    loading ||
                    !activeKnowledgeBaseId ||
                    (!issueText.trim() && !salesforceCaseRef.trim())
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
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

            <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Recent Cases
              </h2>
              <div className="space-y-3">
                {recentCases.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                    No cases yet. Raise an issue to start the pipeline.
                  </p>
                ) : (
                  recentCases.map((caseRow) => (
                    <button
                      key={caseRow.id}
                      onClick={() => loadCase(caseRow.id)}
                      className="w-full min-w-0 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-600"
                    >
                      <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
                        <span className="min-w-0 flex-1 text-sm font-medium leading-6 text-slate-200 line-clamp-2">
                          {caseRow.issueText}
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${badgeClasses(caseRow.status)}`}
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

          <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  L1 ticket eval suites
                </h2>
                <p className="text-sm text-slate-400">
                  Golden Sales/Service tickets from{" "}
                  <code className="text-slate-300">
                    salesforcetesting2/docs/tickets
                  </code>
                  . Runs through intake without Salesforce Case writeback.
                </p>
              </div>
              <ShieldCheck className="text-slate-500" size={22} />
            </div>

            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Suite
            </label>
            <select
              value={evalSuiteId}
              onChange={(e) => {
                setEvalSuiteId(e.target.value);
                setEvalResult(null);
              }}
              className="input select mb-4 w-full max-w-md text-sm"
            >
              {evalSuites.length === 0 ? (
                <option value="all_l1">All L1</option>
              ) : (
                evalSuites.map((suite) => (
                  <option key={suite.id} value={suite.id}>
                    {suite.label} ({suite.ticketCount})
                  </option>
                ))
              )}
            </select>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {evalTickets.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                  No eval tickets loaded for this suite.
                </p>
              ) : (
                evalTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                        {ticket.id}
                      </span>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                        {ticket.cloud}
                        {ticket.repoGrounded ? " · repo" : ""}
                      </span>
                    </div>
                    <p className="mb-2 text-sm font-medium leading-5 text-slate-200 line-clamp-2">
                      {ticket.subject}
                    </p>
                    <p className="mb-3 text-xs text-slate-500">
                      {ticket.functionalArea} · {ticket.priority}
                      {ticket.linkedScenarioIds?.length
                        ? ` · ${ticket.linkedScenarioIds.join(", ")}`
                        : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => runEvalTicket(ticket.id)}
                      disabled={
                        Boolean(evalRunningId) || !activeKnowledgeBaseId
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {evalRunningId === ticket.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      Run eval
                    </button>
                  </div>
                ))
              )}
            </div>

            {evalResult && (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    Result · {evalResult.ticketId}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      evalResult.score?.passed
                        ? "border-emerald-500/40 text-emerald-300"
                        : "border-amber-500/40 text-amber-200"
                    }`}
                  >
                    {evalResult.score?.passed ? "PASS" : "REVIEW"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {evalResult.status} · {evalResult.supportLevel || "—"} ·{" "}
                    {evalResult.proposedAction || "—"} · coverage{" "}
                    {Math.round((evalResult.score?.answerCoverage || 0) * 100)}%
                  </span>
                </div>
                {evalResult.finalAnswer ? (
                  <p className="mb-2 whitespace-pre-wrap text-sm leading-6 text-slate-300 line-clamp-6">
                    {evalResult.finalAnswer}
                  </p>
                ) : null}
                {evalResult.score?.notes?.length ? (
                  <ul className="mb-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                    {evalResult.score.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs text-slate-500">
                  Mutation guard:{" "}
                  {evalResult.score?.mutationGuardOk
                    ? "ok (no SF Case writeback)"
                    : "failed"}{" "}
                  · case {evalResult.caseId}
                </p>
              </div>
            )}
          </section>

          {detail && (
            <>
              <section className="grid gap-4 md:grid-cols-4">
                <SummaryCard label="Status" value={detail.case.status} />
                <SummaryCard
                  label="Category"
                  value={detail.case.supportLevel || "Pending"}
                />
                <SummaryCard
                  label="Intent"
                  value={detail.case.intent || "Pending"}
                />
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
                    <h2 className="text-lg font-semibold text-white">
                      Pipeline
                    </h2>
                    <p className="text-sm text-slate-400">
                      Case `{detail.case.id}` moving through intake, policy,
                      evidence, approval, execution, validation, and audit.
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
                        <p className="mt-1 line-clamp-3 text-xs text-slate-400">
                          {step.detail}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="text-blue-300" size={20} />
                  <h2 className="text-lg font-semibold text-white">
                    How It Happened
                  </h2>
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
                      detail.case.status === "RESOLVED" &&
                      detail.case.approvalTier === "AUTO_ANSWER"
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
                  <h2 className="text-lg font-semibold text-white">
                    Evidence Retrieval
                  </h2>
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
                          value={String(
                            evidenceBundle.snapshot.retrievalSummary
                              .qa_resolution_matches ?? 0,
                          )}
                        />
                        <SummaryCard
                          label="Vector hits"
                          value={String(
                            evidenceBundle.snapshot.retrievalSummary
                              .vector_hits ?? 0,
                          )}
                        />
                        <SummaryCard
                          label="Full files"
                          value={String(
                            evidenceBundle.snapshot.retrievalSummary
                              .full_files ?? 0,
                          )}
                        />
                        <SummaryCard
                          label="Graph deps"
                          value={String(
                            evidenceBundle.snapshot.retrievalSummary
                              .graph_dependencies ?? 0,
                          )}
                        />
                        <SummaryCard
                          label="Jira context"
                          value={String(
                            evidenceBundle.snapshot.retrievalSummary
                              .jira_context ?? 0,
                          )}
                        />
                        <SummaryCard
                          label="Concepts"
                          value={String(
                            evidenceBundle.snapshot.retrievalSummary.concepts ??
                              0,
                          )}
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
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs ${badgeClasses(ref.type)}`}
                            >
                              {ref.type}
                            </span>
                          </div>
                          {typeof ref.score === "number" && (
                            <p className="mb-2 text-xs text-slate-500">
                              score: {ref.score.toFixed(2)}
                            </p>
                          )}
                          <p className="text-xs leading-5 text-slate-400">
                            {ref.preview || "No preview available."}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="grid min-w-0 gap-6 lg:grid-cols-2">
                <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-emerald-400" size={20} />
                    <h2 className="text-lg font-semibold text-white">
                      Proposed Resolution
                    </h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                        Answer
                      </p>
                      <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm leading-6 text-slate-200">
                        {detail.case.proposalSnapshot?.answer ||
                          "No proposal yet."}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Meta
                        label="Action"
                        value={detail.case.proposalSnapshot?.proposedActionType}
                      />
                      <Meta
                        label="Risk"
                        value={detail.case.proposalSnapshot?.risk}
                      />
                      <Meta
                        label="Approval tier"
                        value={detail.case.approvalTier}
                      />
                      <Meta
                        label="Proposal hash"
                        value={detail.case.proposalHash}
                        mono
                      />
                    </div>
                    {detail.case.proposalSnapshot?.actionInput
                      ?.translationRequestId && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Meta
                          label="Salesforce record"
                          value={
                            detail.case.proposalSnapshot.actionInput
                              .translationRequestId
                          }
                          mono
                        />
                        <Meta
                          label="Salesforce operation"
                          value={describeSalesforceOperation(
                            detail.case.proposalSnapshot.actionInput
                              .salesforceOperation,
                          )}
                        />
                      </div>
                    )}
                    <Meta
                      label="Validation plan"
                      value={detail.case.proposalSnapshot?.validationPlan}
                    />
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                  <h2 className="mb-2 text-lg font-semibold text-white">
                    Approval Layer
                  </h2>
                  <p className="mb-4 text-sm text-slate-400">
                    Requester bypass is a demo approval path. It is
                    proposal-hash-bound and logged explicitly in the audit
                    trail.
                  </p>

                  {pendingApproval && !approvalWillExecuteExternalAction && (
                    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                      Approving this case will <strong>not</strong> change
                      Salesforce or your codebase. It will hand the issue to a
                      human for follow-up.
                    </div>
                  )}

                  {pendingApproval && approvalWillExecuteExternalAction && (
                    <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                      Approving this case will run the proposed external action
                      and only mark the case resolved if Salesforce validation
                      succeeds.
                    </div>
                  )}

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
                        {approvalWillExecuteExternalAction
                          ? "Approve and run Salesforce action"
                          : "Approve for human follow-up"}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                      No pending approval. Current case status is{" "}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${badgeClasses(detail.case.status)}`}
                      >
                        {detail.case.status}
                      </span>
                    </div>
                  )}

                  {detail.case.executionSnapshot && (
                    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="mb-2 text-sm font-medium text-white">
                        Execution / validation
                      </p>
                      <div className="space-y-2 text-sm text-slate-300">
                        <Meta
                          label="Action"
                          value={detail.case.executionSnapshot.actionType}
                        />
                        <Meta
                          label="Validated"
                          value={String(
                            Boolean(detail.case.executionSnapshot.validated),
                          )}
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
                <div className="mb-2">
                  <h2 className="text-lg font-semibold text-white">
                    What Happened
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    A plain-language timeline of every step taken on this case.
                  </p>
                </div>
                <div className="mt-5 space-y-0">
                  {detail.auditEvents.map((event, index) => (
                    <AuditTrailItem
                      key={event.id}
                      event={event}
                      step={index + 1}
                      isLast={index === detail.auditEvents.length - 1}
                    />
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
      <p
        className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-sm ${badgeClasses(value)}`}
      >
        {value}
      </p>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
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
      <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p
        className={`inline-flex rounded-full border px-2.5 py-1 text-sm ${badgeClasses(value)}`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-3 text-sm leading-6 text-slate-400">{detail}</p>
      )}
    </div>
  );
}

function AuditTrailItem({
  event,
  step,
  isLast,
}: {
  event: AuditEvent;
  step: number;
  isLast: boolean;
}) {
  const presentation = presentAuditEvent(event);
  const tone = toneClasses(presentation.tone);
  const Icon = presentation.icon;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${tone.ring}`}
        >
          <Icon size={18} className={tone.icon} />
        </div>
        {!isLast && <div className="mt-2 w-px flex-1 bg-slate-800" />}
      </div>

      <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Step {step}
            </p>
            <h3 className="text-base font-semibold text-white">
              {presentation.title}
            </h3>
          </div>
          <time className="shrink-0 text-xs text-slate-500">
            {new Date(event.createdAt).toLocaleString()}
          </time>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          {presentation.summary}
        </p>

        {presentation.chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {presentation.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        <details className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
            Technical details
          </summary>
          <div className="mt-2 space-y-1 font-mono text-[11px] leading-5 text-slate-500">
            <p>event: {event.eventType}</p>
            <p>actor: {event.actorType}</p>
            {event.actorId && <p>actor id: {event.actorId}</p>}
            {event.approvalTier && <p>approval tier: {event.approvalTier}</p>}
            {typeof event.confidence === "number" && (
              <p>confidence: {event.confidence.toFixed(2)}</p>
            )}
            {event.supportLevel && <p>support level: {event.supportLevel}</p>}
            {event.intent && <p>intent: {event.intent}</p>}
            {event.policyDecision && <p>note: {event.policyDecision}</p>}
          </div>
        </details>
      </div>
    </div>
  );
}
