import type {
  CatalogTitleListResponse,
  CatalogTitleResponse,
  CurrentUserResponse,
  DeveloperEnrollmentResponse,
  DeveloperStudioListResponse,
  ModerationDeveloperListResponse,
  StudioLinkListResponse,
  StudioLinkResponse,
  StudioListResponse,
  StudioResponse,
  UserProfileResponse,
  VerifiedDeveloperRoleStateResponse
} from "@board-enthusiasts/migration-contract";

export interface ProblemDetails {
  title: string;
  status: number;
  detail?: string;
  code?: string;
}

export interface StudioMutationRequest {
  slug: string;
  displayName: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

export interface StudioLinkMutationRequest {
  label: string;
  url: string;
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

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as ProblemDetails;
      detail = payload.detail ?? payload.title ?? detail;
    } catch {
      const text = await response.text();
      if (text.trim()) {
        detail = text.trim();
      }
    }

    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function listCatalogTitles(apiBaseUrl: string, studioSlug?: string): Promise<CatalogTitleListResponse> {
  const query = new URLSearchParams({ pageNumber: "1", pageSize: "100" });
  if (studioSlug) {
    query.set("studioSlug", studioSlug);
  }

  return apiFetch<CatalogTitleListResponse>(apiBaseUrl, `/catalog?${query.toString()}`);
}

export function getCatalogTitle(apiBaseUrl: string, studioSlug: string, titleSlug: string): Promise<CatalogTitleResponse> {
  return apiFetch<CatalogTitleResponse>(apiBaseUrl, `/catalog/${studioSlug}/${titleSlug}`);
}

export function listPublicStudios(apiBaseUrl: string): Promise<StudioListResponse> {
  return apiFetch<StudioListResponse>(apiBaseUrl, "/studios");
}

export function getPublicStudio(apiBaseUrl: string, studioSlug: string): Promise<StudioResponse> {
  return apiFetch<StudioResponse>(apiBaseUrl, `/studios/${studioSlug}`);
}

export function getCurrentUser(apiBaseUrl: string, accessToken: string): Promise<CurrentUserResponse> {
  return apiFetch<CurrentUserResponse>(apiBaseUrl, "/identity/me", {}, accessToken);
}

export function getUserProfile(apiBaseUrl: string, accessToken: string): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>(apiBaseUrl, "/identity/me/profile", {}, accessToken);
}

export function updateUserProfile(apiBaseUrl: string, accessToken: string, displayName: string): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>(
    apiBaseUrl,
    "/identity/me/profile",
    {
      method: "PUT",
      body: JSON.stringify({ displayName })
    },
    accessToken
  );
}

export function getDeveloperEnrollment(apiBaseUrl: string, accessToken: string): Promise<DeveloperEnrollmentResponse> {
  return apiFetch<DeveloperEnrollmentResponse>(apiBaseUrl, "/identity/me/developer-enrollment", {}, accessToken);
}

export function enrollAsDeveloper(apiBaseUrl: string, accessToken: string): Promise<DeveloperEnrollmentResponse> {
  return apiFetch<DeveloperEnrollmentResponse>(apiBaseUrl, "/identity/me/developer-enrollment", { method: "POST" }, accessToken);
}

export function listManagedStudios(apiBaseUrl: string, accessToken: string): Promise<DeveloperStudioListResponse> {
  return apiFetch<DeveloperStudioListResponse>(apiBaseUrl, "/developer/studios", {}, accessToken);
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
  kind: "logo" | "banner",
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
