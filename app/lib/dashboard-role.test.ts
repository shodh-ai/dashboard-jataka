import { describe, expect, it } from "vitest";
import {
  canViewRoiAnalytics,
  normalizeDashboardRole,
} from "./dashboard-role";

describe("dashboard role access", () => {
  it.each([
    ["senior", "ARCHITECT"],
    ["org:admin", "ARCHITECT"],
    ["architect", "ARCHITECT"],
    ["org:auditor", "AUDITOR"],
    ["auditor", "AUDITOR"],
    ["org:member", "DEVELOPER"],
    ["unexpected-role", "DEVELOPER"],
    [undefined, "DEVELOPER"],
  ])("normalizes %s to %s", (sourceRole, expectedRole) => {
    expect(normalizeDashboardRole(sourceRole)).toBe(expectedRole);
  });

  it("limits ROI analytics to architects and auditors", () => {
    expect(canViewRoiAnalytics("ARCHITECT")).toBe(true);
    expect(canViewRoiAnalytics("AUDITOR")).toBe(true);
    expect(canViewRoiAnalytics("DEVELOPER")).toBe(false);
    expect(canViewRoiAnalytics("")).toBe(false);
  });
});
