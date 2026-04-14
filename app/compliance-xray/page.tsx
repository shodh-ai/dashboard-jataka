"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import Sidebar from "../components/Sidebar";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AccessRow {
  type: string;
  name: string;
  can_read: boolean;
  can_edit: boolean;
}

interface ComplianceSearchProps {
  repoId: string;
  token: string;
  onGenerateReport: (fieldName: string) => void;
  loading: boolean;
}

function ComplianceSearch({ repoId, token, onGenerateReport, loading }: ComplianceSearchProps) {
  const [objects, setObjects] = useState<string[]>([]);
  const [selectedObject, setSelectedObject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestedFields, setSuggestedFields] = useState<string[]>([]);

  useEffect(() => {
    async function fetchObjects() {
      if (!repoId || !BASE_API || !token) return;
      try {
        const res = await fetch(`${BASE_API}/brum-proxy/compliance/objects?repo_id=${encodeURIComponent(repoId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status === "success") {
          setObjects(Array.isArray(data.objects) ? data.objects : []);
        }
      } catch (err) {
        console.error("Error fetching objects:", err);
      }
    }
    fetchObjects();
  }, [repoId, token]);

  useEffect(() => {
    async function fetchFields() {
      if (!selectedObject || !repoId || !BASE_API || !token) {
        setSuggestedFields([]);
        return;
      }
      try {
        const params = new URLSearchParams({
          repo_id: repoId,
          object_name: selectedObject,
          search_term: searchQuery,
        });
        const res = await fetch(`${BASE_API}/brum-proxy/compliance/search_fields?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status === "success") {
          setSuggestedFields(Array.isArray(data.fields) ? data.fields : []);
        }
      } catch (err) {
        console.error("Error fetching fields:", err);
      }
    }

    const delayDebounceFn = setTimeout(fetchFields, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedObject, repoId, token]);

  return (
    <div className="flex flex-col md:flex-row gap-4 items-end bg-[#1a1f2e] p-6 rounded-lg border border-gray-700 shadow-sm mb-6">
      <div className="flex flex-col w-full md:w-1/3">
        <label className="text-sm font-semibold text-gray-300 mb-2">1. Select Object</label>
        <select
          className="p-3 bg-[#0d1117] text-gray-200 border border-gray-600 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
          value={selectedObject}
          onChange={(e) => {
            setSelectedObject(e.target.value);
            setSearchQuery("");
          }}
        >
          <option value="">-- Choose an Object --</option>
          {objects.map((obj) => (
            <option key={obj} value={obj}>
              {obj}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col w-full md:w-1/3 relative">
        <label className="text-sm font-semibold text-gray-300 mb-2">2. Search Field</label>
        <input
          type="text"
          list="field-suggestions"
          className="p-3 bg-[#0d1117] text-gray-200 border border-gray-600 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all placeholder-gray-500"
          placeholder={selectedObject ? "e.g. Industry, Name..." : "Select an object first..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={!selectedObject}
        />
        <datalist id="field-suggestions">
          {suggestedFields.map((field) => (
            <option key={field} value={field} />
          ))}
        </datalist>
      </div>

      <button
        className="w-full md:w-auto px-6 py-3 bg-[#5b5fdb] hover:bg-[#4a4ec1] text-white font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
        disabled={!searchQuery || loading}
        onClick={() => onGenerateReport(searchQuery)}
      >
        {loading ? "Generating..." : "Generate Audit Report"}
      </button>
    </div>
  );
}

export default function ComplianceXrayPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [orgName, setOrgName] = useState("Jataka");
  const [userRole, setUserRole] = useState<"ARCHITECT" | "DEVELOPER" | "">("ARCHITECT");
  const [brains, setBrains] = useState<any[]>([]);
  const [activeBrain, setActiveBrain] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [fieldName, setFieldName] = useState("");

  useEffect(() => {
    async function bootstrap() {
      if (!isLoaded || !isSignedIn || !BASE_API) return;
      const freshToken = await getToken();
      if (!freshToken) return;
      setToken(freshToken);

      try {
        const [syncRes, brainsRes] = await Promise.all([
          fetch(`${BASE_API}/auth/sync`, { headers: { Authorization: `Bearer ${freshToken}` } }),
          fetch(`${BASE_API}/curriculum/list`, { headers: { Authorization: `Bearer ${freshToken}` } }),
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
        console.error("Failed to initialize compliance page", e);
      }
    }
    bootstrap();
  }, [isLoaded, isSignedIn, getToken]);

  const handleGenerateReport = async (selectedField: string) => {
    if (!BASE_API || !activeBrain || !selectedField.trim() || !token) return;
    setLoading(true);
    setError(null);
    setFieldName(selectedField.trim());
    setRows([]);
    try {
      const params = new URLSearchParams({
        repo_id: activeBrain,
        field_name: selectedField.trim(),
      });
      const res = await fetch(`${BASE_API}/brum-proxy/compliance/xray?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        throw new Error(data?.detail || data?.message || "Failed to load compliance report");
      }
      setRows(Array.isArray(data.access_list) ? data.access_list : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load compliance report");
    } finally {
      setLoading(false);
    }
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
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <ShieldCheck size={18} /> Compliance X-Ray
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Trace net field visibility from sharing, permission sets, and profiles.
              </p>
            </div>

            <select
              className="input select text-xs py-1 px-2 min-h-0 h-8"
              value={activeBrain}
              onChange={(e) => setActiveBrain(e.target.value)}
            >
              {brains.length > 0 ? (
                brains.map((b: any) => (
                  <option key={b.id} value={b.knowledgeBaseId}>
                    {b.name}
                  </option>
                ))
              ) : (
                <option value="">No brains</option>
              )}
            </select>
          </div>

          <ComplianceSearch repoId={activeBrain} token={token} onGenerateReport={handleGenerateReport} loading={loading} />

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
              <h2 className="text-sm font-semibold">
                {fieldName ? `Audit Report for ${fieldName}` : "Audit Report"}
              </h2>
            </div>

            {loading ? (
              <div className="p-10 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-rose-500">{error}</div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-sm text-[var(--text-muted)]">
                Select an object and field, then generate the report.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[var(--bg-base)] text-[var(--text-secondary)] uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Read Access</th>
                      <th className="px-5 py-3 font-medium">Edit Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {rows.map((row, idx) => (
                      <tr key={`${row.type}-${row.name}-${idx}`} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                        <td className="px-5 py-4">{row.type}</td>
                        <td className="px-5 py-4">{row.name}</td>
                        <td className="px-5 py-4">
                          <span className={row.can_read ? "text-emerald-400" : "text-rose-400"}>
                            {row.can_read ? "Allowed" : "Denied"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={row.can_edit ? "text-emerald-400" : "text-rose-400"}>
                            {row.can_edit ? "Allowed" : "Denied"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
