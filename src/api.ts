import type {
  AddModerationTitleReportMessageRequest,
  AddTitleReportMessageRequest,
  AgeRatingAuthorityListResponse,
  BoardProfileResponse,
  CatalogMediaEntryListResponse,
  CatalogMediaEntryResponse,
  CatalogMediaTypeListResponse,
  CatalogTitleListQuery,
  CatalogTitleListResponse,
  CatalogTitleResponse,
  CreateCatalogMediaEntryRequest,
  CreateDeveloperTitleRequest,
  DeleteDeveloperTitleRequest,
  CreatePlayerTitleReportRequest,
  CurrentUserResponse,
  DeveloperTitleListResponse,
  DeveloperTitleResponse,
  DeveloperEnrollmentResponse,
  DeveloperStudioListResponse,
  ModerateTitleReportDecisionRequest,
  ModerationDeveloperListResponse,
  GenreListResponse,
  MarketingSignupRequest,
  MarketingSignupResponse,
  HomeSpotlightResponse,
  CreateTitleShowcaseMediaRequest,
  PlayerCollectionMutationResponse,
  PlayerFollowedStudioListResponse,
  PlayerStudioFollowMutationResponse,
  PlayerTitleListResponse,
  PlayerTitleReportListResponse,
  PlayerTitleReportResponse,
  StudioLinkListResponse,
  StudioLinkResponse,
  StudioListResponse,
  StudioResponse,
  UpdateUserProfileRequest,
  UpdateCatalogMediaEntryRequest,
  UpsertBoardProfileRequest,
  UserNotificationListResponse,
  UserNotificationResponse,
  TitleMediaAssetListResponse,
  TitleMediaAssetResponse,
  TitleMetadataVersionListResponse,
  TitleReleaseListResponse,
  TitleReleaseResponse,
  TitleShowcaseMediaListResponse,
  TitleShowcaseMediaResponse,
  TitleReportDetailResponse,
  TitleReportListResponse,
  UpdateTitleShowcaseMediaRequest,
  UpdateDeveloperTitleRequest,
  UpsertTitleMediaAssetRequest,
  UpsertTitleMetadataRequest,
  UpsertTitleReleaseRequest,
  VerifyCurrentUserPasswordRequest,
  VerifyCurrentUserPasswordResponse,
  UserNameAvailabilityResponse,
  UserProfileResponse,
  VerifiedDeveloperRoleStateResponse
} from "@board-enthusiasts/migration-contract";

export interface ProblemDetails {
  title: string;
  status: number;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly errors?: Record<string, string[]>;

  constructor(message: string, status: number, code?: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export interface StudioMutationRequest {
  slug: string;
  displayName: string;
  description?: string | null;
}

export interface StudioLinkMutationRequest {
  label: string;
  url: string;
}

export interface SupportIssueReportRequest {
  category: "email_signup";
  firstName: string | null;
  email: string | null;
  pageUrl: string;
  apiBaseUrl: string;
  occurredAt: string;
  errorMessage: string;
  technicalDetails: string | null;
  userAgent: string | null;
  language: string | null;
  timeZone: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  screenWidth: number | null;
  screenHeight: number | null;
}

export interface SupportIssueReportResponse {
  accepted: true;
}

export interface HomeOfferingSpotlightEntry {
  slotNumber: number;
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  glyph: "api" | "discord" | "library" | "spark" | "toolkit" | "youtube";
  actionLabel: string | null;
  actionUrl: string | null;
  actionExternal: boolean;
}

export interface HomeOfferingSpotlightResponse {
  entries: HomeOfferingSpotlightEntry[];
}

function isTechnicalApiMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    "duplicate key value",
    "violates",
    "constraint",
    "row for relation",
    "relation \"",
    "sql",
    "supabase",
    "storage.objects",
    "jwt",
    "auth session missing",
  ].some((pattern) => normalized.includes(pattern));
}

