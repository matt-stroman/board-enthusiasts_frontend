import { afterEach, describe, expect, it, vi } from "vitest";

import { listAgeRatingAuthorities, listCatalogTitles, listGenres } from "./api";

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
});
