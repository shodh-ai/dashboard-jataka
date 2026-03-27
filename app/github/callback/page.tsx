"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, GitBranch, Database, CheckCircle, AlertTriangle, Github } from "lucide-react"; 

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

interface Repository {
  id: number;
  full_name: string;
  default_branch: string;
}

function GithubCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  
  // State
  const [status, setStatus] = useState<"loading" | "selecting" | "linking" | "success" | "error">("loading");
  const [brains, setBrains] = useState<any[]>([]);
  const [selectedBrain, setSelectedBrain] = useState<string>("");
  
  // NEW: State for Repositories and Branch selection
  const [repos, setRepos] = useState<Repository[]>([]);
  const [repoBranches, setRepoBranches] = useState<Record<string, string>>({}); // Map: full_name -> branch_name

  const [errorMsg, setErrorMsg] = useState("");

  const installationId = searchParams.get("installation_id");

  // Effect: Load Brains AND Repositories
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !installationId) return;

    const fetchData = async () => {
      try {
        const token = await getToken();
        if (!token || !BASE_API) return;

        // 1. Fetch Brains
        const brainsRes = await fetch(`${BASE_API}/curriculum/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // 2. Fetch Repositories from GitHub Installation
        const reposRes = await fetch(`${BASE_API}/integrations/github/${installationId}/repositories`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (brainsRes.ok && reposRes.ok) {
          const brainsData = await brainsRes.json();
          const reposData = await reposRes.json();

          // Setup Brains
          const brainList = Array.isArray(brainsData.brains) ? brainsData.brains : [];
          setBrains(brainList);
          const initialBrain = brainList.find((b: any) => b.id === brainsData.activeBrainId) || brainList[0];
          if (initialBrain) setSelectedBrain(initialBrain.knowledgeBaseId);

          // Setup Repos & Default Branches
          const repoList: Repository[] = Array.isArray(reposData.repositories) ? reposData.repositories : [];
          setRepos(repoList);

          // Initialize branch map with default branches
          const initialBranchMap: Record<string, string> = {};
          repoList.forEach(r => {
            initialBranchMap[r.full_name] = r.default_branch;
          });
          setRepoBranches(initialBranchMap);
          
          setStatus("selecting");
        } else {
          throw new Error("Failed to load setup data");
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
        setErrorMsg("Could not load installation details.");
      }
    };

    fetchData();
  }, [isLoaded, isSignedIn, installationId, getToken]);

  // Handler: Update specific repo branch
  const handleBranchChange = (fullName: string, newBranch: string) => {
    setRepoBranches(prev => ({
        ...prev,
        [fullName]: newBranch
    }));
  };

  // Handler: User clicks confirm
  const handleConfirm = async () => {
    setStatus("linking");
    try {
      const token = await getToken();
      if (!BASE_API || !token) throw new Error("Auth error");

      // Construct the repositories payload
      const repositoriesPayload = repos.map(repo => ({
        full_name: repo.full_name,
        branch: repoBranches[repo.full_name] || repo.default_branch
      }));

      const res = await fetch(`${BASE_API}/integrations/github/link-installation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          installation_id: installationId,
          target_curriculum_id: selectedBrain,
          repositories: repositoriesPayload // <--- Sending the specific branches
        }),
      });

      if (!res.ok) throw new Error("Link failed");

      setStatus("success");
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg("Failed to link repositories.");
    }
  };

  if (!installationId) return <div className="p-8 text-center text-white">Invalid Callback URL</div>;

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 p-8 shadow-2xl border border-slate-800 max-h-[90vh] overflow-y-auto">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 ring-1 ring-white/10">
            {status === "loading" || status === "linking" ? (
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            ) : status === "success" ? (
              <CheckCircle className="h-8 w-8 text-green-500" />
            ) : status === "error" ? (
              <AlertTriangle className="h-8 w-8 text-red-500" />
            ) : (
              <Github className="h-8 w-8 opacity-90 text-white" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white">Configure Integration</h2>
          <p className="mt-2 text-sm text-slate-400">
            {status === "selecting" ? "Select Brain and verify branches" : 
             status === "linking" ? "Syncing repositories..." : 
             status === "success" ? "Connected successfully!" : 
             status === "error" ? errorMsg : "Loading configuration..."}
          </p>
        </div>

        {/* Selection Form */}
        {status === "selecting" && (
          <div className="space-y-6">
            
            {/* Brain Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Target Brain</label>
              <div className="relative">
                <select
                  value={selectedBrain}
                  onChange={(e) => setSelectedBrain(e.target.value)}
                  className="w-full appearance-none rounded-lg bg-slate-950 px-4 py-3 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {brains.map((b) => (
                    <option key={b.id} value={b.knowledgeBaseId}>{b.name}</option>
                  ))}
                </select>
                <Database className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            {/* Repo & Branch List */}
            <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Repositories to Sync</label>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {repos.length === 0 && (
                        <p className="text-sm text-slate-500 italic">No repositories found in this installation.</p>
                    )}
                    {repos.map((repo) => (
                        <div key={repo.id} className="rounded-lg bg-slate-950 p-3 ring-1 ring-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-white truncate max-w-[200px]" title={repo.full_name}>
                                    {repo.full_name}
                                </span>
                            </div>
                            <div className="relative">
                                <input 
                                    type="text"
                                    value={repoBranches[repo.full_name] || ""}
                                    onChange={(e) => handleBranchChange(repo.full_name, e.target.value)}
                                    className="w-full rounded bg-slate-900 px-8 py-1.5 text-xs text-slate-300 ring-1 ring-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                                    placeholder="Branch Name (e.g. main)"
                                />
                                <GitBranch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={!selectedBrain || repos.length === 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Start Sync
            </button>
          </div>
        )}

        {/* Error Return Button */}
        {status === "error" && (
           <button onClick={() => router.push("/")} className="w-full text-center text-sm text-slate-400 hover:text-white mt-4 underline">
             Return to Dashboard
           </button>
        )}
      </div>
    </div>
  );
}

export default function GithubCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
          <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        </div>
      }
    >
      <GithubCallbackInner />
    </Suspense>
  );
}
