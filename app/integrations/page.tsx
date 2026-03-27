"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
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
import Sidebar from "../components/Sidebar";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "jataka-ai";
const GITHUB_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`;

export default function IntegrationsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  


  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("");
  const [orgName, setOrgName] = useState("");

  const [jiraConnected, setJiraConnected] = useState(false);
  const [checkingJira, setCheckingJira] = useState(false);
  const [jiraInfo, setJiraInfo] = useState<JiraConnectionResponse | null>(null);
  const [editingProjectKey, setEditingProjectKey] = useState(false);
  const [newProjectKey, setNewProjectKey] = useState("");

  const [githubConnected, setGithubConnected] = useState(false);
  const [checkingGithub, setCheckingGithub] = useState(false);

  const [salesforceConnections, setSalesforceConnections] = useState<SalesforceConnectionResponse[]>([]);
  const [checkingSalesforce, setCheckingSalesforce] = useState(false);
  const [isSyncingSchema, setIsSyncingSchema] = useState(false);
  const [isSyncingDependencies, setIsSyncingDependencies] = useState(false);

  // --- API Key State ---
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const[newKeyName, setNewKeyName] = useState("Copado/GitHub Pipeline");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // --- Jira State ---
  const [jiraConnected, setJiraConnected] = useState(false);
  const [checkingJira, setCheckingJira] = useState(false);
  const[jiraInfo, setJiraInfo] = useState<JiraConnectionResponse | null>(null);
  const[editingProjectKey, setEditingProjectKey] = useState(false);
  const [newProjectKey, setNewProjectKey] = useState("");
  const [updatingJira, setUpdatingJira] = useState(false);

  // --- Progress Calculation ---
  const isSfAdminConnected = salesforceConnections.some((c) => c.actorRole === "admin");
  const hasActiveKeys = keys.some((k) => k.isActive);
  
  const completedSteps =[
    isGithubConnected, 
    isSfAdminConnected, 
    hasActiveKeys, 
    copiedYaml,
    jiraConnected 
  ].filter(Boolean).length;
  const progressPercentage = (completedSteps / 5) * 100; // Tracking all 5 steps for 100%

  // --- Initialization & Fetching ---
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const fetchOrg = async () => {
        const token = await getToken();
        if (token && BASE_API) {
          const syncRes = await fetch(`${BASE_API}/auth/sync`, { headers: { Authorization: `Bearer ${token}` } });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            const orgData = syncData.org || syncData.organization || {};
            const rawRole = syncData.user?.role || syncData.orgRole || "";
            setOrgName(orgData.name || syncData.orgName || syncData.organizationName || "Jataka");
            setUserRole(rawRole === "senior" || rawRole === "org:admin" || rawRole === "admin" ? "ARCHITECT" : "DEVELOPER");
          }
        }
      };
      
      fetchOrg();
      checkGithubConnection();
      checkJiraConnection();
      checkSalesforceConnection();
      fetchKeys();
      
      const params = new URLSearchParams(window.location.search);
      if (params.get("jira") === "connected") alert("✅ Jira connected!");
      if (params.get("salesforce") === "connected") alert("✅ Salesforce connected!");
      
      if (params.has("jira") || params.has("salesforce")) {
        window.history.replaceState({}, '', "/integrations");
      }
    }
  };

  const checkGithubConnection = async () => {
    if (!BASE_API) return;
    try {
      setCheckingGithub(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${BASE_API}/integrations/github/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch GitHub status");
      const data = await res.json();
      setGithubConnected(Boolean(data?.connected));
      console.log("[3-KEY-LOCK][UI] GitHub key status", {
        connected: Boolean(data?.connected),
        connectedBrains: data?.connected_brains,
        totalBrains: data?.total_brains,
      });
      
      if (res.ok) {
        const data = await res.json();
        setIsGithubConnected(Boolean(data.connected));
        if (data.installationId) {
          setInstallationId(String(data.installationId));
        }
      }
    } catch (error) {
      console.error("Failed to check GitHub connection:", error);
      setGithubConnected(false);
    } finally {
      setCheckingGithub(false);
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
      console.log("[3-KEY-LOCK][UI] Salesforce status", {
        totalConnections: Array.isArray(data) ? data.length : 0,
        hasAdmin: Array.isArray(data)
          ? data.some((c: any) => c.actorRole === "admin")
          : false,
      });
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

      await Promise.all([
        checkJiraConnection(),
        checkSalesforceConnection(),
        checkGithubConnection(),
      ]);

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
    console.log("[3-KEY-LOCK][UI] Initiating Salesforce connect", { role });
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

  // 👇 ADD THIS NEW FUNCTION 👇
  const handleDisconnectSalesforce = async (role: string) => {
    if (!confirm("Are you sure you want to disconnect this role?")) return;
    const token = await getToken();
    if (!token) return;
    try {
      await disconnectSalesforce(token, role);
      await checkSalesforceConnection();
    } catch (error) {
      console.error("Failed to disconnect Salesforce role", error);
      alert("Failed to disconnect role.");
    }
  };

  const handleSyncSchemaData = async () => {
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
      const res = await fetch(`${BASE_API}/integrations/salesforce/sync-dependencies`, {
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
    console.log("[3-KEY-LOCK][UI] Redirecting to GitHub installation", {
      salesforceAdminConnected: isSalesforceAdminConnected,
    });
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

  const webhookUrl = 'https://api.jataka.ai/api/integrations/github/trigger';
  const displayInstallId = installationId ? installationId : '"YOUR_INSTALLATION_ID"';
  
  const yamlSnippet = `- name: Trigger Jataka AI UI Tests
  # Put this step AFTER your Salesforce deployment step (Gearset, Copado, or SFDX)
  run: |
    curl --fail-with-body --show-error -X POST "${webhookUrl}" \\
      -H "Authorization: Bearer \${{ secrets.JATAKA_API_KEY }}" \\
      -H "Content-Type: application/json" \\
      -d '{
        "installation_id": ${displayInstallId}, 
        "repo_full_name": "\${{ github.repository }}",
        "branch": "\${{ github.head_ref || github.ref_name }}",
        "pr_number": \${{ github.event.pull_request.number || 'null' }},
        "user_email": "\${{ github.actor }}"
      }'`;

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
      
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-6xl mx-auto">
          
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Setup & Integrations</h1>
            <p className="text-slate-400 text-sm md:text-base">Complete these steps to fully automate your AI testing pipeline.</p>
            
            <div className="mt-6 bg-slate-800/50 rounded-full h-3 w-full border border-slate-700 overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500 ease-in-out relative"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <p className="text-xs text-blue-400 mt-2 font-medium tracking-wide">
              SETUP PROGRESS: {Math.round(Math.min(progressPercentage, 100))}%
            </p>
          </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar / Stepper */}
          <div className="lg:w-1/3 flex-shrink-0">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 sticky top-8">
              <nav className="space-y-2">
                {[
                  { id: 1, title: "1. Connect GitHub", icon: Github, isDone: isGithubConnected },
                  { id: 2, title: "2. Connect Salesforce", icon: Cloud, isDone: isSfAdminConnected },
                  { id: 3, title: "3. Generate API Key", icon: KeyRound, isDone: hasActiveKeys },
                  { id: 4, title: "4. Configure CI/CD", icon: TerminalSquare, isDone: copiedYaml },
                  { id: 5, title: "5. Optional Settings", icon: RefreshCw, isDone: jiraConnected },
                ].map((step) => (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
                        ${activeStep === step.id ? "bg-blue-600/20 border border-blue-500/50 text-blue-300" : "hover:bg-slate-800/50 text-slate-400 border border-transparent"}
                    `}
                  >
                    {step.isDone ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 opacity-40 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm flex-1">{step.title}</span>
                    {activeStep === step.id && <ChevronRight className="w-4 h-4 opacity-50" />}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:w-2/3">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 md:p-8 shadow-2xl min-h-[500px]">
              
              {/* --- STEP 1: GITHUB --- */}
              {activeStep === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <Github className="w-7 h-7" /> Connect GitHub
                    </h2>
                    <button onClick={checkGithubConnection} disabled={checkingGithub} className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
                      <RefreshCw className={`w-3 h-3 ${checkingGithub ? "animate-spin" : ""}`} /> Refresh Status
                    </button>
                  </div>
                  <p className="text-slate-400 mb-6">
                    Install the Jataka App on your GitHub repository to allow us to read PR details, monitor your branch health, and post test results back to your PRs.
                  </p>

                    <div className="bg-slate-950 border border-slate-700 rounded-xl p-5 mb-6">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="font-semibold text-white">GitHub App</h3>
                          <p className="text-xs text-slate-400">Required for reading PRs and posting status checks</p>
                        </div>
                        {checkingGithub ? (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        ) : isGithubConnected ? (
                          <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full text-sm">
                            <CheckCircle className="w-4 h-4" /> Connected
                          </div>
                        ) : (
                          <button onClick={handleInstallGithub} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">
                            Connect App
                          </button>
                        )}
                      </div>

                      {isGithubConnected && (
                        <div className="bg-black/50 p-4 rounded-lg border border-slate-700 flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Installation ID</span>
                            <span className="font-mono text-white text-xs bg-slate-800 px-2 py-1 rounded border border-slate-600">
                              {installationId || "Loading..."}
                            </span>
                          </div>
                          <button 
                            onClick={handleInstallGithub} 
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition flex items-center justify-center gap-2 border border-slate-600"
                          >
                            <ExternalLink className="w-4 h-4" /> Manage Repositories (GitHub)
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button onClick={() => setActiveStep(2)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors">
                        Continue to Step 2
                      </button>
                    </div>
                </div>
              )}

              {/* --- STEP 2: SALESFORCE --- */}
              {activeStep === 2 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <Cloud className="w-7 h-7 text-blue-400" /> Connect Salesforce
                    </h2>
                    <button onClick={checkSalesforceConnection} disabled={checkingSalesforce} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
                      <RefreshCw className={`w-3 h-3 ${checkingSalesforce ? "animate-spin" : ""}`} /> Refresh Status
                    </button>
                  </div>
                  <p className="text-slate-400 mb-6">
                    Authenticate the Salesforce environment where tests will be executed. Connect multiple roles to test different permissions.
                  </p>

                  {/* 👇 MULTI-ROLE CARDS 👇 */}
                  <div className="space-y-4 mb-6">
                    {[
                      { id: "admin", title: "System Admin (Default)", desc: "Required for reading Metadata & Executing Tests" },
                      { id: "sales_rep", title: "Sales Rep", desc: "Standard user for executing sales workflows" },
                      { id: "manager", title: "Manager / Approver", desc: "Required for testing approval processes" },
                    ].map((role) => {
                      const conn = salesforceConnections.find((c) => c.actorRole === role.id);
                      return (
                        <div key={role.id} className="bg-slate-950 border border-slate-700 rounded-xl p-5">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                            <div>
                              <h3 className="font-semibold text-white">{role.title}</h3>
                              {conn ? (
                                <p className="text-xs text-green-400 mt-1">Connected: {conn.sf_username}</p>
                              ) : (
                                <p className="text-xs text-slate-400 mt-1">{role.desc}</p>
                              )}
                            </div>
                            {checkingSalesforce ? (
                              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                            ) : conn ? (
                              <button 
                                onClick={() => handleDisconnectSalesforce(role.id)} 
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg text-sm font-medium transition border border-slate-700 whitespace-nowrap"
                              >
                                Disconnect
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                {/* Production Button */}
                                <button 
                                  onClick={() => handleConnectSalesforce(role.id, false)} 
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition whitespace-nowrap"
                                >
                                  Connect Prod
                                </button>
                                {/* Sandbox Button */}
                                <button 
                                  onClick={() => handleConnectSalesforce(role.id, true)} 
                                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-lg text-sm font-medium transition whitespace-nowrap"
                                >
                                  Connect Sandbox
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Important Action Required Block - Only shows if Admin is connected */}
                  {isSfAdminConnected && (
                    <div className="p-5 border border-yellow-700/50 bg-yellow-900/20 rounded-xl relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500"></div>
                      <h4 className="text-yellow-400 font-semibold flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5" /> Important Action Required
                      </h4>
                      <p className="text-sm text-yellow-100/80 mb-4">
                        Ensure your GitHub Actions workflow is authenticated with Salesforce. Generate your SFDX Auth URL locally and add it to your GitHub Repository Secrets.
                      </p>
                      
                      <div className="bg-black/50 p-3 rounded border border-slate-700 flex items-center justify-between font-mono text-xs">
                        <span className="text-slate-300">sfdx force:org:display -u &lt;alias&gt; --verbose</span>
                        <button 
                          onClick={() => copyToClipboard("sfdx force:org:display -u <alias> --verbose", setCopiedSfdx)}
                          className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                        >
                          {copiedSfdx ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Save the resulting URL as <strong className="text-white">SFDX_AUTH_URL</strong> in your GitHub Secrets.
                      </p>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button onClick={() => setActiveStep(3)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors">
                      Continue to Step 3
                    </button>
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

              {!isSalesforceAdminConnected && (
                <div className="mb-3 p-2 rounded border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2">
                  <AlertCircle size={13} /> Step 1: Connect Salesforce System Admin.
                </div>
              )}

              {isSalesforceAdminConnected && githubConnected && (
                <div className="mb-3 p-2 rounded border border-[var(--border-default)] text-xs text-[var(--text-secondary)] flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" /> Step 3: Analyzing Enterprise Architecture...
                </div>
              )}

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
                            <button
                              onClick={() => handleConnectSalesforce(role.id)}
                              className="btn-secondary text-xs"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isSalesforceAdminConnected && (
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
  </div>
  );
}
