import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Inbox,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCheck,
  XCircle,
} from "lucide-react";

export type AuditEventLike = {
  eventType: string;
  actorType: string;
  actorId?: string;
  policyDecision?: string;
  approvalTier?: string;
  confidence?: number;
  supportLevel?: string;
  intent?: string;
  createdAt: string;
};

type AuditPresentation = {
  title: string;
  summary: string;
  icon: LucideIcon;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  chips: string[];
};

const EVENT_PRESENTATION: Record<
  string,
  Omit<AuditPresentation, "chips"> & { getSummary?: (event: AuditEventLike) => string }
> = {
  RECEIVED: {
    title: "Issue submitted",
    summary: "Your question was received and added to the support queue.",
    icon: Inbox,
    tone: "info",
  },
  CLASSIFIED: {
    title: "Issue understood",
    summary: "We identified what kind of help is needed.",
    icon: Tags,
    tone: "info",
    getSummary: (event) => {
      const parts: string[] = ["We identified what kind of help is needed."];
      if (event.supportLevel) {
        parts.push(`Complexity: ${describeSupportLevel(event.supportLevel)}.`);
      }
      if (event.intent) {
        parts.push(`Type: ${describeIntent(event.intent)}.`);
      }
      return parts.join(" ");
    },
  },
  EVIDENCE_RETRIEVED: {
    title: "Documentation searched",
    summary: "We searched your knowledge base and related records for relevant answers.",
    icon: Search,
    tone: "info",
  },
  PROPOSAL_CREATED: {
    title: "Recommended solution prepared",
    summary: "A draft answer or recommended next step was prepared for review.",
    icon: FileText,
    tone: "info",
  },
  POLICY_DECIDED: {
    title: "Safety rules applied",
    summary: "We checked your account settings to decide how this issue should be handled.",
    icon: ShieldCheck,
    tone: "neutral",
    getSummary: (event) => {
      if (event.approvalTier) {
        return `${describeApprovalTier(event.approvalTier)} ${humanizePolicyDecision(event.policyDecision)}`.trim();
      }
      return humanizePolicyDecision(event.policyDecision) || "We checked your account settings to decide how this issue should be handled.";
    },
  },
  APPROVAL_REQUESTED: {
    title: "Waiting for a person to review",
    summary: "This case needs human approval before we can proceed.",
    icon: UserCheck,
    tone: "warning",
  },
  APPROVED: {
    title: "Review approved",
    summary: "A reviewer approved the recommended solution.",
    icon: UserCheck,
    tone: "success",
  },
  REJECTED: {
    title: "Review declined",
    summary: "A reviewer did not approve the recommended solution.",
    icon: XCircle,
    tone: "danger",
  },
  EXECUTED: {
    title: "Solution applied",
    summary: "The approved action was carried out.",
    icon: Play,
    tone: "success",
  },
  EXECUTION_FAILED: {
    title: "Action could not be completed",
    summary: "We tried to apply the solution but something went wrong.",
    icon: AlertTriangle,
    tone: "danger",
  },
  VALIDATED: {
    title: "Outcome checked",
    summary: "We verified whether the solution worked as expected.",
    icon: CheckCircle2,
    tone: "success",
  },
  RESOLVED: {
    title: "Issue closed",
    summary: "This case is complete.",
    icon: Sparkles,
    tone: "success",
  },
  ESCALATED: {
    title: "Passed to your support team",
    summary: "This issue needs hands-on help from a person on your team.",
    icon: AlertTriangle,
    tone: "warning",
  },
};

const POLICY_CODE_TRANSLATIONS: Record<string, string> = {
  answered: "Relevant information was found in your documentation.",
  no_curriculum_configured: "No knowledge base is linked, so documentation could not be searched.",
  low_confidence_score: "Available information was not strong enough to answer automatically.",
  brum_url_not_configured: "The documentation search service is not configured yet.",
  brum_request_failed: "The documentation search service could not be reached.",
};

export function describeSupportLevel(level?: string) {
  switch (level) {
    case "L1":
      return "Simple question";
    case "L2":
      return "Troubleshooting";
    case "L3":
      return "Complex issue";
    case "HUMAN_ONLY":
      return "Needs a person";
    default:
      return level || "Unknown";
  }
}

export function describeIntent(intent?: string) {
  switch (intent) {
    case "LOOKUP":
      return "Information lookup";
    case "HOW_TO":
      return "How-to guidance";
    case "DIAGNOSIS":
      return "Problem diagnosis";
    case "CHANGE_REQUEST":
      return "Change request";
    case "DATA_ACTION":
      return "Data update";
    case "INCIDENT":
      return "Incident";
    case "UNSUPPORTED":
      return "Not supported automatically";
    default:
      return intent || "General";
  }
}

