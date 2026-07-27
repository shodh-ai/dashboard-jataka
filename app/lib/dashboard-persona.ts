export const DASHBOARD_PERSONAS = [
  "MANAGER",
  "SUPPORT",
  "ARCHITECT",
  "DEVELOPER",
  "AUDITOR",
  "ADMIN",
  "REQUESTER",
] as const;

export type DashboardPersona = (typeof DASHBOARD_PERSONAS)[number];

export type PersonaIcon =
  | "manager"
  | "support"
  | "architect"
  | "developer"
  | "auditor"
  | "admin"
  | "requester";

export interface PersonaDefinition {
  id: DashboardPersona;
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: PersonaIcon;
  homePath: string;
}

export interface PersonaNavigationItem {
  label: string;
  href: string;
  icon:
    | "overview"
    | "graph"
    | "tests"
    | "status"
    | "risk"
    | "compliance"
    | "knowledge"
    | "ask"
    | "support"
    | "manager"
    | "roi"
    | "drift"
    | "audit"
    | "automation"
    | "demo"
    | "developer"
    | "debt"
    | "integrations"
    | "logs";
}

export const PERSONA_DEFINITIONS: Record<
  DashboardPersona,
  PersonaDefinition
> = {
  MANAGER: {
    id: "MANAGER",
    slug: "manager",
    label: "Manager",
    shortLabel: "Manager",
    description: "Outcomes, risk, ROI, and decisions that need attention.",
    icon: "manager",
    homePath: "/",
  },
  SUPPORT: {
    id: "SUPPORT",
    slug: "support",
    label: "Support Operator",
    shortLabel: "Support",
    description: "Triage cases, verify evidence, and coordinate resolution.",
    icon: "support",
    homePath: "/",
  },
  ARCHITECT: {
    id: "ARCHITECT",
    slug: "architect",
    label: "Architect",
    shortLabel: "Architect",
    description: "System design, workflow health, drift, and technical risk.",
    icon: "architect",
    homePath: "/",
  },
  DEVELOPER: {
    id: "DEVELOPER",
    slug: "developer",
    label: "Developer",
    shortLabel: "Developer",
    description: "Build, test, diagnose, and resolve engineering work.",
    icon: "developer",
    homePath: "/",
  },
  AUDITOR: {
    id: "AUDITOR",
    slug: "auditor",
    label: "Auditor",
    shortLabel: "Auditor",
    description: "Controls, evidence, compliance, and immutable history.",
    icon: "auditor",
    homePath: "/",
  },
  ADMIN: {
    id: "ADMIN",
    slug: "admin",
    label: "Platform Admin",
    shortLabel: "Admin",
    description: "Connections, configuration, automation, and platform health.",
    icon: "admin",
    homePath: "/",
  },
  REQUESTER: {
    id: "REQUESTER",
    slug: "requester",
    label: "Requester",
    shortLabel: "Requester",
    description: "Ask for help, find answers, and follow service status.",
    icon: "requester",
    homePath: "/",
  },
};

export const PERSONA_NAVIGATION: Record<
  DashboardPersona,
  PersonaNavigationItem[]
> = {
  MANAGER: [
    { label: "Overview", href: "/", icon: "overview" },
    {
      label: "Decision Queue",
      href: "/manager/decisions",
      icon: "manager",
    },
    { label: "ROI Analytics", href: "/roi-analytics", icon: "roi" },
    { label: "Public Status", href: "/status", icon: "status" },
  ],
  SUPPORT: [
    { label: "Overview", href: "/", icon: "overview" },
    { label: "Support Queue", href: "/support-ops", icon: "support" },
    { label: "Knowledge Q&A", href: "/knowledge-qa", icon: "knowledge" },
    { label: "Auto Resolution", href: "/auto-resolution", icon: "automation" },
    { label: "Ask Support", href: "/ask", icon: "ask" },
  ],
  ARCHITECT: [
    { label: "Overview", href: "/", icon: "overview" },
    { label: "Dependency Graph", href: "/dependency-graph", icon: "graph" },
    { label: "Active Tests", href: "/active-tests", icon: "tests" },
    { label: "PR Risk Radar", href: "/pr-radar", icon: "risk" },
    {
      label: "Configuration Drift",
      href: "/configuration-drift",
      icon: "drift",
    },
    { label: "Tech Debt", href: "/tech-debt", icon: "debt" },
  ],
  DEVELOPER: [
    { label: "Overview", href: "/", icon: "overview" },
    { label: "Active Tests", href: "/active-tests", icon: "tests" },
    { label: "PR Risk Radar", href: "/pr-radar", icon: "risk" },
    { label: "Developer Tools", href: "/developer-tools", icon: "developer" },
    { label: "Knowledge Q&A", href: "/knowledge-qa", icon: "knowledge" },
    { label: "Ask Support", href: "/ask", icon: "ask" },
  ],
  AUDITOR: [
    { label: "Overview", href: "/", icon: "overview" },
    {
      label: "Security & Compliance",
      href: "/compliance",
      icon: "compliance",
    },
    { label: "Auditor", href: "/auditor", icon: "audit" },
    { label: "Audit Logs", href: "/audit-logs", icon: "logs" },
    { label: "ROI Analytics", href: "/roi-analytics", icon: "roi" },
  ],
  ADMIN: [
    { label: "Overview", href: "/", icon: "overview" },
    { label: "Integrations", href: "/integrations", icon: "integrations" },
    { label: "Auto Resolution", href: "/auto-resolution", icon: "automation" },
    {
      label: "Resolution Demo",
      href: "/auto-resolution-demo",
      icon: "demo",
    },
    { label: "Audit Logs", href: "/audit-logs", icon: "logs" },
    { label: "Public Status", href: "/status", icon: "status" },
  ],
  REQUESTER: [
    { label: "Overview", href: "/", icon: "overview" },
    { label: "Ask Support", href: "/ask", icon: "ask" },
    { label: "Knowledge Q&A", href: "/knowledge-qa", icon: "knowledge" },
    { label: "Public Status", href: "/status", icon: "status" },
  ],
};

export function parseDashboardPersona(
  value: unknown,
): DashboardPersona | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return DASHBOARD_PERSONAS.find(
    (persona) =>
      persona.toLowerCase() === normalized ||
      PERSONA_DEFINITIONS[persona].slug === normalized,
  );
}
