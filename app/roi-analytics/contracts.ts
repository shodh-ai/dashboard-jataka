export type RoiAnalyticsApiResponse = {
  totalTicketsDeflected: number;
  averageTimeToResolveSeconds: number | null;
  firstPassAccuracy: number | null;
  generatedAt?: string;
  periodStart?: string;
  periodEnd?: string;
};

export type RoiAnalytics = RoiAnalyticsApiResponse;

export const ROI_ANALYTICS_ENDPOINT = "/auto-resolution/analytics/roi";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (
      typeof value === "string" &&
      value.trim() &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }
  return undefined;
}

function nullableFiniteNumber(...values: unknown[]) {
  if (values.some((value) => value === null)) return null;
  return finiteNumber(...values);
}

function optionalString(...values: unknown[]) {
  return values.find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

export function normalizeRoiAnalytics(payload: unknown): RoiAnalytics {
  const envelope = asRecord(payload);
  const value = asRecord(
    envelope.roi || envelope.metrics || envelope.data || envelope,
  );

  const totalTicketsDeflected = finiteNumber(
    value.totalTicketsDeflected,
    value.total_tickets_deflected,
    value.ticketsDeflected,
  );
  const mttrMilliseconds = nullableFiniteNumber(
    value.averageTimeToResolveMs,
    value.average_time_to_resolve_ms,
    value.mttrMs,
  );
  const averageTimeToResolveSeconds =
    typeof mttrMilliseconds === "number"
      ? mttrMilliseconds / 1000
      : mttrMilliseconds === null
        ? null
        : nullableFiniteNumber(
          value.averageTimeToResolveSeconds,
          value.average_time_to_resolve_seconds,
          value.averageTimeToResolve,
          value.mttrSeconds,
        );
  const accuracyValue = nullableFiniteNumber(
    value.firstPassAccuracy,
    value.first_pass_accuracy,
    value.accuracyRate,
  );

  if (
    totalTicketsDeflected === undefined ||
    averageTimeToResolveSeconds === undefined ||
    accuracyValue === undefined
  ) {
    throw new Error("ROI analytics response is missing required metrics.");
  }

  const firstPassAccuracy =
    accuracyValue === null
      ? null
      : accuracyValue >= 0 && accuracyValue <= 1
        ? accuracyValue * 100
        : accuracyValue;

  if (
    totalTicketsDeflected < 0 ||
    (averageTimeToResolveSeconds !== null &&
      averageTimeToResolveSeconds < 0) ||
    (firstPassAccuracy !== null &&
      (firstPassAccuracy < 0 || firstPassAccuracy > 100))
  ) {
    throw new Error("ROI analytics response contains invalid metric values.");
  }

  return {
    totalTicketsDeflected,
    averageTimeToResolveSeconds,
    firstPassAccuracy,
    generatedAt: optionalString(value.generatedAt, value.generated_at),
    periodStart: optionalString(
      value.periodStart,
      value.period_start,
      asRecord(value.period).from,
    ),
    periodEnd: optionalString(
      value.periodEnd,
      value.period_end,
      asRecord(value.period).to,
    ),
  };
}

export function formatMttr(totalSeconds: number) {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainder}s`;
  }
  return `${remainder}s`;
}
