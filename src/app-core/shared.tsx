import type {
  CatalogTitleResponse,
  CatalogTitleSummary,
  CurrentUserResponse,
  DeveloperTitle,
  TitleMediaAsset,
  UserProfile,
} from "@board-enthusiasts/migration-contract";
import { migrationMediaUploadPolicies } from "@board-enthusiasts/migration-contract";
import type { ChangeEvent } from "react";
import { ApiError } from "../api";
import { readAppConfig, type AppConfig } from "../config";
import { buildAcceptedMimeTypeError, normalizeImageUpload } from "../media-upload";

export const appConfig = new Proxy({} as AppConfig, {
  get(_target, property) {
    return readAppConfig()[property as keyof AppConfig];
  },
});
export const landingConsentTextVersion = "landing-page-v1";
export const landingSignupSource = "landing_page";
export const landingPrivacyRoute = "/privacy";
export const landingSignupRoute = "/#signup";
export const landingDiscordUrl = "https://discord.gg/cz2zReWqcA";
export const landingGptUrl = "https://chatgpt.com/g/g-69b033db223c81919edf748c33b08b3f-board-enthusiast";
export const landingBoardUrl = "https://board.fun/";
export const landingSupportMailtoHref = "mailto:support@boardenthusiasts.com?subject=%5BBug%20Report%5D%20Email%20signup%20issue";
export const landingMetadata = {
  defaultTitle: "Board Enthusiasts | Community Hub for Board Players and Builders",
  defaultDescription:
    "Board Enthusiasts is the unofficial community hub for Board players and builders. Follow Board games and apps, discover BE resources, join the Discord, and get updates on the upcoming third-party library.",
  defaultCanonical: "https://boardenthusiasts.com/",
  privacyTitle: "Board Enthusiasts Privacy Snapshot | Board Players and Builders",
  privacyDescription:
    "Read the Board Enthusiasts privacy snapshot covering launch-list signup data, direct contact requests, and the hosted services used to support the Board community site.",
  privacyCanonical: "https://boardenthusiasts.com/privacy",
} as const;
export const liveMetadata = {
  homeTitle: "Board Enthusiasts | For Board Players and Builders",
  homeDescription:
    "BE is where the Board community shows up first. Browse the live BE Library, plug into Discord, discover current tools, and follow what launches next.",
  homeCanonical: "https://boardenthusiasts.com/",
  privacyTitle: "BE Privacy Snapshot | For Board Players and Builders",
  privacyDescription:
    "Read the BE privacy snapshot covering account registration, library activity, developer submissions, direct contact requests, and the hosted services that power the live Board Enthusiasts experience.",
  privacyCanonical: "https://boardenthusiasts.com/privacy",
} as const;
export const supportedPublisherOptions = [
  { id: "", label: "Custom publisher", homepageUrl: "" },
  { id: "11111111-1111-1111-1111-111111111111", label: "itch.io", homepageUrl: "https://itch.io" },
  { id: "22222222-2222-2222-2222-222222222222", label: "Humble", homepageUrl: "https://www.humblebundle.com" },
] as const;

export type CaptchaMode = "disabled" | "turnstile" | "simulated-local";

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

export function getCaptchaMode(siteKey: string | null): CaptchaMode {
  if (siteKey) {
    return "turnstile";
  }

  if (typeof window !== "undefined" && isLoopbackHostname(window.location.hostname)) {
    return "simulated-local";
  }

  return "disabled";
}
export const PLAYER_FILTER_MIN = 1;
export const PLAYER_FILTER_MAX = 8;
export const avatarUploadPolicy = migrationMediaUploadPolicies.avatars;
export const AVATAR_UPLOAD_ACCEPT = avatarUploadPolicy.acceptedMimeTypes.join(",");
export const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Email is required.";
  }
  if (!EMAIL_ADDRESS_PATTERN.test(trimmed)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function getPasswordPolicyErrors(value: string): string[] {
  const errors: string[] = [];
  if (!value) {
    errors.push("Password is required.");
    return errors;
  }
  if (value.length < 8) {
    errors.push("Use at least 8 characters.");
  }
  if (!/[a-z]/.test(value)) {
    errors.push("Add a lowercase letter.");
  }
  if (!/[A-Z]/.test(value)) {
    errors.push("Add an uppercase letter.");
  }
  if (!/[0-9]/.test(value)) {
    errors.push("Add a number.");
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    errors.push("Add a special character.");
  }
  return errors;
}

export function validatePasswordConfirmation(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) {
    return "Confirm password is required.";
  }
  if (password !== confirmPassword) {
    return "Passwords must match.";
  }
  return null;
}

export interface StudioEditorState {
  slug: string;
  displayName: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
}

export interface LinkEditorState {
  label: string;
  url: string;
}

