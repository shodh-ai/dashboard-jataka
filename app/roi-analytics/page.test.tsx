import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: mocks.getToken,
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("../components/Sidebar", () => ({
  default: ({
    orgName,
    userRole,
  }: {
    orgName: string;
    userRole: string;
  }) => (
    <nav
      aria-label="Sidebar"
      data-organization={orgName}
      data-role={userRole}
    />
  ),
}));

describe("ROI Analytics page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
    mocks.getToken.mockResolvedValue("session-token");
  });

  it("loads authenticated ROI metrics from the required endpoint", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/auth/sync")) {
        return Response.json({
          org: { name: "ScalePoynt" },
          user: { role: "senior" },
        });
      }
      return Response.json({
        totalTicketsDeflected: 1240,
        averageTimeToResolveSeconds: 105,
        firstPassAccuracy: 98,
        generatedAt: "2026-07-27T10:00:00.000Z",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: RoiAnalyticsPage } = await import("./page");
    render(<RoiAnalyticsPage />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.test/auth/sync",
        {
          cache: "no-store",
          headers: { Authorization: "Bearer session-token" },
        },
      ),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.test/auto-resolution/analytics/roi",
        {
          cache: "no-store",
          headers: { Authorization: "Bearer session-token" },
        },
      ),
    );

    expect(await screen.findByText("1,240")).toBeInTheDocument();
    expect(screen.getByText("1m 45s")).toBeInTheDocument();
    expect(screen.getByText("98%")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toHaveAttribute(
      "data-organization",
      "ScalePoynt",
    );
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toHaveAttribute(
      "data-role",
      "ARCHITECT",
    );
  });

  it("shows access denied and does not request ROI data for developers", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/auth/sync")) {
        return Response.json({
          org: { name: "Member Workspace" },
          user: { role: "org:member" },
        });
      }
      throw new Error(`Unexpected protected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: RoiAnalyticsPage } = await import("./page");
    render(<RoiAnalyticsPage />);

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    expect(
      screen.getByText(/available only to workspace architects and auditors/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("ROI metrics")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/auto-resolution/analytics/roi"),
      ),
    ).toBe(false);
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toHaveAttribute(
      "data-organization",
      "Member Workspace",
    );
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toHaveAttribute(
      "data-role",
      "DEVELOPER",
    );
  });
});
