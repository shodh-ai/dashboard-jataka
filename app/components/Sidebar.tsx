"use client";

import { useUser, useOrganizationList, SignOutButton } from "@clerk/nextjs";
import { useState } from "react";
import {
  LayoutDashboard,
  Network,
  Settings,
  LogOut,
  ChevronDown,
  Brain,
  Users,
  ChevronsLeft,
  ChevronsRight,
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
    { label: "Graph Explorer", href: "/#graph", icon: Network },
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

  return (
    <aside
      className={`flex flex-col h-screen border-r border-[#1f1f1f] bg-[#0a0a0a] transition-all duration-200 ${
        collapsed ? "w-[60px]" : "w-[240px]"
      }`}
    >
      {/* Workspace Header */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-[#1f1f1f]">
        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-white flex items-center justify-center">
          <img src="/WhiteLOGO.svg" alt="Jataka" className="w-4 h-4 invert" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {orgName || "Jataka"}
            </p>
            <p className="text-[11px] text-[#666] truncate capitalize">
              {userRole.toLowerCase() || "member"}
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex-shrink-0 p-1 rounded hover:bg-[#1a1a1a] text-[#666] hover:text-white transition-colors"
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {filteredNav.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#888] hover:text-white hover:bg-[#111]"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-[#1f1f1f] px-2 py-3">
        <div
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#222] flex items-center justify-center text-[11px] font-medium text-white">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{displayName}</p>
              <SignOutButton>
                <button className="text-[11px] text-[#666] hover:text-red-400 transition-colors">
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
