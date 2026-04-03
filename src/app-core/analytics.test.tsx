import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackAnalyticsEvent, usePageAnalytics } from "./analytics";

vi.mock("../config", () => ({
  readAppConfig: () => ({
    appEnv: "production",
    apiBaseUrl: "https://api.boardenthusiasts.test",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "publishable-key",
    turnstileSiteKey: null,
    discordAuthEnabled: false,
    githubAuthEnabled: false,
    googleAuthEnabled: false,
    landingMode: false,
  }),
}));

function AnalyticsProbe({ path, authState }: { path: string; authState: "anonymous" | "authenticated" }) {
  usePageAnalytics(path, authState);
  return null;
}

describe("analytics helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("posts a custom analytics event with anonymous visitor identifiers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    trackAnalyticsEvent({
      event: "oauth_started",
      path: "/auth/signin",
      authState: "anonymous",
      provider: "github",
      surface: "sign-in",
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.boardenthusiasts.test/analytics/events");
    expect(init.method).toBe("POST");

    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      event: "oauth_started",
      path: "/auth/signin",
      authState: "anonymous",
      provider: "github",
      surface: "sign-in",
    });
    expect(typeof payload.sessionId).toBe("string");
    expect(typeof payload.visitorId).toBe("string");
  });

  it("tracks page views with previous-path context and avoids duplicate sends for the same path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<AnalyticsProbe path="/browse" authState="anonymous" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    let payload = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(payload).toMatchObject({
      event: "page_view",
      path: "/browse",
      authState: "anonymous",
      referrerPath: null,
      metadata: {
        isNewVisitor: true,
      },
    });

    rerender(<AnalyticsProbe path="/browse" authState="authenticated" />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(<AnalyticsProbe path="/offerings" authState="authenticated" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    payload = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(payload).toMatchObject({
      event: "page_view",
      path: "/offerings",
      authState: "authenticated",
      referrerPath: "/browse",
      metadata: {
        isNewVisitor: false,
      },
    });
  });
});
