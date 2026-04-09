import type { CurrentUserResponse, PlatformRole } from "@board-enthusiasts/migration-contract";
import { createClient, type Session, type SupabaseClient, type User as SupabaseAuthUser } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentUser } from "./api";
import { trackAnalyticsEvent } from "./app-core/analytics";
import { getUserFacingErrorMessage } from "./app-core/errors";
import { hasAuthRedirectCallbackParams, readAuthRedirectMode, writeSessionStorageValue } from "./app-core/shared";
import { publishBeHomeAuthState } from "./be-home-bridge";
import { buildAuthRedirectUrl } from "./auth-redirects";
import { readAppConfig } from "./config";

export interface SignUpInput {
  email: string;
  password: string;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  avatarDataUrl?: string | null;
  captchaToken?: string | null;
  marketingOptIn?: boolean | null;
  marketingConsentTextVersion?: string | null;
}

export type SocialAuthProvider = "discord" | "github" | "google";
export type SocialAuthIntent = "sign-in" | "sign-up";
export interface SocialAuthSignInOptions {
  marketingOptIn?: boolean;
  marketingConsentTextVersion?: string | null;
}

interface AuthContextValue {
  client: SupabaseClient;
  session: Session | null;
  currentUser: CurrentUserResponse | null;
  loading: boolean;
  authError: string | null;
  discordAuthEnabled: boolean;
  githubAuthEnabled: boolean;
  googleAuthEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithSocialAuth: (provider: SocialAuthProvider, intent?: SocialAuthIntent, options?: SocialAuthSignInOptions) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ requiresEmailConfirmation: boolean }>;
  requestPasswordReset: (email: string, captchaToken?: string | null) => Promise<void>;
  verifyEmailCode: (email: string, token: string) => Promise<void>;
  verifyRecoveryCode: (email: string, token: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: (options?: { tolerateNetworkFailure?: boolean }) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const appConfig = readAppConfig();
const supabase = createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey);
const AuthContext = createContext<AuthContextValue | null>(null);
const developerOrAboveRoles: readonly PlatformRole[] = ["developer", "verified_developer", "moderator", "admin", "super_admin"];
const moderatorOrAboveRoles: readonly PlatformRole[] = ["moderator", "admin", "super_admin"];
const oauthPendingStorageKey = "be-auth-pending-oauth";
export const passwordRecoveryRedirectStorageKey = "be-auth-password-recovery-pending";
export const passwordRecoveryExpectedStorageKey = "be-auth-password-recovery-expected";
const passwordRecoveryExpectedTtlMs = 6 * 60 * 60 * 1000;

type PendingOAuthState = {
  provider: SocialAuthProvider;
  intent: SocialAuthIntent;
  marketingOptIn: boolean;
  marketingConsentTextVersion: string | null;
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getSupabaseStorageKeys(supabaseUrl: string): string[] {
  const hostname = new URL(supabaseUrl).hostname;
  const storageKey = `sb-${hostname.split(".")[0] ?? hostname}-auth-token`;
  return [storageKey, `${storageKey}-code-verifier`, `${storageKey}-user`];
}

function readPendingOAuthState(): PendingOAuthState | null {
  try {
    const raw = window.sessionStorage.getItem(oauthPendingStorageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PendingOAuthState>;
    if (
      (parsed.provider === "discord" || parsed.provider === "github" || parsed.provider === "google")
      && (parsed.intent === "sign-in" || parsed.intent === "sign-up")
    ) {
      return {
        provider: parsed.provider,
        intent: parsed.intent,
        marketingOptIn: parsed.marketingOptIn === true,
        marketingConsentTextVersion:
          parsed.marketingOptIn === true && typeof parsed.marketingConsentTextVersion === "string" && parsed.marketingConsentTextVersion.trim().length > 0
            ? parsed.marketingConsentTextVersion.trim()
            : null,
      };
    }
  } catch {
    // Ignore malformed state and fall back to no pending OAuth marker.
  }

  return null;
}

function writePendingOAuthState(state: PendingOAuthState): void {
  try {
    window.sessionStorage.setItem(oauthPendingStorageKey, JSON.stringify(state));
  } catch {
    // Keep auth flow resilient even if session storage is unavailable.
  }
}

function clearPendingOAuthState(): void {
  try {
    window.sessionStorage.removeItem(oauthPendingStorageKey);
  } catch {
    // Ignore storage cleanup failures for the same reason as above.
  }
}

function markPasswordRecoveryPending(): void {
  clearPasswordRecoveryExpected();
  writeSessionStorageValue(passwordRecoveryRedirectStorageKey, "true");
}

function markPasswordRecoveryExpected(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(passwordRecoveryExpectedStorageKey, String(Date.now()));
  } catch {
    // Ignore storage write failures and keep the recovery request flow moving.
  }
}

function clearPasswordRecoveryExpected(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(passwordRecoveryExpectedStorageKey);
  } catch {
    // Ignore storage cleanup failures and keep the auth flow moving.
  }
}

