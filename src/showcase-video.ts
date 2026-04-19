export type EmbeddedVideoPreview =
  | {
      kind: "direct";
      src: string;
      autoplay: boolean;
    }
  | {
      kind: "iframe";
      src: string;
      autoplay: boolean;
    };

type ShowcasePreviewSource = {
  kind?: string | null;
  previewUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
};

const directVideoPathPattern = /\.(mp4|webm|ogg|mov|m4v)$/i;

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function tryParseAbsoluteUrl(value: string | null | undefined): URL | null {
  const normalized = normalizeOptionalUrl(value);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized);
  } catch {
    return null;
  }
}

function getYouTubeVideoId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  const normalizedHost = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  const segments = url.pathname.split("/").filter(Boolean);

  if (normalizedHost === "youtu.be") {
    return segments[0] ?? null;
  }

  if (!normalizedHost.endsWith("youtube.com")) {
    return null;
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }

  if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live" || segments[0] === "v") {
    return segments[1] ?? null;
  }

  return null;
}

function buildYouTubeEmbedUrl(url: URL): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : null;
}

function buildVimeoEmbedUrl(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  const normalizedHost = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  const segments = url.pathname.split("/").filter(Boolean);

  if (normalizedHost === "player.vimeo.com" && segments[0] === "video" && segments[1]) {
    return `https://player.vimeo.com/video/${encodeURIComponent(segments[1])}`;
  }

  if (!normalizedHost.endsWith("vimeo.com")) {
    return null;
  }

  const videoId = [...segments].reverse().find((segment) => /^\d+$/.test(segment));
  return videoId ? `https://player.vimeo.com/video/${encodeURIComponent(videoId)}` : null;
}

function buildLoomEmbedUrl(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  const normalizedHost = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  const segments = url.pathname.split("/").filter(Boolean);

  if (!normalizedHost.endsWith("loom.com")) {
    return null;
  }

  if ((segments[0] === "share" || segments[0] === "embed") && segments[1]) {
    return `https://www.loom.com/embed/${encodeURIComponent(segments[1])}`;
  }

  return null;
}

function appendAutoplayQueryParam(value: string, autoplay: boolean): string {
  if (!autoplay) {
    return value;
  }

  const url = new URL(value);
  url.searchParams.set("autoplay", "1");
  return url.toString();
}

export function inferExternalVideoThumbnailUrl(value: string | null | undefined): string | null {
  const url = tryParseAbsoluteUrl(value);
  if (!url) {
    return null;
  }

  const youTubeVideoId = getYouTubeVideoId(url);
  return youTubeVideoId ? `https://i.ytimg.com/vi/${encodeURIComponent(youTubeVideoId)}/hqdefault.jpg` : null;
}

export function getShowcasePreviewImageUrl(source: ShowcasePreviewSource | null | undefined): string | null {
  const previewUrl = normalizeOptionalUrl(source?.previewUrl);
  if (previewUrl) {
    return previewUrl;
  }

  const imageUrl = normalizeOptionalUrl(source?.imageUrl);
  if (imageUrl) {
    return imageUrl;
  }

  return source?.kind === "external_video" ? inferExternalVideoThumbnailUrl(source.videoUrl) : null;
}

export function resolveEmbeddedVideoPreview(
  value: string | null | undefined,
  options?: {
    autoplay?: boolean;
  },
): EmbeddedVideoPreview | null {
  const url = tryParseAbsoluteUrl(value);
  if (!url) {
    return null;
  }

  const autoplay = options?.autoplay === true;

  if (directVideoPathPattern.test(url.pathname)) {
    return { kind: "direct", src: url.toString(), autoplay };
  }

  const iframeSource = buildYouTubeEmbedUrl(url) ?? buildVimeoEmbedUrl(url) ?? buildLoomEmbedUrl(url);
  return iframeSource ? { kind: "iframe", src: appendAutoplayQueryParam(iframeSource, autoplay), autoplay } : null;
}
