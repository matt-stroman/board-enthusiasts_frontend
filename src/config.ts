export interface AppConfig {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  turnstileSiteKey: string | null;
  landingMode: boolean;
}

export interface FrontendRuntimeEnv {
  VITE_API_BASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
  VITE_LANDING_MODE?: string;
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

export function readAppConfigFromEnv(env: FrontendRuntimeEnv): AppConfig {
  return {
    apiBaseUrl: requireRuntimeUrl("VITE_API_BASE_URL", env.VITE_API_BASE_URL),
    supabaseUrl: requireRuntimeUrl("VITE_SUPABASE_URL", env.VITE_SUPABASE_URL),
    supabaseAnonKey: requireValue("VITE_SUPABASE_ANON_KEY", env.VITE_SUPABASE_ANON_KEY),
    turnstileSiteKey: (env.VITE_TURNSTILE_SITE_KEY ?? "").trim() || null,
    landingMode: (env.VITE_LANDING_MODE ?? "").trim().toLowerCase() === "true",
  };
}

export function readAppConfig(): AppConfig {
  return readAppConfigFromEnv(import.meta.env as FrontendRuntimeEnv);
}
