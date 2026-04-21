"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import {
  CheckCircle,
  Circle,
  Loader2,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Copy,
  ShieldAlert,
  Trash2,
  Github,
  Cloud,
  TerminalSquare,
  ChevronRight,
} from "lucide-react";

// Assuming these API helpers exist in your project
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

type ApiKeyRecord = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  keyPreview: string;
};

export default function IntegrationsAndSetupPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  
  const [orgName, setOrgName] = useState("");
  const[userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("");

  // --- UI & Wizard State ---
  const [activeStep, setActiveStep] = useState(1);
  const[copiedSfdx, setCopiedSfdx] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);

  // --- GitHub State ---
  const [isGithubConnected, setIsGithubConnected] = useState(false);
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [checkingGithub, setCheckingGithub] = useState(false);

  // --- Salesforce State ---
  const [salesforceConnections, setSalesforceConnections] = useState<SalesforceConnectionResponse[]>([]);
  const [checkingSalesforce, setCheckingSalesforce] = useState(false);
  const[isSyncingSchema, setIsSyncingSchema] = useState(false);
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
  const isSfAdminConnected = salesforceConnections.some(
    (c) => c.actorRole === "admin" && c.status !== "EXPIRED",
  );
  const expiredSalesforceConnections = salesforceConnections.filter(
    (c) => c.status === "EXPIRED",
  );
  const hasExpiredSalesforceConnection = expiredSalesforceConnections.length > 0;
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
  }, [isLoaded, isSignedIn]);

  // --- API Functions (GitHub) ---
  const checkGithubConnection = async () => {
    setCheckingGithub(true);
    try {
      const token = await getToken();
      if (!token) return;
      
      const res = await fetch(`${BASE_API}/integrations/github/status`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      
      if (res.ok) {
        const data = await res.json();
        setIsGithubConnected(Boolean(data.connected));
        const resolvedInstallationId =
          data.installationId ?? data.installation_id ?? null;
        setInstallationId(
          resolvedInstallationId ? String(resolvedInstallationId) : null,
        );
      }
    } catch (error) {
      console.error("Failed to fetch GitHub status", error);
      setIsGithubConnected(false);
    } finally {
      setCheckingGithub(false);
    }
  };

  const handleInstallGithub = () => {
    window.location.href = GITHUB_INSTALL_URL;
  };

  // --- API Functions (Keys) ---
  const fetchKeys = async () => {
    setKeysLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      
      const res = await fetch(`${BASE_API}/integrations/github/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(Array.isArray(data?.keys) ? data.keys :[]);
      }
    } catch (error) {
      console.error("Failed to load API keys", error);
    } finally {
      setKeysLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return alert("Please enter a key name.");
    setCreatingKey(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${BASE_API}/integrations/github/api-keys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      
      if (!res.ok) throw new Error("Failed to create key");
      const data = await res.json();
      setGeneratedKey(data?.key || null);
      setCopiedKey(false);
      await fetchKeys();
    } catch (error) {
      alert("Failed to create API key");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!window.confirm("Revoke this key? Existing CI/CD runs using it will fail.")) return;
    try {
      const token = await getToken();
      if (!token) return;
      
      const res = await fetch(`${BASE_API}/integrations/github/api-keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to revoke key");
      await fetchKeys();
    } catch (error) {
      alert("Failed to revoke API key");
    }
  };

  // --- API Functions (Salesforce) ---
  const checkSalesforceConnection = async () => {
    setCheckingSalesforce(true);
    try {
      const token = await getToken();
      const data = token ? await getSalesforceStatus(token) :[];
      setSalesforceConnections(data || []);
    } catch (e) {
      setSalesforceConnections([]);
    } finally {
      setCheckingSalesforce(false);
    }
  };

  const handleConnectSalesforce = async (role: string, isSandbox: boolean = false) => {
    const token = await getToken();
    if (token) await connectSalesforce(token, role, isSandbox);
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
      alert('Schema sync started! Standard and custom metadata are updating in the background.');
    } catch (error: any) {
      alert(`Failed to sync schema: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSyncingSchema(false);
    }
  };

  const handleSyncDependenciesData = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setIsSyncingDependencies(true);
      const res = await fetch(`${BASE_API}/integrations/salesforce/sync-dependencies`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to start dependency sync");
      alert('Impact Graph sync started! Navigating connections in the background. 🕸️');
    } catch (error: any) {
      alert(`Failed to sync impact graph: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSyncingDependencies(false);
    }
  };

  // --- API Functions (Jira) ---
  const checkJiraConnection = async () => {
    setCheckingJira(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getJiraStatus(token);
      setJiraConnected(data.connected);
      if (data.connected) {
        setJiraInfo(data);
        setNewProjectKey(data.project_key || "");
      }
    } catch (e) {
      setJiraConnected(false);
    } finally {
      setCheckingJira(false);
    }
  };

  const handleConnectJira = async () => {
    const token = await getToken();
    if (token) await connectJira(token);
  };

  const handleDisconnectJira = async () => {
    if (!confirm("Are you sure you want to disconnect Jira?")) return;
    const token = await getToken();
    if (!token) return;
    try {
      await disconnectJira(token);
      await checkJiraConnection();
    } catch (error) {
      alert("Failed to disconnect Jira");
    }
  };

  const handleUpdateJiraKey = async () => {
    if (!newProjectKey.trim()) return alert("Project key cannot be empty.");
    const token = await getToken();
    if (!token) return;
    setUpdatingJira(true);
    try {
      await updateJiraProjectKey({ projectKey: newProjectKey.toUpperCase() }, token);
      setEditingProjectKey(false);
      await checkJiraConnection();
    } catch (error) {
      alert("Failed to update Jira Project Key");
    } finally {
      setUpdatingJira(false);
    }
  };

  // --- Clipboard Helpers ---
  const copyToClipboard = async (text: string, setter: (val: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 3000);
  };

  //const webhookUrl = 'https://api.jataka.ai/api/integrations/github/trigger';
  const displayInstallId = installationId ? installationId : '"YOUR_INSTALLATION_ID"';
  
  const yamlSnippet = `- name: Trigger Jataka AI UI Tests
  # Put this step AFTER your Salesforce deployment step (Gearset, Copado, or SFDX)
  run: |
    curl -X POST "\${{ secrets.JATAKA_API_URL }}/api/integrations/github/trigger" \\
      -H "Authorization: Bearer \${{ secrets.JATAKA_API_KEY }}" \\
      -H "Content-Type: application/json" \\
      -d '{
        "installation_id": ${displayInstallId}, 
        "repo_full_name": "\${{ github.repository }}",
        "branch": "\${{ github.head_ref || github.ref_name }}",
        "pr_number": \${{ github.event.pull_request.number || 'null' }},
        "test_mode": "\${{ vars.JATAKA_TEST_MODE || 'auto' }}",
        "action": "\${{ github.event.action }}",
        "before_sha": "\${{ github.event.before }}"
      }'`;

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
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
            {hasExpiredSalesforceConnection && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">
                <span className="font-semibold">Salesforce authentication expired.</span>{" "}
                Automated tests are paused until an admin reconnects Salesforce.
              </div>
            )}
            
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
                      const isExpired = Boolean(conn && conn.status === "EXPIRED");
                      return (
                        <div key={role.id} className="bg-slate-950 border border-slate-700 rounded-xl p-5">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                            <div>
                              <h3 className="font-semibold text-white">{role.title}</h3>
                              {conn ? (
                                <p className={`text-xs mt-1 ${isExpired ? "text-amber-300" : "text-green-400"}`}>
                                  {isExpired
                                    ? `Action Required: Reconnect ${role.title}`
                                    : `Connected: ${conn.sf_username}`}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 mt-1">{role.desc}</p>
                              )}
                            </div>
                            {checkingSalesforce ? (
                              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                            ) : conn ? (
                              <div className="flex gap-2">
                                {isExpired && (
                                  <button
                                    onClick={() => handleConnectSalesforce(role.id, true)}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition whitespace-nowrap"
                                  >
                                    Reconnect
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleDisconnectSalesforce(role.id)} 
                                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg text-sm font-medium transition border border-slate-700 whitespace-nowrap"
                                >
                                  Disconnect
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleConnectSalesforce(role.id, false)} 
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition whitespace-nowrap"
                                >
                                  Connect Prod
                                </button>
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

                      <div className="bg-black/50 p-3 rounded border border-slate-700 flex items-start justify-between font-mono text-xs">
                        <div className="flex-1 pr-3 flex flex-col gap-3">
                          <div>
                            <p className="text-amber-100/80 mb-1 font-sans text-xs font-medium">login to salesforce account through this command</p>
                            <span className="text-slate-300">sf org login web --alias staging-org</span>
                          </div>
                          <div>
                            <p className="text-amber-100/80 mb-1 font-sans text-xs font-medium">then run this command for sfdx auth url </p>
                            <span className="text-slate-300">sf org display --target-org staging-org --verbose</span>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              "sf org login web --alias staging-org\nsf org display --target-org staging-org --verbose",
                              setCopiedSfdx
                            )
                          }
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
              )}

              {/* --- STEP 3: API KEYS --- */}
              {activeStep === 3 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                    <KeyRound className="w-7 h-7 text-emerald-400" /> Generate API Key
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Create a revokable key to allow your CI/CD pipeline to securely trigger Jataka AI tests.
                  </p>

                  {/* Generate Key Form */}
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Pipeline Name</label>
                    <div className="flex gap-3">
                      <input
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        placeholder="e.g. Copado Staging Pipeline"
                      />
                      <button
                        onClick={handleCreateKey}
                        disabled={creatingKey}
                        className="px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {creatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Generate
                      </button>
                    </div>
                  </div>

                  {/* Show newly generated key exactly once */}
                  {generatedKey && (
                    <div className="p-5 border border-emerald-500/50 bg-emerald-900/20 rounded-xl mb-6 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                      <div className="flex items-start gap-3 mb-3">
                        <ShieldAlert className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-emerald-400 text-lg">Copy this key immediately!</p>
                          <p className="text-sm text-emerald-200/70 mt-1">
                            Go to your GitHub Repository → Settings → Secrets and Variables → Actions. 
                            Create a new secret named <strong className="text-white bg-black/30 px-1 py-0.5 rounded">JATAKA_API_KEY</strong> and paste this value.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-black/60 border border-emerald-500/30 rounded-lg p-3">
                        <code className="text-sm text-emerald-300 break-all flex-1 font-mono">{generatedKey}</code>
                        <button 
                          onClick={() => copyToClipboard(generatedKey, setCopiedKey)} 
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md flex items-center gap-2 transition"
                        >
                          {copiedKey ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />} 
                          {copiedKey ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <button onClick={() => { setGeneratedKey(null); setActiveStep(4); }} className="w-full mt-4 py-2 text-emerald-400 hover:bg-emerald-900/40 rounded-lg text-sm font-medium transition">
                        I have saved it in GitHub Secrets →
                      </button>
                    </div>
                  )}

                  {/* Existing Keys */}
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Active Pipeline Keys</h3>
                    {keysLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                    ) : keys.length === 0 ? (
                      <p className="text-sm text-gray-500">No keys generated yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {keys.map((key) => (
                          <div key={key.id} className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition">
                            <div>
                              <p className="font-medium text-white">{key.name}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                <code className="text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">{key.keyPreview}</code>
                                <span>•</span>
                                <span>Used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}</span>
                                {!key.isActive && <span className="text-red-400 font-medium">• Revoked</span>}
                              </div>
                            </div>
                            {key.isActive && (
                              <button onClick={() => handleRevokeKey(key.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- STEP 4: YAML INJECTION --- */}
              {activeStep === 4 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                    <TerminalSquare className="w-7 h-7 text-indigo-400" /> Configure CI/CD
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Paste this step into your GitHub Actions <code className="bg-gray-900 px-1.5 py-0.5 rounded text-gray-300">.yml</code> workflow file. We recommend placing this directly after your deployment step.
                  </p>

                  <div className="bg-[#0d1117] rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                      <span className="text-xs text-gray-400 font-mono">.github/workflows/deploy.yml</span>
                      <button 
                        onClick={() => copyToClipboard(yamlSnippet, setCopiedYaml)}
                        className="flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded transition"
                      >
                        {copiedYaml ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} 
                        {copiedYaml ? "Copied" : "Copy YAML"}
                      </button>
                    </div>
                    <div className="p-4 overflow-x-auto">
                      <pre className="text-sm font-mono leading-relaxed text-gray-300">
                        <code dangerouslySetInnerHTML={{ 
                          __html: yamlSnippet
                            .replace(
                              installationId ? String(installationId) : '"YOUR_INSTALLATION_ID"', 
                              `<span class="text-blue-400 font-bold">${installationId || '"YOUR_INSTALLATION_ID"'}</span>`
                            )
                            .replace(/\${{ secrets.JATAKA_API_KEY }}/g, `<span class="text-emerald-400">\${{ secrets.JATAKA_API_KEY }}</span>`) 
                        }} />
                      </pre>
                    </div>
                  </div>

                  <div className="mt-5 p-4 bg-sky-900/20 border border-sky-700/50 rounded-xl">
                    <h4 className="font-semibold text-sky-200 mb-1.5">Required GitHub variable</h4>
                    <p className="text-sm text-sky-100/90 mb-3">
                      Add <code className="bg-black/40 px-1 rounded">JATAKA_TEST_MODE</code> in your GitHub Actions variables.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-sky-700/50">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-sky-900/40 text-sky-200">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Value</th>
                            <th className="px-3 py-2 font-semibold">Runs</th>
                          </tr>
                        </thead>
                        <tbody className="text-sky-100/90">
                          <tr className="border-t border-sky-700/40">
                            <td className="px-3 py-2 font-mono">ui</td>
                            <td className="px-3 py-2">UI-only tests</td>
                          </tr>
                          <tr className="border-t border-sky-700/40">
                            <td className="px-3 py-2 font-mono">backend</td>
                            <td className="px-3 py-2">Backend-only tests</td>
                          </tr>
                          <tr className="border-t border-sky-700/40">
                            <td className="px-3 py-2 font-mono">hybrid</td>
                            <td className="px-3 py-2">Both UI and backend tests</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {!installationId && (
                    <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg flex gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                      <p className="text-sm text-yellow-200">
                        Your GitHub integration isn't fully set up yet. Go back to <strong>Step 1</strong> to connect GitHub, and this snippet will automatically update with your actual <code className="bg-black/40 px-1 rounded">installation_id</code>.
                      </p>
                    </div>
                  )}

                  <div className="mt-8 p-4 bg-indigo-900/20 border border-indigo-700/50 rounded-xl">
                    <h4 className="font-semibold text-indigo-300 mb-2">Why this approach?</h4>
                    <p className="text-sm text-indigo-100/70">
                      We prioritize your security. By using a webhook curl, you maintain 100% control over your pipeline. We do not inject hidden code or force PRs into your repository. We simply receive the signal, run our AI tests, and post the results back to your PR status checks.
                    </p>
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <button onClick={() => setActiveStep(5)} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
                      Continue to Optional Settings
                    </button>
                  </div>
                </div>
              )}

              {/* --- STEP 5: OPTIONAL / JIRA / SYNC --- */}
              {activeStep === 5 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                      <RefreshCw className="w-7 h-7 text-gray-400" /> Optional Integrations
                    </h2>
                    <p className="text-gray-400">Advanced settings for issue tracking and deep repository sync.</p>
                  </div>

                  {/* Jira Card */}
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Jira Ticketing</h3>
                        <p className="text-sm text-gray-400">Automatically create tickets when tests fail</p>
                      </div>
                      {checkingJira ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      ) : jiraConnected ? (
                        <button onClick={handleDisconnectJira} className="text-xs text-red-400 hover:text-red-300 bg-red-400/10 px-3 py-1.5 rounded-full transition">Disconnect</button>
                      ) : (
                        <button onClick={handleConnectJira} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">Connect Jira</button>
                      )}
                    </div>
                    {jiraConnected && jiraInfo && (
                      <div className="bg-gray-800 rounded-lg p-4 text-sm mt-4 grid grid-cols-2 gap-4">
                        <div><span className="text-gray-500 block">Site URL</span> {jiraInfo.site_url}</div>
                        <div>
                          <span className="text-gray-500 block mb-1">Project Key</span>
                          {editingProjectKey ? (
                            <div className="flex gap-2">
                              <input 
                                value={newProjectKey} 
                                onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())} 
                                className="w-20 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white" 
                              />
                              <button onClick={handleUpdateJiraKey} disabled={updatingJira} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                {updatingJira ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono bg-gray-900 px-2 py-0.5 rounded text-blue-300">{jiraInfo.project_key || "Not Set"}</span>
                              <button onClick={() => setEditingProjectKey(true)} className="text-xs text-gray-500 hover:text-white">Edit</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Deep Sync Card */}
                  {isSfAdminConnected && (
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Org Intelligence Sync</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-blue-500/30 transition-colors">
                          <h4 className="font-medium text-white mb-1">Standard Schema</h4>
                          <p className="text-xs text-gray-400 mb-4 h-8">Syncs Objects, Fields, and Types so the AI knows your forms.</p>
                          <button 
                            onClick={handleSyncSchemaData} 
                            disabled={isSyncingSchema}
                            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isSyncingSchema ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Sync Schema
                          </button>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-blue-500/30 transition-colors">
                          <h4 className="font-medium text-white mb-1">Impact Graph</h4>
                          <p className="text-xs text-gray-400 mb-4 h-8">Syncs Component Dependencies for deep regression routing.</p>
                          <button 
                            onClick={handleSyncDependenciesData} 
                            disabled={isSyncingDependencies}
                            className="w-full py-2 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-800 text-blue-300 rounded text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isSyncingDependencies ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Sync Graph
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {progressPercentage === 100 && (
                    <div className="mt-8 p-6 bg-gradient-to-r from-emerald-900/40 to-blue-900/40 border border-emerald-500/30 rounded-xl text-center">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">You're All Set!</h3>
                      <p className="text-gray-400 text-sm">Your pipeline is fully configured. Open a PR in your repository to see Jataka AI in action.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
  );
}