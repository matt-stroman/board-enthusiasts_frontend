import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { SocialAuthProvider } from "../auth";
import constructionGlyph from "../assets/landing-glyphs/construction.svg?raw";
import viewCarouselGlyph from "../assets/landing-glyphs/view-carousel.svg?raw";
import { appConfig, landingDiscordUrl, landingSignupRoute, type ConnectedAccountIdentity } from "./shared";

export function LandingUpdatesLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const location = useLocation();
  const href = location.pathname === "/" ? "#signup" : landingSignupRoute;

  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

export function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.369A19.79 19.79 0 0 0 15.438 3c-.211.375-.458.88-.628 1.274a18.27 18.27 0 0 0-5.62 0A13.74 13.74 0 0 0 8.56 3 19.736 19.736 0 0 0 3.68 4.37C.59 9.04-.246 13.595.172 18.084A19.9 19.9 0 0 0 6.16 21c.484-.665.915-1.37 1.287-2.11a12.85 12.85 0 0 1-2.024-.977c.17-.126.336-.257.497-.392 3.905 1.836 8.14 1.836 11.998 0 .166.135.332.266.497.392a12.9 12.9 0 0 1-2.03.98c.372.739.803 1.444 1.287 2.109a19.86 19.86 0 0 0 5.99-2.916c.49-5.2-.837-9.714-3.346-13.715ZM8.02 15.332c-1.18 0-2.15-1.085-2.15-2.42 0-1.335.951-2.42 2.15-2.42 1.208 0 2.17 1.094 2.15 2.42 0 1.335-.951 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.085-2.15-2.42 0-1.335.951-2.42 2.15-2.42 1.208 0 2.17 1.094 2.15 2.42 0 1.335-.942 2.42-2.15 2.42Z" />
    </svg>
  );
}

export function DiscordIconButton({ className = "app-icon-button" }: { className?: string }) {
  return (
    <a className={className} href={landingDiscordUrl} target="_blank" rel="noreferrer" aria-label="Join the Board Enthusiasts Discord">
      <DiscordIcon className="size-5" />
    </a>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21.6 12.23c0-.68-.06-1.33-.18-1.95H12v3.68h5.39a4.62 4.62 0 0 1-2 3.03v2.52h3.23c1.89-1.74 2.98-4.31 2.98-7.28Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.89 6.62-2.41l-3.23-2.52c-.89.6-2.03.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.06v2.6A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.39 13.9A5.99 5.99 0 0 1 6.08 12c0-.66.11-1.31.31-1.9V7.5H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.5l3.33-2.6Z"
        fill="#FBBC04"
      />
      <path
        d="M12 5.97c1.47 0 2.79.5 3.83 1.48l2.87-2.87C16.96 2.96 14.7 2 12 2A10 10 0 0 0 3.06 7.5l3.33 2.6C7.18 7.73 9.39 5.97 12 5.97Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A12 12 0 0 0 8.2 23.9c.6.1.82-.26.82-.58v-2.03c-3.34.73-4.04-1.41-4.04-1.41-.55-1.4-1.34-1.78-1.34-1.78-1.1-.75.08-.74.08-.74 1.2.09 1.84 1.24 1.84 1.24 1.08 1.84 2.83 1.31 3.52 1 .1-.78.42-1.31.76-1.61-2.67-.31-5.47-1.34-5.47-5.94 0-1.31.47-2.39 1.24-3.23-.12-.31-.54-1.56.12-3.25 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.69.24 2.94.12 3.25.77.84 1.24 1.92 1.24 3.23 0 4.61-2.81 5.62-5.49 5.92.43.38.82 1.11.82 2.24v3.32c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

export function getSocialAuthProviderLabel(provider: SocialAuthProvider): string {
  switch (provider) {
    case "discord":
      return "Discord";
    case "github":
      return "GitHub";
    default:
      return "Google";
  }
}

export function isSocialAuthProvider(value: string): value is SocialAuthProvider {
  return value === "discord" || value === "github" || value === "google";
}

export function getConnectedAccountSummary(identity: ConnectedAccountIdentity): string {
  const identityData = identity.identity_data;
  if (!identityData || typeof identityData !== "object") {
    return "Connected sign-in option";
  }

  const preferredValue = [
    identityData.email,
    identityData.full_name,
    identityData.name,
    identityData.user_name,
    identityData.preferred_username,
    identityData.username,
  ].find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);

  return typeof preferredValue === "string" ? preferredValue.trim() : "Connected sign-in option";
}

export function SocialAuthProviderIcon({ provider }: { provider: SocialAuthProvider }) {
  switch (provider) {
    case "discord":
      return <DiscordIcon className="h-5 w-5 text-[#5865F2]" />;
    case "github":
      return <GitHubIcon className="h-5 w-5 text-slate-100" />;
    default:
      return <GoogleIcon className="h-5 w-5" />;
  }
}

export function UnderlineActionLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="font-semibold text-cyan-100 underline decoration-cyan-100/35 underline-offset-4 transition hover:text-white hover:decoration-white/60"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function InlineSvgGlyph({ markup }: { markup: string }) {
  return <span className="landing-inline-glyph" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function LandingGlyph({ kind }: { kind: "discord" | "library" | "spark" | "toolkit" }) {
  if (kind === "discord") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M18.2 6.9a14.2 14.2 0 0 0-3.6-1.1l-.2.4-.3.8a13.4 13.4 0 0 0-4.2 0 13.4 13.4 0 0 0-.5-1.2A14.1 14.1 0 0 0 5.8 6.9c-2.2 3.3-2.8 6.5-2.5 9.6a14.3 14.3 0 0 0 4.4 2.2l.9-1.4a9.2 9.2 0 0 1-1.5-.7l.4-.3a10.4 10.4 0 0 0 9 0l.4.3c-.5.3-1 .5-1.5.7l.9 1.4a14.2 14.2 0 0 0 4.4-2.2c.4-3.6-.7-6.8-2.5-9.6ZM9.5 14.3c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8c.9 0 1.6.8 1.6 1.8 0 1-.7 1.8-1.6 1.8Zm5 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8c.9 0 1.6.8 1.6 1.8 0 1-.7 1.8-1.6 1.8Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (kind === "library") {
    return <InlineSvgGlyph markup={viewCarouselGlyph} />;
  }

  if (kind === "spark") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" fill="currentColor" />
        <path d="m18.5 13 1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1 1-2.8Z" fill="currentColor" />
        <path d="m5.5 13 1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1 1-2.8Z" fill="currentColor" />
      </svg>
    );
  }

  return <InlineSvgGlyph markup={constructionGlyph} />;
}

