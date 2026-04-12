import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeHomeDiagnosticsSnapshot } from "./be-home-bridge";
import { useBeHomeTimedDiagnostics } from "./use-be-home-timed-diagnostics";

function getUnityBridgeMessages(unityCall: ReturnType<typeof vi.fn>) {
  return unityCall.mock.calls.map(([message]) => JSON.parse(message as string));
}

function DiagnosticsProbe({
  enabled,
  timelineKey,
  snapshot,
}: {
  enabled: boolean;
  timelineKey: string;
  snapshot: BeHomeDiagnosticsSnapshot | null;
}) {
  useBeHomeTimedDiagnostics({
    enabled,
    timelineKey,
    snapshot,
  });

  return null;
}

describe("useBeHomeTimedDiagnostics", () => {
  let visibilityState = "visible";

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
  });

  afterEach(() => {
    delete window.Unity;
    vi.useRealTimers();
    vi.restoreAllMocks();
    visibilityState = "visible";
  });

  it("publishes timed snapshots with runtime context through the Unity bridge", async () => {
    const unityCall = vi.fn();
    window.Unity = { call: unityCall };
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    render(
      <DiagnosticsProbe
        enabled
        timelineKey="title-detail|title-1"
        snapshot={{
          surface: "title-detail",
          route: "/browse/blue-harbor-games/lantern-drift?embed=board",
          titleId: "title-1",
          titleDisplayName: "Lantern Drift",
          heroImageLoadState: "loading",
          selectedPreviewImageLoadState: "loading",
        }}
      />,
    );

    expect(getUnityBridgeMessages(unityCall)[0]).toMatchObject({
      surface: "title-detail",
      route: "/browse/blue-harbor-games/lantern-drift?embed=board",
      diagnosticsReason: "surface-activated",
      documentVisibilityState: "visible",
      documentFocusState: "focused",
      networkState: "online",
      heroImageLoadState: "loading",
      selectedPreviewImageLoadState: "loading",
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(getUnityBridgeMessages(unityCall).at(-1)).toMatchObject({
      diagnosticsReason: "surface+1000ms",
      heroImageLoadState: "loading",
      selectedPreviewImageLoadState: "loading",
    });

    visibilityState = "hidden";
    fireEvent(document, new Event("visibilitychange"));

    expect(getUnityBridgeMessages(unityCall).at(-1)).toMatchObject({
      diagnosticsReason: "visibility:hidden",
      documentVisibilityState: "hidden",
    });
  });

  it("uses the latest snapshot state for delayed diagnostics without resetting the surface timer", async () => {
    const unityCall = vi.fn();
    window.Unity = { call: unityCall };
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    const { rerender } = render(
      <DiagnosticsProbe
        enabled
        timelineKey="quick-view|title-1"
        snapshot={{
          surface: "quick-view",
          route: "/browse?embed=board",
          titleId: "title-1",
          heroImageLoadState: "loading",
          selectedPreviewImageLoadState: "loading",
        }}
      />,
    );

    rerender(
      <DiagnosticsProbe
        enabled
        timelineKey="quick-view|title-1"
        snapshot={{
          surface: "quick-view",
          route: "/browse?embed=board",
          titleId: "title-1",
          heroImageLoadState: "loaded",
          selectedPreviewImageLoadState: "loaded",
        }}
      />,
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(getUnityBridgeMessages(unityCall).at(-1)).toMatchObject({
      diagnosticsReason: "surface+1000ms",
      heroImageLoadState: "loaded",
      selectedPreviewImageLoadState: "loaded",
    });

    expect((getUnityBridgeMessages(unityCall).at(-1) as { surfaceAgeMs?: number }).surfaceAgeMs).toBeGreaterThanOrEqual(1000);
  });
});
