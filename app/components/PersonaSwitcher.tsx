"use client";

import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Code2,
  FileCheck2,
  Headset,
  MessageSquare,
  Network,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  DASHBOARD_PERSONAS,
  PERSONA_DEFINITIONS,
  type PersonaIcon,
} from "../lib/dashboard-persona";
import { usePersona } from "./PersonaProvider";

const personaIcons: Record<PersonaIcon, LucideIcon> = {
  manager: BriefcaseBusiness,
  support: Headset,
  architect: Network,
  developer: Code2,
  auditor: FileCheck2,
  admin: Settings,
  requester: MessageSquare,
};

export default function PersonaSwitcher() {
  const pathname = usePathname();
  const { activePersona, activeDefinition, selectPersona } = usePersona();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ActiveIcon = personaIcons[activeDefinition.icon];

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (pathname.startsWith("/github/callback")) return null;

  return (
    <div
      ref={containerRef}
      className="fixed right-4 top-3 z-[250] text-left"
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Switch persona, current: ${activeDefinition.label}`}
        onClick={() => setOpen((current) => !current)}
        className="flex min-w-[164px] items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-lg transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <ActiveIcon size={16} className="text-indigo-300" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {activeDefinition.shortLabel}
        </span>
        <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          Preview
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Switch dashboard persona"
          className="mt-2 w-[320px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl"
        >
          <div className="border-b border-slate-800 px-3 py-2">
            <p className="text-xs font-semibold text-slate-200">
              Preview as a persona
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
              Testing only. This does not change authentication or permissions.
            </p>
          </div>
          <div className="mt-1 max-h-[min(460px,70vh)] overflow-y-auto">
            {DASHBOARD_PERSONAS.map((persona) => {
              const definition = PERSONA_DEFINITIONS[persona];
              const Icon = personaIcons[definition.icon];
              const selected = persona === activePersona;

              return (
                <button
                  key={persona}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    setOpen(false);
                    selectPersona(persona);
                  }}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 ${
                    selected
                      ? "bg-indigo-500/15 text-white"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <span
                    className={`mt-0.5 rounded-md border p-1.5 ${
                      selected
                        ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-300"
                        : "border-slate-700 text-slate-400"
                    }`}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {definition.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                      {definition.description}
                    </span>
                  </span>
                  {selected && (
                    <Check
                      size={15}
                      className="mt-1 shrink-0 text-indigo-300"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
