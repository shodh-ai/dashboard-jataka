import type {
  BlastGraphEdge,
  BlastGraphNode,
  CausalProofEvidence,
  NormalizedRichApprovalEvidence,
  RichApprovalEvidence,
  RichEvidenceRequirements,
} from "./types";

export function normalizeRichApprovalEvidence(
  evidence?: RichApprovalEvidence,
): NormalizedRichApprovalEvidence | undefined {
  if (!evidence) return undefined;

  const astTransformation =
    evidence.astTransformation ||
    (evidence.astDiff
      ? {
          kind: evidence.astDiff.kind,
          filePath:
            evidence.astDiff.operations
              ?.map((operation) => operation.path || operation.node_id)
              .find(Boolean) ||
            evidence.blastRadiusGraph?.entityName ||
            "Proposed transformation",
          before: evidence.astDiff.before || "",
          after: evidence.astDiff.after || "",
          beforeHash: evidence.astDiff.sourceHash || "",
          afterHash: evidence.astDiff.resultHash || "",
          transformationHash: evidence.astDiff.resultHash,
          language: evidence.astDiff.compilerVersion,
          operations: evidence.astDiff.operations,
        }
      : undefined);

  const blastRadius =
    evidence.blastRadius ||
    (evidence.blastRadiusGraph
      ? {
          nodes: evidence.blastRadiusGraph.nodes.map(normalizeGraphNode),
          edges: evidence.blastRadiusGraph.edges
            .map(normalizeGraphEdge)
            .filter((edge): edge is BlastGraphEdge => Boolean(edge)),
          rootNodeId: evidence.blastRadiusGraph.entityName,
          totalNodes: evidence.blastRadiusGraph.nodes.length,
        }
      : undefined);

  return {
    proposalHash: evidence.proposalHash,
    evidenceHash: evidence.evidenceHash,
    generatedAt:
      evidence.generatedAt ||
      ("generatedAt" in (evidence.causalProof || {})
        ? evidence.causalProof?.generatedAt
        : undefined),
    astTransformation,
    blastRadius,
    causalProof: normalizeCausalProof(evidence.causalProof),
    sandbox:
      evidence.sandbox ||
      (evidence.sandboxVideoUrl
        ? {
            status: "PASSED",
            tests: [],
            video: { url: evidence.sandboxVideoUrl },
          }
        : evidence.sandboxVideoReason
          ? { status: "NOT_RUN", tests: [] }
          : undefined),
    teeAttestation: normalizeTeeAttestation(evidence.teeAttestation),
    verification: evidence.verification,
    sandboxVideoReason: evidence.sandboxVideoReason,
    requirements: normalizeRequirements(evidence),
  };
}

function normalizeRequirements(evidence: RichApprovalEvidence): RichEvidenceRequirements {
  const merged = {
    ...evidence.requirements,
    ...evidence.evidenceRequirements,
    ...evidence.enforcement,
  };
  return {
    astDiff: merged.astDiff,
    blastRadius: merged.blastRadius,
    causalProof: merged.causalProof,
    tee:
      evidence.teeRequired === true ||
      evidence.enforcement?.requireTee === true ||
      merged.tee === true,
    deltaBox:
      evidence.deltaBoxRequired === true ||
      evidence.enforcement?.requireDeltaBox === true ||
      merged.deltaBox === true,
    hashBinding: merged.hashBinding,
  };
}

function normalizeCausalProof(
  causalProof?: RichApprovalEvidence["causalProof"],
): CausalProofEvidence | undefined {
  if (!causalProof) return undefined;
  if ("status" in causalProof && isFrontendCausalStatus(causalProof.status)) {
    return causalProof;
  }
  if (!("diagnosis" in causalProof)) return undefined;

  const proofRecord = asRecord(causalProof.proof);
  const simulation = asRecord(proofRecord.intervention_simulation);
  const result = stringValue(proofRecord.result).toLowerCase();
  const structuralSupported =
    asRecord(proofRecord.structural_reachability).supported === true ||
    stringValue(proofRecord.status).toLowerCase() === "supported";
  const statisticallyIdentifiable =
    result === "identifiable" ||
    asRecord(proofRecord.statistical_identification).identifiable === true;
  const sandboxStatus = stringValue(
    asRecord(proofRecord.sandbox_verification).status,
  ).toLowerCase();
  const sandboxPassed = sandboxStatus === "passed";
  const assumptions = Array.isArray(proofRecord.assumptions)
    ? proofRecord.assumptions.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : [];

  let status: CausalProofEvidence["status"] = "NOT_PROVEN";
  if (statisticallyIdentifiable && (sandboxPassed || sandboxStatus.length === 0)) {
    status = "PROVEN";
  } else if (structuralSupported || causalProof.causes.length > 0) {
    status = "PARTIAL";
  }

  return {
    status,
    claim: stringValue(simulation.claim) || causalProof.diagnosis,
    proof: safeJson(causalProof.proof),
    assumptions,
    limitations: stringValue(proofRecord.reason)
      ? [stringValue(proofRecord.reason)]
      : undefined,
    generatedAt: causalProof.generatedAt,
    causes: causalProof.causes,
  };
}

