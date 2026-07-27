import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonaSwitcher from "../PersonaSwitcher";
import { PERSONA_DEFINITIONS } from "../../lib/dashboard-persona";

const mocks = vi.hoisted(() => ({
  selectPersona: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("../PersonaProvider", () => ({
  usePersona: () => ({
    activePersona: "ARCHITECT",
    activeDefinition: PERSONA_DEFINITIONS.ARCHITECT,
    selectPersona: mocks.selectPersona,
  }),
}));

describe("PersonaSwitcher", () => {
  beforeEach(() => {
    mocks.selectPersona.mockReset();
  });

  it("opens an accessible preview menu with every persona", () => {
    render(<PersonaSwitcher />);

    fireEvent.click(
      screen.getByRole("button", { name: /switch persona.*architect/i }),
    );

    expect(
      screen.getByRole("menu", { name: "Switch dashboard persona" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(7);
    expect(
      screen.getByRole("menuitemradio", { name: /manager/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not change authentication or permissions/i),
    ).toBeInTheDocument();
  });

  it("selects a persona without checking authentication", () => {
    render(<PersonaSwitcher />);

    fireEvent.click(
      screen.getByRole("button", { name: /switch persona.*architect/i }),
    );
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: /manager/i }),
    );

    expect(mocks.selectPersona).toHaveBeenCalledWith("MANAGER");
  });
});
