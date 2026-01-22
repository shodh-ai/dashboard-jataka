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
  getJiraConfig,
  saveJiraConfig,
  verifyJiraConnection,
  deleteJiraConfig,
  type JiraConfig,
} from "../../../lib/jira-api";

export default function IntegrationsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  // Jira state
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    projects?: Array<{ key: string; name: string }>;
  } | null>(null);

  // Form state
  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Load existing config
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadJiraConfig();
    }
  }, [isLoaded, isSignedIn]);

  const loadJiraConfig = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const config = await getJiraConfig(token);
      setJiraConfig(config);

      if (config) {
        setBaseUrl(config.baseUrl);
        setEmail(config.email);
        setProjectKey(config.projectKey);
        // Don't populate API token for security
      }
    } catch (error: any) {
      console.error("Failed to load Jira config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const token = await getToken();
      if (!token) return;

      const result = await verifyJiraConnection(
        { baseUrl, email, apiToken, projectKey },
        token
      );

      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || "Failed to verify connection",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await getToken();
      if (!token) return;

      const config = await saveJiraConfig(
        { baseUrl, email, apiToken, projectKey },
        token
      );

      setJiraConfig(config);
      setIsEditing(false);
      setApiToken(""); // Clear sensitive data
      setTestResult(null);
      alert("Jira integration saved successfully!");
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Jira?")) return;

    try {
      setSaving(true);
      const token = await getToken();
      if (!token) return;

      await deleteJiraConfig(token);
      setJiraConfig(null);
      setBaseUrl("");
      setEmail("");
      setApiToken("");
      setProjectKey("");
      setIsEditing(false);
      setTestResult(null);
      alert("Jira integration disconnected");
    } catch (error: any) {
      alert(`Failed to disconnect: ${error.message}`);
    } finally {
      setSaving(false);
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

            {jiraConfig && !isEditing && (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span>Connected</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : jiraConfig && !isEditing ? (
            // Display mode
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-400">Base URL</label>
                  <p className="text-white">{jiraConfig.baseUrl}</p>
                </div>
                <div>
                  <label className="text-gray-400">Email</label>
                  <p className="text-white">{jiraConfig.email}</p>
                </div>
                <div>
                  <label className="text-gray-400">Project Key</label>
                  <p className="text-white">{jiraConfig.projectKey}</p>
                </div>
                <div>
                  <label className="text-gray-400">Status</label>
                  <p className="text-white">
                    {jiraConfig.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
                >
                  Edit
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            // Edit/Create mode
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Jira Base URL *
                </label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://your-company.atlassian.net"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bot@your-company.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Token *
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-400 hover:text-blue-300 text-xs inline-flex items-center gap-1"
                  >
                    Get your token
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="ATATT3xFfGN0..."
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Project Key *
                </label>
                <input
                  type="text"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                  placeholder="PROJ"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className={`p-4 rounded-md flex items-start gap-3 ${
                    testResult.success
                      ? "bg-green-900/20 border border-green-700"
                      : "bg-red-900/20 border border-red-700"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p
                      className={
                        testResult.success ? "text-green-300" : "text-red-300"
                      }
                    >
                      {testResult.message}
                    </p>
                    {testResult.projects && testResult.projects.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-400">
                          Available projects:
                        </p>
                        <ul className="text-sm text-gray-300 mt-1">
                          {testResult.projects.slice(0, 5).map((p) => (
                            <li key={p.key}>
                              {p.key} - {p.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleTestConnection}
                  disabled={!baseUrl || !email || !apiToken || testing}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Test Connection
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    !baseUrl ||
                    !email ||
                    !apiToken ||
                    !projectKey ||
                    saving ||
                    (testResult && !testResult.success)
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {jiraConfig ? "Update" : "Save"}
                </button>
                {isEditing && (
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setTestResult(null);
                      if (jiraConfig) {
                        setBaseUrl(jiraConfig.baseUrl);
                        setEmail(jiraConfig.email);
                        setProjectKey(jiraConfig.projectKey);
                        setApiToken("");
                      }
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Hint */}
              {!testResult && (
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded-md flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-300">
                    Test your connection before saving to ensure your credentials
                    are correct.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
