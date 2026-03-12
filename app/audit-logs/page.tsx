"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Loader2, Activity, ShieldAlert, CheckCircle2 } from "lucide-react";
import Sidebar from "../components/Sidebar";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

interface UsageLog {
  id: string;
  createdAt: string;
  userEmail: string;
  action: string;
  creditsUsed: number;
  result: string;
}

export default function AuditLogsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      if (isSignedIn) {
        try {
          const token = await getToken();
          const res = await fetch(`${BASE_API}/integrations/github/usage-logs`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.logs) setLogs(data.logs);
        } catch (error) {
          console.error("Failed to fetch logs", error);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchLogs();
  }, [isSignedIn, getToken]);

  if (!isLoaded || !isSignedIn) return <div className="min-h-screen bg-[var(--bg-base)]" />;

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName="Jataka" userRole="ARCHITECT" />
      
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Activity className="text-blue-500" /> Audit Logs
              </h1>
              <p className="text-slate-400 text-sm mt-1">Chronological ledger of credit consumption and system actions.</p>
            </div>
          </div>

          <div className="card overflow-hidden border border-slate-700 bg-slate-900 shadow-xl rounded-xl">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No usage logs found yet. Run a PR to generate data.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 border-b border-slate-700 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Timestamp</th>
                    <th className="px-6 py-4 font-medium">User / Actor</th>
                    <th className="px-6 py-4 font-medium">Action</th>
                    <th className="px-6 py-4 font-medium">Credits</th>
                    <th className="px-6 py-4 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{log.userEmail}</td>
                      <td className="px-6 py-4">
                        <span className="badge badge-indigo">{log.action}</span>
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {log.creditsUsed > 0 ? (
                          <span className="text-red-400">-{log.creditsUsed}</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {log.result.includes("Blocked") ? (
                            <ShieldAlert size={14} className="text-red-400" />
                          ) : (
                            <CheckCircle2 size={14} className="text-emerald-400" />
                          )}
                          <span className={log.result.includes("Blocked") ? "text-red-400" : "text-emerald-400"}>
                            {log.result}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
