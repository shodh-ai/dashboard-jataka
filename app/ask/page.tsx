"use client";

import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Clock3,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  describeApprovalTier,
  describeSupportLevel,
  presentAuditEvent,
  toneClasses,
} from "../auto-resolution/audit-presenter";
import {
  type AutoResolutionCase,
  type Brain,
  type CaseDetail,
  clientStatusLabel,
  estimateResolutionTime,
  getErrorMessage,
  resolveKnowledgeBaseId,
  statusBadgeClasses,
  truncateIssue,
} from "../auto-resolution/types";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;

type ChatTurn =
  | { id: string; role: "user"; text: string; at: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      at: string;
      status?: string;
      eta?: string;
      supportLevel?: string;
    };

const STARTERS = [
  "Spanish Knowledge draft Publish button is greyed out — how do I release it?",
  "Why doesn't Knowledge Manager unlock Publish on Spanish translations?",
  "How do I submit a draft translation for review?",
];

export default function AskSupportPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgName, setOrgName] = useState("Jataka");
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("");
  const [brains, setBrains] = useState<Brain[]>([]);
  const [activeBrain, setActiveBrain] = useState("");
  const [recentCases, setRecentCases] = useState<AutoResolutionCase[]>([]);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeKnowledgeBaseId = useMemo(
    () => resolveKnowledgeBaseId(brains, activeBrain),
    [brains, activeBrain],
  );

  const eta = useMemo(
    () => estimateResolutionTime(detail?.case),
    [detail?.case],
  );

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

  const loadRecentCases = useCallback(async () => {
    const data = await apiFetch("/auto-resolution/cases?limit=30");
    setRecentCases(Array.isArray(data.cases) ? data.cases : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  function turnsFromDetail(caseDetail: CaseDetail): ChatTurn[] {
    const created = caseDetail.case.createdAt;
    const answer =
      caseDetail.case.proposalSnapshot?.answer ||
      "We're still working on this. Check status below — support will follow up if needed.";
    const estimate = estimateResolutionTime(caseDetail.case);

    return [
      {
        id: `${caseDetail.case.id}-user`,
        role: "user",
        text: caseDetail.case.issueText,
        at: created,
      },
      {
        id: `${caseDetail.case.id}-assistant`,
        role: "assistant",
        text: answer,
        at: caseDetail.case.resolvedAt || created,
        status: caseDetail.case.status,
        eta: estimate.label,
        supportLevel: caseDetail.case.supportLevel,
      },
    ];
  }

  async function openCase(caseId: string) {
    setError("");
    setLoading(true);
    try {
      const data = (await apiFetch(`/auto-resolution/cases/${caseId}`)) as CaseDetail;
      setDetail(data);
      setTurns(turnsFromDetail(data));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Could not open this request."));
    } finally {
      setLoading(false);
    }
  }

  function startFresh() {
    setDetail(null);
    setTurns([]);
    setDraft("");
    setError("");
    inputRef.current?.focus();
  }

  async function submitQuestion(text: string) {
    const issue = text.trim();
    if (!issue || loading) return;
    if (!activeKnowledgeBaseId) {
      setError("Select a knowledge brain before asking.");
      return;
    }

    setError("");
    setLoading(true);
    setDraft("");
    const optimisticUser: ChatTurn = {
      id: `local-user-${Date.now()}`,
      role: "user",
      text: issue,
      at: new Date().toISOString(),
    };
    setTurns((prev) => [...prev, optimisticUser]);
    setDetail(null);

    try {
      const created = await apiFetch("/auto-resolution/cases", {
        method: "POST",
        body: JSON.stringify({
          source: "PORTAL",
          curriculumId: activeKnowledgeBaseId,
          issueText: issue,
        }),
      });
      const data = (await apiFetch(
        `/auto-resolution/cases/${created.case_id}`,
      )) as CaseDetail;
      setDetail(data);
      setTurns(turnsFromDetail(data));
      await loadRecentCases();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Could not raise this request."));
      setTurns((prev) => [
        ...prev,
        {
          id: `local-err-${Date.now()}`,
          role: "assistant",
          text: "Something went wrong while starting auto-resolution. Try again in a moment.",
          at: new Date().toISOString(),
          status: "FAILED",
        },
      ]);
    } finally {
      setLoading(false);
    }
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
        setError(getErrorMessage(e, "Failed to load Ask Support."));
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, loading]);

  if (!isLoaded || !isSignedIn) {
    return <div className="min-h-screen bg-[var(--bg-base)]" />;
  }

  const showEmpty = turns.length === 0 && !loading;

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName={orgName} userRole={userRole} />

      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.08),_transparent_45%)]"
        />

        {/* History rail */}
        <aside
          className={`relative z-10 flex h-screen flex-col border-r border-slate-800/80 bg-slate-950/40 backdrop-blur-sm transition-all duration-200 ${
            historyOpen ? "w-[280px]" : "w-12"
          }`}
        >
          <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-800/80 px-3">
            {historyOpen && (
              <button
                type="button"
                onClick={startFresh}
                className="inline-flex flex-1 items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              >
                <MessageSquarePlus size={16} />
                New request
              </button>
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              title={historyOpen ? "Hide history" : "Show history"}
            >
              {historyOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
          </div>

          {historyOpen && (
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              <p className="px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Your history
              </p>
              {recentCases.length === 0 ? (
                <p className="px-2 text-xs leading-5 text-slate-500">
                  Ask something to start a ticket. Status and ETA show up here.
                </p>
              ) : (
                recentCases.map((row) => {
                  const active = detail?.case.id === row.id;
                  const rowEta = estimateResolutionTime(row);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => openCase(row.id)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-indigo-500/15 ring-1 ring-indigo-400/30"
                          : "hover:bg-slate-900/70"
                      }`}
                    >
                      <p className="line-clamp-2 text-sm leading-5 text-slate-200">
                        {truncateIssue(row.issueText)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] ${statusBadgeClasses(row.status)}`}
                        >
                          {clientStatusLabel(row.status)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock3 size={10} />
                          {rowEta.label}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </aside>

        {/* Chat stage */}
        <main className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between gap-4 border-b border-slate-800/60 px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">Ask Support</p>
              <p className="truncate text-xs text-slate-500">
                Answers from your knowledge base · raise a ticket when needed
              </p>
            </div>
            <select
              value={activeBrain}
              onChange={(e) => setActiveBrain(e.target.value)}
              className="input select max-w-[220px] text-xs"
              title="Knowledge brain"
            >
              {brains.length === 0 ? (
                <option value="">No brains</option>
              ) : (
                brains.map((brain) => (
                  <option key={brain.knowledgeBaseId} value={brain.knowledgeBaseId}>
                    {brain.name || brain.knowledgeBaseId}
                  </option>
                ))
              )}
            </select>
          </header>

          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto w-full max-w-3xl">
              {error && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <AnimatePresence mode="wait">
                {showEmpty ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                    className="flex min-h-[55vh] flex-col items-center justify-center text-center"
                  >
                    <motion.div
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.08, duration: 0.4 }}
                      className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/25 bg-indigo-500/10"
                    >
                      <Sparkles className="text-indigo-300" size={26} />
                    </motion.div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      Jataka
                    </h1>
                    <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                      Ask a question. Get an answer from your docs — or raise a ticket for
                      auto-resolution with live status and ETA.
                    </p>
                    <div className="mt-8 flex w-full max-w-xl flex-col gap-2">
                      {STARTERS.map((starter, i) => (
                        <motion.button
                          key={starter}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + i * 0.06 }}
                          onClick={() => submitQuestion(starter)}
                          className="rounded-2xl border border-slate-800/90 bg-slate-950/40 px-4 py-3 text-left text-sm leading-6 text-slate-300 transition hover:border-slate-600 hover:bg-slate-900/60 hover:text-slate-100"
                        >
                          {starter}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="thread"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6 pb-8"
                  >
                    {turns.map((turn) =>
                      turn.role === "user" ? (
                        <div key={turn.id} className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600/90 px-4 py-3 text-sm leading-6 text-white shadow-lg shadow-indigo-950/30">
                            {turn.text}
                          </div>
                        </div>
                      ) : (
                        <div key={turn.id} className="flex gap-3">
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10">
                            <Sparkles size={14} className="text-indigo-300" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="rounded-2xl rounded-tl-md border border-slate-800/80 bg-slate-950/50 px-4 py-3 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
                              {turn.text}
                            </div>
                            {(turn.status || turn.eta) && (
                              <div className="flex flex-wrap items-center gap-2 pl-1">
                                {turn.status && (
                                  <span
                                    className={`rounded-md border px-2 py-0.5 text-[11px] ${statusBadgeClasses(turn.status)}`}
                                  >
                                    {clientStatusLabel(turn.status)}
                                  </span>
                                )}
                                {turn.supportLevel && (
                                  <span className="text-[11px] text-slate-500">
                                    {describeSupportLevel(turn.supportLevel)}
                                  </span>
                                )}
                                {turn.eta && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                    <Clock3 size={11} />
                                    ETA {turn.eta}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}

                    {loading && (
                      <div className="flex items-center gap-2 pl-11 text-sm text-slate-500">
                        <Loader2 size={14} className="animate-spin" />
                        Working through auto-resolution…
                      </div>
                    )}

                    {detail && (
                      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                            Ticket progress
                          </p>
                          <p className="text-xs text-slate-500">
                            {eta.label}
                            {eta.detail ? ` · ${eta.detail}` : ""}
                          </p>
                        </div>
                        <div className="space-y-3">
                          {detail.auditEvents.slice(0, 6).map((event) => {
                            const presentation = presentAuditEvent(event);
                            const tone = toneClasses(presentation.tone);
                            const Icon = presentation.icon;
                            return (
                              <div key={event.id} className="flex gap-3">
                                <div
                                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${tone.ring}`}
                                >
                                  <Icon size={13} className={tone.icon} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-slate-200">{presentation.title}</p>
                                  <p className="text-xs leading-5 text-slate-500">
                                    {presentation.summary}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {detail.case.approvalTier && (
                          <p className="mt-4 text-xs leading-5 text-slate-500">
                            {describeApprovalTier(detail.case.approvalTier)}
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="border-t border-slate-800/60 bg-slate-950/40 px-4 py-4 backdrop-blur-md">
            <form
              className="mx-auto w-full max-w-3xl"
              onSubmit={(e) => {
                e.preventDefault();
                submitQuestion(draft);
              }}
            >
              <div className="flex items-end gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-2 shadow-xl shadow-black/20 focus-within:border-indigo-400/40">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitQuestion(draft);
                    }
                  }}
                  rows={1}
                  placeholder="Ask a question or describe an issue…"
                  className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={loading || !draft.trim()}
                  className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Send"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-600">
                Sends into auto-resolution · history keeps status & ETA
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
