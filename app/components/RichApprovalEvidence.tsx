"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Fingerprint,
  FlaskConical,
  MessageSquareText,
  Network,
  ShieldCheck,
  Video,
  XCircle,
} from "lucide-react";
import { BlastRadiusVisualizer } from "./GraphVisualizer";
import type {
  AstTransformationEvidence,
  NormalizedRichApprovalEvidence,
} from "../auto-resolution/types";

const LARGE_GRAPH_NODE_LIMIT = 50;

export type ApprovalEvidenceGateInput = {
  supportLevel?: string;
  actionType?: string;
  approvalProposalHash?: string;
  caseProposalHash?: string;
  evidence?: NormalizedRichApprovalEvidence;
};

export type ApprovalEvidenceGate = {
  required: boolean;
  allowed: boolean;
  reasons: string[];
};

export function evaluateApprovalEvidence({
  supportLevel,
  actionType,
  approvalProposalHash,
  caseProposalHash,
  evidence,
}: ApprovalEvidenceGateInput): ApprovalEvidenceGate {
  const required = supportLevel === "L3" || actionType === "PREPARE_PATCH";
  if (!required) return { required, allowed: true, reasons: [] };

  const reasons: string[] = [];
  if (!evidence) {
    return {
      required,
      allowed: false,
      reasons: ["Rich approval evidence is missing."],
    };
  }

  if (
    evidence.requirements.astDiff !== false &&
    (!evidence.astTransformation?.kind ||
      !["ast_transformation", "metadata_transformation"].includes(
        evidence.astTransformation.kind,
      ) ||
      !evidence.astTransformation.beforeHash ||
      !evidence.astTransformation.afterHash)
  ) {
    reasons.push("A hash-bound deterministic transformation is missing.");
  }
  if (
    evidence.requirements.blastRadius !== false &&
    (!evidence.blastRadius || evidence.blastRadius.nodes.length === 0)
  ) {
    reasons.push("Blast-radius evidence is missing.");
  }
  if (
    evidence.requirements.causalProof !== false &&
    evidence.causalProof?.status !== "PROVEN" &&
    evidence.causalProof?.status !== "PARTIAL"
  ) {
    reasons.push("The proposed change is not causally proven.");
  }
  if (
    evidence.requirements.tee === true &&
    evidence.teeAttestation?.status !== "VERIFIED"
  ) {
    reasons.push("Required TEE attestation is not verified.");
  }
  if (
    evidence.requirements.deltaBox === true &&
    evidence.sandbox?.status !== "PASSED" &&
    !evidence.sandbox?.video?.url
  ) {
    reasons.push("Required DeltaBox sandbox or video evidence is missing.");
  }

  if (
    approvalProposalHash &&
    caseProposalHash &&
    approvalProposalHash !== caseProposalHash
  ) {
    reasons.push("Proposal hash binding is stale or mismatched.");
  }
  if (
    evidence.proposalHash &&
    approvalProposalHash &&
    evidence.proposalHash !== approvalProposalHash
  ) {
    reasons.push("Evidence is bound to a different proposal hash.");
  }
  if (
    evidence.verification?.proposalHash &&
    approvalProposalHash &&
    evidence.verification.proposalHash !== approvalProposalHash
  ) {
    reasons.push("Verification is bound to a different proposal hash.");
  }
  if (
    evidence.verification?.evidenceHash &&
    evidence.evidenceHash &&
    evidence.verification.evidenceHash !== evidence.evidenceHash
  ) {
    reasons.push("Verification is bound to a different evidence hash.");
  }
  if (
    evidence.verification &&
    (evidence.verification.verified === false ||
      ["STALE", "FAILED"].includes(evidence.verification.status))
  ) {
    reasons.push(
      `Evidence verification is ${evidence.verification.status.toLowerCase()}.`,
    );
  }
  if (
    evidence.requirements.hashBinding === true &&
    (!approvalProposalHash || !caseProposalHash)
  ) {
    reasons.push("Required proposal hash binding is incomplete.");
  }

  return { required, allowed: reasons.length === 0, reasons };
}

