import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: mocks.getToken,
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: mocks.useSearchParams,
  usePathname: mocks.usePathname,
}));

vi.mock("../components/Sidebar", () => ({
  default: () => <nav aria-label="Sidebar" />,
}));

vi.mock("../components/RichApprovalEvidence", () => ({
  default: () => <div>Approval evidence</div>,
  evaluateApprovalEvidence: () => ({
    required: false,
    allowed: true,
    reasons: [],
  }),
  HashBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: {
      children: ReactNode;
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => {
      void _initial;
      void _animate;
      void _transition;
      return <div {...props}>{children}</div>;
    },
  },
}));

describe("Support Ops case deep link", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
    mocks.getToken.mockResolvedValue("session-token");
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams("case_id=case%2F42"),
    );
    mocks.usePathname.mockReturnValue("/support-ops");
  });

  it("opens the exact case requested by the ITSM approval link", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/auth/sync")) {
        return Response.json({
          org: { name: "Fintech" },
          user: { role: "admin" },
        });
      }
      if (url.includes("/auto-resolution/cases?")) {
        return Response.json({ cases: [] });
      }
      if (url.endsWith("/auto-resolution/cases/case%2F42")) {
        return Response.json({
          case: {
            id: "case/42",
            issueText: "Linked change request",
            status: "PENDING_APPROVAL",
            source: "JIRA",
            createdAt: "2026-07-27T10:00:00.000Z",
          },
          approvals: [],
          auditEvents: [],
          steps: [],
        });
      }
      return Response.json({ message: "Not found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: SupportOpsPage } = await import("./page");
    render(<SupportOpsPage />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.test/auto-resolution/cases/case%2F42",
        expect.any(Object),
      ),
    );
    expect(await screen.findByText("Linked change request")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Managerial summary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Full technical timeline for this case."),
    ).toBeInTheDocument();
  });

  it("shows a focused decision brief on the manager route", async () => {
    mocks.usePathname.mockReturnValue("/manager/decisions");
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/auth/sync")) {
        return Response.json({
          org: { name: "Fintech" },
          user: { role: "org:member" },
        });
      }
      if (url.includes("/auto-resolution/cases?")) {
        return Response.json({ cases: [] });
      }
      if (url.endsWith("/auto-resolution/cases/case%2F42")) {
        return Response.json({
          case: {
            id: "case/42",
            issueText: "Linked change request",
            status: "PENDING_APPROVAL",
            source: "JIRA",
            createdAt: "2026-07-27T10:00:00.000Z",
            proposalSnapshot: {
              answer: "Apply the validated bulk-safe change.",
              risk: "MEDIUM",
              proposedActionType: "CODE_CHANGE",
            },
            confidenceScore: 0.82,
          },
          approvals: [],
          auditEvents: [],
          steps: [],
        });
      }
      return Response.json({ message: "Not found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: SupportOpsPage } = await import("./page");
    render(<SupportOpsPage />);

    expect(
      await screen.findByRole("heading", { name: "Managerial summary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Decision context" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Full technical timeline for this case."),
    ).not.toBeInTheDocument();
  });
});
