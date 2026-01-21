"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, GitBranch, Database, CheckCircle, AlertTriangle } from "lucide-react"; 

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

function GithubCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  
  // New State Variables
  const [status, setStatus] = useState<"loading" | "selecting" | "linking" | "success" | "error">("loading");
  const [brains, setBrains] = useState<any[]>([]);
  const [selectedBrain, setSelectedBrain] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  const installationId = searchParams.get("installation_id");

  // Effect 1: Load the list of brains immediately
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !installationId) return;

    const fetchBrains = async () => {
      try {
        const token = await getToken();
        if (!token || !BASE_API) return;

        const res = await fetch(`${BASE_API}/curriculum/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.brains) ? data.brains : [];
          setBrains(list);
          // Pre-select active or first brain
          const initial = list.find((b: any) => b.id === data.activeBrainId) || list[0];
          if (initial) setSelectedBrain(initial.knowledgeBaseId);
          
          setStatus("selecting"); // Show form instead of spinner
        } else {
          throw new Error("Failed to load brains");
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
        setErrorMsg("Could not load available brains.");
      }
    };

    fetchBrains();
  }, [isLoaded, isSignedIn, installationId, getToken]);

  // Handler: User clicks confirm
  const handleConfirm = async () => {
    setStatus("linking");
    try {
      const token = await getToken();
      if (!BASE_API || !token) throw new Error("Auth error");

      const res = await fetch(`${BASE_API}/integrations/github/link-installation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          installation_id: installationId,
          target_curriculum_id: selectedBrain // <--- Sending the choice
        }),
      });

      if (!res.ok) throw new Error("Link failed");

      setStatus("success");
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg("Failed to link repository.");
    }
  };

  if (!installationId) return <div className="p-8 text-center text-white">Invalid Callback URL</div>;

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-8 shadow-2xl border border-slate-800">
        
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
              <img src="/github.png" className="h-8 w-8 opacity-90" alt="GitHub" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white">GitHub Integration</h2>
          <p className="mt-2 text-sm text-slate-400">
            {status === "selecting" ? "Select a Brain for this repository" : 
             status === "linking" ? "Connecting..." : 
             status === "success" ? "Connected!" : 
             status === "error" ? errorMsg : "Loading..."}
          </p>
        </div>

        {/* Selection Form */}
        {status === "selecting" && (
          <div className="space-y-6">
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
            <button
              onClick={handleConfirm}
              disabled={!selectedBrain}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Connect Repository
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
