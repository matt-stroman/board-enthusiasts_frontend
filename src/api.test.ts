import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMarketingSignup,
  createSupportIssueReport,
  getBeHomeMetrics,
  listAgeRatingAuthorities,
  listCatalogTitles,
  listGenres,
  verifyCurrentUserPassword,
} from "./api";

describe("catalog API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests browse catalog data within the maintained page size limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ titles: [], paging: { pageNumber: 1, pageSize: 48, totalCount: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listCatalogTitles("http://127.0.0.1:8787", { studioSlug: "blue-harbor-games" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/catalog?pageNumber=1&pageSize=48&studioSlug=blue-harbor-games",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );
  });

  it("serializes multi-select browse filters into repeated catalog query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ titles: [], paging: { pageNumber: 2, pageSize: 25, totalCount: 0, totalPages: 1, hasPreviousPage: true, hasNextPage: false } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listCatalogTitles("http://127.0.0.1:8787", {
      pageNumber: 2,
      pageSize: 25,
      studioSlug: ["blue-harbor-games", "tiny-orbit-forge"],
      genre: ["Puzzle", "Family"],
      contentKind: "game",
      search: "lantern",
      minPlayers: 2,
      maxPlayers: 8,
      sort: "players-desc",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/catalog?pageNumber=2&pageSize=25&studioSlug=blue-harbor-games&studioSlug=tiny-orbit-forge&genre=Puzzle&genre=Family&contentKind=game&search=lantern&minPlayers=2&maxPlayers=8&sort=players-desc",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("requests the maintained genre catalog from the dedicated endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ genres: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listGenres("http://127.0.0.1:8787");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/genres",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("requests the maintained age rating authority catalog from the dedicated endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ageRatingAuthorities: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listAgeRatingAuthorities("http://127.0.0.1:8787");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/age-rating-authorities",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("posts marketing signups to the public waitlist endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        accepted: true,
        duplicate: false,
        signup: {
          email: "hello@example.com",
          firstName: "Matt",
          status: "subscribed",
          lifecycleStatus: "waitlisted",
          roleInterests: ["player"],
          source: "landing_page",
          consentedAt: "2026-03-12T19:00:00Z",
          updatedAt: "2026-03-12T19:00:00Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createMarketingSignup("http://127.0.0.1:8787", {
      email: "hello@example.com",
      firstName: "Matt",
      source: "landing_page",
      consentTextVersion: "landing-v1",
      turnstileToken: "token-123",
      roleInterests: ["player"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/marketing/signups",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({
          email: "hello@example.com",
          firstName: "Matt",
          source: "landing_page",
          consentTextVersion: "landing-v1",
          turnstileToken: "token-123",
          roleInterests: ["player"],
        }),
      }),
    );
  });

  it("posts internal support issue reports to the support endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        accepted: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createSupportIssueReport("http://127.0.0.1:8787", {
      category: "email_signup",
      firstName: "Taylor",
      email: "taylor@example.com",
      pageUrl: "http://127.0.0.1:4173/#signup",
      apiBaseUrl: "http://127.0.0.1:8787",
      occurredAt: "2026-03-12T19:15:00Z",
      errorMessage: "Could not reach the Board Enthusiasts API.",
      technicalDetails: "Network request failed with a connection error.",
      userAgent: "Vitest Browser",
      language: "en-US",
      timeZone: "America/Chicago",
      viewportWidth: 1440,
      viewportHeight: 900,
      screenWidth: 1440,
      screenHeight: 900,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/support/issues",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({
          category: "email_signup",
          firstName: "Taylor",
          email: "taylor@example.com",
          pageUrl: "http://127.0.0.1:4173/#signup",
          apiBaseUrl: "http://127.0.0.1:8787",
          occurredAt: "2026-03-12T19:15:00Z",
          errorMessage: "Could not reach the Board Enthusiasts API.",
          technicalDetails: "Network request failed with a connection error.",
          userAgent: "Vitest Browser",
          language: "en-US",
          timeZone: "America/Chicago",
          viewportWidth: 1440,
          viewportHeight: 900,
          screenWidth: 1440,
          screenHeight: 900,
        }),
      }),
    );
  });

  it("posts BE Home support requests to the support endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        accepted: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createSupportIssueReport("http://127.0.0.1:8787", {
      category: "be_home_contact",
      firstName: "Taylor",
      email: "taylor@example.com",
      subject: "Need help with BE Home",
      description: "The support button on Board is not opening the browser the way I expected.",
      marketingConsentGranted: true,
      marketingConsentTextVersion: "be-home-support-v1",
      pageUrl: "https://boardenthusiasts.com/support",
      apiBaseUrl: "http://127.0.0.1:8787",
      occurredAt: "2026-04-09T19:15:00Z",
      technicalDetails: null,
      userAgent: "Vitest Browser",
      language: "en-US",
      timeZone: "America/Chicago",
      viewportWidth: 1440,
      viewportHeight: 900,
      screenWidth: 1440,
      screenHeight: 900,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/support/issues",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({
          category: "be_home_contact",
          firstName: "Taylor",
          email: "taylor@example.com",
          subject: "Need help with BE Home",
          description: "The support button on Board is not opening the browser the way I expected.",
          marketingConsentGranted: true,
          marketingConsentTextVersion: "be-home-support-v1",
          pageUrl: "https://boardenthusiasts.com/support",
          apiBaseUrl: "http://127.0.0.1:8787",
          occurredAt: "2026-04-09T19:15:00Z",
          technicalDetails: null,
          userAgent: "Vitest Browser",
          language: "en-US",
          timeZone: "America/Chicago",
          viewportWidth: 1440,
          viewportHeight: 900,
          screenWidth: 1440,
          screenHeight: 900,
        }),
      }),
    );
  });

  it("requests BE Home aggregate metrics from the internal metrics endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        metrics: {
          activeNowTotal: 12,
          activeNowAnonymous: 8,
          activeNowSignedIn: 4,
          totalBoardsSeen: 42,
          dailyActiveDevices: 15,
          weeklyActiveDevices: 27,
          monthlyActiveDevices: 35,
          updatedAt: "2026-04-10T18:30:00Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getBeHomeMetrics("http://127.0.0.1:8787");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/internal/be-home/metrics",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("surfaces the first validation error message from API validation payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: async () => ({
        title: "One or more validation errors occurred.",
        status: 422,
        errors: {
          currentPassword: ["Current password is incorrect."],
        },
      }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyCurrentUserPassword("http://127.0.0.1:8787", "developer-token", {
        currentPassword: "wrong-password",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Current password is incorrect.",
        status: 422,
        errors: {
          currentPassword: ["Current password is incorrect."],
        },
      }),
    );
  });
});
