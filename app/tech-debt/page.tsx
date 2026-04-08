"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Wrench, Search, Trash2, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";

interface OrphanField {
  api_name: string;
  label: string;
}

export default function TechDebtPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [orphans, setOrphans] = useState<OrphanField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [repoId, setRepoId] = useState<string | null>(null);

  // Fetch the active brain/repo ID (similar to how your dashboard does it)
  useEffect(() => {
    async function fetchActiveBrain() {
      if (!isSignedIn) return;
      const token = await getToken();
      const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!BASE_API) return;

      try {
        const res = await fetch(`${BASE_API}/curriculum/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Find active brain
          const active = data.brains?.find((b: any) => b.id === data.activeBrainId) || data.brains?.[0];
          if (active) setRepoId(active.knowledgeBaseId);
        }
      } catch (e) {
        console.error("Failed to load repo ID", e);
      }
    }
    fetchActiveBrain();
  }, [isSignedIn, getToken]);

  const handleScan = async () => {
    if (!repoId) {
      setError("No active repository selected.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setHasScanned(false);

    try {
      const token = await getToken();
      const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
      
      // Point this to your proxy endpoint that hits the new Brum route
      const res = await fetch(`${BASE_API}/brum-proxy/repo/orphan-nodes?repo_id=${repoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to scan knowledge graph.");
      
      const data = await res.json();
      setOrphans(data.orphans || []);
      setHasScanned(true);
    } catch (err: any) {
      setError(err.message || "An error occurred during scanning.");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] min-h-screen">
      <header className="sticky top-0 z-30 flex items-center border-b border-[var(--border-default)] bg-[var(--bg-base)] px-6 lg:px-10 h-14">
        <h1 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
          <Wrench size={16} className="text-[var(--accent)]" />
          Tech Debt Cleanup
        </h1>
      </header>

      <div className="px-6 lg:px-10 py-8 max-w-6xl mx-auto">
        
        {/* Sales Pitch Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Autonomous Org Optimization</h2>
          <p className="text-[var(--text-secondary)] max-w-3xl">
            Jataka's Neo4j Knowledge Graph continuously maps your Salesforce metadata. 
            Because we understand every dependency, we can definitively identify <strong>"Orphaned Fields"</strong>—fields that take up space but are never referenced by Apex, Flows, or Layouts.
          </p>
        </div>

        {/* Action Card */}
        <div className="card p-6 mb-8 bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Scan for Dead Weight</h3>
            <p className="text-sm text-[var(--text-muted)] mt-1">Analyze the graph to find fields safe for deletion.</p>
          </div>
          <button 
            onClick={handleScan} 
            disabled={loading || !repoId}
            className="btn-primary flex items-center gap-2 py-2.5 px-6"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Search size={16} />
            )}
            {loading ? "Scanning Graph..." : "Run Dependency Scan"}
          </button>
        </div>

        {error && (
          <div className="p-4 mb-8 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg flex items-center gap-3">
            <AlertTriangle size={18} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Results Area */}
        {hasScanned && (
          <div className="animate-in fade-in duration-500">
            {/* ROI Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="card p-5 border-l-4 border-emerald-500">
                <div className="text-sm text-[var(--text-secondary)]">Orphaned Fields Detected</div>
                <div className="text-3xl font-bold text-[var(--text-primary)] mt-1">{orphans.length}</div>
              </div>
              <div className="card p-5 border-l-4 border-indigo-500">
                <div className="text-sm text-[var(--text-secondary)]">Estimated SOQL Speedup</div>
                <div className="text-3xl font-bold text-[var(--text-primary)] mt-1">
                  {orphans.length > 50 ? "~12%" : orphans.length > 10 ? "~4%" : "< 1%"}
                </div>
              </div>
              <div className="card p-5 border-l-4 border-[var(--accent)]">
                <div className="text-sm text-[var(--text-secondary)]">Manual Hours Saved</div>
                <div className="text-3xl font-bold text-[var(--text-primary)] mt-1">
                  {Math.round(orphans.length * 0.5)} hrs
                </div>
              </div>
            </div>

            {/* Next Steps CTA for GitHub */}
            {orphans.length > 0 && (
              <div className="p-5 mb-8 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-500 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)]">Ready for Autonomous Cleanup</h4>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      To safely delete these fields and refactor messy Apex, go to any GitHub Pull Request and type: <br/>
                      <code className="bg-[var(--bg-base)] px-2 py-1 rounded text-indigo-400 mt-2 inline-block font-mono text-xs">
                        /jataka clean tech debt
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Data Table */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex justify-between items-center">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Trash2 size={16} className="text-[var(--text-muted)]" />
                  Removable Fields List
                </h3>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {orphans.length === 0 ? (
                  <div className="p-10 text-center text-[var(--text-muted)]">
                    <CheckCircle size={32} className="mx-auto mb-3 text-emerald-500/50" />
                    <p>Your org is perfectly clean! No orphaned fields found.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[var(--bg-base)] text-[var(--text-secondary)] uppercase text-[11px] tracking-wider sticky top-0 shadow-sm">
                      <tr>
                        <th className="px-5 py-3 font-medium">Field API Name</th>
                        <th className="px-5 py-3 font-medium">UI Label</th>
                        <th className="px-5 py-3 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)]">
                      {orphans.map((field) => (
                        <tr key={field.api_name} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-[var(--text-primary)]">{field.api_name}</td>
                          <td className="px-5 py-3 text-[var(--text-secondary)]">{field.label}</td>
                          <td className="px-5 py-3 text-right">
                            <span className="badge badge-rose bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              Idle Node
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
