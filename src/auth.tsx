import type { CurrentUserResponse, PlatformRole } from "@board-enthusiasts/migration-contract";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentUser } from "./api";
import { readAppConfig } from "./config";

interface AuthContextValue {
  client: SupabaseClient;
  session: Session | null;
  currentUser: CurrentUserResponse | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const appConfig = readAppConfig();
const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
const AuthContext = createContext<AuthContextValue | null>(null);
const developerOrAboveRoles: readonly PlatformRole[] = ["developer", "verified_developer", "moderator", "admin", "super_admin"];
const moderatorOrAboveRoles: readonly PlatformRole[] = ["moderator", "admin", "super_admin"];

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

  async function refreshCurrentUser(nextSession = session): Promise<void> {
    if (!nextSession?.access_token) {
      setCurrentUser(null);
      return;
    }

    try {
      const user = await getCurrentUser(appConfig.apiBaseUrl, nextSession.access_token);
      setCurrentUser(user);
      setAuthError(null);
    } catch (error) {
      setCurrentUser(null);
      setAuthError(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      const result = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }

      setSession(result.data.session);
      if (result.data.session) {
        await refreshCurrentUser(result.data.session);
      }
      setLoading(false);
    }

    void bootstrap();

    const subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      void refreshCurrentUser(nextSession);
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
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) {
          throw new Error(result.error.message);
        }

        setSession(result.data.session);
        await refreshCurrentUser(result.data.session);
      },
      async signOut(): Promise<void> {
        const result = await supabase.auth.signOut();
        if (result.error) {
          throw new Error(result.error.message);
        }

        setSession(null);
        setCurrentUser(null);
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
