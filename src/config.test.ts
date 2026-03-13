import { describe, expect, it } from "vitest";

import { readAppConfigFromEnv } from "./config";

describe("readAppConfigFromEnv", () => {
  it("allows loopback http endpoints for local development", () => {
    expect(
      readAppConfigFromEnv({
        VITE_API_BASE_URL: "http://127.0.0.1:8787",
        VITE_SUPABASE_URL: "http://127.0.0.1:55421",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toEqual({
      apiBaseUrl: "http://127.0.0.1:8787",
      supabaseUrl: "http://127.0.0.1:55421",
      supabasePublishableKey: "publishable-key",
      turnstileSiteKey: null,
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
        VITE_API_BASE_URL: "https://api.boardenthusiasts.com",
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        VITE_LANDING_MODE: "true",
      }),
    ).toEqual({
      apiBaseUrl: "https://api.boardenthusiasts.com",
      supabaseUrl: "https://project.supabase.co",
      supabasePublishableKey: "publishable-key",
      turnstileSiteKey: null,
      landingMode: true,
    });
  });
});
