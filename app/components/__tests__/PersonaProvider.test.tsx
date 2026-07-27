import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaProvider, usePersona } from "../PersonaProvider";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

function PersonaHarness() {
  const { activeDefinition, selectPersona } = usePersona();

  return (
    <div>
      <span>{activeDefinition.label}</span>
      <button type="button" onClick={() => selectPersona("MANAGER")}>
        Select manager
      </button>
    </div>
  );
}

describe("PersonaProvider", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("uses the persona query parameter and persists it", async () => {
    window.history.replaceState({}, "", "/?persona=auditor");

    render(
      <PersonaProvider>
        <PersonaHarness />
      </PersonaProvider>,
    );

    expect(await screen.findByText("Auditor")).toBeInTheDocument();
    expect(window.localStorage.getItem("jataka.dashboard.persona")).toBe(
      "AUDITOR",
    );
  });

  it("switches personas without an authorization check", async () => {
    render(
      <PersonaProvider>
        <PersonaHarness />
      </PersonaProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select manager" }));

    await waitFor(() => expect(screen.getByText("Manager")).toBeInTheDocument());
    expect(window.localStorage.getItem("jataka.dashboard.persona")).toBe(
      "MANAGER",
    );
    expect(mocks.push).toHaveBeenCalledWith("/?persona=manager");
  });
});

