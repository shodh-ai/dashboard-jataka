"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import Sidebar from "../Components/Sidebar";
import { AlertTriangle, CheckCircle, Database, Server, ExternalLink, GitPullRequest, Loader2 } from "lucide-react";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function PRRadarDashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRadarData() {
      if (!isSignedIn) return;
      try {
        const token = await getToken();
        const res = await fetch(`${BASE_API}/integrations/github/active-pr-health`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setReports(data.reports || []);
      } catch (e) {
        console.error("Failed to fetch PR Radar data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchRadarData();
  }, [isSignedIn, getToken]);

  if (!isLoaded || !isSignedIn) return null;

  // Bucket the data
  const criticalPRs = reports.filter(pr => pr.overallStatus === "CRITICAL");
  const warningPRs = reports.filter(pr => pr.overallStatus === "WARNING" || pr.overallStatus === "AT RISK");
  const safePRs = reports.filter(pr => pr.overallStatus === "SAFE" || pr.overallStatus === "HEALTHY");

  // Reusable Component for a PR Card
  const PRCard = ({ pr }: { pr: any }) => {
    // Safely extract metrics from the JSON we saved in the DB
    const metrics = Array.isArray(pr.metricsJson) ? pr.metricsJson : [];
    const soqlMetric = metrics.find((m: any) => m.metric.includes("SOQL"))?.percent || 0;
    const cpuMetric = metrics.find((m: any) => m.metric.includes("CPU"))?.percent || 0;
    const issues = Array.isArray(pr.issuesJson) ? pr.issuesJson : [];

    return (
      <div className="card p-4 border border-[var(--border-default)] hover:border-[var(--text-muted)] transition-colors bg-[var(--bg-surface)]">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-sm truncate pr-2" title={pr.title}>{pr.title}</h3>
          <a 
            href={`https://github.com/${pr.repoFullName}/pull/${pr.prNumber}`} 
            target="_blank" 
            rel="noreferrer"
            className="text-[var(--text-muted)] hover:text-white flex-shrink-0"
          >
            <ExternalLink size={14} />
          </a>
        </div>
        
        <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mb-4">
          <GitPullRequest size={12} /> PR #{pr.prNumber} • by <span className="font-medium text-[var(--text-primary)]">@{pr.author}</span>
        </div>

        {/* Limit Bottlenecks Row */}
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-1.5" title={`SOQL Limit Usage: ${soqlMetric}%`}>
            <Database size={14} className={soqlMetric > 80 ? "text-rose-500" : "text-[var(--text-secondary)]"} />
            <span className="text-xs font-medium">{soqlMetric}% SOQL</span>
          </div>
          <div className="flex items-center gap-1.5" title={`CPU Time Limit Usage: ${cpuMetric}%`}>
            <Server size={14} className={cpuMetric > 80 ? "text-amber-500" : "text-[var(--text-secondary)]"} />
            <span className="text-xs font-medium">{cpuMetric}% CPU</span>
          </div>
        </div>

        {/* AI Identified Issues Tags */}
        {issues.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-[var(--border-default)]">
            {issues.slice(0, 3).map((issue: any, idx: number) => (
              <span 
                key={idx} 
                className={`text-[10px] px-2 py-1 rounded font-medium ${
                  issue.severity === 'CRITICAL' 
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}
                title={issue.description}
              >
                {issue.type}
              </span>
            ))}
            {issues.length > 3 && (
              <span className="text-[10px] px-2 py-1 rounded bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                +{issues.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName="Your Org" userRole="ARCHITECT" />

      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center border-b border-[var(--border-default)] bg-[var(--bg-base)] px-6 h-14">
          <h1 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle size={16} className="text-[var(--accent)]" />
            Active PR Risk Radar
          </h1>
        </header>

        <div className="px-6 py-6 max-w-7xl mx-auto">
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Live triage view of active Pull Requests based on Jataka's Governor Limit profiling and Semantic Analysis.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
              <Loader2 size={24} className="animate-spin mr-2" /> Loading PR data...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* CRITICAL COLUMN */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2 border-b border-rose-500/30 pb-2">
                  <div className="bg-rose-500/20 p-1.5 rounded">
                    <AlertTriangle size={14} className="text-rose-500" />
                  </div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Critical Risk ({criticalPRs.length})</h2>
                </div>
                {criticalPRs.map(pr => <PRCard key={pr.id} pr={pr} />)}
                {criticalPRs.length === 0 && (
                  <div className="text-xs text-[var(--text-muted)] p-4 text-center border border-dashed border-[var(--border-default)] rounded-lg">
                    No critical PRs. Production is safe.
                  </div>
                )}
              </div>

              {/* WARNING COLUMN */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2 border-b border-amber-500/30 pb-2">
                  <div className="bg-amber-500/20 p-1.5 rounded">
                    <AlertTriangle size={14} className="text-amber-500" />
                  </div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Warnings ({warningPRs.length})</h2>
                </div>
                {warningPRs.map(pr => <PRCard key={pr.id} pr={pr} />)}
                {warningPRs.length === 0 && (
                  <div className="text-xs text-[var(--text-muted)] p-4 text-center border border-dashed border-[var(--border-default)] rounded-lg">
                    No warnings detected.
                  </div>
                )}
              </div>

              {/* SAFE COLUMN */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2 border-b border-emerald-500/30 pb-2">
                  <div className="bg-emerald-500/20 p-1.5 rounded">
                    <CheckCircle size={14} className="text-emerald-500" />
                  </div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Safe / Clean ({safePRs.length})</h2>
                </div>
                {safePRs.map(pr => <PRCard key={pr.id} pr={pr} />)}
                {safePRs.length === 0 && (
                  <div className="text-xs text-[var(--text-muted)] p-4 text-center border border-dashed border-[var(--border-default)] rounded-lg">
                    No safe PRs currently open.
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
