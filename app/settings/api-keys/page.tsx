"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Copy, ShieldAlert, Trash2, CheckCircle } from "lucide-react";

type ApiKeyRecord = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  keyPreview: string;
};

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function ApiKeysSettingsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Copado Staging Pipeline");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeCount = useMemo(() => keys.filter((k) => k.isActive).length, [keys]);

  const fetchKeys = async () => {
    const token = await getToken();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${BASE_API}/integrations/github/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load API keys");
      const data = await res.json();
      setKeys(Array.isArray(data?.keys) ? data.keys : []);
    } catch (error: any) {
      console.error('Failed to load API keys:', error);
      alert("We encountered a problem loading your API keys. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void fetchKeys();
    }
  }, [isLoaded, isSignedIn]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      alert("Please enter a key name.");
      return;
    }

    const token = await getToken();
    if (!token) return;

    setCreating(true);
    try {
      const res = await fetch(`${BASE_API}/integrations/github/api-keys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create API key");

      const data = await res.json();
      setGeneratedKey(data?.key || null);
      setCopied(false);
      await fetchKeys();
    } catch (error: any) {
      console.error('Failed to create API key:', error);
      alert("We encountered a problem creating your API key. Please try again later.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
  };

  const handleRevoke = async (id: string) => {
    const confirmRevoke = window.confirm(
      "Revoke this key? Existing CI/CD runs using it will fail authorization.",
    );
    if (!confirmRevoke) return;

    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(`${BASE_API}/integrations/github/api-keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to revoke API key");
      await fetchKeys();
    } catch (error: any) {
      console.error('Failed to revoke API key:', error);
      alert("We encountered a problem revoking your API key. Please try again later.");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">API Keys</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Create revokable pipeline keys for Copado/GitHub Actions quality gates.
          </p>
        </div>
        <span className="badge badge-emerald">{activeCount} Active</span>
      </div>

      {generatedKey && (
        <div className="card p-4 border border-amber-500/30">
          <div className="flex items-start gap-2 text-amber-500 text-sm mb-3">
            <ShieldAlert size={16} className="mt-0.5" />
            <div>
              <p className="font-medium">Copy this key now — it will not be shown again.</p>
              <p className="text-xs">Store in GitHub/Copado secrets as JATAKA_API_KEY.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[var(--bg-base)] border border-[var(--border-default)] rounded p-2">
            <code className="text-xs break-all flex-1">{generatedKey}</code>
            <button onClick={handleCopy} className="btn-secondary text-xs">
              {copied ? <CheckCircle size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setGeneratedKey(null)}
              className="btn-secondary text-xs"
            >
              I saved it
            </button>
          </div>
        </div>
      )}

      <div className="card p-5 space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <KeyRound size={16} /> Generate New Key
        </h2>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="input flex-1"
            placeholder="e.g. Copado Staging Pipeline"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn-secondary min-w-[140px] justify-center disabled:opacity-60"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Generate
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Existing Keys</h2>
          <button onClick={fetchKeys} className="btn-secondary text-xs" disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : "Refresh"}
          </button>
        </div>

        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : keys.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No keys created yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-[var(--border-default)] rounded-lg p-3"
              >
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {key.keyPreview} · Created {new Date(key.createdAt).toLocaleString()} · Last used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                  </p>
                  {!key.isActive && (
                    <p className="text-[11px] text-red-500 mt-1">Revoked</p>
                  )}
                </div>
                <div>
                  {key.isActive ? (
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="btn-secondary text-xs"
                    >
                      <Trash2 size={12} /> Revoke
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">Inactive</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
