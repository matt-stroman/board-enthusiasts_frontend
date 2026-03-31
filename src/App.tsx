import type {
  BoardProfile,
  CatalogTitleResponse,
  CatalogTitleSummary,
  CurrentUserResponse,
  DeveloperTitle,
  DeveloperStudioSummary,
  ModerationDeveloperSummary,
  PlayerTitleReportSummary,
  StudioLink,
  StudioSummary,
  TitleMediaAsset,
  TitleMetadataVersion,
  TitleRelease,
  TitleReportDetail,
  TitleReportSummary,
  UserNotification,
  UserProfile,
} from "@board-enthusiasts/migration-contract";
import { migrationMediaUploadPolicies } from "@board-enthusiasts/migration-contract";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ApiError,
  addModerationTitleReportMessage,
  addDeveloperTitleReportMessage,
  addPlayerTitleReportMessage,
  addTitleToPlayerLibrary,
  addTitleToPlayerWishlist,
  activateTitleMetadataVersion,
  activateTitleRelease,
  createMarketingSignup,
  createSupportIssueReport,
  createTitle,
  createTitleRelease,
  createStudio,
  createPlayerTitleReport,
  createStudioLink,
  deleteStudio,
  deleteStudioLink,
  deleteTitleMediaAsset,
  enrollAsDeveloper,
  getBoardProfile,
  getCatalogTitle,
  getCurrentUserNotifications,
  getDeveloperTitle,
  getDeveloperTitleReport,
  getDeveloperTitleReports,
  getDeveloperEnrollment,
  getModerationTitleReport,
  getModerationTitleReports,
  getPlayerLibrary,
  getPlayerTitleReport,
  getPlayerTitleReports,
  getPlayerWishlist,
  getUserNameAvailability,
  getPublicStudio,
  getTitleMediaAssets,
  getTitleMetadataVersions,
  getTitleReleases,
  getUserProfile,
  getVerifiedDeveloperState,
  invalidateModerationTitleReport,
  listCatalogTitles,
  listManagedStudios,
  listPublicStudios,
  listStudioTitles,
  listStudioLinks,
  markCurrentUserNotificationRead,
  removeTitleFromPlayerLibrary,
  removeTitleFromPlayerWishlist,
  searchModerationDevelopers,
  setVerifiedDeveloperState,
  updateTitle,
  updateTitleRelease,
  updateStudio,
  updateStudioLink,
  updateUserProfile,
  upsertTitleMediaAsset,
  upsertTitleMetadata,
  uploadTitleMediaAsset,
  uploadStudioMedia,
  validateModerationTitleReport,
  type StudioLinkMutationRequest,
  type StudioMutationRequest,
} from "./api";
import { hasPlatformRole, useAuth, type SignUpInput } from "./auth";
import { readAppConfig, type AppConfig } from "./config";
import { DevelopWorkspacePage } from "./develop-workspace";
import {
  buildAcceptedMimeTypeError,
  formatMediaUploadGuidance,
  normalizeImageUpload,
} from "./media-upload";

const appConfig = new Proxy({} as AppConfig, {
  get(_target, property) {
    return readAppConfig()[property as keyof AppConfig];
  },
});
const landingConsentTextVersion = "landing-page-v1";
const landingSignupSource = "landing_page";
const landingPrivacyRoute = "/privacy";
const landingSignupRoute = "/#signup";
const landingDiscordUrl = "https://discord.gg/cz2zReWqcA";
const landingGptUrl = "https://chatgpt.com/g/g-69b033db223c81919edf748c33b08b3f-board-enthusiast";
const landingBoardUrl = "https://board.fun/";
const landingSupportMailtoHref = "mailto:support@boardenthusiasts.com?subject=%5BBug%20Report%5D%20Email%20signup%20issue";
const landingMetadata = {
  defaultTitle: "Board Enthusiasts | Community Hub for Board Players and Builders",
  defaultDescription:
    "Board Enthusiasts is the unofficial community hub for Board players and builders. Follow Board games and apps, discover BE resources, join the Discord, and get updates on the upcoming third-party library.",
  defaultCanonical: "https://boardenthusiasts.com/",
  privacyTitle: "Board Enthusiasts Privacy Snapshot | Board Players and Builders",
  privacyDescription:
    "Read the Board Enthusiasts privacy snapshot covering launch-list signup data, direct contact requests, and the hosted services used to support the Board community site.",
  privacyCanonical: "https://boardenthusiasts.com/privacy",
} as const;
const liveMetadata = {
  homeTitle: "Board Enthusiasts | For Board Players and Builders",
  homeDescription:
    "BE is where the Board community shows up first. Browse the live BE Library, plug into Discord, discover current tools, and follow what launches next.",
  homeCanonical: "https://boardenthusiasts.com/",
  privacyTitle: "BE Privacy Snapshot | For Board Players and Builders",
  privacyDescription:
    "Read the BE privacy snapshot covering account registration, library activity, developer submissions, direct contact requests, and the hosted services that power the live Board Enthusiasts experience.",
  privacyCanonical: "https://boardenthusiasts.com/privacy",
} as const;
const supportedPublisherOptions = [
  { id: "", label: "Custom publisher", homepageUrl: "" },
  { id: "11111111-1111-1111-1111-111111111111", label: "itch.io", homepageUrl: "https://itch.io" },
  { id: "22222222-2222-2222-2222-222222222222", label: "Humble", homepageUrl: "https://www.humblebundle.com" },
] as const;

type CaptchaMode = "disabled" | "turnstile" | "simulated-local";

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function getCaptchaMode(siteKey: string | null): CaptchaMode {
  if (siteKey) {
    return "turnstile";
  }

  if (typeof window !== "undefined" && isLoopbackHostname(window.location.hostname)) {
    return "simulated-local";
  }

  return "disabled";
}
const PLAYER_FILTER_MIN = 1;
const PLAYER_FILTER_MAX = 8;
const avatarUploadPolicy = migrationMediaUploadPolicies.avatars;
const AVATAR_UPLOAD_ACCEPT = avatarUploadPolicy.acceptedMimeTypes.join(",");
const USER_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUserNameInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Username is required.";
  }
  if (!USER_NAME_PATTERN.test(trimmed)) {
    return "Use lowercase letters, numbers, periods, underscores, or hyphens.";
  }
  return null;
}

function validateEmailInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Email is required.";
  }
  if (!EMAIL_ADDRESS_PATTERN.test(trimmed)) {
    return "Enter a valid email address.";
  }
  return null;
}

function getPasswordPolicyErrors(value: string): string[] {
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

function validatePasswordConfirmation(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) {
    return "Confirm password is required.";
  }
  if (password !== confirmPassword) {
    return "Passwords must match.";
  }
  return null;
}

interface StudioEditorState {
  slug: string;
  displayName: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
}

interface LinkEditorState {
  label: string;
  url: string;
}

