import { useEffect, useMemo, useState } from "react";
import type { CaptchaMode } from "./shared";

export type TurnstileWidgetStatus = "loading" | "ready" | "error";

type TurnstileApi = {
  render: (selector: string | HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function TurnstileWidget({
  siteKey,
  onTokenChange,
  onStatusChange,
}: {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
  onStatusChange?: (status: TurnstileWidgetStatus) => void;
}) {
  const containerId = useMemo(() => `turnstile-${Math.random().toString(36).slice(2)}`, []);
  const [status, setStatus] = useState<TurnstileWidgetStatus>("loading");

  useEffect(() => {
    onTokenChange(null);
    setStatus("loading");
    onStatusChange?.("loading");

    let widgetId: string | null = null;
    let cancelled = false;
    const scriptSelector = 'script[data-turnstile-script="true"]';
    let renderTimeout: ReturnType<typeof setTimeout> | null = null;

    const updateStatus = (value: TurnstileWidgetStatus) => {
      if (cancelled) {
        return;
      }

      setStatus(value);
      onStatusChange?.(value);
    };

    const renderWidget = () => {
      if (cancelled || !window.turnstile) {
        return;
      }

      const container = document.getElementById(containerId);
      if (!container) {
        return;
      }

      container.innerHTML = "";
      try {
        widgetId = window.turnstile.render(container, {
          sitekey: siteKey,
          theme: "dark",
          callback: (token: string) => {
            if (!cancelled) {
              onTokenChange(token);
              updateStatus("ready");
            }
          },
          "expired-callback": () => {
            if (!cancelled) {
              onTokenChange(null);
            }
          },
          "error-callback": () => {
            if (!cancelled) {
              onTokenChange(null);
              updateStatus("error");
            }
          },
        });
        updateStatus("ready");
      } catch {
        onTokenChange(null);
        updateStatus("error");
      }
    };

    if (window.turnstile) {
      renderWidget();
      return () => {
        cancelled = true;
        onTokenChange(null);
        if (widgetId && window.turnstile?.remove) {
          window.turnstile.remove(widgetId);
        }
      };
    }

    let script = document.querySelector<HTMLScriptElement>(scriptSelector);
    const handleLoad = () => renderWidget();
    if (!script) {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.setAttribute("data-turnstile-script", "true");
      script.addEventListener("load", handleLoad);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", handleLoad);
    }

    renderTimeout = setTimeout(() => {
      if (!window.turnstile) {
        onTokenChange(null);
        updateStatus("error");
      }
    }, 8000);

    return () => {
      cancelled = true;
      onTokenChange(null);
      if (renderTimeout) {
        clearTimeout(renderTimeout);
      }
      script?.removeEventListener("load", handleLoad);
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [containerId, onStatusChange, onTokenChange, siteKey]);

  return (
    <>
      <div id={containerId} className="landing-turnstile-container" />
      {status === "error" ? (
        <p className="error-text">The anti-spam check did not load. Refresh the page or disable content blockers and try again.</p>
      ) : null}
    </>
  );
}

function LocalTurnstileSimulator({
  token,
  onTokenChange,
  onStatusChange,
}: {
  token: string | null;
  onTokenChange: (token: string | null) => void;
  onStatusChange?: (status: TurnstileWidgetStatus) => void;
}) {
  useEffect(() => {
    onStatusChange?.("ready");
  }, [onStatusChange]);

  return (
    <label className="landing-consent landing-turnstile-simulator">
      <input
        type="checkbox"
        checked={Boolean(token)}
        onChange={(event) => onTokenChange(event.currentTarget.checked ? "local-development-turnstile-token" : null)}
      />
      <span>Local anti-spam check (development only). Check this box to simulate the Cloudflare verification passing.</span>
    </label>
  );
}

export function CaptchaWidget({
  mode,
  siteKey,
  token,
  onTokenChange,
  onStatusChange,
}: {
  mode: CaptchaMode;
  siteKey: string | null;
  token: string | null;
  onTokenChange: (token: string | null) => void;
  onStatusChange?: (status: TurnstileWidgetStatus) => void;
}) {
  if (mode === "disabled") {
    return null;
  }

  if (mode === "simulated-local") {
    return <LocalTurnstileSimulator token={token} onTokenChange={onTokenChange} onStatusChange={onStatusChange} />;
  }

  return <TurnstileWidget siteKey={siteKey ?? ""} onTokenChange={onTokenChange} onStatusChange={onStatusChange} />;
}
