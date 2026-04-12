import type { PlatformRole } from "@board-enthusiasts/migration-contract";

/**
 * The message type used when the hosted site publishes auth state to the BE Home Unity shell.
 */
export const BE_HOME_AUTH_STATE_MESSAGE_TYPE = "be-home-auth-state";
export const BE_HOME_OPEN_EXTERNAL_URL_MESSAGE_TYPE = "be-home-open-external-url";
export const BE_HOME_ROUTE_STATE_MESSAGE_TYPE = "be-home-route-state";
export const BE_HOME_DIAGNOSTICS_MESSAGE_TYPE = "be-home-diagnostics";

/**
 * Lightweight auth state snapshot mirrored from the hosted site into the BE Home shell.
 */
export interface BeHomeAuthStateSnapshot {
  authenticated: boolean;
  roles: PlatformRole[];
  displayName: string | null;
}

export interface BeHomeDiagnosticsSnapshot {
  surface: string;
  route: string;
  titleId?: string | null;
  studioId?: string | null;
  studioSlug?: string | null;
  titleSlug?: string | null;
  titleDisplayName?: string | null;
  studioDisplayName?: string | null;
  contentKind?: string | null;
  selectedPreviewKind?: string | null;
  selectedPreviewHost?: string | null;
  heroImageHost?: string | null;
  cardImageHost?: string | null;
  acquisitionHost?: string | null;
  showcaseMediaCount?: number;
  showcaseImageCount?: number;
  showcaseVideoCount?: number;
  searchResultCount?: number;
  totalCatalogCount?: number;
  currentPage?: number;
  searchQueryLength?: number;
  selectedStudiosCount?: number;
  selectedGenresCount?: number;
  hasHeroImage?: boolean;
  hasCardImage?: boolean;
  hasLogoImage?: boolean;
  hasAcquisitionUrl?: boolean;
}

interface BeHomeBridgeMessage extends BeHomeAuthStateSnapshot {
  type: typeof BE_HOME_AUTH_STATE_MESSAGE_TYPE;
}

interface BeHomeOpenExternalUrlMessage {
  type: typeof BE_HOME_OPEN_EXTERNAL_URL_MESSAGE_TYPE;
  url: string;
}

interface BeHomeRouteStateMessage {
  type: typeof BE_HOME_ROUTE_STATE_MESSAGE_TYPE;
  path: string;
}

interface BeHomeDiagnosticsMessage extends BeHomeDiagnosticsSnapshot {
  type: typeof BE_HOME_DIAGNOSTICS_MESSAGE_TYPE;
}

declare global {
  interface Window {
    Unity?: {
      call?: (message: string) => void;
    };
    webkit?: {
      messageHandlers?: {
        unityControl?: {
          postMessage?: (message: string) => void;
        };
      };
    };
  }
}

/**
 * Publish the current hosted auth snapshot to the BE Home Unity shell when the page is embedded in WebView.
 *
 * The Unity shell treats this as advisory UI state only; it is not an authorization boundary.
 */
export function publishBeHomeAuthState(snapshot: BeHomeAuthStateSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: BeHomeBridgeMessage = {
    type: BE_HOME_AUTH_STATE_MESSAGE_TYPE,
    authenticated: snapshot.authenticated,
    roles: snapshot.roles,
    displayName: snapshot.displayName,
  };
  postBeHomeBridgeMessage(payload);
}

export function hasBeHomeBridge(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return typeof window.Unity?.call === "function"
    || typeof window.webkit?.messageHandlers?.unityControl?.postMessage === "function";
}

export function openBeHomeExternalUrl(url: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: BeHomeOpenExternalUrlMessage = {
    type: BE_HOME_OPEN_EXTERNAL_URL_MESSAGE_TYPE,
    url,
  };
  postBeHomeBridgeMessage(payload);
}

export function publishBeHomeRouteState(path: string): void {
  if (typeof window === "undefined" || !path.trim()) {
    return;
  }

  const payload: BeHomeRouteStateMessage = {
    type: BE_HOME_ROUTE_STATE_MESSAGE_TYPE,
    path,
  };
  postBeHomeBridgeMessage(payload);
}

export function publishBeHomeDiagnostics(snapshot: BeHomeDiagnosticsSnapshot): void {
  if (typeof window === "undefined" || !snapshot.route.trim() || !snapshot.surface.trim()) {
    return;
  }

  const payload: BeHomeDiagnosticsMessage = {
    type: BE_HOME_DIAGNOSTICS_MESSAGE_TYPE,
    ...snapshot,
  };
  postBeHomeBridgeMessage(payload);
}

function postBeHomeBridgeMessage(payload: BeHomeBridgeMessage | BeHomeOpenExternalUrlMessage | BeHomeRouteStateMessage | BeHomeDiagnosticsMessage): void {
  const message = JSON.stringify(payload);

  try {
    if (typeof window.Unity?.call === "function") {
      window.Unity.call(message);
      return;
    }

    if (typeof window.webkit?.messageHandlers?.unityControl?.postMessage === "function") {
      window.webkit.messageHandlers.unityControl.postMessage(message);
    }
  } catch {
    // Keep the hosted surface resilient even if the embedding shell bridge rejects the request.
  }
}
