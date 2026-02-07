"use client";

import { useUser, useOrganizationList, SignOutButton } from "@clerk/nextjs";
import { useState } from "react";
import {
  LayoutDashboard,
  Network,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  orgName: string;
  userRole: "ARCHITECT" | "DEVELOPER" | "";
}

const orgListParams = {
  userMemberships: { infinite: true },
};

export default function Sidebar({ orgName, userRole }: SidebarProps) {
  const { user } = useUser();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { userMemberships, isLoaded: isOrgListLoaded } = useOrganizationList(orgListParams);

  const navItems = [
    { label: "Overview", href: "/", icon: LayoutDashboard },
    { label: "Knowledge Graph", href: "/#graph", icon: Network },
    { label: "Settings", href: "/settings/integrations", icon: Settings, architectOnly: true },
  ];

  const filteredNav = navItems.filter(
    (item) => !item.architectOnly || userRole === "ARCHITECT"
  );

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || "U";

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "User";

  const email = user?.primaryEmailAddress?.emailAddress || "";

  return (
    <aside
      className={`flex flex-col h-screen bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] transition-all duration-300 ease-in-out ${
        collapsed ? "w-[68px]" : "w-[260px]"
      }`}
    >
      {/* ─── Brand Header ─── */}
      <div className={`flex items-center gap-3 px-4 h-16 border-b border-[var(--border-subtle)] ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="flex-shrink-0 w-8 h-8 rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate tracking-tight">
              {orgName || "Jataka"}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] truncate capitalize mt-0.5">
              {userRole ? `${userRole.toLowerCase()} workspace` : "workspace"}
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex-shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all duration-200 ${collapsed ? "mx-auto mt-0" : ""}`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        </button>
      </div>

      {/* ─── Navigation ─── */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">
            Navigation
          </p>
        )}
        {filteredNav.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-indigo-500/10 to-violet-500/5 text-[var(--accent)] border border-indigo-500/15"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] border border-transparent"
              } ${collapsed ? "justify-center px-0 mx-auto w-11 h-11" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                size={18}
                className={`flex-shrink-0 transition-colors duration-200 ${
                  isActive ? "text-[var(--accent)]" : "text-[var(--text-faint)] group-hover:text-[var(--text-secondary)]"
                }`}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ─── User Footer ─── */}
      <div className="border-t border-[var(--border-subtle)] px-3 py-3">
        <div
          className={`flex items-center gap-3 px-2 py-2 rounded-[10px] hover:bg-[var(--bg-elevated)] transition-all duration-200 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-[var(--accent)] tracking-wide">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{displayName}</p>
              <SignOutButton>
                <button className="text-[11px] text-[var(--text-faint)] hover:text-rose-400 transition-colors duration-200 mt-0.5">
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
