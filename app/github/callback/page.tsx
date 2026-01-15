"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

function GithubCallbackInner() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Linking GitHub...");

  useEffect(() => {
    async function linkGithub() {
      const installationId = searchParams.get("installation_id");

      if (!installationId || !isSignedIn) return;

      try {
        if (!BASE_API) {
          setStatus("Error: Missing env var NEXT_PUBLIC_API_BASE_URL");
          return;
        }

        const token = await getToken();
        if (!token) {
          setStatus("Not signed in.");
          return;
        }

        const res = await fetch(
          `${BASE_API}/integrations/github/link-installation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ installation_id: installationId }),
          },
        );

        if (res.ok) {
          setStatus("Success! Redirecting...");
          setTimeout(() => router.push("/"), 1500);
        } else {
          setStatus("Failed to link repository.");
        }
      } catch {
        setStatus("Error connecting to server.");
      }
    }

    if (isLoaded && isSignedIn) {
      linkGithub();
    }
  }, [isLoaded, isSignedIn, searchParams, getToken, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <p>{status}</p>
      </div>
    </div>
  );
}

export default function GithubCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
          <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        </div>
      }
    >
      <GithubCallbackInner />
    </Suspense>
  );
}
