"use client";

import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  presentAuditEvent,
  toneClasses,
  type AuditEventLike,
} from "../auto-resolution/audit-presenter";
import {
  type Brain,
  getErrorMessage,
  resolveKnowledgeBaseId,
} from "../auto-resolution/types";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;

type DemoSituation = {
  id: string;
  ticketId: string;
  subject: string;
  issueText: string;
  expectedAction: string;
  allowExternalMutation: boolean;
  cloud?: string;
  functionalArea?: string;
};

type DemoSuite = {
  id: string;
  label: string;
  ticketCount: number;
};

type PreflightCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

type DemoRunResult = {
  scenario?: DemoSituation;
  situation?: DemoSituation;
  mode?: string;
  externalMutated?: boolean;
  salesforceMutated?: boolean;
  eval?: {
    caseId: string;
    status: string;
    supportLevel?: string | null;
    proposedAction?: string | null;
    requiresHuman: boolean;
    finalAnswer?: string | null;
    score?: {
      passed: boolean;
      answerCoverage: number;
      notes: string[];
    };
  };
  intake?: {
    caseId: string;
    status: string;
    requiresHuman: boolean;
    finalAnswer?: string | null;
    pendingApprovalId?: string | null;
  };
  detail?: {
    case: { id: string; status: string; proposalSnapshot?: { answer?: string } };
    auditEvents?: Array<AuditEventLike & { id: string }>;
  };
  externalProof?: {
    system?: string;
    before?: {
      displayId?: string;
      caseNumber?: string;
      status?: string;
      subject?: string;
    };
    after?: {
      displayId?: string;
      caseNumber?: string;
      status?: string;
      subject?: string;
    };
    translationRequestId?: string;
    beforeStatus?: string;
    note?: string;
  } | null;
  salesforceProof?: {
    before?: {
      displayId?: string;
      caseNumber?: string;
      status?: string;
      subject?: string;
    };
    after?: {
      displayId?: string;
      caseNumber?: string;
      status?: string;
      subject?: string;
    };
    translationRequestId?: string;
    beforeStatus?: string;
    note?: string;
  } | null;
};

