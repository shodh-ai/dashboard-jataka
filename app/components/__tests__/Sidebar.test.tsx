import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "../Sidebar";
import {
  PERSONA_DEFINITIONS,
  type DashboardPersona,
} from "../../lib/dashboard-persona";

const mocks = vi.hoisted(() => ({
  activePersona: "ARCHITECT" as DashboardPersona,
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: {
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
    },
  }),
  SignOutButton: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("../PersonaProvider", () => ({
  usePersona: () => ({
    activePersona: mocks.activePersona,
    activeDefinition: PERSONA_DEFINITIONS[mocks.activePersona],
    selectPersona: vi.fn(),
  }),
}));

describe("persona navigation", () => {
  beforeEach(() => {
    mocks.activePersona = "ARCHITECT";
  });

  it("shows the focused architect navigation", () => {
    render(<Sidebar orgName="Acme" />);

    expect(
      screen.getByRole("link", { name: "Dependency Graph" }),
    ).toHaveAttribute("href", "/dependency-graph");
    expect(
      screen.queryByRole("link", { name: "Integrations" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Decision Queue" }),
    ).not.toBeInTheDocument();
  });

  it("shows manager decisions and ROI without technical administration", () => {
    mocks.activePersona = "MANAGER";
    render(<Sidebar orgName="Acme" />);

    expect(
      screen.getByRole("link", { name: "Decision Queue" }),
    ).toHaveAttribute("href", "/manager/decisions");
    expect(
      screen.getByRole("link", { name: "ROI Analytics" }),
    ).toHaveAttribute("href", "/roi-analytics");
    expect(
      screen.queryByRole("link", { name: "Developer Tools" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Audit Logs" }),
    ).not.toBeInTheDocument();
  });

  it("shows integration and automation controls to platform admins", () => {
    mocks.activePersona = "ADMIN";
    render(<Sidebar orgName="Acme" />);

    expect(
      screen.getByRole("link", { name: "Integrations" }),
    ).toHaveAttribute("href", "/integrations");
    expect(
      screen.getByRole("link", { name: "Auto Resolution" }),
    ).toHaveAttribute("href", "/auto-resolution");
    expect(
      screen.queryByRole("link", { name: "Dependency Graph" }),
    ).not.toBeInTheDocument();
  });
});
