"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  getJiraStatus,
  connectJira,
  updateJiraProjectKey,
  disconnectJira,
  type JiraConnectionResponse,
} from "../../../lib/jira-api";
import {
  getSalesforceStatus,
  connectSalesforce,
  disconnectSalesforce,
  type SalesforceConnectionResponse,
} from "../../../lib/salesforce-api";

export default function IntegrationsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  // Jira state (OAuth)
  const [jiraConnected, setJiraConnected] = useState(false);
  const [checkingJira, setCheckingJira] = useState(false);
  const [jiraInfo, setJiraInfo] = useState<JiraConnectionResponse | null>(null);
  const [editingProjectKey, setEditingProjectKey] = useState(false);
  const [newProjectKey, setNewProjectKey] = useState("");

  // Salesforce state
  const [salesforceConnected, setSalesforceConnected] = useState(false);
  const [checkingSalesforce, setCheckingSalesforce] = useState(false);
  const [salesforceInfo, setSalesforceInfo] = useState<SalesforceConnectionResponse | null>(null);

  // Load existing config
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      checkJiraConnection();
      checkSalesforceConnection();

      // Check for OAuth callback parameters
      const params = new URLSearchParams(window.location.search);
      const jiraStatus = params.get('jira');
      const salesforceStatus = params.get('salesforce');

      if (jiraStatus === 'connected') {
        alert('✅ Jira connected successfully!');
        // Clean URL
        window.history.replaceState({}, '', '/settings/integrations');
      } else if (jiraStatus === 'error') {
        const message = params.get('message');
        alert(`❌ Failed to connect Jira: ${message || 'Unknown error'}`);
        window.history.replaceState({}, '', '/settings/integrations');
      }

      if (salesforceStatus === 'connected') {
        alert('✅ Salesforce connected successfully!');
        window.history.replaceState({}, '', '/settings/integrations');
      } else if (salesforceStatus === 'error') {
        const message = params.get('message');
        alert(`❌ Failed to connect Salesforce: ${message || 'Unknown error'}`);
        window.history.replaceState({}, '', '/settings/integrations');
      }
    }
  }, [isLoaded, isSignedIn]);

  // Jira functions
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

  const handleConnectJira = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      // Fetch auth URL and redirect to Atlassian
      await connectJira(token);
    } catch (error) {
      console.error('Failed to connect to Jira:', error);
      alert('Failed to connect to Jira. Please try again.');
    }
  };

  const handleUpdateProjectKey = async () => {
    if (!newProjectKey.trim()) {
      alert('Please enter a project key');
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      await updateJiraProjectKey({ projectKey: newProjectKey.toUpperCase() }, token);
      setEditingProjectKey(false);
      await checkJiraConnection(); // Refresh status
      alert('Project key updated successfully!');
    } catch (error: any) {
      alert(`Failed to update project key: ${error.message}`);
    }
  };

  const handleDisconnectJira = async () => {
    if (!confirm("Are you sure you want to disconnect Jira?")) return;

    try {
      const token = await getToken();
      if (!token) return;

      await disconnectJira(token);
      setJiraConnected(false);
      setJiraInfo(null);
      setNewProjectKey("");
      alert("Jira disconnected successfully");
    } catch (error: any) {
      alert(`Failed to disconnect Jira: ${error.message}`);
    }
  };

  // Salesforce functions
  const checkSalesforceConnection = async () => {
    try {
      setCheckingSalesforce(true);
      const token = await getToken();
      if (!token) return;

      const data = await getSalesforceStatus(token);
      setSalesforceConnected(data.connected);
      if (data.connected) {
        setSalesforceInfo(data);
      }
    } catch (error) {
      console.error("Failed to check Salesforce connection:", error);
      setSalesforceConnected(false);
    } finally {
      setCheckingSalesforce(false);
    }
  };

  const handleConnectSalesforce = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      // Fetch auth URL and redirect to Salesforce
      await connectSalesforce(token);
    } catch (error) {
      console.error('Failed to connect to Salesforce:', error);
      alert('Failed to connect to Salesforce. Please try again.');
    }
  };

  const handleDisconnectSalesforce = async () => {
    if (!confirm("Are you sure you want to disconnect Salesforce?")) return;

    try {
      const token = await getToken();
      if (!token) return;

      await disconnectSalesforce(token);
      setSalesforceConnected(false);
      setSalesforceInfo(null);
      alert("Salesforce disconnected successfully");
    } catch (error: any) {
      alert(`Failed to disconnect Salesforce: ${error.message}`);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Integrations</h1>

        {/* Jira Integration Card */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                <img src="/jira-logo.svg" alt="Jira" className="w-6 h-6" onError={(e) => {e.currentTarget.style.display = 'none'}} />
                Jira Integration
              </h2>
              <p className="text-gray-400 mt-2">
                Automatically create Jira tickets when tests fail
              </p>
            </div>

            {jiraConnected && (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span>Connected</span>
              </div>
            )}
          </div>

          {checkingJira ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : jiraConnected && jiraInfo ? (
            // Connected state
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-400">Site URL</label>
                  <p className="text-white">{jiraInfo.site_url}</p>
                </div>
                <div>
                  <label className="text-gray-400">Cloud ID</label>
                  <p className="text-white font-mono text-xs">{jiraInfo.cloud_id}</p>
                </div>
                <div>
                  <label className="text-gray-400">Project Key</label>
                  {editingProjectKey ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectKey}
                        onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                        placeholder="PROJ"
                        className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      />
                      <button
                        onClick={handleUpdateProjectKey}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingProjectKey(false);
                          setNewProjectKey(jiraInfo.project_key || "");
                        }}
                        className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-white">{jiraInfo.project_key || "Not set"}</p>
                      <button
                        onClick={() => setEditingProjectKey(true)}
                        className="text-blue-400 hover:text-blue-300 text-xs"
                      >
                        {jiraInfo.project_key ? "Edit" : "Set"}
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-gray-400">Connected</label>
                  <p className="text-white">
                    {jiraInfo.connected_at && new Date(jiraInfo.connected_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {!jiraInfo.project_key && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-700 rounded-md flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-300">
                    Please set a project key to enable automatic ticket creation.
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleDisconnectJira}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition"
                >
                  Disconnect
                </button>
                <button
                  onClick={checkJiraConnection}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          ) : (
            // Not connected state
            <div className="space-y-4">
              <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-md">
                <p className="text-blue-300 text-sm">
                  Connect your Jira account using OAuth. You'll be redirected to Atlassian to authorize access.
                  No need to manually enter API tokens!
                </p>
              </div>

              <button
                onClick={handleConnectJira}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-semibold flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Connect with Jira
              </button>
            </div>
          )}
        </div>

        {/* Salesforce Integration Card */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700 mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#00A1E0">
                  <path d="M12.5 2C9.47 2 7 4.47 7 7.5c0 .55.45 1 1 1s1-.45 1-1c0-1.93 1.57-3.5 3.5-3.5S16 5.57 16 7.5c0 .55.45 1 1 1s1-.45 1-1C18 4.47 15.53 2 12.5 2z"/>
                  <path d="M12.5 22c3.03 0 5.5-2.47 5.5-5.5 0-.55-.45-1-1-1s-1 .45-1 1c0 1.93-1.57 3.5-3.5 3.5S8 18.43 8 16.5c0-.55-.45-1-1-1s-1 .45-1 1C6 19.53 8.47 22 12.5 22z"/>
                </svg>
                Salesforce Integration
              </h2>
              <p className="text-gray-400 mt-2">
                Connect your Salesforce org for automated testing
              </p>
            </div>

            {salesforceConnected && (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span>Connected</span>
              </div>
            )}
          </div>

          {checkingSalesforce ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : salesforceConnected && salesforceInfo ? (
            // Connected state
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-400">Instance URL</label>
                  <p className="text-white">{salesforceInfo.instance_url}</p>
                </div>
                <div>
                  <label className="text-gray-400">Username</label>
                  <p className="text-white">{salesforceInfo.sf_username}</p>
                </div>
                <div>
                  <label className="text-gray-400">Org ID</label>
                  <p className="text-white font-mono text-xs">{salesforceInfo.org_id}</p>
                </div>
                <div>
                  <label className="text-gray-400">Connected</label>
                  <p className="text-white">
                    {salesforceInfo.connected_at && new Date(salesforceInfo.connected_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleDisconnectSalesforce}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition"
                >
                  Disconnect
                </button>
                <button
                  onClick={checkSalesforceConnection}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          ) : (
            // Not connected state
            <div className="space-y-4">
              <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-md">
                <p className="text-blue-300 text-sm">
                  Connect your Salesforce org to enable automated testing. You'll be redirected to Salesforce to authorize access.
                </p>
              </div>

              <button
                onClick={handleConnectSalesforce}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-semibold flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Connect with Salesforce
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
