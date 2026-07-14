import type { AuditEventLike } from "./audit-presenter";

export type EvidenceRef = {
  type: string;
  id: string;
  label?: string;
  score?: number;
  preview?: string;
  metadata?: Record<string, unknown>;
};

export type EvidenceBundle = {
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

export type Brain = {
  id: string;
  name?: string;
  knowledgeBaseId: string;
};

export type PipelineStep = {
  id: string;
  label: string;
  status: "complete" | "pending";
  detail?: string;
};

export type Approval = {
  id: string;
  status: string;
  approvalTier: string;
  proposalHash: string;
  requestedAt: string;
};

export type AuditEvent = AuditEventLike & {
  id: string;
  evidenceRefs?: EvidenceBundle | EvidenceRef[];
};

export type AutoResolutionCase = {
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
      connectorId?: string;
      capability?: string;
      externalRef?: {
        system?: string;
        objectType?: string;
        externalId?: string;
        displayId?: string;
      };
      translationRequestId?: string;
      salesforceOperation?: "submit_for_review" | "authorize_publication";
      salesforceCaseId?: string;
      jiraTicketKey?: string;
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
    externalMutated?: boolean;
    externalProof?: Record<string, unknown>;
  };
  externalRefs?: Array<{
    system?: string;
    objectType?: string;
    externalId?: string;
    displayId?: string;
  }>;
  auditDegraded?: boolean;
  createdAt: string;
  resolvedAt?: string;
};

export type CaseDetail = {
  case: AutoResolutionCase;
  approvals: Approval[];
  auditEvents: AuditEvent[];
  steps: PipelineStep[];
};

export function resolveKnowledgeBaseId(brains: Brain[], activeBrainId?: string) {
  if (!brains.length) return "";
  if (activeBrainId) {
    const byKnowledgeBaseId = brains.find((b) => b.knowledgeBaseId === activeBrainId);
    if (byKnowledgeBaseId) return byKnowledgeBaseId.knowledgeBaseId;
    const byId = brains.find((b) => b.id === activeBrainId);
    if (byId) return byId.knowledgeBaseId;
  }
  return brains[0].knowledgeBaseId;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function statusTone(value?: string) {
  if (!value) return "neutral";
  if (["RESOLVED", "AUTO_ANSWER", "L1", "complete", "APPROVED"].includes(value)) {
    return "success";
  }
  if (["PENDING_APPROVAL", "HUMAN_ONLY", "L2", "pending", "CUSTOMER_CONFIRM"].includes(value)) {
    return "warning";
  }
  if (["FAILED", "REJECTED", "ESCALATED", "L3", "EXECUTION_FAILED"].includes(value)) {
    return "danger";
  }
  return "info";
}

export function statusBadgeClasses(value?: string) {
  const tone = statusTone(value);
  if (tone === "success") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (tone === "warning") return "bg-amber-500/10 text-amber-300 border-amber-500/30";
  if (tone === "danger") return "bg-red-500/10 text-red-300 border-red-500/30";
  if (tone === "info") return "bg-blue-500/10 text-blue-300 border-blue-500/30";
  return "bg-slate-800 text-slate-300 border-slate-700";
}

export function clientStatusLabel(status?: string) {
  switch (status) {
    case "RESOLVED":
      return "Resolved";
    case "PENDING_APPROVAL":
      return "Awaiting review";
    case "ESCALATED":
      return "With support";
    case "FAILED":
      return "Needs attention";
    case "RECEIVED":
    case "CLASSIFYING":
    case "IN_PROGRESS":
      return "Working on it";
    default:
      return status?.replaceAll("_", " ") || "Open";
  }
}

/** Rough client-facing ETA from status + support level + approval tier. */
export function estimateResolutionTime(caseRow?: Pick<
  AutoResolutionCase,
  "status" | "supportLevel" | "approvalTier" | "resolvedAt"
>) {
  if (!caseRow) {
    return { label: "Usually under 2 minutes", detail: "Most how-to questions resolve instantly." };
  }
  if (caseRow.status === "RESOLVED" || caseRow.resolvedAt) {
    return { label: "Done", detail: "This request is complete." };
  }
  if (caseRow.approvalTier === "AUTO_ANSWER") {
    return { label: "~1–2 min", detail: "Safe auto-answer path." };
  }
  if (caseRow.status === "PENDING_APPROVAL") {
    if (caseRow.supportLevel === "L1" || caseRow.approvalTier === "CUSTOMER_CONFIRM") {
      return { label: "~15–30 min", detail: "Waiting on a quick human confirm." };
    }
    if (caseRow.supportLevel === "L2" || caseRow.approvalTier === "INTERNAL_APPROVAL") {
      return { label: "~1–2 hours", detail: "Support is reviewing the proposed fix." };
    }
    return { label: "~4–8 hours", detail: "Needs admin or dual approval." };
  }
  if (caseRow.status === "ESCALATED" || caseRow.approvalTier === "HUMAN_ONLY") {
    return { label: "~1 business day", detail: "A person on your team will handle this." };
  }
  return { label: "~2–5 min", detail: "Pipeline is classifying and gathering evidence." };
}

export function isResolvableProposal(actionType?: string) {
  return Boolean(
    actionType &&
      actionType !== "REQUEST_MORE_INFO" &&
      actionType !== "PREPARE_PATCH" &&
      actionType !== "DEPLOY_CHANGE",
  );
}

export function truncateIssue(text: string, max = 72) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}
