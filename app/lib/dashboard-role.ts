export type DashboardRole = "ARCHITECT" | "AUDITOR" | "DEVELOPER" | "";

const ARCHITECT_ROLES = new Set([
  "architect",
  "senior",
  "teacher",
  "admin",
  "org:admin",
]);

const AUDITOR_ROLES = new Set(["auditor", "org:auditor"]);

export function normalizeDashboardRole(role: unknown): Exclude<DashboardRole, ""> {
  const normalized = typeof role === "string" ? role.trim().toLowerCase() : "";

  if (ARCHITECT_ROLES.has(normalized)) return "ARCHITECT";
  if (AUDITOR_ROLES.has(normalized)) return "AUDITOR";

  // Unknown roles fail closed to the standard, non-privileged dashboard role.
  return "DEVELOPER";
}

export function canViewRoiAnalytics(role: DashboardRole): boolean {
  return role === "ARCHITECT" || role === "AUDITOR";
}
