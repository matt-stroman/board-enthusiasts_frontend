import { useEffect, useRef } from "react";
import { publishBeHomeDiagnostics, type BeHomeDiagnosticsSnapshot } from "./be-home-bridge";

const beHomeDiagnosticsTimelineDelaysMs = [1000, 3000, 5000] as const;

function getNowMs(): number {
  return Date.now();
}

function readDocumentVisibilityState(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  return document.visibilityState ?? null;
}

function readDocumentFocusState(): string | null {
  if (typeof document === "undefined" || typeof document.hasFocus !== "function") {
    return null;
  }

  return document.hasFocus() ? "focused" : "blurred";
}

function readNetworkState(): string | null {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return null;
  }

  return navigator.onLine ? "online" : "offline";
}

type UseBeHomeTimedDiagnosticsOptions = {
  enabled: boolean;
  timelineKey: string;
  snapshot: BeHomeDiagnosticsSnapshot | null;
};

/**
 * Publishes a small time-series of hosted diagnostics so BE Home can correlate delayed WebView crashes with page state.
 */
export function useBeHomeTimedDiagnostics({ enabled, timelineKey, snapshot }: UseBeHomeTimedDiagnosticsOptions): void {
  const latestSnapshotRef = useRef<BeHomeDiagnosticsSnapshot | null>(snapshot);

  useEffect(() => {
    latestSnapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const initialSnapshot = latestSnapshotRef.current;
    if (!enabled || !timelineKey.trim() || !initialSnapshot || !initialSnapshot.route.trim() || !initialSnapshot.surface.trim()) {
      return;
    }

    const startedAtMs = getNowMs();
    const publishSnapshot = (diagnosticsReason: string): void => {
      const currentSnapshot = latestSnapshotRef.current;
      if (!currentSnapshot) {
        return;
      }

      publishBeHomeDiagnostics({
        ...currentSnapshot,
        diagnosticsReason,
        surfaceAgeMs: Math.max(0, getNowMs() - startedAtMs),
        documentVisibilityState: readDocumentVisibilityState(),
        documentFocusState: readDocumentFocusState(),
        networkState: readNetworkState(),
      });
    };

    publishSnapshot("surface-activated");

    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const timeoutIds = beHomeDiagnosticsTimelineDelaysMs.map((delayMs) =>
      window.setTimeout(() => {
        publishSnapshot(`surface+${delayMs}ms`);
      }, delayMs),
    );

    const handleVisibilityChange = (): void => {
      publishSnapshot(`visibility:${document.visibilityState}`);
    };

    const handleWindowFocus = (): void => {
      publishSnapshot("window-focus");
    };

    const handleWindowBlur = (): void => {
      publishSnapshot("window-blur");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [enabled, timelineKey]);
}
