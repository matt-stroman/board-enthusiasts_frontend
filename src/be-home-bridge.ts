import type { PlatformRole } from "@board-enthusiasts/migration-contract";

/**
 * The message type used when the hosted site publishes auth state to the BE Home Unity shell.
 */
export const BE_HOME_AUTH_STATE_MESSAGE_TYPE = "be-home-auth-state";

/**
 * Lightweight auth state snapshot mirrored from the hosted site into the BE Home shell.
 */
export interface BeHomeAuthStateSnapshot {
  authenticated: boolean;
  roles: PlatformRole[];
  displayName: string | null;
}

interface BeHomeBridgeMessage extends BeHomeAuthStateSnapshot {
  type: typeof BE_HOME_AUTH_STATE_MESSAGE_TYPE;
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
    // Keep hosted auth resilient even if the embedding shell bridge is unavailable or rejects the message.
  }
}
