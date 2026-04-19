import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { AuthProvider, passwordRecoveryExpectedStorageKey, passwordRecoveryRedirectStorageKey, useAuth } from "./auth";

const authClientMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  updateUser: vi.fn(),
  unsubscribe: vi.fn(),
  callback: null as ((event: string, session: { access_token: string; user?: { user_metadata?: Record<string, unknown> } } | null) => void) | null,
}));

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const trackAnalyticsEventMock = vi.hoisted(() => vi.fn());
const publishBeHomeAuthStateMock = vi.hoisted(() => vi.fn());

vi.mock("./config", () => ({
  readAppConfig: () => ({
    appEnv: "production",
    apiBaseUrl: "http://127.0.0.1:8787",
    supabaseUrl: "http://127.0.0.1:54321",
    supabasePublishableKey: "publishable-key",
    turnstileSiteKey: null,
    discordAuthEnabled: false,
    githubAuthEnabled: false,
    googleAuthEnabled: false,
    landingMode: false,
  }),
}));

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    getCurrentUser: getCurrentUserMock,
  };
});

vi.mock("./app-core/analytics", () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

vi.mock("./be-home-bridge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./be-home-bridge")>();
  return {
    ...actual,
    publishBeHomeAuthState: publishBeHomeAuthStateMock,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: authClientMocks.getSession,
      resetPasswordForEmail: authClientMocks.resetPasswordForEmail,
      signInWithPassword: authClientMocks.signInWithPassword,
      signInWithOAuth: authClientMocks.signInWithOAuth,
      signOut: authClientMocks.signOut,
      signUp: authClientMocks.signUp,
      updateUser: authClientMocks.updateUser,
      onAuthStateChange: (callback: (event: string, session: { access_token: string; user?: { user_metadata?: Record<string, unknown> } } | null) => void) => {
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
  const { loading, currentUser, requestPasswordReset, signIn, signInWithSocialAuth, signUp } = useAuth();
  const [signInError, setSignInError] = useState("");
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="email">{currentUser?.email ?? ""}</div>
      <div data-testid="sign-in-error">{signInError}</div>
      <button type="button" onClick={() => void requestPasswordReset("player@example.com")}>
        Trigger Password Reset
      </button>
      <button
        type="button"
        onClick={() =>
          void signIn("player@example.com", "Player!234").catch((error: unknown) => {
            setSignInError(error instanceof Error ? error.message : String(error));
          })
        }
      >
        Trigger Email Sign-In
      </button>
      <button type="button" onClick={() => void signInWithSocialAuth("discord")}>
        Trigger Discord Sign-In
      </button>
      <button
        type="button"
        onClick={() =>
          void signInWithSocialAuth("discord", "sign-up", {
            marketingOptIn: true,
            marketingConsentTextVersion: "account-signup-v1",
          })
        }
      >
        Trigger Discord Sign-Up
      </button>
      <button
        type="button"
        onClick={() =>
          void signUp({
            email: "new.player@example.com",
            password: "NewPlayer!123",
            marketingOptIn: true,
            marketingConsentTextVersion: "account-signup-v1",
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
    authClientMocks.resetPasswordForEmail.mockReset();
    authClientMocks.signInWithPassword.mockReset();
    authClientMocks.signInWithOAuth.mockReset();
    authClientMocks.signOut.mockReset();
    authClientMocks.signUp.mockReset();
    authClientMocks.updateUser.mockReset();
    authClientMocks.unsubscribe.mockReset();
    authClientMocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    authClientMocks.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });
    authClientMocks.signOut.mockResolvedValue({
      error: null,
    });
    authClientMocks.callback = null;
    getCurrentUserMock.mockReset();
    trackAnalyticsEventMock.mockReset();
    publishBeHomeAuthStateMock.mockReset();
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState(null, document.title, "/");
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

  it("marks password recovery callbacks for the maintained reset-password route", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    getCurrentUserMock.mockResolvedValue(null);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await act(async () => {
      authClientMocks.callback?.("PASSWORD_RECOVERY", {
        access_token: "recovery-token",
        user: {},
      });
      await Promise.resolve();
    });

    expect(window.sessionStorage.getItem(passwordRecoveryRedirectStorageKey)).toBe("true");
  });

  it("remembers password reset requests for same-browser recovery callbacks", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    getCurrentUserMock.mockResolvedValue(null);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByRole("button", { name: "Trigger Password Reset" }).click();
      await Promise.resolve();
    });

    expect(window.localStorage.getItem(passwordRecoveryExpectedStorageKey)).toMatch(/^\d+$/);
  });

  it("promotes expected same-browser recovery callbacks even without an explicit recovery mode", async () => {
    window.localStorage.setItem(passwordRecoveryExpectedStorageKey, String(Date.now()));
    window.history.replaceState(null, document.title, "/#access_token=recovery-token&refresh_token=refresh-token");
    authClientMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "recovery-token" } },
    });
    getCurrentUserMock.mockResolvedValue(null);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(window.sessionStorage.getItem(passwordRecoveryRedirectStorageKey)).toBe("true");
    expect(window.localStorage.getItem(passwordRecoveryExpectedStorageKey)).toBeNull();
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

  it("applies marketing consent metadata before completing oauth sign-up refresh", async () => {
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
      screen.getByRole("button", { name: "Trigger Discord Sign-Up" }).click();
      await Promise.resolve();
    });

    await act(async () => {
      authClientMocks.callback?.("SIGNED_IN", {
        access_token: "oauth-token",
        user: {
          user_metadata: {
            full_name: "Discord Player",
          },
        },
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(authClientMocks.updateUser).toHaveBeenCalledWith({
        data: {
          full_name: "Discord Player",
          beMarketingOptIn: true,
          beMarketingConsentTextVersion: "account-signup-v1",
        },
      }),
    );
  });

  it("finalizes pending oauth sign-up state during bootstrap before the redirect callback fires", async () => {
    window.sessionStorage.setItem(
      "be-auth-pending-oauth",
      JSON.stringify({
        provider: "github",
        intent: "sign-up",
        marketingOptIn: true,
        marketingConsentTextVersion: "account-signup-v1",
      }),
    );
    authClientMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "oauth-token",
          user: {
            user_metadata: {
              full_name: "GitHub Player",
            },
          },
        },
      },
    });
    getCurrentUserMock.mockResolvedValue({
      subject: "user-1",
      displayName: "GitHub Player",
      email: "github.player@example.com",
      emailVerified: true,
      identityProvider: "github",
      roles: ["player"],
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(authClientMocks.updateUser).toHaveBeenCalledWith({
        data: {
          full_name: "GitHub Player",
          beMarketingOptIn: true,
          beMarketingConsentTextVersion: "account-signup-v1",
        },
      }),
    );
    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("github.player@example.com"));
    expect(trackAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "oauth_completed",
        provider: "github",
        surface: "sign-up",
      }),
    );
    expect(window.sessionStorage.getItem("be-auth-pending-oauth")).toBeNull();
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
        options: expect.objectContaining({
          data: expect.objectContaining({
            beMarketingOptIn: true,
            beMarketingConsentTextVersion: "account-signup-v1",
          }),
        }),
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

  it("falls back to the Supabase session user when the current-user api cannot be refreshed", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token-1",
          user: {
            id: "user-1",
            email: "fallback.player@example.com",
            email_confirmed_at: "2026-04-03T12:00:00Z",
            app_metadata: { provider: "discord" },
            user_metadata: {
              full_name: "Fallback Player",
            },
          },
        },
      },
    });
    getCurrentUserMock.mockRejectedValue(new Error("Current user api unavailable."));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("email")).toHaveTextContent("fallback.player@example.com");
  });

  it("clears local auth state when the current-user api reports an inactive session", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token-1",
          user: {
            id: "user-1",
            email: "expired.player@example.com",
          },
        },
      },
    });
    getCurrentUserMock.mockRejectedValue(new ApiError("Your session is no longer active. Please sign in again and try once more.", 401));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("email")).toHaveTextContent("");
    expect(authClientMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(publishBeHomeAuthStateMock).toHaveBeenLastCalledWith({
      authenticated: false,
      roles: [],
      displayName: null,
    });
  });

  it("rejects email sign-in when the refreshed current-user session is already inactive", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    authClientMocks.signInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: "token-2",
          user: {
            id: "user-2",
            email: "expired.player@example.com",
          },
        },
      },
      error: null,
    });
    getCurrentUserMock.mockRejectedValue(new ApiError("Your session is no longer active. Please sign in again and try once more.", 401));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    await act(async () => {
      screen.getByRole("button", { name: "Trigger Email Sign-In" }).click();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByTestId("sign-in-error")).toHaveTextContent("Your session is no longer active. Please sign in again and try once more."),
    );
    expect(screen.getByTestId("email")).toHaveTextContent("");
    expect(authClientMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("publishes BE Home auth bridge state after bootstrap completes", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token-1" } },
    });
    getCurrentUserMock.mockResolvedValue({
      subject: "user-1",
      displayName: "Emma Torres",
      email: "emma.torres@boardtpl.local",
      emailVerified: true,
      identityProvider: "email",
      roles: ["developer"],
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(publishBeHomeAuthStateMock).toHaveBeenLastCalledWith({
      authenticated: true,
      roles: ["developer"],
      displayName: "Emma Torres",
    });
  });

  it("publishes a signed-out BE Home auth bridge state when no session is active", async () => {
    authClientMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    getCurrentUserMock.mockResolvedValue(null);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(publishBeHomeAuthStateMock).toHaveBeenLastCalledWith({
      authenticated: false,
      roles: [],
      displayName: null,
    });
  });
});

