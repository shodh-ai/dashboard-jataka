"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink, 
  GitPullRequest, 
  Loader2, 
  Clock, 
  Activity 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns"; // Make sure to: npm install date-fns

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function PRRadarDashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRadarData() {
      if (!isSignedIn || !BASE_API) {
        setLoading(false);
        return;
      }
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
  }, [isSignedIn, getToken, BASE_API]);

  if (!isLoaded || !isSignedIn) return null;

  // Aggregate Stats for Top Banner
  const criticalCount = reports.filter(pr => pr.overallStatus === "CRITICAL").length;
  const warningCount = reports.filter(pr => pr.overallStatus === "WARNING" || pr.overallStatus === "AT RISK").length;
  const safeCount = reports.filter(pr => pr.overallStatus === "SAFE" || pr.overallStatus === "HEALTHY").length;

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName="Your Org" userRole="ARCHITECT" />

      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center border-b border-[var(--border-default)] bg-[var(--bg-base)] px-6 h-14 shadow-sm">
          <h1 className="text-sm font-medium flex items-center gap-2">
            <Activity size={16} className="text-[var(--accent)]" />
            Active PR Risk Radar
          </h1>
        </header>

        <div className="px-6 py-6 max-w-7xl mx-auto">
          {/* Summary Banner */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider">Critical Risk</p>
                <p className="text-2xl font-bold text-rose-500 mt-1">{criticalCount}</p>
              </div>
              <AlertTriangle size={32} className="text-rose-500 opacity-50" />
            </div>
            <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-500 font-semibold uppercase tracking-wider">Warnings</p>
                <p className="text-2xl font-bold text-amber-500 mt-1">{warningCount}</p>
              </div>
              <AlertTriangle size={32} className="text-amber-500 opacity-50" />
            </div>
            <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wider">Safe & Clean</p>
                <p className="text-2xl font-bold text-emerald-500 mt-1">{safeCount}</p>
              </div>
              <CheckCircle size={32} className="text-emerald-500 opacity-50" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
              <Loader2 size={24} className="animate-spin mr-2" /> Analyzing Active PRs...
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-[var(--border-default)] rounded-lg text-[var(--text-secondary)]">
              No active PR reports found for your organization.
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-base)] border-b border-[var(--border-default)] text-xs text-[var(--text-secondary)] uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Pull Request</th>
                    <th className="px-4 py-3 font-medium">Health Status</th>
                    <th className="px-4 py-3 font-medium">Limit Bottlenecks</th>
                    <th className="px-4 py-3 font-medium">AI Risk Factors</th>
                    <th className="px-4 py-3 font-medium">Last Scanned</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {reports.map((pr) => (
                    <PRTableRow key={pr.id} pr={pr} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Table Row Component ---
function PRTableRow({ pr }: { pr: any }) {
  const metrics = Array.isArray(pr.metricsJson) ? pr.metricsJson : [];
  const issues = Array.isArray(pr.issuesJson) ? pr.issuesJson : [];

  // DYNAMIC METRICS: Only show metrics that are Warning (>75%) or Critical (>90%)
  const problematicMetrics = metrics.filter(
    (m: any) => m.status === 'CRITICAL' || m.status === 'WARNING' || m.percent >= 75
  );

  // Status Badge Logic
  let StatusBadge = null;
  if (pr.overallStatus === "CRITICAL") {
    StatusBadge = <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20 w-fit"><AlertTriangle size={12} /> Critical</span>;
  } else if (pr.overallStatus === "WARNING" || pr.overallStatus === "AT RISK") {
    StatusBadge = <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 w-fit"><AlertTriangle size={12} /> Warning</span>;
  } else {
    StatusBadge = <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 w-fit"><CheckCircle size={12} /> Safe</span>;
  }

  return (
    <tr className="hover:bg-[var(--bg-base)] transition-colors group">
      {/* PR Title & Repo Info */}
      <td className="px-4 py-4 align-top">
        <p className="font-semibold text-sm text-[var(--text-primary)] mb-1 truncate max-w-[250px]" title={pr.title}>
          {pr.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <GitPullRequest size={12} />
          <span className="truncate max-w-[150px]" title={pr.repoFullName}>{pr.repoFullName}</span>
          <span>•</span>
          <span className="font-medium">#{pr.prNumber}</span>
          <span>•</span>
          <span className="truncate max-w-[80px]" title={`@${pr.author}`}>@{pr.author}</span>
        </div>
      </td>

      {/* Health Status */}
      <td className="px-4 py-4 align-top">
        {StatusBadge}
      </td>

      {/* Limit Bottlenecks (Dynamic) */}
      <td className="px-4 py-4 align-top max-w-[250px]">
        {problematicMetrics.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {problematicMetrics.map((m: any, idx: number) => (
              <span 
                key={idx} 
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  m.percent >= 90 || m.status === 'CRITICAL' 
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}
                title={`Used ${m.used} out of ${m.limit}`}
              >
                {m.metric}: {m.percent}%
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[var(--text-muted)] italic">No limits near threshold</span>
        )}
      </td>

      {/* AI Risk Factors (Issues) */}
      <td className="px-4 py-4 align-top max-w-[250px]">
        {issues.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {issues.slice(0, 3).map((issue: any, idx: number) => (
              <span 
                key={idx} 
                className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-default)]"
                title={issue.description}
              >
                {issue.type}
              </span>
            ))}
            {issues.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                +{issues.length - 3} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-[var(--text-muted)] italic">No code risks detected</span>
        )}
      </td>

      {/* Timestamp */}
      <td className="px-4 py-4 align-top">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]" title={new Date(pr.updatedAt).toLocaleString()}>
          <Clock size={12} />
          {formatDistanceToNow(new Date(pr.updatedAt), { addSuffix: true })}
        </div>
      </td>

      {/* Action Button */}
      <td className="px-4 py-4 align-top text-right">
        <a 
          href={`https://github.com/${pr.repoFullName}/pull/${pr.prNumber}`}
          target="_blank" 
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--bg-base)] hover:bg-[var(--border-default)] text-[var(--text-primary)] border border-[var(--border-default)] rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          Visit PR <ExternalLink size={12} />
        </a>
      </td>
    </tr>
  );
}
