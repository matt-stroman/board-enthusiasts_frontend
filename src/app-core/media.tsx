import { useEffect, useState } from "react";

export type CatalogMediaLoadState = "idle" | "loading" | "loaded" | "failed";

type CatalogMediaCacheEntry = {
  state: Extract<CatalogMediaLoadState, "loaded" | "failed">;
  updatedAt: number;
};

const catalogMediaCacheStorageKey = "be-catalog-media-cache-v1";
const catalogMediaLoadedTtlMs = 24 * 60 * 60 * 1000;
const catalogMediaFailedTtlMs = 5 * 60 * 1000;
const catalogMediaCacheLimit = 200;
const catalogMediaCache = new Map<string, CatalogMediaCacheEntry>();
let catalogMediaCacheHydrated = false;

function getCatalogMediaTtlMs(state: CatalogMediaCacheEntry["state"]): number {
  return state === "failed" ? catalogMediaFailedTtlMs : catalogMediaLoadedTtlMs;
}

function persistCatalogMediaCache(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const serialized = JSON.stringify(Object.fromEntries(catalogMediaCache.entries()));
    window.sessionStorage.setItem(catalogMediaCacheStorageKey, serialized);
  } catch {
    // Best effort only. Falling back to in-memory state is acceptable.
  }
}

function hydrateCatalogMediaCache(): void {
  if (catalogMediaCacheHydrated || typeof window === "undefined") {
    return;
  }

  catalogMediaCacheHydrated = true;

  try {
    const serialized = window.sessionStorage.getItem(catalogMediaCacheStorageKey);
    if (!serialized) {
      return;
    }

    const parsed = JSON.parse(serialized) as Record<string, CatalogMediaCacheEntry>;
    for (const [url, entry] of Object.entries(parsed)) {
      if (!url || !entry || (entry.state !== "loaded" && entry.state !== "failed") || typeof entry.updatedAt !== "number") {
        continue;
      }

      if (Date.now() - entry.updatedAt <= getCatalogMediaTtlMs(entry.state)) {
        catalogMediaCache.set(url, entry);
      }
    }
  } catch {
    // Ignore corrupted session cache and continue with an empty cache.
  }
}

function readCatalogMediaCacheEntry(url: string | null | undefined): CatalogMediaCacheEntry | null {
  if (!url) {
    return null;
  }

  hydrateCatalogMediaCache();
  const entry = catalogMediaCache.get(url);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.updatedAt > getCatalogMediaTtlMs(entry.state)) {
    catalogMediaCache.delete(url);
    persistCatalogMediaCache();
    return null;
  }

  return entry;
}

function writeCatalogMediaCacheEntry(url: string, state: CatalogMediaCacheEntry["state"]): void {
  hydrateCatalogMediaCache();
  catalogMediaCache.set(url, { state, updatedAt: Date.now() });

  while (catalogMediaCache.size > catalogMediaCacheLimit) {
    const oldestKey = catalogMediaCache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    catalogMediaCache.delete(oldestKey);
  }

  persistCatalogMediaCache();
}

export function useCatalogMediaLoadState(
  url: string | null | undefined,
  options?: {
    preload?: boolean;
  },
): CatalogMediaLoadState {
  const preload = options?.preload ?? true;
  const [state, setState] = useState<CatalogMediaLoadState>(() => {
    if (!url) {
      return "idle";
    }

    const cachedEntry = readCatalogMediaCacheEntry(url);
    return cachedEntry?.state ?? (preload ? "loading" : "idle");
  });

  useEffect(() => {
    if (!url) {
      setState("idle");
      return;
    }

    const cachedEntry = readCatalogMediaCacheEntry(url);
    if (cachedEntry) {
      setState(cachedEntry.state);
      return;
    }

    if (!preload || typeof Image === "undefined") {
      setState("idle");
      return;
    }

    let active = true;
    const probeImage = new Image();
    setState("loading");
    probeImage.decoding = "async";
    probeImage.onload = () => {
      if (!active) {
        return;
      }

      writeCatalogMediaCacheEntry(url, "loaded");
      setState("loaded");
    };
    probeImage.onerror = () => {
      if (!active) {
        return;
      }

      writeCatalogMediaCacheEntry(url, "failed");
      setState("failed");
    };
    probeImage.src = url;

    return () => {
      active = false;
      probeImage.onload = null;
      probeImage.onerror = null;
    };
  }, [preload, url]);

  return state;
}

export function rememberCatalogMediaLoadSuccess(url: string | null | undefined): void {
  if (!url) {
    return;
  }

  writeCatalogMediaCacheEntry(url, "loaded");
}

export function rememberCatalogMediaLoadFailure(url: string | null | undefined): void {
  if (!url) {
    return;
  }

  writeCatalogMediaCacheEntry(url, "failed");
}
