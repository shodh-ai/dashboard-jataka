import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuditorHashStatus from "../AuditorHashStatus";
import { auditorEndpoints } from "../../auditor/contracts";

describe("AuditorHashStatus", () => {
  it("shows the green badge only for backend valid true", () => {
    const { rerender } = render(
      <AuditorHashStatus
        verification={{ valid: false, verified: true, errors: ["hash_mismatch"] }}
      />,
    );

    expect(screen.queryByTestId("verified-hash-badge")).not.toBeInTheDocument();
    expect(screen.getByText("Verification failed")).toBeInTheDocument();

    rerender(
      <AuditorHashStatus
        verification={{
          valid: true,
          proposalHash: "proposal",
          evidenceHash: "evidence",
        }}
      />,
    );

    expect(screen.getByTestId("verified-hash-badge")).toHaveTextContent("Hashes verified");
  });

  it("does not imply verification before the server responds", () => {
    render(<AuditorHashStatus />);
    expect(screen.getByText("Not verified")).toBeInTheDocument();
    expect(screen.queryByTestId("verified-hash-badge")).not.toBeInTheDocument();
  });

  it("supports the legacy verified alias only when valid is absent", () => {
    render(<AuditorHashStatus verification={{ verified: true }} />);
    expect(screen.getByTestId("verified-hash-badge")).toBeInTheDocument();
  });

  it("uses the one-backend auditor event endpoints", () => {
    expect(auditorEndpoints.list).toBe("/auditor/events?limit=200");
    expect(auditorEndpoints.detail("event/1")).toBe("/auditor/events/event%2F1");
    expect(auditorEndpoints.verify("event-1")).toBe(
      "/auditor/events/event-1/verify",
    );
  });
});
