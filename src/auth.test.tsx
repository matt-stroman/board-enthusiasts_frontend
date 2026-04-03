import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";

const authClientMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
  unsubscribe: vi.fn(),
  callback: null as ((event: string, session: { access_token: string } | null) => void) | null,
}));

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const trackAnalyticsEventMock = vi.hoisted(() => vi.fn());

vi.mock("./config", () => ({
  readAppConfig: () => ({
    appEnv: "production",
    apiBaseUrl: "http://127.0.0.1:8787",
    supabaseUrl: "http://127.0.0.1:55421",
    supabasePublishableKey: "publishable-key",
    turnstileSiteKey: null,
    discordAuthEnabled: false,
    githubAuthEnabled: false,
    googleAuthEnabled: false,
    landingMode: false,
  }),
}));

vi.mock("./api", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("./app-core/analytics", () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: authClientMocks.getSession,
      signInWithOAuth: authClientMocks.signInWithOAuth,
      signUp: authClientMocks.signUp,
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
  const { loading, currentUser, signInWithSocialAuth, signUp } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="email">{currentUser?.email ?? ""}</div>
      <button type="button" onClick={() => void signInWithSocialAuth("discord")}>
        Trigger Discord Sign-In
      </button>
      <button type="button" onClick={() => void signInWithSocialAuth("discord", "sign-up")}>
        Trigger Discord Sign-Up
      </button>
      <button
        type="button"
        onClick={() =>
          void signUp({
            email: "new.player@example.com",
            password: "NewPlayer!123",
          })
        }
      >
        Trigger Email Sign-Up
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    authClientMocks.getSession.mockReset();
    authClientMocks.onAuthStateChange.mockReset();
    authClientMocks.signInWithOAuth.mockReset();
    authClientMocks.signUp.mockReset();
    authClientMocks.unsubscribe.mockReset();
    authClientMocks.callback = null;
    getCurrentUserMock.mockReset();
    trackAnalyticsEventMock.mockReset();
    window.sessionStorage.clear();
    window.localStorage.clear();
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

  it("starts Discord sign-in with the maintained redirect target and skips repeat consent when possible", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    authClientMocks.signInWithOAuth.mockResolvedValue({
      data: { provider: "discord", url: "https://discord.com/oauth2/authorize" },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    await act(async () => {
      screen.getByRole("button", { name: "Trigger Discord Sign-In" }).click();
      await Promise.resolve();
    });

    expect(authClientMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "discord",
      options: {
        redirectTo: "http://localhost:3000/auth/signin",
        queryParams: {
          prompt: "none",
        },
      },
    });
    expect(trackAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "oauth_started",
        provider: "discord",
        surface: "sign-in",
      }),
    );
  });

  it("keeps Discord sign-up on the normal authorization path", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    authClientMocks.signInWithOAuth.mockResolvedValue({
      data: { provider: "discord", url: "https://discord.com/oauth2/authorize" },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    await act(async () => {
      screen.getByRole("button", { name: "Trigger Discord Sign-Up" }).click();
      await Promise.resolve();
    });

    expect(authClientMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "discord",
      options: {
        redirectTo: "http://localhost:3000/auth/signin",
      },
    });
    expect(trackAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "oauth_started",
        provider: "discord",
        surface: "sign-up",
      }),
    );
  });

  it("records oauth completion after the redirect returns with a signed-in session", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    authClientMocks.signInWithOAuth.mockResolvedValue({
      data: { provider: "discord", url: "https://discord.com/oauth2/authorize" },
      error: null,
    });
    getCurrentUserMock.mockResolvedValue({
      subject: "user-1",
      displayName: "Discord Player",
      email: "discord.player@example.com",
      emailVerified: true,
      identityProvider: "discord",
      roles: ["player"],
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    await act(async () => {
      screen.getByRole("button", { name: "Trigger Discord Sign-In" }).click();
      await Promise.resolve();
    });

    await act(async () => {
      authClientMocks.callback?.("SIGNED_IN", { access_token: "oauth-token" });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(trackAnalyticsEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "oauth_completed",
          provider: "discord",
          surface: "sign-in",
          authState: "authenticated",
        }),
      ),
    );
  });

  it("records raw account creation for successful email sign-up", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    authClientMocks.signUp.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    await act(async () => {
      screen.getByRole("button", { name: "Trigger Email Sign-Up" }).click();
      await Promise.resolve();
    });

    expect(authClientMocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new.player@example.com",
        password: "NewPlayer!123",
      }),
    );
    expect(trackAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "account_created",
        surface: "email-password",
        authState: "anonymous",
        metadata: expect.objectContaining({
          requiresEmailConfirmation: true,
          identityProvider: "email",
        }),
      }),
    );
  });
});
