export type AppEnvironment = "local" | "staging" | "production";

export interface AppConfig {
  appEnv: AppEnvironment;
  apiBaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  turnstileSiteKey: string | null;
  discordAuthEnabled: boolean;
  githubAuthEnabled: boolean;
  googleAuthEnabled: boolean;
  landingMode: boolean;
}

export interface FrontendRuntimeEnv {
  VITE_APP_ENV?: string;
  VITE_API_BASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
  VITE_SUPABASE_AUTH_DISCORD_ENABLED?: string;
  VITE_SUPABASE_AUTH_GITHUB_ENABLED?: string;
  VITE_SUPABASE_AUTH_GOOGLE_ENABLED?: string;
  VITE_LANDING_MODE?: string;
}

function normalizeOptionalValue(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase();
  if (normalized.startsWith("optional-for-") || normalized === "replace-me" || normalized.startsWith("replace-with-")) {
    return null;
  }

  return trimmed;
}

function requireValue(name: string, value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error(`${name} is required for the frontend runtime.`);
  }

  return trimmed;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function requireRuntimeUrl(name: string, value: string | undefined): string {
  const trimmed = requireValue(name, value);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopbackHost(parsed.hostname))) {
    throw new Error(`${name} must use HTTPS outside local loopback development.`);
  }

  return trimmed;
}

function readBooleanFlag(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "true";
}

function inferAppEnvironment(apiBaseUrl: string): AppEnvironment {
  const hostname = new URL(apiBaseUrl).hostname;
  return isLoopbackHost(hostname) ? "local" : "production";
}

function readAppEnvironment(value: string | undefined, apiBaseUrl: string): AppEnvironment {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return inferAppEnvironment(apiBaseUrl);
  }

  if (normalized === "local" || normalized === "staging" || normalized === "production") {
    return normalized;
  }

  throw new Error("VITE_APP_ENV must be one of local, staging, or production.");
}

export function readAppConfigFromEnv(env: FrontendRuntimeEnv): AppConfig {
  const apiBaseUrl = requireRuntimeUrl("VITE_API_BASE_URL", env.VITE_API_BASE_URL);

  return {
    appEnv: readAppEnvironment(env.VITE_APP_ENV, apiBaseUrl),
    apiBaseUrl,
    supabaseUrl: requireRuntimeUrl("VITE_SUPABASE_URL", env.VITE_SUPABASE_URL),
    supabasePublishableKey: requireValue("VITE_SUPABASE_PUBLISHABLE_KEY", env.VITE_SUPABASE_PUBLISHABLE_KEY),
    turnstileSiteKey: normalizeOptionalValue(env.VITE_TURNSTILE_SITE_KEY),
    discordAuthEnabled: readBooleanFlag(env.VITE_SUPABASE_AUTH_DISCORD_ENABLED),
    githubAuthEnabled: readBooleanFlag(env.VITE_SUPABASE_AUTH_GITHUB_ENABLED),
    googleAuthEnabled: readBooleanFlag(env.VITE_SUPABASE_AUTH_GOOGLE_ENABLED),
    landingMode: readBooleanFlag(env.VITE_LANDING_MODE),
  };
}

export function readAppConfig(): AppConfig {
  return readAppConfigFromEnv(import.meta.env as FrontendRuntimeEnv);
}