function isFrontendCausalStatus(
  value: unknown,
): value is CausalProofEvidence["status"] {
  return (
    value === "PROVEN" ||
    value === "PARTIAL" ||
    value === "NOT_PROVEN" ||
    value === "DISPROVEN"
  );
}

function normalizeTeeAttestation(
  attestation?: RichApprovalEvidence["teeAttestation"],
): NormalizedRichApprovalEvidence["teeAttestation"] {
  if (!attestation) return undefined;
  if ("status" in attestation) return attestation;

  const expired =
    Boolean(attestation.expiresAt) &&
    new Date(attestation.expiresAt).getTime() <= Date.now();
  return {
    status: expired ? "EXPIRED" : attestation.verified === true ? "VERIFIED" : "UNVERIFIED",
    provider: attestation.provider,
    measurement: attestation.measurement,
    quoteHash: attestation.tokenHash,
    auditLogHash: attestation.outputHash,
    issuedAt: attestation.issuedAt,
    expiresAt: attestation.expiresAt,
  };
}

function normalizeGraphNode(node: unknown, index: number): BlastGraphNode {
  if (typeof node === "string") {
    return {
      id: node,
      label: node,
      type: "Other",
      risk: "Safe",
    };
  }
  const record = asRecord(node);
  const id = stringValue(
    record.id,
    record.elementId,
    record.apiName,
    record.name,
    record.label,
  ) || `node-${index}`;
  const rawType = stringValue(record.type, record.nodeType, record.kind, record.category);
  const rawRisk = stringValue(record.risk, record.riskLevel, record.severity);
  return {
    id,
    label: stringValue(record.label, record.name, record.apiName) || id,
    apiName: stringValue(record.apiName, record.api_name) || undefined,
    type: normalizeNodeType(rawType),
    risk: normalizeRisk(rawRisk),
    change: normalizeChange(stringValue(record.change, record.status)),
  };
}

function normalizeGraphEdge(edge: unknown, index: number): BlastGraphEdge | undefined {
  const record = asRecord(edge);
  const source = endpointId(record.source ?? record.from ?? record.start);
  const target = endpointId(record.target ?? record.to ?? record.end);
  if (!source || !target) return undefined;
  return {
    id: stringValue(record.id) || `blast-edge-${index}`,
    source,
    target,
    relationType:
      stringValue(record.relationType, record.relationship, record.type, record.label) ||
      undefined,
  };
}

function endpointId(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  const record = asRecord(value);
  return stringValue(record.id, record.elementId, record.name);
}

function normalizeNodeType(value: string): BlastGraphNode["type"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("field")) return "Field";
  if (normalized.includes("apex") || normalized.includes("class")) return "Apex";
  if (normalized.includes("flow") || normalized.includes("trigger")) return "Flow";
  if (normalized.includes("object")) return "Object";
  if (normalized.includes("test")) return "Test";
  return "Other";
}

function normalizeRisk(value: string): BlastGraphNode["risk"] {
  const normalized = value.toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return "Safe";
}

function normalizeChange(value: string): BlastGraphNode["change"] | undefined {
  const normalized = value.toUpperCase();
  if (["ADDED", "MODIFIED", "REMOVED", "UNCHANGED"].includes(normalized)) {
    return normalized as BlastGraphNode["change"];
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(...values: unknown[]): string {
  const value = values.find(
    (candidate) =>
      (typeof candidate === "string" && candidate.trim().length > 0) ||
      typeof candidate === "number",
  );
  return value == null ? "" : String(value);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
