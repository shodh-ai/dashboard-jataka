import { describe, expect, it } from "vitest";
import {
  PERSONA_NAVIGATION,
  parseDashboardPersona,
} from "./dashboard-persona";

describe("dashboard personas", () => {
  it.each([
    ["manager", "MANAGER"],
    ["SUPPORT", "SUPPORT"],
    ["architect", "ARCHITECT"],
    ["developer", "DEVELOPER"],
    ["auditor", "AUDITOR"],
    ["admin", "ADMIN"],
    ["requester", "REQUESTER"],
  ] as const)("parses %s as %s", (value, expected) => {
    expect(parseDashboardPersona(value)).toBe(expected);
  });

  it("rejects unknown persona values", () => {
    expect(parseDashboardPersona("superuser")).toBeUndefined();
    expect(parseDashboardPersona(undefined)).toBeUndefined();
  });

  it("keeps each persona navigation intentionally small", () => {
    for (const items of Object.values(PERSONA_NAVIGATION)) {
      expect(items[0]).toMatchObject({ label: "Overview", href: "/" });
      expect(items.length).toBeLessThanOrEqual(6);
    }
  });
});