export interface TitleCreateState {
  displayName: string;
  slug: string;
  contentKind: "game" | "app";
  genreInput: string;
  genreTags: string[];
  shortDescription: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  ageRatingAuthority: string;
  ageRatingValue: string;
  minAgeYears: number;
}

export interface TitleSettingsState {
  slug: string;
  contentKind: "game" | "app";
  lifecycleStatus: "draft" | "active" | "archived";
  visibility: "unlisted" | "listed";
}

export interface MetadataEditorState {
  displayName: string;
  shortDescription: string;
  description: string;
  genreDisplay: string;
  minPlayers: number;
  maxPlayers: number;
  ageRatingAuthority: string;
  ageRatingValue: string;
  minAgeYears: number;
}

export interface MediaEditorState {
  sourceUrl: string;
  altText: string;
}

export interface ReleaseCreateState {
  version: string;
}

export interface ConnectionCreateState {
  supportedPublisherId: string;
  customPublisherDisplayName: string;
  customPublisherHomepageUrl: string;
  isEnabled: boolean;
}

export interface BindingCreateState {
  integrationConnectionId: string;
  acquisitionUrl: string;
  acquisitionLabel: string;
  isPrimary: boolean;
  isEnabled: boolean;
}

export type DevelopDomainKey = "studios" | "titles" | "releases" | "publishing";

export type DevelopWorkflowKey =
  | "studios-overview"
  | "studios-create"
  | "studios-settings"
  | "titles-overview"
  | "titles-create"
  | "titles-reports"
  | "title-detail-overview"
  | "title-detail-metadata"
  | "title-detail-media"
  | "releases-overview"
  | "releases-manager"
  | "publishing-connections"
  | "publishing-connections-manage"
  | "publishing-bindings"
  | "publishing-bindings-manage";

export interface AvatarEditorState {
  mode: "url" | "upload";
  url: string;
  dataUrl: string | null;
  fileName: string | null;
}

export interface SignInPageDraftState {
  email: string;
  password: string;
  showSignInPassword: boolean;
  mfaChallengeOpen: boolean;
  mfaCode: string;
  mfaFactorId: string | null;
  mfaFactorLabel: string;
  recoveryModalOpen: boolean;
  recoveryStep: "request" | "code" | "reset";
  registrationEmail: string;
  registrationPassword: string;
  showRegistrationPassword: boolean;
  recoveryEmail: string;
  recoveryCode: string;
  recoveryPassword: string;
  recoveryConfirmPassword: string;
  showRecoveryPassword: boolean;
  showRecoveryConfirmPassword: boolean;
}

export interface PlayerPageDraftState {
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  settingsCurrentPassword: string;
  showSettingsCurrentPassword: boolean;
  profileAvatar: AvatarEditorState;
  profileEditMode: boolean;
  settingsEditMode: boolean;
  newPassword: string;
  confirmNewPassword: string;
  showNewPassword: boolean;
  showConfirmNewPassword: boolean;
  mfaEnrollmentCode: string;
  mfaDisableCode: string;
  reportReply: string;
  selectedReportId: string | null;
}

export interface LandingSignupDraftState {
  firstName: string;
  email: string;
  consented: boolean;
  playerInterestSelected: boolean;
  developerInterestSelected: boolean;
}

export const LANDING_SIGNUP_DRAFT_STORAGE_KEY = "landing-signup-draft";
export const SIGN_IN_PAGE_DRAFT_STORAGE_KEY = "signin-page-draft";
export const SIGN_IN_OAUTH_RETURN_TO_STORAGE_KEY = "signin-oauth-return-to";
export const PLAYER_PAGE_DRAFT_STORAGE_KEY = "player-page-draft";

export function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatRoles(user: CurrentUserResponse | null): string {
  if (!user || user.roles.length === 0) {
    return "Guest";
  }

  return user.roles.map((role) => role.replace(/_/g, " ")).join(", ");
}

export function getInitials(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    return "U";
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 1).toUpperCase();
  }

  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function getCurrentUserAvatarUrl(user: CurrentUserResponse | null): string | null {
  const avatarUrl = user?.avatarUrl?.trim();
  return avatarUrl ? avatarUrl : null;
}

export function readSessionStorageJson<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export function writeSessionStorageJson(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures and keep the in-memory form state.
  }
}

export function removeSessionStorageJson(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures and keep the in-memory form state.
  }
}

export type ConnectedAccountIdentity = {
  id: string;
  user_id: string;
  identity_id: string;
  provider: string;
  identity_data?: Record<string, unknown>;
  created_at?: string;
  last_sign_in_at?: string;
  updated_at?: string;
};

