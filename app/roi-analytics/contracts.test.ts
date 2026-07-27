import { describe, expect, it } from "vitest";
import {
  formatMttr,
  normalizeRoiAnalytics,
  ROI_ANALYTICS_ENDPOINT,
} from "./contracts";

describe("ROI analytics contract", () => {
  it("uses the required backend endpoint", () => {
    expect(ROI_ANALYTICS_ENDPOINT).toBe("/auto-resolution/analytics/roi");
  });

  it("normalizes the typed response and ratio accuracy", () => {
    expect(
      normalizeRoiAnalytics({
        totalTicketsDeflected: 1240,
        averageTimeToResolveSeconds: 105,
        firstPassAccuracy: 0.98,
        generatedAt: "2026-07-27T10:00:00.000Z",
      }),
    ).toEqual({
      totalTicketsDeflected: 1240,
      averageTimeToResolveSeconds: 105,
      firstPassAccuracy: 98,
      generatedAt: "2026-07-27T10:00:00.000Z",
      periodStart: undefined,
      periodEnd: undefined,
    });
  });

  it("supports wrapped snake-case audit aggregates", () => {
    expect(
      normalizeRoiAnalytics({
        metrics: {
          total_tickets_deflected: "42",
          average_time_to_resolve_ms: 105000,
          first_pass_accuracy: 97.5,
        },
      }),
    ).toMatchObject({
      totalTicketsDeflected: 42,
      averageTimeToResolveSeconds: 105,
      firstPassAccuracy: 97.5,
    });
  });

  it("rejects missing or invalid metrics instead of showing false zeros", () => {
    expect(() => normalizeRoiAnalytics({})).toThrow(
      "missing required metrics",
    );
    expect(() =>
      normalizeRoiAnalytics({
        totalTicketsDeflected: 4,
        averageTimeToResolveSeconds: -1,
        firstPassAccuracy: 101,
      }),
    ).toThrow("invalid metric values");
  });

  it("preserves honest no-data values for a newly connected organization", () => {
    expect(
      normalizeRoiAnalytics({
        totalTicketsDeflected: 0,
        averageTimeToResolveMs: null,
        firstPassAccuracy: null,
        period: {
          from: "2026-07-01T00:00:00.000Z",
          to: "2026-07-31T23:59:59.999Z",
        },
      }),
    ).toMatchObject({
      totalTicketsDeflected: 0,
      averageTimeToResolveSeconds: null,
      firstPassAccuracy: null,
      periodStart: "2026-07-01T00:00:00.000Z",
      periodEnd: "2026-07-31T23:59:59.999Z",
    });
  });

  it("formats MTTR for executive display", () => {
    expect(formatMttr(45)).toBe("45s");
    expect(formatMttr(105)).toBe("1m 45s");
    expect(formatMttr(7265)).toBe("2h 1m");
  });
});
