"use client";

import { useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const HEALTH_URL = "https://api.jataka.io/health";

type HealthResponse = {
  status?: string;
  timestamp?: string;
  [key: string]: unknown;
};

export default function StatusPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runHealthCheck = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(HEALTH_URL, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Health check failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as HealthResponse;
      setHealth(payload);
      setLastCheckedAt(new Date().toISOString());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to check API health";
      setError(message);
      setHealth(null);
      setLastCheckedAt(new Date().toISOString());
    } finally {
      setIsLoading(false);
    }
  };

  const isHealthy = (health?.status || "").toLowerCase() === "healthy";

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 shadow-sm">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Activity size={22} />
            Public API Status
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Click the button to run a manual health check against
            <span className="ml-1 font-mono">{HEALTH_URL}</span>.
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={runHealthCheck}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Checking...
                </>
              ) : (
                "Check Now"
              )}
            </button>
          </div>

          {lastCheckedAt && (
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Last checked: {new Date(lastCheckedAt).toLocaleString()}
            </p>
          )}

          {health && !error && (
            <div className="mt-5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
              <p
                className={`flex items-center gap-2 text-sm font-medium ${
                  isHealthy ? "text-emerald-500" : "text-amber-500"
                }`}
              >
                {isHealthy ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                Status: {health.status || "unknown"}
              </p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                API timestamp: {health.timestamp || "not provided"}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-rose-400">
                <AlertCircle size={16} />
                {error}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
