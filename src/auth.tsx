import type { CurrentUserResponse, PlatformRole } from "@board-enthusiasts/migration-contract";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentUser } from "./api";
import { buildAuthRedirectUrl } from "./auth-redirects";
import { readAppConfig } from "./config";

export interface SignUpInput {
  email: string;
  password: string;
  userName: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  avatarDataUrl?: string | null;
  captchaToken?: string | null;
}

interface AuthContextValue {
  client: SupabaseClient;
  session: Session | null;
  currentUser: CurrentUserResponse | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ requiresEmailConfirmation: boolean }>;
  requestPasswordReset: (email: string, captchaToken?: string | null) => Promise<void>;
  verifyEmailCode: (email: string, token: string) => Promise<void>;
  verifyRecoveryCode: (email: string, token: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: (options?: { tolerateNetworkFailure?: boolean }) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const appConfig = readAppConfig();
const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
const AuthContext = createContext<AuthContextValue | null>(null);
const developerOrAboveRoles: readonly PlatformRole[] = ["developer", "verified_developer", "moderator", "admin", "super_admin"];
const moderatorOrAboveRoles: readonly PlatformRole[] = ["moderator", "admin", "super_admin"];

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

    setCurrentUser(null);
    setAuthError(lastError instanceof Error ? lastError.message : String(lastError));
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      setLoading(true);
      const result = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }

      setSession(result.data.session);
      await refreshCurrentUser(result.data.session);
      setLoading(false);
    }

    void bootstrap();

    const subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void (async () => {
        setLoading(true);
        setSession(nextSession);
        await refreshCurrentUser(nextSession);
        if (!cancelled) {
          setLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      client: supabase,
      session,
      currentUser,
      loading,
      authError,
      async signIn(email: string, password: string): Promise<void> {
        setLoading(true);
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) {
          setLoading(false);
          throw new Error(result.error.message);
        }

        setSession(result.data.session);
        await refreshCurrentUser(result.data.session);
        setLoading(false);
      },
      async signUp(input: SignUpInput): Promise<{ requiresEmailConfirmation: boolean }> {
        const result = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            emailRedirectTo: buildAuthRedirectUrl(window.location.origin),
            data: {
              userName: input.userName,
              firstName: input.firstName,
              lastName: input.lastName,
              displayName: `${input.firstName} ${input.lastName}`.trim(),
              avatarUrl: input.avatarUrl ?? null,
              avatarDataUrl: input.avatarDataUrl ?? null,
            },
            captchaToken: input.captchaToken ?? undefined,
          },
        });
        if (result.error) {
          throw new Error(result.error.message);
        }

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
          throw new Error(result.error.message);
        }
      },
      async verifyEmailCode(email: string, token: string): Promise<void> {
        setLoading(true);
        const result = await supabase.auth.verifyOtp({ email, token, type: "signup" });
        if (result.error) {
          setLoading(false);
          throw new Error(result.error.message);
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
          throw new Error(result.error.message);
        }

        setSession(result.data.session);
        await refreshCurrentUser(result.data.session);
        setLoading(false);
      },
      async updatePassword(password: string): Promise<void> {
        const result = await supabase.auth.updateUser({ password });
        if (result.error) {
          throw new Error(result.error.message);
        }
      },
      async signOut(options?: { tolerateNetworkFailure?: boolean }): Promise<void> {
        try {
          const result = await supabase.auth.signOut();
          if (result.error) {
            throw new Error(result.error.message);
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
