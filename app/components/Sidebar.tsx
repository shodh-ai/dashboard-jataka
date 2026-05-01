"use client";

import { useAuth, useUser, SignOutButton } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
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
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getStoredRepo, setStoredRepo, withRepoInSearchParams } from "../lib/repoSelection";

interface SidebarProps {
  orgName: string;
  userRole: "ARCHITECT" | "DEVELOPER" | "";
}

export default function Sidebar({ orgName, userRole }: SidebarProps) {
  const { user } = useUser();
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [repos, setRepos] = useState<{ id: number; full_name: string }[]>([]);
  const [repoLoading, setRepoLoading] = useState(false);

  const baseApi = process.env.NEXT_PUBLIC_API_BASE_URL;

  const selectedRepo = useMemo(() => {
    const fromUrl = searchParams.get("repo") || "";
    return fromUrl || getStoredRepo();
  }, [searchParams]);

  useEffect(() => {
    setStoredRepo(selectedRepo);
  }, [selectedRepo]);

  useEffect(() => {
    async function loadRepos() {
      if (!baseApi || !isAuthLoaded || !isSignedIn) return;
      setRepoLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${baseApi}/integrations/github/linked-repos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const list = Array.isArray(json?.repositories) ? json.repositories : [];
        setRepos(list);
      } finally {
        setRepoLoading(false);
      }
    }

    loadRepos();
  }, [baseApi, getToken, isAuthLoaded, isSignedIn]);

  const navHref = (href: string) => {
    // Keep repo selection in URL while navigating between pages.
    if (!selectedRepo) return href;
    const [pathOnly, hash] = href.split("#");
    const next = withRepoInSearchParams(new URLSearchParams(searchParams.toString()), selectedRepo);
    const qs = next.toString();
    const full = `${pathOnly}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
    return full;
  };

  
  const navItems = [
    { label: "Overview", href: "/", icon: LayoutDashboard },
    { label: "Dependency Graph", href: "/dependency-graph", icon: Network },
    { label: "Active Tests", href: "/active-tests", icon: Activity },
    { label: "Public Status", href: "/status", icon: Activity },
    { label: "PR Risk Radar", href: "/pr-radar", icon: ShieldCheck },
    { label: "Security & Compliance", href: "/compliance", icon: Shield },
    { label: "Developer Tools", href: "/developer-tools", icon: Terminal },
    { label: "Tech Debt Cleanup", href: "/tech-debt", icon: Wrench },
    { label: "Integrations", href: "/integrations", icon: Plug },
    { label: "Audit Logs", href: "/audit-logs", icon: Activity },
  ];

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
              {userRole ? userRole.toLowerCase() : "workspace"}
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

      {/* Repo Selector */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-[var(--border-default)]">
          <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Repository
          </label>
          <div className="relative">
            <select
              value={selectedRepo}
              onChange={(e) => {
                const nextRepo = e.target.value;
                const next = withRepoInSearchParams(
                  new URLSearchParams(searchParams.toString()),
                  nextRepo,
                );
                router.push(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`);
              }}
              className="input select w-full text-xs py-2 pl-8 pr-8 bg-[var(--bg-surface)] border-[var(--border-default)] rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              disabled={repoLoading}
            >
              <option value="">{repoLoading ? "Loading repositories..." : "All repositories"}</option>
              {repos.map((r) => (
                <option key={r.id} value={r.full_name}>
                  {r.full_name}
                </option>
              ))}
            </select>
            <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("#")[0]);
          return (
            <Link
              key={item.href}
              href={navHref(item.href)}
              className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-hover)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-transparent"
              } ${collapsed ? "justify-center px-0 mx-auto w-10 h-10" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
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