interface TitleCreateState {
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

interface TitleSettingsState {
  slug: string;
  contentKind: "game" | "app";
  lifecycleStatus: "draft" | "active" | "archived";
  visibility: "unlisted" | "listed";
}

interface MetadataEditorState {
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

interface MediaEditorState {
  sourceUrl: string;
  altText: string;
}

interface ReleaseCreateState {
  version: string;
}

interface ConnectionCreateState {
  supportedPublisherId: string;
  customPublisherDisplayName: string;
  customPublisherHomepageUrl: string;
  isEnabled: boolean;
}

interface BindingCreateState {
  integrationConnectionId: string;
  acquisitionUrl: string;
  acquisitionLabel: string;
  isPrimary: boolean;
  isEnabled: boolean;
}

type DevelopDomainKey = "studios" | "titles" | "releases" | "publishing";

type DevelopWorkflowKey =
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

interface AvatarEditorState {
  mode: "url" | "upload";
  url: string;
  dataUrl: string | null;
  fileName: string | null;
}

interface SignInPageDraftState {
  email: string;
  password: string;
  showSignInPassword: boolean;
  mfaChallengeOpen: boolean;
  mfaCode: string;
  mfaFactorId: string | null;
  mfaFactorLabel: string;
  registerModalOpen: boolean;
  recoveryModalOpen: boolean;
  confirmationModalOpen: boolean;
  recoveryStep: "request" | "code" | "reset";
  registrationUserName: string;
  registrationEmail: string;
  registrationFirstName: string;
  registrationLastName: string;
  registrationPassword: string;
  registrationConfirmPassword: string;
  showRegistrationPassword: boolean;
  showRegistrationConfirmPassword: boolean;
  registrationAvatar: AvatarEditorState;
  recoveryEmail: string;
  recoveryCode: string;
  recoveryPassword: string;
  recoveryConfirmPassword: string;
  showRecoveryPassword: boolean;
  showRecoveryConfirmPassword: boolean;
  confirmationEmail: string;
  confirmationCode: string;
}

interface PlayerPageDraftState {
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

interface LandingSignupDraftState {
  firstName: string;
  email: string;
  consented: boolean;
  playerInterestSelected: boolean;
  developerInterestSelected: boolean;
}

const LANDING_SIGNUP_DRAFT_STORAGE_KEY = "landing-signup-draft";
const SIGN_IN_PAGE_DRAFT_STORAGE_KEY = "signin-page-draft";
const PLAYER_PAGE_DRAFT_STORAGE_KEY = "player-page-draft";

function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function formatRoles(user: CurrentUserResponse | null): string {
  if (!user || user.roles.length === 0) {
    return "Guest";
  }

  return user.roles.map((role) => role.replace(/_/g, " ")).join(", ");
}

function getInitials(value: string | null | undefined): string {
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

function getCurrentUserAvatarUrl(user: CurrentUserResponse | null): string | null {
  const avatarUrl = user?.avatarUrl?.trim();
  return avatarUrl ? avatarUrl : null;
}

function readSessionStorageJson<T>(key: string): T | null {
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

function writeSessionStorageJson(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures and keep the in-memory form state.
  }
}

function removeSessionStorageJson(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures and keep the in-memory form state.
  }
}

function restoreAvatarEditorState(value: unknown): AvatarEditorState {
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

function renderCurrentUserAvatar(user: CurrentUserResponse | null, loading: boolean, initials: string) {
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

function isApiErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

function formatTimestamp(value: string | null | undefined): string {
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

function formatNotificationTimestamp(value: string | null | undefined): string {
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

function formatNotificationCategory(value: string): string {
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

function formatReportStatus(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0]!.toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function formatAudienceLabel(value: string): string {
  switch (value) {
    case "player":
      return "Player only";
    case "developer":
      return "Developer only";
    default:
      return "Visible to all";
  }
}

function canViewTitleReportMessageAudience(audience: string, viewerRole: "player" | "developer" | "moderator"): boolean {
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

function isBrowsePath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/browse") || pathname.startsWith("/studios");
}

function parseGenreTags(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function formatContentKindLabel(contentKind: string | null | undefined): string {
  return String(contentKind).toLowerCase() === "app" ? "App" : "Game";
}

function formatMembershipRole(role: string | null | undefined): string {
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

function isCatalogTitlePubliclyAvailable(title: Pick<CatalogTitleSummary, "lifecycleStatus" | "visibility">): boolean {
  return title.lifecycleStatus === "active" && title.visibility === "listed";
}

function getCatalogTitleAvailabilityNote(title: Pick<CatalogTitleSummary, "lifecycleStatus" | "visibility">): string | null {
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

function createInitialTitleState(): TitleCreateState {
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

function createTitleSettingsState(title: DeveloperTitle | null): TitleSettingsState {
  return {
    slug: title?.slug ?? "",
    contentKind: title?.contentKind ?? "game",
    lifecycleStatus: title?.lifecycleStatus ?? "draft",
    visibility: title?.visibility ?? "unlisted",
  };
}

function createMetadataEditorState(title: DeveloperTitle | null): MetadataEditorState {
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

function getFallbackGradient(genreDisplay: string | null | undefined): string {
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

function escapeSvgText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getFallbackArtworkUrl(title: CatalogTitleSummary): string {
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

function formatPlayerFilterValue(value: number): string {
  return value >= PLAYER_FILTER_MAX ? `${PLAYER_FILTER_MAX}+` : String(value);
}

function formatPlayerFilterSummary(minPlayers: number, maxPlayers: number): string {
  return `${minPlayers} to ${formatPlayerFilterValue(maxPlayers)} players`;
}

function getHeroImageUrl(title: CatalogTitleResponse["title"]): string | null {
  return title.mediaAssets.find((asset) => asset.mediaRole === "hero")?.sourceUrl ?? title.cardImageUrl ?? null;
}

function getTitleLogoAsset(title: CatalogTitleResponse["title"]): TitleMediaAsset | null {
  return title.mediaAssets.find((asset) => asset.mediaRole === "logo") ?? null;
}

function getStudioAvatarImageUrl(studio: { avatarUrl: string | null; logoUrl: string | null }): string | null {
  return studio.avatarUrl ?? studio.logoUrl ?? null;
}

function createAvatarEditorState(profile: UserProfile | null): AvatarEditorState {
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

async function readAvatarUpload(event: ChangeEvent<HTMLInputElement>): Promise<{ dataUrl: string; fileName: string }> {
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

function FilePicker({
  accept,
  disabled,
  onChange,
  buttonLabel = "Choose file",
  selectedFileName,
  emptyLabel = "No file chosen",
}: {
  accept: string;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  buttonLabel?: string;
  selectedFileName?: string | null;
  emptyLabel?: string;
}) {
  const inputId = useId();

  return (
    <div className="file-picker">
      <label
        htmlFor={inputId}
        className={disabled ? "file-picker-button pointer-events-none opacity-50" : "file-picker-button"}
        aria-disabled={disabled}
      >
        {buttonLabel}
      </label>
      <span className="file-picker-name">{selectedFileName?.trim() || emptyLabel}</span>
      <input id={inputId} className="sr-only" type="file" accept={accept} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel">
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <h2>{title}</h2>
      {description ? <p className="panel-description">{description}</p> : null}
      {children}
    </section>
  );
}

function LoadingPanel({ title = "Loading..." }: { title?: string }) {
  return (
    <Panel title={title} eyebrow="Status">
      <div className="status-chip">Working</div>
    </Panel>
  );
}

function ErrorPanel({ title = "Something went wrong", detail }: { title?: string; detail: string }) {
  return (
    <Panel title={title} eyebrow="Error">
      <p>{detail}</p>
    </Panel>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
  hintTone = "default",
  required = false,
  reserveHintSpace = true,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  hintTone?: "default" | "error" | "success";
  required?: boolean;
  reserveHintSpace?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? (
          <>
            {" "}
            <span aria-hidden="true" className="field-required-marker">*</span>
          </>
        ) : null}
      </span>
      {children}
      {hint || reserveHintSpace ? (
        <small
          className={`field-hint-slot ${hintTone === "error" ? "field-hint-error" : hintTone === "success" ? "field-hint-success" : ""}`.trim()}
          aria-hidden={hint ? undefined : true}
        >
          {hint ?? "\u00A0"}
        </small>
      ) : null}
    </label>
  );
}

function PasswordField({
  label,
  value,
  autoComplete,
  show,
  onChange,
  onToggle,
  onBlur,
  hint,
  hintTone = "default",
  required = false,
  disabled = false,
  reserveHintSpace = true,
}: {
  label: string;
  value: string;
  autoComplete: string;
  show: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  onBlur?: () => void;
  hint?: React.ReactNode;
  hintTone?: "default" | "error" | "success";
  required?: boolean;
  disabled?: boolean;
  reserveHintSpace?: boolean;
}) {
  return (
    <Field label={label} hint={hint} hintTone={hintTone} required={required} reserveHintSpace={reserveHintSpace}>
      <div className="password-field">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button
          type="button"
          className="password-toggle-button"
          tabIndex={-1}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          title={show ? "Hide password" : "Show password"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggle}
          disabled={disabled}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {show ? null : <path d="M4 4 20 20" />}
          </svg>
        </button>
      </div>
    </Field>
  );
}

function AvatarEditor({
  state,
  disabled,
  onModeChange,
  onUrlChange,
  onUpload,
}: {
  state: AvatarEditorState;
  disabled: boolean;
  onModeChange: (mode: AvatarEditorState["mode"]) => void;
  onUrlChange: (value: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const previewSrc = state.mode === "upload" ? state.dataUrl : state.url.trim() || null;

  return (
    <div className="surface-panel-strong rounded-[1rem] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Avatar</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={state.mode === "url" ? "primary-button" : "secondary-button"} onClick={() => onModeChange("url")} disabled={disabled}>
              Avatar URL
            </button>
            <button type="button" className={state.mode === "upload" ? "primary-button" : "secondary-button"} onClick={() => onModeChange("upload")} disabled={disabled}>
              Upload image
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-white/12 bg-slate-950/70">
            {previewSrc ? <img className="h-full w-full object-cover" src={previewSrc} alt="Avatar preview" /> : <span className="text-xs uppercase tracking-[0.18em] text-slate-400">None</span>}
          </div>
        </div>
      </div>

      {state.mode === "url" ? (
        <div className="mt-4">
          <Field label="Avatar URL">
            <input value={state.url} onChange={(event) => onUrlChange(event.currentTarget.value)} placeholder="https://example.com/avatar.png" disabled={disabled} />
          </Field>
        </div>
      ) : (
        <div className="mt-4">
          <Field label="Upload image">
            <FilePicker
              accept={AVATAR_UPLOAD_ACCEPT}
              selectedFileName={state.fileName}
              onChange={onUpload}
              disabled={disabled}
            />
          </Field>
          <p className="mt-2 text-xs text-slate-400">
            {formatMediaUploadGuidance(avatarUploadPolicy, { optional: true })}
          </p>
        </div>
      )}
    </div>
  );
}

function TitleNameHeading({
  title,
  id,
  level,
  className,
  imageClassName,
}: {
  title: CatalogTitleResponse["title"];
  id?: string;
  level: "h1" | "h2";
  className: string;
  imageClassName: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoAsset = getTitleLogoAsset(title);
  const HeadingTag = level;

  return (
    <HeadingTag id={id} className={className}>
      {logoAsset && !logoFailed ? (
        <img
          className={imageClassName}
          src={logoAsset.sourceUrl}
          alt={logoAsset.altText ?? `${title.displayName} logo`}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        title.displayName
      )}
    </HeadingTag>
  );
}

function StudioCard({ studio }: { studio: StudioSummary | DeveloperStudioSummary }) {
  const avatarUrl = getStudioAvatarImageUrl(studio);
  return (
    <article className="app-panel overflow-hidden p-0">
      <div
        className="min-h-48 bg-cover bg-center"
        style={studio.bannerUrl ? { backgroundImage: `url('${studio.bannerUrl}')` } : { backgroundImage: getFallbackGradient(studio.description) }}
      >
        <div className="h-full bg-[linear-gradient(120deg,rgba(8,10,18,0.88),rgba(8,10,18,0.52),rgba(8,10,18,0.82))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              {"role" in studio ? <div className="eyebrow">{formatMembershipRole(studio.role)}</div> : <div className="eyebrow">Studio</div>}
              <h3 className="font-display text-2xl font-bold text-white">{studio.displayName}</h3>
              <p className="max-w-xl text-sm leading-7 text-slate-300">{studio.description ?? "No studio summary yet."}</p>
            </div>
            {avatarUrl ? (
              <img className="h-16 w-16 rounded-[1rem] border border-white/10 object-cover" src={avatarUrl} alt={`${studio.displayName} avatar`} />
            ) : null}
          </div>
          <div className="mt-5">
            <Link className="secondary-button" to={`/studios/${studio.slug}`}>
              Open studio
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function TitlePlayerActionButtons({
  visible,
  isBusy,
  isWishlisted,
  isOwned,
  isReported,
  canReport,
  compact,
  onToggleWishlist,
  onToggleOwned,
  onReport,
}: {
  visible: boolean;
  isBusy: boolean;
  isWishlisted: boolean;
  isOwned: boolean;
  isReported: boolean;
  canReport: boolean;
  compact?: boolean;
  onToggleWishlist: () => void;
  onToggleOwned: () => void;
  onReport: () => void;
}) {
  if (!visible) {
    return null;
  }

  const sizeClass = compact ? "h-11 w-11" : "h-11 w-11";
  const baseClass = `${sizeClass} inline-flex items-center justify-center rounded-full border text-slate-100 transition disabled:cursor-not-allowed disabled:opacity-50`;
  const getButtonClass = (active: boolean) =>
    `${baseClass} ${active ? "border-cyan-300/55 bg-cyan-300/18 text-cyan-50" : "border-white/15 bg-slate-950/65 hover:border-cyan-300/55 hover:text-cyan-100"} backdrop-blur-sm`;

  function handleAction(event: React.MouseEvent<HTMLButtonElement>, action: () => void): void {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap gap-3"}>
      <button
        className={getButtonClass(isWishlisted)}
        type="button"
        title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        onClick={(event) => handleAction(event, onToggleWishlist)}
        disabled={isBusy}
      >
        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${isWishlisted ? "fill-current stroke-[1.6]" : "fill-none stroke-2"} stroke-current`} aria-hidden="true">
          <path d="M12 21 4.7 13.8a4.9 4.9 0 0 1 6.9-6.9L12 7.3l.4-.4a4.9 4.9 0 0 1 6.9 6.9Z" />
        </svg>
      </button>
      <button
        className={getButtonClass(isOwned)}
        type="button"
        title={isOwned ? "Remove from my games" : "Add to my games"}
        aria-label={isOwned ? "Remove from my games" : "Add to my games"}
        onClick={(event) => handleAction(event, onToggleOwned)}
        disabled={isBusy}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
          {isOwned ? (
            <path d="m5 12 4.2 4.2L19 6.5" />
          ) : (
            <>
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </>
          )}
        </svg>
      </button>
      <button
        className={getButtonClass(isReported)}
        type="button"
        title={canReport ? "Report title" : "Report already submitted"}
        aria-label={canReport ? "Report title" : "Report already submitted"}
        onClick={(event) => handleAction(event, onReport)}
        disabled={isBusy || !canReport}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
          <path d="M6 3v18" />
          <path d="M6 4h9l-1.5 3L15 10H6" />
        </svg>
      </button>
    </div>
  );
}

function isKnownStudioLink(url: string): boolean {
  return tryGetStudioLinkIconKey(url) !== null;
}

function tryGetStudioLinkIconKey(url: string): string | null {
  try {
    const uri = new URL(url);
    const host = uri.host.toLowerCase();
    if (host.includes("linkedin.com")) {
      return "linkedin";
    }
    if (host === "x.com" || host.endsWith(".x.com") || host.includes("twitter.com")) {
      return "x";
    }
    if (host.includes("discord.com") || host.includes("discord.gg")) {
      return "discord";
    }
    if (host.includes("facebook.com")) {
      return "facebook";
    }
    if (host.includes("instagram.com")) {
      return "instagram";
    }
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      return "youtube";
    }
    if (host.includes("github.com")) {
      return "github";
    }
  } catch {
    return null;
  }

  return null;
}

function StudioLinkIcon({ url }: { url: string }) {
  const iconKey = tryGetStudioLinkIconKey(url);
  switch (iconKey) {
    case "linkedin":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M4.98 3.5a2.48 2.48 0 1 1 0 4.96 2.48 2.48 0 0 1 0-4.96ZM3 9h4v12H3Zm7 0h3.83v1.64h.05c.53-1.01 1.84-2.08 3.79-2.08C21.73 8.56 24 10.6 24 15v6h-4v-5.32c0-1.27-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21h-4Z" /></svg>;
    case "x":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M18.9 2H22l-6.78 7.74L23 22h-6.1l-4.78-6.26L6.64 22H3.53l7.25-8.29L1 2h6.25l4.33 5.71L18.9 2Zm-1.07 18h1.69L6.33 3.9H4.52Z" /></svg>;
    case "discord":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.56 3l-.24.49a18.3 18.3 0 0 1 4.44 1.36 15.7 15.7 0 0 0-15.52 0A18.3 18.3 0 0 1 8.68 3.5L8.44 3A19.8 19.8 0 0 0 3.68 4.37C.67 8.91-.14 13.33.27 17.69A19.9 19.9 0 0 0 6.13 20.6l1.26-1.72a12.7 12.7 0 0 1-1.98-.95l.47-.37c3.83 1.8 7.98 1.8 11.76 0l.47.37c-.63.38-1.29.7-1.98.95l1.26 1.72a19.9 19.9 0 0 0 5.86-2.91c.49-5.05-.83-9.44-2.93-13.32ZM9.54 15.07c-1.15 0-2.09-1.06-2.09-2.36s.93-2.36 2.09-2.36c1.17 0 2.1 1.06 2.09 2.36 0 1.3-.93 2.36-2.09 2.36Zm4.92 0c-1.15 0-2.09-1.06-2.09-2.36s.93-2.36 2.09-2.36c1.17 0 2.1 1.06 2.09 2.36 0 1.3-.92 2.36-2.09 2.36Z" /></svg>;
    case "facebook":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.87.25-1.46 1.49-1.46H16.7V5.02A23.2 23.2 0 0 0 14.14 4.9c-2.53 0-4.26 1.55-4.26 4.4V11H7v3h2.88v8Z" /></svg>;
    case "instagram":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5Zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5Zm5.25-3.1a1.1 1.1 0 1 1-1.1 1.1 1.1 1.1 0 0 1 1.1-1.1Z" /></svg>;
    case "youtube":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.4.58A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.12c1.86.58 9.4.58 9.4.58s7.54 0 9.4-.58a3 3 0 0 0 2.1-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.7V8.3l6.4 3.7-6.4 3.7Z" /></svg>;
    case "github":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M12 .5A12 12 0 0 0 8.2 23.9c.6.1.82-.26.82-.58v-2.03c-3.34.73-4.04-1.41-4.04-1.41-.55-1.4-1.34-1.78-1.34-1.78-1.1-.75.08-.74.08-.74 1.2.09 1.84 1.24 1.84 1.24 1.08 1.84 2.83 1.31 3.52 1 .1-.78.42-1.31.76-1.61-2.67-.31-5.47-1.34-5.47-5.94 0-1.31.47-2.39 1.24-3.23-.12-.31-.54-1.56.12-3.25 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.69.24 2.94.12 3.25.77.84 1.24 1.92 1.24 3.23 0 4.61-2.81 5.62-5.49 5.92.43.38.82 1.11.82 2.24v3.32c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm6.9 9h-3.13a15.6 15.6 0 0 0-1.16-5.01A8.03 8.03 0 0 1 18.9 11ZM12 4.04c.83 1.1 1.83 3.29 2.15 6.96H9.85C10.17 7.33 11.17 5.14 12 4.04ZM4.1 13h3.13a15.6 15.6 0 0 0 1.16 5.01A8.03 8.03 0 0 1 4.1 13Zm3.13-2H4.1a8.03 8.03 0 0 1 4.29-5.01A15.6 15.6 0 0 0 7.23 11Zm2.62 2h4.3c-.32 3.67-1.32 5.86-2.15 6.96-.83-1.1-1.83-3.29-2.15-6.96Zm0-2c.32-3.67 1.32-5.86 2.15-6.96.83 1.1 1.83 3.29 2.15 6.96Zm4.76 7.01A15.6 15.6 0 0 0 15.77 13h3.13a8.03 8.03 0 0 1-4.29 5.01Z" /></svg>;
  }
}

function TitleCard({
  title,
  onOpenQuickView,
  playerActions,
}: {
  title: CatalogTitleSummary;
  onOpenQuickView?: (title: CatalogTitleSummary) => void;
  playerActions?: {
    visible: boolean;
    isBusy: boolean;
    isWishlisted: boolean;
    isOwned: boolean;
    isReported: boolean;
    canReport: boolean;
    onToggleWishlist: () => void;
    onToggleOwned: () => void;
    onReport: () => void;
  };
}) {
  const [cardImageFailed, setCardImageFailed] = useState(false);
  const [logoImageFailed, setLogoImageFailed] = useState(false);
  const fallbackArtworkUrl = getFallbackArtworkUrl(title);
  const cardImageUrl = !cardImageFailed && title.cardImageUrl ? title.cardImageUrl : fallbackArtworkUrl;
  const logoImageUrl = !logoImageFailed && title.logoImageUrl ? title.logoImageUrl : null;
  const genreTags = parseGenreTags(title.genreDisplay);
  const panelClassName = logoImageUrl ? "browse-title-card-panel browse-title-card-panel-logo" : "browse-title-card-panel";
  const availabilityNote = getCatalogTitleAvailabilityNote(title);
  const cardBody = (
    <div className="relative flex h-full flex-col justify-end">
      <div className="absolute inset-0 overflow-hidden">
        <img
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.045] group-hover:brightness-105 group-hover:saturate-[1.08] group-focus-within:scale-[1.045] group-focus-within:brightness-105 group-focus-within:saturate-[1.08]"
          src={cardImageUrl}
          alt=""
          aria-hidden="true"
          onError={() => setCardImageFailed(true)}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_30%),linear-gradient(180deg,rgba(7,9,14,0.02),rgba(7,9,14,0.07)_44%,rgba(7,9,14,0.22)_100%)]" />
      <div className="pointer-events-none absolute -left-10 top-0 h-40 w-48 -translate-x-8 bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.14),rgba(255,255,255,0))] opacity-0 blur-2xl transition duration-500 ease-out group-hover:translate-x-10 group-hover:opacity-60 group-focus-within:translate-x-10 group-focus-within:opacity-60" />
      {title.isReported ? (
        <div className="absolute left-3 top-3 z-20">
          <div
            className="inline-flex size-10 items-center justify-center rounded-full border border-amber-200/35 bg-amber-300/18 text-amber-100/85 shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm"
            role="img"
            aria-label="Reported title"
            title="Title has been reported"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M12 3 1.8 20.5h20.4Zm0 4.25 6.3 10.8H5.7Zm-1 2.85v4.45h2V10.1Zm0 5.8v2h2v-2Z" />
            </svg>
          </div>
        </div>
      ) : null}
      <div className="relative p-3 md:p-4">
        <div className={panelClassName}>
          <div className="flex min-h-[3.75rem] items-center">
            {logoImageUrl ? (
              <img
                className="max-h-14 w-auto max-w-full object-contain"
                src={logoImageUrl}
                alt={`${title.displayName} logo`}
                onError={() => setLogoImageFailed(true)}
              />
            ) : (
              <div className="text-[1.85rem] font-bold leading-tight text-white">{title.displayName}</div>
            )}
          </div>
          <div className="overflow-hidden transition-all duration-300 ease-out max-h-0 translate-y-2 opacity-0 group-hover:mt-3 group-hover:max-h-44 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:mt-3 group-focus-within:max-h-44 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/75">{title.studioDisplayName}</div>
            <div className="mt-3 flex flex-nowrap gap-2 overflow-hidden text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-cyan-100/85">
              <span className="shrink-0 rounded-full border border-white/15 px-3 py-1">{formatContentKindLabel(title.contentKind)}</span>
              <span className="shrink-0 rounded-full border border-white/15 px-3 py-1">{title.playerCountDisplay}</span>
            </div>
            <p
              className="mt-4 text-sm leading-6 text-slate-200"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {title.shortDescription}
            </p>
            {availabilityNote ? (
              <div className="mt-3 inline-flex rounded-full border border-amber-200/30 bg-amber-300/12 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-50">
                {availabilityNote}
              </div>
            ) : null}
            <div className="mt-3 flex flex-nowrap gap-2 overflow-hidden">
              {genreTags.map((tag) => (
                <span key={tag} className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-100">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <article className="app-panel group relative min-h-[26rem] overflow-hidden p-0 text-left transition duration-300 hover:-translate-y-1.5 hover:border-cyan-300/35 focus-within:-translate-y-1.5 focus-within:border-cyan-300/35">
      {playerActions ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20">
          <div className="pointer-events-auto">
            <TitlePlayerActionButtons
              visible={playerActions.visible}
              compact
              isBusy={playerActions.isBusy}
              isWishlisted={playerActions.isWishlisted}
              isOwned={playerActions.isOwned}
              isReported={playerActions.isReported}
              canReport={playerActions.canReport}
              onToggleWishlist={playerActions.onToggleWishlist}
              onToggleOwned={playerActions.onToggleOwned}
              onReport={playerActions.onReport}
            />
          </div>
        </div>
      ) : null}
      {onOpenQuickView ? (
        <button className="block h-full w-full text-left" type="button" aria-label={title.displayName} onClick={() => onOpenQuickView(title)}>
          {cardBody}
        </button>
      ) : (
        <Link className="block h-full w-full text-left" aria-label={title.displayName} to={`/browse/${title.studioSlug}/${title.slug}`}>
          {cardBody}
        </Link>
      )}
    </article>
  );
}

function PlayerRangeField({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}) {
  const minPercent = ((minValue - PLAYER_FILTER_MIN) / (PLAYER_FILTER_MAX - PLAYER_FILTER_MIN)) * 100;
  const maxPercent = ((maxValue - PLAYER_FILTER_MIN) / (PLAYER_FILTER_MAX - PLAYER_FILTER_MIN)) * 100;

  return (
    <div className="space-y-2 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-300">
          <span className="mr-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/85">Players</span>
          <span>{formatPlayerFilterSummary(minValue, maxValue)}</span>
        </div>
      </div>
      <div className="dual-range">
        <div className="dual-range-track" />
        <div className="dual-range-fill" style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }} />
        <input
          className="dual-range-input"
          type="range"
          min={PLAYER_FILTER_MIN}
          max={PLAYER_FILTER_MAX}
          step={1}
          value={minValue}
          aria-label="Minimum players"
          onChange={(event) => onMinChange(Number(event.currentTarget.value))}
        />
        <input
          className="dual-range-input"
          type="range"
          min={PLAYER_FILTER_MIN}
          max={PLAYER_FILTER_MAX}
          step={1}
          value={maxValue}
          aria-label="Maximum players"
          onChange={(event) => onMaxChange(Number(event.currentTarget.value))}
        />
      </div>
      <div className="flex items-center justify-between text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span>{PLAYER_FILTER_MIN}</span>
        <span>{PLAYER_FILTER_MAX}+</span>
      </div>
    </div>
  );
}

function CompactTitleList({
  titles,
  emptyTitle,
  emptyDetail,
  onOpenQuickView,
}: {
  titles: CatalogTitleSummary[];
  emptyTitle: string;
  emptyDetail: string;
  onOpenQuickView?: (title: CatalogTitleSummary) => void;
}) {
  if (titles.length === 0) {
    return <EmptyState title={emptyTitle} detail={emptyDetail} />;
  }

  return (
    <div className="list-stack">
      {titles.map((title) => (
        <article key={title.id} className="list-item">
          <div>
            <strong>{title.displayName}</strong>
            <p>
              {title.studioDisplayName} · {title.playerCountDisplay} · {formatContentKindLabel(title.contentKind)}
            </p>
            {getCatalogTitleAvailabilityNote(title) ? <p className="mt-1 text-sm text-amber-200">{getCatalogTitleAvailabilityNote(title)}</p> : null}
          </div>
          <div className="button-row compact">
            {onOpenQuickView ? (
              <button className="secondary-button" type="button" onClick={() => onOpenQuickView(title)}>
                Quick view
              </button>
            ) : (
              <Link className="secondary-button" to={`/browse/${title.studioSlug}/${title.slug}`}>
                Open title
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function PlayerReportList({
  reports,
  selectedReportId,
  onSelect,
}: {
  reports: PlayerTitleReportSummary[];
  selectedReportId: string | null;
  onSelect: (reportId: string) => void;
}) {
  if (reports.length === 0) {
    return <EmptyState title="No reported titles" detail="Reports you submit from title pages will appear here." />;
  }

  return (
    <div className="list-stack">
      {reports.map((report) => (
        <button
          key={report.id}
          type="button"
          className={report.id === selectedReportId ? "list-item border-cyan-300/45 bg-cyan-300/10 text-left" : "list-item text-left"}
          onClick={() => onSelect(report.id)}
        >
          <div>
            <strong>{report.titleDisplayName}</strong>
            <p>
              {formatReportStatus(report.status)} · {formatTimestamp(report.updatedAt)}
            </p>
          </div>
          <div className="status-chip">{formatReportStatus(report.status)}</div>
        </button>
      ))}
    </div>
  );
}

function ModerationReportList({
  reports,
  selectedReportId,
  onSelect,
}: {
  reports: TitleReportSummary[];
  selectedReportId: string | null;
  onSelect: (reportId: string) => void;
}) {
  if (reports.length === 0) {
    return <EmptyState title="No reports need review" detail="Open player reports will appear here for moderators." />;
  }

  return (
    <div className="list-stack">
      {reports.map((report) => (
        <button
          key={report.id}
          type="button"
          className={report.id === selectedReportId ? "list-item border-cyan-300/45 bg-cyan-300/10 text-left" : "list-item text-left"}
          onClick={() => onSelect(report.id)}
        >
          <div>
            <strong>{report.titleDisplayName}</strong>
            <p>
              {report.reporterDisplayName ?? report.reporterUserName ?? report.reporterEmail ?? "Unknown reporter"} · {formatTimestamp(report.updatedAt)}
            </p>
          </div>
          <div className="status-chip">{formatReportStatus(report.status)}</div>
        </button>
      ))}
    </div>
  );
}

function TitleReportConversation({
  detail,
  viewerRole,
}: {
  detail: TitleReportDetail;
  viewerRole: "player" | "developer" | "moderator";
}) {
  const visibleMessages = detail.messages.filter((message) => canViewTitleReportMessageAudience(message.audience, viewerRole));

  return (
    <div className="list-stack">
      <article className="list-item">
        <div>
          <strong>{detail.report.titleDisplayName}</strong>
          <p>
            {detail.report.studioDisplayName} · {formatReportStatus(detail.report.status)} · opened {formatTimestamp(detail.report.createdAt)}
          </p>
        </div>
        <div className="status-chip">{formatReportStatus(detail.report.status)}</div>
      </article>

      <section className="surface-panel-soft rounded-[1rem] p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Original report</div>
        <p className="mt-3 text-sm leading-7 text-slate-300">{detail.report.reason}</p>
        {detail.resolutionNote ? (
          <div className="surface-panel-soft mt-4 rounded-[1rem] p-4 text-sm text-slate-300">
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Resolution note</div>
            <p className="mt-2">{detail.resolutionNote}</p>
          </div>
        ) : null}
      </section>

      {visibleMessages.length > 0 ? (
        <div className="list-stack">
          {visibleMessages.map((message) => (
            <article key={message.id} className="surface-panel-soft rounded-[1rem] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">
                  {message.authorDisplayName ?? message.authorUserName ?? message.authorEmail ?? message.authorSubject}
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
                  {formatMembershipRole(message.authorRole)} · {formatAudienceLabel(message.audience)}
                </div>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{message.message}</p>
              <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">{formatTimestamp(message.createdAt)}</div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No conversation yet" detail="Messages from players, developers, and moderators will appear here." />
      )}
    </div>
  );
}

function LandingShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true);
  const lastMobileScrollY = useRef(0);

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const targetId = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [location.hash, location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    let animationFrameId: number | null = null;

    const resetHeaderVisibility = () => {
      lastMobileScrollY.current = window.scrollY;
      setMobileHeaderVisible(true);
    };

    const updateHeaderVisibility = () => {
      animationFrameId = null;

      if (!mediaQuery.matches) {
        lastMobileScrollY.current = window.scrollY;
        setMobileHeaderVisible(true);
        return;
      }

      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastMobileScrollY.current;

      if (currentScrollY <= 8) {
        setMobileHeaderVisible(true);
      } else if (Math.abs(delta) >= 6) {
        setMobileHeaderVisible(delta < 0);
      }

      lastMobileScrollY.current = currentScrollY;
    };

    const handleScroll = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateHeaderVisibility);
    };

    const handleViewportChange = () => {
      resetHeaderVisibility();
    };

    resetHeaderVisibility();

    window.addEventListener("scroll", handleScroll, { passive: true });
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleViewportChange);
    } else {
      mediaQuery.addListener(handleViewportChange);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleViewportChange);
      } else {
        mediaQuery.removeListener(handleViewportChange);
      }
    };
  }, []);

  return (
    <div className="app-root landing-root">
      <header className={`app-header landing-header ${mobileHeaderVisible ? "is-visible" : "is-hidden"}`}>
        <div className="app-header-inner">
          <Link to="/" className="app-brand">
            <img className="app-brand-mark" src="/favicon_sm.png" alt="Board Enthusiasts logo" />
            <div>
              <div className="app-brand-title">Board Enthusiasts</div>
              <div className="app-brand-subtitle">For Board Players And Builders</div>
            </div>
          </Link>

          <nav className="app-nav" aria-label="Landing">
            <a href={landingBoardUrl} className="app-nav-link" target="_blank" rel="noreferrer">Get Board</a>
            <LandingUpdatesLink className="app-nav-link">Get Updates</LandingUpdatesLink>
          </nav>

          <div className="app-header-actions">
            <a className="secondary-button" href={landingDiscordUrl} target="_blank" rel="noreferrer">
              Join Discord
            </a>
          </div>
        </div>

        <nav className="app-mobile-nav" aria-label="Landing mobile">
          <a href={landingBoardUrl} className="app-nav-link" target="_blank" rel="noreferrer">Get Board</a>
          <LandingUpdatesLink className="app-nav-link">Get Updates</LandingUpdatesLink>
        </nav>
      </header>

      <main className="app-main landing-main">
        <div className="page-shell">{children}</div>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <div className="landing-footer-copy-block">
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Independent and community-built.</div>
            <div>Board Enthusiasts is a community project supporting Board players and builders.</div>
          </div>
          <div className="app-footer-links">
            <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>
            <a href={landingBoardUrl} target="_blank" rel="noreferrer">Get Board</a>
            <Link to={landingPrivacyRoute}>Privacy</Link>
          </div>
          <div className="landing-footer-copyright">© {currentYear} Matt Stroman | <a href="https://mattstroman.com" target="_blank" rel="noreferrer">Portfolio</a> | <a href="https://www.linkedin.com/in/mattstromandev/" target="_blank" rel="noreferrer">LinkedIn</a></div>
        </div>
        <div className="landing-footer-disclaimer-row">
          <div className="landing-footer-disclaimer">
            Board Enthusiasts is an independent community project and is not affiliated with, endorsed by, or sponsored by Harris Hill Products, Inc. or Board.
          </div>
        </div>
      </footer>
    </div>
  );
}

function LandingUpdatesLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const location = useLocation();
  const href = location.pathname === "/" ? "#signup" : landingSignupRoute;

  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.369A19.79 19.79 0 0 0 15.438 3c-.211.375-.458.88-.628 1.274a18.27 18.27 0 0 0-5.62 0A13.74 13.74 0 0 0 8.56 3 19.736 19.736 0 0 0 3.68 4.37C.59 9.04-.246 13.595.172 18.084A19.9 19.9 0 0 0 6.16 21c.484-.665.915-1.37 1.287-2.11a12.85 12.85 0 0 1-2.024-.977c.17-.126.336-.257.497-.392 3.905 1.836 8.14 1.836 11.998 0 .166.135.332.266.497.392a12.9 12.9 0 0 1-2.03.98c.372.739.803 1.444 1.287 2.109a19.86 19.86 0 0 0 5.99-2.916c.49-5.2-.837-9.714-3.346-13.715ZM8.02 15.332c-1.18 0-2.15-1.085-2.15-2.42 0-1.335.951-2.42 2.15-2.42 1.208 0 2.17 1.094 2.15 2.42 0 1.335-.951 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.085-2.15-2.42 0-1.335.951-2.42 2.15-2.42 1.208 0 2.17 1.094 2.15 2.42 0 1.335-.942 2.42-2.15 2.42Z" />
    </svg>
  );
}

function DiscordIconButton({ className = "app-icon-button" }: { className?: string }) {
  return (
    <a className={className} href={landingDiscordUrl} target="_blank" rel="noreferrer" aria-label="Join the Board Enthusiasts Discord">
      <DiscordIcon className="size-5" />
    </a>
  );
}

function LandingGlyph({ kind }: { kind: "discord" | "library" | "spark" | "toolkit" }) {
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
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v11.5a2.5 2.5 0 0 1-2.5 2.5H7a3 3 0 0 1-3-3V6.5Zm3 1.25A1.25 1.25 0 0 0 5.75 9v8A1.75 1.75 0 0 0 7.5 18.75H17a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1H6.5A1.5 1.5 0 0 0 5 7v.2c.46-.29 1-.45 1.59-.45H17v1.5H7Z"
          fill="currentColor"
        />
      </svg>
    );
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

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6 4h3v3H6V4Zm9 0h3v3h-3V4ZM6 17h3v3H6v-3Zm9 0h3v3h-3v-3ZM10.5 6.5h3v3h-3v-3Zm0 8h3v3h-3v-3Zm-4-4h11v3h-11v-3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function buildLandingSupportIssuePayload(firstName: string, email: string, errorMessage: string) {
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

function useDocumentMetadata({
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

function LandingPage() {
  useDocumentMetadata({
    title: landingMetadata.defaultTitle,
    description: landingMetadata.defaultDescription,
    canonicalUrl: landingMetadata.defaultCanonical,
  });

  const landingSignupDraft = readSessionStorageJson<Partial<LandingSignupDraftState>>(LANDING_SIGNUP_DRAFT_STORAGE_KEY);
  const [firstName, setFirstName] = useState(landingSignupDraft?.firstName ?? "");
  const [email, setEmail] = useState(landingSignupDraft?.email ?? "");
  const [consented, setConsented] = useState(landingSignupDraft?.consented ?? false);
  const [playerInterestSelected, setPlayerInterestSelected] = useState(landingSignupDraft?.playerInterestSelected ?? false);
  const [developerInterestSelected, setDeveloperInterestSelected] = useState(landingSignupDraft?.developerInterestSelected ?? false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileWidgetStatus>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [technicalErrorDetails, setTechnicalErrorDetails] = useState<string | null>(null);
  const [reportingIssue, setReportingIssue] = useState(false);
  const [issueReportStatusMessage, setIssueReportStatusMessage] = useState<string | null>(null);
  const [showManualIssueFallback, setShowManualIssueFallback] = useState(false);
  const emailError = validateEmailInput(email);
  const captchaMode = getCaptchaMode(appConfig.turnstileSiteKey);
  const requiresTurnstile = captchaMode !== "disabled";
  const canSubmitSignup = !submitting && !emailError && consented;

  useEffect(() => {
    const hasDraft =
      firstName.trim().length > 0 ||
      email.trim().length > 0 ||
      consented ||
      playerInterestSelected ||
      developerInterestSelected;

    if (!hasDraft) {
      removeSessionStorageJson(LANDING_SIGNUP_DRAFT_STORAGE_KEY);
      return;
    }

    writeSessionStorageJson(LANDING_SIGNUP_DRAFT_STORAGE_KEY, {
      firstName,
      email,
      consented,
      playerInterestSelected,
      developerInterestSelected,
    } satisfies LandingSignupDraftState);
  }, [consented, developerInterestSelected, email, firstName, playerInterestSelected]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (emailError || !consented || submitting) {
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    setTechnicalErrorDetails(null);
    setIssueReportStatusMessage(null);
    setShowManualIssueFallback(false);
    try {
      if (requiresTurnstile && !turnstileToken) {
        setErrorMessage(
          turnstileStatus === "error"
            ? "The anti-spam check is unavailable right now. Refresh the page or disable content blockers and try again."
            : "Please complete the anti-spam check below and try again.",
        );
        return;
      }

      const roleInterests = [
        ...(playerInterestSelected ? ["player" as const] : []),
        ...(developerInterestSelected ? ["developer" as const] : []),
      ];
      const response = await createMarketingSignup(appConfig.apiBaseUrl, {
        email,
        firstName: firstName.trim() || null,
        source: landingSignupSource,
        consentTextVersion: landingConsentTextVersion,
        turnstileToken,
        roleInterests,
      });
      setStatusMessage(
        response.duplicate
          ? "You are already on the list. We will keep you posted as new BE resources and early access invites roll out."
          : "You are on the list. We will send updates when early access and new BE resources are ready.",
      );
      setEmail("");
      setFirstName("");
      setConsented(false);
      setPlayerInterestSelected(false);
      setDeveloperInterestSelected(false);
      setTurnstileToken(null);
      removeSessionStorageJson(LANDING_SIGNUP_DRAFT_STORAGE_KEY);
    } catch (error) {
      setErrorMessage("We couldn't submit your signup right now. Please try again, or report the issue and we'll help you out.");
      setTechnicalErrorDetails(error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReportIssue(): Promise<void> {
    if (reportingIssue) {
      return;
    }

    setReportingIssue(true);
    setIssueReportStatusMessage(null);
    setShowManualIssueFallback(false);
    try {
      await createSupportIssueReport(
        appConfig.apiBaseUrl,
        {
          ...buildLandingSupportIssuePayload(
          firstName,
          email,
          errorMessage ?? "Landing page signup submission failed.",
          ),
          technicalDetails: technicalErrorDetails,
        },
      );
      setErrorMessage(null);
      setIssueReportStatusMessage("Issue report sent. We'll take a look.");
    } catch {
      setErrorMessage(null);
      setIssueReportStatusMessage("We couldn't send the issue report automatically right now.");
      setShowManualIssueFallback(true);
    } finally {
      setReportingIssue(false);
    }
  }

  return (
    <div className="landing-shell page-grid">
      <section className="landing-hero">
        <div className="landing-hero-column">
          <div className="hero-panel landing-hero-panel">
            <div className="landing-hero-copy">
              <h1><i>BE</i> where the Board community shows up first.</h1>
              <p>
                Join the community forming around Board, explore useful BE resources, and get early access to the upcoming third-party library.
              </p>
            </div>
            <div className="landing-hero-footer">
              <div className="hero-actions">
                <a className="primary-button" href={landingDiscordUrl} target="_blank" rel="noreferrer">Join Discord</a>
                <LandingUpdatesLink className="secondary-button">Get Updates</LandingUpdatesLink>
                <a className="landing-text-link" href={landingBoardUrl} target="_blank" rel="noreferrer">Visit Board</a>
              </div>
              <p className="landing-hero-note">
                For official Board news, hardware, and platform information, visit <a href={landingBoardUrl} target="_blank" rel="noreferrer">board.fun</a>.
              </p>
            </div>
          </div>

          <article className="app-panel landing-about-card">
            <div className="eyebrow">About BE</div>
            <h2>Built to support the Board community.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Board Enthusiasts is a community project supporting Board players and builders. It is not officially affiliated with nor endorsed by the Board team or Harris Hill Products, Inc.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Currently built and maintained by Matt Stroman. Questions, collaboration ideas, or contribution interest? Email <a href="mailto:contact@boardenthusiasts.com">contact@boardenthusiasts.com</a> or reach out in the <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>.
            </p>
          </article>

          <article className="app-panel landing-promo-card">
            <div className="eyebrow">Why join now</div>
            <h2>BE where the Board community shows up first.</h2>
            <ul className="landing-promo-list" aria-label="Reasons to join early">
              <li>See new third-party releases as they start to surface.</li>
              <li>Get early access when the BE Library opens up.</li>
              <li>Follow the tools and resources growing around Board.</li>
            </ul>
          </article>
        </div>

        <div className="landing-hero-rail">
          <article className="landing-showcase-card landing-showcase-card-spotlight landing-feature-card">
            <div className="landing-icon-badge" aria-hidden="true">
              <LandingGlyph kind="library" />
            </div>
            <div className="eyebrow">Coming soon</div>
            <h2>One place to discover third-party Board games and apps.</h2>
            <p>
              The BE Library is taking shape as the shared home where players can find new releases in one place and developers can register where the community is already looking.
            </p>
            <div className="landing-feature-list">
              <div className="landing-feature-item">
                <strong>Players</strong>
                <span>Discover and collect new third-party Board content in one place.</span>
              </div>
              <div className="landing-feature-item">
                <strong>Developers</strong>
                <span>Show up where players are browsing, following launches, and deciding what to install next.</span>
              </div>
            </div>
            <div className="card-actions mt-5">
              <LandingUpdatesLink className="secondary-button">Get Early Updates</LandingUpdatesLink>
            </div>
          </article>
          <article id="signup" className="landing-showcase-card landing-signup-card">
            <div className="eyebrow">Get early access</div>
            <h2>BE there when the Library opens.</h2>
            <p>
              Join the BE list for launch updates, early invites, community announcements, and new resources for Board players and developers.
            </p>
            <form className="mt-6 stack-form" onSubmit={(event) => void handleSubmit(event)}>
              <div className="form-grid">
                <Field label="First name (optional)" reserveHintSpace={false}>
                  <input value={firstName} onChange={(event) => setFirstName(event.currentTarget.value)} placeholder="Taylor" disabled={submitting} />
                </Field>
                <Field label="Email" hint={emailError ?? undefined} hintTone={emailError ? "error" : "default"} required>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.currentTarget.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={submitting}
                  />
                </Field>
              </div>

              <div className="eyebrow">
                Email updates <span aria-hidden="true" className="field-required-marker">*</span>
              </div>
              <label className="landing-consent">
                <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.currentTarget.checked)} disabled={submitting} />
                <span>I want email updates from Board Enthusiasts about launch progress, new BE resources, community announcements, and future invites.</span>
              </label>

              <fieldset className="landing-role-interest-group">
                <legend className="eyebrow">Interested in</legend>
                <label className="landing-consent">
                  <input
                    type="checkbox"
                    checked={playerInterestSelected}
                    onChange={(event) => setPlayerInterestSelected(event.currentTarget.checked)}
                    disabled={submitting}
                  />
                  <span>I want to discover and follow new Board games and apps.</span>
                </label>
                <label className="landing-consent">
                  <input
                    type="checkbox"
                    checked={developerInterestSelected}
                    onChange={(event) => setDeveloperInterestSelected(event.currentTarget.checked)}
                    disabled={submitting}
                  />
                  <span>I want to create third-party content for Board.</span>
                </label>
              </fieldset>

              <CaptchaWidget
                mode={captchaMode}
                siteKey={appConfig.turnstileSiteKey}
                token={turnstileToken}
                onTokenChange={setTurnstileToken}
                onStatusChange={setTurnstileStatus}
              />

              {statusMessage ? <p className="success-text">{statusMessage}</p> : null}
              {errorMessage ? (
                <p className="error-text">
                  {errorMessage}{" "}
                  <button type="button" className="landing-inline-button" onClick={() => void handleReportIssue()} disabled={reportingIssue}>
                    {reportingIssue ? "Reporting..." : "Report the issue"}
                  </button>
                </p>
              ) : null}
              {issueReportStatusMessage ? (
                <p className={issueReportStatusMessage.includes("couldn't") ? "error-text" : "success-text"}>
                  {issueReportStatusMessage}
                  {showManualIssueFallback ? (
                    <>
                      {" "}
                      <a className="landing-inline-link" href={landingSupportMailtoHref}>
                        Email support instead
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}

              <div className="button-row">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!canSubmitSignup}
                >
                  {submitting ? "Joining..." : "Join the list"}
                </button>
                <Link to={landingPrivacyRoute} className="secondary-button">
                  Privacy
                </Link>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Questions, collaboration ideas, or contribution interest? Email <a href="mailto:contact@boardenthusiasts.com">contact@boardenthusiasts.com</a> or join the <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>.
              </p>
            </form>
          </article>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <h2>Start now. BE part of what launches next.</h2>
          <p>Board Enthusiasts already has places to plug in today while the library and broader platform surface keep taking shape.</p>
        </div>
        <div className="landing-card-grid">
          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="discord" />
                </div>
                <div>
                  <div className="eyebrow">Community</div>
                  <h2>BE Discord</h2>
                </div>
              </div>
              <span className="status-chip">Available now</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
                Join early builders and players shaping the Board ecosystem. Share projects, ask questions, and help the community grow together.
            </p>
            <div className="card-actions mt-5">
              <a className="secondary-button" href={landingDiscordUrl} target="_blank" rel="noreferrer">Join Discord</a>
            </div>
          </article>
          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="spark" />
                </div>
                <div>
                  <div className="eyebrow">Resource</div>
                  <h2>BE GPT</h2>
                </div>
              </div>
              <span className="status-chip">Available now</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A Board-focused assistant for players and developers, with guidance drawn from official Board docs, FAQ, and troubleshooting resources.
            </p>
            <div className="card-actions mt-5">
              <a className="secondary-button" href={landingGptUrl} target="_blank" rel="noreferrer">Open GPT</a>
            </div>
          </article>
          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="library" />
                </div>
                <div>
                  <div className="eyebrow">Utility</div>
                  <h2>BE App Launcher for Board</h2>
                </div>
              </div>
              <span className="status-chip">Available now</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A Board app that lets users view and open all of their sideloaded titles, so once a title is installed there is no USB cable or terminal required to launch it on Board.
            </p>
            <div className="card-actions mt-5">
              <a className="secondary-button" href="https://discord.gg/wqdcusHUKM" target="_blank" rel="noreferrer">Learn More</a>
            </div>
          </article>
          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="toolkit" />
                </div>
                <div>
                  <div className="eyebrow">Developer tool</div>
                  <h2>BE Emulator for Board</h2>
                </div>
              </div>
              <span className="status-chip">Coming Soon</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              An emulator for the Board OS used in the Unity editor to show the screens Board would show for SDK calls, making it easier to test titles in-editor without building and deploying to target as often.
            </p>
            <div className="card-actions mt-5">
              <LandingUpdatesLink className="secondary-button">Get Updates</LandingUpdatesLink>
            </div>
          </article>
          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="toolkit" />
                </div>
                <div>
                  <div className="eyebrow">In progress</div>
                  <h2>BE GDK for Board</h2>
                </div>
              </div>
              <span className="status-chip">Coming Soon</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A companion toolkit for the official Board SDK currently in development, with workflow helpers, editor tools, and higher-level systems designed to help developers focus on the game.
            </p>
            <div className="card-actions mt-5">
              <LandingUpdatesLink className="secondary-button">Get Updates</LandingUpdatesLink>
            </div>
          </article>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-board-note">
          <div className="eyebrow">Official source</div>
          <p>
            Looking for official Board news, hardware, or platform information? Visit <a href={landingBoardUrl} target="_blank" rel="noreferrer">board.fun</a>.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <div className="eyebrow">Why BE</div>
          <h2>Built to help the Board ecosystem connect and grow.</h2>
          <p>BE is meant to be useful right away for supporting and growing the Board community, while also giving players and developers a reason to get involved early.</p>
        </div>
        <div className="landing-card-grid">
          <article className="app-panel p-6 landing-value-card">
            <div className="eyebrow">For Players</div>
            <h2>Follow what is being built</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Find community, track new third-party releases, and get ready for one place to discover more of what is happening around Board.
            </p>
          </article>
          <article className="app-panel p-6 landing-value-card">
            <div className="eyebrow">For Developers</div>
            <h2>Show up where the community is looking</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Connect with players and fellow builders, share progress, explore practical resources, and be ready to register where discovery is taking shape.
            </p>
          </article>
          <article className="app-panel p-6 landing-value-card">
            <div className="eyebrow">For The Ecosystem</div>
            <h2>Community, tools, and momentum around Board</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              BE exists to support the growing Board community by helping players and developers connect, collaborate, and stay engaged.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

function LandingPrivacyPage() {
  useDocumentMetadata({
    title: landingMetadata.privacyTitle,
    description: landingMetadata.privacyDescription,
    canonicalUrl: landingMetadata.privacyCanonical,
  });

  return (
    <div className="page-grid narrow">
      <section className="app-panel p-6">
        <div className="eyebrow">Privacy</div>
        <h1 className="app-page-title">Board Enthusiasts Privacy Snapshot</h1>
        <p className="mt-4 text-base leading-8 text-slate-300">
          Board Enthusiasts currently collects only the information needed to run this launch-updates signup flow and respond to direct contact requests.
        </p>
        <div className="mt-6 list-stack">
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>What we collect</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">Email address, optional first name, signup source metadata, consent timestamp, and anti-abuse verification data.</p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>Why we collect it</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">To send Board Enthusiasts launch updates, future invite emails, developer resources, and basic project announcements.</p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>Who processes it</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">Cloudflare, Supabase, and Brevo support the current hosted site, signup system, and email delivery workflow.</p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>How to reach us</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">Send privacy or contact requests to <a href="mailto:contact@boardenthusiasts.com">contact@boardenthusiasts.com</a>.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function LivePrivacyPage() {
  useDocumentMetadata({
    title: liveMetadata.privacyTitle,
    description: liveMetadata.privacyDescription,
    canonicalUrl: liveMetadata.privacyCanonical,
  });

  return (
    <div className="page-grid narrow">
      <section className="app-panel p-6">
        <h1 className="app-page-title">BE Privacy Snapshot</h1>
        <p className="mt-4 text-base leading-8 text-slate-300">
          BE currently collects the information needed to create and secure accounts, run the live library and workspace flows, process developer submissions, and respond to contact or support requests.
        </p>
        <div className="mt-6 list-stack">
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>What we collect</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Account email, username, authentication records managed by Supabase Auth, optional profile fields, player library and wishlist activity, title reports and messages, developer-submitted studio or title or release data, uploaded media metadata, and support or contact request details.
            </p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>Why we collect it</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              To run the BE Library, support sign-in and recovery, power player and developer workflows, operate moderation paths, send direct responses when you contact us, and maintain optional BE communications where offered.
            </p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>Who processes it</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Cloudflare, Supabase, and Brevo support the live BE web experience, account and storage systems, and any direct email delivery workflows still in use.
            </p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>How to reach us</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Send privacy or contact requests to <a href="mailto:contact@boardenthusiasts.com">contact@boardenthusiasts.com</a>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { session, currentUser, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const accessToken = session?.access_token ?? "";
  const homeShell = location.pathname === "/";
  const browseActive = isBrowsePath(location.pathname);
  const installActive = location.pathname.startsWith("/install-guide");
  const showSignedInSections = Boolean(session && currentUser);
  const accountReady = Boolean(currentUser);
  const showModerateSection = currentUser ? hasPlatformRole(currentUser.roles, "moderator") : false;
  const avatarInitials = getInitials(currentUser?.displayName ?? currentUser?.email);
  const signInHref = `/auth/signin?returnTo=${encodeURIComponent(location.pathname)}`;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const unreadNotificationCount = notifications.filter((notification) => !notification.isRead).length;
  const showDeveloperSection = currentUser ? hasPlatformRole(currentUser.roles, "developer") : false;

  function navLinkClass(active: boolean): string {
    return active ? "app-nav-link active" : "app-nav-link";
  }

  function closeOverlays(): void {
    setUserMenuOpen(false);
    setNotificationsOpen(false);
  }

  function navigateToAndClose(path: string): void {
    closeOverlays();
    navigate(path);
  }

  async function loadNotifications(): Promise<void> {
    if (!accessToken) {
      setNotifications([]);
      setNotificationError(null);
      return;
    }

    setNotificationsLoading(true);
    setNotificationError(null);
    try {
      const response = await getCurrentUserNotifications(appConfig.apiBaseUrl, accessToken);
      setNotifications([...response.notifications].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
    } catch (nextError) {
      setNotificationError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function toggleNotifications(): Promise<void> {
    setUserMenuOpen(false);
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) {
      await loadNotifications();
    }
  }

  async function openNotification(notification: UserNotification): Promise<void> {
    if (!notification.isRead && accessToken) {
      try {
        const response = await markCurrentUserNotificationRead(appConfig.apiBaseUrl, accessToken, notification.id);
        setNotifications((current) =>
          current
            .map((candidate) => (candidate.id === response.notification.id ? response.notification : candidate))
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
        );
      } catch {
        // Keep navigation resilient even if the read mutation fails.
      }
    }

    setNotificationsOpen(false);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  }

  useEffect(() => {
    if (!accessToken) {
      setNotifications([]);
      setNotificationError(null);
      setNotificationsLoading(false);
      return;
    }

    void loadNotifications();
  }, [accessToken]);

  return (
    <div className={homeShell ? "app-root landing-root" : "app-root"}>
      {userMenuOpen || notificationsOpen ? (
        <button className="fixed inset-0 z-40 cursor-default bg-transparent" type="button" aria-label="Close navigation menus" onClick={closeOverlays} />
      ) : null}
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="app-brand">
            <img className="app-brand-mark" src="/favicon_sm.png" alt="Board Enthusiasts logo" />
            <div>
              <div className="app-brand-title">Board Enthusiasts</div>
              <div className="app-brand-subtitle">For Board Players And Builders</div>
            </div>
          </Link>

          <nav className="app-nav" aria-label="Primary">
            <Link to="/browse" className={navLinkClass(browseActive)}>
              Browse
            </Link>
            {showSignedInSections ? (
              <>
                <NavLink to="/player" className={({ isActive }) => navLinkClass(isActive)}>
                  Play
                </NavLink>
                <NavLink to="/develop" className={({ isActive }) => navLinkClass(isActive)}>
                  Develop
                </NavLink>
                {showModerateSection ? (
                  <NavLink to="/moderate" className={({ isActive }) => navLinkClass(isActive)}>
                    Moderate
                  </NavLink>
                ) : null}
              </>
            ) : null}
            {!homeShell ? (
              <NavLink to="/install-guide" className={({ isActive }) => navLinkClass(isActive || installActive)}>
                Install
              </NavLink>
            ) : null}
            <a href={landingBoardUrl} className="app-nav-link" target="_blank" rel="noreferrer">
              Get Board
            </a>
          </nav>

          <div className="app-header-actions">
            <DiscordIconButton />

            {session ? (
              <>
                <div className="relative">
                  <button className="app-icon-button relative" type="button" aria-label="Open notifications" onClick={() => void toggleNotifications()}>
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 17a2.5 2.5 0 0 0 5 0" />
                    </svg>
                    {unreadNotificationCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 text-[0.62rem] font-black leading-none text-slate-950">
                        {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                      </span>
                    ) : null}
                  </button>
                  {notificationsOpen ? (
                    <section className="absolute right-0 z-50 mt-3 w-[min(92vw,24rem)] overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#111017] shadow-[0_28px_70px_rgba(0,0,0,0.48)]">
                      <div className="flex items-center justify-between gap-3 p-4">
                        <div>
                          <div className="text-sm font-semibold text-white">Notifications</div>
                          <div className="text-xs text-slate-400">
                            {notifications.length === 0 ? "No recent activity" : `${notifications.length} recent item${notifications.length === 1 ? "" : "s"}`}
                          </div>
                        </div>
                        {unreadNotificationCount > 0 ? (
                          <div className="rounded-full border border-amber-200/30 bg-amber-300/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-100">
                            {unreadNotificationCount} unread
                          </div>
                        ) : null}
                      </div>
                      <div className="border-t border-white/10" />
                      {notificationsLoading ? (
                        <div className="space-y-3 p-4">
                          <div className="h-14 animate-pulse rounded-[1rem] bg-white/10" />
                          <div className="h-14 animate-pulse rounded-[1rem] bg-white/10" />
                          <div className="h-14 animate-pulse rounded-[1rem] bg-white/10" />
                        </div>
                      ) : notificationError ? (
                        <div className="p-4 text-sm leading-7 text-rose-100">{notificationError}</div>
                      ) : notifications.length === 0 ? (
                        <div className="p-4 text-sm leading-7 text-slate-300">No notifications yet.</div>
                      ) : (
                        <div className="max-h-[28rem] overflow-y-auto p-2">
                          {notifications.map((notification) => (
                            <button
                              key={notification.id}
                              className={notification.isRead ? "block w-full rounded-[1rem] border border-transparent px-3 py-3 text-left text-slate-300 transition hover:bg-white/5" : "block w-full rounded-[1rem] border border-cyan-300/20 bg-cyan-300/8 px-3 py-3 text-left text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/12"}
                              type="button"
                              onClick={() => void openNotification(notification)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white">{notification.title}</div>
                                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-cyan-100/70">{formatNotificationCategory(notification.category)}</div>
                                </div>
                                {!notification.isRead ? <span className="mt-1 inline-flex size-2.5 shrink-0 rounded-full bg-amber-300" /> : null}
                              </div>
                              <div className="mt-2 line-clamp-2 text-sm text-slate-300">{notification.body}</div>
                              <div className="mt-2 text-xs text-slate-500">{formatNotificationTimestamp(notification.createdAt)}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    className={`app-avatar-link ${accountReady ? "" : "pointer-events-none opacity-70"}`}
                    type="button"
                    disabled={!accountReady}
                    aria-label={loading || !accountReady ? "Loading account" : `Open account for ${formatRoles(currentUser)}`}
                    onClick={() => { setNotificationsOpen(false); setUserMenuOpen((current) => !current); }}
                  >
                    {renderCurrentUserAvatar(currentUser, loading, avatarInitials)}
                  </button>
                  {userMenuOpen && currentUser ? (
                    <section className="absolute right-0 z-50 mt-3 w-[min(92vw,21rem)] overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#111017] shadow-[0_28px_70px_rgba(0,0,0,0.48)]">
                      <div className="flex items-center gap-3 p-4">
                        <div className="grid size-12 place-items-center overflow-hidden rounded-full bg-slate-800 text-sm font-bold text-slate-100">
                          {renderCurrentUserAvatar(currentUser, false, avatarInitials)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{currentUser.displayName ?? currentUser.email ?? "Account"}</div>
                          <div className="truncate text-xs text-slate-300">{currentUser.email ?? "Signed-in account"}</div>
                        </div>
                      </div>
                      <div className="border-t border-white/10" />
                      <nav className="p-2 text-sm text-slate-200">
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player?workflow=account-profile")}>Profile</button>
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player")}>My Games</button>
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player/wishlist")}>Wishlist</button>
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player?workflow=reported-titles")}>Reported Titles</button>
                      </nav>
                      {showDeveloperSection ? (
                        <>
                          <div className="border-t border-white/10" />
                          <nav className="p-2 text-sm text-slate-200">
                            <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/develop")}>Developer Console</button>
                          </nav>
                        </>
                      ) : null}
                      {showModerateSection ? (
                        <>
                          <div className="border-t border-white/10" />
                          <nav className="p-2 text-sm text-slate-200">
                            <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/moderate")}>Moderate</button>
                          </nav>
                        </>
                      ) : null}
                      <div className="border-t border-white/10" />
                      <nav className="p-2 text-sm text-slate-200">
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player?workflow=account-settings")}>Account Settings</button>
                      </nav>
                      <div className="border-t border-white/10" />
                      <nav className="p-2 text-sm text-slate-200">
                        <Link className="block rounded-xl px-3 py-2 text-rose-100 transition hover:bg-rose-400/20" to="/auth/signout?returnTo=%2Fbrowse" onClick={closeOverlays}>
                          Sign Out
                        </Link>
                      </nav>
                    </section>
                  ) : null}
                </div>
              </>
            ) : (
              <Link to={signInHref} className="app-auth-link">
                Sign In
              </Link>
            )}
          </div>
        </div>

        <div className="app-mobile-nav" aria-label="Primary mobile">
          <Link to="/browse" className={`${navLinkClass(browseActive)} whitespace-nowrap`}>
            Browse
          </Link>
          {showSignedInSections ? (
            <>
              <NavLink to="/player" className={({ isActive }) => `${navLinkClass(isActive)} whitespace-nowrap`}>
                Play
              </NavLink>
              <NavLink to="/develop" className={({ isActive }) => `${navLinkClass(isActive)} whitespace-nowrap`}>
                Develop
              </NavLink>
              {showModerateSection ? (
                <NavLink to="/moderate" className={({ isActive }) => `${navLinkClass(isActive)} whitespace-nowrap`}>
                  Moderate
                </NavLink>
              ) : null}
            </>
          ) : null}
          {!homeShell ? (
            <NavLink to="/install-guide" className={({ isActive }) => `${navLinkClass(isActive || installActive)} whitespace-nowrap`}>
              Install
            </NavLink>
          ) : null}
          <a href={landingBoardUrl} className={`${navLinkClass(false)} whitespace-nowrap`} target="_blank" rel="noreferrer">
            Get Board
          </a>
        </div>
      </header>

      <main className={homeShell ? "app-main landing-main" : "app-main"}>
        <div className="page-shell">{children}</div>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <div className="landing-footer-copy-block">
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Independent and community-built.</div>
            <div>Board Enthusiasts is a community project supporting Board players and builders.</div>
          </div>
          <div className="app-footer-links">
            <Link to="/browse">Browse</Link>
            <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>
            <a href={landingBoardUrl} target="_blank" rel="noreferrer">Get Board</a>
            <Link to="/privacy">Privacy</Link>
            {showSignedInSections ? (
              <>
                <Link to="/player">Play</Link>
                <Link to="/player/wishlist">Wishlist</Link>
                <Link to="/player?workflow=reported-titles">Reported Titles</Link>
                <Link to="/develop">Develop</Link>
                {showModerateSection ? <Link to="/moderate">Moderate</Link> : null}
                <Link to="/player?workflow=account-profile">Account</Link>
              </>
            ) : null}
            {!homeShell ? <Link to="/install-guide">Install</Link> : null}
          </div>
          <div className="landing-footer-copyright">
            © {currentYear} Matt Stroman | <a href="https://mattstroman.com" target="_blank" rel="noreferrer">Portfolio</a> | <a href="https://www.linkedin.com/in/mattstromandev/" target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </div>
        <div className="landing-footer-disclaimer-row">
          <div className="landing-footer-disclaimer">
            Board Enthusiasts is an independent community project and is not affiliated with, endorsed by, or sponsored by Harris Hill Products, Inc. or Board.
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProtectedRoute({
  requiredRole,
  children,
}: {
  requiredRole: "player" | "developer" | "moderator";
  children: React.ReactNode;
}) {
  const { session, currentUser, loading, authError } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPanel title="Checking session..." />;
  }

  if (!session || !currentUser) {
    return <Navigate to={`/auth/signin?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!hasPlatformRole(currentUser.roles, requiredRole)) {
    return (
      <ErrorPanel
        title="Access not available"
        detail={authError ?? `You are signed in, but the ${requiredRole} workspace is not available to this account.`}
      />
    );
  }

  return <>{children}</>;
}

function HomePage() {
  useDocumentMetadata({
    title: liveMetadata.homeTitle,
    description: liveMetadata.homeDescription,
    canonicalUrl: liveMetadata.homeCanonical,
  });

  return (
    <div className="landing-shell page-grid">
      <section className="landing-hero">
        <div className="landing-hero-column">
          <div className="hero-panel landing-hero-panel">
            <div className="landing-hero-copy">
              <h1>BE where the Board community shows up first.</h1>
              <p>
                Join the community forming around Board, explore useful BE resources, and browse the live BE Library as it grows.
              </p>
            </div>
            <div className="landing-hero-footer">
              <div className="hero-actions">
                <Link className="primary-button" to="/browse">Browse Library</Link>
                <a className="secondary-button" href={landingBoardUrl} target="_blank" rel="noreferrer">Get Board</a>
                <DiscordIconButton />
              </div>
              <p className="landing-hero-note">
                For official Board news, hardware, and platform information, visit <a href={landingBoardUrl} target="_blank" rel="noreferrer">board.fun</a>.
              </p>
            </div>
          </div>

          <article className="app-panel landing-about-card">
            <h2>Built to support the Board community.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Board Enthusiasts is a community project supporting Board players and builders. It is not officially affiliated with nor endorsed by the Board team or Harris Hill Products, Inc.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Currently built and maintained by Matt Stroman. Questions, collaboration ideas, or contribution interest? Email <a href="mailto:contact@boardenthusiasts.com">contact@boardenthusiasts.com</a> or reach out in the <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>.
            </p>
          </article>

          <article className="app-panel landing-promo-card">
            <h2>BE where the Board community shows up first.</h2>
            <ul className="landing-promo-list" aria-label="Reasons to use BE now">
              <li>See new third-party releases as they start to surface.</li>
              <li>Browse the live BE Library as it keeps growing.</li>
              <li>Follow the tools and resources growing around Board.</li>
            </ul>
          </article>
        </div>

        <div className="landing-hero-rail">
          <article className="landing-showcase-card landing-showcase-card-spotlight landing-feature-card">
            <h2 className="!mt-0">One place to discover third-party Board games and apps.</h2>
            <p>
              The BE Library is live as the shared home where players can find new releases in one place and developers can register where the community is already looking.
            </p>
            <div className="landing-feature-list">
              <div className="landing-feature-item">
                <strong>Players</strong>
                <span>Discover and collect new third-party Board content in one place.</span>
              </div>
              <div className="landing-feature-item">
                <strong>Developers</strong>
                <span>Show up where players are browsing, following launches, and deciding what to install next.</span>
              </div>
            </div>
            <div className="card-actions mt-5">
              <Link className="secondary-button" to="/browse">Browse Library</Link>
            </div>
          </article>

          <article className="landing-showcase-card landing-signup-card">
            <h2>Start now. BE part of what launches next.</h2>
            <p>
              Browse the live BE Library, plug into the community, and keep the rest of the BE toolset close while the broader platform surface keeps taking shape.
            </p>
            <div className="landing-feature-list">
              <div className="landing-feature-item">
                <strong>Browse</strong>
                <span>Discover new Board games and apps from the community catalog.</span>
              </div>
              <div className="landing-feature-item">
                <strong>Play</strong>
                <span>Track your library, wishlist, and account activity in one place after signing in.</span>
              </div>
              <div className="landing-feature-item">
                <strong>Build</strong>
                <span>Manage studios, titles, media, and releases from the developer side when you are ready.</span>
              </div>
            </div>
            <div className="button-row mt-6">
              <Link className="primary-button" to="/browse">Browse Library</Link>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Questions, collaboration ideas, or contribution interest? Email <a href="mailto:contact@boardenthusiasts.com">contact@boardenthusiasts.com</a> or join the <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <h2>Start now. BE part of what launches next.</h2>
          <p>Board Enthusiasts already has places to plug in today while the live BE Library and broader platform surface keep taking shape.</p>
        </div>
        <div className="landing-card-grid">
          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="library" />
                </div>
                <div>
                  <div className="eyebrow">Library</div>
                  <h2>BE Library</h2>
                </div>
              </div>
              <span className="status-chip">Available now</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              The shared home for browsing third-party Board games and apps, with player and developer flows ready when you sign in.
            </p>
            <div className="card-actions mt-5">
              <Link className="secondary-button" to="/browse">Browse Library</Link>
            </div>
          </article>

          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="discord" />
                </div>
                <div>
                  <div className="eyebrow">Community</div>
                  <h2>BE Discord</h2>
                </div>
              </div>
              <span className="status-chip">Available now</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Join early builders and players shaping the Board ecosystem. Share projects, ask questions, and help the community grow together.
            </p>
            <div className="card-actions mt-5">
              <a className="secondary-button" href={landingDiscordUrl} target="_blank" rel="noreferrer">Join Discord</a>
            </div>
          </article>

          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="spark" />
                </div>
                <div>
                  <div className="eyebrow">Resource</div>
                  <h2>BE GPT</h2>
                </div>
              </div>
              <span className="status-chip">Available now</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A Board-focused assistant for players and developers, with guidance drawn from official Board docs, FAQ, and troubleshooting resources.
            </p>
            <div className="card-actions mt-5">
              <a className="secondary-button" href={landingGptUrl} target="_blank" rel="noreferrer">Open GPT</a>
            </div>
          </article>

          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="library" />
                </div>
                <div>
                  <div className="eyebrow">Utility</div>
                  <h2>BE App Launcher for Board</h2>
                </div>
              </div>
              <span className="status-chip">Available now</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A Board app that lets users view and open all of their sideloaded titles, so once a title is installed there is no USB cable or terminal required to launch it on Board.
            </p>
            <div className="card-actions mt-5">
              <a className="secondary-button" href="https://discord.gg/wqdcusHUKM" target="_blank" rel="noreferrer">Learn More</a>
            </div>
          </article>

          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="toolkit" />
                </div>
                <div>
                  <div className="eyebrow">Developer tool</div>
                  <h2>BE Emulator for Board</h2>
                </div>
              </div>
              <span className="status-chip">Coming Soon</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              An emulator for the Board OS used in the Unity editor to show the screens Board would show for SDK calls, making it easier to test titles in-editor without building and deploying to target as often.
            </p>
            <div className="card-actions mt-5">
              <a className="secondary-button" href={landingDiscordUrl} target="_blank" rel="noreferrer">Get Updates</a>
            </div>
          </article>

          <article className="app-panel p-6 landing-offering-card">
            <div className="landing-offering-heading-row">
              <div className="landing-offering-heading-group">
                <div className="landing-icon-badge" aria-hidden="true">
                  <LandingGlyph kind="toolkit" />
                </div>
                <div>
                  <div className="eyebrow">In progress</div>
                  <h2>BE GDK for Board</h2>
                </div>
              </div>
              <span className="status-chip">Coming Soon</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A companion toolkit for the official Board SDK currently in development, with workflow helpers, editor tools, and higher-level systems designed to help developers focus on the game.
            </p>
            <div className="card-actions mt-5">
              <a className="secondary-button" href={landingDiscordUrl} target="_blank" rel="noreferrer">Get Updates</a>
            </div>
          </article>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-board-note">
          <p>
            Looking for official Board news, hardware, or platform information? Visit <a href={landingBoardUrl} target="_blank" rel="noreferrer">board.fun</a>.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <h2>Built to help the Board ecosystem connect and grow.</h2>
          <p>BE is meant to be useful right away for supporting and growing the Board community, while also giving players and developers a reason to get involved early.</p>
        </div>
        <div className="landing-card-grid">
          <article className="app-panel p-6 landing-offering-card">
            <h2>For Players</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Find community, track new third-party releases, and get ready for one place to discover more of what is happening around Board.
            </p>
          </article>

          <article className="app-panel p-6 landing-offering-card">
            <h2>For Developers</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Connect with players and fellow builders, share progress, explore practical resources, and be ready to register where discovery is taking shape.
            </p>
          </article>

          <article className="app-panel p-6 landing-offering-card">
            <h2>For the Ecosystem</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              BE exists to support the growing Board community by helping players and developers connect, collaborate, and stay engaged.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

function BrowsePage() {
  const { session, currentUser } = useAuth();
  const accessToken = session?.access_token ?? "";
  const playerAccessEnabled = currentUser ? hasPlatformRole(currentUser.roles, "player") : false;
  const [studios, setStudios] = useState<StudioSummary[]>([]);
  const [titles, setTitles] = useState<CatalogTitleSummary[]>([]);
  const [query, setQuery] = useState("");
  const [contentKind, setContentKind] = useState("all");
  const [sort, setSort] = useState("title-asc");
  const [resultsPerPage, setResultsPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudios, setSelectedStudios] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [minPlayersFilter, setMinPlayersFilter] = useState(1);
  const [maxPlayersFilter, setMaxPlayersFilter] = useState(8);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerStateLoading, setPlayerStateLoading] = useState(false);
  const [ownedTitleIds, setOwnedTitleIds] = useState<Set<string>>(new Set());
  const [wishlistedTitleIds, setWishlistedTitleIds] = useState<Set<string>>(new Set());
  const [reportedTitleIds, setReportedTitleIds] = useState<Set<string>>(new Set());
  const [busyTitleIds, setBusyTitleIds] = useState<Set<string>>(new Set());
  const [playerActionErrorMessage, setPlayerActionErrorMessage] = useState<string | null>(null);
  const [playerActionStatusMessage, setPlayerActionStatusMessage] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; displayName: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(null);
  const [quickViewTarget, setQuickViewTarget] = useState<{ studioSlug: string; titleSlug: string } | null>(null);
  const deferredQuery = useDeferredValue(query);

  async function refreshPlayerState(): Promise<void> {
    if (!accessToken || !playerAccessEnabled) {
      setOwnedTitleIds(new Set());
      setWishlistedTitleIds(new Set());
      setReportedTitleIds(new Set());
      return;
    }

    setPlayerStateLoading(true);
    try {
      const [libraryResponse, wishlistResponse, reportsResponse] = await Promise.all([
        getPlayerLibrary(appConfig.apiBaseUrl, accessToken),
        getPlayerWishlist(appConfig.apiBaseUrl, accessToken),
        getPlayerTitleReports(appConfig.apiBaseUrl, accessToken),
      ]);
      setOwnedTitleIds(new Set(libraryResponse.titles.map((title) => title.id)));
      setWishlistedTitleIds(new Set(wishlistResponse.titles.map((title) => title.id)));
      setReportedTitleIds(new Set(reportsResponse.reports.map((report) => report.titleId)));
      setPlayerActionErrorMessage(null);
    } catch (nextError) {
      setPlayerActionErrorMessage(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setPlayerStateLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [studioResponse, catalogResponse] = await Promise.all([
          listPublicStudios(appConfig.apiBaseUrl),
          listCatalogTitles(appConfig.apiBaseUrl),
        ]);
        if (cancelled) {
          return;
        }

        setStudios(studioResponse.studios);
        setTitles(catalogResponse.titles);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshPlayerState();
  }, [accessToken, playerAccessEnabled]);

  const availableGenres = useMemo(
    () => Array.from(new Set(titles.flatMap((title) => parseGenreTags(title.genreDisplay)))).sort((left, right) => left.localeCompare(right)),
    [titles],
  );

  const visibleStudioEntries = useMemo(() => {
    const titleCountByStudio = titles.reduce<Map<string, number>>((counts, title) => {
      counts.set(title.studioSlug, (counts.get(title.studioSlug) ?? 0) + 1);
      return counts;
    }, new Map());

    return studios
      .map((studio) => ({
        slug: studio.slug,
        displayName: studio.displayName,
        titleCount: titleCountByStudio.get(studio.slug) ?? 0,
      }))
      .filter((studio) => studio.titleCount > 0)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [studios, titles]);

  const filteredTitles = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const effectiveMaxPlayersFilter = maxPlayersFilter >= PLAYER_FILTER_MAX ? Number.POSITIVE_INFINITY : maxPlayersFilter;
    const filtered = titles.filter((title) => {
      const matchesStudio = selectedStudios.length === 0 || selectedStudios.includes(title.studioSlug);
      const matchesGenre = selectedGenres.length === 0 || parseGenreTags(title.genreDisplay).some((tag) => selectedGenres.includes(tag));
      const matchesKind = contentKind === "all" || title.contentKind === contentKind;
      const matchesPlayerRange = title.maxPlayers >= minPlayersFilter && title.minPlayers <= effectiveMaxPlayersFilter;
      const matchesQuery =
        !normalizedQuery ||
        [title.displayName, title.shortDescription, title.genreDisplay, title.studioSlug, title.studioDisplayName].join(" ").toLowerCase().includes(normalizedQuery);
      return matchesStudio && matchesGenre && matchesKind && matchesPlayerRange && matchesQuery;
    });

    return [...filtered].sort((left, right) => {
      switch (sort) {
        case "title-desc":
          return right.displayName.localeCompare(left.displayName);
        case "studio-asc":
          return left.studioSlug.localeCompare(right.studioSlug);
        case "studio-desc":
          return right.studioSlug.localeCompare(left.studioSlug);
        case "genre-asc":
          return left.genreDisplay.localeCompare(right.genreDisplay);
        case "players-asc":
          return left.maxPlayers - right.maxPlayers;
        case "players-desc":
          return right.maxPlayers - left.maxPlayers;
        case "age-asc":
          return left.minAgeYears - right.minAgeYears;
        case "age-desc":
          return right.minAgeYears - left.minAgeYears;
        default:
          return left.displayName.localeCompare(right.displayName);
      }
    });
  }, [contentKind, deferredQuery, maxPlayersFilter, minPlayersFilter, selectedGenres, selectedStudios, sort, titles]);

  useEffect(() => {
    setCurrentPage(1);
  }, [contentKind, deferredQuery, maxPlayersFilter, minPlayersFilter, resultsPerPage, selectedGenres, selectedStudios, sort]);

  const normalizedResultsPerPage = resultsPerPage === "all" ? 0 : Number(resultsPerPage);
  const totalPages = normalizedResultsPerPage <= 0 ? 1 : Math.max(1, Math.ceil(filteredTitles.length / normalizedResultsPerPage));
  const pagedTitles =
    normalizedResultsPerPage <= 0 ? filteredTitles : filteredTitles.slice((currentPage - 1) * normalizedResultsPerPage, currentPage * normalizedResultsPerPage);
  const visibleResultStart =
    filteredTitles.length === 0 || pagedTitles.length === 0 ? 0 : normalizedResultsPerPage <= 0 ? 1 : (currentPage - 1) * normalizedResultsPerPage + 1;
  const visibleResultEnd = visibleResultStart === 0 ? 0 : visibleResultStart + pagedTitles.length - 1;

  function toggleStudio(studioSlug: string): void {
    setSelectedStudios((current) => (current.includes(studioSlug) ? current.filter((candidate) => candidate !== studioSlug) : [...current, studioSlug]));
  }

  function toggleGenre(genreTag: string): void {
    setSelectedGenres((current) => (current.includes(genreTag) ? current.filter((candidate) => candidate !== genreTag) : [...current, genreTag]));
  }

  function resetFilters(): void {
    setQuery("");
    setContentKind("all");
    setSort("title-asc");
    setResultsPerPage("10");
    setSelectedStudios([]);
    setSelectedGenres([]);
    setMinPlayersFilter(PLAYER_FILTER_MIN);
    setMaxPlayersFilter(PLAYER_FILTER_MAX);
    setCurrentPage(1);
  }

  function updateMinPlayersFilter(value: number): void {
    setMinPlayersFilter(Math.min(value, maxPlayersFilter));
  }

  function updateMaxPlayersFilter(value: number): void {
    setMaxPlayersFilter(Math.max(value, minPlayersFilter));
  }

  function markBusy(titleId: string, nextBusy: boolean): void {
    setBusyTitleIds((current) => {
      const next = new Set(current);
      if (nextBusy) {
        next.add(titleId);
      } else {
        next.delete(titleId);
      }
      return next;
    });
  }

  async function toggleWishlist(titleId: string, titleDisplayName: string): Promise<void> {
    if (!playerAccessEnabled) {
      return;
    }

    markBusy(titleId, true);
    setPlayerActionErrorMessage(null);
    setPlayerActionStatusMessage(null);
    try {
      if (wishlistedTitleIds.has(titleId)) {
        await removeTitleFromPlayerWishlist(appConfig.apiBaseUrl, accessToken, titleId);
        setWishlistedTitleIds((current) => {
          const next = new Set(current);
          next.delete(titleId);
          return next;
        });
        setPlayerActionStatusMessage(`${titleDisplayName} removed from wishlist.`);
      } else {
        await addTitleToPlayerWishlist(appConfig.apiBaseUrl, accessToken, titleId);
        setWishlistedTitleIds((current) => new Set(current).add(titleId));
        setPlayerActionStatusMessage(`${titleDisplayName} added to wishlist.`);
      }
    } catch (nextError) {
      setPlayerActionErrorMessage(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      markBusy(titleId, false);
    }
  }

  async function toggleOwned(titleId: string, titleDisplayName: string): Promise<void> {
    if (!playerAccessEnabled) {
      return;
    }

    markBusy(titleId, true);
    setPlayerActionErrorMessage(null);
    setPlayerActionStatusMessage(null);
    try {
      if (ownedTitleIds.has(titleId)) {
        await removeTitleFromPlayerLibrary(appConfig.apiBaseUrl, accessToken, titleId);
        setOwnedTitleIds((current) => {
          const next = new Set(current);
          next.delete(titleId);
          return next;
        });
        setPlayerActionStatusMessage(`${titleDisplayName} removed from My Games.`);
      } else {
        await addTitleToPlayerLibrary(appConfig.apiBaseUrl, accessToken, titleId);
        setOwnedTitleIds((current) => new Set(current).add(titleId));
        setPlayerActionStatusMessage(`${titleDisplayName} added to My Games.`);
      }
    } catch (nextError) {
      setPlayerActionErrorMessage(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      markBusy(titleId, false);
    }
  }

  function openReportModal(titleId: string, titleDisplayName: string): void {
    if (!playerAccessEnabled || reportedTitleIds.has(titleId)) {
      return;
    }

    setReportTarget({ id: titleId, displayName: titleDisplayName });
    setReportReason("");
    setReportErrorMessage(null);
  }

  async function submitReport(): Promise<void> {
    if (!reportTarget || reportSubmitting) {
      return;
    }

    setReportSubmitting(true);
    setPlayerActionErrorMessage(null);
    setPlayerActionStatusMessage(null);
    setReportErrorMessage(null);
    try {
      const response = await createPlayerTitleReport(appConfig.apiBaseUrl, accessToken, {
        titleId: reportTarget.id,
        reason: reportReason.trim(),
      });
      setReportedTitleIds((current) => new Set(current).add(response.report.titleId));
      setPlayerActionStatusMessage(`${reportTarget.displayName} has been reported for moderator review.`);
      setReportTarget(null);
      setReportReason("");
    } catch (nextError) {
      setReportErrorMessage(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <section className="space-y-8">
      {loading ? <LoadingPanel title="Loading browse surface..." /> : null}
      {error ? <ErrorPanel detail={error} /> : null}
      {!loading && !error ? (
        <>
          <section className="space-y-2">
            <h1 className="font-display text-3xl font-bold uppercase tracking-[0.08em] text-white">Browse</h1>
            <p className="text-sm leading-7 text-slate-300">Explore games and apps from the Board community.</p>
          </section>

          <section className="app-panel p-5">
            <div className="grid gap-3 xl:grid-cols-[2fr_0.85fr_0.85fr_auto]">
              <label className="text-sm text-slate-300">
                Search
                <input className="mt-2 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Title, studio, description" />
              </label>
              <label className="text-sm text-slate-300">
                Content kind
                <select className="mt-2 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100" value={contentKind} onChange={(event) => setContentKind(event.currentTarget.value)}>
                  <option value="all">Games and apps</option>
                  <option value="game">Games only</option>
                  <option value="app">Apps only</option>
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Sort
                <select className="mt-2 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100" value={sort} onChange={(event) => setSort(event.currentTarget.value)}>
                  <option value="title-asc">Title (A-Z)</option>
                  <option value="title-desc">Title (Z-A)</option>
                  <option value="studio-asc">Studio (A-Z)</option>
                  <option value="studio-desc">Studio (Z-A)</option>
                  <option value="genre-asc">Genre</option>
                  <option value="players-asc">Players (low-high)</option>
                  <option value="players-desc">Players (high-low)</option>
                  <option value="age-asc">Age rating (low-high)</option>
                  <option value="age-desc">Age rating (high-low)</option>
                </select>
              </label>
              <div className="flex items-end">
                <button className="secondary-button" type="button" onClick={resetFilters}>
                  Reset filters
                </button>
              </div>
            </div>

            {playerActionStatusMessage ? (
              <div className="mt-5 rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{playerActionStatusMessage}</div>
            ) : null}

            {playerActionErrorMessage ? (
              <div className="mt-5 rounded-[1rem] border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{playerActionErrorMessage}</div>
            ) : null}

            <div className="mt-5 space-y-3">
              <PlayerRangeField
                minValue={minPlayersFilter}
                maxValue={maxPlayersFilter}
                onMinChange={updateMinPlayersFilter}
                onMaxChange={updateMaxPlayersFilter}
              />

              <details className="surface-panel-soft rounded-[1.5rem] px-4 py-3 text-slate-200" open={selectedStudios.length > 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/85">
                  <span>Studios</span>
                  <span className="h-px flex-1 bg-white/10"></span>
                  <span className="text-[0.65rem] tracking-[0.16em] text-slate-400">{visibleStudioEntries.length} available</span>
                </summary>
                <div className="mt-4 flex flex-wrap gap-2">
                  {visibleStudioEntries.map((studio) => {
                    const selected = selectedStudios.includes(studio.slug);
                    return (
                      <button
                        key={studio.slug}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${selected ? "border-cyan-300/45 bg-cyan-300/15 text-cyan-50" : "border-white/15 text-slate-100 hover:border-cyan-300/45 hover:text-cyan-100"}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleStudio(studio.slug)}
                      >
                        {studio.displayName} ({studio.titleCount})
                      </button>
                    );
                  })}
                </div>
              </details>

              <details className="surface-panel-soft rounded-[1.5rem] px-4 py-3 text-slate-200" open={selectedGenres.length > 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/85">
                  <span>Genres</span>
                  <span className="h-px flex-1 bg-white/10"></span>
                  <span className="text-[0.65rem] tracking-[0.16em] text-slate-400">{availableGenres.length} available</span>
                </summary>
                <div className="mt-4 flex flex-wrap gap-2">
                  {availableGenres.map((genre) => {
                    const selected = selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${selected ? "border-cyan-300/45 bg-cyan-300/15 text-cyan-50" : "border-white/15 text-slate-100 hover:border-cyan-300/45 hover:text-cyan-100"}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleGenre(genre)}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </details>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-[0.08em] text-white">Search results</h2>
                <div className="mt-1 text-sm text-slate-400">Explore titles without leaving the catalog.</div>
              </div>
              <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                <label className="text-sm text-slate-300">
                  Results per page
                  <select className="ml-3 rounded-full border border-white/15 bg-slate-950/70 px-4 py-2 text-sm text-slate-100" value={resultsPerPage} onChange={(event) => setResultsPerPage(event.currentTarget.value)}>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="all">All</option>
                  </select>
                </label>
                {filteredTitles.length > 0 ? (
                  <div className="app-panel flex flex-wrap gap-3 p-4 text-sm">
                    <span>{filteredTitles.length} titles</span>
                    <span className="text-slate-500">•</span>
                    <span>{visibleStudioEntries.length} studios</span>
                    <span className="text-slate-500">•</span>
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {filteredTitles.length === 0 ? (
              <section className="app-panel p-6">
                <h3 className="text-xl font-semibold text-white">No titles match the current filters</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">Try clearing one or more filters to broaden the results.</p>
              </section>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {pagedTitles.map((title) => (
                    <TitleCard
                      key={title.id}
                      title={title}
                      onOpenQuickView={(selectedTitle) => setQuickViewTarget({ studioSlug: selectedTitle.studioSlug, titleSlug: selectedTitle.slug })}
                      playerActions={{
                        visible: playerAccessEnabled,
                        isBusy: playerStateLoading || busyTitleIds.has(title.id),
                        isWishlisted: wishlistedTitleIds.has(title.id),
                        isOwned: ownedTitleIds.has(title.id),
                        isReported: reportedTitleIds.has(title.id),
                        canReport: !reportedTitleIds.has(title.id),
                        onToggleWishlist: () => void toggleWishlist(title.id, title.displayName),
                        onToggleOwned: () => void toggleOwned(title.id, title.displayName),
                        onReport: () => openReportModal(title.id, title.displayName),
                      }}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button className={`secondary-button ${currentPage > 1 ? "" : "pointer-events-none opacity-40"}`} type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
                    Previous
                  </button>
                  <div className="text-sm text-slate-400">
                    Showing results {visibleResultStart} - {visibleResultEnd} of {filteredTitles.length}
                  </div>
                  <button className={`secondary-button ${currentPage < totalPages ? "" : "pointer-events-none opacity-40"}`} type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>
                    Next
                  </button>
                </div>
              </>
            )}
          </section>

          {quickViewTarget ? (
            <TitleQuickViewModal
              studioSlug={quickViewTarget.studioSlug}
              titleSlug={quickViewTarget.titleSlug}
              onClose={() => setQuickViewTarget(null)}
            />
          ) : null}
          {reportTarget ? (
            <ReportTitleModal
              titleDisplayName={reportTarget.displayName}
              reportReason={reportReason}
              reportErrorMessage={reportErrorMessage}
              submitting={reportSubmitting}
              onReportReasonChange={setReportReason}
              onClose={() => {
                setReportTarget(null);
                setReportReason("");
                setReportErrorMessage(null);
              }}
              onSubmit={() => void submitReport()}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function StudioDetailPage() {
  const { session, currentUser } = useAuth();
  const params = useParams<{ studioSlug: string }>();
  const studioSlug = params.studioSlug ?? "";
  const accessToken = session?.access_token ?? "";
  const playerAccessEnabled = currentUser ? hasPlatformRole(currentUser.roles, "player") : false;
  const [studio, setStudio] = useState<StudioSummary | null>(null);
  const [titles, setTitles] = useState<CatalogTitleSummary[]>([]);
  const [query, setQuery] = useState("");
  const [contentKind, setContentKind] = useState("all");
  const [sort, setSort] = useState("title-asc");
  const [resultsPerPage, setResultsPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerStateLoading, setPlayerStateLoading] = useState(false);
  const [ownedTitleIds, setOwnedTitleIds] = useState<Set<string>>(new Set());
  const [wishlistedTitleIds, setWishlistedTitleIds] = useState<Set<string>>(new Set());
  const [reportedTitleIds, setReportedTitleIds] = useState<Set<string>>(new Set());
  const [busyTitleIds, setBusyTitleIds] = useState<Set<string>>(new Set());
  const [playerActionErrorMessage, setPlayerActionErrorMessage] = useState<string | null>(null);
  const [playerActionStatusMessage, setPlayerActionStatusMessage] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; displayName: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(null);
  const [quickViewTarget, setQuickViewTarget] = useState<{ studioSlug: string; titleSlug: string } | null>(null);
  const deferredQuery = useDeferredValue(query);

  async function refreshPlayerState(): Promise<void> {
    if (!accessToken || !playerAccessEnabled) {
      setOwnedTitleIds(new Set());
      setWishlistedTitleIds(new Set());
      setReportedTitleIds(new Set());
      return;
    }

    setPlayerStateLoading(true);
    try {
      const [libraryResponse, wishlistResponse, reportsResponse] = await Promise.all([
        getPlayerLibrary(appConfig.apiBaseUrl, accessToken),
        getPlayerWishlist(appConfig.apiBaseUrl, accessToken),
        getPlayerTitleReports(appConfig.apiBaseUrl, accessToken),
      ]);
      setOwnedTitleIds(new Set(libraryResponse.titles.map((title) => title.id)));
      setWishlistedTitleIds(new Set(wishlistResponse.titles.map((title) => title.id)));
      setReportedTitleIds(new Set(reportsResponse.reports.map((report) => report.titleId)));
      setPlayerActionErrorMessage(null);
    } catch (nextError) {
      setPlayerActionErrorMessage(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setPlayerStateLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [studioResponse, catalogResponse] = await Promise.all([
          getPublicStudio(appConfig.apiBaseUrl, studioSlug),
          listCatalogTitles(appConfig.apiBaseUrl, { studioSlug }),
        ]);
        if (cancelled) {
          return;
        }

        setStudio(studioResponse.studio);
        setTitles(catalogResponse.titles);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [studioSlug]);

  useEffect(() => {
    void refreshPlayerState();
  }, [accessToken, playerAccessEnabled]);

  const availableGenres = useMemo(
    () => Array.from(new Set(titles.flatMap((title) => parseGenreTags(title.genreDisplay)))).sort((left, right) => left.localeCompare(right)),
    [titles],
  );

  const filteredTitles = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const filtered = titles.filter((title) => {
      const matchesGenre = selectedGenres.length === 0 || parseGenreTags(title.genreDisplay).some((tag) => selectedGenres.includes(tag));
      const matchesKind = contentKind === "all" || title.contentKind === contentKind;
      const matchesQuery =
        !normalizedQuery ||
        [title.displayName, title.shortDescription, title.genreDisplay].join(" ").toLowerCase().includes(normalizedQuery);
      return matchesGenre && matchesKind && matchesQuery;
    });

    return [...filtered].sort((left, right) => {
      switch (sort) {
        case "title-desc":
          return right.displayName.localeCompare(left.displayName);
        case "genre-asc":
          return left.genreDisplay.localeCompare(right.genreDisplay);
        case "players-asc":
          return left.maxPlayers - right.maxPlayers;
        case "players-desc":
          return right.maxPlayers - left.maxPlayers;
        case "age-asc":
          return left.minAgeYears - right.minAgeYears;
        case "age-desc":
          return right.minAgeYears - left.minAgeYears;
        default:
          return left.displayName.localeCompare(right.displayName);
      }
    });
  }, [contentKind, deferredQuery, selectedGenres, sort, titles]);

  useEffect(() => {
    setCurrentPage(1);
  }, [contentKind, deferredQuery, resultsPerPage, selectedGenres, sort, studioSlug]);

  const normalizedResultsPerPage = resultsPerPage === "all" ? 0 : Number(resultsPerPage);
  const totalPages = normalizedResultsPerPage <= 0 ? 1 : Math.max(1, Math.ceil(filteredTitles.length / normalizedResultsPerPage));
  const pagedTitles =
    normalizedResultsPerPage <= 0 ? filteredTitles : filteredTitles.slice((currentPage - 1) * normalizedResultsPerPage, currentPage * normalizedResultsPerPage);
  const visibleResultStart =
    filteredTitles.length === 0 || pagedTitles.length === 0 ? 0 : normalizedResultsPerPage <= 0 ? 1 : (currentPage - 1) * normalizedResultsPerPage + 1;
  const visibleResultEnd = visibleResultStart === 0 ? 0 : visibleResultStart + pagedTitles.length - 1;

  function toggleGenre(genreTag: string): void {
    setSelectedGenres((current) => (current.includes(genreTag) ? current.filter((candidate) => candidate !== genreTag) : [...current, genreTag]));
  }

  function resetFilters(): void {
    setQuery("");
    setContentKind("all");
    setSort("title-asc");
    setResultsPerPage("10");
    setSelectedGenres([]);
    setCurrentPage(1);
  }

  function markBusy(titleId: string, nextBusy: boolean): void {
    setBusyTitleIds((current) => {
      const next = new Set(current);
      if (nextBusy) {
        next.add(titleId);
      } else {
        next.delete(titleId);
      }
      return next;
    });
  }

  async function toggleWishlist(titleId: string, titleDisplayName: string): Promise<void> {
    if (!playerAccessEnabled) {
      return;
    }

    markBusy(titleId, true);
    setPlayerActionErrorMessage(null);
    setPlayerActionStatusMessage(null);
    try {
      if (wishlistedTitleIds.has(titleId)) {
        await removeTitleFromPlayerWishlist(appConfig.apiBaseUrl, accessToken, titleId);
        setWishlistedTitleIds((current) => {
          const next = new Set(current);
          next.delete(titleId);
          return next;
        });
        setPlayerActionStatusMessage(`${titleDisplayName} removed from wishlist.`);
      } else {
        await addTitleToPlayerWishlist(appConfig.apiBaseUrl, accessToken, titleId);
        setWishlistedTitleIds((current) => new Set(current).add(titleId));
        setPlayerActionStatusMessage(`${titleDisplayName} added to wishlist.`);
      }
    } catch (nextError) {
      setPlayerActionErrorMessage(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      markBusy(titleId, false);
    }
  }

  async function toggleOwned(titleId: string, titleDisplayName: string): Promise<void> {
    if (!playerAccessEnabled) {
      return;
    }

    markBusy(titleId, true);
    setPlayerActionErrorMessage(null);
    setPlayerActionStatusMessage(null);
    try {
      if (ownedTitleIds.has(titleId)) {
        await removeTitleFromPlayerLibrary(appConfig.apiBaseUrl, accessToken, titleId);
        setOwnedTitleIds((current) => {
          const next = new Set(current);
          next.delete(titleId);
          return next;
        });
        setPlayerActionStatusMessage(`${titleDisplayName} removed from My Games.`);
      } else {
        await addTitleToPlayerLibrary(appConfig.apiBaseUrl, accessToken, titleId);
        setOwnedTitleIds((current) => new Set(current).add(titleId));
        setPlayerActionStatusMessage(`${titleDisplayName} added to My Games.`);
      }
    } catch (nextError) {
      setPlayerActionErrorMessage(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      markBusy(titleId, false);
    }
  }

  function openReportModal(titleId: string, titleDisplayName: string): void {
    if (!playerAccessEnabled || reportedTitleIds.has(titleId)) {
      return;
    }

    setReportTarget({ id: titleId, displayName: titleDisplayName });
    setReportReason("");
    setReportErrorMessage(null);
  }

  async function submitReport(): Promise<void> {
    if (!reportTarget || reportSubmitting) {
      return;
    }

    setReportSubmitting(true);
    setPlayerActionErrorMessage(null);
    setPlayerActionStatusMessage(null);
    setReportErrorMessage(null);
    try {
      const response = await createPlayerTitleReport(appConfig.apiBaseUrl, accessToken, {
        titleId: reportTarget.id,
        reason: reportReason.trim(),
      });
      setReportedTitleIds((current) => new Set(current).add(response.report.titleId));
      setPlayerActionStatusMessage(`${reportTarget.displayName} has been reported for moderator review.`);
      setReportTarget(null);
      setReportReason("");
    } catch (nextError) {
      setReportErrorMessage(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setReportSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingPanel title="Loading studio..." />;
  }

  if (error) {
    return <ErrorPanel detail={error} />;
  }

  if (!studio) {
    return <ErrorPanel title="Studio not found" detail="The requested studio could not be loaded." />;
  }

  const additionalStudioLinks = studio.links.filter((link) => !isKnownStudioLink(link.url));
  const studioAvatarUrl = getStudioAvatarImageUrl(studio);

  return (
    <section className="space-y-8">
      <section className="app-panel relative overflow-hidden p-0">
        <div className="min-h-[20rem] bg-cover bg-center" style={studio.bannerUrl ? { backgroundImage: `url('${studio.bannerUrl}')` } : undefined}>
          <div className="h-full bg-[linear-gradient(120deg,rgba(8,10,18,0.88),rgba(8,10,18,0.52),rgba(8,10,18,0.82))] p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-4xl space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Link className="app-icon-button" to="/browse" aria-label="Back to browse" title="Back to browse">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
                      <path d="M14.5 5 7.5 12l7 7" />
                    </svg>
                  </Link>
                </div>
                <h1 className="app-page-title">{studio.displayName}</h1>
                {studio.description ? <p className="max-w-3xl text-base leading-8 text-slate-200">{studio.description}</p> : null}
                {studio.links.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {studio.links.map((link) => (
                      <a key={link.id} className="app-icon-button" href={link.url} target="_blank" rel="noreferrer" title={link.label} aria-label={link.label}>
                        <StudioLinkIcon url={link.url} />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
              {studioAvatarUrl ? <img className="surface-panel-strong h-24 w-24 rounded-[1.5rem] object-cover shadow-[0_12px_32px_rgba(0,0,0,0.35)] md:h-32 md:w-32" src={studioAvatarUrl} alt={`${studio.displayName} avatar`} /> : null}
            </div>
          </div>
        </div>
      </section>

      {playerActionStatusMessage ? (
        <div className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{playerActionStatusMessage}</div>
      ) : null}

      {playerActionErrorMessage ? (
        <div className="rounded-[1rem] border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{playerActionErrorMessage}</div>
      ) : null}

      <section className="app-panel p-5">
        <div className="grid gap-3 xl:grid-cols-[2fr_0.85fr_0.85fr_auto]">
          <label className="text-sm text-slate-300">
            Search
            <input className="mt-2 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Title, genre, description" />
          </label>
          <label className="text-sm text-slate-300">
            Content kind
            <select className="mt-2 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100" value={contentKind} onChange={(event) => setContentKind(event.currentTarget.value)}>
              <option value="all">Games and apps</option>
              <option value="game">Games only</option>
              <option value="app">Apps only</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Sort
            <select className="mt-2 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100" value={sort} onChange={(event) => setSort(event.currentTarget.value)}>
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
              <option value="genre-asc">Genre</option>
              <option value="players-asc">Players (low-high)</option>
              <option value="players-desc">Players (high-low)</option>
              <option value="age-asc">Age rating (low-high)</option>
              <option value="age-desc">Age rating (high-low)</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className="secondary-button" type="button" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <details className="surface-panel-soft rounded-[1.5rem] px-4 py-3 text-slate-200" open={selectedGenres.length > 0}>
            <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/85">
              <span>Genres</span>
              <span className="h-px flex-1 bg-white/10"></span>
              <span className="text-[0.65rem] tracking-[0.16em] text-slate-400">{availableGenres.length} available</span>
            </summary>
            <div className="mt-4 flex flex-wrap gap-2">
              {availableGenres.map((genre) => {
                const selected = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${selected ? "border-cyan-300/45 bg-cyan-300/15 text-cyan-50" : "border-white/15 text-slate-100 hover:border-cyan-300/45 hover:text-cyan-100"}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </details>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-[0.08em] text-white">Search results</h2>
            <div className="mt-1 text-sm text-slate-400">Explore {studio.displayName} titles without leaving the catalog.</div>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <label className="text-sm text-slate-300">
              Results per page
              <select className="ml-3 rounded-full border border-white/15 bg-slate-950/70 px-4 py-2 text-sm text-slate-100" value={resultsPerPage} onChange={(event) => setResultsPerPage(event.currentTarget.value)}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="all">All</option>
              </select>
            </label>
            {filteredTitles.length > 0 ? (
              <div className="app-panel flex flex-wrap gap-3 p-4 text-sm">
                <span>{filteredTitles.length} titles</span>
                <span className="text-slate-500">•</span>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {filteredTitles.length === 0 ? (
          <section className="app-panel p-6">
            <h3 className="text-xl font-semibold text-white">No titles match the current filters</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">Try clearing one or more filters to broaden the results.</p>
          </section>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {pagedTitles.map((title) => (
                <TitleCard
                  key={title.id}
                  title={title}
                  onOpenQuickView={(selectedTitle) => setQuickViewTarget({ studioSlug: selectedTitle.studioSlug, titleSlug: selectedTitle.slug })}
                  playerActions={{
                    visible: playerAccessEnabled,
                    isBusy: playerStateLoading || busyTitleIds.has(title.id),
                    isWishlisted: wishlistedTitleIds.has(title.id),
                    isOwned: ownedTitleIds.has(title.id),
                    isReported: reportedTitleIds.has(title.id),
                    canReport: !reportedTitleIds.has(title.id),
                    onToggleWishlist: () => void toggleWishlist(title.id, title.displayName),
                    onToggleOwned: () => void toggleOwned(title.id, title.displayName),
                    onReport: () => openReportModal(title.id, title.displayName),
                  }}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button className={`secondary-button ${currentPage > 1 ? "" : "pointer-events-none opacity-40"}`} type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
                Previous
              </button>
              <div className="text-sm text-slate-400">
                Showing results {visibleResultStart} - {visibleResultEnd} of {filteredTitles.length}
              </div>
              <button className={`secondary-button ${currentPage < totalPages ? "" : "pointer-events-none opacity-40"}`} type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>
                Next
              </button>
            </div>
          </>
        )}
      </section>

      {additionalStudioLinks.length > 0 ? (
        <section className="app-panel p-5">
          <div className="eyebrow">Studio links</div>
          <div className="mt-4 flex flex-wrap gap-3">
            {additionalStudioLinks.map((link) => (
              <a key={link.id} className="secondary-button" href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {quickViewTarget ? (
        <TitleQuickViewModal
          studioSlug={quickViewTarget.studioSlug}
          titleSlug={quickViewTarget.titleSlug}
          onClose={() => setQuickViewTarget(null)}
        />
      ) : null}
      {reportTarget ? (
        <ReportTitleModal
          titleDisplayName={reportTarget.displayName}
          reportReason={reportReason}
          reportErrorMessage={reportErrorMessage}
          submitting={reportSubmitting}
          onReportReasonChange={setReportReason}
          onClose={() => {
            setReportTarget(null);
            setReportReason("");
            setReportErrorMessage(null);
          }}
          onSubmit={() => void submitReport()}
        />
      ) : null}
    </section>
  );
}

function ReportTitleModal({
  titleDisplayName,
  reportReason,
  reportErrorMessage,
  submitting,
  onReportReasonChange,
  onClose,
  onSubmit,
}: {
  titleDisplayName: string;
  reportReason: string;
  reportErrorMessage: string | null;
  submitting: boolean;
  onReportReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="app-panel w-full max-w-2xl p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/75">Report title</div>
            <h2 className="mt-2 text-2xl font-bold text-white">{titleDisplayName}</h2>
          </div>
          <button className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-cyan-300/60 hover:text-cyan-100" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-300">Tell moderators what looks wrong so they can review it with the developer.</p>
        <label className="mt-5 block text-sm text-slate-300">
          Reason
          <textarea
            className="mt-2 min-h-36 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100"
            value={reportReason}
            onChange={(event) => onReportReasonChange(event.currentTarget.value)}
            placeholder="Describe the issue with this title."
          />
        </label>
        {reportErrorMessage ? <div className="mt-4 rounded-[1rem] border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{reportErrorMessage}</div> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onSubmit} disabled={submitting || reportReason.trim().length === 0}>
            {submitting ? "Submitting..." : "Submit report"}
          </button>
          <button className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function TitleQuickViewModal({
  studioSlug,
  titleSlug,
  onClose,
}: {
  studioSlug: string;
  titleSlug: string;
  onClose: () => void;
}) {
  const { session, currentUser } = useAuth();
  const [title, setTitle] = useState<CatalogTitleResponse["title"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerStateLoading, setPlayerStateLoading] = useState(false);
  const [playerStateError, setPlayerStateError] = useState<string | null>(null);
  const [titleInLibrary, setTitleInLibrary] = useState(false);
  const [titleInWishlist, setTitleInWishlist] = useState(false);
  const [existingReport, setExistingReport] = useState<PlayerTitleReportSummary | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const accessToken = session?.access_token ?? "";
  const playerAccessEnabled = currentUser ? hasPlatformRole(currentUser.roles, "player") : false;

  async function refreshPlayerState(nextTitleId: string): Promise<void> {
    if (!accessToken || !playerAccessEnabled) {
      return;
    }

    setPlayerStateLoading(true);
    try {
      const [libraryResponse, wishlistResponse, reportsResponse] = await Promise.all([
        getPlayerLibrary(appConfig.apiBaseUrl, accessToken),
        getPlayerWishlist(appConfig.apiBaseUrl, accessToken),
        getPlayerTitleReports(appConfig.apiBaseUrl, accessToken),
      ]);
      setTitleInLibrary(libraryResponse.titles.some((candidate) => candidate.id === nextTitleId));
      setTitleInWishlist(wishlistResponse.titles.some((candidate) => candidate.id === nextTitleId));
      setExistingReport(reportsResponse.reports.find((candidate) => candidate.titleId === nextTitleId) ?? null);
      setPlayerStateError(null);
    } catch (nextError) {
      setPlayerStateError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setPlayerStateLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await getCatalogTitle(appConfig.apiBaseUrl, studioSlug, titleSlug, accessToken || null);
        if (cancelled) {
          return;
        }

        setTitle(response.title);
        if (accessToken && playerAccessEnabled) {
          await refreshPlayerState(response.title.id);
        } else {
          setTitleInLibrary(false);
          setTitleInWishlist(false);
          setExistingReport(null);
          setPlayerStateError(null);
        }
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void load();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [accessToken, onClose, playerAccessEnabled, studioSlug, titleSlug]);

  async function handleLibraryToggle(nextIncluded: boolean): Promise<void> {
    if (!title || !accessToken) {
      return;
    }

    setActionLoading(true);
    try {
      if (nextIncluded) {
        await addTitleToPlayerLibrary(appConfig.apiBaseUrl, accessToken, title.id);
      } else {
        await removeTitleFromPlayerLibrary(appConfig.apiBaseUrl, accessToken, title.id);
      }

      await refreshPlayerState(title.id);
      setActionMessage(nextIncluded ? "Added to your library." : "Removed from your library.");
      setPlayerStateError(null);
    } catch (nextError) {
      setPlayerStateError(nextError instanceof Error ? nextError.message : String(nextError));
      setActionMessage(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWishlistToggle(nextIncluded: boolean): Promise<void> {
    if (!title || !accessToken) {
      return;
    }

    setActionLoading(true);
    try {
      if (nextIncluded) {
        await addTitleToPlayerWishlist(appConfig.apiBaseUrl, accessToken, title.id);
      } else {
        await removeTitleFromPlayerWishlist(appConfig.apiBaseUrl, accessToken, title.id);
      }

      await refreshPlayerState(title.id);
      setActionMessage(nextIncluded ? "Added to your wishlist." : "Removed from your wishlist.");
      setPlayerStateError(null);
    } catch (nextError) {
      setPlayerStateError(nextError instanceof Error ? nextError.message : String(nextError));
      setActionMessage(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function submitReport(): Promise<boolean> {
    if (!title || !accessToken) {
      return false;
    }

    setActionLoading(true);
    try {
      const response = await createPlayerTitleReport(appConfig.apiBaseUrl, accessToken, {
        titleId: title.id,
        reason: reportReason,
      });
      setExistingReport(response.report);
      setReportReason("");
      await refreshPlayerState(title.id);
      setActionMessage("Report submitted.");
      setPlayerStateError(null);
      return true;
    } catch (nextError) {
      setPlayerStateError(nextError instanceof Error ? nextError.message : String(nextError));
      setActionMessage(null);
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  const heroImageUrl = title ? getHeroImageUrl(title) : null;
  const reportedByCurrentUser = title ? Boolean(existingReport && existingReport.titleId === title.id) : false;
  const availabilityNote = title ? getCatalogTitleAvailabilityNote(title) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8" onClick={onClose}>
      <div className="mx-auto max-w-6xl" onClick={(event) => event.stopPropagation()}>
        <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="quick-view-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Quick view</div>
            </div>
            <button className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-cyan-300/60 hover:text-cyan-100" type="button" onClick={onClose}>
              Close
            </button>
          </div>

          {loading ? <LoadingPanel title="Loading title..." /> : null}
          {error ? <ErrorPanel detail={error} /> : null}
          {!loading && !error && title ? (
            <>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <TitleNameHeading
                  title={title}
                  id="quick-view-title"
                  level="h2"
                  className="text-3xl font-black text-white"
                  imageClassName="max-h-20 w-auto max-w-full object-contain"
                />
                <TitlePlayerActionButtons
                  visible={playerAccessEnabled}
                  compact
                  isBusy={actionLoading || playerStateLoading}
                  isWishlisted={titleInWishlist}
                  isOwned={titleInLibrary}
                  isReported={Boolean(existingReport)}
                  canReport={!existingReport}
                  onToggleWishlist={() => void handleWishlistToggle(!titleInWishlist)}
                  onToggleOwned={() => void handleLibraryToggle(!titleInLibrary)}
                  onReport={() => setReportModalOpen(true)}
                />
              </div>
              {actionMessage ? <div className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{actionMessage}</div> : null}
              {playerStateError ? <div className="rounded-[1rem] border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{playerStateError}</div> : null}
              {availabilityNote ? (
                <div className="rounded-[1.5rem] border border-amber-200/35 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-50">
                  This title is {availabilityNote.toLowerCase()}. It remains visible here because it is already in your library or wishlist.
                </div>
              ) : null}
              {title.isReported ? (
                <div className="rounded-[1.5rem] border border-amber-200/35 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-50">
                  {reportedByCurrentUser
                    ? "This title has been reported and is under moderator review. You reported this title and will receive follow-up in your player notifications."
                    : "This title has been reported and is currently under moderator review."}
                </div>
              ) : null}
              <div
                className="min-h-[20rem] rounded-[1.75rem] bg-cover bg-center"
                style={heroImageUrl ? { backgroundImage: `linear-gradient(135deg, rgba(4,19,29,0.16), rgba(4,19,29,0.58)), url('${heroImageUrl}')` } : { backgroundImage: getFallbackGradient(title.genreDisplay) }}
              />
              <div className="surface-panel-soft flex flex-wrap items-start justify-between gap-4 rounded-[1.25rem] p-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Studio</div>
                  <div className="mt-2 text-lg font-semibold text-white">{title.studioDisplayName}</div>
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/80">
                    <span className="rounded-full border border-white/15 px-3 py-1">{formatContentKindLabel(title.contentKind)}</span>
                    <span className="rounded-full border border-white/15 px-3 py-1">{title.playerCountDisplay}</span>
                    <span className="rounded-full border border-white/15 px-3 py-1">{title.ageDisplay}</span>
                    {parseGenreTags(title.genreDisplay).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/15 px-3 py-1">{tag}</span>
                    ))}
                  </div>
                  <p className="text-base leading-8 text-slate-200">{title.shortDescription}</p>
                  {title.description ? <p className="text-sm leading-7 text-slate-300">{title.description}</p> : null}
                  {!session ? (
                    <div className="surface-panel-strong rounded-[1rem] p-4">
                      <p className="text-sm leading-7 text-slate-300">Sign in to manage your library, save titles to your wishlist, and report issues to moderators.</p>
                      <div className="mt-4">
                        <Link className="primary-button" to={`/auth/signin?returnTo=${encodeURIComponent(`/browse/${studioSlug}/${titleSlug}`)}`}>
                          Sign In
                        </Link>
                      </div>
                    </div>
                  ) : null}
                  {existingReport ? (
                    <div className="surface-panel-strong rounded-[1rem] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Report status</div>
                      <div className="mt-2 text-lg font-semibold text-white">{formatReportStatus(existingReport.status)}</div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{existingReport.reason}</p>
                      <div className="mt-4">
                        <Link className="secondary-button" to="/player?workflow=reported-titles">
                          Open report thread
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-4">
                  <div className="surface-panel-strong rounded-[1.5rem] p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/75">Release</div>
                    <div className="mt-2 text-sm text-slate-300">{title.currentRelease?.version ?? "Not published"}</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Link className="rounded-full bg-cyan-300 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.18em] text-slate-950" to={`/browse/${title.studioSlug}/${title.slug}`}>
                      Details
                    </Link>
                    {title.acquisition?.url ?? title.acquisitionUrl ? (
                      <a className="rounded-full border border-white/15 px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.18em] text-slate-100" href={title.acquisition?.url ?? title.acquisitionUrl ?? undefined} target="_blank" rel="noreferrer">
                        Get title
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
      {title && reportModalOpen ? (
        <ReportTitleModal
          titleDisplayName={title.displayName}
          reportReason={reportReason}
          reportErrorMessage={playerStateError}
          submitting={actionLoading}
          onReportReasonChange={setReportReason}
          onClose={() => {
            setReportModalOpen(false);
            setReportReason("");
            setPlayerStateError(null);
          }}
          onSubmit={() => {
            void submitReport().then((successful) => {
              if (successful) {
                setReportModalOpen(false);
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

function TitleDetailPage() {
  const { session, currentUser } = useAuth();
  const params = useParams<{ studioSlug: string; titleSlug: string }>();
  const studioSlug = params.studioSlug ?? "";
  const titleSlug = params.titleSlug ?? "";
  const [title, setTitle] = useState<CatalogTitleResponse["title"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerStateLoading, setPlayerStateLoading] = useState(false);
  const [playerStateError, setPlayerStateError] = useState<string | null>(null);
  const [titleInLibrary, setTitleInLibrary] = useState(false);
  const [titleInWishlist, setTitleInWishlist] = useState(false);
  const [existingReport, setExistingReport] = useState<PlayerTitleReportSummary | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [managedStudioIds, setManagedStudioIds] = useState<Set<string>>(new Set());
  const accessToken = session?.access_token ?? "";
  const playerAccessEnabled = currentUser ? hasPlatformRole(currentUser.roles, "player") : false;
  const moderatorAccessEnabled = currentUser ? hasPlatformRole(currentUser.roles, "moderator") : false;

  async function refreshPlayerState(nextTitleId: string): Promise<void> {
    if (!accessToken || !playerAccessEnabled) {
      return;
    }

    setPlayerStateLoading(true);
    try {
      const [libraryResponse, wishlistResponse, reportsResponse] = await Promise.all([
        getPlayerLibrary(appConfig.apiBaseUrl, accessToken),
        getPlayerWishlist(appConfig.apiBaseUrl, accessToken),
        getPlayerTitleReports(appConfig.apiBaseUrl, accessToken),
      ]);
      setTitleInLibrary(libraryResponse.titles.some((candidate) => candidate.id === nextTitleId));
      setTitleInWishlist(wishlistResponse.titles.some((candidate) => candidate.id === nextTitleId));
      setExistingReport(reportsResponse.reports.find((candidate) => candidate.titleId === nextTitleId) ?? null);
      setPlayerStateError(null);
    } catch (nextError) {
      setPlayerStateError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setPlayerStateLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await getCatalogTitle(appConfig.apiBaseUrl, studioSlug, titleSlug, accessToken || null);
        if (cancelled) {
          return;
        }

        setTitle(response.title);
        if (accessToken && playerAccessEnabled) {
          await refreshPlayerState(response.title.id);
        } else {
          setTitleInLibrary(false);
          setTitleInWishlist(false);
          setExistingReport(null);
          setPlayerStateError(null);
        }
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, playerAccessEnabled, studioSlug, titleSlug]);

  useEffect(() => {
    let cancelled = false;

    async function loadManagedStudios(): Promise<void> {
      if (!accessToken || !currentUser || !hasPlatformRole(currentUser.roles, "developer")) {
        setManagedStudioIds(new Set());
        return;
      }

      try {
        const response = await listManagedStudios(appConfig.apiBaseUrl, accessToken);
        if (!cancelled) {
          setManagedStudioIds(new Set(response.studios.map((studio) => studio.id)));
        }
      } catch {
        if (!cancelled) {
          setManagedStudioIds(new Set());
        }
      }
    }

    void loadManagedStudios();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentUser]);

  async function handleLibraryToggle(nextIncluded: boolean): Promise<void> {
    if (!title || !accessToken) {
      return;
    }

    setActionLoading(true);
    try {
      if (nextIncluded) {
        await addTitleToPlayerLibrary(appConfig.apiBaseUrl, accessToken, title.id);
      } else {
        await removeTitleFromPlayerLibrary(appConfig.apiBaseUrl, accessToken, title.id);
      }

      await refreshPlayerState(title.id);
      setActionMessage(nextIncluded ? "Added to your library." : "Removed from your library.");
      setPlayerStateError(null);
    } catch (nextError) {
      setPlayerStateError(nextError instanceof Error ? nextError.message : String(nextError));
      setActionMessage(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWishlistToggle(nextIncluded: boolean): Promise<void> {
    if (!title || !accessToken) {
      return;
    }

    setActionLoading(true);
    try {
      if (nextIncluded) {
        await addTitleToPlayerWishlist(appConfig.apiBaseUrl, accessToken, title.id);
      } else {
        await removeTitleFromPlayerWishlist(appConfig.apiBaseUrl, accessToken, title.id);
      }

      await refreshPlayerState(title.id);
      setActionMessage(nextIncluded ? "Added to your wishlist." : "Removed from your wishlist.");
      setPlayerStateError(null);
    } catch (nextError) {
      setPlayerStateError(nextError instanceof Error ? nextError.message : String(nextError));
      setActionMessage(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateReport(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!title || !accessToken) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await createPlayerTitleReport(appConfig.apiBaseUrl, accessToken, {
        titleId: title.id,
        reason: reportReason,
      });
      setExistingReport(response.report);
      setReportReason("");
      await refreshPlayerState(title.id);
      setActionMessage("Report submitted.");
      setPlayerStateError(null);
    } catch (nextError) {
      setPlayerStateError(nextError instanceof Error ? nextError.message : String(nextError));
      setActionMessage(null);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <LoadingPanel title="Loading title..." />;
  }

  if (error) {
    return <ErrorPanel detail={error} />;
  }

  if (!title) {
    return <ErrorPanel title="Title not found" detail="The requested title could not be loaded." />;
  }

  const heroImageUrl = getHeroImageUrl(title);
  const canViewMetadata = moderatorAccessEnabled || managedStudioIds.has(title.studioId);
  const metadataMediaAssets = title.mediaAssets.map((asset) => formatMembershipRole(asset.mediaRole)).join(", ");
  const showPlayerReleaseSummary = playerAccessEnabled && !canViewMetadata;
  const showCurrentReleasePanel = !showPlayerReleaseSummary;
  const availabilityNote = getCatalogTitleAvailabilityNote(title);

  return (
    <section className="space-y-8">
      <section className="app-panel relative overflow-hidden p-0">
        <div
          className="min-h-[28rem] bg-cover bg-center"
          style={heroImageUrl ? { backgroundImage: `url('${heroImageUrl}')` } : { backgroundImage: getFallbackGradient(title.genreDisplay) }}
        >
          <div className="flex h-full min-h-[28rem] flex-col justify-between bg-[linear-gradient(120deg,rgba(8,10,18,0.84),rgba(8,10,18,0.4),rgba(8,10,18,0.9))] p-6 md:p-8">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {parseGenreTags(title.genreDisplay).map((genreTag) => (
                  <span key={genreTag} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
                    {genreTag}
                  </span>
                ))}
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">{title.playerCountDisplay}</span>
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">{title.ageDisplay}</span>
              </div>
              <div>
                <TitleNameHeading
                  title={title}
                  level="h1"
                  className="app-page-title"
                  imageClassName="max-h-24 w-auto max-w-full object-contain"
                />
                <div className="mt-4 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100/75">{title.studioDisplayName}</div>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">{title.shortDescription}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {title.acquisitionUrl ? (
                  <a className="primary-button" href={title.acquisitionUrl} target="_blank" rel="noreferrer">
                    Get title
                  </a>
                ) : null}
                <Link className="secondary-button" to={`/studios/${title.studioSlug}`}>
                  Open studio
                </Link>
                
                <TitlePlayerActionButtons
                  visible={playerAccessEnabled}
                  isBusy={actionLoading || playerStateLoading}
                  isWishlisted={titleInWishlist}
                  isOwned={titleInLibrary}
                  isReported={Boolean(existingReport)}
                  canReport={!existingReport}
                  onToggleWishlist={() => void handleWishlistToggle(!titleInWishlist)}
                  onToggleOwned={() => void handleLibraryToggle(!titleInLibrary)}
                  onReport={() => {
                    if (!existingReport) {
                      const reportField = document.getElementById("title-report-field");
                      reportField?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                />
                {actionMessage ? <div className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{actionMessage}</div> : null}
              </div>
              {showPlayerReleaseSummary ? (
                <div className="text-sm text-slate-300">
                  Current version <span className="font-semibold text-slate-100">{title.currentRelease?.version ?? "Not published"}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {playerStateError ? <div className="rounded-[1rem] border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{playerStateError}</div> : null}
      {availabilityNote ? (
        <div className="rounded-[1.25rem] border border-amber-200/35 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-50">
          This title is {availabilityNote.toLowerCase()}. It remains visible because you already saved it in your library or wishlist.
        </div>
      ) : null}

      <section className={showCurrentReleasePanel ? "grid gap-6 lg:grid-cols-[1.2fr_0.8fr]" : "grid gap-6"}>
        <section className="app-panel p-6">
          <h2 className="text-xl font-semibold text-white">About</h2>
          <p className="mt-4 text-base leading-8 text-slate-300">{title.description}</p>
        </section>
        {showCurrentReleasePanel ? (
          <section className="app-panel p-6">
            <h2 className="text-xl font-semibold text-white">Current release</h2>
            <dl className="mt-4 grid gap-3 text-sm text-slate-300">
              <div className="flex justify-between gap-4">
                <dt>Version</dt>
                <dd>{title.currentRelease?.version ?? "Not published"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Acquisition</dt>
                <dd>{title.acquisitionUrl ? "Configured" : "Not configured"}</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </section>

      <section className={`grid gap-6 ${canViewMetadata ? "lg:grid-cols-[1.15fr_0.85fr]" : ""}`}>
        <section className="app-panel p-6">
          <h2 className="text-xl font-semibold text-white">Player reporting</h2>
          {!session ? (
            <div className="surface-panel-strong mt-6 rounded-[1rem] p-4">
              <p>Sign in to manage your library, save titles to your wishlist, and report issues to moderators.</p>
              <div className="mt-4">
                <Link className="primary-button" to={`/auth/signin?returnTo=${encodeURIComponent(`/browse/${studioSlug}/${titleSlug}`)}`}>
                  Sign In
                </Link>
              </div>
            </div>
          ) : playerAccessEnabled ? (
            existingReport ? (
              <section className="surface-panel-soft mt-6 rounded-[1.25rem] p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Report status</div>
                <div className="mt-2 text-lg font-semibold text-white">{formatReportStatus(existingReport.status)}</div>
                <p className="mt-2 text-sm leading-7 text-slate-300">{existingReport.reason}</p>
                <div className="mt-4">
                  <Link className="secondary-button" to="/player?workflow=reported-titles">
                    Open report thread
                  </Link>
                </div>
              </section>
            ) : (
              <form className="mt-6 stack-form" onSubmit={handleCreateReport}>
                <Field label="Report this title">
                  <textarea
                    id="title-report-field"
                    rows={4}
                    value={reportReason}
                    onChange={(event) => setReportReason(event.currentTarget.value)}
                    placeholder="Describe the issue moderators should review."
                  />
                </Field>
                <div className="button-row">
                  <button type="submit" className="primary-button" disabled={actionLoading || reportReason.trim().length === 0}>
                    {actionLoading ? "Submitting..." : "Submit report"}
                  </button>
                </div>
              </form>
            )
          ) : (
            <div className="surface-panel-strong mt-6 rounded-[1rem] p-4">
              <p>This signed-in account does not currently have player access for collection and reporting workflows.</p>
            </div>
          )}
        </section>

        {canViewMetadata ? (
          <section className="app-panel p-6">
            <h2>Metadata</h2>
            <dl className="mt-6 grid gap-3 text-sm text-slate-300">
              <div className="flex justify-between gap-4">
                <dt>Visibility</dt>
                <dd>{formatMembershipRole(title.visibility)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Lifecycle</dt>
                <dd>{formatMembershipRole(title.lifecycleStatus)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Reported</dt>
                <dd>{title.isReported ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Metadata revision</dt>
                <dd>{title.currentMetadataRevision.toString()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Media assets</dt>
                <dd>{metadataMediaAssets || "None"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Updated</dt>
                <dd>{formatTimestamp(title.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </section>
    </section>
  );
}

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove?: (widgetId: string) => void;
};

type TurnstileWidgetStatus = "loading" | "ready" | "error";

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

function CaptchaWidget({
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

function SignInPage() {
  const { client, session, currentUser, signIn, signUp, requestPasswordReset, verifyEmailCode, verifyRecoveryCode, updatePassword, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const recoveryMode = searchParams.get("mode") === "recovery";
  const signInDraftRef = useRef<SignInPageDraftState | null>(null);
  if (signInDraftRef.current === null) {
    const storedDraft = readSessionStorageJson<Partial<SignInPageDraftState>>(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
    signInDraftRef.current = {
      email: storedDraft?.email ?? "",
      password: storedDraft?.password ?? "",
      showSignInPassword: storedDraft?.showSignInPassword ?? false,
      mfaChallengeOpen: storedDraft?.mfaChallengeOpen ?? false,
      mfaCode: storedDraft?.mfaCode ?? "",
      mfaFactorId: typeof storedDraft?.mfaFactorId === "string" ? storedDraft.mfaFactorId : null,
      mfaFactorLabel: storedDraft?.mfaFactorLabel ?? "Authenticator app",
      registerModalOpen: storedDraft?.registerModalOpen ?? false,
      recoveryModalOpen: storedDraft?.recoveryModalOpen ?? recoveryMode,
      confirmationModalOpen: storedDraft?.confirmationModalOpen ?? false,
      recoveryStep: storedDraft?.recoveryStep === "code" || storedDraft?.recoveryStep === "reset" ? storedDraft.recoveryStep : recoveryMode ? "reset" : "request",
      registrationUserName: storedDraft?.registrationUserName ?? "",
      registrationEmail: storedDraft?.registrationEmail ?? "",
      registrationFirstName: storedDraft?.registrationFirstName ?? "",
      registrationLastName: storedDraft?.registrationLastName ?? "",
      registrationPassword: storedDraft?.registrationPassword ?? "",
      registrationConfirmPassword: storedDraft?.registrationConfirmPassword ?? "",
      showRegistrationPassword: storedDraft?.showRegistrationPassword ?? false,
      showRegistrationConfirmPassword: storedDraft?.showRegistrationConfirmPassword ?? false,
      registrationAvatar: restoreAvatarEditorState(storedDraft?.registrationAvatar),
      recoveryEmail: storedDraft?.recoveryEmail ?? "",
      recoveryCode: storedDraft?.recoveryCode ?? "",
      recoveryPassword: storedDraft?.recoveryPassword ?? "",
      recoveryConfirmPassword: storedDraft?.recoveryConfirmPassword ?? "",
      showRecoveryPassword: storedDraft?.showRecoveryPassword ?? false,
      showRecoveryConfirmPassword: storedDraft?.showRecoveryConfirmPassword ?? false,
      confirmationEmail: storedDraft?.confirmationEmail ?? "",
      confirmationCode: storedDraft?.confirmationCode ?? "",
    };
  }
  const signInDraft = signInDraftRef.current;
  const [email, setEmail] = useState(signInDraft.email);
  const [password, setPassword] = useState(signInDraft.password);
  const [showSignInPassword, setShowSignInPassword] = useState(signInDraft.showSignInPassword);
  const [mfaChallengeOpen, setMfaChallengeOpen] = useState(signInDraft.mfaChallengeOpen);
  const [mfaCode, setMfaCode] = useState(signInDraft.mfaCode);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(signInDraft.mfaFactorId);
  const [mfaFactorLabel, setMfaFactorLabel] = useState(signInDraft.mfaFactorLabel);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(signInDraft.registerModalOpen);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(signInDraft.recoveryModalOpen);
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(signInDraft.confirmationModalOpen);
  const [recoveryStep, setRecoveryStep] = useState<"request" | "code" | "reset">(signInDraft.recoveryStep);
  const [registrationUserName, setRegistrationUserName] = useState(signInDraft.registrationUserName);
  const [registrationEmail, setRegistrationEmail] = useState(signInDraft.registrationEmail);
  const [registrationFirstName, setRegistrationFirstName] = useState(signInDraft.registrationFirstName);
  const [registrationLastName, setRegistrationLastName] = useState(signInDraft.registrationLastName);
  const [registrationPassword, setRegistrationPassword] = useState(signInDraft.registrationPassword);
  const [registrationConfirmPassword, setRegistrationConfirmPassword] = useState(signInDraft.registrationConfirmPassword);
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(signInDraft.showRegistrationPassword);
  const [showRegistrationConfirmPassword, setShowRegistrationConfirmPassword] = useState(signInDraft.showRegistrationConfirmPassword);
  const registrationUserNameCheckRequest = useRef(0);
  const [registrationUserNameError, setRegistrationUserNameError] = useState<string | null>(null);
  const [registrationUserNameAvailability, setRegistrationUserNameAvailability] = useState<{
    status: "idle" | "checking" | "available" | "unavailable";
    value: string;
  }>({ status: "idle", value: "" });
  const [registrationEmailError, setRegistrationEmailError] = useState<string | null>(null);
  const [registrationPasswordErrors, setRegistrationPasswordErrors] = useState<string[]>([]);
  const [registrationConfirmPasswordError, setRegistrationConfirmPasswordError] = useState<string | null>(null);
  const [registrationAvatar, setRegistrationAvatar] = useState<AvatarEditorState>(signInDraft.registrationAvatar);
  const [registrationCaptchaToken, setRegistrationCaptchaToken] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState(signInDraft.recoveryEmail);
  const [recoveryCaptchaToken, setRecoveryCaptchaToken] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState(signInDraft.recoveryCode);
  const [recoveryPassword, setRecoveryPassword] = useState(signInDraft.recoveryPassword);
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState(signInDraft.recoveryConfirmPassword);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(signInDraft.showRecoveryPassword);
  const [showRecoveryConfirmPassword, setShowRecoveryConfirmPassword] = useState(signInDraft.showRecoveryConfirmPassword);
  const [confirmationEmail, setConfirmationEmail] = useState(signInDraft.confirmationEmail);
  const [confirmationCode, setConfirmationCode] = useState(signInDraft.confirmationCode);
  const [registering, setRegistering] = useState(false);
  const [requestingRecovery, setRequestingRecovery] = useState(false);
  const [verifyingRecoveryCode, setVerifyingRecoveryCode] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [completingRecovery, setCompletingRecovery] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryStatusMessage, setRecoveryStatusMessage] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(null);
  const captchaMode = getCaptchaMode(appConfig.turnstileSiteKey);
  const captchaRequired = captchaMode !== "disabled";

  const returnTo = searchParams.get("returnTo") || "/player";
  const suppressAuthenticatedRedirect = recoveryMode || recoveryModalOpen || mfaChallengeOpen;

  useEffect(() => {
    if (session && currentUser && !suppressAuthenticatedRedirect) {
      navigate(returnTo, { replace: true });
    }
  }, [currentUser, navigate, returnTo, session, suppressAuthenticatedRedirect]);

  useEffect(() => {
    if (recoveryMode) {
      setRecoveryModalOpen(true);
      setRecoveryStep("reset");
      setRecoveryError(null);
      setPasswordRecoveryError(null);
      setRecoveryStatusMessage(null);
    }
  }, [recoveryMode]);

  useEffect(() => {
    const hasDraft =
      email.trim().length > 0 ||
      password.length > 0 ||
      mfaChallengeOpen ||
      mfaCode.trim().length > 0 ||
      registerModalOpen ||
      recoveryModalOpen ||
      confirmationModalOpen ||
      registrationUserName.trim().length > 0 ||
      registrationEmail.trim().length > 0 ||
      registrationFirstName.trim().length > 0 ||
      registrationLastName.trim().length > 0 ||
      registrationPassword.length > 0 ||
      registrationConfirmPassword.length > 0 ||
      registrationAvatar.url.trim().length > 0 ||
      Boolean(registrationAvatar.dataUrl) ||
      recoveryEmail.trim().length > 0 ||
      recoveryCode.trim().length > 0 ||
      recoveryPassword.length > 0 ||
      recoveryConfirmPassword.length > 0 ||
      confirmationEmail.trim().length > 0 ||
      confirmationCode.trim().length > 0;

    if (!hasDraft) {
      removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
      return;
    }

    writeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY, {
      email,
      password,
      showSignInPassword,
      mfaChallengeOpen,
      mfaCode,
      mfaFactorId,
      mfaFactorLabel,
      registerModalOpen,
      recoveryModalOpen,
      confirmationModalOpen,
      recoveryStep,
      registrationUserName,
      registrationEmail,
      registrationFirstName,
      registrationLastName,
      registrationPassword,
      registrationConfirmPassword,
      showRegistrationPassword,
      showRegistrationConfirmPassword,
      registrationAvatar,
      recoveryEmail,
      recoveryCode,
      recoveryPassword,
      recoveryConfirmPassword,
      showRecoveryPassword,
      showRecoveryConfirmPassword,
      confirmationEmail,
      confirmationCode,
    } satisfies SignInPageDraftState);
  }, [
    confirmationCode,
    confirmationEmail,
    confirmationModalOpen,
    email,
    mfaFactorId,
    mfaFactorLabel,
    mfaChallengeOpen,
    mfaCode,
    password,
    recoveryCode,
    recoveryConfirmPassword,
    recoveryEmail,
    recoveryModalOpen,
    recoveryPassword,
    recoveryStep,
    registerModalOpen,
    registrationAvatar,
    registrationConfirmPassword,
    registrationEmail,
    registrationFirstName,
    registrationLastName,
    registrationPassword,
    registrationUserName,
    showRecoveryConfirmPassword,
    showRecoveryPassword,
    showRegistrationConfirmPassword,
    showRegistrationPassword,
    showSignInPassword,
  ]);

  const registrationUserNameHint =
    registrationUserNameAvailability.status === "available"
      ? "✓ Available"
      : registrationUserNameAvailability.status === "unavailable"
        ? "✕ Unavailable"
        : registrationUserNameAvailability.status === "checking"
          ? "Checking availability..."
          : registrationUserNameError;
  const registrationUserNameHintTone =
    registrationUserNameAvailability.status === "available"
      ? "success"
      : registrationUserNameAvailability.status === "unavailable" || registrationUserNameError
        ? "error"
        : "default";
  const registrationPasswordHint = registrationPasswordErrors.length > 0 ? (
    <ul className="field-hint-list">
      {registrationPasswordErrors.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  ) : undefined;
  const registrationPasswordHintTone = registrationPasswordErrors.length > 0 ? "error" : "default";
  const registrationCanSubmit =
    registrationUserName.trim().length > 0 &&
    registrationEmail.trim().length > 0 &&
    registrationFirstName.trim().length > 0 &&
    registrationLastName.trim().length > 0 &&
    registrationPassword.length > 0 &&
    registrationConfirmPassword.length > 0 &&
    registrationUserNameAvailability.status === "available" &&
    !registrationUserNameError &&
    !registrationEmailError &&
    registrationPasswordErrors.length === 0 &&
    !registrationConfirmPasswordError &&
    (!captchaRequired || Boolean(registrationCaptchaToken));

  async function validateRegistrationUserName(): Promise<boolean> {
    const trimmed = registrationUserName.trim();
    const nextError = validateUserNameInput(trimmed);
    setRegistrationUserNameError(nextError);
    if (nextError) {
      setRegistrationUserNameAvailability({ status: "idle", value: trimmed });
      return false;
    }

    const requestId = registrationUserNameCheckRequest.current + 1;
    registrationUserNameCheckRequest.current = requestId;
    setRegistrationUserNameAvailability({ status: "checking", value: trimmed });
    try {
      const response = await getUserNameAvailability(appConfig.apiBaseUrl, trimmed);
      if (registrationUserNameCheckRequest.current !== requestId) {
        return false;
      }
      setRegistrationUserNameAvailability({
        status: response.userNameAvailability.available ? "available" : "unavailable",
        value: trimmed,
      });
      return response.userNameAvailability.available;
    } catch (error) {
      if (registrationUserNameCheckRequest.current !== requestId) {
        return false;
      }
      setRegistrationUserNameAvailability({ status: "idle", value: trimmed });
      setRegistrationUserNameError(error instanceof Error ? error.message : "We couldn't verify username availability.");
      return false;
    }
  }

  function validateRegistrationEmail(): boolean {
    const nextError = validateEmailInput(registrationEmail);
    setRegistrationEmailError(nextError);
    return !nextError;
  }

  function validateRegistrationPassword(): boolean {
    const nextErrors = getPasswordPolicyErrors(registrationPassword);
    setRegistrationPasswordErrors(nextErrors);
    return nextErrors.length === 0;
  }

  function validateRegistrationConfirmPassword(): boolean {
    const nextError = validatePasswordConfirmation(registrationPassword, registrationConfirmPassword);
    setRegistrationConfirmPasswordError(nextError);
    return !nextError;
  }

  function resetRegistrationForm(): void {
    setRegistrationUserName("");
    setRegistrationEmail("");
    setRegistrationFirstName("");
    setRegistrationLastName("");
    setRegistrationPassword("");
    setRegistrationConfirmPassword("");
    setShowRegistrationPassword(false);
    setShowRegistrationConfirmPassword(false);
    registrationUserNameCheckRequest.current = 0;
    setRegistrationUserNameError(null);
    setRegistrationUserNameAvailability({ status: "idle", value: "" });
    setRegistrationEmailError(null);
    setRegistrationPasswordErrors([]);
    setRegistrationConfirmPasswordError(null);
    setRegistrationAvatar(createAvatarEditorState(null));
    setRegistrationCaptchaToken(null);
    setRegistrationError(null);
  }

  function openRegisterModal(): void {
    resetRegistrationForm();
    setRegisterModalOpen(true);
  }

  function closeRegisterModal(): void {
    setRegisterModalOpen(false);
    resetRegistrationForm();
    removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
  }

  function resetRecoveryState(): void {
    setRecoveryStep("request");
    setRecoveryEmail("");
    setRecoveryCaptchaToken(null);
    setRecoveryCode("");
    setRecoveryPassword("");
    setRecoveryConfirmPassword("");
    setShowRecoveryPassword(false);
    setShowRecoveryConfirmPassword(false);
    setRecoveryError(null);
    setRecoveryStatusMessage(null);
    setPasswordRecoveryError(null);
  }

  function openRecoveryModal(): void {
    resetRecoveryState();
    setRecoveryModalOpen(true);
  }

  function closeRecoveryModal(): void {
    setRecoveryModalOpen(false);
    resetRecoveryState();
    removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
    if (recoveryMode) {
      navigate("/auth/signin", { replace: true });
    }
  }

  async function sendRecoveryEmail(): Promise<void> {
    if (!recoveryEmail.trim()) {
      throw new Error("Email is required.");
    }
    if (captchaRequired && !recoveryCaptchaToken) {
      throw new Error("Complete the human verification challenge.");
    }

    await requestPasswordReset(recoveryEmail.trim(), recoveryCaptchaToken);
    setRecoveryCode("");
    setRecoveryStep("code");
    setRecoveryError(null);
    setRecoveryStatusMessage("If that email matches an account, a recovery link and code have been sent.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setPageMessage(null);
    try {
      if (!email.trim()) {
        throw new Error("Email is required.");
      }
      if (!password) {
        throw new Error("Password is required.");
      }

      await signIn(email.trim(), password);
      const assuranceResponse = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceResponse.error) {
        throw new Error(assuranceResponse.error.message);
      }

      if (assuranceResponse.data.nextLevel === "aal2" && assuranceResponse.data.currentLevel !== "aal2") {
        const factorsResponse = await client.auth.mfa.listFactors();
        if (factorsResponse.error) {
          throw new Error(factorsResponse.error.message);
        }

        const totpFactor = factorsResponse.data.totp[0] ?? factorsResponse.data.all.find((factor) => factor.factor_type === "totp" && factor.status === "verified");
        if (!totpFactor) {
          throw new Error("Multi-factor authentication is required, but no verified authenticator app is available.");
        }

        setMfaFactorId(totpFactor.id);
        setMfaFactorLabel(totpFactor.friendly_name?.trim() || "Authenticator app");
        setMfaChallengeOpen(true);
        setMfaCode("");
        setMfaError(null);
        setPageMessage("Enter the code from your authenticator app to finish signing in.");
        return;
      }

      removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
      navigate(returnTo, { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMfaSubmitting(true);
    setMfaError(null);
    try {
      if (!mfaFactorId) {
        throw new Error("No authenticator app is available for this account.");
      }
      if (!mfaCode.trim()) {
        throw new Error("Authenticator code is required.");
      }

      const response = await client.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode.trim(),
      });
      if (response.error) {
        throw new Error(response.error.message);
      }

      setMfaChallengeOpen(false);
      setMfaCode("");
      setMfaFactorId(null);
      removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
      navigate(returnTo, { replace: true });
    } catch (nextError) {
      setMfaError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setMfaSubmitting(false);
    }
  }

  async function handleCancelMfaChallenge(): Promise<void> {
    try {
      await signOut({ tolerateNetworkFailure: true });
    } catch {
      // Best-effort cleanup; the page stays on the sign-in screen either way.
    }

    setMfaChallengeOpen(false);
    setMfaCode("");
    setMfaFactorId(null);
    setMfaError(null);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setRegistering(true);
    setRegistrationError(null);
    setPageMessage(null);
    try {
      const userNameValid =
        registrationUserNameAvailability.status === "available" && registrationUserNameAvailability.value === registrationUserName.trim()
          ? true
          : await validateRegistrationUserName();
      const emailValid = validateRegistrationEmail();
      if (!registrationFirstName.trim()) {
        throw new Error("First name is required.");
      }
      if (!registrationLastName.trim()) {
        throw new Error("Last name is required.");
      }
      const passwordValid = validateRegistrationPassword();
      const confirmPasswordValid = validateRegistrationConfirmPassword();
      if (!userNameValid) {
        throw new Error("Choose an available username before creating your account.");
      }
      if (!emailValid) {
        throw new Error("Enter a valid email address.");
      }
      if (!passwordValid) {
        throw new Error("Password does not meet the required policy.");
      }
      if (!confirmPasswordValid) {
        throw new Error("Password confirmation must match.");
      }
      if (captchaRequired && !registrationCaptchaToken) {
        throw new Error("Complete the human verification challenge.");
      }

      const result = await signUp({
        userName: registrationUserName.trim(),
        email: registrationEmail.trim(),
        password: registrationPassword,
        firstName: registrationFirstName.trim(),
        lastName: registrationLastName.trim(),
        avatarUrl: registrationAvatar.mode === "url" ? registrationAvatar.url.trim() || null : null,
        avatarDataUrl: registrationAvatar.mode === "upload" ? registrationAvatar.dataUrl : null,
        captchaToken: registrationCaptchaToken,
      } satisfies SignUpInput);
      if (result.requiresEmailConfirmation) {
        setConfirmationEmail(registrationEmail.trim());
        setConfirmationCode("");
        setConfirmationError(null);
        setPageMessage("Account created. Check your email to confirm the registration before signing in. You can open the email link or enter the confirmation code here.");
        setConfirmationModalOpen(true);
      } else {
        removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
        navigate(returnTo, { replace: true });
      }
      closeRegisterModal();
    } catch (nextError) {
      setRegistrationError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setRegistering(false);
    }
  }

  async function handleRegistrationAvatarUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) {
      setRegistrationAvatar((current) => ({ ...current, dataUrl: null, fileName: null }));
      return;
    }

    try {
      const upload = await readAvatarUpload(event);
      setRegistrationError(null);
      setRegistrationAvatar((current) => ({ ...current, mode: "upload", dataUrl: upload.dataUrl, fileName: upload.fileName }));
    } catch (nextError) {
      setRegistrationError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  async function handleRequestRecovery(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setRequestingRecovery(true);
    setRecoveryError(null);
    setRecoveryStatusMessage(null);
    try {
      await sendRecoveryEmail();
    } catch (nextError) {
      setRecoveryError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setRequestingRecovery(false);
    }
  }

  async function handleConfirmEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setConfirmingEmail(true);
    setConfirmationError(null);
    setPageMessage(null);
    try {
      if (!confirmationEmail.trim()) {
        throw new Error("Email is required.");
      }
      if (!confirmationCode.trim()) {
        throw new Error("Confirmation code is required.");
      }

      await verifyEmailCode(confirmationEmail.trim(), confirmationCode.trim());
      setConfirmationModalOpen(false);
      removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
      navigate(returnTo, { replace: true });
    } catch (nextError) {
      setConfirmationError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setConfirmingEmail(false);
    }
  }

  async function handleRecoveryCodeSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setVerifyingRecoveryCode(true);
    setRecoveryError(null);
    setRecoveryStatusMessage(null);
    try {
      if (!recoveryCode.trim()) {
        throw new Error("Recovery code is required.");
      }
      if (!recoveryEmail.trim()) {
        throw new Error("Email is required.");
      }

      await verifyRecoveryCode(recoveryEmail.trim(), recoveryCode.trim());
      setRecoveryStep("reset");
      setRecoveryError(null);
    } catch (nextError) {
      setRecoveryError(nextError instanceof Error ? nextError.message : "That recovery code was not accepted. Re-enter it or send another.");
    } finally {
      setVerifyingRecoveryCode(false);
    }
  }

  async function handleCompleteRecovery(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCompletingRecovery(true);
    setPasswordRecoveryError(null);
    try {
      if (!recoveryPassword) {
        throw new Error("New password is required.");
      }
      if (recoveryPassword !== recoveryConfirmPassword) {
        throw new Error("Password confirmation must match.");
      }

      await updatePassword(recoveryPassword);
      try {
        await signOut({ tolerateNetworkFailure: true });
      } catch {
        // Password recovery is complete once the password change succeeds.
        // If session revocation cannot be confirmed, continue back to sign-in.
      }
      setRecoveryModalOpen(false);
      resetRecoveryState();
      setPageMessage("Password updated. Sign in with your new password.");
      removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
      navigate("/auth/signin", { replace: true });
    } catch (nextError) {
      setPasswordRecoveryError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setCompletingRecovery(false);
    }
  }

  return (
    <div className="page-grid narrow">
      <section className="mx-auto w-full max-w-2xl app-panel p-8 text-center">
        <h1 className="app-page-title">Sign In</h1>

        <form className="mt-6 stack-form text-left" onSubmit={handleSubmit}>
          <Field label="Email">
            <input value={email} onChange={(event) => setEmail(event.currentTarget.value)} autoComplete="email" />
          </Field>
          <PasswordField
            label="Password"
            value={password}
            autoComplete="current-password"
            show={showSignInPassword}
            onChange={setPassword}
            onToggle={() => setShowSignInPassword((current) => !current)}
          />

          {error ? <p className="error-text">{error}</p> : null}

          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign In"}
            </button>
            <Link to="/browse" className="secondary-button">
              Back to browse
            </Link>
          </div>

          {pageMessage ? <p className="mt-4 text-center text-sm text-cyan-100">{pageMessage}</p> : null}

          <div className="mt-6 space-y-2 text-center text-sm text-slate-300">
            <p>
              No account?{" "}
              <button
                type="button"
                className="font-semibold text-cyan-100 transition hover:text-white"
                onClick={openRegisterModal}
              >
                Register now
              </button>
            </p>
            <p>
              Forgot your email or password?{" "}
              <button
                type="button"
                className="font-semibold text-cyan-100 transition hover:text-white"
                onClick={() => {
                  openRecoveryModal();
                }}
              >
                Recover access
              </button>
            </p>
            <p>
              Have a confirmation code?{" "}
              <button
                type="button"
                className="font-semibold text-cyan-100 transition hover:text-white"
                onClick={() => {
                  setConfirmationError(null);
                  setConfirmationModalOpen(true);
                }}
              >
                Confirm email
              </button>
            </p>
          </div>
        </form>
      </section>

      {registerModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8" onClick={closeRegisterModal}>
          <div className="mx-auto max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="register-modal-title">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="register-modal-title" className="text-2xl font-semibold text-white">Create account</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Register with Supabase auth. Your username stays with the account even if you change email later.
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={closeRegisterModal}>Close</button>
              </div>

              <form className="stack-form text-left" onSubmit={handleRegister}>
                <div className="form-grid">
                  <Field label="Username" required hint={registrationUserNameHint} hintTone={registrationUserNameHintTone}>
                    <input
                      value={registrationUserName}
                      onChange={(event) => {
                        setRegistrationUserName(event.currentTarget.value);
                        registrationUserNameCheckRequest.current += 1;
                        setRegistrationUserNameError(null);
                        setRegistrationUserNameAvailability({ status: "idle", value: event.currentTarget.value.trim() });
                      }}
                      onBlur={() => {
                        void validateRegistrationUserName();
                      }}
                      autoComplete="username"
                      aria-invalid={registrationUserNameHintTone === "error"}
                    />
                  </Field>
                  <Field label="Email" required hint={registrationEmailError} hintTone={registrationEmailError ? "error" : "default"}>
                    <input
                      value={registrationEmail}
                      onChange={(event) => {
                        setRegistrationEmail(event.currentTarget.value);
                        setRegistrationEmailError(null);
                      }}
                      onBlur={validateRegistrationEmail}
                      autoComplete="email"
                      aria-invalid={Boolean(registrationEmailError)}
                    />
                  </Field>
                  <Field label="First name" required>
                    <input value={registrationFirstName} onChange={(event) => setRegistrationFirstName(event.currentTarget.value)} autoComplete="given-name" />
                  </Field>
                  <Field label="Last name" required>
                    <input value={registrationLastName} onChange={(event) => setRegistrationLastName(event.currentTarget.value)} autoComplete="family-name" />
                  </Field>
                  <PasswordField
                    label="Password"
                    value={registrationPassword}
                    autoComplete="new-password"
                    show={showRegistrationPassword}
                    onChange={(value) => {
                      setRegistrationPassword(value);
                      setRegistrationPasswordErrors([]);
                      setRegistrationConfirmPasswordError(null);
                    }}
                    onBlur={validateRegistrationPassword}
                    onToggle={() => setShowRegistrationPassword((current) => !current)}
                    hint={registrationPasswordHint}
                    hintTone={registrationPasswordHintTone}
                    required
                  />
                  <PasswordField
                    label="Confirm password"
                    value={registrationConfirmPassword}
                    autoComplete="new-password"
                    show={showRegistrationConfirmPassword}
                    onChange={(value) => {
                      setRegistrationConfirmPassword(value);
                      setRegistrationConfirmPasswordError(null);
                    }}
                    onBlur={validateRegistrationConfirmPassword}
                    onToggle={() => setShowRegistrationConfirmPassword((current) => !current)}
                    hint={registrationConfirmPasswordError}
                    hintTone={registrationConfirmPasswordError ? "error" : "default"}
                    required
                  />
                </div>

                <AvatarEditor
                  state={registrationAvatar}
                  disabled={registering}
                  onModeChange={(mode) => setRegistrationAvatar((current) => ({ ...current, mode }))}
                  onUrlChange={(value) => setRegistrationAvatar((current) => ({ ...current, url: value }))}
                  onUpload={(event) => void handleRegistrationAvatarUpload(event)}
                />

                {captchaRequired ? (
                  <div className="surface-panel-strong rounded-[1rem] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Human verification</div>
                    <CaptchaWidget
                      mode={captchaMode}
                      siteKey={appConfig.turnstileSiteKey}
                      token={registrationCaptchaToken}
                      onTokenChange={setRegistrationCaptchaToken}
                    />
                  </div>
                ) : null}

                {registrationError ? <p className="error-text">{registrationError}</p> : null}

                <div className="button-row">
                  <button type="submit" className="primary-button" disabled={registering || !registrationCanSubmit}>
                    {registering ? "Creating account..." : "Create account"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}

      {recoveryModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8" onClick={closeRecoveryModal}>
          <div className="mx-auto max-w-xl" onClick={(event) => event.stopPropagation()}>
            <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="recovery-modal-title">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="recovery-modal-title" className="text-2xl font-semibold text-white">
                    {recoveryStep === "reset" ? "Set new password" : "Recover access"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    {recoveryStep === "request"
                      ? "Enter your email address and we will send a recovery link plus a verification code."
                      : recoveryStep === "code"
                        ? "Enter the recovery code from your email. If the code does not work, send another and try again."
                        : "Enter your new password to complete account recovery."}
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={closeRecoveryModal}>Close</button>
              </div>

              {recoveryStep === "request" ? (
                <form className="stack-form text-left" onSubmit={handleRequestRecovery}>
                  <Field label="Email">
                    <input value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.currentTarget.value)} autoComplete="email" />
                  </Field>

                  {captchaRequired ? (
                    <div className="surface-panel-strong rounded-[1rem] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Human verification</div>
                      <CaptchaWidget
                        mode={captchaMode}
                        siteKey={appConfig.turnstileSiteKey}
                        token={recoveryCaptchaToken}
                        onTokenChange={setRecoveryCaptchaToken}
                      />
                    </div>
                  ) : null}

                  <div className="button-row">
                    <button type="submit" className="primary-button" disabled={requestingRecovery}>
                      {requestingRecovery ? "Sending..." : "Send recovery email"}
                    </button>
                  </div>
                </form>
              ) : null}

              {recoveryStep === "code" ? (
                <form className="stack-form text-left" onSubmit={handleRecoveryCodeSubmit}>
                  <div className="text-sm text-slate-400 mb-4">Sent to {recoveryEmail}</div>
                  <Field label="Recovery code">
                    <input value={recoveryCode} onChange={(event) => setRecoveryCode(event.currentTarget.value)} autoComplete="one-time-code" />
                  </Field>

                  <div className="button-row">
                    <button type="submit" className="primary-button" disabled={verifyingRecoveryCode}>
                      {verifyingRecoveryCode ? "Confirming..." : "Confirm code"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={requestingRecovery}
                      onClick={() => {
                        setRecoveryStep("request");
                        setRecoveryError(null);
                        setRecoveryStatusMessage(null);
                      }}
                    >
                      Send another code
                    </button>
                  </div>
                </form>
              ) : null}

              {recoveryStep === "reset" ? (
              <form className="stack-form text-left" onSubmit={handleCompleteRecovery}>
                <PasswordField
                  label="New password"
                  value={recoveryPassword}
                  autoComplete="new-password"
                  show={showRecoveryPassword}
                  onChange={setRecoveryPassword}
                  onToggle={() => setShowRecoveryPassword((current) => !current)}
                />
                <PasswordField
                  label="Confirm password"
                  value={recoveryConfirmPassword}
                  autoComplete="new-password"
                  show={showRecoveryConfirmPassword}
                  onChange={setRecoveryConfirmPassword}
                  onToggle={() => setShowRecoveryConfirmPassword((current) => !current)}
                />

                {passwordRecoveryError ? <p className="error-text">{passwordRecoveryError}</p> : null}

                <div className="button-row">
                  <button type="submit" className="primary-button" disabled={completingRecovery}>
                    {completingRecovery ? "Updating password..." : "Save new password"}
                  </button>
                </div>
              </form>
              ) : null}

              {recoveryStatusMessage ? <p className="text-sm text-cyan-100">{recoveryStatusMessage}</p> : null}
              {recoveryError ? <p className="error-text">{recoveryError}</p> : null}
            </section>
          </div>
        </div>
      ) : null}

      {confirmationModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8" onClick={() => setConfirmationModalOpen(false)}>
          <div className="mx-auto max-w-xl" onClick={(event) => event.stopPropagation()}>
            <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="confirmation-modal-title">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="confirmation-modal-title" className="text-2xl font-semibold text-white">Confirm email</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Enter the confirmation code from your email if you do not want to open the verification link.
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={() => setConfirmationModalOpen(false)}>Close</button>
              </div>

              <form className="stack-form text-left" onSubmit={handleConfirmEmail}>
                <Field label="Email">
                  <input value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.currentTarget.value)} autoComplete="email" />
                </Field>
                <Field label="Confirmation code">
                  <input value={confirmationCode} onChange={(event) => setConfirmationCode(event.currentTarget.value)} autoComplete="one-time-code" />
                </Field>

                {confirmationError ? <p className="error-text">{confirmationError}</p> : null}

                <div className="button-row">
                  <button type="submit" className="primary-button" disabled={confirmingEmail}>
                    {confirmingEmail ? "Confirming..." : "Confirm email"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}

      {mfaChallengeOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8" onClick={() => void handleCancelMfaChallenge()}>
          <div className="mx-auto max-w-xl" onClick={(event) => event.stopPropagation()}>
            <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="mfa-modal-title">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="mfa-modal-title" className="text-2xl font-semibold text-white">Complete sign-in</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Enter the current code from {mfaFactorLabel.toLowerCase()} to finish signing in.
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={() => void handleCancelMfaChallenge()}>Cancel</button>
              </div>

              <form className="stack-form text-left" onSubmit={handleMfaSubmit}>
                <Field label="Authenticator code">
                  <input value={mfaCode} onChange={(event) => setMfaCode(event.currentTarget.value)} autoComplete="one-time-code" inputMode="numeric" />
                </Field>

                {mfaError ? <p className="error-text">{mfaError}</p> : null}

                <div className="button-row">
                  <button type="submit" className="primary-button" disabled={mfaSubmitting}>
                    {mfaSubmitting ? "Verifying..." : "Verify code"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SignOutPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      try {
        await signOut();
      } finally {
        if (!cancelled) {
          navigate("/", { replace: true });
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, signOut]);

  return <LoadingPanel title="Signing out..." />;
}

function PlayerPage() {
  const { client, session, currentUser, refreshCurrentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReportId = searchParams.get("reportId");
  const accessToken = session?.access_token ?? "";
  const authSubject = currentUser?.subject ?? "";
  const playerDraftRef = useRef<PlayerPageDraftState | null>(null);
  if (playerDraftRef.current === null) {
    const storedDraft = readSessionStorageJson<Partial<PlayerPageDraftState>>(PLAYER_PAGE_DRAFT_STORAGE_KEY);
    playerDraftRef.current = {
      displayName: storedDraft?.displayName ?? "",
      firstName: storedDraft?.firstName ?? "",
      lastName: storedDraft?.lastName ?? "",
      email: storedDraft?.email ?? "",
      settingsCurrentPassword: storedDraft?.settingsCurrentPassword ?? "",
      showSettingsCurrentPassword: storedDraft?.showSettingsCurrentPassword ?? false,
      profileAvatar: restoreAvatarEditorState(storedDraft?.profileAvatar),
      profileEditMode: storedDraft?.profileEditMode ?? false,
      settingsEditMode: storedDraft?.settingsEditMode ?? false,
      newPassword: storedDraft?.newPassword ?? "",
      confirmNewPassword: storedDraft?.confirmNewPassword ?? "",
      showNewPassword: storedDraft?.showNewPassword ?? false,
      showConfirmNewPassword: storedDraft?.showConfirmNewPassword ?? false,
      mfaEnrollmentCode: storedDraft?.mfaEnrollmentCode ?? "",
      mfaDisableCode: storedDraft?.mfaDisableCode ?? "",
      reportReply: storedDraft?.reportReply ?? "",
      selectedReportId: typeof storedDraft?.selectedReportId === "string" ? storedDraft.selectedReportId : null,
    };
  }
  const playerDraft = playerDraftRef.current;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [boardProfile, setBoardProfile] = useState<BoardProfile | null>(null);
  const [displayName, setDisplayName] = useState(playerDraft.displayName);
  const [firstName, setFirstName] = useState(playerDraft.firstName);
  const [lastName, setLastName] = useState(playerDraft.lastName);
  const [email, setEmail] = useState(playerDraft.email);
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState(playerDraft.settingsCurrentPassword);
  const [showSettingsCurrentPassword, setShowSettingsCurrentPassword] = useState(playerDraft.showSettingsCurrentPassword);
  const [profileAvatar, setProfileAvatar] = useState<AvatarEditorState>(playerDraft.profileAvatar);
  const [profileEditMode, setProfileEditMode] = useState(playerDraft.profileEditMode);
  const [settingsEditMode, setSettingsEditMode] = useState(playerDraft.settingsEditMode);
  const [newPassword, setNewPassword] = useState(playerDraft.newPassword);
  const [confirmNewPassword, setConfirmNewPassword] = useState(playerDraft.confirmNewPassword);
  const [showNewPassword, setShowNewPassword] = useState(playerDraft.showNewPassword);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(playerDraft.showConfirmNewPassword);
  const [mfaEnrollmentCode, setMfaEnrollmentCode] = useState(playerDraft.mfaEnrollmentCode);
  const [mfaDisableCode, setMfaDisableCode] = useState(playerDraft.mfaDisableCode);
  const [developerAccessEnabled, setDeveloperAccessEnabled] = useState(false);
  const [verifiedDeveloper, setVerifiedDeveloper] = useState(false);
  const [mfaTotpFactor, setMfaTotpFactor] = useState<{ id: string; friendlyName: string | null; status: "verified" | "unverified" } | null>(null);
  const [mfaAssuranceLevel, setMfaAssuranceLevel] = useState<string | null>(null);
  const [mfaPendingEnrollment, setMfaPendingEnrollment] = useState<{ id: string; qrCode: string; secret: string; friendlyName: string } | null>(null);
  const [libraryTitles, setLibraryTitles] = useState<CatalogTitleSummary[]>([]);
  const [wishlistTitles, setWishlistTitles] = useState<CatalogTitleSummary[]>([]);
  const [reports, setReports] = useState<PlayerTitleReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(playerDraft.selectedReportId);
  const [selectedReport, setSelectedReport] = useState<TitleReportDetail | null>(null);
  const [reportReply, setReportReply] = useState(playerDraft.reportReply);
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmailChange, setPendingEmailChange] = useState<string | null>(null);

  useEffect(() => {
    const nextPendingEmail =
      typeof session?.user?.new_email === "string" && session.user.new_email.trim().length > 0
        ? session.user.new_email.trim().toLowerCase()
        : null;
    setPendingEmailChange(nextPendingEmail);
  }, [session?.user?.new_email]);

  async function loadBoardProfileSafe(): Promise<BoardProfile | null> {
    try {
      const response = await getBoardProfile(appConfig.apiBaseUrl, accessToken);
      return response.boardProfile;
    } catch (nextError) {
      if (isApiErrorStatus(nextError, 404)) {
        return null;
      }

      throw nextError;
    }
  }

  async function refreshReportList(preferredReportId?: string | null): Promise<void> {
    const response = await getPlayerTitleReports(appConfig.apiBaseUrl, accessToken);
    setReports(response.reports);
    const nextSelectedReportId =
      response.reports.find((report) => report.id === preferredReportId)?.id ??
      response.reports.find((report) => report.id === requestedReportId)?.id ??
      response.reports.find((report) => report.id === selectedReportId)?.id ??
      response.reports[0]?.id ??
      null;
    setSelectedReportId(nextSelectedReportId);
  }

  async function loadMfaState(): Promise<{
    factor: { id: string; friendlyName: string | null; status: "verified" | "unverified" } | null;
    assuranceLevel: string | null;
  }> {
    const [factorsResponse, assuranceResponse] = await Promise.all([
      client.auth.mfa.listFactors(),
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factorsResponse.error) {
      throw new Error(factorsResponse.error.message);
    }
    if (assuranceResponse.error) {
      throw new Error(assuranceResponse.error.message);
    }

    const totpFactor = factorsResponse.data.totp[0] ?? factorsResponse.data.all.find((factor) => factor.factor_type === "totp");
    return {
      factor: totpFactor
        ? {
            id: totpFactor.id,
            friendlyName: totpFactor.friendly_name?.trim() || null,
            status: totpFactor.status,
          }
        : null,
      assuranceLevel: assuranceResponse.data.currentLevel ?? "aal1",
    };
  }

  async function confirmCurrentPassword(passwordToConfirm: string): Promise<void> {
    const currentEmail = profile?.email?.trim().toLowerCase() ?? "";
    if (!currentEmail) {
      throw new Error("Email is not available for this account.");
    }
    if (!passwordToConfirm) {
      throw new Error("Current password is required.");
    }

    const response = await client.auth.signInWithPassword({
      email: currentEmail,
      password: passwordToConfirm,
    });
    if (response.error) {
      throw new Error("Current password was not accepted.");
    }
  }

  useEffect(() => {
    const hasDraft =
      profileEditMode ||
      settingsEditMode ||
      settingsCurrentPassword.length > 0 ||
      newPassword.length > 0 ||
      confirmNewPassword.length > 0 ||
      mfaEnrollmentCode.trim().length > 0 ||
      mfaDisableCode.trim().length > 0 ||
      reportReply.trim().length > 0;
    if (!hasDraft) {
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      return;
    }

    writeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY, {
      displayName,
      firstName,
      lastName,
      email,
      settingsCurrentPassword,
      showSettingsCurrentPassword,
      profileAvatar,
      profileEditMode,
      settingsEditMode,
      newPassword,
      confirmNewPassword,
      showNewPassword,
      showConfirmNewPassword,
      mfaEnrollmentCode,
      mfaDisableCode,
      reportReply,
      selectedReportId,
    } satisfies PlayerPageDraftState);
  }, [
    confirmNewPassword,
    displayName,
    email,
    firstName,
    lastName,
    mfaDisableCode,
    mfaEnrollmentCode,
    newPassword,
    profileAvatar,
    profileEditMode,
    reportReply,
    selectedReportId,
    settingsCurrentPassword,
    settingsEditMode,
    showConfirmNewPassword,
    showNewPassword,
    showSettingsCurrentPassword,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [profileResponse, enrollmentResponse, boardProfileResponse, libraryResponse, wishlistResponse] = await Promise.all([
          getUserProfile(appConfig.apiBaseUrl, accessToken),
          getDeveloperEnrollment(appConfig.apiBaseUrl, accessToken),
          loadBoardProfileSafe(),
          getPlayerLibrary(appConfig.apiBaseUrl, accessToken),
          getPlayerWishlist(appConfig.apiBaseUrl, accessToken),
        ]);
        const reportsResponse = await getPlayerTitleReports(appConfig.apiBaseUrl, accessToken);
        const mfaState = await loadMfaState();
        if (cancelled) {
          return;
        }

        setProfile(profileResponse.profile);
        setBoardProfile(boardProfileResponse);
        setDisplayName(profileEditMode ? displayName : profileResponse.profile.displayName ?? "");
        setFirstName(settingsEditMode ? firstName : profileResponse.profile.firstName ?? "");
        setLastName(settingsEditMode ? lastName : profileResponse.profile.lastName ?? "");
        setEmail(settingsEditMode ? email : pendingEmailChange ?? profileResponse.profile.email ?? "");
        setProfileAvatar(profileEditMode ? profileAvatar : createAvatarEditorState(profileResponse.profile));
        setDeveloperAccessEnabled(enrollmentResponse.developerEnrollment.developerAccessEnabled);
        setVerifiedDeveloper(enrollmentResponse.developerEnrollment.verifiedDeveloper);
        setMfaTotpFactor(mfaState.factor);
        setMfaAssuranceLevel(mfaState.assuranceLevel);
        if (mfaState.factor?.status === "verified") {
          setMfaPendingEnrollment(null);
        }
        setLibraryTitles(libraryResponse.titles);
        setWishlistTitles(wishlistResponse.titles);
        setReports(reportsResponse.reports);
        setSelectedReportId(
          reportsResponse.reports.find((report) => report.id === requestedReportId)?.id ??
          reportsResponse.reports.find((report) => report.id === selectedReportId)?.id ??
          reportsResponse.reports[0]?.id ??
          null,
        );
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authSubject, pendingEmailChange, requestedReportId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedReport(): Promise<void> {
      if (!selectedReportId) {
        setSelectedReport(null);
        return;
      }

      setReportLoading(true);
      try {
        const response = await getPlayerTitleReport(appConfig.apiBaseUrl, accessToken, selectedReportId);
        if (!cancelled) {
          setSelectedReport(response.report);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setReportLoading(false);
        }
      }
    }

    void loadSelectedReport();
    return () => {
      cancelled = true;
    };
  }, [authSubject, selectedReportId]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!profileEditMode) {
      setProfileEditMode(true);
      setMessage(null);
      setError(null);
      return;
    }

    setSaving(true);
    try {
      const response = await updateUserProfile(appConfig.apiBaseUrl, accessToken, {
        displayName,
        avatarUrl: profileAvatar.mode === "url" ? profileAvatar.url.trim() || null : null,
        avatarDataUrl: profileAvatar.mode === "upload" ? profileAvatar.dataUrl : null,
      });
      setProfile(response.profile);
      setDisplayName(response.profile.displayName ?? "");
      setProfileAvatar(createAvatarEditorState(response.profile));
      setProfileEditMode(false);
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      await refreshCurrentUser();
      setMessage("Profile updated.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleProfileAvatarUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) {
      setProfileAvatar((current) => ({ ...current, dataUrl: null, fileName: null }));
      return;
    }

    try {
      const upload = await readAvatarUpload(event);
      setProfileAvatar((current) => ({ ...current, mode: "upload", dataUrl: upload.dataUrl, fileName: upload.fileName }));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  async function handleSettingsSave(): Promise<void> {
    if (!settingsEditMode) {
      setSettingsEditMode(true);
      setMessage(null);
      setError(null);
      return;
    }

    setSaving(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const currentEmail = profile?.email?.trim().toLowerCase() ?? "";
      const emailChanged = normalizedEmail !== currentEmail;

      if (normalizedEmail.length === 0) {
        throw new Error("Email is required.");
      }

      let nextPendingEmail = pendingEmailChange;
      if (emailChanged) {
        await confirmCurrentPassword(settingsCurrentPassword);
        const emailUpdate = await client.auth.updateUser({ email: normalizedEmail });
        if (emailUpdate.error) {
          throw new Error(emailUpdate.error.message);
        }

        const updatedAuthUser = emailUpdate.data.user;
        nextPendingEmail =
          typeof updatedAuthUser?.new_email === "string" && updatedAuthUser.new_email.trim().length > 0
            ? updatedAuthUser.new_email.trim().toLowerCase()
            : null;
      }

      const response = await updateUserProfile(appConfig.apiBaseUrl, accessToken, {
        firstName,
        lastName,
      });
      await refreshCurrentUser();
      setProfile(response.profile);
      setFirstName(response.profile.firstName ?? "");
      setLastName(response.profile.lastName ?? "");
      setEmail(nextPendingEmail ?? normalizedEmail);
      setPendingEmailChange(nextPendingEmail);
      setSettingsCurrentPassword("");
      setShowSettingsCurrentPassword(false);
      setSettingsEditMode(false);
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage(
        emailChanged && nextPendingEmail
          ? `Settings updated. Confirm the email change from the message sent to ${nextPendingEmail}.`
          : "Settings updated.",
      );
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChangeSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (!settingsCurrentPassword) {
        throw new Error("Current password is required.");
      }
      if (!newPassword) {
        throw new Error("New password is required.");
      }

      const passwordErrors = getPasswordPolicyErrors(newPassword);
      if (passwordErrors.length > 0) {
        throw new Error(passwordErrors[0] ?? "Password does not meet the required policy.");
      }
      if (validatePasswordConfirmation(newPassword, confirmNewPassword)) {
        throw new Error("Password confirmation must match.");
      }

      await confirmCurrentPassword(settingsCurrentPassword);
      const response = await client.auth.updateUser({ password: newPassword, current_password: settingsCurrentPassword });
      if (response.error) {
        throw new Error(response.error.message);
      }

      setSettingsCurrentPassword("");
      setShowSettingsCurrentPassword(false);
      setNewPassword("");
      setConfirmNewPassword("");
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage("Password updated.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleStartMfaEnrollment(): Promise<void> {
    setSaving(true);
    try {
      const response = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Board Enthusiasts Authenticator",
        issuer: "Board Enthusiasts",
      });
      if (response.error) {
        throw new Error(response.error.message);
      }

      setMfaPendingEnrollment({
        id: response.data.id,
        qrCode: response.data.totp.qr_code,
        secret: response.data.totp.secret,
        friendlyName: response.data.friendly_name ?? "Board Enthusiasts Authenticator",
      });
      setMfaEnrollmentCode("");
      setMessage("Scan the authenticator QR code, then enter the current code to finish enabling MFA.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyMfaEnrollment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (!mfaPendingEnrollment) {
        throw new Error("Start MFA setup before verifying a code.");
      }
      if (!mfaEnrollmentCode.trim()) {
        throw new Error("Authenticator code is required.");
      }

      const response = await client.auth.mfa.challengeAndVerify({
        factorId: mfaPendingEnrollment.id,
        code: mfaEnrollmentCode.trim(),
      });
      if (response.error) {
        throw new Error(response.error.message);
      }

      const mfaState = await loadMfaState();
      await refreshCurrentUser();
      setMfaTotpFactor(mfaState.factor);
      setMfaAssuranceLevel(mfaState.assuranceLevel);
      setMfaPendingEnrollment(null);
      setMfaEnrollmentCode("");
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage("Authenticator app enabled.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableMfa(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (!mfaTotpFactor) {
        throw new Error("No authenticator app is enabled for this account.");
      }
      if (!mfaDisableCode.trim()) {
        throw new Error("Authenticator code is required.");
      }

      const verification = await client.auth.mfa.challengeAndVerify({
        factorId: mfaTotpFactor.id,
        code: mfaDisableCode.trim(),
      });
      if (verification.error) {
        throw new Error(verification.error.message);
      }

      const unenrollResponse = await client.auth.mfa.unenroll({ factorId: mfaTotpFactor.id });
      if (unenrollResponse.error) {
        throw new Error(unenrollResponse.error.message);
      }

      const mfaState = await loadMfaState();
      await refreshCurrentUser();
      setMfaTotpFactor(mfaState.factor);
      setMfaAssuranceLevel(mfaState.assuranceLevel);
      setMfaDisableCode("");
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage("Authenticator app removed.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleCollectionRemoval(collection: "library" | "wishlist", titleId: string): Promise<void> {
    setSaving(true);
    try {
      if (collection === "library") {
        await removeTitleFromPlayerLibrary(appConfig.apiBaseUrl, accessToken, titleId);
        const response = await getPlayerLibrary(appConfig.apiBaseUrl, accessToken);
        setLibraryTitles(response.titles);
        setMessage("Removed from your library.");
      } else {
        await removeTitleFromPlayerWishlist(appConfig.apiBaseUrl, accessToken, titleId);
        const response = await getPlayerWishlist(appConfig.apiBaseUrl, accessToken);
        setWishlistTitles(response.titles);
        setMessage("Removed from your wishlist.");
      }
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleReportReplySubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedReportId) {
      return;
    }

    setSaving(true);
    try {
      const response = await addPlayerTitleReportMessage(appConfig.apiBaseUrl, accessToken, selectedReportId, {
        message: reportReply,
      });
      setSelectedReport(response.report);
      await refreshReportList(selectedReportId);
      setReportReply("");
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage("Reply added to the report thread.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  function getActiveWorkflow(): "library-games" | "library-wishlist" | "reported-titles" | "account-profile" | "account-settings" {
    const workflow = searchParams.get("workflow");
    if (location.pathname.endsWith("/wishlist")) {
      return "library-wishlist";
    }
    if (workflow === "reported-titles") {
      return "reported-titles";
    }
    if (workflow === "account-profile") {
      return "account-profile";
    }
    if (workflow === "account-settings") {
      return "account-settings";
    }
    return "library-games";
  }

  const activeWorkflow = getActiveWorkflow();
  const activeDomain = activeWorkflow.startsWith("account-") ? "account" : "library";
  const hasDeveloperRole = currentUser?.roles.includes("developer") ?? false;

  function navigateToWorkflow(workflow: string): void {
    switch (workflow) {
      case "library-games":
        navigate("/player");
        return;
      case "library-wishlist":
        navigate("/player/wishlist");
        return;
      case "reported-titles":
        navigate("/player?workflow=reported-titles");
        return;
      case "account-profile":
        navigate("/player?workflow=account-profile");
        return;
      case "account-settings":
        navigate("/player?workflow=account-settings");
        return;
      default:
        navigate("/player");
    }
  }

  if (loading) {
    return <LoadingPanel title="Loading player workspace..." />;
  }

  if (error && !profile) {
    return <ErrorPanel detail={error} />;
  }

  return (
    <section className="app-workspace-shell space-y-6">
      <section className="app-workspace-content">
        <section className="app-panel w-full p-4">
          <div className="flex flex-wrap gap-2">
            <button className={activeDomain === "library" ? "primary-button" : "secondary-button"} type="button" onClick={() => navigateToWorkflow("library-games")}>
              Library
            </button>
            <button className={activeDomain === "account" ? "primary-button" : "secondary-button"} type="button" onClick={() => navigateToWorkflow("account-profile")}>
              Account
            </button>
          </div>
        </section>

        <section className="app-workspace-grid">
          <aside className="app-panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Section</div>
            <nav className="mt-3 space-y-2">
              {[
                ["library-games", "My Games"],
                ["library-wishlist", "Wishlist"],
                ["reported-titles", "Reported Titles"],
                ["account-profile", "Profile"],
                ["account-settings", "Account Settings"],
              ]
                .filter(([key]) => (activeDomain === "library" ? !String(key).startsWith("account-") : String(key).startsWith("account-")))
                .map(([key, label]) => (
                  <button
                    key={key}
                    className={activeWorkflow === key ? "w-full rounded-[0.9rem] border border-cyan-300/45 bg-cyan-300/15 px-3 py-2 text-left text-sm text-cyan-50" : "surface-panel-strong w-full rounded-[0.9rem] px-3 py-2 text-left text-sm text-slate-200 transition hover:border-cyan-300/45 hover:text-cyan-100"}
                    type="button"
                    onClick={() => navigateToWorkflow(key)}
                  >
                    {label}
                  </button>
                ))}
            </nav>
          </aside>

          <section className="app-panel app-workspace-main p-6">
            {activeWorkflow === "library-games" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">My Games</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Titles you marked as owned appear here.</p>
                {libraryTitles.length > 0 ? (
                  <div className="mt-6 list-stack">
                    {libraryTitles.map((title) => (
                      <article key={title.id} className="list-item">
                        <div>
                          <strong>{title.displayName}</strong>
                          <p>{title.shortDescription}</p>
                        </div>
                        <div className="button-row compact">
                          <Link className="secondary-button" to={`/browse/${title.studioSlug}/${title.slug}`}>
                            Open title
                          </Link>
                          <button type="button" className="danger-button" disabled={saving} onClick={() => void handleCollectionRemoval("library", title.id)}>
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <CompactTitleList titles={libraryTitles} emptyTitle="Your library is empty" emptyDetail="Browse titles and add the ones you already own." />
                    <div>
                      <Link className="primary-button" to="/browse">
                        Browse
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {activeWorkflow === "library-wishlist" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Wishlist</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Save titles you want to come back to later.</p>
                {wishlistTitles.length > 0 ? (
                  <div className="mt-6 list-stack">
                    {wishlistTitles.map((title) => (
                      <article key={title.id} className="list-item">
                        <div>
                          <strong>{title.displayName}</strong>
                          <p>{title.shortDescription}</p>
                        </div>
                        <div className="button-row compact">
                          <Link className="secondary-button" to={`/browse/${title.studioSlug}/${title.slug}`}>
                            Open title
                          </Link>
                          <button type="button" className="danger-button" disabled={saving} onClick={() => void handleCollectionRemoval("wishlist", title.id)}>
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <CompactTitleList titles={wishlistTitles} emptyTitle="Your wishlist is empty" emptyDetail="Save titles here to revisit them later." />
                    <div>
                      <Link className="primary-button" to="/browse">
                        Browse
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {activeWorkflow === "reported-titles" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Reported Titles</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Track moderator follow-up on your reported titles.</p>
                <div className="mt-6 grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
                  <section className="surface-panel-soft rounded-[1.25rem] p-4">
                    <PlayerReportList reports={reports} selectedReportId={selectedReportId} onSelect={setSelectedReportId} />
                  </section>
                  <section className="surface-panel-soft rounded-[1.25rem] p-4">
                    {reportLoading ? <LoadingPanel title="Loading report..." /> : null}
                    {!reportLoading && selectedReport ? <TitleReportConversation detail={selectedReport} viewerRole="player" /> : null}
                    {!reportLoading && !selectedReport ? (
                      <EmptyState title="Select a report" detail="Open a report thread to review moderator updates or reply." />
                    ) : null}
                    {selectedReport ? (
                      <form className="mt-6 stack-form" onSubmit={handleReportReplySubmit}>
                        <Field label="Reply to moderators">
                          <textarea rows={4} value={reportReply} onChange={(event) => setReportReply(event.currentTarget.value)} />
                        </Field>
                        <div className="button-row">
                          <button type="submit" className="primary-button" disabled={saving || reportReply.trim().length === 0}>
                            {saving ? "Sending..." : "Send reply"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </section>
                </div>
              </>
            ) : null}

            {activeWorkflow === "account-profile" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Profile</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Update your profile details.</p>
                <form className="mt-6 stack-form" onSubmit={handleProfileSubmit}>
                  <Field label="Display name">
                    <input value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} disabled={!profileEditMode || saving} />
                  </Field>

                  <AvatarEditor
                    state={profileAvatar}
                    disabled={!profileEditMode || saving}
                    onModeChange={(mode) => setProfileAvatar((current) => ({ ...current, mode }))}
                    onUrlChange={(value) => setProfileAvatar((current) => ({ ...current, url: value }))}
                    onUpload={(event) => void handleProfileAvatarUpload(event)}
                  />

                  <div className="surface-panel-soft rounded-[1rem] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Board profile</div>
                    <div className="mt-2 text-white">{boardProfile ? boardProfile.displayName : "No linked Board profile"}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">Sign in to the Board Enthusiasts app on your Board console to link your Board profile.</p>
                  </div>

                  {message ? <p className="success-text">{message}</p> : null}
                  {error ? <p className="error-text">{error}</p> : null}
                  <button type="submit" className={profileEditMode ? "primary-button" : "secondary-button"} disabled={saving}>
                    {saving ? "Saving..." : profileEditMode ? "Save Profile" : "Edit Profile"}
                  </button>
                </form>
              </>
            ) : null}

            {activeWorkflow === "account-settings" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Account Settings</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Review access, verification, and account details.</p>
                <div className="mt-6 stack-form">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name">
                      <input value={firstName} onChange={(event) => setFirstName(event.currentTarget.value)} disabled={!settingsEditMode || saving} />
                    </Field>
                    <Field label="Last name">
                      <input value={lastName} onChange={(event) => setLastName(event.currentTarget.value)} disabled={!settingsEditMode || saving} />
                    </Field>
                    <Field label="Email">
                      <input type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} disabled={!settingsEditMode || saving} />
                    </Field>
                    <PasswordField
                      label="Current password"
                      value={settingsCurrentPassword}
                      autoComplete="current-password"
                      show={showSettingsCurrentPassword}
                      onChange={setSettingsCurrentPassword}
                      onToggle={() => setShowSettingsCurrentPassword((current) => !current)}
                      disabled={!settingsEditMode || saving}
                      hint={settingsEditMode ? "Required when you change your email address." : undefined}
                    />
                  </div>

                  <div className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
                    <div className="surface-panel-soft rounded-[1.25rem] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Email verification</div>
                      <div className="mt-2 text-base text-white">
                        {pendingEmailChange ? "Confirmation sent" : currentUser?.emailVerified ? "Verified" : "Pending"}
                      </div>
                      {pendingEmailChange ? (
                        <p className="mt-3 text-sm leading-7 text-slate-300">Confirm the change from the email sent to {pendingEmailChange}. Your current sign-in email stays active until then.</p>
                      ) : null}
                    </div>
                    <div className="surface-panel-soft rounded-[1.25rem] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Library titles</div>
                      <div className="mt-2 text-base text-white">{libraryTitles.length}</div>
                    </div>
                    <div className="surface-panel-soft rounded-[1.25rem] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Wishlist titles</div>
                      <div className="mt-2 text-base text-white">{wishlistTitles.length}</div>
                    </div>
                  </div>

                  <div className="surface-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Developer access</div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Access</div>
                        <div className="mt-2 text-base text-white">{developerAccessEnabled ? "Enabled" : "Not enabled"}</div>
                      </div>
                      {hasDeveloperRole ? (
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Verified developer</div>
                          <div className="mt-2 text-base text-white">{verifiedDeveloper ? "Verified" : "Not verified"}</div>
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      {developerAccessEnabled ? "Manage developer access from the Develop workspace." : "Enable developer access from the Develop workspace."}
                    </p>
                    <div className="mt-4">
                      <Link className="secondary-button" to="/develop">
                        Open Develop
                      </Link>
                    </div>
                  </div>

                  <div className="surface-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Password</div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">Change your password from account settings without leaving the signed-in workspace.</p>
                    <form className="mt-4 stack-form" onSubmit={handlePasswordChangeSubmit}>
                      <PasswordField
                        label="Current password"
                        value={settingsCurrentPassword}
                        autoComplete="current-password"
                        show={showSettingsCurrentPassword}
                        onChange={setSettingsCurrentPassword}
                        onToggle={() => setShowSettingsCurrentPassword((current) => !current)}
                        disabled={saving}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <PasswordField
                          label="New password"
                          value={newPassword}
                          autoComplete="new-password"
                          show={showNewPassword}
                          onChange={setNewPassword}
                          onToggle={() => setShowNewPassword((current) => !current)}
                          disabled={saving}
                        />
                        <PasswordField
                          label="Confirm password"
                          value={confirmNewPassword}
                          autoComplete="new-password"
                          show={showConfirmNewPassword}
                          onChange={setConfirmNewPassword}
                          onToggle={() => setShowConfirmNewPassword((current) => !current)}
                          disabled={saving}
                        />
                      </div>
                      <div className="button-row">
                        <button type="submit" className="secondary-button" disabled={saving}>
                          {saving ? "Updating..." : "Change Password"}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="surface-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Multi-factor authentication</div>
                    <div className="mt-3 text-base text-white">
                      {mfaTotpFactor?.status === "verified" ? "Authenticator app enabled" : mfaPendingEnrollment ? "Finish authenticator setup" : "Authenticator app not enabled"}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {mfaTotpFactor?.status === "verified"
                        ? `This account is protected with ${mfaTotpFactor.friendlyName ?? "an authenticator app"}. Current assurance level: ${mfaAssuranceLevel ?? "aal1"}.`
                        : "Use an authenticator app to add a second step during sign-in."}
                    </p>

                    {!mfaTotpFactor && !mfaPendingEnrollment ? (
                      <div className="mt-4">
                        <button type="button" className="secondary-button" disabled={saving} onClick={() => void handleStartMfaEnrollment()}>
                          {saving ? "Starting..." : "Set Up Authenticator App"}
                        </button>
                      </div>
                    ) : null}

                    {mfaPendingEnrollment ? (
                      <form className="mt-4 stack-form" onSubmit={handleVerifyMfaEnrollment}>
                        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
                          <div className="rounded-[1rem] border border-cyan-300/20 bg-slate-950/70 p-3">
                            <img
                              src={`data:image/svg+xml;utf8,${encodeURIComponent(mfaPendingEnrollment.qrCode)}`}
                              alt="Authenticator QR code"
                              className="mx-auto h-48 w-48 rounded-lg bg-white p-2"
                            />
                          </div>
                          <div className="space-y-4">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Manual setup secret</div>
                              <div className="mt-2 rounded-[1rem] border border-cyan-300/20 bg-slate-950/70 px-4 py-3 font-mono text-sm text-cyan-50">
                                {mfaPendingEnrollment.secret}
                              </div>
                            </div>
                            <Field label="Authenticator code">
                              <input value={mfaEnrollmentCode} onChange={(event) => setMfaEnrollmentCode(event.currentTarget.value)} autoComplete="one-time-code" inputMode="numeric" />
                            </Field>
                            <div className="button-row">
                              <button type="submit" className="secondary-button" disabled={saving}>
                                {saving ? "Verifying..." : "Enable MFA"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    ) : null}

                    {mfaTotpFactor?.status === "verified" ? (
                      <form className="mt-4 stack-form" onSubmit={handleDisableMfa}>
                        <Field label="Authenticator code">
                          <input value={mfaDisableCode} onChange={(event) => setMfaDisableCode(event.currentTarget.value)} autoComplete="one-time-code" inputMode="numeric" />
                        </Field>
                        <div className="button-row">
                          <button type="submit" className="danger-button" disabled={saving}>
                            {saving ? "Removing..." : "Remove Authenticator App"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>

                  {message ? <p className="success-text">{message}</p> : null}
                  {error ? <p className="error-text">{error}</p> : null}
                  <button type="button" className={settingsEditMode ? "primary-button" : "secondary-button"} disabled={saving} onClick={() => void handleSettingsSave()}>
                    {saving ? "Saving..." : settingsEditMode ? "Save Settings" : "Edit Settings"}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </section>
      </section>
    </section>
  );
}

function DevelopPage() {
  return <DevelopWorkspacePage />;
}

function ModeratePage() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const accessToken = session?.access_token ?? "";
  const requestedWorkflow = searchParams.get("workflow");
  const requestedReportId = searchParams.get("reportId");
  const [activeWorkflow, setActiveWorkflow] = useState<"developers-verify" | "reports-review">("developers-verify");
  const [query, setQuery] = useState("");
  const [developers, setDevelopers] = useState<ModerationDeveloperSummary[]>([]);
  const [verifiedState, setVerifiedState] = useState<Record<string, boolean>>({});
  const [reports, setReports] = useState<TitleReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<TitleReportDetail | null>(null);
  const [messageRecipientRole, setMessageRecipientRole] = useState<"player" | "developer">("developer");
  const [moderationMessage, setModerationMessage] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (requestedWorkflow === "reports-review" || requestedWorkflow === "developers-verify") {
      setActiveWorkflow(requestedWorkflow);
    }
  }, [requestedWorkflow]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (activeWorkflow !== "developers-verify") {
        setLoading(false);
        return;
      }

      try {
        const response = await searchModerationDevelopers(appConfig.apiBaseUrl, accessToken, deferredQuery);
        const nextStateEntries = await Promise.all(
          response.developers.map(async (developer) => {
            const state = await getVerifiedDeveloperState(appConfig.apiBaseUrl, accessToken, developer.developerSubject);
            return [developer.developerSubject, state.verifiedDeveloperRoleState.verifiedDeveloper] as const;
          }),
        );
        if (cancelled) {
          return;
        }

        setDevelopers(response.developers);
        setVerifiedState(Object.fromEntries(nextStateEntries));
        setMessage(null);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeWorkflow, deferredQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadReports(): Promise<void> {
      if (activeWorkflow !== "reports-review") {
        return;
      }

      setReportsLoading(true);
      try {
        const response = await getModerationTitleReports(appConfig.apiBaseUrl, accessToken);
        if (!cancelled) {
          setReports(response.reports);
          setSelectedReportId(
            response.reports.find((report) => report.id === requestedReportId)?.id ??
            response.reports.find((report) => report.id === selectedReportId)?.id ??
            response.reports[0]?.id ??
            null,
          );
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setReportsLoading(false);
        }
      }
    }

    void loadReports();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeWorkflow, requestedReportId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedReport(): Promise<void> {
      if (activeWorkflow !== "reports-review" || !selectedReportId) {
        setSelectedReport(null);
        return;
      }

      setReportsLoading(true);
      try {
        const response = await getModerationTitleReport(appConfig.apiBaseUrl, accessToken, selectedReportId);
        if (!cancelled) {
          setSelectedReport(response.report);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setReportsLoading(false);
        }
      }
    }

    void loadSelectedReport();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeWorkflow, selectedReportId]);

  async function toggleVerified(developerSubject: string, nextValue: boolean): Promise<void> {
    try {
      await setVerifiedDeveloperState(appConfig.apiBaseUrl, accessToken, developerSubject, nextValue);
      setVerifiedState((current) => ({ ...current, [developerSubject]: nextValue }));
      setMessage("Developer verification updated.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  async function refreshModerationReports(preferredReportId?: string | null): Promise<void> {
    const response = await getModerationTitleReports(appConfig.apiBaseUrl, accessToken);
    setReports(response.reports);
    setSelectedReportId(
      response.reports.find((report) => report.id === preferredReportId)?.id ??
        response.reports.find((report) => report.id === requestedReportId)?.id ??
        response.reports.find((report) => report.id === selectedReportId)?.id ??
        response.reports[0]?.id ??
        null,
    );
  }

  async function handleModerationMessageSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedReportId) {
      return;
    }

    setSaving(true);
    try {
      const response = await addModerationTitleReportMessage(appConfig.apiBaseUrl, accessToken, selectedReportId, {
        message: moderationMessage,
        recipientRole: messageRecipientRole,
      });
      setSelectedReport(response.report);
      await refreshModerationReports(selectedReportId);
      setModerationMessage("");
      setMessage("Moderation message sent.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleModerationDecision(action: "validate" | "invalidate"): Promise<void> {
    if (!selectedReportId) {
      return;
    }

    setSaving(true);
    try {
      const response =
        action === "validate"
          ? await validateModerationTitleReport(appConfig.apiBaseUrl, accessToken, selectedReportId, { note: decisionNote || null })
          : await invalidateModerationTitleReport(appConfig.apiBaseUrl, accessToken, selectedReportId, { note: decisionNote || null });
      setSelectedReport(response.report);
      await refreshModerationReports(selectedReportId);
      setMessage(action === "validate" ? "Report validated." : "Report invalidated.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="app-workspace-shell space-y-6">
      <section className="app-workspace-content">
        <div>
          <h1 className="app-page-title">Moderate</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">Review developer verification and reported titles.</p>
        </div>

        <section className="app-panel w-full p-4">
          <div className="flex flex-wrap gap-2">
            <button className={activeWorkflow === "developers-verify" ? "primary-button" : "secondary-button"} type="button" onClick={() => setActiveWorkflow("developers-verify")}>
              Developers
            </button>
            <button className={activeWorkflow === "reports-review" ? "primary-button" : "secondary-button"} type="button" onClick={() => setActiveWorkflow("reports-review")}>
              Reported Titles
            </button>
          </div>
        </section>

        <section className="app-workspace-grid">
          <aside className="app-panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Workflow</div>
            <nav className="mt-3 space-y-2">
              <button className={activeWorkflow === "developers-verify" ? "w-full rounded-[0.9rem] border border-cyan-300/45 bg-cyan-300/15 px-3 py-2 text-left text-sm text-cyan-50" : "surface-panel-strong w-full rounded-[0.9rem] px-3 py-2 text-left text-sm text-slate-200 transition hover:border-cyan-300/45 hover:text-cyan-100"} type="button" onClick={() => setActiveWorkflow("developers-verify")}>
                Verify Developers
              </button>
              <button className={activeWorkflow === "reports-review" ? "w-full rounded-[0.9rem] border border-cyan-300/45 bg-cyan-300/15 px-3 py-2 text-left text-sm text-cyan-50" : "surface-panel-strong w-full rounded-[0.9rem] px-3 py-2 text-left text-sm text-slate-200 transition hover:border-cyan-300/45 hover:text-cyan-100"} type="button" onClick={() => setActiveWorkflow("reports-review")}>
                Reported Titles
              </button>
            </nav>
          </aside>

          <section className="app-panel app-workspace-main p-6">
            {activeWorkflow === "developers-verify" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Verify Developers</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Find a developer account and set whether the account is verified.</p>

                <div className="mt-6">
                  <Field label="Search developers">
                    <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search by username, display name, or email" />
                  </Field>
                </div>

                {loading ? <div className="mt-6"><LoadingPanel title="Loading moderation results..." /></div> : null}
                {error ? <div className="mt-6"><ErrorPanel detail={error} /></div> : null}
                {message ? <p className="mt-4 success-text">{message}</p> : null}

                {!loading && !error ? (
                  <div className="surface-panel-strong mt-6 rounded-[1rem] p-5">
                    {developers.length === 0 ? (
                      <div className="text-sm text-slate-300">No developers matched.</div>
                    ) : (
                      <div className="list-stack">
                        {developers.map((developer) => (
                          <article key={developer.developerSubject} className="list-item">
                            <div>
                              <strong>{developer.displayName ?? developer.userName ?? developer.email ?? developer.developerSubject}</strong>
                              <p>{developer.email ?? developer.userName ?? developer.developerSubject}</p>
                            </div>
                            <label className="toggle">
                              <input
                                type="checkbox"
                                checked={verifiedState[developer.developerSubject] ?? false}
                                onChange={(event) => void toggleVerified(developer.developerSubject, event.currentTarget.checked)}
                              />
                              <span>Verified developer</span>
                            </label>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-white">Reported Titles</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Review reports, message the developer, and resolve moderation decisions.</p>
                {error ? <div className="mt-6"><ErrorPanel detail={error} /></div> : null}
                {message ? <p className="mt-4 success-text">{message}</p> : null}
                <div className="mt-6 grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
                  <section className="surface-panel-soft rounded-[1.25rem] p-4">
                    {reportsLoading && reports.length === 0 ? <LoadingPanel title="Loading reports..." /> : null}
                    {!reportsLoading || reports.length > 0 ? (
                      <ModerationReportList reports={reports} selectedReportId={selectedReportId} onSelect={setSelectedReportId} />
                    ) : null}
                  </section>
                  <section className="surface-panel-soft rounded-[1.25rem] p-4">
                    {reportsLoading && selectedReportId ? <LoadingPanel title="Loading report..." /> : null}
                    {!reportsLoading && selectedReport ? <TitleReportConversation detail={selectedReport} viewerRole="moderator" /> : null}
                    {!reportsLoading && !selectedReport ? (
                      <EmptyState title="Select a report" detail="Pick a report to message participants or record a moderation decision." />
                    ) : null}
                    {selectedReport ? (
                      <>
                        <form className="mt-6 stack-form" onSubmit={handleModerationMessageSubmit}>
                          <div className="form-grid">
                            <Field label="Recipient">
                              <select value={messageRecipientRole} onChange={(event) => setMessageRecipientRole(event.currentTarget.value as "player" | "developer")}>
                                <option value="developer">Developer</option>
                                <option value="player">Player</option>
                              </select>
                            </Field>
                          </div>
                          <Field label="Moderator message">
                            <textarea rows={4} value={moderationMessage} onChange={(event) => setModerationMessage(event.currentTarget.value)} />
                          </Field>
                          <div className="button-row">
                            <button type="submit" className="primary-button" disabled={saving || moderationMessage.trim().length === 0}>
                              {saving ? "Sending..." : "Send message"}
                            </button>
                          </div>
                        </form>

                        <form className="mt-6 stack-form" onSubmit={(event) => event.preventDefault()}>
                          <Field label="Decision note">
                            <textarea rows={3} value={decisionNote} onChange={(event) => setDecisionNote(event.currentTarget.value)} />
                          </Field>
                          <div className="button-row">
                            <button type="button" className="primary-button" disabled={saving} onClick={() => void handleModerationDecision("validate")}>
                              Validate
                            </button>
                            <button type="button" className="danger-button" disabled={saving} onClick={() => void handleModerationDecision("invalidate")}>
                              Invalidate
                            </button>
                          </div>
                        </form>
                      </>
                    ) : null}
                  </section>
                </div>
              </>
            )}
          </section>
        </section>
      </section>
    </section>
  );
}

function InstallGuidePage() {
  return (
    <div className="page-grid">
      <section className="space-y-8">
        <div className="space-y-3">
          <h1 className="app-page-title">Install Guide</h1>
          <p className="max-w-3xl text-base leading-8 text-slate-300">
            Follow these steps to install independent games on Board.
          </p>
        </div>

        <section className="home-card-grid">
          <section className="app-panel p-6">
            <div className="eyebrow">1. Get the files</div>
            <h2>Download game files</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Get the APK or install package from the developer or publisher.
            </p>
          </section>
          <section className="app-panel p-6">
            <div className="eyebrow">2. Connect your device</div>
            <h2>Prepare Board and your computer</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Connect Board and your computer, then enable any required device settings.
            </p>
          </section>
          <section className="app-panel p-6">
            <div className="eyebrow">3. Finish the install</div>
            <h2>Verify and launch</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Confirm installation completed successfully, then launch on Board.
            </p>
          </section>
        </section>
      </section>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="page-grid narrow">
      <Panel title="Route not found" eyebrow="404" description="The requested page could not be found.">
        <div className="hero-actions">
          <Link to="/" className="primary-button">
            Return home
          </Link>
          <Link to="/browse" className="secondary-button">
            Open browse
          </Link>
        </div>
      </Panel>
    </div>
  );
}

export function App() {
  if (appConfig.landingMode) {
    return (
      <LandingShell>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path={landingPrivacyRoute} element={<LandingPrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LandingShell>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<LivePrivacyPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/browse/:studioSlug/:titleSlug" element={<TitleDetailPage />} />
        <Route path="/studios/:studioSlug" element={<StudioDetailPage />} />
        <Route path="/install-guide" element={<InstallGuidePage />} />
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/signout" element={<SignOutPage />} />
        <Route path="/signin" element={<Navigate to="/auth/signin" replace />} />
        <Route
          path="/player"
          element={
            <ProtectedRoute requiredRole="player">
              <PlayerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/wishlist"
          element={
            <ProtectedRoute requiredRole="player">
              <PlayerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute requiredRole="player">
              <Navigate to="/player?workflow=account-profile" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/board-profile"
          element={
            <ProtectedRoute requiredRole="player">
              <Navigate to="/player?workflow=account-profile" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/develop"
          element={
            <ProtectedRoute requiredRole="player">
              <DevelopPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/moderate"
          element={
            <ProtectedRoute requiredRole="moderator">
              <ModeratePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Shell>
  );
}
