export interface AppConfig {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function requireValue(name: string, value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error(`${name} is required for the frontend runtime.`);
  }

  return trimmed;
}

export function readAppConfig(): AppConfig {
  return {
    apiBaseUrl: requireValue("VITE_API_BASE_URL", import.meta.env.VITE_API_BASE_URL),
    supabaseUrl: requireValue("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
    supabaseAnonKey: requireValue("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY)
  };
}
