import { CheckCircle2, Clock3, ShieldAlert } from "lucide-react";

export type ServerHashVerification = {
  valid?: boolean;
  /** Compatibility alias for older verification services. */
  verified?: boolean;
  reason?: string;
  errors?: string[];
  verifiedAt?: string;
  proposalHash?: string;
  evidenceHash?: string;
  executionHash?: string;
  certificateUri?: string | null;
  retentionVerified?: boolean;
};

export function isServerVerificationValid(verification?: ServerHashVerification) {
  return (
    verification?.valid === true ||
    (verification?.valid === undefined && verification?.verified === true)
  );
}

export default function AuditorHashStatus({
  verification,
  loading = false,
}: {
  verification?: ServerHashVerification;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">
        <Clock3 size={13} className="animate-pulse" />
        Verifying on server
      </span>
    );
  }

  if (isServerVerificationValid(verification)) {
    return (
      <span
        data-testid="verified-hash-badge"
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300"
      >
        <CheckCircle2 size={13} />
        Hashes verified
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300">
      <ShieldAlert size={13} />
      {verification ? "Verification failed" : "Not verified"}
    </span>
  );
}