export function sanitizeReturnToPath(value: string | null | undefined, fallback = "/player"): string {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

export function readSessionStorageValue(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(key);
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

export function writeSessionStorageValue(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures and keep the in-memory flow moving.
  }
}

export function readAuthRedirectErrorMessage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidates = [window.location.search, window.location.hash.startsWith("#") ? `?${window.location.hash.slice(1)}` : ""];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const params = new URLSearchParams(candidate);
    const errorDescription = params.get("error_description")?.trim();
    if (errorDescription) {
      return errorDescription;
    }

    const errorCode = params.get("error")?.trim();
    if (errorCode) {
      return errorCode.replace(/_/g, " ");
    }
  }

  return null;
}

export function restoreAvatarEditorState(value: unknown): AvatarEditorState {
  if (!value || typeof value !== "object") {
    return createAvatarEditorState(null);
  }

  const candidate = value as Partial<AvatarEditorState>;
  return {
    mode: candidate.mode === "upload" ? "upload" : "url",
    url: typeof candidate.url === "string" ? candidate.url : "",
    dataUrl: typeof candidate.dataUrl === "string" ? candidate.dataUrl : null,
    fileName: typeof candidate.fileName === "string" ? candidate.fileName : null,
  };
}

export function renderCurrentUserAvatar(user: CurrentUserResponse | null, loading: boolean, initials: string) {
  if (loading) {
    return <span>...</span>;
  }

  const avatarUrl = getCurrentUserAvatarUrl(user);
  if (!avatarUrl) {
    return <span>{initials}</span>;
  }

  const avatarLabel = user?.displayName ?? user?.email ?? "User";
  return <img className="h-full w-full object-cover" src={avatarUrl} alt={`${avatarLabel} avatar`} />;
}

export function isApiErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatNotificationTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  const elapsed = Date.now() - parsed.valueOf();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatNotificationCategory(value: string): string {
  if (value.trim().toLowerCase() === "title_report") {
    return "Title Report";
  }

  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0]!.toUpperCase() + token.slice(1).toLowerCase())
    .join(" ") || "Notification";
}

export function formatReportStatus(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0]!.toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

export function formatAudienceLabel(value: string): string {
  switch (value) {
    case "player":
      return "Player only";
    case "developer":
      return "Developer only";
    default:
      return "Visible to all";
  }
}

export function canViewTitleReportMessageAudience(audience: string, viewerRole: "player" | "developer" | "moderator"): boolean {
  switch (audience) {
    case "all":
      return true;
    case "player":
      return viewerRole === "player" || viewerRole === "moderator";
    case "developer":
      return viewerRole === "developer" || viewerRole === "moderator";
    default:
      return viewerRole === "moderator";
  }
}

export function isBrowsePath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/browse") || pathname.startsWith("/studios");
}

