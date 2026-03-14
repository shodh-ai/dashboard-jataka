"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  CheckCircle,
  Loader2,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Plug,
  Github,
  MessageSquare,
  Terminal,
  Key,
  Copy,
  Check,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import {
  getJiraStatus,
  connectJira,
  updateJiraProjectKey,
  disconnectJira,
  type JiraConnectionResponse,
} from "../../lib/jira-api";
import {
  getSalesforceStatus,
  connectSalesforce,
  disconnectSalesforce,
  syncSalesforceSchema,
  type SalesforceConnectionResponse,
} from "../../lib/salesforce-api";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "jataka-ai";
const GITHUB_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`;

export default function IntegrationsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("");
  const [orgName, setOrgName] = useState("");

  const [jiraConnected, setJiraConnected] = useState(false);
  const [checkingJira, setCheckingJira] = useState(false);
  const [jiraInfo, setJiraInfo] = useState<JiraConnectionResponse | null>(null);
  const [editingProjectKey, setEditingProjectKey] = useState(false);
  const [newProjectKey, setNewProjectKey] = useState("");

  const [salesforceConnections, setSalesforceConnections] = useState<SalesforceConnectionResponse[]>([]);
  const [checkingSalesforce, setCheckingSalesforce] = useState(false);
  const [isSyncingSchema, setIsSyncingSchema] = useState(false);
  const [isSyncingDependencies, setIsSyncingDependencies] = useState(false);

  const [brains, setBrains] = useState<any[]>([]);
  const [activeBrain, setActiveBrain] = useState("");
  const [newBrainName, setNewBrainName] = useState("");
  const [creatingBrain, setCreatingBrain] = useState(false);
  const [tokenPreview, setTokenPreview] = useState("");
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedSlack, setCopiedSlack] = useState(false);

  const refreshBrains = async (token: string) => {
    if (!BASE_API) return;
    const brainsRes = await fetch(`${BASE_API}/curriculum/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!brainsRes.ok) return;

    const brainsData = await brainsRes.json();
    const list = Array.isArray(brainsData.brains) ? brainsData.brains : [];
    setBrains(list);
    if (list.length > 0) {
      const current = list.find((b: any) => b.id === brainsData.activeBrainId);
      const selected = current || list[0];
      setActiveBrain(selected.knowledgeBaseId);
    }
  };

  const checkJiraConnection = async () => {
    try {
      setCheckingJira(true);
      const token = await getToken();
      if (!token) return;

      const data = await getJiraStatus(token);
      setJiraConnected(data.connected);
      if (data.connected) {
        setJiraInfo(data);
        setNewProjectKey(data.project_key || "");
      }
    } catch (error) {
      console.error("Failed to check Jira connection:", error);
      setJiraConnected(false);
    } finally {
      setCheckingJira(false);
    }
  };

  const checkSalesforceConnection = async () => {
    try {
      setCheckingSalesforce(true);
      const token = await getToken();
      if (!token) return;

      const data = await getSalesforceStatus(token);
      setSalesforceConnections(data || []);
    } catch (error) {
      console.error(error);
      setSalesforceConnections([]);
    } finally {
      setCheckingSalesforce(false);
    }
  };

  useEffect(() => {
    async function bootstrap() {
      if (!isLoaded || !isSignedIn) return;

      const token = await getToken();
      if (!token) return;
      setTokenPreview(`${token.slice(0, 16)}...`);

      if (BASE_API) {
        try {
          const [syncRes] = await Promise.all([
            fetch(`${BASE_API}/auth/sync`, { headers: { Authorization: `Bearer ${token}` } }),
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

          await refreshBrains(token);
        } catch (e) {
          console.error("Failed to bootstrap integrations page", e);
        }
      }

      await Promise.all([checkJiraConnection(), checkSalesforceConnection()]);

      const params = new URLSearchParams(window.location.search);
      const jiraStatus = params.get("jira");
      const salesforceStatus = params.get("salesforce");
      if (jiraStatus === "connected") {
        alert("✅ Jira connected successfully!");
        window.history.replaceState({}, "", "/integrations");
      } else if (jiraStatus === "error") {
        alert(`❌ Failed to connect Jira: ${params.get("message") || "Unknown error"}`);
        window.history.replaceState({}, "", "/integrations");
      }

      if (salesforceStatus === "connected") {
        alert("✅ Salesforce connected successfully!");
        window.history.replaceState({}, "", "/integrations");
      } else if (salesforceStatus === "error") {
        alert(`❌ Failed to connect Salesforce: ${params.get("message") || "Unknown error"}`);
        window.history.replaceState({}, "", "/integrations");
      }
    }

    bootstrap();
  }, [isLoaded, isSignedIn, getToken]);

  const handleConnectJira = async () => {
    const token = await getToken();
    if (!token) return;
    await connectJira(token);
  };

  const handleUpdateProjectKey = async () => {
    if (!newProjectKey.trim()) return;
    const token = await getToken();
    if (!token) return;
    await updateJiraProjectKey({ projectKey: newProjectKey.toUpperCase() }, token);
    setEditingProjectKey(false);
    await checkJiraConnection();
  };

  const handleDisconnectJira = async () => {
    if (!confirm("Are you sure you want to disconnect Jira?")) return;
    const token = await getToken();
    if (!token) return;
    await disconnectJira(token);
    await checkJiraConnection();
  };

  const handleConnectSalesforce = async (role: string) => {
    const token = await getToken();
    if (!token) return;
    await connectSalesforce(token, role);
  };

  const handleDisconnectSalesforce = async (role: string) => {
    if (!confirm("Disconnect this role?")) return;
    const token = await getToken();
    if (!token) return;
    await disconnectSalesforce(token, role);
    await checkSalesforceConnection();
  };

  const handleSyncSchema = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setIsSyncingSchema(true);
      await syncSalesforceSchema(token);
      alert("Schema sync started.");
    } finally {
      setIsSyncingSchema(false);
    }
  };

  const handleSyncDependencies = async () => {
    const token = await getToken();
    if (!token || !BASE_API) return;

    try {
      setIsSyncingDependencies(true);
      const res = await fetch(`${BASE_API}/api/integrations/salesforce/sync-dependencies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to start dependency sync");
      alert("Impact Graph sync started in background.");
    } catch (error: any) {
      alert(`Failed to sync impact graph: ${error.message}`);
    } finally {
      setIsSyncingDependencies(false);
    }
  };

  const handleSlackInstall = () => {
    if (!BASE_API) return;
    window.location.href = `${BASE_API}/slack/install`;
  };

  const handleGithubInstall = () => {
    window.location.href = GITHUB_INSTALL_URL;
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newBrainName.trim() }),
      });

      if (!res.ok) throw new Error("Failed to create brain");
      setNewBrainName("");
      await refreshBrains(token);
    } catch (error: any) {
      alert(error?.message || "Failed to create brain");
    } finally {
      setCreatingBrain(false);
    }
  };

  const copyToken = async () => {
    const token = await getToken();
    if (!token) return;
    await navigator.clipboard.writeText(token);
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
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-semibold">Integrations</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Manage Salesforce, Jira, Slack, VS Code, and GitHub in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2"><Terminal size={14} /> Slack</div>
              <button onClick={handleSlackInstall} className="btn-secondary w-full text-xs">
                <MessageSquare size={14} /> Connect Slack
              </button>
              <div className="mt-3 flex items-center gap-2 rounded bg-[var(--bg-base)] px-2 py-1.5 border border-[var(--border-default)]">
                <code className="flex-1 text-[10px] text-[var(--text-secondary)] font-mono truncate">/connect {user?.primaryEmailAddress?.emailAddress || "user"}</code>
                <button onClick={copySlackCommand}>
                  {copiedSlack ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-[var(--text-muted)]" />}
                </button>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2"><Github size={14} /> GitHub</div>
              <button onClick={handleGithubInstall} className="btn-secondary w-full text-xs">
                <ExternalLink size={14} /> Install GitHub App
              </button>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2"><Plug size={14} /> VS Code</div>
              <select
                className="input select text-xs py-1 px-2 min-h-0 h-8 mb-2"
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
              <button onClick={handleConnectVsCode} className="btn-secondary w-full text-xs">
                <ExternalLink size={14} /> Connect VS Code
              </button>
              <div className="mt-2 flex gap-2">
                <input
                  value={newBrainName}
                  onChange={(e) => setNewBrainName(e.target.value)}
                  className="input text-xs h-8"
                  placeholder="New brain name"
                />
                <button
                  onClick={handleCreateBrain}
                  disabled={creatingBrain || !newBrainName.trim()}
                  className="btn-secondary text-xs whitespace-nowrap"
                >
                  {creatingBrain ? "Creating..." : "Create"}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded bg-[var(--bg-base)] px-2 py-1.5 border border-[var(--border-default)]">
                <Key size={12} className="text-[var(--text-muted)]" />
                <code className="flex-1 truncate text-[10px] text-[var(--text-secondary)] font-mono">{tokenPreview || "No token"}</code>
                <button onClick={copyToken}>
                  {copiedToken ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-[var(--text-muted)]" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Jira</h2>
                {jiraConnected && <span className="badge badge-emerald"><CheckCircle size={12} /> Connected</span>}
              </div>
              {checkingJira ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : jiraConnected && jiraInfo ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-[var(--text-muted)] text-xs">Site URL</label>
                    <p>{jiraInfo.site_url}</p>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] text-xs">Project Key</label>
                    {editingProjectKey ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={newProjectKey}
                          onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                          className="input text-xs h-8"
                        />
                        <button onClick={handleUpdateProjectKey} className="btn-secondary text-xs">Save</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <p>{jiraInfo.project_key || "Not set"}</p>
                        <button onClick={() => setEditingProjectKey(true)} className="text-xs text-[var(--accent)]">
                          {jiraInfo.project_key ? "Edit" : "Set"}
                        </button>
                      </div>
                    )}
                  </div>
                  {!jiraInfo.project_key && (
                    <div className="p-2 rounded border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2">
                      <AlertCircle size={13} /> Set a project key for automatic ticket creation.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleDisconnectJira} className="btn-secondary text-xs">Disconnect</button>
                    <button onClick={checkJiraConnection} className="btn-secondary text-xs">Refresh</button>
                  </div>
                </div>
              ) : (
                <button onClick={handleConnectJira} className="btn-secondary text-xs">
                  <ExternalLink size={14} /> Connect Jira
                </button>
              )}
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Salesforce</h2>
                {salesforceConnections.length > 0 && <span className="badge badge-emerald"><CheckCircle size={12} /> {salesforceConnections.length} Connected</span>}
              </div>

              {checkingSalesforce ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <div className="space-y-3">
                    {[
                      { id: "admin", label: "System Admin (Default)" },
                      { id: "sales_rep", label: "Sales Rep" },
                      { id: "manager", label: "Manager / Approver" },
                    ].map((role) => {
                      const conn = salesforceConnections.find((c) => c.actorRole === role.id);
                      return (
                        <div key={role.id} className="p-3 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">{role.label}</p>
                            <p className="text-xs text-[var(--text-muted)]">{conn ? `Connected: ${conn.sf_username}` : "Not connected"}</p>
                          </div>
                          {conn ? (
                            <button onClick={() => handleDisconnectSalesforce(role.id)} className="btn-secondary text-xs">Disconnect</button>
                          ) : (
                            <button onClick={() => handleConnectSalesforce(role.id)} className="btn-secondary text-xs">Connect</button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {salesforceConnections.some((c) => c.actorRole === "admin") && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-default)] grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button onClick={handleSyncSchema} disabled={isSyncingSchema} className="btn-secondary text-xs justify-center">
                        {isSyncingSchema ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Sync Schema
                      </button>
                      <button onClick={handleSyncDependencies} disabled={isSyncingDependencies} className="btn-secondary text-xs justify-center">
                        {isSyncingDependencies ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Sync Impact Graph
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
