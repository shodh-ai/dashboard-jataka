"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Terminal, Plug, Check, Copy, Key, ExternalLink } from "lucide-react";
import Sidebar from "../components/Sidebar";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function DeveloperToolsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const [orgName, setOrgName] = useState("");
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("");

  const [brains, setBrains] = useState<any[]>([]);
  const[activeBrain, setActiveBrain] = useState("");
  const [newBrainName, setNewBrainName] = useState("");
  const[creatingBrain, setCreatingBrain] = useState(false);
  
  const [tokenPreview, setTokenPreview] = useState("");
  const [copiedToken, setCopiedToken] = useState(false);
  const[copiedSlack, setCopiedSlack] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      if (!isLoaded || !isSignedIn) return;

      const token = await getToken();
      if (!token) return;
      setTokenPreview(`${token.slice(0, 16)}...`);

      if (BASE_API) {
        try {
          // Sync user
          const syncRes = await fetch(`${BASE_API}/auth/sync`, { headers: { Authorization: `Bearer ${token}` } });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            const orgData = syncData.org || syncData.organization || {};
            const rawRole = syncData.user?.role || syncData.orgRole || "";
            setOrgName(orgData.name || syncData.orgName || syncData.organizationName || "Jataka");
            setUserRole(rawRole === "senior" || rawRole === "org:admin" || rawRole === "admin" ? "ARCHITECT" : "DEVELOPER");
          }

          // Fetch Brains
          const brainsRes = await fetch(`${BASE_API}/curriculum/list`, { headers: { Authorization: `Bearer ${token}` } });
          if (brainsRes.ok) {
            const brainsData = await brainsRes.json();
            const list = Array.isArray(brainsData.brains) ? brainsData.brains :[];
            setBrains(list);
            if (list.length > 0) {
              setActiveBrain(brainsData.activeBrainId || list[0].knowledgeBaseId);
            }
          }
        } catch (e) {
          console.error("Failed to bootstrap developer tools", e);
        }
      }
    }
    bootstrap();
  }, [isLoaded, isSignedIn, getToken]);

  const handleSlackInstall = () => {
    if (!BASE_API) return;
    window.location.href = `${BASE_API}/slack/install`;
  };

  const handleConnectVsCode = async () => {
    const token = await getToken();
    if (!token) return;
    const extensionId = "ShodhAI.Jataka";
    const params = new URLSearchParams({ token });
    if (activeBrain) params.append("curriculumId", activeBrain);
    window.location.href = `vscode://${extensionId}/auth?${params.toString()}`;
  };

  const handleCreateBrain = async () => {
    const token = await getToken();
    if (!token || !newBrainName.trim() || !BASE_API) return;

    try {
      setCreatingBrain(true);
      const res = await fetch(`${BASE_API}/curriculum/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newBrainName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create brain");
      setNewBrainName("");
      window.location.reload(); // Quick refresh to grab new brains
    } catch (error: any) {
      alert(error?.message || "Failed to create brain");
    } finally {
      setCreatingBrain(false);
    }
  };

  const copyToken = async () => {
    const token = await getToken();
    if (!token) return;
    // Include selected brain so IDE manual paste can initialize the correct knowledge base.
    const payload = activeBrain
      ? JSON.stringify({ token, curriculumId: activeBrain })
      : token;
    await navigator.clipboard.writeText(payload);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 1500);
  };

  const copySlackCommand = async () => {
    const command = `/connect ${user?.primaryEmailAddress?.emailAddress || "user@example.com"}`;
    await navigator.clipboard.writeText(command);
    setCopiedSlack(true);
    setTimeout(() => setCopiedSlack(false), 1500);
  };

  if (!isLoaded || !isSignedIn) {
    return <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-[var(--accent)]" /></div>;
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName={orgName} userRole={userRole} />
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Developer Tools</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Connect local and team environments to your AI backend.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Slack Card */}
            <div className="card p-6">
              <div className="flex items-center gap-2 text-lg font-semibold mb-4"><Terminal size={18} /> Slack Integration</div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">Get notifications, approve PRs, and run test queries directly in Slack.</p>
              <button onClick={handleSlackInstall} className="btn-secondary w-full">
                <MessageSquare size={16} /> Connect Workspace
              </button>
              
              <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
                <label className="text-xs text-[var(--text-muted)] uppercase font-semibold">User Pairing Command</label>
                <div className="mt-2 flex items-center gap-2 rounded bg-[var(--bg-base)] px-3 py-2 border border-[var(--border-default)]">
                  <code className="flex-1 text-xs text-[var(--text-secondary)] font-mono truncate">/connect {user?.primaryEmailAddress?.emailAddress || "user"}</code>
                  <button onClick={copySlackCommand} className="hover:text-white text-[var(--text-muted)]">
                    {copiedSlack ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* VS Code Card */}
            <div className="card p-6">
              <div className="flex items-center gap-2 text-lg font-semibold mb-4"><Plug size={18} /> VS Code Extension</div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">Sync your active brain and generate unit tests directly in your IDE.</p>
              
              <select
                className="input select text-sm py-2 mb-3"
                value={activeBrain}
                onChange={(e) => setActiveBrain(e.target.value)}
              >
                {brains.length > 0 ? brains.map((b: any) => (
                  <option key={b.id} value={b.knowledgeBaseId}>{b.name}</option>
                )) : <option value="">No brains found</option>}
              </select>

              <button onClick={handleConnectVsCode} className="btn-secondary w-full">
                <ExternalLink size={16} /> Authenticate IDE
              </button>

              <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
                <label className="text-xs text-[var(--text-muted)] uppercase font-semibold">Create New Brain</label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newBrainName}
                    onChange={(e) => setNewBrainName(e.target.value)}
                    className="input text-sm"
                    placeholder="E.g., Sales Cloud Brain"
                  />
                  <button
                    onClick={handleCreateBrain}
                    disabled={creatingBrain || !newBrainName.trim()}
                    className="btn-secondary whitespace-nowrap"
                  >
                    {creatingBrain ? <Loader2 size={14} className="animate-spin" /> : "Create"}
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
                <label className="text-xs text-[var(--text-muted)] uppercase font-semibold">Manual Auth Token</label>
                <div className="mt-2 flex items-center gap-2 rounded bg-[var(--bg-base)] px-3 py-2 border border-[var(--border-default)]">
                  <Key size={14} className="text-[var(--text-muted)]" />
                  <code className="flex-1 truncate text-xs text-[var(--text-secondary)] font-mono">{tokenPreview || "Loading..."}</code>
                  <button onClick={copyToken} className="hover:text-white text-[var(--text-muted)]">
                    {copiedToken ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
