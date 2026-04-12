import type {
  CatalogMediaEntry,
  CatalogMediaTypeDefinition,
  CatalogMediaTypeKey,
  CatalogTitleResponse,
  CatalogTitleSummary,
  CurrentUserResponse,
  DeveloperTitle,
  TitleMediaAsset,
  UserProfile,
} from "@board-enthusiasts/migration-contract";
import { catalogMediaTypeDefinitions, migrationMediaUploadPolicies } from "@board-enthusiasts/migration-contract";
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
export const accountSignupConsentTextVersion = "account-signup-v1";
export const landingSignupSource = "landing_page";
export const landingPrivacyRoute = "/privacy";
export const landingSignupRoute = "/#signup";
export const landingDiscordUrl = "https://discord.gg/cz2zReWqcA";
export const landingGdkDiscordUrl = "https://discord.gg/T9CMkmJX7P";
export const landingEmulatorDiscordUrl = "https://discord.gg/YFsFcCM6Ff";
export const landingGptUrl = "https://chatgpt.com/g/g-69b033db223c81919edf748c33b08b3f-board-enthusiast";
export const landingBoardUrl = "https://board.fun/";
export const landingSupportMailtoHref = "mailto:support@boardenthusiasts.com?subject=%5BBug%20Report%5D%20Email%20signup%20issue";
export const landingMetadata = {
  defaultTitle: "Board Enthusiasts | Community Hub for Board Players and Builders",
  defaultDescription:
    "Board Enthusiasts is the unofficial community hub for Board players and builders. Follow indie Board games and apps, discover BE resources, join the Discord, and get updates on the upcoming BE library.",
  defaultCanonical: "https://boardenthusiasts.com/",
  privacyTitle: "Board Enthusiasts Privacy Snapshot | Board Players and Builders",
  privacyDescription:
    "Read the Board Enthusiasts privacy snapshot covering update-list signups, support requests, limited site analytics, and the hosted services used to run the community site.",
  privacyCanonical: "https://boardenthusiasts.com/privacy",
} as const;
export const liveMetadata = {
  homeTitle: "Board Enthusiasts | For Board Players and Builders",
  homeDescription:
    "The BE Game Index is live. Browse indie Board games and apps in one place, then explore the broader Board Enthusiasts ecosystem around it.",
  homeCanonical: "https://boardenthusiasts.com/",
  offeringsTitle: "BE Offerings | Tools, Community, and Ecosystem Support for Board",
  offeringsDescription:
    "Explore the broader BE ecosystem around the live Game Index, including community spaces, helper tools, utility apps, and in-progress offerings for Board players and builders.",
  offeringsCanonical: "https://boardenthusiasts.com/offerings",
  supportTitle: "Contact Us | Board Enthusiasts",
  supportDescription:
    "Get help with Board Enthusiasts, report site issues, and contact the team at support@boardenthusiasts.com.",
  supportCanonical: "https://boardenthusiasts.com/support",
  privacyTitle: "BE Privacy Snapshot | For Board Players and Builders",
  privacyDescription:
    "Read the BE privacy snapshot covering account registration, optional social sign-in, catalog activity, developer submissions, support requests, and the hosted services used to run the live Board Enthusiasts experience.",
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

export function getAbsoluteUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

export function getTitleDetailPath(studioSlug: string, titleSlug: string): string {
  return `/browse/${studioSlug}/${titleSlug}`;
}

export function getTitleDetailPageUrl(studioSlug: string, titleSlug: string): string {
  return getAbsoluteUrl(getTitleDetailPath(studioSlug, titleSlug));
}

export function getTitleSharePath(studioId: string, titleId: string): string {
  return `/browse/${studioId}/${titleId}`;
}

export function getTitleSharePageUrl(studioId: string, titleId: string): string {
  return getAbsoluteUrl(getTitleSharePath(studioId, titleId));
}

export function getTitleShareHelperPath(studioId: string, titleId: string): string {
  return `${getTitleSharePath(studioId, titleId)}?share=1`;
}

export function getTitleShareHelperPageUrl(studioId: string, titleId: string): string {
  return getAbsoluteUrl(getTitleShareHelperPath(studioId, titleId));
}

export function getStudioDetailPath(studioSlug: string): string {
  return `/studios/${studioSlug}`;
}

export function getStudioDetailPageUrl(studioSlug: string): string {
  return getAbsoluteUrl(getStudioDetailPath(studioSlug));
}

export async function writeTextToClipboard(value: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard access is unavailable.");
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  document.body.append(textArea);
  textArea.focus();
  textArea.select();

  const copied = typeof document.execCommand === "function" && document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("Clipboard access is unavailable.");
  }
}
export const PLAYER_FILTER_MIN = 1;
export const PLAYER_FILTER_MAX = 8;
export const avatarUploadPolicy = migrationMediaUploadPolicies.avatars;
export const AVATAR_UPLOAD_ACCEPT = avatarUploadPolicy.acceptedMimeTypes.join(",");
export const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const fallbackCatalogMediaTypes = Object.values(catalogMediaTypeDefinitions);