export function parseGenreTags(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

export function formatContentKindLabel(contentKind: string | null | undefined): string {
  return String(contentKind).toLowerCase() === "app" ? "App" : "Game";
}

export function formatMembershipRole(role: string | null | undefined): string {
  if (!role) {
    return "Member";
  }

  return role
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0]!.toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

export function isCatalogTitlePubliclyAvailable(title: Pick<CatalogTitleSummary, "lifecycleStatus" | "visibility">): boolean {
  return title.lifecycleStatus === "active" && title.visibility === "listed";
}

export function getCatalogTitleAvailabilityNote(title: Pick<CatalogTitleSummary, "lifecycleStatus" | "visibility">): string | null {
  if (isCatalogTitlePubliclyAvailable(title)) {
    return null;
  }

  if (title.lifecycleStatus === "archived") {
    return "Archived and no longer available";
  }

  if (title.lifecycleStatus === "draft") {
    return "Still in draft and not publicly available";
  }

  return "Unlisted and no longer available";
}

export function createInitialTitleState(): TitleCreateState {
  return {
    displayName: "",
    slug: "title",
    contentKind: "game",
    genreInput: "",
    genreTags: [],
    shortDescription: "",
    description: "",
    minPlayers: 1,
    maxPlayers: 4,
    ageRatingAuthority: "ESRB",
    ageRatingValue: "E10+",
    minAgeYears: 10,
  };
}

export function createTitleSettingsState(title: DeveloperTitle | null): TitleSettingsState {
  return {
    slug: title?.slug ?? "",
    contentKind: title?.contentKind ?? "game",
    lifecycleStatus: title?.lifecycleStatus ?? "draft",
    visibility: title?.visibility ?? "unlisted",
  };
}

export function createMetadataEditorState(title: DeveloperTitle | null): MetadataEditorState {
  return {
    displayName: title?.displayName ?? "",
    shortDescription: title?.shortDescription ?? "",
    description: title?.description ?? "",
    genreDisplay: title?.genreDisplay ?? "",
    minPlayers: title?.minPlayers ?? 1,
    maxPlayers: title?.maxPlayers ?? 1,
    ageRatingAuthority: title?.ageRatingAuthority ?? "ESRB",
    ageRatingValue: title?.ageRatingValue ?? "E10+",
    minAgeYears: title?.minAgeYears ?? 10,
  };
}

export function getFallbackGradient(genreDisplay: string | null | undefined): string {
  const primaryGenre = parseGenreTags(genreDisplay).at(0)?.toLowerCase();
  switch (primaryGenre) {
    case "shooter":
    case "arcade shooter":
      return "linear-gradient(135deg, #f8fafc, #7dd3fc, #1d4ed8)";
    case "adventure":
      return "linear-gradient(135deg, #fde68a, #fb7185, #7c3aed)";
    case "puzzle":
      return "linear-gradient(135deg, #d8f3dc, #60a5fa, #1e293b)";
    default:
      return "linear-gradient(135deg, #fef3c7, #f97316, #334155)";
  }
}

export function escapeSvgText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function getFallbackArtworkUrl(title: CatalogTitleSummary): string {
  const primaryGenre = parseGenreTags(title.genreDisplay).at(0) ?? formatContentKindLabel(title.contentKind);
  const palette =
    primaryGenre.toLowerCase() === "puzzle"
      ? { start: "#dff7ea", end: "#4d75f4", accent: "#f3fff8" }
      : primaryGenre.toLowerCase().includes("adventure")
        ? { start: "#ffe2b6", end: "#f39a2e", accent: "#fffbf0" }
        : { start: "#f3b13a", end: "#2b405f", accent: "#f3fff8" };
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200" role="img" aria-label="${escapeSvgText(title.displayName)} fallback artwork">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.start}" />
          <stop offset="100%" stop-color="${palette.end}" />
        </linearGradient>
        <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(255,255,255,0)" />
          <stop offset="50%" stop-color="rgba(255,255,255,0.35)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect width="900" height="1200" fill="url(#bg)" />
      <circle cx="180" cy="220" r="180" fill="rgba(255,255,255,0.14)" />
      <circle cx="760" cy="190" r="120" fill="rgba(0,0,0,0.18)" />
      <path d="M0 960 C180 840 340 860 470 940 S760 1080 900 940 V1200 H0 Z" fill="rgba(8,10,16,0.34)" />
      <rect x="120" y="126" width="660" height="2" fill="url(#shine)" opacity="0.7" />
      <text x="120" y="890" fill="${palette.accent}" font-size="58" font-family="Public Sans, Segoe UI, sans-serif" letter-spacing="10">${escapeSvgText(primaryGenre.toUpperCase())}</text>
      <text x="120" y="980" fill="#ffffff" font-size="92" font-weight="700" font-family="Syne, Trebuchet MS, sans-serif">${escapeSvgText(title.displayName)}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function formatPlayerFilterValue(value: number): string {
  return value >= PLAYER_FILTER_MAX ? `${PLAYER_FILTER_MAX}+` : String(value);
}

export function formatPlayerFilterSummary(minPlayers: number, maxPlayers: number): string {
  return `${minPlayers} to ${formatPlayerFilterValue(maxPlayers)} players`;
}

export function getHeroImageUrl(title: CatalogTitleResponse["title"]): string | null {
  return title.mediaAssets.find((asset) => asset.mediaRole === "hero")?.sourceUrl ?? title.cardImageUrl ?? null;
}

export function getTitleLogoAsset(title: CatalogTitleResponse["title"]): TitleMediaAsset | null {
  return title.mediaAssets.find((asset) => asset.mediaRole === "logo") ?? null;
}

export function getStudioAvatarImageUrl(studio: { avatarUrl: string | null; logoUrl: string | null }): string | null {
  return studio.avatarUrl ?? studio.logoUrl ?? null;
}

export function createAvatarEditorState(profile: UserProfile | null): AvatarEditorState {
  const avatarUrl = profile?.avatarUrl ?? "";
  if (avatarUrl.startsWith("data:")) {
    return {
      mode: "upload",
      url: "",
      dataUrl: avatarUrl,
      fileName: "Current uploaded avatar",
    };
  }

  return {
    mode: "url",
    url: avatarUrl,
    dataUrl: null,
    fileName: null,
  };
}

export async function readAvatarUpload(event: ChangeEvent<HTMLInputElement>): Promise<{ dataUrl: string; fileName: string }> {
  const file = event.currentTarget.files?.[0] ?? null;
  if (!file) {
    throw new Error("No avatar file was selected.");
  }
  try {
    const result = await normalizeImageUpload(file, avatarUploadPolicy, {
      label: "avatar",
      readErrorMessage: "Avatar upload could not be read.",
    });

    return {
      dataUrl: result.dataUrl,
      fileName: result.fileName,
    };
  } catch (error) {
    if (error instanceof Error && error.message === buildAcceptedMimeTypeError("avatar", avatarUploadPolicy)) {
      throw new Error("Uploaded avatar must be a WEBP, JPEG, or PNG image.");
    }
    throw error;
  }
}
