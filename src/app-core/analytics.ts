import { useEffect, useRef } from "react";
import { appConfig } from "./shared";

const analyticsVisitorStorageKey = "be-analytics-visitor-id";
const analyticsSessionStorageKey = "be-analytics-session-id";
const analyticsPreviousPathStorageKey = "be-analytics-previous-path";

export type AnalyticsAuthState = "anonymous" | "authenticated";
export type AnalyticsEventName =
  | "page_view"
  | "oauth_started"
  | "oauth_completed"
  | "account_created"
  | "browse_filters_applied"
  | "title_quick_view_opened"
  | "title_detail_viewed"
  | "title_get_clicked";

/**
 * Canonical analytics event payload sent from the SPA to the internal Worker ingestion route.
 */
export interface AnalyticsEventRequest {
  event: AnalyticsEventName;
  path?: string | null;
  authState?: AnalyticsAuthState | null;
  provider?: "discord" | "github" | "google" | null;
  studioSlug?: string | null;
  titleSlug?: string | null;
  surface?: string | null;
  contentKind?: "game" | "app" | null;
  sessionId?: string | null;
  visitorId?: string | null;
  referrerPath?: string | null;
  metadata?: Record<string, unknown> | null;
  value1?: number | null;
  value2?: number | null;
}

function safeGetStorageValue(storage: Storage, key: string): string | null {
  try {
    const value = storage.getItem(key);
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

function safeSetStorageValue(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Keep analytics fire-and-forget; user flows should not depend on storage.
  }
}

function createAnonymousId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `be-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function getOrCreateVisitorId(): { id: string; created: boolean } {
  if (typeof window === "undefined") {
    return { id: "server-render", created: false };
  }

  const existing = safeGetStorageValue(window.localStorage, analyticsVisitorStorageKey);
  if (existing) {
    return { id: existing, created: false };
  }

  const next = createAnonymousId();
  safeSetStorageValue(window.localStorage, analyticsVisitorStorageKey, next);
  return { id: next, created: true };
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return "server-render";
  }

  const existing = safeGetStorageValue(window.sessionStorage, analyticsSessionStorageKey);
  if (existing) {
    return existing;
  }

  const next = createAnonymousId();
  safeSetStorageValue(window.sessionStorage, analyticsSessionStorageKey, next);
  return next;
}

function normalizePath(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  return trimmed;
}

function getDocumentReferrerPath(): string | null {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  const referrer = document.referrer?.trim();
  if (!referrer) {
    return null;
  }

  try {
    const currentOrigin = window.location.origin;
    const parsed = new URL(referrer);
    if (parsed.origin !== currentOrigin) {
      return null;
    }

    return normalizePath(`${parsed.pathname}${parsed.search}`) ?? normalizePath(parsed.pathname);
  } catch {
    return null;
  }
}

function getPreviousPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return safeGetStorageValue(window.sessionStorage, analyticsPreviousPathStorageKey) ?? getDocumentReferrerPath();
}

function setPreviousPath(path: string): void {
  if (typeof window === "undefined") {
    return;
  }

  safeSetStorageValue(window.sessionStorage, analyticsPreviousPathStorageKey, path);
}

async function postAnalyticsEvent(payload: AnalyticsEventRequest): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const url = `${appConfig.apiBaseUrl.replace(/\/$/, "")}/analytics/events`;
  try {
    await fetch(url, {
      method: "POST",
      keepalive: true,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Analytics must never block or surface errors in the product workflow.
  }
}

/**
 * Record a one-off product analytics event without blocking the user flow.
 */
export function trackAnalyticsEvent(event: Omit<AnalyticsEventRequest, "sessionId" | "visitorId">): void {
  const normalizedPath = normalizePath(event.path ?? (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : null));
  const visitor = getOrCreateVisitorId();

  void postAnalyticsEvent({
    ...event,
    path: normalizedPath,
    sessionId: getOrCreateSessionId(),
    visitorId: visitor.id,
  });
}

/**
 * Track route-level page views while preserving anonymous visitor/session continuity across the SPA.
 */
export function usePageAnalytics(path: string, authState: AnalyticsAuthState): void {
  const trackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath || trackedPathRef.current === normalizedPath) {
      return;
    }

    trackedPathRef.current = normalizedPath;
    const visitor = getOrCreateVisitorId();
    const previousPath = getPreviousPath();
    setPreviousPath(normalizedPath);

    void postAnalyticsEvent({
      event: "page_view",
      path: normalizedPath,
      authState,
      sessionId: getOrCreateSessionId(),
      visitorId: visitor.id,
      referrerPath: previousPath,
      metadata: {
        isNewVisitor: visitor.created,
      },
    });
  }, [authState, path]);
}
