import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "../Sidebar";

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

describe("Sidebar ROI access", () => {
  it.each(["ARCHITECT", "AUDITOR"] as const)(
    "shows ROI Analytics to %s users",
    (userRole) => {
      render(<Sidebar orgName="Acme" userRole={userRole} />);

      expect(
        screen.getByRole("link", { name: "ROI Analytics" }),
      ).toHaveAttribute("href", "/roi-analytics");
    },
  );

  it.each(["DEVELOPER", ""] as const)(
    "hides ROI Analytics from %s users",
    (userRole) => {
      render(<Sidebar orgName="Acme" userRole={userRole} />);

      expect(
        screen.queryByRole("link", { name: "ROI Analytics" }),
      ).not.toBeInTheDocument();
    },
  );
});
