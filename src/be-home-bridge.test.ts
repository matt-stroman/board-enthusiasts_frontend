import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BE_HOME_AUTH_STATE_MESSAGE_TYPE,
  BE_HOME_DIAGNOSTICS_MESSAGE_TYPE,
  BE_HOME_OPEN_EXTERNAL_URL_MESSAGE_TYPE,
  BE_HOME_ROUTE_STATE_MESSAGE_TYPE,
  BE_HOME_TITLE_DETAIL_VIEW_MESSAGE_TYPE,
  hasBeHomeBridge,
  openBeHomeExternalUrl,
  publishBeHomeAuthState,
  publishBeHomeDiagnostics,
  publishBeHomeTitleDetailView,
  publishBeHomeRouteState,
} from "./be-home-bridge";

describe("BE Home bridge", () => {
  beforeEach(() => {
    delete window.Unity;
    delete window.webkit;
  });

  it("publishes auth state through the injected Unity bridge when available", () => {
    const unityCall = vi.fn();
    window.Unity = { call: unityCall };

    publishBeHomeAuthState({
      authenticated: true,
      roles: ["developer"],
      displayName: "Emma Torres",
    });

    expect(unityCall).toHaveBeenCalledOnce();
    expect(JSON.parse(unityCall.mock.calls[0][0] as string)).toEqual({
      type: BE_HOME_AUTH_STATE_MESSAGE_TYPE,
      authenticated: true,
      roles: ["developer"],
      displayName: "Emma Torres",
    });
  });

  it("falls back to the native webkit message handler when the Unity shim is unavailable", () => {
    const postMessage = vi.fn();
    window.webkit = {
      messageHandlers: {
        unityControl: {
          postMessage,
        },
      },
    };

    publishBeHomeAuthState({
      authenticated: false,
      roles: [],
      displayName: null,
    });

    expect(postMessage).toHaveBeenCalledOnce();
    expect(JSON.parse(postMessage.mock.calls[0][0] as string)).toEqual({
      type: BE_HOME_AUTH_STATE_MESSAGE_TYPE,
      authenticated: false,
      roles: [],
      displayName: null,
    });
  });

  it("reports whether the BE Home bridge is available", () => {
    expect(hasBeHomeBridge()).toBe(false);
    window.Unity = { call: vi.fn() };
    expect(hasBeHomeBridge()).toBe(true);
  });

  it("publishes external URL requests through the Unity bridge", () => {
    const unityCall = vi.fn();
    window.Unity = { call: unityCall };

    openBeHomeExternalUrl("https://www.youtube.com/watch?v=demo");

    expect(unityCall).toHaveBeenCalledOnce();
    expect(JSON.parse(unityCall.mock.calls[0][0] as string)).toEqual({
      type: BE_HOME_OPEN_EXTERNAL_URL_MESSAGE_TYPE,
      url: "https://www.youtube.com/watch?v=demo",
    });
  });

  it("publishes route state through the Unity bridge", () => {
    const unityCall = vi.fn();
    window.Unity = { call: unityCall };

    publishBeHomeRouteState("/browse/blue-harbor-games/lantern-drift?embed=board");

    expect(unityCall).toHaveBeenCalledOnce();
    expect(JSON.parse(unityCall.mock.calls[0][0] as string)).toEqual({
      type: BE_HOME_ROUTE_STATE_MESSAGE_TYPE,
      path: "/browse/blue-harbor-games/lantern-drift?embed=board",
    });
  });

  it("publishes diagnostics through the Unity bridge", () => {
    const unityCall = vi.fn();
    window.Unity = { call: unityCall };

    publishBeHomeDiagnostics({
      surface: "title-detail",
      route: "/browse/blue-harbor-games/lantern-drift?embed=board",
      diagnosticsReason: "surface+1000ms",
      surfaceAgeMs: 1000,
      documentVisibilityState: "visible",
      documentFocusState: "focused",
      networkState: "online",
      titleId: "title-1",
      titleDisplayName: "Lantern Drift",
      heroImageLoadState: "loaded",
      selectedPreviewImageLoadState: "loading",
      showcaseMediaCount: 5,
      showcaseImageCount: 4,
      showcaseVideoCount: 1,
      hasHeroImage: true,
      hasAcquisitionUrl: true,
    });

    expect(unityCall).toHaveBeenCalledOnce();
    expect(JSON.parse(unityCall.mock.calls[0][0] as string)).toEqual({
      type: BE_HOME_DIAGNOSTICS_MESSAGE_TYPE,
      surface: "title-detail",
      route: "/browse/blue-harbor-games/lantern-drift?embed=board",
      diagnosticsReason: "surface+1000ms",
      surfaceAgeMs: 1000,
      documentVisibilityState: "visible",
      documentFocusState: "focused",
      networkState: "online",
      titleId: "title-1",
      titleDisplayName: "Lantern Drift",
      heroImageLoadState: "loaded",
      selectedPreviewImageLoadState: "loading",
      showcaseMediaCount: 5,
      showcaseImageCount: 4,
      showcaseVideoCount: 1,
      hasHeroImage: true,
      hasAcquisitionUrl: true,
    });
  });

  it("publishes title detail view events through the Unity bridge", () => {
    const unityCall = vi.fn();
    window.Unity = { call: unityCall };

    publishBeHomeTitleDetailView({
      titleId: "title-1",
      studioSlug: "blue-harbor-games",
      titleSlug: "lantern-drift",
      route: "/browse/blue-harbor-games/lantern-drift?embed=board",
    });

    expect(unityCall).toHaveBeenCalledOnce();
    expect(JSON.parse(unityCall.mock.calls[0][0] as string)).toEqual({
      type: BE_HOME_TITLE_DETAIL_VIEW_MESSAGE_TYPE,
      titleId: "title-1",
      studioSlug: "blue-harbor-games",
      titleSlug: "lantern-drift",
      route: "/browse/blue-harbor-games/lantern-drift?embed=board",
      surface: "title-detail",
    });
  });
});