export function getMfaQrCodeImageSource(qrCode: string): string {
  const normalized = qrCode.trim();
  if (!normalized) {
    return "";
  }

  if (
    normalized.startsWith("data:image/") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://")
  ) {
    return normalized;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(normalized)}`;
}

export function buildLandingSupportIssuePayload(firstName: string, email: string, errorMessage: string) {
  const globalNavigator = typeof navigator === "undefined" ? null : navigator;
  const globalScreen = typeof window !== "undefined" ? window.screen : null;

  return {
    category: "email_signup" as const,
    firstName: firstName.trim() || null,
    email: email.trim() || null,
    pageUrl: window.location.href,
    apiBaseUrl: appConfig.apiBaseUrl,
    occurredAt: new Date().toISOString(),
    errorMessage,
    technicalDetails: null,
    userAgent: globalNavigator?.userAgent || null,
    language: globalNavigator?.language || null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    viewportWidth: typeof window.innerWidth === "number" ? window.innerWidth : null,
    viewportHeight: typeof window.innerHeight === "number" ? window.innerHeight : null,
    screenWidth: typeof globalScreen?.width === "number" ? globalScreen.width : null,
    screenHeight: typeof globalScreen?.height === "number" ? globalScreen.height : null,
  };
}

export function useDocumentMetadata({
  title,
  description,
  canonicalUrl,
}: {
  title: string;
  description: string;
  canonicalUrl: string;
}) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionElement = document.querySelector('meta[name="description"]');
    const ogTitleElement = document.querySelector('meta[property="og:title"]');
    const ogDescriptionElement = document.querySelector('meta[property="og:description"]');
    const ogUrlElement = document.querySelector('meta[property="og:url"]');
    const twitterTitleElement = document.querySelector('meta[name="twitter:title"]');
    const twitterDescriptionElement = document.querySelector('meta[name="twitter:description"]');
    const canonicalElement = document.querySelector('link[rel="canonical"]');

    const previousDescription = descriptionElement?.getAttribute("content");
    const previousOgTitle = ogTitleElement?.getAttribute("content");
    const previousOgDescription = ogDescriptionElement?.getAttribute("content");
    const previousOgUrl = ogUrlElement?.getAttribute("content");
    const previousTwitterTitle = twitterTitleElement?.getAttribute("content");
    const previousTwitterDescription = twitterDescriptionElement?.getAttribute("content");
    const previousCanonicalUrl = canonicalElement?.getAttribute("href");

    document.title = title;
    descriptionElement?.setAttribute("content", description);
    ogTitleElement?.setAttribute("content", title);
    ogDescriptionElement?.setAttribute("content", description);
    ogUrlElement?.setAttribute("content", canonicalUrl);
    twitterTitleElement?.setAttribute("content", title);
    twitterDescriptionElement?.setAttribute("content", description);
    canonicalElement?.setAttribute("href", canonicalUrl);

    return () => {
      document.title = previousTitle;
      if (previousDescription) {
        descriptionElement?.setAttribute("content", previousDescription);
      }
      if (previousOgTitle) {
        ogTitleElement?.setAttribute("content", previousOgTitle);
      }
      if (previousOgDescription) {
        ogDescriptionElement?.setAttribute("content", previousOgDescription);
      }
      if (previousOgUrl) {
        ogUrlElement?.setAttribute("content", previousOgUrl);
      }
      if (previousTwitterTitle) {
        twitterTitleElement?.setAttribute("content", previousTwitterTitle);
      }
      if (previousTwitterDescription) {
        twitterDescriptionElement?.setAttribute("content", previousTwitterDescription);
      }
      if (previousCanonicalUrl) {
        canonicalElement?.setAttribute("href", previousCanonicalUrl);
      }
    };
  }, [canonicalUrl, description, title]);
}