export default function AutoResolutionDemoPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgName, setOrgName] = useState("Jataka");
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("");
  const [brains, setBrains] = useState<Brain[]>([]);
  const [activeBrain, setActiveBrain] = useState("");
  const [suiteId, setSuiteId] = useState("all_l1");
  const [suites, setSuites] = useState<DemoSuite[]>([]);
  const [scenarios, setScenarios] = useState<DemoSituation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [preflight, setPreflight] = useState<{
    ready?: boolean;
    canRunSafeEval?: boolean;
    canRunLive?: boolean;
    checks: PreflightCheck[];
  } | null>(null);
  const [result, setResult] = useState<DemoRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);

  const activeKnowledgeBaseId = useMemo(
    () => resolveKnowledgeBaseId(brains, activeBrain),
    [brains, activeBrain],
  );

  const selected = scenarios.find((s) => s.id === selectedId) || null;

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

  async function loadScenarios(nextSuite = suiteId) {
    const qs = nextSuite ? `?suite=${encodeURIComponent(nextSuite)}` : "";
    const data = await apiFetch(`/auto-resolution/demo/scenarios${qs}`);
    const list = Array.isArray(data.situations)
      ? data.situations
      : Array.isArray(data.scenarios)
        ? data.scenarios
        : [];
    setScenarios(list);
    setSuites(Array.isArray(data.suites) ? data.suites : []);
    if (data.suiteId) setSuiteId(data.suiteId);
    setSelectedId((prev) =>
      list.some((s: DemoSituation) => s.id === prev) ? prev : list[0]?.id || "",
    );
  }

  async function loadPreflight(ticketId: string) {
    if (!ticketId) return;
    const qs = activeKnowledgeBaseId
      ? `?curriculumId=${encodeURIComponent(activeKnowledgeBaseId)}`
      : "";
    const data = await apiFetch(
      `/auto-resolution/demo/preflight/${encodeURIComponent(ticketId)}${qs}`,
    );
    setPreflight({
      ready: data.ready,
      canRunSafeEval: data.canRunSafeEval,
      canRunLive: data.canRunLive,
      checks: Array.isArray(data.checks) ? data.checks : [],
    });
  }

  useEffect(() => {
    async function bootstrap() {
      if (!isLoaded || !isSignedIn || !BASE_API) return;
      setLoading(true);
      setError("");
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

        await loadScenarios("all_l1");
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Failed to load Auto Resolution Demo."));
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!selectedId || !isLoaded || !isSignedIn) return;
    loadPreflight(selectedId).catch((e: unknown) => {
      setError(getErrorMessage(e, "Failed to run preflight."));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeKnowledgeBaseId, isLoaded, isSignedIn]);

  async function onSuiteChange(nextSuite: string) {
    setSuiteId(nextSuite);
    setResult(null);
    setLoading(true);
    setError("");
    try {
      await loadScenarios(nextSuite);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load ticket suite."));
    } finally {
      setLoading(false);
    }
  }

  async function prepareSituation() {
    if (!selectedId) return;
    setProvisioning(true);
    setError("");
    try {
      await apiFetch(`/auto-resolution/demo/provision/${encodeURIComponent(selectedId)}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadPreflight(selectedId);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to prepare external fixtures."));
    } finally {
      setProvisioning(false);
    }
  }

  async function runDemo(live: boolean) {
    if (!selectedId) return;
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const data = await apiFetch(
        `/auto-resolution/demo/run/${encodeURIComponent(selectedId)}`,
        {
          method: "POST",
          body: JSON.stringify({
            curriculumId: activeKnowledgeBaseId || undefined,
            live,
          }),
        },
      );
      setResult(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to run auto-resolution demo."));
    } finally {
      setRunning(false);
    }
  }

  const answer =
    result?.eval?.finalAnswer ||
    result?.intake?.finalAnswer ||
    result?.detail?.case?.proposalSnapshot?.answer ||
    "";
  const caseId = result?.eval?.caseId || result?.intake?.caseId || result?.detail?.case?.id;
  const needsHuman =
    Boolean(result?.eval?.requiresHuman) || Boolean(result?.intake?.requiresHuman);
  const auditEvents = result?.detail?.auditEvents || [];
  const proof = result?.externalProof || result?.salesforceProof;
  const proofBeforeId = proof?.before?.displayId || proof?.before?.caseNumber;
  const proofAfterId = proof?.after?.displayId || proof?.after?.caseNumber;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar orgName={orgName} userRole={userRole} />
      <main className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2">
                <Sparkles className="text-emerald-300" size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Auto Resolution Demo</h1>
                <p className="text-sm text-slate-400">
                  Pick a ticket from the corpus. The situation is the ticket text — run
                  auto-resolution against it, optionally with live connector writeback.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[180px]">
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                  Ticket suite
                </label>
                <select
                  value={suiteId}
                  onChange={(e) => onSuiteChange(e.target.value)}
                  className="input select w-full text-sm"
                >
                  {suites.length === 0 ? (
                    <option value={suiteId}>{suiteId}</option>
                  ) : (
                    suites.map((suite) => (
                      <option key={suite.id} value={suite.id}>
                        {suite.label} ({suite.ticketCount})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="min-w-[220px]">
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                  Brain / curriculum
                </label>
                <select
                  value={activeBrain}
                  onChange={(e) => setActiveBrain(e.target.value)}
                  className="input select w-full text-sm"
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
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="animate-spin" size={16} /> Loading tickets…
            </div>
          ) : (
            <section className="grid gap-4 md:grid-cols-2">
              {scenarios.map((situation) => {
                const active = situation.id === selectedId;
                return (
                  <button
                    key={situation.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(situation.id);
                      setResult(null);
                    }}
                    className={`rounded-2xl border p-5 text-left transition ${
                      active
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-950/70 hover:border-slate-600"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h2 className="text-lg font-semibold text-white">{situation.subject}</h2>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                        {situation.ticketId}
                      </span>
                    </div>
                    <p className="mb-3 line-clamp-4 text-sm leading-6 text-slate-300">
                      {situation.issueText}
                    </p>
                    <p className="text-xs leading-5 text-slate-500">
                      {situation.cloud}
                      {situation.functionalArea ? ` · ${situation.functionalArea}` : ""}
                      {" · "}
                      {situation.expectedAction}
                    </p>
                  </button>
                );
              })}
            </section>
          )}

          {selected && (
            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <h3 className="mb-3 text-lg font-semibold text-white">Run this ticket</h3>
                <p className="mb-4 whitespace-pre-wrap text-sm text-slate-400">
                  {selected.issueText}
                </p>

                <div className="mb-4 space-y-2">
                  {(preflight?.checks || []).map((check) => (
                    <div
                      key={check.id}
                      className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                    >
                      {check.ok ? (
                        <CheckCircle2 className="mt-0.5 text-emerald-400" size={16} />
                      ) : (
                        <AlertTriangle className="mt-0.5 text-amber-300" size={16} />
                      )}
                      <div>
                        <p className="text-sm text-slate-200">{check.label}</p>
                        <p className="text-xs text-slate-500">{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={prepareSituation}
                    disabled={provisioning}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {provisioning ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Wrench size={16} />
                    )}
                    Prepare fixtures
                  </button>
                  <button
                    type="button"
                    onClick={() => runDemo(false)}
                    disabled={running || !activeKnowledgeBaseId}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {running ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    Run auto-resolution
                  </button>
                  <button
                    type="button"
                    onClick={() => runDemo(true)}
                    disabled={running || !preflight?.canRunLive}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    <ShieldCheck size={16} />
                    Run live writeback
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedId && loadPreflight(selectedId)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
                  >
                    <RefreshCcw size={16} />
                    Refresh preflight
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <h3 className="mb-3 text-lg font-semibold text-white">Result</h3>
                {!result ? (
                  <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                    Run a ticket to see the answer, audit timeline, and external-system proof.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {result.mode}
                      </span>
                      {result.eval?.score?.passed != null && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            result.eval.score.passed
                              ? "border-emerald-500/40 text-emerald-300"
                              : "border-amber-500/40 text-amber-200"
                          }`}
                        >
                          {result.eval.score.passed ? "PASS" : "REVIEW"}
                        </span>
                      )}
                      {needsHuman && (
                        <Link
                          href="/support-ops"
                          className="rounded-full border border-blue-500/40 px-2 py-0.5 text-xs text-blue-200 hover:bg-blue-500/10"
                        >
                          Open approval queue
                        </Link>
                      )}
                    </div>

                    {answer ? (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                        {answer}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No final answer yet
                        {needsHuman ? " — waiting on human approval." : "."}
                      </p>
                    )}

                    {proof && (
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
                        <p className="mb-1 font-medium text-slate-300">
                          External proof
                          {proof.system ? ` (${proof.system})` : ""}
                        </p>
                        {proof.before && (
                          <p>
                            Before: {proofBeforeId || "record"} · {proof.before.status} ·{" "}
                            {proof.before.subject}
                          </p>
                        )}
                        {proof.after && (
                          <p>
                            After: {proofAfterId || "record"} · {proof.after.status} ·{" "}
                            {proof.after.subject}
                          </p>
                        )}
                        {proof.translationRequestId && (
                          <p>
                            Translation request {proof.translationRequestId}
                            {proof.beforeStatus ? ` · status ${proof.beforeStatus}` : ""}
                          </p>
                        )}
                        {proof.note && <p>{proof.note}</p>}
                        <p>
                          Mutation during this run:{" "}
                          {result.externalMutated || result.salesforceMutated ? "yes" : "no"}
                        </p>
                      </div>
                    )}

                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-white">What happened</h4>
                      <div className="space-y-2">
                        {auditEvents.length === 0 ? (
                          <p className="text-xs text-slate-500">No audit events returned.</p>
                        ) : (
                          auditEvents.map((event) => {
                            const presented = presentAuditEvent(event);
                            const Icon = presented.icon;
                            return (
                              <div
                                key={event.id}
                                className={`rounded-lg border p-3 ${toneClasses(presented.tone)}`}
                              >
                                <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                                  <Icon size={14} />
                                  {presented.title}
                                </div>
                                <p className="text-xs opacity-90">{presented.summary}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTechnical((v) => !v)}
                      className="text-xs text-slate-500 underline"
                    >
                      {showTechnical ? "Hide" : "Show"} technical details
                    </button>
                    {showTechnical && (
                      <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-400">
                        {JSON.stringify(
                          {
                            caseId,
                            mode: result.mode,
                            score: result.eval?.score,
                            intake: result.intake,
                            externalMutated:
                              result.externalMutated ?? result.salesforceMutated,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