export function describeApprovalTier(tier?: string) {
  switch (tier) {
    case "AUTO_ANSWER":
      return "Safe to answer automatically.";
    case "CUSTOMER_CONFIRM":
      return "Customer confirmation is required before proceeding.";
    case "INTERNAL_APPROVAL":
      return "An internal reviewer must approve this.";
    case "CUSTOMER_ADMIN_APPROVAL":
      return "An account administrator must approve this.";
    case "DUAL_APPROVAL":
      return "Two separate approvals are required.";
    case "HUMAN_ONLY":
      return "A human must handle this case.";
    default:
      return tier ? `${tier.replaceAll("_", " ").toLowerCase()}.` : "";
  }
}

export function describeActor(actorType?: string, actorId?: string) {
  switch (actorType) {
    case "customer":
      return actorId ? `Submitted by customer (${shortId(actorId)})` : "Submitted by customer";
    case "internal_user":
      return actorId ? `Support team member (${shortId(actorId)})` : "Support team member";
    case "customer_admin":
      return actorId ? `Account administrator (${shortId(actorId)})` : "Account administrator";
    case "system":
    default:
      return "Handled automatically by Jataka";
  }
}

export function describeConfidence(confidence?: number) {
  if (typeof confidence !== "number") return undefined;
  const percent = Math.round(confidence * 100);
  if (confidence >= 0.85) return `High confidence (${percent}%)`;
  if (confidence >= 0.65) return `Moderate confidence (${percent}%)`;
  return `Low confidence (${percent}%)`;
}

export function humanizePolicyDecision(value?: string) {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  if (POLICY_CODE_TRANSLATIONS[trimmed]) {
    return POLICY_CODE_TRANSLATIONS[trimmed];
  }

  if (/^Support level .+ is not enabled/i.test(trimmed)) {
    return "This type of issue is not enabled for automatic handling on your account.";
  }
  if (/^Intent .+ is not in this customer's allowed intent list/i.test(trimmed)) {
    return "This kind of request is not enabled for automatic handling on your account.";
  }
  if (/^Source .+ is not enabled/i.test(trimmed)) {
    return "Issues from this channel are not enabled for automatic handling on your account.";
  }
  if (/^Action .+ is outside this customer's approved execution catalog/i.test(trimmed)) {
    return "The proposed action is not on your approved automation list.";
  }
  if (/^Action .+ has no automated executor yet/i.test(trimmed)) {
    return "We prepared a recommendation, but this action still needs a person to complete it.";
  }
  if (/^Evidence confidence .+ is below this customer's minimum/i.test(trimmed)) {
    return "We were not confident enough in the available information to proceed automatically.";
  }
  if (/^Resolved via action catalog floor/i.test(trimmed)) {
    return "Your account rules determined the safest approval level for this action.";
  }
  if (/^Text asks a procedural how-to question/i.test(trimmed)) {
    return "This looks like a how-to question.";
  }
  if (/^Text asks a factual lookup question/i.test(trimmed)) {
    return "This looks like a straightforward information request.";
  }

  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

export function presentAuditEvent(event: AuditEventLike): AuditPresentation {
  const base = EVENT_PRESENTATION[event.eventType] || {
    title: "System update",
    summary: "Something changed on this case.",
    icon: FileText,
    tone: "neutral" as const,
  };

  const chips = [describeActor(event.actorType, event.actorId)];
  const confidence = describeConfidence(event.confidence);
  if (confidence) chips.push(confidence);
  if (event.approvalTier && event.eventType !== "POLICY_DECIDED") {
    chips.push(describeApprovalTier(event.approvalTier).replace(/\.$/, ""));
  }

  const policyDetail = humanizePolicyDecision(event.policyDecision);
  let summary = base.getSummary?.(event) || base.summary;
  if (policyDetail && event.eventType !== "POLICY_DECIDED") {
    summary = `${summary} ${policyDetail}`;
  }

  return {
    title: base.title,
    summary: summary.trim(),
    icon: base.icon,
    tone: base.tone,
    chips: chips.filter(Boolean),
  };
}

function shortId(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}…`;
}

export function toneClasses(tone: AuditPresentation["tone"]) {
  switch (tone) {
    case "success":
      return {
        icon: "text-emerald-300",
        ring: "border-emerald-500/30 bg-emerald-500/10",
      };
    case "warning":
      return {
        icon: "text-amber-300",
        ring: "border-amber-500/30 bg-amber-500/10",
      };
    case "danger":
      return {
        icon: "text-red-300",
        ring: "border-red-500/30 bg-red-500/10",
      };
    case "info":
      return {
        icon: "text-blue-300",
        ring: "border-blue-500/30 bg-blue-500/10",
      };
    default:
      return {
        icon: "text-slate-300",
        ring: "border-slate-700 bg-slate-900/70",
      };
  }
}
