import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "./api-error";

describe("getApiErrorMessage", () => {
  it("extracts Nest and Axios error messages", () => {
    expect(
      getApiErrorMessage(
        {
          response: {
            data: {
              message: "Indexed Apex source not found",
              error: "Internal Server Error",
            },
          },
        },
        "fallback",
      ),
    ).toBe("Indexed Apex source not found");
  });

  it("joins validation messages and never stringifies objects", () => {
    expect(
      getApiErrorMessage({ message: ["Issue text is required", "Select a brain"] }, "fallback"),
    ).toBe("Issue text is required; Select a brain");
    expect(getApiErrorMessage({ message: { nested: true } }, "Try again")).toBe(
      "Try again",
    );
  });
});
