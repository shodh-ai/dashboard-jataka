"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Network, Loader2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import GraphVisualizer from "../components/GraphVisualizer";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function DependencyGraphPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgName, setOrgName] = useState("Jataka");
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("ARCHITECT");
  const [brains, setBrains] = useState<any[]>([]);
  const [activeBrain, setActiveBrain] = useState("");

  useEffect(() => {
    async function bootstrap() {
      if (!isLoaded || !isSignedIn || !BASE_API) return;
      const token = await getToken();
      if (!token) return;

      try {
        const [syncRes, brainsRes] = await Promise.all([
          fetch(`${BASE_API}/auth/sync`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE_API}/curriculum/list`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          const orgData = syncData.org || syncData.organization || {};
          const rawRole = syncData.user?.role || syncData.orgRole || "";
          setOrgName(orgData.name || syncData.orgName || syncData.organizationName || "Jataka");
          if (rawRole === "senior" || rawRole === "org:admin" || rawRole === "admin" || rawRole === "teacher") {
            setUserRole("ARCHITECT");
          } else {
            setUserRole("DEVELOPER");
          }
        }

        if (brainsRes.ok) {
          const brainsData = await brainsRes.json();
          const list = Array.isArray(brainsData.brains) ? brainsData.brains : [];
          setBrains(list);
          if (list.length > 0) {
            const current = list.find((b: any) => b.id === brainsData.activeBrainId);
            const selected = current || list[0];
            setActiveBrain(selected.knowledgeBaseId);
          }
        }
      } catch (e) {
        console.error("Failed to initialize dependency graph page", e);
      }
    }

    bootstrap();
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName={orgName} userRole={userRole} />
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Network size={18} /> Dependency Graph
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Explore impact chains and object dependencies from real graph data.
              </p>
            </div>

            <select
              className="input select text-xs py-1 px-2 min-h-0 h-8"
              value={activeBrain}
              onChange={async (e) => {
                const kb = e.target.value;
                setActiveBrain(kb);
                const brain = brains.find((b: any) => b.knowledgeBaseId === kb);
                const token = await getToken();
                if (brain && token && BASE_API) {
                  await fetch(`${BASE_API}/curriculum/switch`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ curriculumId: brain.id }),
                  });
                }
              }}
            >
              {brains.length > 0 ? brains.map((b: any) => (
                <option key={b.id} value={b.knowledgeBaseId}>{b.name}</option>
              )) : <option value="">No brains</option>}
            </select>
          </div>

          <div className="card overflow-hidden">
            <GraphVisualizer baseUrl={BASE_API} activeBrainId={activeBrain} />
          </div>
        </div>
      </div>
    </div>
  );
}
