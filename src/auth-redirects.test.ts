import { describe, expect, it } from "vitest";
import { buildAuthRedirectUrl } from "./auth-redirects";

describe("buildAuthRedirectUrl", () => {
  it("builds the sign-in callback route by default", () => {
    expect(buildAuthRedirectUrl("http://127.0.0.1:4173")).toBe("http://127.0.0.1:4173/auth/signin");
  });

  it("preserves the recovery mode query when requested", () => {
    expect(buildAuthRedirectUrl("http://127.0.0.1:4173", { mode: "recovery" })).toBe(
      "http://127.0.0.1:4173/auth/signin?mode=recovery",
    );
  });
});