const fallbackCatalogMediaTypeDefinitionByKey = fallbackCatalogMediaTypes.reduce<Record<CatalogMediaTypeKey, CatalogMediaTypeDefinition>>(
  (accumulator, definition) => {
    accumulator[definition.key] = definition;
    return accumulator;
  },
  {} as Record<CatalogMediaTypeKey, CatalogMediaTypeDefinition>,
);

export function buildAspectRatioValue(width: number, height: number): string {
  return `${width} / ${height}`;
}

export function getCatalogMediaTypeDefinition(
  definitions: readonly CatalogMediaTypeDefinition[] | null | undefined,
  key: CatalogMediaTypeKey,
): CatalogMediaTypeDefinition {
  return definitions?.find((definition) => definition.key === key) ?? fallbackCatalogMediaTypeDefinitionByKey[key];
}

export function getCatalogMediaAspectRatioValue(
  definitions: readonly CatalogMediaTypeDefinition[] | null | undefined,
  key: CatalogMediaTypeKey,
): string {
  const definition = getCatalogMediaTypeDefinition(definitions, key);
  return buildAspectRatioValue(definition.recommendedWidth, definition.recommendedHeight);
}

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
  maxPlayersOrMore: boolean;
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
  maxPlayersOrMore: boolean;
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
  expiresAt: string;
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
  mfaChallengePurpose: "sign-in" | "recovery";
  mfaCode: string;
  mfaFactorId: string | null;
  mfaFactorLabel: string;
  recoveryModalOpen: boolean;
  recoveryStep: "request" | "code" | "reset";
  registrationEmail: string;
  registrationPassword: string;
  showRegistrationPassword: boolean;
  registrationMarketingOptIn: boolean;
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
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
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

export function removeSessionStorageValue(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures and keep the in-memory flow moving.
  }
}

export function readAuthRedirectMode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidates = [window.location.search, window.location.hash.startsWith("#") ? `?${window.location.hash.slice(1)}` : ""];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const params = new URLSearchParams(candidate);
    const explicitMode = params.get("mode")?.trim();
    if (explicitMode) {
      return explicitMode;
    }

    const authType = params.get("type")?.trim();
    if (authType) {
      return authType;
    }
  }

  return null;
}

export function hasAuthRedirectCallbackParams(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const candidates = [window.location.search, window.location.hash.startsWith("#") ? `?${window.location.hash.slice(1)}` : ""];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const params = new URLSearchParams(candidate);
    if (
      params.has("access_token") ||
      params.has("refresh_token") ||
      params.has("token_hash") ||
      params.has("code")
    ) {
      return true;
    }
  }

  return false;
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
  return pathname.startsWith("/browse") || pathname.startsWith("/studios");
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

