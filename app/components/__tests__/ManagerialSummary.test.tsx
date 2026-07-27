import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ManagerialSummary from "../ManagerialSummary";

describe("ManagerialSummary", () => {
  it("prominently renders the three manager decision fields", () => {
    render(
      <ManagerialSummary
        summary={{
          rootCause: "A dependency failed.",
          fix: "Apply the validated change.",
          risk: "Low.",
          isFallback: { rootCause: false, fix: false, risk: false },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Managerial summary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Root cause" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fix" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Risk" })).toBeInTheDocument();
    expect(screen.getByText("A dependency failed.")).toBeInTheDocument();
  });

  it("labels fallback content as awaiting grounded detail", () => {
    render(
      <ManagerialSummary
        summary={{
          rootCause: "Unavailable.",
          fix: "Unavailable.",
          risk: "Unavailable.",
          isFallback: { rootCause: true, fix: true, risk: true },
        }}
      />,
    );

    expect(
      screen.getAllByText("Awaiting grounded proposal detail"),
    ).toHaveLength(3);
  });
});