function hasExpectedPasswordRecovery(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(passwordRecoveryExpectedStorageKey);
    if (!raw) {
      return false;
    }

    const requestedAt = Number.parseInt(raw, 10);
    if (!Number.isFinite(requestedAt) || requestedAt <= 0) {
      clearPasswordRecoveryExpected();
      return false;
    }

    if (Date.now() - requestedAt > passwordRecoveryExpectedTtlMs) {
      clearPasswordRecoveryExpected();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function shouldTreatCurrentLocationAsRecoveryCallback(): boolean {
  return readAuthRedirectMode() === "recovery" || (hasAuthRedirectCallbackParams() && hasExpectedPasswordRecovery());
}

function readFallbackAuthMetadataString(metadata: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const candidate = metadata[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function buildFallbackCurrentUser(authUser: SupabaseAuthUser | null | undefined): CurrentUserResponse | null {
  if (!authUser) {
    return null;
  }

  const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = readFallbackAuthMetadataString(metadata, "firstName", "given_name");
  const lastName = readFallbackAuthMetadataString(metadata, "lastName", "family_name");
  const displayName =
    readFallbackAuthMetadataString(metadata, "displayName", "full_name", "name") ??
    ([firstName, lastName].filter(Boolean).join(" ").trim() || null) ??
    authUser.email?.split("@")[0] ??
    "User";
  const identityProvider =
    typeof authUser.app_metadata?.provider === "string" && authUser.app_metadata.provider.trim().length > 0
      ? authUser.app_metadata.provider.trim()
      : "email";
  const avatarUrl = readFallbackAuthMetadataString(metadata, "avatarUrl", "avatar_url", "picture", "image");

  return {
    subject: authUser.id,
    displayName,
    email: authUser.email ?? null,
    emailVerified: Boolean(authUser.email_confirmed_at),
    identityProvider,
    roles: ["player"],
    avatarUrl,
  };
}

function publishEmbeddedAuthSnapshot(session: Session | null, currentUser: CurrentUserResponse | null, loading: boolean): void {
  if (loading) {
    return;
  }

  publishBeHomeAuthState({
    authenticated: Boolean(session?.access_token && currentUser),
    roles: currentUser?.roles ?? [],
    displayName: currentUser?.displayName ?? null,
  });
}

export function hasPlatformRole(roles: PlatformRole[], required: "player" | "developer" | "moderator"): boolean {
  const roleSet = new Set(roles);
  if (required === "player") {
    return roleSet.size > 0;
  }

  if (required === "developer") {
    return developerOrAboveRoles.some((role) => roleSet.has(role));
  }

  return moderatorOrAboveRoles.some((role) => roleSet.has(role));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  function clearLocalAuthState(): void {
    setSession(null);
    setCurrentUser(null);
    setAuthError(null);
    clearPendingOAuthState();

    for (const storageKey of getSupabaseStorageKeys(appConfig.supabaseUrl)) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore storage cleanup failures and continue clearing the in-memory session.
      }

      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore storage cleanup failures and continue clearing the in-memory session.
      }
    }
  }

  async function refreshCurrentUser(nextSession = session): Promise<void> {
    if (!nextSession?.access_token) {
      setCurrentUser(null);
      setAuthError(null);
      return;
    }

    let lastError: unknown = null;
    for (const retryDelay of [0, 150, 350]) {
      if (retryDelay > 0) {
        await delay(retryDelay);
      }

      try {
        const user = await getCurrentUser(appConfig.apiBaseUrl, nextSession.access_token);
        setCurrentUser(user);
        setAuthError(null);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    setCurrentUser(buildFallbackCurrentUser(nextSession.user));
    setAuthError(
      getUserFacingErrorMessage(lastError, "We couldn't fully refresh your account right now. Some account features may be temporarily limited.")
    );
  }

  async function consumePendingOAuthState(nextSession: Session | null): Promise<PendingOAuthState | null> {
    if (!nextSession?.access_token) {
      return null;
    }

    const pendingOAuth = readPendingOAuthState();
    if (!pendingOAuth) {
      return null;
    }

    // Clear the marker before any async work so oauth bootstrap and auth-state callbacks
    // do not re-run the same completion work or get stuck in update loops.
    clearPendingOAuthState();

    if (pendingOAuth.intent === "sign-up" && nextSession.user) {
      const existingMetadata =
        typeof nextSession.user.user_metadata === "object" && nextSession.user.user_metadata
          ? (nextSession.user.user_metadata as Record<string, unknown>)
          : {};
      const updateResult = await supabase.auth.updateUser({
        data: {
          ...existingMetadata,
          beMarketingOptIn: pendingOAuth.marketingOptIn,
          beMarketingConsentTextVersion: pendingOAuth.marketingOptIn ? pendingOAuth.marketingConsentTextVersion : null,
        },
      });
      if (updateResult.error) {
        setAuthError(
          getUserFacingErrorMessage(
            updateResult.error,
            "We couldn't finish setting up your account preferences right now. Please reload the page and try again."
          )
        );
      }
    }

    return pendingOAuth;
  }

  function recordCompletedOAuth(pendingOAuth: PendingOAuthState | null): void {
    if (!pendingOAuth) {
      return;
    }

    trackAnalyticsEvent({
      event: "oauth_completed",
      path: `${window.location.pathname}${window.location.search}`,
      authState: "authenticated",
      provider: pendingOAuth.provider,
      surface: pendingOAuth.intent,
      metadata: {
        identityProvider: pendingOAuth.provider,
      },
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      setLoading(true);
      if (shouldTreatCurrentLocationAsRecoveryCallback()) {
        markPasswordRecoveryPending();
      }
      const result = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }

      setSession(result.data.session);
      const pendingOAuth = await consumePendingOAuthState(result.data.session);
      await refreshCurrentUser(result.data.session);
      recordCompletedOAuth(pendingOAuth);
      setLoading(false);
    }

    void bootstrap();

    const subscription = supabase.auth.onAuthStateChange((event, nextSession) => {
      void (async () => {
        try {
          if (event === "PASSWORD_RECOVERY" || shouldTreatCurrentLocationAsRecoveryCallback()) {
            markPasswordRecoveryPending();
          }
          setSession(nextSession);
          const pendingOAuth =
            event === "SIGNED_IN" || event === "INITIAL_SESSION" ? await consumePendingOAuthState(nextSession) : null;

          await refreshCurrentUser(nextSession);
          recordCompletedOAuth(pendingOAuth);
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    publishEmbeddedAuthSnapshot(session, currentUser, loading);
  }, [session, currentUser, loading]);

  const value = useMemo<AuthContextValue>(
    () => ({
      client: supabase,
      session,
      currentUser,
      loading,
      authError,
      discordAuthEnabled: appConfig.discordAuthEnabled,
      githubAuthEnabled: appConfig.githubAuthEnabled,
      googleAuthEnabled: appConfig.googleAuthEnabled,
      async signIn(email: string, password: string): Promise<void> {
        clearPasswordRecoveryExpected();
        setLoading(true);
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) {
          setLoading(false);
          throw new Error(getUserFacingErrorMessage(result.error));
        }

        setSession(result.data.session);
        await refreshCurrentUser(result.data.session);
        setLoading(false);
      },
      async signInWithSocialAuth(
        provider: SocialAuthProvider,
        intent: SocialAuthIntent = "sign-in",
        options?: SocialAuthSignInOptions
      ): Promise<void> {
        clearPasswordRecoveryExpected();
        trackAnalyticsEvent({
          event: "oauth_started",
          path: `${window.location.pathname}${window.location.search}`,
          authState: session && currentUser ? "authenticated" : "anonymous",
          provider,
          surface: intent,
          metadata: {
            redirectTo: buildAuthRedirectUrl(window.location.origin),
          },
        });
        writePendingOAuthState({
          provider,
          intent,
          marketingOptIn: options?.marketingOptIn === true,
          marketingConsentTextVersion: options?.marketingOptIn === true ? options.marketingConsentTextVersion?.trim() ?? null : null,
        });
        const queryParams =
          provider === "discord" && intent === "sign-in"
            ? {
                prompt: "none",
              }
            : undefined;
        const result = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: buildAuthRedirectUrl(window.location.origin),
            queryParams,
          },
        });
        if (result.error) {
          clearPendingOAuthState();
          throw new Error(getUserFacingErrorMessage(result.error, "We couldn't start that sign-in option right now. Please try again."));
        }
      },
      async signUp(input: SignUpInput): Promise<{ requiresEmailConfirmation: boolean }> {
        clearPasswordRecoveryExpected();
        const userName = input.userName?.trim() || null;
        const firstName = input.firstName?.trim() || null;
        const lastName = input.lastName?.trim() || null;
        const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
        const result = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            emailRedirectTo: buildAuthRedirectUrl(window.location.origin),
            data: {
              userName,
              firstName,
              lastName,
              displayName,
              avatarUrl: input.avatarUrl ?? null,
              avatarDataUrl: input.avatarDataUrl ?? null,
              beMarketingOptIn: input.marketingOptIn === true,
              beMarketingConsentTextVersion:
                input.marketingOptIn === true ? input.marketingConsentTextVersion?.trim() ?? null : null,
            },
            captchaToken: input.captchaToken ?? undefined,
          },
        });
        if (result.error) {
          throw new Error(getUserFacingErrorMessage(result.error));
        }

        trackAnalyticsEvent({
          event: "account_created",
          path: `${window.location.pathname}${window.location.search}`,
          authState: "anonymous",
          surface: "email-password",
          metadata: {
            requiresEmailConfirmation: !result.data.session,
            identityProvider: "email",
          },
        });

        setSession(result.data.session);
        if (result.data.session) {
          await refreshCurrentUser(result.data.session);
        }

        return {
          requiresEmailConfirmation: !result.data.session,
        };
      },
      async requestPasswordReset(email: string, captchaToken?: string | null): Promise<void> {
        const redirectTo = buildAuthRedirectUrl(window.location.origin, { mode: "recovery" });
        const result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
          captchaToken: captchaToken ?? undefined,
        });
        if (result.error) {
          throw new Error(getUserFacingErrorMessage(result.error));
        }

        markPasswordRecoveryExpected();
      },
      async verifyEmailCode(email: string, token: string): Promise<void> {
        clearPasswordRecoveryExpected();
        setLoading(true);
        const result = await supabase.auth.verifyOtp({ email, token, type: "signup" });
        if (result.error) {
          setLoading(false);
          throw new Error(getUserFacingErrorMessage(result.error));
        }

        setSession(result.data.session);
        await refreshCurrentUser(result.data.session);
        setLoading(false);
      },
      async verifyRecoveryCode(email: string, token: string): Promise<void> {
        setLoading(true);
        const result = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
        if (result.error) {
          setLoading(false);
          throw new Error(getUserFacingErrorMessage(result.error));
        }

        setSession(result.data.session);
        await refreshCurrentUser(result.data.session);
        setLoading(false);
      },
      async updatePassword(password: string): Promise<void> {
        const result = await supabase.auth.updateUser({ password });
        if (result.error) {
          throw new Error(getUserFacingErrorMessage(result.error));
        }

        clearPasswordRecoveryExpected();
      },
      async signOut(options?: { tolerateNetworkFailure?: boolean }): Promise<void> {
        clearPasswordRecoveryExpected();
        try {
          const result = await supabase.auth.signOut();
          if (result.error) {
            throw new Error(getUserFacingErrorMessage(result.error));
          }
        } catch (error) {
          if (!options?.tolerateNetworkFailure) {
            throw error instanceof Error ? error : new Error(String(error));
          }
        }

        clearLocalAuthState();
      },
      refreshCurrentUser
    }),
    [session, currentUser, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
