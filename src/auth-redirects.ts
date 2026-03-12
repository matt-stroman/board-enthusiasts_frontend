/**
 * Build the maintained frontend auth callback URL for Supabase email flows.
 *
 * Supabase redirect allowlists match the full path, so these URLs must stay
 * aligned with the configured callback entries in hosted and local auth.
 */
export function buildAuthRedirectUrl(origin: string, options?: { mode?: string | null }): string {
  const url = new URL("/auth/signin", origin);
  const mode = options?.mode?.trim();
  if (mode) {
    url.searchParams.set("mode", mode);
  }

  return url.toString();
}
