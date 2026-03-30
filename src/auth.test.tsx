import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";

const authClientMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  callback: null as ((event: string, session: { access_token: string } | null) => void) | null,
}));

const getCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock("./config", () => ({
  readAppConfig: () => ({
    apiBaseUrl: "http://127.0.0.1:8787",
    supabaseUrl: "http://127.0.0.1:55421",
    supabasePublishableKey: "publishable-key",
    turnstileSiteKey: null,
    landingMode: false,
  }),
}));

vi.mock("./api", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: authClientMocks.getSession,
      onAuthStateChange: (callback: (event: string, session: { access_token: string } | null) => void) => {
        authClientMocks.callback = callback;
        authClientMocks.onAuthStateChange(callback);
        return {
          data: {
            subscription: {
              unsubscribe: authClientMocks.unsubscribe,
            },
          },
        };
      },
    },
  })),
}));

function AuthProbe() {
  const { loading, currentUser } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="email">{currentUser?.email ?? ""}</div>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    authClientMocks.getSession.mockReset();
    authClientMocks.onAuthStateChange.mockReset();
    authClientMocks.unsubscribe.mockReset();
    authClientMocks.callback = null;
    getCurrentUserMock.mockReset();
  });

  it("does not re-enter loading on auth token refresh after bootstrap", async () => {
    let resolveRefreshUser: ((value: unknown) => void) | null = null;

    authClientMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token-1" } },
    });
    getCurrentUserMock
      .mockResolvedValueOnce({
        subject: "user-1",
        displayName: "Emma Torres",
        email: "emma.torres@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["developer"],
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefreshUser = resolve;
          }),
      );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("email")).toHaveTextContent("emma.torres@boardtpl.local");

    await act(async () => {
      authClientMocks.callback?.("TOKEN_REFRESHED", { access_token: "token-2" });
      await Promise.resolve();
    });

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("email")).toHaveTextContent("emma.torres@boardtpl.local");

    await act(async () => {
      resolveRefreshUser?.({
        subject: "user-1",
        displayName: "Emma Torres",
        email: "emma.torres@boardtpl.local",
        emailVerified: true,
        identityProvider: "email",
        roles: ["developer"],
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  });
});
