import { describe, expect, it } from "vitest";

import { readAppConfigFromEnv } from "./config";

describe("readAppConfigFromEnv", () => {
  it("allows loopback http endpoints for local development", () => {
    expect(
      readAppConfigFromEnv({
        VITE_API_BASE_URL: "http://127.0.0.1:8787",
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toEqual({
      appEnv: "local",
      apiBaseUrl: "http://127.0.0.1:8787",
      supabaseUrl: "http://127.0.0.1:54321",
      supabasePublishableKey: "publishable-key",
      turnstileSiteKey: null,
      discordAuthEnabled: false,
      githubAuthEnabled: false,
      googleAuthEnabled: false,
      landingMode: false,
    });
  });

  it("rejects non-https hosted endpoints", () => {
    expect(() =>
      readAppConfigFromEnv({
        VITE_API_BASE_URL: "http://api.boardenthusiasts.com",
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toThrow("VITE_API_BASE_URL must use HTTPS outside local loopback development.");

    expect(() =>
      readAppConfigFromEnv({
        VITE_API_BASE_URL: "https://api.boardenthusiasts.com",
        VITE_SUPABASE_URL: "http://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toThrow("VITE_SUPABASE_URL must use HTTPS outside local loopback development.");
  });

  it("enables landing mode when explicitly requested", () => {
    expect(
      readAppConfigFromEnv({
        VITE_APP_ENV: "staging",
        VITE_API_BASE_URL: "https://api.boardenthusiasts.com",
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        VITE_SUPABASE_AUTH_DISCORD_ENABLED: "true",
        VITE_SUPABASE_AUTH_GITHUB_ENABLED: "true",
        VITE_SUPABASE_AUTH_GOOGLE_ENABLED: "true",
        VITE_LANDING_MODE: "true",
      }),
    ).toEqual({
      appEnv: "staging",
      apiBaseUrl: "https://api.boardenthusiasts.com",
      supabaseUrl: "https://project.supabase.co",
      supabasePublishableKey: "publishable-key",
      turnstileSiteKey: null,
      discordAuthEnabled: true,
      githubAuthEnabled: true,
      googleAuthEnabled: true,
      landingMode: true,
    });
  });

  it("rejects unsupported app environments", () => {
    expect(() =>
      readAppConfigFromEnv({
        VITE_APP_ENV: "preview",
        VITE_API_BASE_URL: "https://api.boardenthusiasts.com",
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toThrow("VITE_APP_ENV must be one of local, staging, or production.");
  });
});

