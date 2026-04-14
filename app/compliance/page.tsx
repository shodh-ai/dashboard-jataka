"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Shield, Download, Check, X } from "lucide-react";

interface AccessRecord {
  type: string;
  name: string;
  can_read: boolean;
  can_edit: boolean;
}

export default function CompliancePage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [repoId, setRepoId] = useState<string | null>(null);
  const [objects, setObjects] = useState<string[]>([]);
  const [selectedObject, setSelectedObject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestedFields, setSuggestedFields] = useState<string[]>([]);
  const [fieldName, setFieldName] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessList, setAccessList] = useState<AccessRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActiveBrain() {
      if (!isSignedIn) return;
      const token = await getToken();
      const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!BASE_API) return;

      try {
        const res = await fetch(`${BASE_API}/curriculum/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const active = data.brains?.find((b: any) => b.id === data.activeBrainId) || data.brains?.[0];
          if (active) setRepoId(active.knowledgeBaseId);
        }
      } catch (e) {
        console.error("Failed to load repo ID", e);
      }
    }
    fetchActiveBrain();
  }, [isSignedIn, getToken]);

  useEffect(() => {
    async function fetchObjects() {
      if (!repoId) return;

      try {
        const token = await getToken();
        const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!BASE_API) return;

        const res = await fetch(
          `${BASE_API}/brum-proxy/compliance/objects?repo_id=${encodeURIComponent(repoId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) throw new Error("Failed to fetch objects");

        const data = await res.json();
        if (data.status === "success") {
          setObjects(data.objects ?? []);
        }
      } catch (e) {
        console.error("Failed to load compliance objects", e);
      }
    }

    fetchObjects();
  }, [repoId, getToken]);

  useEffect(() => {
    if (!repoId || !selectedObject) {
      setSuggestedFields([]);
      return;
    }

    const debounce = setTimeout(async () => {
      try {
        const token = await getToken();
        const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!BASE_API) return;

        const params = new URLSearchParams({
          repo_id: repoId,
          object_name: selectedObject,
          search_term: searchQuery,
        });
        const res = await fetch(`${BASE_API}/brum-proxy/compliance/search_fields?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch field suggestions");

        const data = await res.json();
        if (data.status === "success") {
          setSuggestedFields(data.fields ?? []);
        }
      } catch (e) {
        console.error("Failed to fetch field suggestions", e);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [repoId, selectedObject, searchQuery, getToken]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoId || !searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;
      
      const resolvedField = searchQuery.trim();
      const res = await fetch(`${BASE_API}/brum-proxy/compliance/xray?repo_id=${encodeURIComponent(repoId)}&field_name=${encodeURIComponent(resolvedField)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Field not found or scan failed.");
      
      const data = await res.json();
      setFieldName(resolvedField);
      setAccessList(data.access_list);
    } catch (err: any) {
      setError(err.message);
      setAccessList(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    // Pro-tip for MVPs: window.print() triggers the browser's "Save as PDF" dialog natively.
    window.print();
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] min-h-screen p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Shield className="text-indigo-500" size={28} />
            Compliance X-Ray
          </h2>
          <p className="text-[var(--text-secondary)] mt-2">
            Instantly generate "Net Effective Access" reports for auditors (SOC2, SOX). Type a sensitive Field API Name to see exactly which Profiles and Permission Sets grant access to it.
          </p>
        </div>

        {/* Search Controls */}
        <form
          onSubmit={handleSearch}
          className="card p-6 md:p-7 mb-8 bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col lg:flex-row gap-4 lg:gap-5 lg:items-start rounded-xl shadow-[0_8px_32px_rgba(8,12,28,0.35)]"
        >
          <div className="flex flex-col w-full lg:w-1/3">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
              1. Select Object
            </label>
            <select
              className="input w-full h-11"
              value={selectedObject}
              onChange={(e) => {
                setSelectedObject(e.target.value);
                setSearchQuery("");
                setSuggestedFields([]);
                setAccessList(null);
                setError(null);
              }}
            >
              <option value="">-- Choose an Object --</option>
              {objects.map((obj) => (
                <option key={obj} value={obj}>
                  {obj}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {objects.length > 0 ? `${objects.length} objects available` : "Loading available objects..."}
            </p>
          </div>

          <div className="flex flex-col w-full lg:w-1/3">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
              2. Search Field
            </label>
            <input
              type="text"
              list="field-suggestions"
              className="input w-full h-11 disabled:opacity-60"
              placeholder={selectedObject ? "e.g. Industry, Name..." : "Select an object first..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!selectedObject}
              required
            />
            <datalist id="field-suggestions">
              {suggestedFields.map((field) => (
                <option key={field} value={field} />
              ))}
            </datalist>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {selectedObject
                ? "Type to see matching fields"
                : "Choose an object to enable field search"}
            </p>
          </div>

          <div className="w-full lg:w-auto lg:min-w-[220px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 block">
              3. Run Report
            </label>
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="btn-primary whitespace-nowrap w-full h-11 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Scanning Graph..." : "Generate Audit Report"}
            </button>
            <p className="text-xs mt-2 invisible">
              alignment spacer
            </p>
          </div>
        </form>

        {error && <div className="text-rose-500 mb-6">{error}</div>}

        {/* Results Table (This section is targeted by print media queries for PDF) */}
        {accessList && (
          <div className="card overflow-hidden" id="printable-audit-report">
            <div className="px-5 py-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Audit Access Report: {fieldName}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Generated by Jataka AI • {new Date().toLocaleDateString()}</p>
              </div>
              <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2 text-xs">
                <Download size={14} /> Export to PDF
              </button>
            </div>
            
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--bg-base)] text-[var(--text-secondary)] uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-medium">Security Entity</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium text-center">Read Access</th>
                  <th className="px-5 py-3 font-medium text-center">Edit Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {accessList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No access found for this field.</td>
                  </tr>
                ) : (
                  accessList.map((record, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-base)]/50">
                      <td className="px-5 py-3 font-medium text-[var(--text-primary)]">{record.name}</td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">
                        <span className={`badge ${record.type === 'Profile' ? 'badge-amber' : 'badge-indigo'}`}>
                          {record.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {record.can_read ? <Check className="mx-auto text-emerald-500" size={16} /> : <X className="mx-auto text-[var(--text-muted)]" size={16} />}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {record.can_edit ? <Check className="mx-auto text-emerald-500" size={16} /> : <X className="mx-auto text-[var(--text-muted)]" size={16} />}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