export default function RichApprovalEvidence({
  evidence,
  gate,
  finalized = false,
  originalIntent,
}: {
  evidence?: NormalizedRichApprovalEvidence;
  gate?: ApprovalEvidenceGate;
  finalized?: boolean;
  originalIntent?: string;
}) {
  if (!evidence) {
    return (
      <EvidenceSection title="Approval evidence" icon={AlertTriangle}>
        <p className="text-sm text-slate-300">
          {gate?.required
            ? "Required rich approval evidence was not supplied for this proposal."
            : "L3 deployment artifacts are not required for this read-only or human-handoff proposal."}
        </p>
      </EvidenceSection>
    );
  }

  const isReadOnlyDiagnostic =
    !gate?.required && Boolean(evidence.liveDiagnostic);
  const graphIsLarge =
    Boolean(evidence.blastRadius) &&
    (evidence.blastRadius!.nodes.length > LARGE_GRAPH_NODE_LIMIT ||
      (evidence.blastRadius!.totalNodes || 0) > LARGE_GRAPH_NODE_LIMIT);

  return (
    <div className="space-y-4" data-testid="rich-approval-evidence">
      <div className="flex flex-wrap gap-2">
        {evidence.proposalHash && (
          <HashBadge label="Proposal hash" value={evidence.proposalHash} />
        )}
        {evidence.evidenceHash && (
          <HashBadge label="Evidence hash" value={evidence.evidenceHash} />
        )}
        {finalized ? (
          <StatusBadge label="Evidence hash-bound" good />
        ) : evidence.verification ? (
          <StatusBadge
            label={`Evidence ${evidence.verification.status.toLowerCase()}`}
            good={
              evidence.verification.status === "VERIFIED" &&
              evidence.verification.verified === true
            }
          />
        ) : null}
      </div>

      {!finalized && gate?.required && !gate.allowed && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100"
        >
          <p className="text-sm font-semibold">
            Approval blocked by evidence gate
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {gate.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <EvidenceSection title="Original Slack intent" icon={MessageSquareText}>
        {originalIntent?.trim() ? (
          <blockquote className="border-l-2 border-cyan-400/70 pl-4 text-sm leading-6 text-slate-200 whitespace-pre-wrap">
            {originalIntent}
          </blockquote>
        ) : (
          <Unavailable />
        )}
      </EvidenceSection>

      {isReadOnlyDiagnostic && evidence.liveDiagnostic ? (
        <EvidenceSection title="Live read-only diagnostic" icon={FlaskConical}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge label="Observed in Salesforce" good />
              <StatusBadge
                label={
                  evidence.liveDiagnostic.readOnly
                    ? "Read only"
                    : "Mutation capable"
                }
                good={evidence.liveDiagnostic.readOnly}
              />
            </div>
            <p className="text-sm leading-6 text-slate-200">
              {evidence.liveDiagnostic.summary}
            </p>
            <p className="font-mono text-[10px] text-slate-500">
              mode {evidence.liveDiagnostic.mode} · observed{" "}
              {new Date(evidence.liveDiagnostic.observedAt).toLocaleString()}
            </p>
            {evidence.liveDiagnostic.findings !== undefined && (
              <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-300">
                {JSON.stringify(evidence.liveDiagnostic.findings, null, 2)}
              </pre>
            )}
          </div>
        </EvidenceSection>
      ) : (
        <>
          <EvidenceSection title="Blast radius" icon={Network}>
            {!evidence.blastRadius ? (
              <Unavailable />
            ) : graphIsLarge ? (
              <LargeGraphFallback graph={evidence.blastRadius} />
            ) : (
              <BlastRadiusVisualizer graph={evidence.blastRadius} />
            )}
          </EvidenceSection>

          <EvidenceSection
            title={
              evidence.astTransformation?.kind === "metadata_transformation"
                ? "Salesforce metadata transformation"
                : "AST transformation"
            }
            icon={FileCode2}
          >
            {evidence.astTransformation ? (
              <TransformationDiff transformation={evidence.astTransformation} />
            ) : (
              <Unavailable />
            )}
          </EvidenceSection>

          <EvidenceSection title="Causal status" icon={ShieldCheck}>
            {evidence.causalProof ? (
              <div>
                <StatusBadge
                  label={
                    evidence.causalProof.status === "PROVEN"
                      ? "Causally proven"
                      : "Not proven"
                  }
                  good={evidence.causalProof.status === "PROVEN"}
                />
                {evidence.causalProof.claim && (
                  <p className="mt-3 text-sm text-slate-200">
                    {evidence.causalProof.claim}
                  </p>
                )}
                {evidence.causalProof.proof && (
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {evidence.causalProof.proof}
                  </p>
                )}
                <ListBlock
                  title="Assumptions"
                  items={evidence.causalProof.assumptions}
                />
                <ListBlock
                  title="Limitations"
                  items={evidence.causalProof.limitations || []}
                />
                <ListBlock
                  title="Identified causes"
                  items={(evidence.causalProof.causes || []).map(
                    (cause) =>
                      `${cause.label} (${Math.round(cause.confidence * 100)}%)`,
                  )}
                />
              </div>
            ) : (
              <p className="text-sm font-medium text-red-300">
                Not proven — no causal proof supplied.
              </p>
            )}
          </EvidenceSection>

          <EvidenceSection title="Sandbox validation" icon={FlaskConical}>
            {!evidence.sandbox ? (
              <Unavailable />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={`Sandbox ${evidence.sandbox.status.toLowerCase()}`}
                    good={evidence.sandbox.status === "PASSED"}
                  />
                  {evidence.sandbox.environment && (
                    <span className="text-xs text-slate-500">
                      {evidence.sandbox.environment}
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
                  {evidence.sandbox.tests.map((test) => (
                    <li
                      key={test.id || test.name}
                      className="flex gap-3 px-3 py-2 text-xs"
                    >
                      {test.status === "PASSED" ? (
                        <CheckCircle2
                          size={14}
                          className="shrink-0 text-emerald-400"
                        />
                      ) : test.status === "FAILED" ? (
                        <XCircle size={14} className="shrink-0 text-red-400" />
                      ) : (
                        <AlertTriangle
                          size={14}
                          className="shrink-0 text-amber-400"
                        />
                      )}
                      <span className="flex-1 text-slate-200">{test.name}</span>
                      {typeof test.durationMs === "number" && (
                        <span className="font-mono text-slate-500">
                          {test.durationMs} ms
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {evidence.sandbox.video && (
                  <SecureEvidenceVideo video={evidence.sandbox.video} />
                )}
                {evidence.sandboxVideoReason && (
                  <p className="text-xs text-slate-500">
                    Sandbox video:{" "}
                    {evidence.sandboxVideoReason.replaceAll("_", " ")}
                  </p>
                )}
              </div>
            )}
          </EvidenceSection>

          <EvidenceSection title="TEE and audit binding" icon={Fingerprint}>
            {!evidence.teeAttestation ? (
              <Unavailable />
            ) : (
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={`TEE ${evidence.teeAttestation.status.toLowerCase()}`}
                  good={evidence.teeAttestation.status === "VERIFIED"}
                />
                <HashBadge
                  label="Quote hash"
                  value={evidence.teeAttestation.quoteHash}
                />
                {evidence.teeAttestation.auditLogHash && (
                  <HashBadge
                    label="Audit hash"
                    value={evidence.teeAttestation.auditLogHash}
                  />
                )}
              </div>
            )}
          </EvidenceSection>
        </>
      )}
    </div>
  );
}

function EvidenceSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Network;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Icon size={15} />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function HashBadge({ label, value }: { label: string; value?: string }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-300"
      title={value || `${label} unavailable`}
    >
      <Fingerprint size={11} aria-hidden />
      {label}:{" "}
      {value
        ? `${value.slice(0, 12)}${value.length > 12 ? "…" : ""}`
        : "missing"}
    </span>
  );
}

function StatusBadge({ label, good }: { label: string; good: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        good
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      {good ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {label}
    </span>
  );
}

function TransformationDiff({
  transformation,
}: {
  transformation: AstTransformationEvidence;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-300">
          {transformation.filePath}
        </span>
        <div className="flex flex-wrap gap-2">
          <HashBadge label="Before" value={transformation.beforeHash} />
          <HashBadge label="After" value={transformation.afterHash} />
        </div>
      </div>
      <div className="grid overflow-hidden rounded-xl border border-slate-800 lg:grid-cols-2">
        <CodePanel label="Before" code={transformation.before} tone="removed" />
        <CodePanel label="After" code={transformation.after} tone="added" />
      </div>
      {transformation.operations && transformation.operations.length > 0 && (
        <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            {transformation.kind === "metadata_transformation"
              ? "Deterministic metadata operations"
              : "Deterministic AST instructions"}
          </p>
          <pre className="max-h-56 overflow-auto text-xs leading-5 text-slate-300">
            {JSON.stringify(transformation.operations, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function CodePanel({
  label,
  code,
  tone,
}: {
  label: string;
  code: string;
  tone: "added" | "removed";
}) {
  return (
    <div className="min-w-0 border-slate-800 lg:border-r last:lg:border-r-0">
      <div className="border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <pre
        className={`max-h-80 overflow-auto p-3 text-xs leading-5 ${
          tone === "added" ? "bg-emerald-950/10" : "bg-red-950/10"
        }`}
      >
        <code>{highlightCode(code)}</code>
      </pre>
    </div>
  );
}

function highlightCode(code: string) {
  const tokenPattern =
    /(\b(?:class|function|const|let|var|return|if|else|for|while|public|private|static|new|true|false|null)\b|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\/\/.*$)/gm;
  return code.split(tokenPattern).map((token, index) => {
    const isKeyword =
      /^(class|function|const|let|var|return|if|else|for|while|public|private|static|new|true|false|null)$/.test(
        token,
      );
    const isComment = token.startsWith("//");
    const isString = /^["']/.test(token);
    return (
      <span
        key={`${index}-${token.slice(0, 8)}`}
        className={
          isKeyword
            ? "text-purple-300"
            : isComment
              ? "text-slate-500"
              : isString
                ? "text-emerald-300"
                : "text-slate-300"
        }
      >
        {token}
      </span>
    );
  });
}

function LargeGraphFallback({
  graph,
}: {
  graph: NonNullable<NormalizedRichApprovalEvidence["blastRadius"]>;
}) {
  return (
    <div>
      <p className="mb-3 text-xs text-amber-200">
        Interactive rendering is limited for large graphs. Showing an accessible
        component list for {graph.totalNodes || graph.nodes.length} nodes.
      </p>
      <ul className="max-h-64 overflow-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
        {graph.nodes.map((node) => (
          <li
            key={node.id}
            className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
          >
            <span className="text-slate-200">{node.label}</span>
            <span className="text-slate-500">
              {node.type} · {node.risk}
            </span>
          </li>
        ))}
      </ul>
      {graph.truncated && (
        <p className="mt-2 text-xs text-slate-500">
          The server response is truncated.
        </p>
      )}
    </div>
  );
}

function SecureEvidenceVideo({
  video,
}: {
  video: NonNullable<
    NonNullable<NormalizedRichApprovalEvidence["sandbox"]>["video"]
  >;
}) {
  const secureUrl =
    video.url.startsWith("/") || video.url.startsWith("https://");
  if (!secureUrl) {
    return (
      <p className="text-xs text-red-300">
        Video blocked: a secure URL is required.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-black p-2">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs text-slate-400">
        <Video size={13} />
        Sandbox recording
        {video.sha256 && <HashBadge label="Video hash" value={video.sha256} />}
      </div>
      <video
        className="max-h-[420px] w-full rounded-lg bg-black"
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        preload="metadata"
      >
        <source src={video.url} type={video.mimeType || "video/mp4"} />
        Your browser does not support secure video playback.
      </video>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Unavailable() {
  return <p className="text-sm text-slate-500">Evidence unavailable.</p>;
}
