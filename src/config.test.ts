import { describe, expect, it } from "vitest";

import { readAppConfigFromEnv } from "./config";

describe("readAppConfigFromEnv", () => {
  it("allows loopback http endpoints for local development", () => {
    expect(
      readAppConfigFromEnv({
        VITE_API_BASE_URL: "http://127.0.0.1:8787",
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toEqual({
      apiBaseUrl: "http://127.0.0.1:8787",
      supabaseUrl: "http://127.0.0.1:54321",
      supabaseAnonKey: "anon-key",
      turnstileSiteKey: null,
    });
  });

  it("rejects non-https hosted endpoints", () => {
    expect(() =>
      readAppConfigFromEnv({
        VITE_API_BASE_URL: "http://api.boardenthusiasts.com",
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toThrow("VITE_API_BASE_URL must use HTTPS outside local loopback development.");

    expect(() =>
      readAppConfigFromEnv({
        VITE_API_BASE_URL: "https://api.boardenthusiasts.com",
        VITE_SUPABASE_URL: "http://project.supabase.co",
        VITE_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toThrow("VITE_SUPABASE_URL must use HTTPS outside local loopback development.");
  });
});
