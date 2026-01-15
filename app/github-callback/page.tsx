"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

function GithubCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken, isLoaded } = useAuth();
  const [status, setStatus] = useState("Processing GitHub connection...");

  useEffect(() => {
    if (!isLoaded) return;

    const installationId = searchParams.get("installation_id");

    if (!installationId) {
      setStatus("Error: No installation ID received from GitHub.");
      return;
    }

    const linkGithub = async () => {
      try {
        if (!BASE_API) {
          setStatus("Error: Missing env var NEXT_PUBLIC_API_BASE_URL");
          return;
        }

        const token = await getToken();
        if (!token) {
          setStatus("Error: Not signed in.");
          return;
        }

        const res = await fetch(`${BASE_API}/integrations/github/link-installation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ installation_id: installationId }),
        });

        if (!res.ok) {
          let msg = "Failed to link GitHub account. Please try again.";
          try {
            const json = await res.json();
            if (json?.message) msg = String(json.message);
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(msg);
        }

        setStatus("Success! GitHub connected. Scanning repository...");

        setTimeout(() => {
          router.push("/");
        }, 2000);
      } catch (error) {
        console.error(error);
        setStatus("Failed to link GitHub account. Please try again.");
      }
    };

    linkGithub();
  }, [isLoaded, getToken, router, searchParams]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <h2 className="text-slate-200">{status}</h2>
      </div>
    </div>
  );
}

export default function GithubCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-950">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <GithubCallbackInner />
    </Suspense>
  );
}
