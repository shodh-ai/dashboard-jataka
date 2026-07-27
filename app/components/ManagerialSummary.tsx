import {
  AlertTriangle,
  ShieldCheck,
  Stethoscope,
  Wrench,
} from "lucide-react";
import type { ManagerialSummaryView } from "../auto-resolution/managerial-summary";

const items = [
  {
    key: "rootCause" as const,
    label: "Root cause",
    icon: Stethoscope,
    accent: "text-rose-300",
    iconShell: "border-rose-400/25 bg-rose-400/10",
  },
  {
    key: "fix" as const,
    label: "Fix",
    icon: Wrench,
    accent: "text-cyan-300",
    iconShell: "border-cyan-400/25 bg-cyan-400/10",
  },
  {
    key: "risk" as const,
    label: "Risk",
    icon: ShieldCheck,
    accent: "text-amber-300",
    iconShell: "border-amber-400/25 bg-amber-400/10",
  },
];

export default function ManagerialSummary({
  summary,
}: {
  summary: ManagerialSummaryView;
}) {
  return (
    <section
      aria-labelledby="managerial-summary-title"
      className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.86))] shadow-[0_18px_60px_rgba(2,6,23,0.28)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/70 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
            Decision brief
          </p>
          <h2
            id="managerial-summary-title"
            className="mt-1 text-lg font-semibold text-white"
          >
            Managerial summary
          </h2>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
          Grounded proposal data
        </span>
      </div>

      <div className="grid divide-y divide-slate-700/60 md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map(({ key, label, icon: Icon, accent, iconShell }) => (
          <article key={key} className="min-w-0 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg border ${iconShell}`}
              >
                <Icon size={16} className={accent} />
              </span>
              <h3
                className={`text-xs font-semibold uppercase tracking-[0.14em] ${accent}`}
              >
                {label}
              </h3>
            </div>
            <p className="text-base font-medium leading-6 text-slate-100">
              {summary[key]}
            </p>
            {summary.isFallback[key] && (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                <AlertTriangle size={12} />
                Awaiting grounded proposal detail
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