export function getCatalogTitleAvailabilityNote(
  title: Pick<CatalogTitleSummary, "lifecycleStatus" | "visibility" | "acquisitionUrl"> & { currentRelease?: { id: string } | null }
): string | null {
  if (title.lifecycleStatus === "archived") {
    return "Archived and no longer available";
  }

  if (title.lifecycleStatus === "draft") {
    return "Still in draft and not publicly available";
  }

  if (title.visibility !== "listed") {
    return "Unlisted and no longer available";
  }

  if (!title.currentRelease && !title.acquisitionUrl) {
    return "Coming soon";
  }

  return null;
}

export function formatTitleWishlistInterestLabel(count: number): string {
  return `Wishlisted by ${count}`;
}

export function formatTitleLibraryInterestLabel(count: number): string {
  return count === 1 ? "In 1 library" : `In ${count} libraries`;
}

export function formatTitleViewInterestLabel(count: number): string {
  return count === 1 ? "1 title detail view" : `${count} title detail views`;
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
    maxPlayersOrMore: false,
    ageRatingAuthority: "",
    ageRatingValue: "",
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
    maxPlayersOrMore: title?.maxPlayersOrMore ?? false,
    ageRatingAuthority: title?.ageRatingAuthority ?? "",
    ageRatingValue: title?.ageRatingValue ?? "",
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
      ? { start: "#def7e8", end: "#2453d5", accent: "#effff6", shadow: "#11243c" }
      : primaryGenre.toLowerCase().includes("adventure")
        ? { start: "#ffd7a0", end: "#f46b45", accent: "#fff7eb", shadow: "#311621" }
        : { start: "#8af0cb", end: "#3659f3", accent: "#f3fff9", shadow: "#111b33" };
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200" role="img" aria-label="${escapeSvgText(title.displayName)} fallback artwork">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.start}" />
          <stop offset="100%" stop-color="${palette.end}" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="18%" r="75%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.34" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="900" height="1200" fill="url(#bg)" />
      <rect width="900" height="1200" fill="url(#glow)" />
      <circle cx="178" cy="188" r="152" fill="#ffffff" fill-opacity="0.12" />
      <circle cx="752" cy="244" r="104" fill="#070a12" fill-opacity="0.14" />
      <path d="M0 968 C160 820 340 832 494 922 C652 1014 760 1032 900 962 V1200 H0 Z" fill="#090c16" fill-opacity="0.3" />
      <path d="M338 850c0-72 44-126 112-150-24-28-38-64-38-102 0-98 78-176 176-176s176 78 176 176c0 38-14 74-38 102 68 24 112 78 112 150 0 18-2 34-8 52H346c-6-18-8-34-8-52Z" fill="${palette.shadow}" opacity="0.26"/>
      <circle cx="450" cy="358" r="80" fill="${palette.accent}" opacity="0.96" />
      <path d="M450 460c-80 0-138 60-138 140 0 22 4 42 12 62h252c8-20 12-40 12-62 0-80-58-140-138-140Z" fill="${palette.accent}" opacity="0.96" />
      <path d="M286 724h328c14 0 26 12 26 26v34c0 14-12 26-26 26H286c-14 0-26-12-26-26v-34c0-14 12-26 26-26Z" fill="${palette.accent}" opacity="0.96" />
      <path d="M232 810h436c18 0 32 14 32 32v34H200v-34c0-18 14-32 32-32Z" fill="${palette.accent}" opacity="0.96" />
      <path d="M172 944h556v54H172z" fill="#ffffff" fill-opacity="0.2" />
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function formatPlayerFilterValue(value: number): string {
  return value >= PLAYER_FILTER_MAX ? `${PLAYER_FILTER_MAX}+` : String(value);
}

export function formatPlayerFilterSummary(minPlayers: number, maxPlayers: number): string {
  return `${minPlayers} to ${formatPlayerFilterValue(maxPlayers)} players`;
}

export function formatPlayerCountDisplay(minPlayers: number, maxPlayers: number, maxPlayersOrMore: boolean): string {
  if (maxPlayersOrMore) {
    return minPlayers === maxPlayers ? `${maxPlayers}+ players` : `${minPlayers}-${maxPlayers}+ players`;
  }

  return minPlayers === maxPlayers ? `${minPlayers} player${minPlayers === 1 ? "" : "s"}` : `${minPlayers}-${maxPlayers} players`;
}

export function getCatalogMediaEntriesByType<TMediaOwner extends { catalogMediaEntries?: CatalogMediaEntry[] | null }>(
  owner: TMediaOwner,
  mediaTypeKey: CatalogMediaEntry["mediaTypeKey"],
): CatalogMediaEntry[] {
  return (owner.catalogMediaEntries ?? [])
    .filter((entry) => entry.mediaTypeKey === mediaTypeKey)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.createdAt.localeCompare(right.createdAt));
}