export async function apiFetch<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      cache: "no-store",
      headers
    });
  } catch (error) {
    throw new Error(
      "We couldn't reach Board Enthusiasts right now. Please check your connection and try again.",
      { cause: error },
    );
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    let code: string | undefined;
    let structuredError: ApiError | null = null;
    try {
      const payload = (await response.json()) as ProblemDetails;
      const validationMessage = payload.errors
        ? Object.values(payload.errors)
            .flat()
            .find((message) => typeof message === "string" && message.trim().length > 0)
        : undefined;
      detail = validationMessage ?? payload.detail ?? payload.title ?? detail;
      code = payload.code;
      structuredError = new ApiError(detail, response.status, code, payload.errors);
    } catch {
      if (!structuredError) {
        const text = await response.text();
        if (text.trim()) {
          detail = text.trim();
        }
      }
    }

    if (response.status === 401) {
      detail = "Your session is no longer active. Please sign in again and try once more.";
    } else if (response.status === 403) {
      detail = "This part of Board Enthusiasts isn't available to your account.";
    } else if (response.status === 404) {
      detail = "We couldn't find what you were looking for.";
    } else if (response.status === 409 && /(already|duplicate|exists)/i.test(detail)) {
      detail = "That information is already in use. Review it and try again.";
    } else if (response.status === 429) {
      detail = "Board Enthusiasts is getting more requests than usual right now. Please wait a moment and try again.";
    } else if (response.status >= 500 || isTechnicalApiMessage(detail)) {
      detail = "Board Enthusiasts is having trouble right now. Please try again in a moment.";
    }

    if (structuredError) {
      throw new ApiError(detail, structuredError.status, structuredError.code, structuredError.errors);
    }

    throw new ApiError(detail, response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function listCatalogTitles(apiBaseUrl: string, query: CatalogTitleListQuery = {}): Promise<CatalogTitleListResponse> {
  const searchParams = new URLSearchParams({
    pageNumber: String(query.pageNumber ?? 1),
    pageSize: String(query.pageSize ?? 48),
  });
  const studioSlugs = Array.isArray(query.studioSlug) ? query.studioSlug : query.studioSlug ? [query.studioSlug] : [];
  const genres = Array.isArray(query.genre) ? query.genre : query.genre ? [query.genre] : [];

  for (const studioSlug of studioSlugs) {
    searchParams.append("studioSlug", studioSlug);
  }
  for (const genre of genres) {
    searchParams.append("genre", genre);
  }

  if (query.contentKind) {
    searchParams.set("contentKind", query.contentKind);
  }
  if (query.search) {
    searchParams.set("search", query.search);
  }
  if (query.minPlayers !== undefined) {
    searchParams.set("minPlayers", String(query.minPlayers));
  }
  if (query.maxPlayers !== undefined) {
    searchParams.set("maxPlayers", String(query.maxPlayers));
  }
  if (query.sort) {
    searchParams.set("sort", query.sort);
  }

  return apiFetch<CatalogTitleListResponse>(apiBaseUrl, `/catalog?${searchParams.toString()}`);
}

export function getCatalogTitle(apiBaseUrl: string, studioIdentifier: string, titleIdentifier: string, accessToken?: string | null): Promise<CatalogTitleResponse> {
  return apiFetch<CatalogTitleResponse>(apiBaseUrl, `/catalog/${studioIdentifier}/${titleIdentifier}`, {}, accessToken ?? undefined);
}

export function getHomeSpotlights(apiBaseUrl: string): Promise<HomeSpotlightResponse> {
  return apiFetch<HomeSpotlightResponse>(apiBaseUrl, "/spotlights/home");
}

export function getHomeOfferingSpotlights(apiBaseUrl: string): Promise<HomeOfferingSpotlightResponse> {
  return apiFetch<HomeOfferingSpotlightResponse>(apiBaseUrl, "/internal/home-offering-spotlights");
}

export function listGenres(apiBaseUrl: string): Promise<GenreListResponse> {
  return apiFetch<GenreListResponse>(apiBaseUrl, "/genres");
}

export function listAgeRatingAuthorities(apiBaseUrl: string): Promise<AgeRatingAuthorityListResponse> {
  return apiFetch<AgeRatingAuthorityListResponse>(apiBaseUrl, "/age-rating-authorities");
}

export function createMarketingSignup(apiBaseUrl: string, request: MarketingSignupRequest): Promise<MarketingSignupResponse> {
  return apiFetch<MarketingSignupResponse>(apiBaseUrl, "/marketing/signups", { method: "POST", body: JSON.stringify(request) });
}

export function createSupportIssueReport(apiBaseUrl: string, request: SupportIssueReportRequest): Promise<SupportIssueReportResponse> {
  return apiFetch<SupportIssueReportResponse>(apiBaseUrl, "/support/issues", { method: "POST", body: JSON.stringify(request) });
}

export function listPublicStudios(apiBaseUrl: string): Promise<StudioListResponse> {
  return apiFetch<StudioListResponse>(apiBaseUrl, "/studios");
}

export function getPublicStudio(apiBaseUrl: string, studioIdentifier: string): Promise<StudioResponse> {
  return apiFetch<StudioResponse>(apiBaseUrl, `/studios/${studioIdentifier}`);
}

export function getCurrentUser(apiBaseUrl: string, accessToken: string): Promise<CurrentUserResponse> {
  return apiFetch<CurrentUserResponse>(apiBaseUrl, "/identity/me", {}, accessToken);
}

export function getUserNameAvailability(apiBaseUrl: string, userName: string): Promise<UserNameAvailabilityResponse> {
  const searchParams = new URLSearchParams({ userName });
  return apiFetch<UserNameAvailabilityResponse>(apiBaseUrl, `/identity/user-name-availability?${searchParams.toString()}`);
}

export function getUserProfile(apiBaseUrl: string, accessToken: string): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>(apiBaseUrl, "/identity/me/profile", {}, accessToken);
}

export function getBoardProfile(apiBaseUrl: string, accessToken: string): Promise<BoardProfileResponse> {
  return apiFetch<BoardProfileResponse>(apiBaseUrl, "/identity/me/board-profile", {}, accessToken);
}

export function upsertBoardProfile(apiBaseUrl: string, accessToken: string, request: UpsertBoardProfileRequest): Promise<BoardProfileResponse> {
  return apiFetch<BoardProfileResponse>(apiBaseUrl, "/identity/me/board-profile", { method: "PUT", body: JSON.stringify(request) }, accessToken);
}

export function deleteBoardProfile(apiBaseUrl: string, accessToken: string): Promise<void> {
  return apiFetch<void>(apiBaseUrl, "/identity/me/board-profile", { method: "DELETE" }, accessToken);
}

export function updateUserProfile(apiBaseUrl: string, accessToken: string, request: UpdateUserProfileRequest): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>(
    apiBaseUrl,
    "/identity/me/profile",
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function getDeveloperEnrollment(apiBaseUrl: string, accessToken: string): Promise<DeveloperEnrollmentResponse> {
  return apiFetch<DeveloperEnrollmentResponse>(apiBaseUrl, "/identity/me/developer-enrollment", {}, accessToken);
}

export function getCurrentUserNotifications(apiBaseUrl: string, accessToken: string): Promise<UserNotificationListResponse> {
  return apiFetch<UserNotificationListResponse>(apiBaseUrl, "/identity/me/notifications", {}, accessToken);
}

export function clearCurrentUserNotifications(apiBaseUrl: string, accessToken: string): Promise<void> {
  return apiFetch<void>(apiBaseUrl, "/identity/me/notifications", { method: "DELETE" }, accessToken);
}

export function markCurrentUserNotificationRead(
  apiBaseUrl: string,
  accessToken: string,
  notificationId: string
): Promise<UserNotificationResponse> {
  return apiFetch<UserNotificationResponse>(apiBaseUrl, `/identity/me/notifications/${notificationId}/read`, { method: "POST" }, accessToken);
}

export function enrollAsDeveloper(apiBaseUrl: string, accessToken: string): Promise<DeveloperEnrollmentResponse> {
  return apiFetch<DeveloperEnrollmentResponse>(apiBaseUrl, "/identity/me/developer-enrollment", { method: "POST" }, accessToken);
}

export function getPlayerLibrary(apiBaseUrl: string, accessToken: string): Promise<PlayerTitleListResponse> {
  return apiFetch<PlayerTitleListResponse>(apiBaseUrl, "/player/library", {}, accessToken);
}

export function addTitleToPlayerLibrary(apiBaseUrl: string, accessToken: string, titleId: string): Promise<PlayerCollectionMutationResponse> {
  return apiFetch<PlayerCollectionMutationResponse>(apiBaseUrl, `/player/library/titles/${titleId}`, { method: "PUT" }, accessToken);
}

export function removeTitleFromPlayerLibrary(apiBaseUrl: string, accessToken: string, titleId: string): Promise<PlayerCollectionMutationResponse> {
  return apiFetch<PlayerCollectionMutationResponse>(apiBaseUrl, `/player/library/titles/${titleId}`, { method: "DELETE" }, accessToken);
}

export function getPlayerWishlist(apiBaseUrl: string, accessToken: string): Promise<PlayerTitleListResponse> {
  return apiFetch<PlayerTitleListResponse>(apiBaseUrl, "/player/wishlist", {}, accessToken);
}

export function addTitleToPlayerWishlist(apiBaseUrl: string, accessToken: string, titleId: string): Promise<PlayerCollectionMutationResponse> {
  return apiFetch<PlayerCollectionMutationResponse>(apiBaseUrl, `/player/wishlist/titles/${titleId}`, { method: "PUT" }, accessToken);
}

export function removeTitleFromPlayerWishlist(apiBaseUrl: string, accessToken: string, titleId: string): Promise<PlayerCollectionMutationResponse> {
  return apiFetch<PlayerCollectionMutationResponse>(apiBaseUrl, `/player/wishlist/titles/${titleId}`, { method: "DELETE" }, accessToken);
}

export function getPlayerFollowedStudios(apiBaseUrl: string, accessToken: string): Promise<PlayerFollowedStudioListResponse> {
  return apiFetch<PlayerFollowedStudioListResponse>(apiBaseUrl, "/player/followed-studios", {}, accessToken);
}

export function addStudioToPlayerFollows(apiBaseUrl: string, accessToken: string, studioId: string): Promise<PlayerStudioFollowMutationResponse> {
  return apiFetch<PlayerStudioFollowMutationResponse>(apiBaseUrl, `/player/followed-studios/${studioId}`, { method: "PUT" }, accessToken);
}

export function removeStudioFromPlayerFollows(apiBaseUrl: string, accessToken: string, studioId: string): Promise<PlayerStudioFollowMutationResponse> {
  return apiFetch<PlayerStudioFollowMutationResponse>(apiBaseUrl, `/player/followed-studios/${studioId}`, { method: "DELETE" }, accessToken);
}

export function getPlayerTitleReports(apiBaseUrl: string, accessToken: string): Promise<PlayerTitleReportListResponse> {
  return apiFetch<PlayerTitleReportListResponse>(apiBaseUrl, "/player/reports", {}, accessToken);
}

export function createPlayerTitleReport(apiBaseUrl: string, accessToken: string, request: CreatePlayerTitleReportRequest): Promise<PlayerTitleReportResponse> {
  return apiFetch<PlayerTitleReportResponse>(apiBaseUrl, "/player/reports", { method: "POST", body: JSON.stringify(request) }, accessToken);
}

export function getPlayerTitleReport(apiBaseUrl: string, accessToken: string, reportId: string): Promise<TitleReportDetailResponse> {
  return apiFetch<TitleReportDetailResponse>(apiBaseUrl, `/player/reports/${reportId}`, {}, accessToken);
}

export function addPlayerTitleReportMessage(
  apiBaseUrl: string,
  accessToken: string,
  reportId: string,
  request: AddTitleReportMessageRequest
): Promise<TitleReportDetailResponse> {
  return apiFetch<TitleReportDetailResponse>(apiBaseUrl, `/player/reports/${reportId}/messages`, { method: "POST", body: JSON.stringify(request) }, accessToken);
}

export function listManagedStudios(apiBaseUrl: string, accessToken: string): Promise<DeveloperStudioListResponse> {
  return apiFetch<DeveloperStudioListResponse>(apiBaseUrl, "/developer/studios", {}, accessToken);
}

export function listCatalogMediaTypes(apiBaseUrl: string, accessToken: string): Promise<CatalogMediaTypeListResponse> {
  return apiFetch<CatalogMediaTypeListResponse>(apiBaseUrl, "/developer/media-types", {}, accessToken);
}

export function createStudio(apiBaseUrl: string, accessToken: string, request: StudioMutationRequest): Promise<StudioResponse> {
  return apiFetch<StudioResponse>(
    apiBaseUrl,
    "/studios",
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function updateStudio(apiBaseUrl: string, accessToken: string, studioId: string, request: StudioMutationRequest): Promise<StudioResponse> {
  return apiFetch<StudioResponse>(
    apiBaseUrl,
    `/developer/studios/${studioId}`,
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function deleteStudio(apiBaseUrl: string, accessToken: string, studioId: string): Promise<void> {
  return apiFetch<void>(apiBaseUrl, `/developer/studios/${studioId}`, { method: "DELETE" }, accessToken);
}

export function listStudioLinks(apiBaseUrl: string, accessToken: string, studioId: string): Promise<StudioLinkListResponse> {
  return apiFetch<StudioLinkListResponse>(apiBaseUrl, `/developer/studios/${studioId}/links`, {}, accessToken);
}

export function createStudioLink(
  apiBaseUrl: string,
  accessToken: string,
  studioId: string,
  request: StudioLinkMutationRequest
): Promise<StudioLinkResponse> {
  return apiFetch<StudioLinkResponse>(
    apiBaseUrl,
    `/developer/studios/${studioId}/links`,
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function updateStudioLink(
  apiBaseUrl: string,
  accessToken: string,
  studioId: string,
  linkId: string,
  request: StudioLinkMutationRequest
): Promise<StudioLinkResponse> {
  return apiFetch<StudioLinkResponse>(
    apiBaseUrl,
    `/developer/studios/${studioId}/links/${linkId}`,
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function deleteStudioLink(apiBaseUrl: string, accessToken: string, studioId: string, linkId: string): Promise<void> {
  return apiFetch<void>(apiBaseUrl, `/developer/studios/${studioId}/links/${linkId}`, { method: "DELETE" }, accessToken);
}

export function uploadStudioMedia(
  apiBaseUrl: string,
  accessToken: string,
  studioId: string,
  kind: "avatar" | "logo" | "banner",
  file: File
): Promise<StudioResponse> {
  const formData = new FormData();
  formData.set("media", file);
  return apiFetch<StudioResponse>(
    apiBaseUrl,
    `/developer/studios/${studioId}/${kind}-upload`,
    {
      method: "POST",
      body: formData
    },
    accessToken
  );
}

export function listStudioCatalogMedia(apiBaseUrl: string, accessToken: string, studioId: string): Promise<CatalogMediaEntryListResponse> {
  return apiFetch<CatalogMediaEntryListResponse>(apiBaseUrl, `/developer/studios/${studioId}/catalog-media`, {}, accessToken);
}

export function createStudioCatalogMedia(
  apiBaseUrl: string,
  accessToken: string,
  studioId: string,
  request: CreateCatalogMediaEntryRequest
): Promise<CatalogMediaEntryResponse> {
  return apiFetch<CatalogMediaEntryResponse>(
    apiBaseUrl,
    `/developer/studios/${studioId}/catalog-media`,
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function updateStudioCatalogMedia(
  apiBaseUrl: string,
  accessToken: string,
  studioId: string,
  mediaEntryId: string,
  request: UpdateCatalogMediaEntryRequest
): Promise<CatalogMediaEntryResponse> {
  return apiFetch<CatalogMediaEntryResponse>(
    apiBaseUrl,
    `/developer/studios/${studioId}/catalog-media/${mediaEntryId}`,
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function deleteStudioCatalogMedia(
  apiBaseUrl: string,
  accessToken: string,
  studioId: string,
  mediaEntryId: string
): Promise<void> {
  return apiFetch<void>(apiBaseUrl, `/developer/studios/${studioId}/catalog-media/${mediaEntryId}`, { method: "DELETE" }, accessToken);
}

export function uploadStudioCatalogMediaImage(
  apiBaseUrl: string,
  accessToken: string,
  studioId: string,
  mediaEntryId: string,
  file: File
): Promise<CatalogMediaEntryResponse> {
  const formData = new FormData();
  formData.set("media", file);
  return apiFetch<CatalogMediaEntryResponse>(
    apiBaseUrl,
    `/developer/studios/${studioId}/catalog-media/${mediaEntryId}/upload`,
    {
      method: "POST",
      body: formData,
    },
    accessToken
  );
}

export function listStudioTitles(apiBaseUrl: string, accessToken: string, studioId: string): Promise<DeveloperTitleListResponse> {
  return apiFetch<DeveloperTitleListResponse>(apiBaseUrl, `/developer/studios/${studioId}/titles`, {}, accessToken);
}

export function createTitle(apiBaseUrl: string, accessToken: string, studioId: string, request: CreateDeveloperTitleRequest): Promise<DeveloperTitleResponse> {
  return apiFetch<DeveloperTitleResponse>(
    apiBaseUrl,
    `/developer/studios/${studioId}/titles`,
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function getDeveloperTitle(apiBaseUrl: string, accessToken: string, titleId: string): Promise<DeveloperTitleResponse> {
  return apiFetch<DeveloperTitleResponse>(apiBaseUrl, `/developer/titles/${titleId}`, {}, accessToken);
}

export function updateTitle(apiBaseUrl: string, accessToken: string, titleId: string, request: UpdateDeveloperTitleRequest): Promise<DeveloperTitleResponse> {
  return apiFetch<DeveloperTitleResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}`,
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function verifyCurrentUserPassword(
  apiBaseUrl: string,
  accessToken: string,
  request: VerifyCurrentUserPasswordRequest
): Promise<VerifyCurrentUserPasswordResponse> {
  return apiFetch<VerifyCurrentUserPasswordResponse>(
    apiBaseUrl,
    "/identity/me/password/verify",
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function activateTitle(apiBaseUrl: string, accessToken: string, titleId: string): Promise<DeveloperTitleResponse> {
  return apiFetch<DeveloperTitleResponse>(apiBaseUrl, `/developer/titles/${titleId}/activate`, { method: "POST" }, accessToken);
}

export function archiveTitle(apiBaseUrl: string, accessToken: string, titleId: string): Promise<DeveloperTitleResponse> {
  return apiFetch<DeveloperTitleResponse>(apiBaseUrl, `/developer/titles/${titleId}/archive`, { method: "POST" }, accessToken);
}

export function unarchiveTitle(apiBaseUrl: string, accessToken: string, titleId: string): Promise<DeveloperTitleResponse> {
  return apiFetch<DeveloperTitleResponse>(apiBaseUrl, `/developer/titles/${titleId}/unarchive`, { method: "POST" }, accessToken);
}

export function deleteTitle(apiBaseUrl: string, accessToken: string, titleId: string, request: DeleteDeveloperTitleRequest): Promise<void> {
  return apiFetch<void>(
    apiBaseUrl,
    `/developer/titles/${titleId}/delete`,
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function upsertTitleMetadata(apiBaseUrl: string, accessToken: string, titleId: string, request: UpsertTitleMetadataRequest): Promise<DeveloperTitleResponse> {
  return apiFetch<DeveloperTitleResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/metadata/current`,
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function getTitleMetadataVersions(apiBaseUrl: string, accessToken: string, titleId: string): Promise<TitleMetadataVersionListResponse> {
  return apiFetch<TitleMetadataVersionListResponse>(apiBaseUrl, `/developer/titles/${titleId}/metadata-versions`, {}, accessToken);
}

export function activateTitleMetadataVersion(apiBaseUrl: string, accessToken: string, titleId: string, revisionNumber: number): Promise<DeveloperTitleResponse> {
  return apiFetch<DeveloperTitleResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/metadata-versions/${revisionNumber}/activate`,
    { method: "POST" },
    accessToken
  );
}

export function getTitleMediaAssets(apiBaseUrl: string, accessToken: string, titleId: string): Promise<TitleMediaAssetListResponse> {
  return apiFetch<TitleMediaAssetListResponse>(apiBaseUrl, `/developer/titles/${titleId}/media`, {}, accessToken);
}

export function listTitleCatalogMedia(apiBaseUrl: string, accessToken: string, titleId: string): Promise<CatalogMediaEntryListResponse> {
  return apiFetch<CatalogMediaEntryListResponse>(apiBaseUrl, `/developer/titles/${titleId}/catalog-media`, {}, accessToken);
}

export function createTitleCatalogMedia(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  request: CreateCatalogMediaEntryRequest
): Promise<CatalogMediaEntryResponse> {
  return apiFetch<CatalogMediaEntryResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/catalog-media`,
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function updateTitleCatalogMedia(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  mediaEntryId: string,
  request: UpdateCatalogMediaEntryRequest
): Promise<CatalogMediaEntryResponse> {
  return apiFetch<CatalogMediaEntryResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/catalog-media/${mediaEntryId}`,
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function deleteTitleCatalogMedia(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  mediaEntryId: string
): Promise<void> {
  return apiFetch<void>(apiBaseUrl, `/developer/titles/${titleId}/catalog-media/${mediaEntryId}`, { method: "DELETE" }, accessToken);
}

export function uploadTitleCatalogMediaImage(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  mediaEntryId: string,
  file: File,
  altText?: string | null
): Promise<CatalogMediaEntryResponse> {
  const formData = new FormData();
  formData.set("media", file);
  if (altText) {
    formData.set("altText", altText);
  }

  return apiFetch<CatalogMediaEntryResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/catalog-media/${mediaEntryId}/upload`,
    {
      method: "POST",
      body: formData,
    },
    accessToken
  );
}

export function upsertTitleMediaAsset(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  mediaRole: string,
  request: UpsertTitleMediaAssetRequest
): Promise<TitleMediaAssetResponse> {
  return apiFetch<TitleMediaAssetResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/media/${encodeURIComponent(mediaRole)}`,
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function uploadTitleMediaAsset(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  mediaRole: string,
  file: File,
  altText?: string | null
): Promise<TitleMediaAssetResponse> {
  const formData = new FormData();
  formData.set("media", file);
  if (altText) {
    formData.set("altText", altText);
  }

  return apiFetch<TitleMediaAssetResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/media/${encodeURIComponent(mediaRole)}/upload`,
    {
      method: "POST",
      body: formData
    },
    accessToken
  );
}

export function deleteTitleMediaAsset(apiBaseUrl: string, accessToken: string, titleId: string, mediaRole: string): Promise<void> {
  return apiFetch<void>(apiBaseUrl, `/developer/titles/${titleId}/media/${encodeURIComponent(mediaRole)}`, { method: "DELETE" }, accessToken);
}

export function getTitleShowcaseMedia(apiBaseUrl: string, accessToken: string, titleId: string): Promise<TitleShowcaseMediaListResponse> {
  return apiFetch<TitleShowcaseMediaListResponse>(apiBaseUrl, `/developer/titles/${titleId}/showcase-media`, {}, accessToken);
}

export function createTitleShowcaseMedia(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  request: CreateTitleShowcaseMediaRequest
): Promise<TitleShowcaseMediaResponse> {
  return apiFetch<TitleShowcaseMediaResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/showcase-media`,
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function updateTitleShowcaseMedia(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  showcaseMediaId: string,
  request: UpdateTitleShowcaseMediaRequest
): Promise<TitleShowcaseMediaResponse> {
  return apiFetch<TitleShowcaseMediaResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/showcase-media/${showcaseMediaId}`,
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function uploadTitleShowcaseMediaImage(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  showcaseMediaId: string,
  file: File
): Promise<TitleShowcaseMediaResponse> {
  const formData = new FormData();
  formData.set("media", file);
  return apiFetch<TitleShowcaseMediaResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/showcase-media/${showcaseMediaId}/image-upload`,
    {
      method: "POST",
      body: formData
    },
    accessToken
  );
}

export function deleteTitleShowcaseMedia(apiBaseUrl: string, accessToken: string, titleId: string, showcaseMediaId: string): Promise<void> {
  return apiFetch<void>(apiBaseUrl, `/developer/titles/${titleId}/showcase-media/${showcaseMediaId}`, { method: "DELETE" }, accessToken);
}

export function getDeveloperTitleReports(apiBaseUrl: string, accessToken: string, titleId: string): Promise<TitleReportListResponse> {
  return apiFetch<TitleReportListResponse>(apiBaseUrl, `/developer/titles/${titleId}/reports`, {}, accessToken);
}

export function getDeveloperTitleReport(apiBaseUrl: string, accessToken: string, titleId: string, reportId: string): Promise<TitleReportDetailResponse> {
  return apiFetch<TitleReportDetailResponse>(apiBaseUrl, `/developer/titles/${titleId}/reports/${reportId}`, {}, accessToken);
}

export function addDeveloperTitleReportMessage(
  apiBaseUrl: string,
  accessToken: string,
  titleId: string,
  reportId: string,
  request: AddTitleReportMessageRequest
): Promise<TitleReportDetailResponse> {
  return apiFetch<TitleReportDetailResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/reports/${reportId}/messages`,
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function getTitleReleases(apiBaseUrl: string, accessToken: string, titleId: string): Promise<TitleReleaseListResponse> {
  return apiFetch<TitleReleaseListResponse>(apiBaseUrl, `/developer/titles/${titleId}/releases`, {}, accessToken);
}

export function createTitleRelease(apiBaseUrl: string, accessToken: string, titleId: string, request: UpsertTitleReleaseRequest): Promise<TitleReleaseResponse> {
  return apiFetch<TitleReleaseResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/releases`,
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function updateTitleRelease(apiBaseUrl: string, accessToken: string, titleId: string, releaseId: string, request: UpsertTitleReleaseRequest): Promise<TitleReleaseResponse> {
  return apiFetch<TitleReleaseResponse>(
    apiBaseUrl,
    `/developer/titles/${titleId}/releases/${releaseId}`,
    {
      method: "PUT",
      body: JSON.stringify(request)
    },
    accessToken
  );
}

export function activateTitleRelease(apiBaseUrl: string, accessToken: string, titleId: string, releaseId: string): Promise<DeveloperTitleResponse> {
  return apiFetch<DeveloperTitleResponse>(apiBaseUrl, `/developer/titles/${titleId}/releases/${releaseId}/activate`, { method: "POST" }, accessToken);
}

export function searchModerationDevelopers(
  apiBaseUrl: string,
  accessToken: string,
  query: string
): Promise<ModerationDeveloperListResponse> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("search", query.trim());
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return apiFetch<ModerationDeveloperListResponse>(apiBaseUrl, `/moderation/developers${suffix}`, {}, accessToken);
}

export function getVerifiedDeveloperState(
  apiBaseUrl: string,
  accessToken: string,
  developerSubject: string
): Promise<VerifiedDeveloperRoleStateResponse> {
  return apiFetch<VerifiedDeveloperRoleStateResponse>(
    apiBaseUrl,
    `/moderation/developers/${developerSubject}/verification`,
    {},
    accessToken
  );
}

export function setVerifiedDeveloperState(
  apiBaseUrl: string,
  accessToken: string,
  developerSubject: string,
  verified: boolean
): Promise<VerifiedDeveloperRoleStateResponse> {
  return apiFetch<VerifiedDeveloperRoleStateResponse>(
    apiBaseUrl,
    `/moderation/developers/${developerSubject}/verified-developer`,
    { method: verified ? "PUT" : "DELETE" },
    accessToken
  );
}

export function getModerationTitleReports(apiBaseUrl: string, accessToken: string): Promise<TitleReportListResponse> {
  return apiFetch<TitleReportListResponse>(apiBaseUrl, "/moderation/title-reports", {}, accessToken);
}

export function getModerationTitleReport(apiBaseUrl: string, accessToken: string, reportId: string): Promise<TitleReportDetailResponse> {
  return apiFetch<TitleReportDetailResponse>(apiBaseUrl, `/moderation/title-reports/${reportId}`, {}, accessToken);
}

export function addModerationTitleReportMessage(
  apiBaseUrl: string,
  accessToken: string,
  reportId: string,
  request: AddModerationTitleReportMessageRequest
): Promise<TitleReportDetailResponse> {
  return apiFetch<TitleReportDetailResponse>(apiBaseUrl, `/moderation/title-reports/${reportId}/messages`, { method: "POST", body: JSON.stringify(request) }, accessToken);
}

export function validateModerationTitleReport(
  apiBaseUrl: string,
  accessToken: string,
  reportId: string,
  request: ModerateTitleReportDecisionRequest
): Promise<TitleReportDetailResponse> {
  return apiFetch<TitleReportDetailResponse>(apiBaseUrl, `/moderation/title-reports/${reportId}/validate`, { method: "POST", body: JSON.stringify(request) }, accessToken);
}

export function invalidateModerationTitleReport(
  apiBaseUrl: string,
  accessToken: string,
  reportId: string,
  request: ModerateTitleReportDecisionRequest
): Promise<TitleReportDetailResponse> {
  return apiFetch<TitleReportDetailResponse>(apiBaseUrl, `/moderation/title-reports/${reportId}/invalidate`, { method: "POST", body: JSON.stringify(request) }, accessToken);
}
