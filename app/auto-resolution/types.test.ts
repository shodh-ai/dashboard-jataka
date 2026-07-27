import { describe, expect, it } from "vitest";
import { isResolvableProposal } from "./types";

describe("isResolvableProposal", () => {
  it("allows deterministic PREPARE_PATCH execution after approval", () => {
    expect(isResolvableProposal("PREPARE_PATCH")).toBe(true);
  });

  it("blocks handoff and unimplemented deployment actions", () => {
    expect(isResolvableProposal("REQUEST_MORE_INFO")).toBe(false);
    expect(isResolvableProposal("DEPLOY_CHANGE")).toBe(false);
    expect(isResolvableProposal(undefined)).toBe(false);
  });
});