export function getFirstCatalogImageByType<TMediaOwner extends { catalogMediaEntries?: CatalogMediaEntry[] | null }>(
  owner: TMediaOwner,
  mediaTypeKey: CatalogMediaEntry["mediaTypeKey"],
): CatalogMediaEntry | null {
  return getCatalogMediaEntriesByType(owner, mediaTypeKey).find((entry) => entry.kind === "image" && entry.sourceUrl) ?? null;
}

export function getHeroImageUrl(title: CatalogTitleResponse["title"]): string | null {
  return (
    getFirstCatalogImageByType(title, "title_quick_view_banner")?.sourceUrl ??
    getFirstCatalogImageByType(title, "title_showcase")?.sourceUrl ??
    title.mediaAssets.find((asset) => asset.mediaRole === "hero")?.sourceUrl ??
    title.cardImageUrl ??
    null
  );
}

export function getPrimaryTitleShowcaseImageUrl(title: CatalogTitleResponse["title"]): string | null {
  return getFirstCatalogImageByType(title, "title_showcase")?.sourceUrl ?? getHeroImageUrl(title);
}

type TitleCardImageOwner = Pick<CatalogTitleSummary, "cardImageUrl" | "catalogMediaEntries"> | Pick<DeveloperTitle, "cardImageUrl" | "catalogMediaEntries">;
export function getTitleCardImageUrl(title: TitleCardImageOwner): string | null {
  return getFirstCatalogImageByType(title, "title_card")?.sourceUrl ?? title.cardImageUrl ?? null;
}

export function getTitleAvatarImageUrl(
  title: TitleCardImageOwner
): string | null {
  return getFirstCatalogImageByType(title, "title_avatar")?.sourceUrl ?? null;
}

export function getTitleLogoAsset(title: CatalogTitleResponse["title"]): TitleMediaAsset | null {
  const unifiedLogo = getFirstCatalogImageByType(title, "title_logo");
  if (unifiedLogo?.sourceUrl) {
    return {
      id: unifiedLogo.id,
      mediaRole: "logo",
      sourceUrl: unifiedLogo.sourceUrl,
      altText: unifiedLogo.altText,
      mimeType: unifiedLogo.mimeType,
      width: unifiedLogo.width,
      height: unifiedLogo.height,
      createdAt: unifiedLogo.createdAt,
      updatedAt: unifiedLogo.updatedAt,
    };
  }

  return title.mediaAssets.find((asset) => asset.mediaRole === "logo") ?? null;
}

export function getStudioAvatarImageUrl(
  studio: { avatarUrl: string | null; logoUrl: string | null; catalogMediaEntries?: CatalogMediaEntry[] | null }
): string | null {
  return getFirstCatalogImageByType(studio, "studio_avatar")?.sourceUrl ?? studio.avatarUrl ?? studio.logoUrl ?? null;
}

export function getStudioLogoImageUrl(
  studio: { avatarUrl: string | null; logoUrl: string | null; catalogMediaEntries?: CatalogMediaEntry[] | null }
): string | null {
  return getFirstCatalogImageByType(studio, "studio_logo")?.sourceUrl ?? studio.logoUrl ?? null;
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
