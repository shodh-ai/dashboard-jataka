import { describe, expect, it } from "vitest";
import { presentAuditEvent, selectClientProgressEvents } from "./audit-presenter";

const event = (eventType: string, createdAt: string, policyDecision?: string) => ({
  eventType,
  actorType: "system",
  createdAt,
  policyDecision,
});

describe("client audit presentation", () => {
  it("shows the latest classification and completed lifecycle stages", () => {
    const events = [
      event("RECEIVED", "2026-07-22T00:00:00Z"),
      event("CLASSIFIED", "2026-07-22T00:00:01Z", "Initial diagnosis"),
      event("DIAGNOSTIC_COMPLETED", "2026-07-22T00:00:02Z", "Permission failure found"),
      event("CLASSIFIED", "2026-07-22T00:00:03Z", "Promoted to safe change"),
      event("PROPOSAL_CREATED", "2026-07-22T00:00:04Z"),
      event("APPROVED", "2026-07-22T00:00:05Z"),
      event("EXECUTED", "2026-07-22T00:00:06Z"),
      event("VALIDATED", "2026-07-22T00:00:07Z"),
      event("RESOLVED", "2026-07-22T00:00:08Z"),
    ];

    const selected = selectClientProgressEvents(events);

    expect(selected.map((item) => item.eventType)).toEqual([
      "RECEIVED",
      "CLASSIFIED",
      "DIAGNOSTIC_COMPLETED",
      "PROPOSAL_CREATED",
      "APPROVED",
      "EXECUTED",
      "VALIDATED",
      "RESOLVED",
    ]);
    expect(selected[1].policyDecision).toBe("Promoted to safe change");
  });

  it("presents live diagnostics as a real customer-facing milestone", () => {
    const presentation = presentAuditEvent(
      event("DIAGNOSTIC_COMPLETED", "2026-07-22T00:00:00Z", "Permission failure found"),
    );

    expect(presentation.title).toBe("Live Salesforce check completed");
    expect(presentation.summary).toBe("Permission failure found.");
    expect(presentation.tone).toBe("success");
  });

  it("does not expose internal reviewer notes in the customer timeline", () => {
    const presentation = presentAuditEvent(
      event("APPROVED", "2026-07-22T00:00:00Z", "Internal demo-only approval note"),
    );

    expect(presentation.summary).toBe("A reviewer approved the recommended solution.");
    expect(presentation.summary).not.toContain("demo-only");
  });
});
