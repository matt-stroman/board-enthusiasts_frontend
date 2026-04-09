import { beforeEach, describe, expect, it, vi } from "vitest";
import { BE_HOME_AUTH_STATE_MESSAGE_TYPE, publishBeHomeAuthState } from "./be-home-bridge";

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
});
