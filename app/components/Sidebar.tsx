"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import { useState } from "react";
import {
  LayoutDashboard,
  Network,
  Activity,
  Plug,
  ChevronsLeft,
  ChevronsRight,
  Hexagon,
  ShieldCheck,
  Terminal,
  Wrench,
  Shield,
  Bot,
  MessageSquare,
  BookOpen,
  Headset,
  Sparkles,
  FileCheck2,
  GitCompareArrows,
  ChartNoAxesCombined,
  BriefcaseBusiness,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DashboardRole } from "../lib/dashboard-role";
import {
  PERSONA_NAVIGATION,
  type PersonaNavigationItem,
} from "../lib/dashboard-persona";
import { usePersona } from "./PersonaProvider";

interface SidebarProps {
  orgName: string;
  userRole?: DashboardRole;
}

const navigationIcons: Record<PersonaNavigationItem["icon"], LucideIcon> = {
  overview: LayoutDashboard,
  graph: Network,
  tests: Activity,
  status: Activity,
  risk: ShieldCheck,
  compliance: Shield,
  knowledge: BookOpen,
  ask: MessageSquare,
  support: Headset,
  manager: BriefcaseBusiness,
  roi: ChartNoAxesCombined,
  drift: GitCompareArrows,
  audit: FileCheck2,
  automation: Bot,
  demo: Sparkles,
  developer: Terminal,
  debt: Wrench,
  integrations: Plug,
  logs: Activity,
};

export default function Sidebar({ orgName }: SidebarProps) {
  const { user } = useUser();
  const pathname = usePathname();
  const { activePersona, activeDefinition } = usePersona();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = PERSONA_NAVIGATION[activePersona];

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || "U";

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "User";

  return (
    <aside
      className={`sticky top-0 self-start flex flex-col h-screen bg-[var(--bg-surface)] border-r border-[var(--border-default)] transition-all duration-200 ${
        collapsed ? "w-[64px]" : "w-[240px]"
      }`}
    >
      {/* Brand Header */}
      <div className={`flex items-center gap-3 px-4 h-14 border-b border-[var(--border-default)] ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
          <Hexagon size={18} className="text-white" strokeWidth={2} />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {orgName || "Jataka"}
            </p>
            <p className="text-xs text-[var(--text-muted)] truncate capitalize">
              {activeDefinition.label} workspace
            </p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="flex-shrink-0 p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            title="Collapse sidebar"
          >
            <ChevronsLeft size={14} />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="flex-shrink-0 p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            title="Expand sidebar"
          >
            <ChevronsRight size={14} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("#")[0]);
          const Icon = navigationIcons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-hover)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-transparent"
              } ${collapsed ? "justify-center px-0 mx-auto w-10 h-10" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                size={18}
                className={`flex-shrink-0 transition-colors ${
                  isActive ? "text-[var(--accent-light)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                }`}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-[var(--border-default)] px-3 py-3">
        <div
          className={`flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[var(--bg-card)] transition-colors ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{displayName}</p>
              <SignOutButton>
                <button className="text-xs text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                  Sign out
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
