import {
  maintainedAgeRatingAuthorities,
  maintainedGenres,
  AgeRatingAuthorityDefinition,
  catalogMediaTypeDefinitions,
  CatalogMediaEntry,
  CatalogMediaTypeDefinition,
  CatalogMediaTypeKey,
  CatalogTitleSummary,
  DeveloperStudioSummary,
  DeveloperTitle,
  GenreDefinition,
  MigrationMediaUploadPolicy,
  StudioLink,
  TitleMetadataVersion,
  TitleRelease,
  TitleShowcaseMedia,
  TitleReportDetail,
  TitleReportSummary,
  normalizeGenreSlug,
} from "@board-enthusiasts/migration-contract";
import { useEffect, useId, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getWorkspaceWorkflowButtonClass } from "../app-core";
import {
  addDeveloperTitleReportMessage,
  activateTitle,
  archiveTitle,
  activateTitleMetadataVersion,
  activateTitleRelease,
  createStudio,
  createStudioCatalogMedia,
  createStudioLink,
  createTitle,
  createTitleCatalogMedia,
  createTitleRelease,
  deleteStudioCatalogMedia,
  deleteStudio,
  deleteStudioLink,
  deleteTitleCatalogMedia,
  createTitleShowcaseMedia,
  enrollAsDeveloper,
  getDeveloperEnrollment,
  getDeveloperTitle,
  getDeveloperTitleReport,
  getDeveloperTitleReports,
  listCatalogMediaTypes,
  listAgeRatingAuthorities,
  listGenres,
  getTitleMetadataVersions,
  getTitleReleases,
  getTitleShowcaseMedia,
  listManagedStudios,
  listStudioLinks,
  listStudioTitles,
  deleteTitle,
  deleteTitleShowcaseMedia,
  unarchiveTitle,
  verifyCurrentUserPassword as verifyCurrentUserPasswordApi,
  updateTitle,
  updateTitleRelease,
  updateTitleCatalogMedia,
  updateTitleShowcaseMedia,
  updateStudio,
  updateStudioCatalogMedia,
  updateStudioLink,
  uploadStudioCatalogMediaImage,
  uploadTitleCatalogMediaImage,
  uploadTitleShowcaseMediaImage,
  upsertTitleMetadata,
} from "../api";
import { useAuth } from "../auth";
import { readAppConfig } from "../config";
import {
  STUDIO_DESCRIPTION_MAX_LENGTH,
  TITLE_DESCRIPTION_MAX_LENGTH,
  TITLE_SHORT_DESCRIPTION_MAX_LENGTH,
  clampMinimumAge,
  clampPlayerRange,
  shouldShowCharacterCounter,
  validateReleaseInput,
  validateStudioInput,
  validateTitleFormInput,
} from "./develop-validation";
import {
  formatBinaryFileSize,
  normalizeImageUpload,
} from "../media-upload";

const appConfig = readAppConfig();
const WORKSPACE_STORAGE_KEY = "develop-workspace-state";

function buildUploadPolicy(
  definition: Pick<CatalogMediaTypeDefinition, "bucket" | "maxUploadBytes" | "acceptedMimeTypes" | "recommendedWidth" | "recommendedHeight">,
): MigrationMediaUploadPolicy {
  return {
    bucket: definition.bucket,
    maxUploadBytes: definition.maxUploadBytes,
    acceptedMimeTypes: [...definition.acceptedMimeTypes],
    recommendedWidth: definition.recommendedWidth,
    recommendedHeight: definition.recommendedHeight,
  };
}

const fallbackCatalogMediaTypes = Object.values(catalogMediaTypeDefinitions);
const fallbackCatalogMediaTypeDefinitionByKey = fallbackCatalogMediaTypes.reduce<Record<CatalogMediaTypeKey, CatalogMediaTypeDefinition>>(
  (definitionsByKey, definition) => {
    definitionsByKey[definition.key] = definition;
    return definitionsByKey;
  },
  {} as Record<CatalogMediaTypeKey, CatalogMediaTypeDefinition>,
);

function buildAspectRatioValue(width: number, height: number): string {
  return `${width} / ${height}`;
}

function formatCatalogMediaAspectRatio(definition: Pick<CatalogMediaTypeDefinition, "aspectWidth" | "aspectHeight">): string {
  return `${definition.aspectWidth}:${definition.aspectHeight}`;
}

function formatCatalogMediaRecommendedResolution(definition: Pick<CatalogMediaTypeDefinition, "recommendedWidth" | "recommendedHeight">): string {
  return `${definition.recommendedWidth} x ${definition.recommendedHeight} px`;
}

function formatCatalogMediaAcceptedFileTypes(definition: Pick<CatalogMediaTypeDefinition, "acceptedFileTypes">): string {
  return definition.acceptedFileTypes.join(", ");
}

function getCatalogMediaTypeDefinition(
  definitions: readonly CatalogMediaTypeDefinition[],
  key: CatalogMediaTypeKey,
): CatalogMediaTypeDefinition {
  return definitions.find((definition) => definition.key === key) ?? fallbackCatalogMediaTypeDefinitionByKey[key];
}

function CatalogMediaSpecSummary({
  definition,
  className = "",
}: {
  definition: Pick<CatalogMediaTypeDefinition, "aspectWidth" | "aspectHeight" | "recommendedWidth" | "recommendedHeight" | "maxUploadBytes" | "acceptedFileTypes">;
  className?: string;
}) {
  return (
    <div className={`space-y-1 text-[11px] uppercase tracking-[0.18em] text-slate-400 xl:whitespace-nowrap ${className}`.trim()}>
      <p>Expected {formatCatalogMediaAspectRatio(definition)} aspect ratio</p>
      <p>Recommended {formatCatalogMediaRecommendedResolution(definition)}</p>
      <p>Max {formatBinaryFileSize(definition.maxUploadBytes)}</p>
      <p>Accepted {formatCatalogMediaAcceptedFileTypes(definition)}</p>
    </div>
  );
}

const titleSingleMediaTypeKeys = ["title_avatar", "title_card", "title_quick_view_banner", "title_logo"] as const;
const studioMediaDraftKeys = ["avatar", "logo", "banner"] as const;
type TitleSingleMediaTypeKey = (typeof titleSingleMediaTypeKeys)[number];
type TitleMediaDraftKey = "avatar" | "card" | "quickViewBanner" | "logo";
type StudioMediaDraftKey = "avatar" | "logo" | "banner";

const titleMediaDraftKeyByTypeKey: Record<TitleSingleMediaTypeKey, TitleMediaDraftKey> = {
  title_avatar: "avatar",
  title_card: "card",
  title_quick_view_banner: "quickViewBanner",
  title_logo: "logo",
};

const titleMediaTypeKeyByDraftKey: Record<TitleMediaDraftKey, TitleSingleMediaTypeKey> = {
  avatar: "title_avatar",
  card: "title_card",
  quickViewBanner: "title_quick_view_banner",
  logo: "title_logo",
};

const legacyTitleMediaRoleByDraftKey: Partial<Record<TitleMediaDraftKey, "card" | "hero" | "logo">> = {
  card: "card",
  quickViewBanner: "hero",
  logo: "logo",
};

const studioMediaTypeKeyByDraftKey: Record<StudioMediaDraftKey, CatalogMediaTypeKey> = {
  avatar: "studio_avatar",
  logo: "studio_logo",
  banner: "studio_banner",
};

const studioMediaLabelByDraftKey: Record<StudioMediaDraftKey, string> = {
  avatar: "Avatar",
  logo: "Logo",
  banner: "Banner",
};

type Domain = "studios" | "titles" | "releases";
type Workflow =
  | "studios-create"
  | "studios-overview"
  | "studios-analytics"
  | "titles-create"
  | "titles-overview"
  | "titles-analytics"
  | "titles-metadata"
  | "titles-reports"
  | "releases-create"
  | "releases-overview";

type WorkspaceState = {
  domain: Domain;
  workflow: Workflow;
  studioId: string;
  titleId: string;
  releaseId: string;
};

type StudioMediaDraft = {
  url: string;
  previewUrl: string;
  fileName: string | null;
  file: File | null;
};

type TitleMediaDraft = {
  url: string;
  previewUrl: string;
  altText: string;
  fileName: string | null;
  file: File | null;
};

type TitleShowcaseMediaDraft = {
  id?: string;
  kind: "image" | "external_video";
  videoUrl: string;
  altText: string;
  imageUrl: string;
  previewUrl: string;
  fileName: string | null;
  file: File | null;
};

type StudioDraft = {
  displayName: string;
  slug: string;
  description: string;
  avatar: StudioMediaDraft;
  logo: StudioMediaDraft;
  banner: StudioMediaDraft;
  links: Array<{ id?: string; label: string; url: string }>;
};

type TitleDraft = {
  displayName: string;
  slug: string;
  contentKind: "game" | "app";
  lifecycleStatus: "draft" | "active" | "archived";
  visibility: "unlisted" | "listed";
  genres: string[];
  genreInput: string;
  ageRatingAuthorityInput: string;
  shortDescription: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  maxPlayersOrMore: boolean;
  ageRatingAuthority: string;
  ageRatingValue: string;
  minAgeYears: number;
  media: Record<TitleMediaDraftKey, TitleMediaDraft>;
};

type ReleaseDraft = {
  version: string;
  status: "testing" | "production";
  acquisitionUrl: string;
  expiresAt: string;
};

type PersistedStudioDraft = Omit<StudioDraft, "avatar" | "logo" | "banner"> & {
  avatar: Omit<StudioMediaDraft, "file">;
  logo: Omit<StudioMediaDraft, "file">;
  banner: Omit<StudioMediaDraft, "file">;
};

type PersistedTitleDraft = Omit<TitleDraft, "media"> & {
  media: Record<TitleMediaDraftKey, { url: string; previewUrl?: string; altText: string; fileName?: string | null }>;
};

type PersistedTitleMediaDraft = PersistedTitleDraft["media"][keyof PersistedTitleDraft["media"]];
type PersistedStudioMediaDraft = PersistedStudioDraft["avatar"];
type TitleMediaErrors = Record<TitleMediaDraftKey, string | null>;
type StudioMediaErrors = Record<StudioMediaDraftKey, string | null>;

type PersistedState = {
  workspace: WorkspaceState;
  studioCreateDraft: PersistedStudioDraft;
  studioCreateTouched: Record<string, boolean>;
  studioOverview?: { studioId: string; draft: PersistedStudioDraft; touched: Record<string, boolean>; editing: boolean };
  titleCreate?: { studioId: string; draft: PersistedTitleDraft; touched: Record<string, boolean> };
  titleMetadata?: { titleId: string; draft: PersistedTitleDraft; touched: Record<string, boolean>; editing: boolean };
  releaseCreate?: { titleId: string; draft: ReleaseDraft; touched: Record<string, boolean> };
  releaseOverview?: { releaseId: string; draft: ReleaseDraft; touched: Record<string, boolean>; editing: boolean };
  selectedReportId: string | null;
  reportReply: string;
};

function studioDraftsMatch(left: StudioDraft, right: StudioDraft): boolean {
  return JSON.stringify(toPersistedStudioDraft(left)) === JSON.stringify(toPersistedStudioDraft(right));
}

function slugifyValue(value: string): string {
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

function createStudioMediaDraft(url: string | null | undefined): StudioMediaDraft {
  return {
    url: url ?? "",
    previewUrl: url ?? "",
    fileName: null,
    file: null,
  };
}

function getStudioMediaPreview(media: StudioMediaDraft): string {
  return media.previewUrl || media.url;
}

function parseGenreTags(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function normalizeSelectableValues(
  values: readonly string[],
  availableValues: Array<{ value: string; label: string }>,
  options: { canonicalizeUnknown?: (value: string) => string } = {},
): string[] {
  const canonicalizeUnknown = options.canonicalizeUnknown ?? ((value: string) => value.trim());
  const availableByValue = new Map(availableValues.map((candidate) => [candidate.value.toLowerCase(), candidate.value]));
  const availableByLabel = new Map(availableValues.map((candidate) => [candidate.label.toLowerCase(), candidate.value]));
  const normalizedValues: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const normalizedKey = trimmed.toLowerCase();
    const resolved = availableByValue.get(normalizedKey) ?? availableByLabel.get(normalizedKey) ?? canonicalizeUnknown(trimmed);
    if (!resolved) {
      continue;
    }
    if (!normalizedValues.some((candidate) => candidate.toLowerCase() == resolved.toLowerCase())) {
      normalizedValues.push(resolved);
    }
  }

  return normalizedValues;
}

function normalizeGenreDraftValues(values: readonly string[], availableValues: Array<{ value: string; label: string }>): string[] {
  const availableByValue = new Map(availableValues.map((candidate) => [candidate.value.toLowerCase(), candidate.value]));
  const availableByLabel = new Map(availableValues.map((candidate) => [candidate.label.toLowerCase(), candidate.value]));
  const normalizedValues: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const normalizedKey = trimmed.toLowerCase();
    const resolved = availableByValue.get(normalizedKey) ?? availableByLabel.get(normalizedKey) ?? trimmed;
    const identity = normalizeGenreSlug(resolved);
    if (!identity) {
      continue;
    }
    if (!normalizedValues.some((candidate) => normalizeGenreSlug(candidate) === identity)) {
      normalizedValues.push(resolved);
    }
  }

  return normalizedValues;
}

function normalizeAuthorityCode(value: string): string {
  return value.trim().toUpperCase();
}

function createStudioDraft(studio?: DeveloperStudioSummary | null, links: StudioLink[] = []): StudioDraft {
  const avatarEntry = findCatalogMediaImageEntry(studio?.catalogMediaEntries, "studio_avatar");
  const logoEntry = findCatalogMediaImageEntry(studio?.catalogMediaEntries, "studio_logo");
  const bannerEntry = findCatalogMediaImageEntry(studio?.catalogMediaEntries, "studio_banner");

  return {
    displayName: studio?.displayName ?? "",
    slug: studio?.slug ?? "",
    description: studio?.description ?? "",
    avatar: createStudioMediaDraft(avatarEntry?.sourceUrl ?? studio?.avatarUrl),
    logo: createStudioMediaDraft(logoEntry?.sourceUrl ?? studio?.logoUrl),
    banner: createStudioMediaDraft(bannerEntry?.sourceUrl ?? studio?.bannerUrl),
    links: links.length > 0 ? links.map((link) => ({ id: link.id, label: link.label, url: link.url })) : [{ label: "", url: "" }],
  };
}

function findCatalogMediaImageEntry(entries: CatalogMediaEntry[] | undefined, mediaTypeKey: CatalogMediaTypeKey): CatalogMediaEntry | null {
  return (
    entries
      ?.filter((entry) => entry.mediaTypeKey === mediaTypeKey && entry.kind === "image" && entry.sourceUrl)
      .sort((left, right) => left.displayOrder - right.displayOrder || left.createdAt.localeCompare(right.createdAt))[0] ?? null
  );
}

function createTitleMediaDraftFromEntry(entry: CatalogMediaEntry | null, fallback?: { url?: string | null; altText?: string | null }): TitleMediaDraft {
  const sourceUrl = entry?.sourceUrl ?? fallback?.url ?? "";
  return {
    url: sourceUrl,
    previewUrl: sourceUrl,
    altText: entry?.altText ?? fallback?.altText ?? "",
    fileName: null,
    file: null,
  };
}

function findLegacyTitleMediaAsset(
  title: DeveloperTitle | null | undefined,
  mediaRole: "card" | "hero" | "logo",
): DeveloperTitle["mediaAssets"][number] | null {
  return title?.mediaAssets?.find((asset) => asset.mediaRole === mediaRole) ?? null;
}

function findSingleCatalogMediaEntry(entries: CatalogMediaEntry[] | undefined, mediaTypeKey: TitleSingleMediaTypeKey): CatalogMediaEntry | null {
  return entries?.find((entry) => entry.mediaTypeKey === mediaTypeKey) ?? null;
}

function buildPendingCatalogMediaUrl(mediaTypeKey: CatalogMediaTypeKey): string {
  return `https://boardenthusiasts.invalid/pending-${mediaTypeKey}`;
}

function createTitleDraft(title?: DeveloperTitle | null): TitleDraft {
  const avatarEntry = findCatalogMediaImageEntry(title?.catalogMediaEntries, "title_avatar");
  const cardEntry = findCatalogMediaImageEntry(title?.catalogMediaEntries, "title_card");
  const quickViewBannerEntry = findCatalogMediaImageEntry(title?.catalogMediaEntries, "title_quick_view_banner");
  const logoEntry = findCatalogMediaImageEntry(title?.catalogMediaEntries, "title_logo");
  const legacyCardAsset = findLegacyTitleMediaAsset(title, "card");
  const legacyQuickViewAsset = title?.showcaseMedia?.length ? null : findLegacyTitleMediaAsset(title, "hero");
  const legacyLogoAsset = findLegacyTitleMediaAsset(title, "logo");
  return {
    displayName: title?.displayName ?? "",
    slug: title?.slug ?? "title",
    contentKind: title?.contentKind ?? "game",
    lifecycleStatus: title?.lifecycleStatus ?? "draft",
    visibility: title?.visibility ?? "unlisted",
    genres: title?.genreSlugs?.length ? title.genreSlugs : parseGenreTags(title?.genreDisplay),
    genreInput: "",
    ageRatingAuthorityInput: "",
    shortDescription: title?.shortDescription ?? "",
    description: title?.description ?? "",
    minPlayers: title?.minPlayers ?? 1,
    maxPlayers: title?.maxPlayers ?? 4,
    maxPlayersOrMore: title?.maxPlayersOrMore ?? false,
    ageRatingAuthority: title?.ageRatingAuthority ?? "",
    ageRatingValue: title?.ageRatingValue ?? "",
    minAgeYears: title?.minAgeYears ?? 10,
    media: {
      avatar: createTitleMediaDraftFromEntry(avatarEntry),
      card: createTitleMediaDraftFromEntry(cardEntry, { url: legacyCardAsset?.sourceUrl ?? title?.cardImageUrl, altText: legacyCardAsset?.altText }),
      quickViewBanner: createTitleMediaDraftFromEntry(quickViewBannerEntry, { url: legacyQuickViewAsset?.sourceUrl, altText: legacyQuickViewAsset?.altText }),
      logo: createTitleMediaDraftFromEntry(logoEntry, { url: legacyLogoAsset?.sourceUrl, altText: legacyLogoAsset?.altText }),
    },
  };
}

function createReleaseDraft(release?: TitleRelease | null): ReleaseDraft {
  return {
    version: release?.version ?? "1.0.0",
    status: release?.status ?? "testing",
    acquisitionUrl: release?.acquisitionUrl ?? "",
    expiresAt: release?.expiresAt ? formatDateTimeLocalInput(release.expiresAt) : "",
  };
}

function createTitleShowcaseMediaDraft(item?: TitleShowcaseMedia | null): TitleShowcaseMediaDraft {
  return {
    id: item?.id,
    kind: item?.kind ?? "image",
    videoUrl: item?.videoUrl ?? "",
    altText: item?.altText ?? "",
    imageUrl: item?.imageUrl ?? "",
    previewUrl: item?.imageUrl ?? "",
    fileName: null,
    file: null,
  };
}

function fromPersistedReleaseDraft(draft: Partial<ReleaseDraft> | null | undefined): ReleaseDraft {
  return {
    version: draft?.version ?? "1.0.0",
    status: draft?.status === "production" ? "production" : "testing",
    acquisitionUrl: draft?.acquisitionUrl ?? "",
    expiresAt: draft?.expiresAt ?? "",
  };
}

function toPersistedStudioDraft(draft: StudioDraft): PersistedStudioDraft {
  const normalizeMedia = (media: StudioMediaDraft): PersistedStudioMediaDraft => ({
    url: media.url ?? "",
    previewUrl: media.previewUrl ?? media.url ?? "",
    fileName: media.fileName ?? null,
  });

  return {
    displayName: draft.displayName ?? "",
    slug: draft.slug ?? "",
    description: draft.description ?? "",
    links: Array.isArray(draft.links) ? draft.links.map((link) => ({ id: link.id, label: link.label ?? "", url: link.url ?? "" })) : [{ label: "", url: "" }],
    avatar: normalizeMedia(draft.avatar),
    logo: normalizeMedia(draft.logo),
    banner: normalizeMedia(draft.banner),
  };
}

function fromPersistedStudioDraft(draft: PersistedStudioDraft): StudioDraft {
  const fallback = createStudioDraft();
  const restoreMedia = (media: Partial<PersistedStudioMediaDraft> | null | undefined): StudioMediaDraft => ({
    url: media?.url ?? "",
    previewUrl: media?.previewUrl ?? media?.url ?? "",
    fileName: media?.fileName ?? null,
    file: null,
  });

  return {
    displayName: draft?.displayName ?? fallback.displayName,
    slug: draft?.slug ?? fallback.slug,
    description: draft?.description ?? fallback.description,
    avatar: restoreMedia(draft?.avatar),
    logo: restoreMedia(draft?.logo),
    banner: restoreMedia(draft?.banner),
    links:
      Array.isArray(draft?.links) && draft.links.length > 0
        ? draft.links.map((link) => ({ id: link.id, label: link.label ?? "", url: link.url ?? "" }))
        : fallback.links,
  };
}

function toPersistedTitleDraft(draft: TitleDraft): PersistedTitleDraft {
  const normalizeMedia = (media: TitleDraft["media"][keyof TitleDraft["media"]]): PersistedTitleMediaDraft => ({
    url: media?.url ?? "",
    previewUrl: media?.previewUrl ?? media?.url ?? "",
    altText: media?.altText ?? "",
    fileName: media?.fileName ?? null,
  });

  return {
    displayName: draft.displayName ?? "",
    slug: draft.slug ?? "",
    contentKind: draft.contentKind,
    lifecycleStatus: draft.lifecycleStatus,
    visibility: draft.visibility,
    genres: Array.isArray(draft.genres) ? draft.genres.filter((value): value is string => typeof value === "string") : [],
    genreInput: draft.genreInput ?? "",
    ageRatingAuthorityInput: draft.ageRatingAuthorityInput ?? "",
    shortDescription: draft.shortDescription ?? "",
    description: draft.description ?? "",
    minPlayers: Number.isFinite(draft.minPlayers) ? draft.minPlayers : 1,
    maxPlayers: Number.isFinite(draft.maxPlayers) ? draft.maxPlayers : 4,
    maxPlayersOrMore: draft.maxPlayersOrMore === true,
    ageRatingAuthority: draft.ageRatingAuthority ?? "",
    ageRatingValue: draft.ageRatingValue ?? "",
    minAgeYears: Number.isFinite(draft.minAgeYears) ? draft.minAgeYears : 0,
    media: {
      avatar: normalizeMedia(draft.media.avatar),
      card: normalizeMedia(draft.media.card),
      quickViewBanner: normalizeMedia(draft.media.quickViewBanner),
      logo: normalizeMedia(draft.media.logo),
    },
  };
}

function fromPersistedTitleDraft(draft: PersistedTitleDraft): TitleDraft {
  const fallback = createTitleDraft();
  const restoreMedia = (media: Partial<PersistedTitleMediaDraft> | null | undefined): TitleDraft["media"][keyof TitleDraft["media"]] => ({
    url: media?.url ?? "",
    previewUrl: media?.previewUrl ?? media?.url ?? "",
    altText: media?.altText ?? "",
    fileName: media?.fileName ?? null,
    file: null,
  });
  const contentKind = draft?.contentKind === "app" ? "app" : "game";
  const lifecycleStatus = draft?.lifecycleStatus === "active" || draft?.lifecycleStatus === "archived" ? draft.lifecycleStatus : "draft";
  const visibility = draft?.visibility === "listed" ? "listed" : "unlisted";

  return {
    ...fallback,
    displayName: draft?.displayName ?? fallback.displayName,
    slug: draft?.slug ?? fallback.slug,
    contentKind,
    lifecycleStatus,
    visibility,
    genres: Array.isArray(draft?.genres) ? draft.genres.filter((value): value is string => typeof value === "string") : fallback.genres,
    genreInput: draft?.genreInput ?? fallback.genreInput,
    ageRatingAuthorityInput: draft?.ageRatingAuthorityInput ?? fallback.ageRatingAuthorityInput,
    shortDescription: draft?.shortDescription ?? fallback.shortDescription,
    description: draft?.description ?? fallback.description,
    minPlayers: typeof draft?.minPlayers === "number" ? draft.minPlayers : fallback.minPlayers,
    maxPlayers: typeof draft?.maxPlayers === "number" ? draft.maxPlayers : fallback.maxPlayers,
    maxPlayersOrMore: draft?.maxPlayersOrMore === true,
    ageRatingAuthority: draft?.ageRatingAuthority ?? fallback.ageRatingAuthority,
    ageRatingValue: draft?.ageRatingValue ?? fallback.ageRatingValue,
    minAgeYears: typeof draft?.minAgeYears === "number" ? draft.minAgeYears : fallback.minAgeYears,
    media: {
      avatar: restoreMedia(draft?.media?.avatar),
      card: restoreMedia(draft?.media?.card),
      quickViewBanner: restoreMedia(draft?.media?.quickViewBanner ?? (draft?.media as Record<string, Partial<PersistedTitleMediaDraft> | undefined> | undefined)?.hero),
      logo: restoreMedia(draft?.media?.logo),
    },
  };
}

function workflowForDomain(domain: Domain): Workflow {
  if (domain === "studios") {
    return "studios-overview";
  }

  if (domain === "titles") {
    return "titles-overview";
  }

  return "releases-overview";
}

function isWorkflowAllowedForDomain(domain: Domain, workflow: Workflow): boolean {
  if (domain === "studios") {
    return workflow === "studios-overview" || workflow === "studios-analytics" || workflow === "studios-create";
  }

  if (domain === "titles") {
    return workflow === "titles-overview" || workflow === "titles-analytics" || workflow === "titles-create" || workflow === "titles-metadata" || workflow === "titles-reports";
  }

  return workflow === "releases-overview" || workflow === "releases-create";
}

function createDefaultWorkspace(): WorkspaceState {
  return { domain: "studios", workflow: "studios-overview", studioId: "", titleId: "", releaseId: "" };
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function loadWorkspaceState(searchParams: URLSearchParams, persisted: PersistedState | null): WorkspaceState {
  const fallback = persisted?.workspace ?? createDefaultWorkspace();
  const domain = searchParams.get("domain");
  const workflow = searchParams.get("workflow");

  const resolvedDomain: Domain = domain === "studios" || domain === "titles" || domain === "releases" ? domain : fallback.domain;
  const resolvedWorkflow =
    workflow &&
    (workflow === "studios-create" ||
      workflow === "studios-overview" ||
      workflow === "studios-analytics" ||
      workflow === "titles-create" ||
      workflow === "titles-overview" ||
      workflow === "titles-analytics" ||
      workflow === "titles-metadata" ||
      workflow === "titles-reports" ||
      workflow === "releases-create" ||
      workflow === "releases-overview")
      ? workflow
      : fallback.workflow;

  return {
    domain: resolvedDomain,
    workflow: isWorkflowAllowedForDomain(resolvedDomain, resolvedWorkflow) ? resolvedWorkflow : workflowForDomain(resolvedDomain),
    studioId: searchParams.get("studioId") ?? fallback.studioId,
    titleId: searchParams.get("titleId") ?? fallback.titleId,
    releaseId: searchParams.get("releaseId") ?? fallback.releaseId,
  };
}

function savePersistedState(state: PersistedState): void {
  try {
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best effort only.
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeLocalInput(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const localValue = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localValue.toISOString().slice(0, 16);
}

function getMinimumReleaseExpirationDate(now = new Date()): Date {
  const minimum = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  minimum.setSeconds(0, 0);
  return minimum;
}

function DateTimeLocalField({
  value,
  min,
  disabled,
  onChange,
  onBlur,
}: {
  value: string;
  min?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function openPicker(): void {
    const input = inputRef.current;
    if (!input || disabled) {
      return;
    }

    if ("showPicker" in input && typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  return (
    <div className="develop-datetime-input-shell">
      <input
        ref={inputRef}
        className="develop-datetime-input"
        type="datetime-local"
        value={value}
        min={min}
        step={60}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
        disabled={disabled}
      />
      <button
        type="button"
        className="develop-datetime-picker-button"
        aria-label="Open expiration date picker"
        onClick={openPicker}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 2v3M17 2v3M3.5 8.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7A1.5 1.5 0 0 1 5 5.5Z" />
        </svg>
      </button>
    </div>
  );
}

function formatReleaseStatus(status: TitleRelease["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatContentKind(value: "game" | "app"): string {
  return value === "game" ? "Game" : "App";
}

function formatLifecycleStatus(value: TitleDraft["lifecycleStatus"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatVisibility(value: "unlisted" | "listed"): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMinimumAge(value: number): string {
  return value >= 18 ? "18+" : String(value);
}

function formatPlayerCount(value: Pick<TitleDraft, "minPlayers" | "maxPlayers" | "maxPlayersOrMore">): string {
  if (value.maxPlayersOrMore) {
    return value.minPlayers === value.maxPlayers ? `${value.maxPlayers}+ players` : `${value.minPlayers}-${value.maxPlayers}+ players`;
  }

  return value.minPlayers === value.maxPlayers ? `${value.minPlayers} player${value.minPlayers === 1 ? "" : "s"}` : `${value.minPlayers}-${value.maxPlayers} players`;
}

function createEmptyStudioMediaErrors(): StudioMediaErrors {
  return {
    avatar: null,
    logo: null,
    banner: null,
  };
}

function createEmptyTitleMediaErrors(): TitleMediaErrors {
  return {
    avatar: null,
    card: null,
    quickViewBanner: null,
    logo: null,
  };
}

function hasConfiguredTitleMedia(media: TitleMediaDraft): boolean {
  return Boolean(media.url.trim() || media.previewUrl.trim() || media.file || media.fileName);
}

function deriveActiveTitleMediaTypeKeys(draft: TitleDraft): TitleSingleMediaTypeKey[] {
  return titleSingleMediaTypeKeys.filter((mediaTypeKey) => hasConfiguredTitleMedia(draft.media[titleMediaDraftKeyByTypeKey[mediaTypeKey]]));
}

function previewMediaUrl(media: Pick<TitleMediaDraft, "previewUrl" | "url">): string {
  return media.previewUrl || media.url;
}

function titleCanBeActivated(title: DeveloperTitle | null): boolean {
  return Boolean(title) && title!.lifecycleStatus === "draft";
}

function titleCanBeUnarchived(title: DeveloperTitle | null): boolean {
  return Boolean(title) && title!.lifecycleStatus === "archived";
}

function titleVisibilityCanBeChanged(title: DeveloperTitle | null): boolean {
  return Boolean(title) && title!.lifecycleStatus === "active";
}

function formatWorkspaceActionError(
  error: unknown,
  options?: {
    releaseVersion?: string;
  },
): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("titles_draft_private")) {
    return "Your local title rules are out of date. Apply the latest database migrations, then try again.";
  }

  if (message.includes("title_releases_title_version_unique")) {
    const version = options?.releaseVersion?.trim();
    return version
      ? `This title already has a release with version ${version}. Choose a different version and try again.`
      : "This title already has a release with that version. Choose a different version and try again.";
  }

  if (message.includes("duplicate key value violates unique constraint")) {
    return "That information is already in use. Change it and try again.";
  }

  return message;
}

function titleVisibilityDescription(title: DeveloperTitle): string {
  if (title.lifecycleStatus === "archived") {
    return "Archived titles are hidden from players. Unarchive the title before making any other changes.";
  }

  if (title.lifecycleStatus === "draft") {
    return "Draft titles stay hidden from players until you activate them.";
  }

  return title.visibility === "listed"
    ? "Listed titles appear in browse and search so players can discover them."
    : "Unlisted titles stay out of browse and search, but players who already saved them can still find them in their library or wishlist.";
}

function titleVisibilityToggleTooltip(title: DeveloperTitle | null, saving: boolean): string | null {
  if (!title) {
    return null;
  }

  if (saving) {
    return "Please wait for the current update to finish.";
  }

  if (title.lifecycleStatus === "archived") {
    return "Unarchive this title before changing whether players can find it.";
  }

  if (title.lifecycleStatus === "draft" && !title.currentRelease) {
    return "Activate this title when you are ready for players to start discovering it.";
  }

  if (title.lifecycleStatus === "draft") {
    return "Activate this title before changing whether players can find it.";
  }

  return null;
}

function WorkflowButton({
  active,
  children,
  disabled = false,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={getWorkspaceWorkflowButtonClass(active)}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="surface-panel-strong rounded-[1.25rem] p-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-300">{detail}</p>
    </section>
  );
}

function Field({
  label,
  required = false,
  error,
  helper,
  counter,
  asLabel = true,
  inputId,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helper?: ReactNode;
  counter?: ReactNode;
  asLabel?: boolean;
  inputId?: string;
  children: ReactNode;
}) {
  const Wrapper = asLabel ? "label" : "div";

  return (
    <Wrapper className="field block">
      <div className="flex items-center justify-between gap-3">
        {asLabel ? (
          <span className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">
            {label}
            {required ? " *" : ""}
          </span>
        ) : (
          <label className="text-xs uppercase tracking-[0.18em] text-cyan-100/70" htmlFor={inputId}>
            {label}
            {required ? " *" : ""}
          </label>
        )}
        {counter}
      </div>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : helper ? <p className="mt-2 text-xs text-slate-400">{helper}</p> : null}
    </Wrapper>
  );
}

function ReadOnlyField({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <section className="develop-readonly-field">
      <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">{label}</div>
      <div className="mt-3 text-lg font-semibold text-white">{value}</div>
      {helper ? <p className="mt-2 text-sm text-slate-400">{helper}</p> : null}
    </section>
  );
}

function TokenField({
  label,
  required = false,
  placeholder,
  inputValue,
  selectedValues,
  availableValues,
  allowCreate = true,
  error,
  onInputChange,
  onAdd,
  onRemove,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  inputValue: string;
  selectedValues: Array<{ value: string; label: string }>;
  availableValues: Array<{ value: string; label: string }>;
  allowCreate?: boolean;
  error?: string;
  onInputChange: (value: string) => void;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const inputId = useId();
  const normalizedInput = inputValue.trim().toLowerCase();
  const filteredOptions = (normalizedInput ? availableValues.filter((candidate) => candidate.label.toLowerCase().includes(normalizedInput)) : availableValues).filter(
    (candidate) => !selectedValues.some((selected) => selected.value === candidate.value),
  );
  const canCreate = allowCreate && normalizedInput.length > 0 && !availableValues.some((candidate) => candidate.label.toLowerCase() === normalizedInput) && !selectedValues.some((candidate) => candidate.label.toLowerCase() === normalizedInput);
  const topFilteredOption = normalizedInput.length > 0 ? filteredOptions[0] ?? null : null;

  return (
    <div>
      <Field label={label} required={required} error={error} asLabel={false} inputId={inputId}>
        <div className="surface-panel-strong rounded-[1rem] p-3">
          <input
            id={inputId}
            aria-label={label}
            className="w-full rounded-[0.9rem] border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
            value={inputValue}
            onChange={(event) => onInputChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              if (topFilteredOption) {
                onAdd(topFilteredOption.value);
                return;
              }

              if (canCreate) {
                onAdd(inputValue.trim());
              }
            }}
            placeholder={placeholder}
          />
          {selectedValues.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedValues.map((value) => (
                <button
                  key={value.value}
                  className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-50"
                  type="button"
                  onClick={() => onRemove(value.value)}
                  aria-label={`Remove ${value.label}`}
                >
                  {value.label} x
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {filteredOptions.map((value) => (
              <button key={value.value} className="secondary-button !px-3 !py-1 text-xs" type="button" onClick={() => onAdd(value.value)}>
                {value.label}
              </button>
            ))}
            {canCreate ? (
              <button className="primary-button !px-3 !py-1 text-xs" type="button" onClick={() => onAdd(inputValue.trim())}>
                Add {inputValue.trim()}
              </button>
            ) : null}
          </div>
        </div>
      </Field>
    </div>
  );
}

function TitleMediaListItem({
  mediaTypeKey,
  definition,
  availableTypeLabels,
  availableTypeKeys,
  state,
  error,
  disabled,
  onTypeChange,
  onUrlChange,
  onAltTextChange,
  onFileChange,
  onRemove,
}: {
  mediaTypeKey: TitleSingleMediaTypeKey;
  definition: CatalogMediaTypeDefinition;
  availableTypeLabels: Record<TitleSingleMediaTypeKey, string>;
  availableTypeKeys: TitleSingleMediaTypeKey[];
  state: TitleMediaDraft;
  error?: string | null;
  disabled: boolean;
  onTypeChange: (nextTypeKey: TitleSingleMediaTypeKey) => void;
  onUrlChange: (value: string) => void;
  onAltTextChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  const currentPreviewUrl = previewMediaUrl(state);
  const typeSelectId = useId();

  return (
    <article className="surface-panel-strong rounded-[1rem] p-4" data-title-media-type={mediaTypeKey}>
      <div className="grid gap-4 xl:grid-cols-[15.5rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-[0.9rem] border border-white/10 bg-slate-950/40" style={{ aspectRatio: buildAspectRatioValue(definition.recommendedWidth, definition.recommendedHeight) }}>
            {currentPreviewUrl ? (
              <img className="h-full w-full object-cover" src={currentPreviewUrl} alt={state.altText || `${definition.displayName} media`} />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs uppercase tracking-[0.18em] text-slate-400">No image added</div>
            )}
          </div>
          <CatalogMediaSpecSummary definition={definition} />
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.42fr)_auto]">
            <Field label="Media type" asLabel={false} inputId={typeSelectId}>
              <select id={typeSelectId} value={mediaTypeKey} onChange={(event) => onTypeChange(event.currentTarget.value as TitleSingleMediaTypeKey)} disabled={disabled}>
                {availableTypeKeys.map((typeKey) => {
                  return (
                    <option key={typeKey} value={typeKey}>
                      {availableTypeLabels[typeKey]}
                    </option>
                  );
                })}
              </select>
            </Field>
            <div className="flex items-end justify-start lg:justify-end">
              <button className="danger-button" type="button" onClick={onRemove} disabled={disabled}>
                Remove item
              </button>
            </div>
          </div>
          <p className="text-sm leading-7 text-slate-300">{definition.usageSummary}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="URL">
              <input value={state.url} onChange={(event) => onUrlChange(event.currentTarget.value)} disabled={disabled} placeholder="https://..." />
            </Field>
            <Field label="Alt text">
              <input value={state.altText} onChange={(event) => onAltTextChange(event.currentTarget.value)} disabled={disabled} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className={`secondary-button inline-flex cursor-pointer ${disabled ? "pointer-events-none opacity-50" : ""}`}>
              Upload image
              <input className="sr-only" type="file" accept={definition.acceptedMimeTypes.join(",")} disabled={disabled} onChange={(event) => onFileChange(event.currentTarget.files?.[0] ?? null)} />
            </label>
            <span className="text-sm text-slate-400">{state.fileName ?? "No upload selected"}</span>
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </div>
    </article>
  );
}

function StudioMediaListItem({
  mediaRole,
  label,
  state,
  definition,
  error,
  disabled,
  onUrlChange,
  onFileChange,
  onRemove,
}: {
  mediaRole: StudioMediaDraftKey;
  label: string;
  state: StudioMediaDraft;
  definition: CatalogMediaTypeDefinition;
  error?: string | null;
  disabled: boolean;
  onUrlChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  const previewUrl = getStudioMediaPreview(state);

  return (
    <article className="surface-panel-strong rounded-[1rem] p-4" data-studio-media-role={mediaRole}>
      <div className="grid gap-4 xl:grid-cols-[15.5rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-[0.9rem] border border-white/10 bg-slate-950/40" style={{ aspectRatio: buildAspectRatioValue(definition.recommendedWidth, definition.recommendedHeight) }}>
            {previewUrl ? (
              <img className="h-full w-full object-cover" src={previewUrl} alt={`${label} preview`} />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs uppercase tracking-[0.18em] text-slate-400">No image added</div>
            )}
          </div>
          <CatalogMediaSpecSummary definition={definition} />
        </div>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">{label}</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{definition.usageSummary}</p>
            </div>
          </div>
          <Field label="URL">
            <input value={state.url} onChange={(event) => onUrlChange(event.currentTarget.value)} disabled={disabled} placeholder="https://..." />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <label className={`secondary-button inline-flex cursor-pointer ${disabled ? "pointer-events-none opacity-50" : ""}`}>
              Upload image
              <input className="sr-only" type="file" accept={definition.acceptedMimeTypes.join(",")} disabled={disabled} onChange={(event) => onFileChange(event.currentTarget.files?.[0] ?? null)} />
            </label>
            <span className="text-sm text-slate-400">{state.fileName ?? "No upload selected"}</span>
            {previewUrl ? (
              <button className="secondary-button" type="button" onClick={onRemove} disabled={disabled}>
                Remove media
              </button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </div>
    </article>
  );
}

function StudioPreviewModal({ studio, onClose }: { studio: StudioDraft; onClose: () => void }) {
  const bannerPreview = getStudioMediaPreview(studio.banner);
  const avatarPreview = getStudioMediaPreview(studio.avatar);
  const logoPreview = getStudioMediaPreview(studio.logo);
  const identityPreviewDefinition = avatarPreview
    ? fallbackCatalogMediaTypeDefinitionByKey["studio_avatar"]
    : fallbackCatalogMediaTypeDefinitionByKey["studio_logo"];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4" role="dialog" aria-modal="true" aria-labelledby="studio-preview-title" onClick={onClose}>
      <section className="app-panel w-full max-w-3xl overflow-hidden p-0" onClick={(event) => event.stopPropagation()}>
        <div className="relative min-h-[14rem] overflow-hidden bg-slate-950/50">
          {bannerPreview ? <img className="h-56 w-full object-cover opacity-80" src={bannerPreview} alt="" aria-hidden="true" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-end gap-4">
              {avatarPreview || logoPreview ? (
                <div
                  className="w-20 overflow-hidden rounded-[1.25rem] border border-white/10 md:w-24"
                  style={{ aspectRatio: buildAspectRatioValue(identityPreviewDefinition.recommendedWidth, identityPreviewDefinition.recommendedHeight) }}
                >
                  <img
                    className="h-full w-full object-cover"
                    src={avatarPreview || logoPreview}
                    alt={`${studio.displayName || "Studio"} avatar`}
                  />
                </div>
              ) : null}
              <div>
                <h2 id="studio-preview-title" className="text-3xl font-semibold text-white">
                  {studio.displayName || "Untitled studio"}
                </h2>
                <p className="mt-2 text-sm tracking-[0.2em] text-cyan-100/70">
                  <span className="lowercase">{studio.slug || "studio"}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm leading-7 text-slate-300">{studio.description || "No description added yet."}</p>
          {studio.links.some((link) => link.label.trim() && link.url.trim()) ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {studio.links
                .filter((link) => link.label.trim() && link.url.trim())
                .map((link, index) => (
                  <a key={`${link.label}-${index}`} className="secondary-button" href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
            </div>
          ) : null}
          <button className="secondary-button mt-6" type="button" onClick={onClose}>
            Close preview
          </button>
        </div>
      </section>
    </div>
  );
}

function WorkspaceModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <section className="app-panel w-full max-w-2xl p-0" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <h2 className="text-3xl font-semibold text-white">{title}</h2>
          <button className="text-slate-400 transition hover:text-white" type="button" onClick={onClose} aria-label="Close dialog">
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
              <path fill="currentColor" d="m18.3 5.71-1.41-1.42L12 9.17 7.11 4.29 5.7 5.71 10.59 10.6 5.7 15.49l1.41 1.42L12 12l4.89 4.91 1.41-1.42-4.89-4.89Z" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </section>
    </div>
  );
}

function TitleActivationPromptModal({
  title,
  saving,
  onActivate,
  onSkip,
}: {
  title: DeveloperTitle;
  saving: boolean;
  onActivate: () => void;
  onSkip: () => void;
}) {
  return (
    <WorkspaceModal title="Activate Title?" onClose={onSkip}>
      <div className="space-y-5">
        <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 p-5 text-sm leading-7 text-emerald-50">
          <div className="text-lg font-semibold text-white">{title.displayName} now has its first release.</div>
          <p className="mt-3">
            You can activate the title now to make it active and listed, then set this release as the current release. You can change the title&apos;s active and listed state later from the title overview.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="primary-button" type="button" onClick={onActivate} disabled={saving}>
            {saving ? "Activating..." : "Activate and List Title"}
          </button>
          <button className="secondary-button" type="button" onClick={onSkip} disabled={saving}>
            Not right now
          </button>
        </div>
      </div>
    </WorkspaceModal>
  );
}

function DeleteTitlePasswordModal({
  title,
  currentPassword,
  error,
  saving,
  onCurrentPasswordChange,
  onContinue,
  onClose,
}: {
  title: DeveloperTitle;
  currentPassword: string;
  error: string | null;
  saving: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <WorkspaceModal title={`Delete ${title.displayName}`} onClose={onClose}>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          onContinue();
        }}
      >
        <div className="rounded-[1.25rem] border border-rose-400/35 bg-rose-500/10 p-5">
          <div className="text-2xl font-semibold text-white">This action cannot be undone.</div>
          <p className="mt-3 text-base leading-8 text-rose-50/90">
            Deleting this title will permanently remove the title and all of its associated data.
          </p>
        </div>
        <Field label="Current password" error={error ?? undefined}>
          <input type="password" value={currentPassword} onChange={(event) => onCurrentPasswordChange(event.currentTarget.value)} placeholder="Enter your password" autoFocus />
        </Field>
        <div className="flex flex-wrap gap-3">
          <button className="danger-button" type="submit" disabled={saving || currentPassword.trim().length === 0}>
            Continue
          </button>
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </WorkspaceModal>
  );
}

function DeleteTitleConfirmationModal({
  title,
  confirmationName,
  currentPassword,
  error,
  saving,
  onConfirmationNameChange,
  onBack,
  onDelete,
  onClose,
}: {
  title: DeveloperTitle;
  confirmationName: string;
  currentPassword: string;
  error: string | null;
  saving: boolean;
  onConfirmationNameChange: (value: string) => void;
  onBack: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <WorkspaceModal title={`Confirm deletion of ${title.displayName}`} onClose={onClose}>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          onDelete();
        }}
      >
        <div className="rounded-[1.25rem] border border-rose-400/35 bg-rose-500/10 p-5">
          <div className="text-2xl font-semibold text-white">Delete this title permanently.</div>
          <p className="mt-3 text-base leading-8 text-rose-50/90">
            This permanently deletes the title and all of its associated data.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Type this title name exactly to confirm.</p>
          <p className="text-xl font-bold text-white">{title.displayName}</p>
        </div>
        <Field label="Title name" error={error ?? undefined}>
          <input value={confirmationName} onChange={(event) => onConfirmationNameChange(event.currentTarget.value)} placeholder={title.displayName} autoFocus />
        </Field>
        <div className="flex flex-wrap gap-3">
          <button className="danger-button" type="submit" disabled={saving || currentPassword.trim().length === 0 || confirmationName.trim() !== title.displayName}>
            {saving ? "Deleting..." : "I Understand, Delete Title"}
          </button>
          <button className="secondary-button" type="button" onClick={onBack} disabled={saving}>
            Back
          </button>
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </WorkspaceModal>
  );
}

export function DevelopWorkspacePage() {
  const { session, currentUser } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [searchParams, setSearchParams] = useSearchParams();
  const persistedState = useMemo(() => loadPersistedState(), []);

  const [workspace, setWorkspace] = useState<WorkspaceState>(() => loadWorkspaceState(searchParams, persistedState));
  const [developerAccessEnabled, setDeveloperAccessEnabled] = useState(false);
  const [studios, setStudios] = useState<DeveloperStudioSummary[]>([]);
  const [genreCatalog, setGenreCatalog] = useState<GenreDefinition[]>([]);
  const [ageRatingAuthorityCatalog, setAgeRatingAuthorityCatalog] = useState<AgeRatingAuthorityDefinition[]>([]);
  const [catalogMediaTypeCatalog, setCatalogMediaTypeCatalog] = useState<CatalogMediaTypeDefinition[]>(fallbackCatalogMediaTypes);
  const [links, setLinks] = useState<StudioLink[]>([]);
  const [linksStudioId, setLinksStudioId] = useState<string | null>(null);
  const [titles, setTitles] = useState<CatalogTitleSummary[]>([]);
  const [developerTitle, setDeveloperTitle] = useState<DeveloperTitle | null>(null);
  const [metadataVersions, setMetadataVersions] = useState<TitleMetadataVersion[]>([]);
  const [showcaseMediaDrafts, setShowcaseMediaDrafts] = useState<TitleShowcaseMediaDraft[]>([]);
  const [reports, setReports] = useState<TitleReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(persistedState?.selectedReportId ?? null);
  const [selectedReport, setSelectedReport] = useState<TitleReportDetail | null>(null);
  const [reportReply, setReportReply] = useState(persistedState?.reportReply ?? "");
  const [releases, setReleases] = useState<TitleRelease[]>([]);
  const [studioCreateDraft, setStudioCreateDraft] = useState<StudioDraft>(persistedState?.studioCreateDraft ? fromPersistedStudioDraft(persistedState.studioCreateDraft) : createStudioDraft());
  const [studioCreateTouched, setStudioCreateTouched] = useState<Record<string, boolean>>(persistedState?.studioCreateTouched ?? {});
  const [studioOverviewDraft, setStudioOverviewDraft] = useState<StudioDraft>(persistedState?.studioOverview ? fromPersistedStudioDraft(persistedState.studioOverview.draft) : createStudioDraft());
  const [studioOverviewTouched, setStudioOverviewTouched] = useState<Record<string, boolean>>(persistedState?.studioOverview?.touched ?? {});
  const [studioOverviewEditing, setStudioOverviewEditing] = useState(persistedState?.studioOverview?.editing ?? false);
  const [studioOverviewContextId, setStudioOverviewContextId] = useState<string | null>(persistedState?.studioOverview?.studioId ?? null);
  const [studioCreateMediaErrors, setStudioCreateMediaErrors] = useState<StudioMediaErrors>(() => createEmptyStudioMediaErrors());
  const [studioOverviewMediaErrors, setStudioOverviewMediaErrors] = useState<StudioMediaErrors>(() => createEmptyStudioMediaErrors());
  const [titleCreateDraft, setTitleCreateDraft] = useState<TitleDraft>(persistedState?.titleCreate ? fromPersistedTitleDraft(persistedState.titleCreate.draft) : createTitleDraft());
  const [titleCreateTouched, setTitleCreateTouched] = useState<Record<string, boolean>>(persistedState?.titleCreate?.touched ?? {});
  const [titleCreateContextStudioId, setTitleCreateContextStudioId] = useState<string | null>(persistedState?.titleCreate?.studioId ?? null);
  const [titleCreateMediaErrors, setTitleCreateMediaErrors] = useState<TitleMediaErrors>(() => createEmptyTitleMediaErrors());
  const [titleCreateMediaList, setTitleCreateMediaList] = useState<TitleSingleMediaTypeKey[]>(() => deriveActiveTitleMediaTypeKeys(persistedState?.titleCreate ? fromPersistedTitleDraft(persistedState.titleCreate.draft) : createTitleDraft()));
  const [titleCreateNextMediaType, setTitleCreateNextMediaType] = useState<TitleSingleMediaTypeKey>("title_avatar");
  const [metadataDraft, setMetadataDraft] = useState<TitleDraft>(persistedState?.titleMetadata ? fromPersistedTitleDraft(persistedState.titleMetadata.draft) : createTitleDraft());
  const [metadataTouched, setMetadataTouched] = useState<Record<string, boolean>>(persistedState?.titleMetadata?.touched ?? {});
  const [metadataEditing, setMetadataEditing] = useState(persistedState?.titleMetadata?.editing ?? false);
  const [metadataContextId, setMetadataContextId] = useState<string | null>(persistedState?.titleMetadata?.titleId ?? null);
  const [metadataMediaErrors, setMetadataMediaErrors] = useState<TitleMediaErrors>(() => createEmptyTitleMediaErrors());
  const [metadataMediaList, setMetadataMediaList] = useState<TitleSingleMediaTypeKey[]>(() => deriveActiveTitleMediaTypeKeys(persistedState?.titleMetadata ? fromPersistedTitleDraft(persistedState.titleMetadata.draft) : createTitleDraft()));
  const [metadataNextMediaType, setMetadataNextMediaType] = useState<TitleSingleMediaTypeKey>("title_avatar");
  const [showcaseMediaError, setShowcaseMediaError] = useState<string | null>(null);
  const [releaseCreateDraft, setReleaseCreateDraft] = useState<ReleaseDraft>(fromPersistedReleaseDraft(persistedState?.releaseCreate?.draft));
  const [releaseCreateTouched, setReleaseCreateTouched] = useState<Record<string, boolean>>(persistedState?.releaseCreate?.touched ?? {});
  const [releaseCreateContextTitleId, setReleaseCreateContextTitleId] = useState<string | null>(persistedState?.releaseCreate?.titleId ?? null);
  const [releaseDraft, setReleaseDraft] = useState<ReleaseDraft>(fromPersistedReleaseDraft(persistedState?.releaseOverview?.draft));
  const [releaseTouched, setReleaseTouched] = useState<Record<string, boolean>>(persistedState?.releaseOverview?.touched ?? {});
  const [releaseEditing, setReleaseEditing] = useState(persistedState?.releaseOverview?.editing ?? false);
  const [releaseContextId, setReleaseContextId] = useState<string | null>(persistedState?.releaseOverview?.releaseId ?? null);
  const [activationPromptReleaseId, setActivationPromptReleaseId] = useState<string | null>(null);
  const [deletePasswordModalOpen, setDeletePasswordModalOpen] = useState(false);
  const [deleteConfirmationModalOpen, setDeleteConfirmationModalOpen] = useState(false);
  const [deleteCurrentPassword, setDeleteCurrentPassword] = useState("");
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [titleActionsError, setTitleActionsError] = useState<string | null>(null);
  const [titleOverviewError, setTitleOverviewError] = useState<string | null>(null);
  const [releaseCreateError, setReleaseCreateError] = useState<string | null>(null);
  const [releaseOverviewError, setReleaseOverviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeStudio = studios.find((studio) => studio.id === workspace.studioId) ?? null;
  const activeTitle = developerTitle?.id === workspace.titleId ? developerTitle : null;
  const activeRelease = releases.find((release) => release.id === workspace.releaseId) ?? null;

  const genreOptions = useMemo(() => genreCatalog.map((genre) => ({ value: genre.slug, label: genre.displayName })), [genreCatalog]);
  const genreLabelBySlug = useMemo(() => new Map(genreCatalog.map((genre) => [genre.slug, genre.displayName])), [genreCatalog]);
  const ageRatingAuthorityOptions = useMemo(
    () => ageRatingAuthorityCatalog.map((authority) => ({ value: authority.code, label: authority.displayName })),
    [ageRatingAuthorityCatalog],
  );
  const studioMediaDefinitionByDraftKey = useMemo<Record<StudioMediaDraftKey, CatalogMediaTypeDefinition>>(
    () => ({
      avatar: getCatalogMediaTypeDefinition(catalogMediaTypeCatalog, "studio_avatar"),
      logo: getCatalogMediaTypeDefinition(catalogMediaTypeCatalog, "studio_logo"),
      banner: getCatalogMediaTypeDefinition(catalogMediaTypeCatalog, "studio_banner"),
    }),
    [catalogMediaTypeCatalog],
  );
  const titleMediaDefinitionByDraftKey = useMemo<Record<TitleMediaDraftKey, CatalogMediaTypeDefinition>>(
    () => ({
      avatar: getCatalogMediaTypeDefinition(catalogMediaTypeCatalog, "title_avatar"),
      card: getCatalogMediaTypeDefinition(catalogMediaTypeCatalog, "title_card"),
      quickViewBanner: getCatalogMediaTypeDefinition(catalogMediaTypeCatalog, "title_quick_view_banner"),
      logo: getCatalogMediaTypeDefinition(catalogMediaTypeCatalog, "title_logo"),
    }),
    [catalogMediaTypeCatalog],
  );
  const titleMediaDefinitionByTypeKey = useMemo<Record<TitleSingleMediaTypeKey, CatalogMediaTypeDefinition>>(
    () => ({
      title_avatar: titleMediaDefinitionByDraftKey.avatar,
      title_card: titleMediaDefinitionByDraftKey.card,
      title_quick_view_banner: titleMediaDefinitionByDraftKey.quickViewBanner,
      title_logo: titleMediaDefinitionByDraftKey.logo,
    }),
    [titleMediaDefinitionByDraftKey],
  );
  const showcaseMediaDefinition = useMemo(() => getCatalogMediaTypeDefinition(catalogMediaTypeCatalog, "title_showcase"), [catalogMediaTypeCatalog]);
  const studioMediaUploadPolicies = useMemo<Record<StudioMediaDraftKey, MigrationMediaUploadPolicy>>(
    () => ({
      avatar: buildUploadPolicy(studioMediaDefinitionByDraftKey.avatar),
      logo: buildUploadPolicy(studioMediaDefinitionByDraftKey.logo),
      banner: buildUploadPolicy(studioMediaDefinitionByDraftKey.banner),
    }),
    [studioMediaDefinitionByDraftKey],
  );
  const titleMediaUploadPolicies = useMemo<Record<TitleMediaDraftKey | "showcase", MigrationMediaUploadPolicy>>(
    () => ({
      avatar: buildUploadPolicy(titleMediaDefinitionByDraftKey.avatar),
      card: buildUploadPolicy(titleMediaDefinitionByDraftKey.card),
      quickViewBanner: buildUploadPolicy(titleMediaDefinitionByDraftKey.quickViewBanner),
      logo: buildUploadPolicy(titleMediaDefinitionByDraftKey.logo),
      showcase: buildUploadPolicy(showcaseMediaDefinition),
    }),
    [showcaseMediaDefinition, titleMediaDefinitionByDraftKey],
  );
  const titleMediaTypeLabelByKey = useMemo<Record<TitleSingleMediaTypeKey, string>>(
    () => ({
      title_avatar: titleMediaDefinitionByTypeKey.title_avatar.displayName,
      title_card: titleMediaDefinitionByTypeKey.title_card.displayName,
      title_quick_view_banner: titleMediaDefinitionByTypeKey.title_quick_view_banner.displayName,
      title_logo: titleMediaDefinitionByTypeKey.title_logo.displayName,
    }),
    [titleMediaDefinitionByTypeKey],
  );

  const studioCreateValidation = useMemo(() => validateStudioInput(studioCreateDraft, { existingSlugs: studios.map((studio) => studio.slug) }), [studioCreateDraft, studios]);
  const studioOverviewValidation = useMemo(() => validateStudioInput(studioOverviewDraft, { existingSlugs: studios.map((studio) => studio.slug), currentSlug: activeStudio?.slug ?? null }), [activeStudio?.slug, studioOverviewDraft, studios]);
  const titleCreateValidation = useMemo(() => validateTitleFormInput(titleCreateDraft, { existingSlugs: titles.map((title) => title.slug) }), [titleCreateDraft, titles]);
  const metadataValidation = useMemo(() => validateTitleFormInput(metadataDraft, { existingSlugs: titles.map((title) => title.slug), currentSlug: activeTitle?.slug ?? null }), [activeTitle?.slug, metadataDraft, titles]);
  const releaseCreateValidation = useMemo(() => validateReleaseInput(releaseCreateDraft), [releaseCreateDraft]);
  const releaseValidation = useMemo(() => validateReleaseInput(releaseDraft), [releaseDraft]);
  const minimumReleaseExpirationInput = useMemo(() => formatDateTimeLocalInput(getMinimumReleaseExpirationDate()), []);
  const missingTitleCreateMediaTypes = useMemo(() => titleSingleMediaTypeKeys.filter((mediaTypeKey) => !titleCreateMediaList.includes(mediaTypeKey)), [titleCreateMediaList]);
  const missingMetadataMediaTypes = useMemo(() => titleSingleMediaTypeKeys.filter((mediaTypeKey) => !metadataMediaList.includes(mediaTypeKey)), [metadataMediaList]);

  useEffect(() => {
    if (missingTitleCreateMediaTypes.length === 0) {
      return;
    }
    if (!missingTitleCreateMediaTypes.includes(titleCreateNextMediaType)) {
      setTitleCreateNextMediaType(missingTitleCreateMediaTypes[0]);
    }
  }, [missingTitleCreateMediaTypes, titleCreateNextMediaType]);

  useEffect(() => {
    if (missingMetadataMediaTypes.length === 0) {
      return;
    }
    if (!missingMetadataMediaTypes.includes(metadataNextMediaType)) {
      setMetadataNextMediaType(missingMetadataMediaTypes[0]);
    }
  }, [metadataNextMediaType, missingMetadataMediaTypes]);

  useEffect(() => {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set("domain", workspace.domain);
    nextSearchParams.set("workflow", workspace.workflow);
    if (workspace.studioId) {
      nextSearchParams.set("studioId", workspace.studioId);
    }
    if (workspace.titleId) {
      nextSearchParams.set("titleId", workspace.titleId);
    }
    if (workspace.releaseId) {
      nextSearchParams.set("releaseId", workspace.releaseId);
    }
    setSearchParams(nextSearchParams, { replace: true });

    savePersistedState({
      workspace,
      studioCreateDraft: toPersistedStudioDraft(studioCreateDraft),
      studioCreateTouched,
      studioOverview:
        activeStudio && studioOverviewContextId === activeStudio.id && studioOverviewEditing
          ? { studioId: activeStudio.id, draft: toPersistedStudioDraft(studioOverviewDraft), touched: studioOverviewTouched, editing: studioOverviewEditing }
          : undefined,
      titleCreate: workspace.studioId && titleCreateContextStudioId === workspace.studioId ? { studioId: workspace.studioId, draft: toPersistedTitleDraft(titleCreateDraft), touched: titleCreateTouched } : undefined,
      titleMetadata:
        activeTitle && metadataContextId === activeTitle.id && metadataEditing
          ? { titleId: activeTitle.id, draft: toPersistedTitleDraft(metadataDraft), touched: metadataTouched, editing: metadataEditing }
          : undefined,
      releaseCreate: workspace.titleId && releaseCreateContextTitleId === workspace.titleId ? { titleId: workspace.titleId, draft: releaseCreateDraft, touched: releaseCreateTouched } : undefined,
      releaseOverview: activeRelease && releaseContextId === activeRelease.id ? { releaseId: activeRelease.id, draft: releaseDraft, touched: releaseTouched, editing: releaseEditing } : undefined,
      selectedReportId,
      reportReply,
    });
  }, [
    activeRelease,
    activeStudio,
    activeTitle,
    metadataContextId,
    metadataDraft,
    metadataEditing,
    metadataTouched,
    releaseContextId,
    releaseCreateContextTitleId,
    releaseCreateDraft,
    releaseCreateTouched,
    releaseDraft,
    releaseEditing,
    releaseTouched,
    reportReply,
    selectedReportId,
    setSearchParams,
    studioCreateDraft,
    studioCreateTouched,
    studioOverviewContextId,
    studioOverviewDraft,
    studioOverviewEditing,
    studioOverviewTouched,
    titleCreateContextStudioId,
    titleCreateDraft,
    titleCreateTouched,
    workspace,
  ]);

  useEffect(() => {
    setTitleActionsError(null);
  }, [workspace.workflow, workspace.titleId]);

  useEffect(() => {
    setTitleOverviewError(null);
  }, [workspace.workflow, workspace.titleId]);

  useEffect(() => {
    setReleaseCreateError(null);
  }, [workspace.workflow, workspace.titleId]);

  useEffect(() => {
    setReleaseOverviewError(null);
  }, [workspace.workflow, workspace.releaseId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([listGenres(appConfig.apiBaseUrl), listAgeRatingAuthorities(appConfig.apiBaseUrl)]).then(([genreResult, ageRatingAuthorityResult]) => {
      if (cancelled) {
        return;
      }

      setGenreCatalog(genreResult.status === "fulfilled" ? genreResult.value.genres : [...maintainedGenres]);
      setAgeRatingAuthorityCatalog(
        ageRatingAuthorityResult.status === "fulfilled" ? ageRatingAuthorityResult.value.ageRatingAuthorities : [...maintainedAgeRatingAuthorities],
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accessToken || !developerAccessEnabled) {
      setCatalogMediaTypeCatalog(fallbackCatalogMediaTypes);
      return;
    }

    let cancelled = false;

    void listCatalogMediaTypes(appConfig.apiBaseUrl, accessToken)
      .then((response) => {
        if (!cancelled) {
          setCatalogMediaTypeCatalog(response.mediaTypes.length > 0 ? response.mediaTypes : fallbackCatalogMediaTypes);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogMediaTypeCatalog(fallbackCatalogMediaTypes);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, developerAccessEnabled]);

  useEffect(() => {
    if (genreOptions.length === 0) {
      return;
    }

    setTitleCreateDraft((current) => {
      const genres = normalizeGenreDraftValues(current.genres, genreOptions);
      return JSON.stringify(genres) === JSON.stringify(current.genres) ? current : { ...current, genres };
    });
    setMetadataDraft((current) => {
      const genres = normalizeGenreDraftValues(current.genres, genreOptions);
      return JSON.stringify(genres) === JSON.stringify(current.genres) ? current : { ...current, genres };
    });
  }, [genreOptions]);

  useEffect(() => {
    if (ageRatingAuthorityOptions.length === 0) {
      return;
    }

    setTitleCreateDraft((current) => {
      const normalizedAuthority = normalizeSelectableValues([current.ageRatingAuthority], ageRatingAuthorityOptions, { canonicalizeUnknown: normalizeAuthorityCode })[0] ?? "";
      return normalizedAuthority === current.ageRatingAuthority ? current : { ...current, ageRatingAuthority: normalizedAuthority };
    });
    setMetadataDraft((current) => {
      const normalizedAuthority = normalizeSelectableValues([current.ageRatingAuthority], ageRatingAuthorityOptions, { canonicalizeUnknown: normalizeAuthorityCode })[0] ?? "";
      return normalizedAuthority === current.ageRatingAuthority ? current : { ...current, ageRatingAuthority: normalizedAuthority };
    });
  }, [ageRatingAuthorityOptions]);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const enrollment = await getDeveloperEnrollment(appConfig.apiBaseUrl, accessToken);
        if (cancelled) {
          return;
        }

        setDeveloperAccessEnabled(enrollment.developerEnrollment.developerAccessEnabled);
        if (!enrollment.developerEnrollment.developerAccessEnabled) {
          setLoading(false);
          return;
        }

        const studioResponse = await listManagedStudios(appConfig.apiBaseUrl, accessToken);
        if (cancelled) {
          return;
        }

        setStudios(studioResponse.studios);
        setWorkspace((current) => {
          const nextStudioId = studioResponse.studios.find((studio) => studio.id === current.studioId)?.id ?? studioResponse.studios[0]?.id ?? "";
          return {
            ...current,
            studioId: nextStudioId,
            titleId: nextStudioId ? current.titleId : "",
            releaseId: nextStudioId ? current.releaseId : "",
          };
        });
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
  }, [accessToken]);

  useEffect(() => {
    if (!workspace.studioId || !developerAccessEnabled) {
      setLinks([]);
      setLinksStudioId(null);
      setTitles([]);
      setDeveloperTitle(null);
      return;
    }

    let cancelled = false;
    const requestedStudioId = workspace.studioId;

    async function loadStudioScope(): Promise<void> {
      setWorkspaceLoading(true);
      setLinks([]);
      setLinksStudioId(null);
      try {
        const [linkResponse, titleResponse] = await Promise.all([
          listStudioLinks(appConfig.apiBaseUrl, accessToken, requestedStudioId),
          listStudioTitles(appConfig.apiBaseUrl, accessToken, requestedStudioId),
        ]);
        if (cancelled) {
          return;
        }

        setLinks(linkResponse.links);
        setLinksStudioId(requestedStudioId);
        setTitles(titleResponse.titles);
        setWorkspace((current) => ({
          ...current,
          titleId: titleResponse.titles.find((title) => title.id === current.titleId)?.id ?? (current.workflow === "titles-create" ? "" : titleResponse.titles[0]?.id ?? ""),
          releaseId: current.titleId ? current.releaseId : "",
        }));
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    }

    void loadStudioScope();
    return () => {
      cancelled = true;
    };
  }, [accessToken, developerAccessEnabled, workspace.studioId, workspace.workflow]);

  useEffect(() => {
    if (!workspace.titleId || !developerAccessEnabled) {
      setDeveloperTitle(null);
      setMetadataVersions([]);
      setShowcaseMediaDrafts([]);
      setReports([]);
      setReleases([]);
      setSelectedReport(null);
      setWorkspace((current) => ({ ...current, releaseId: current.workflow === "releases-create" ? current.releaseId : "" }));
      return;
    }

    let cancelled = false;

    async function loadTitleScope(): Promise<void> {
      setWorkspaceLoading(true);
      try {
        const [titleResponse, metadataResponse, showcaseResponse, reportResponse, releaseResponse] = await Promise.all([
          getDeveloperTitle(appConfig.apiBaseUrl, accessToken, workspace.titleId),
          getTitleMetadataVersions(appConfig.apiBaseUrl, accessToken, workspace.titleId),
          getTitleShowcaseMedia(appConfig.apiBaseUrl, accessToken, workspace.titleId),
          getDeveloperTitleReports(appConfig.apiBaseUrl, accessToken, workspace.titleId),
          getTitleReleases(appConfig.apiBaseUrl, accessToken, workspace.titleId),
        ]);
        if (cancelled) {
          return;
        }

        const orderedReleases = [...releaseResponse.releases].sort((left, right) => (right.publishedAt ?? right.createdAt).localeCompare(left.publishedAt ?? left.createdAt));
        setDeveloperTitle(titleResponse.title);
        setMetadataVersions(metadataResponse.metadataVersions);
        setShowcaseMediaDrafts(showcaseResponse.showcaseMedia.map((item) => createTitleShowcaseMediaDraft(item)));
        setReports(reportResponse.reports);
        setReleases(orderedReleases);
        setSelectedReportId((current) => reportResponse.reports.find((report) => report.id === current)?.id ?? reportResponse.reports[0]?.id ?? null);
        setWorkspace((current) => ({
          ...current,
          releaseId: orderedReleases.find((release) => release.id === current.releaseId)?.id ?? (current.workflow === "releases-create" ? "" : orderedReleases[0]?.id ?? ""),
        }));
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    }

    void loadTitleScope();
    return () => {
      cancelled = true;
    };
  }, [accessToken, developerAccessEnabled, workspace.titleId, workspace.workflow]);

  useEffect(() => {
    if (!workspace.titleId || !selectedReportId) {
      setSelectedReport(null);
      return;
    }

    let cancelled = false;
    void getDeveloperTitleReport(appConfig.apiBaseUrl, accessToken, workspace.titleId, selectedReportId)
      .then((response) => {
        if (!cancelled) {
          setSelectedReport(response.report);
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedReportId, workspace.titleId]);

  useEffect(() => {
    if (!activeStudio) {
      setStudioOverviewDraft(createStudioDraft());
      setStudioOverviewContextId(null);
      setStudioOverviewEditing(false);
      setStudioOverviewTouched({});
      setStudioOverviewMediaErrors(createEmptyStudioMediaErrors());
      return;
    }

    const persistedDraft = persistedState?.studioOverview?.studioId === activeStudio.id && persistedState.studioOverview.editing ? persistedState.studioOverview : null;
    const nextDraft = createStudioDraft(activeStudio, linksStudioId === activeStudio.id ? links : []);

    if (studioOverviewContextId === activeStudio.id) {
      if (!studioOverviewEditing && !persistedDraft) {
        setStudioOverviewDraft((current) => (studioDraftsMatch(current, nextDraft) ? current : nextDraft));
      }
      return;
    }

    setStudioOverviewDraft(persistedDraft ? fromPersistedStudioDraft(persistedDraft.draft) : nextDraft);
    setStudioOverviewTouched(persistedDraft?.touched ?? {});
    setStudioOverviewEditing(persistedDraft?.editing ?? false);
    setStudioOverviewMediaErrors(createEmptyStudioMediaErrors());
    setStudioOverviewContextId(activeStudio.id);
  }, [activeStudio, links, linksStudioId, persistedState, studioOverviewContextId, studioOverviewEditing]);

  useEffect(() => {
    if (!activeTitle) {
      const nextDraft = createTitleDraft();
      setMetadataDraft(nextDraft);
      setMetadataMediaList(deriveActiveTitleMediaTypeKeys(nextDraft));
      setMetadataTouched({});
      setMetadataEditing(false);
      setMetadataContextId(null);
      setMetadataMediaErrors(createEmptyTitleMediaErrors());
      return;
    }

    if (metadataContextId !== activeTitle.id) {
      const persistedMetadata =
        persistedState?.titleMetadata?.titleId === activeTitle.id && persistedState.titleMetadata.editing ? persistedState.titleMetadata : null;
      const nextDraft = persistedMetadata ? fromPersistedTitleDraft(persistedMetadata.draft) : createTitleDraft(activeTitle);
      setMetadataDraft(nextDraft);
      setMetadataMediaList(deriveActiveTitleMediaTypeKeys(nextDraft));
      setMetadataTouched(persistedMetadata?.touched ?? {});
      setMetadataEditing(persistedMetadata?.editing ?? false);
      setMetadataMediaErrors(createEmptyTitleMediaErrors());
      setMetadataContextId(activeTitle.id);
    }
  }, [activeTitle, metadataContextId, persistedState]);

  useEffect(() => {
    if (!activeRelease) {
      setReleaseDraft(createReleaseDraft(undefined));
      setReleaseTouched({});
      setReleaseEditing(false);
      setReleaseContextId(null);
      return;
    }

    if (releaseContextId !== activeRelease.id) {
      const persistedRelease = persistedState?.releaseOverview?.releaseId === activeRelease.id ? persistedState.releaseOverview : null;
      setReleaseDraft(persistedRelease ? fromPersistedReleaseDraft(persistedRelease.draft) : createReleaseDraft(activeRelease));
      setReleaseTouched(persistedRelease?.touched ?? {});
      setReleaseEditing(persistedRelease?.editing ?? false);
      setReleaseContextId(activeRelease.id);
    }
  }, [activeRelease, persistedState, releaseContextId]);

  function setWorkspaceState(next: Partial<WorkspaceState>): void {
    setWorkspace((current) => {
      const updated = { ...current, ...next };
      if (!isWorkflowAllowedForDomain(updated.domain, updated.workflow)) {
        updated.workflow = workflowForDomain(updated.domain);
      }
      return updated;
    });
  }

  function touchField(setter: Dispatch<SetStateAction<Record<string, boolean>>>, field: string): void {
    setter((current) => ({ ...current, [field]: true }));
  }

  function updateStudioLinkDraft(target: "create" | "overview", index: number, field: "label" | "url", value: string): void {
    const updater = (current: StudioDraft): StudioDraft => ({
      ...current,
      links: current.links.map((link, candidateIndex) => (candidateIndex === index ? { ...link, [field]: value } : link)),
    });
    if (target === "create") {
      setStudioCreateDraft(updater);
      return;
    }

    setStudioOverviewDraft(updater);
  }

  function updateStudioMedia(target: "create" | "overview", mediaRole: "avatar" | "logo" | "banner", patch: Partial<StudioMediaDraft>): void {
    const updater = (current: StudioDraft): StudioDraft => ({
      ...current,
      [mediaRole]: {
        ...current[mediaRole],
        ...patch,
      },
    });
    if (target === "create") {
      setStudioCreateDraft(updater);
      return;
    }

    setStudioOverviewDraft(updater);
  }

  function setStudioMediaError(target: "create" | "overview", mediaRole: "avatar" | "logo" | "banner", value: string | null): void {
    const updater = (current: StudioMediaErrors): StudioMediaErrors => ({
      ...current,
      [mediaRole]: value,
    });
    if (target === "create") {
      setStudioCreateMediaErrors(updater);
      return;
    }

    setStudioOverviewMediaErrors(updater);
  }

  async function handleStudioMediaUpload(target: "create" | "overview", mediaRole: "avatar" | "logo" | "banner", file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    try {
      const upload = await normalizeImageUpload(file, studioMediaUploadPolicies[mediaRole], {
        label: mediaRole === "avatar" ? "avatar" : `studio ${mediaRole} image`,
        readErrorMessage: "Studio media upload could not be read.",
      });
      updateStudioMedia(target, mediaRole, {
        url: "",
        previewUrl: upload.dataUrl,
        fileName: upload.fileName,
        file: upload.file,
      });
      setStudioMediaError(target, mediaRole, null);
      setError(null);
    } catch (nextError) {
      setStudioMediaError(target, mediaRole, nextError instanceof Error ? nextError.message : String(nextError));
      setError(null);
    }
  }

  function setTitleMediaError(target: "create" | "metadata", mediaRole: TitleMediaDraftKey, value: string | null): void {
    const updater = (current: TitleMediaErrors): TitleMediaErrors => ({
      ...current,
      [mediaRole]: value,
    });
    if (target === "create") {
      setTitleCreateMediaErrors(updater);
      return;
    }

    setMetadataMediaErrors(updater);
  }

  async function handleTitleMediaUpload(target: "create" | "metadata", mediaRole: TitleMediaDraftKey, file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    try {
      const upload = await normalizeImageUpload(file, titleMediaUploadPolicies[mediaRole], {
        label: `${mediaRole} image`,
        readErrorMessage: "Title media upload could not be read.",
      });
      updateTitleMedia(target, mediaRole, { file: upload.file, fileName: upload.fileName, previewUrl: upload.dataUrl, url: "" });
      setTitleMediaError(target, mediaRole, null);
      setError(null);
    } catch (nextError) {
      setTitleMediaError(target, mediaRole, nextError instanceof Error ? nextError.message : String(nextError));
      setError(null);
    }
  }

  function addStudioLinkRow(target: "create" | "overview"): void {
    const updater = (current: StudioDraft): StudioDraft => ({
      ...current,
      links: [...current.links, { label: "", url: "" }],
    });
    if (target === "create") {
      setStudioCreateDraft(updater);
      return;
    }

    setStudioOverviewDraft(updater);
  }

  function removeStudioLinkRow(target: "create" | "overview", index: number): void {
    const updater = (current: StudioDraft): StudioDraft => ({
      ...current,
      links: current.links.filter((_, candidateIndex) => candidateIndex !== index),
    });
    if (target === "create") {
      setStudioCreateDraft(updater);
      return;
    }

    setStudioOverviewDraft(updater);
  }

  function addGenre(target: "create" | "metadata", genre: string): void {
    const normalized = normalizeGenreDraftValues([genre], genreOptions)[0] ?? "";
    if (!normalized) {
      return;
    }

    const apply = (current: TitleDraft): TitleDraft => ({
      ...current,
      genreInput: "",
      genres: current.genres.some((candidate) => normalizeGenreSlug(candidate) === normalizeGenreSlug(normalized)) ? current.genres : [...current.genres, normalized],
    });

    if (target === "create") {
      setTitleCreateDraft(apply);
      return;
    }

    setMetadataDraft(apply);
  }

  function removeGenre(target: "create" | "metadata", genre: string): void {
    const normalized = normalizeGenreDraftValues([genre], genreOptions)[0] ?? genre.trim();
    const apply = (current: TitleDraft): TitleDraft => ({
      ...current,
      genres: current.genres.filter((candidate) => normalizeGenreSlug(candidate) !== normalizeGenreSlug(normalized)),
    });

    if (target === "create") {
      setTitleCreateDraft(apply);
      return;
    }

    setMetadataDraft(apply);
  }

  function updateTitlePlayers(target: "create" | "metadata", field: "minPlayers" | "maxPlayers", value: string): void {
    const numeric = Number(value);
    const apply = (current: TitleDraft): TitleDraft => {
      const nextMin = field === "minPlayers" ? numeric : current.minPlayers;
      const nextMax = field === "maxPlayers" ? numeric : current.maxPlayers;
      const clamped = clampPlayerRange(nextMin, nextMax);
      return { ...current, ...clamped };
    };

    if (target === "create") {
      setTitleCreateDraft(apply);
      return;
    }

    setMetadataDraft(apply);
  }

  function updateTitleMinimumAge(target: "create" | "metadata", value: string): void {
    const parsed = Number(value.replace("+", ""));
    const nextAge = clampMinimumAge(parsed);
    if (target === "create") {
      setTitleCreateDraft((current) => ({ ...current, minAgeYears: nextAge }));
      return;
    }

    setMetadataDraft((current) => ({ ...current, minAgeYears: nextAge }));
  }

  function updateTitleMedia(target: "create" | "metadata", mediaRole: TitleMediaDraftKey, patch: Partial<TitleMediaDraft>): void {
    const apply = (current: TitleDraft): TitleDraft => ({
      ...current,
      media: {
        ...current.media,
        [mediaRole]: {
          ...current.media[mediaRole],
          ...patch,
        },
      },
    });

    if (target === "create") {
      setTitleCreateDraft(apply);
      return;
    }

    setMetadataDraft(apply);
  }

  function updateMaxPlayersOrMore(target: "create" | "metadata", checked: boolean): void {
    const apply = (current: TitleDraft): TitleDraft => ({ ...current, maxPlayersOrMore: checked });

    if (target === "create") {
      setTitleCreateDraft(apply);
      return;
    }

    setMetadataDraft(apply);
  }

  function updateTitleMediaList(target: "create" | "metadata", updater: (current: TitleSingleMediaTypeKey[]) => TitleSingleMediaTypeKey[]): void {
    if (target === "create") {
      setTitleCreateMediaList(updater);
      return;
    }

    setMetadataMediaList(updater);
  }

  function addTitleMediaListItem(target: "create" | "metadata", mediaTypeKey: TitleSingleMediaTypeKey): void {
    updateTitleMediaList(target, (current) => (current.includes(mediaTypeKey) ? current : [...current, mediaTypeKey]));
  }

  function removeTitleMediaListItem(target: "create" | "metadata", mediaTypeKey: TitleSingleMediaTypeKey): void {
    const draftKey = titleMediaDraftKeyByTypeKey[mediaTypeKey];
    updateTitleMedia(target, draftKey, { url: "", previewUrl: "", altText: "", file: null, fileName: null });
    setTitleMediaError(target, draftKey, null);
    updateTitleMediaList(target, (current) => current.filter((candidate) => candidate !== mediaTypeKey));
  }

  function changeTitleMediaListItemType(target: "create" | "metadata", previousTypeKey: TitleSingleMediaTypeKey, nextTypeKey: TitleSingleMediaTypeKey): void {
    if (previousTypeKey === nextTypeKey) {
      return;
    }

    const previousDraftKey = titleMediaDraftKeyByTypeKey[previousTypeKey];
    const nextDraftKey = titleMediaDraftKeyByTypeKey[nextTypeKey];
    const sourceDraft = (target === "create" ? titleCreateDraft : metadataDraft).media[previousDraftKey];
    const sourceError = (target === "create" ? titleCreateMediaErrors : metadataMediaErrors)[previousDraftKey];

    updateTitleMedia(target, nextDraftKey, {
      url: sourceDraft.url,
      previewUrl: sourceDraft.previewUrl,
      altText: sourceDraft.altText,
      file: sourceDraft.file,
      fileName: sourceDraft.fileName,
    });
    updateTitleMedia(target, previousDraftKey, { url: "", previewUrl: "", altText: "", file: null, fileName: null });
    setTitleMediaError(target, previousDraftKey, null);
    setTitleMediaError(target, nextDraftKey, sourceError ?? null);
    updateTitleMediaList(target, (current) => current.map((candidate) => (candidate === previousTypeKey ? nextTypeKey : candidate)));
  }

  function updateShowcaseMediaDraft(index: number, patch: Partial<TitleShowcaseMediaDraft>): void {
    setShowcaseMediaDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addShowcaseMediaDraft(kind: TitleShowcaseMediaDraft["kind"]): void {
    setShowcaseMediaDrafts((current) => [...current, { ...createTitleShowcaseMediaDraft(null), kind }]);
  }

  function removeShowcaseMediaDraft(index: number): void {
    setShowcaseMediaDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveShowcaseMediaDraft(index: number, direction: "up" | "down"): void {
    setShowcaseMediaDrafts((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  async function handleShowcaseMediaUpload(index: number, file: File | null): Promise<void> {
    if (!file) {
      updateShowcaseMediaDraft(index, { file: null, fileName: null, previewUrl: "" });
      return;
    }

    try {
      const upload = await normalizeImageUpload(file, titleMediaUploadPolicies.showcase, {
        label: "showcase image",
        readErrorMessage: "Showcase media upload could not be read.",
      });
      updateShowcaseMediaDraft(index, {
        file: upload.file,
        fileName: upload.fileName,
        previewUrl: upload.dataUrl,
      });
      setShowcaseMediaError(null);
    } catch (nextError) {
      setShowcaseMediaError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  async function refreshStudios(preferredStudioId?: string): Promise<DeveloperStudioSummary[]> {
    const response = await listManagedStudios(appConfig.apiBaseUrl, accessToken);
    setStudios(response.studios);
    const resolvedStudioId = response.studios.find((studio) => studio.id === preferredStudioId)?.id ?? response.studios.find((studio) => studio.id === workspace.studioId)?.id ?? response.studios[0]?.id ?? "";
    setWorkspaceState({ studioId: resolvedStudioId, titleId: resolvedStudioId ? workspace.titleId : "", releaseId: resolvedStudioId ? workspace.releaseId : "" });
    return response.studios;
  }

  async function refreshStudioScope(preferredTitleId?: string): Promise<StudioLink[]> {
    if (!workspace.studioId) {
      return [];
    }

    const requestedStudioId = workspace.studioId;
    const [linkResponse, titleResponse] = await Promise.all([
      listStudioLinks(appConfig.apiBaseUrl, accessToken, requestedStudioId),
      listStudioTitles(appConfig.apiBaseUrl, accessToken, requestedStudioId),
    ]);
    setLinks(linkResponse.links);
    setLinksStudioId(requestedStudioId);
    setTitles(titleResponse.titles);
    const resolvedTitleId = titleResponse.titles.find((title) => title.id === preferredTitleId)?.id ?? titleResponse.titles.find((title) => title.id === workspace.titleId)?.id ?? titleResponse.titles[0]?.id ?? "";
    setWorkspaceState({ titleId: resolvedTitleId, releaseId: resolvedTitleId ? workspace.releaseId : "" });
    return linkResponse.links;
  }

  async function refreshTitleWorkspace(preferredTitleId?: string, preferredReleaseId?: string): Promise<DeveloperTitle | null> {
    const titleId = preferredTitleId ?? workspace.titleId;
    if (!titleId) {
      return null;
    }

    const [titleResponse, metadataResponse, showcaseResponse, reportResponse, releaseResponse] = await Promise.all([
      getDeveloperTitle(appConfig.apiBaseUrl, accessToken, titleId),
      getTitleMetadataVersions(appConfig.apiBaseUrl, accessToken, titleId),
      getTitleShowcaseMedia(appConfig.apiBaseUrl, accessToken, titleId),
      getDeveloperTitleReports(appConfig.apiBaseUrl, accessToken, titleId),
      getTitleReleases(appConfig.apiBaseUrl, accessToken, titleId),
    ]);
    const orderedReleases = [...releaseResponse.releases].sort((left, right) => (right.publishedAt ?? right.createdAt).localeCompare(left.publishedAt ?? left.createdAt));
    setDeveloperTitle(titleResponse.title);
    setMetadataVersions(metadataResponse.metadataVersions);
    setShowcaseMediaDrafts(showcaseResponse.showcaseMedia.map((item) => createTitleShowcaseMediaDraft(item)));
    setReports(reportResponse.reports);
    setReleases(orderedReleases);
    setSelectedReportId((current) => reportResponse.reports.find((report) => report.id === current)?.id ?? reportResponse.reports[0]?.id ?? null);
    setWorkspaceState({
      titleId,
      releaseId: orderedReleases.find((release) => release.id === preferredReleaseId)?.id ?? orderedReleases.find((release) => release.id === workspace.releaseId)?.id ?? orderedReleases[0]?.id ?? "",
    });
    return titleResponse.title;
  }

  async function applyTitleMedia(titleId: string, draft: TitleDraft): Promise<void> {
    const existingTitle = developerTitle?.id === titleId ? developerTitle : null;
    const existingEntries = new Map(
      (existingTitle?.catalogMediaEntries ?? [])
        .filter((entry): entry is CatalogMediaEntry => titleSingleMediaTypeKeys.includes(entry.mediaTypeKey as TitleSingleMediaTypeKey))
        .map((entry) => [entry.mediaTypeKey, entry]),
    );

    for (const mediaRole of Object.keys(titleMediaTypeKeyByDraftKey) as TitleMediaDraftKey[]) {
      const media = draft.media[mediaRole];
      const mediaTypeKey = titleMediaTypeKeyByDraftKey[mediaRole];
      const existingEntry = existingEntries.get(mediaTypeKey) ?? null;

      if (media.file) {
        const ensuredEntry =
          existingEntry ??
          (
            await createTitleCatalogMedia(appConfig.apiBaseUrl, accessToken, titleId, {
              mediaTypeKey,
              kind: "image",
              sourceUrl: buildPendingCatalogMediaUrl(mediaTypeKey),
              altText: media.altText.trim() || null,
              mimeType: media.file.type,
              width: null,
              height: null,
              displayOrder: 0,
            })
          ).mediaEntry;

        await uploadTitleCatalogMediaImage(appConfig.apiBaseUrl, accessToken, titleId, ensuredEntry.id, media.file, media.altText.trim() || null);
        continue;
      }

      if (media.url.trim()) {
        if (existingEntry) {
          await updateTitleCatalogMedia(appConfig.apiBaseUrl, accessToken, titleId, existingEntry.id, {
            sourceUrl: media.url.trim(),
            altText: media.altText.trim() || null,
            mimeType: null,
            width: null,
            height: null,
            displayOrder: 0,
          });
        } else {
          await createTitleCatalogMedia(appConfig.apiBaseUrl, accessToken, titleId, {
            mediaTypeKey,
            kind: "image",
            sourceUrl: media.url.trim(),
            altText: media.altText.trim() || null,
            mimeType: null,
            width: null,
            height: null,
            displayOrder: 0,
          });
        }
        continue;
      }

      if (existingEntry) {
        await deleteTitleCatalogMedia(appConfig.apiBaseUrl, accessToken, titleId, existingEntry.id);
      }
    }
  }

  async function applyStudioMedia(studioId: string, draft: StudioDraft): Promise<void> {
    const existingEntries = new Map(
      (activeStudio?.catalogMediaEntries ?? [])
        .filter((entry): entry is CatalogMediaEntry => entry.kind === "image")
        .map((entry) => [entry.mediaTypeKey, entry]),
    );
    const legacyFallbackUrlByMediaTypeKey: Record<CatalogMediaTypeKey, string | null> = {
      studio_avatar: activeStudio?.avatarUrl ?? null,
      studio_logo: activeStudio?.logoUrl ?? null,
      studio_banner: activeStudio?.bannerUrl ?? null,
      title_avatar: null,
      title_card: null,
      title_logo: null,
      title_quick_view_banner: null,
      title_showcase: null,
    };

    for (const mediaRole of Object.keys(studioMediaTypeKeyByDraftKey) as StudioMediaDraftKey[]) {
      const media = draft[mediaRole];
      const mediaTypeKey = studioMediaTypeKeyByDraftKey[mediaRole];
      const existingEntry = existingEntries.get(mediaTypeKey) ?? null;
      const legacyFallbackUrl = legacyFallbackUrlByMediaTypeKey[mediaTypeKey];

      if (media.file) {
        const ensuredEntry =
          existingEntry ??
          (
            await createStudioCatalogMedia(appConfig.apiBaseUrl, accessToken, studioId, {
              mediaTypeKey,
              kind: "image",
              sourceUrl: buildPendingCatalogMediaUrl(mediaTypeKey),
              altText: null,
              mimeType: media.file.type,
              width: null,
              height: null,
              displayOrder: 0,
            })
          ).mediaEntry;

        await uploadStudioCatalogMediaImage(appConfig.apiBaseUrl, accessToken, studioId, ensuredEntry.id, media.file);
        continue;
      }

      if (media.url.trim()) {
        if (existingEntry) {
          await updateStudioCatalogMedia(appConfig.apiBaseUrl, accessToken, studioId, existingEntry.id, {
            sourceUrl: media.url.trim(),
            altText: null,
            mimeType: null,
            width: null,
            height: null,
            displayOrder: 0,
          });
        } else {
          await createStudioCatalogMedia(appConfig.apiBaseUrl, accessToken, studioId, {
            mediaTypeKey,
            kind: "image",
            sourceUrl: media.url.trim(),
            altText: null,
            mimeType: null,
            width: null,
            height: null,
            displayOrder: 0,
          });
        }
        continue;
      }

      if (existingEntry) {
        await deleteStudioCatalogMedia(appConfig.apiBaseUrl, accessToken, studioId, existingEntry.id);
        continue;
      }

      if (legacyFallbackUrl) {
        const mirroredEntry = await createStudioCatalogMedia(appConfig.apiBaseUrl, accessToken, studioId, {
          mediaTypeKey,
          kind: "image",
          sourceUrl: legacyFallbackUrl,
          altText: null,
          mimeType: null,
          width: null,
          height: null,
          displayOrder: 0,
        });
        await deleteStudioCatalogMedia(appConfig.apiBaseUrl, accessToken, studioId, mirroredEntry.mediaEntry.id);
      }
    }
  }

  function openDomain(domain: Domain): void {
    setWorkspaceState({ domain, workflow: workflowForDomain(domain) });
  }

  function openStudioCreate(): void {
    setStudioCreateDraft(createStudioDraft());
    setStudioCreateTouched({});
    setStudioCreateMediaErrors(createEmptyStudioMediaErrors());
    setWorkspaceState({ domain: "studios", workflow: "studios-create", titleId: "", releaseId: "" });
  }

  function openTitleCreate(): void {
    setTitleCreateContextStudioId(workspace.studioId);
    if (titleCreateContextStudioId !== workspace.studioId) {
      const persistedDraft = persistedState?.titleCreate?.studioId === workspace.studioId ? persistedState.titleCreate : null;
      const nextDraft = persistedDraft ? fromPersistedTitleDraft(persistedDraft.draft) : createTitleDraft();
      setTitleCreateDraft(nextDraft);
      setTitleCreateMediaList(deriveActiveTitleMediaTypeKeys(nextDraft));
      setTitleCreateTouched(persistedDraft?.touched ?? {});
    }
    setShowcaseMediaDrafts([]);
    setTitleCreateMediaErrors(createEmptyTitleMediaErrors());
    setWorkspaceState({ domain: "titles", workflow: "titles-create", titleId: "", releaseId: "" });
  }

  function openReleaseCreate(): void {
    setReleaseCreateContextTitleId(workspace.titleId);
    if (releaseCreateContextTitleId !== workspace.titleId) {
      const persistedDraft = persistedState?.releaseCreate?.titleId === workspace.titleId ? persistedState.releaseCreate : null;
      setReleaseCreateDraft(persistedDraft ? fromPersistedReleaseDraft(persistedDraft.draft) : createReleaseDraft(undefined));
      setReleaseCreateTouched(persistedDraft?.touched ?? {});
    }
    setReleaseCreateError(null);
    setWorkspaceState({ domain: "releases", workflow: "releases-create", releaseId: "" });
  }

  async function applyTitleShowcaseMedia(titleId: string): Promise<void> {
    const existingTitle = developerTitle?.id === titleId ? developerTitle : null;
    const existingById = new Map((existingTitle?.showcaseMedia ?? []).map((item) => [item.id, item]));
    const remainingIds = new Set(showcaseMediaDrafts.map((item) => item.id).filter((value): value is string => Boolean(value)));

    for (const existingItem of existingTitle?.showcaseMedia ?? []) {
      if (!remainingIds.has(existingItem.id)) {
        await deleteTitleShowcaseMedia(appConfig.apiBaseUrl, accessToken, titleId, existingItem.id);
      }
    }

    for (const [index, item] of showcaseMediaDrafts.entries()) {
      if (
        !item.id &&
        (
          (item.kind === "image" && !item.file && !item.imageUrl.trim())
          || (item.kind === "external_video" && !item.file)
        )
      ) {
        throw new Error(
          item.kind === "image"
            ? "Each new screenshot needs either an image URL or an uploaded preview image before you save."
            : "Each new video preview needs an uploaded preview image before you save."
        );
      }

      const payload = {
        imageUrl: item.kind === "image" && !item.file ? item.imageUrl.trim() || null : null,
        videoUrl: item.kind === "external_video" ? item.videoUrl.trim() || null : null,
        altText: item.altText.trim() || null,
        displayOrder: index,
      };

      if (item.id && existingById.has(item.id)) {
        await updateTitleShowcaseMedia(appConfig.apiBaseUrl, accessToken, titleId, item.id, payload);
        if (item.file) {
          await uploadTitleShowcaseMediaImage(appConfig.apiBaseUrl, accessToken, titleId, item.id, item.file);
        }
        continue;
      }

      const response = await createTitleShowcaseMedia(appConfig.apiBaseUrl, accessToken, titleId, {
        kind: item.kind,
        ...payload,
      });
      if (item.file) {
        await uploadTitleShowcaseMediaImage(appConfig.apiBaseUrl, accessToken, titleId, response.showcaseMedia.id, item.file);
      }
    }
  }

  async function handleBecomeDeveloper(): Promise<void> {
    setSaving(true);
    try {
      await enrollAsDeveloper(appConfig.apiBaseUrl, accessToken);
      const enrollment = await getDeveloperEnrollment(appConfig.apiBaseUrl, accessToken);
      setDeveloperAccessEnabled(enrollment.developerEnrollment.developerAccessEnabled);
      await refreshStudios();
      setMessage("Developer access enabled.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateStudio(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!studioCreateValidation.isValid) {
      setStudioCreateTouched({ displayName: true, description: true });
      return;
    }

    setSaving(true);
    try {
      const response = await createStudio(appConfig.apiBaseUrl, accessToken, {
        slug: studioCreateDraft.slug,
        displayName: studioCreateDraft.displayName.trim(),
        description: studioCreateDraft.description.trim(),
      });
      await applyStudioMedia(response.studio.id, studioCreateDraft);
      for (const link of studioCreateDraft.links.filter((candidate) => candidate.label.trim() && candidate.url.trim())) {
        await createStudioLink(appConfig.apiBaseUrl, accessToken, response.studio.id, { label: link.label.trim(), url: link.url.trim() });
      }
      await refreshStudios(response.studio.id);
      setStudioCreateDraft(createStudioDraft());
      setStudioCreateTouched({});
      setWorkspaceState({ domain: "studios", workflow: "studios-overview", studioId: response.studio.id });
      setMessage("Studio created.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStudio(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeStudio) {
      return;
    }

    if (!studioOverviewEditing) {
      setStudioOverviewEditing(true);
      return;
    }

    if (!studioOverviewValidation.isValid) {
      setStudioOverviewTouched({ displayName: true, description: true });
      return;
    }

    setSaving(true);
    try {
      await updateStudio(appConfig.apiBaseUrl, accessToken, activeStudio.id, {
        slug: studioOverviewDraft.slug,
        displayName: studioOverviewDraft.displayName.trim(),
        description: studioOverviewDraft.description.trim(),
      });
      await applyStudioMedia(activeStudio.id, studioOverviewDraft);
      for (const link of studioOverviewDraft.links.filter((candidate) => candidate.label.trim() && candidate.url.trim())) {
        if (link.id) {
          await updateStudioLink(appConfig.apiBaseUrl, accessToken, activeStudio.id, link.id, { label: link.label.trim(), url: link.url.trim() });
        } else {
          await createStudioLink(appConfig.apiBaseUrl, accessToken, activeStudio.id, { label: link.label.trim(), url: link.url.trim() });
        }
      }
      for (const link of links) {
        if (!studioOverviewDraft.links.some((candidate) => candidate.id === link.id)) {
          await deleteStudioLink(appConfig.apiBaseUrl, accessToken, activeStudio.id, link.id);
        }
      }
      const refreshedStudios = await refreshStudios(activeStudio.id);
      const refreshedLinks = await refreshStudioScope();
      const refreshedStudio = refreshedStudios.find((studio) => studio.id === activeStudio.id) ?? activeStudio;
      setStudioOverviewDraft(createStudioDraft(refreshedStudio, refreshedLinks));
      setStudioOverviewTouched({});
      setStudioOverviewMediaErrors(createEmptyStudioMediaErrors());
      setStudioOverviewEditing(false);
      setMessage("Studio saved.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteActiveStudio(): Promise<void> {
    if (!activeStudio) {
      return;
    }

    setSaving(true);
    try {
      await deleteStudio(appConfig.apiBaseUrl, accessToken, activeStudio.id);
      await refreshStudios();
      setMessage("Studio deleted.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTitle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeStudio) {
      return;
    }

    if (!titleCreateValidation.isValid) {
      setTitleCreateTouched({
        displayName: true,
        contentKind: true,
        genres: true,
        shortDescription: true,
        description: true,
        ageRatingAuthority: true,
        ageRatingValue: true,
      });
      return;
    }

    setSaving(true);
    try {
      const response = await createTitle(appConfig.apiBaseUrl, accessToken, activeStudio.id, {
        contentKind: titleCreateDraft.contentKind,
        metadata: {
          displayName: titleCreateDraft.displayName.trim(),
          shortDescription: titleCreateDraft.shortDescription.trim(),
          description: titleCreateDraft.description.trim(),
            genreSlugs: titleCreateDraft.genres,
            minPlayers: titleCreateDraft.minPlayers,
            maxPlayers: titleCreateDraft.maxPlayers,
            maxPlayersOrMore: titleCreateDraft.maxPlayersOrMore,
            ageRatingAuthority: titleCreateDraft.ageRatingAuthority.trim() || null,
          ageRatingValue: titleCreateDraft.ageRatingValue.trim() || null,
          minAgeYears: titleCreateDraft.minAgeYears,
        },
      });
      await applyTitleMedia(response.title.id, titleCreateDraft);
      await applyTitleShowcaseMedia(response.title.id);
      await refreshStudioScope(response.title.id);
      await refreshTitleWorkspace(response.title.id);
      const nextDraft = createTitleDraft();
      setTitleCreateDraft(nextDraft);
      setTitleCreateMediaList(deriveActiveTitleMediaTypeKeys(nextDraft));
      setTitleCreateTouched({});
      setShowcaseMediaDrafts([]);
      setWorkspaceState({ domain: "titles", workflow: "titles-overview", titleId: response.title.id });
      setMessage("Title created.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleTitleVisibility(): Promise<void> {
    if (!activeTitle || !titleVisibilityCanBeChanged(activeTitle)) {
      return;
    }

    const nextVisibility = activeTitle.visibility === "listed" ? "unlisted" : "listed";

    setSaving(true);
    try {
      setTitleOverviewError(null);
      setError(null);
      await updateTitle(appConfig.apiBaseUrl, accessToken, activeTitle.id, {
        contentKind: activeTitle.contentKind,
        visibility: nextVisibility,
      });
      await refreshStudioScope(activeTitle.id);
      await refreshTitleWorkspace(activeTitle.id, activeRelease?.id ?? "");
      setMessage(nextVisibility === "listed" ? "Title is now listed." : "Title is now unlisted.");
      setError(null);
    } catch (nextError) {
      setTitleOverviewError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMetadata(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeTitle) {
      return;
    }

    if (!metadataEditing) {
      setMetadataEditing(true);
      return;
    }

    if (!metadataValidation.isValid) {
      setMetadataTouched({
        displayName: true,
        contentKind: true,
        genres: true,
        shortDescription: true,
        description: true,
        ageRatingAuthority: true,
        ageRatingValue: true,
      });
      return;
    }

    setSaving(true);
    try {
      setShowcaseMediaError(null);
      await upsertTitleMetadata(appConfig.apiBaseUrl, accessToken, activeTitle.id, {
        displayName: metadataDraft.displayName.trim(),
        shortDescription: metadataDraft.shortDescription.trim(),
        description: metadataDraft.description.trim(),
          genreSlugs: metadataDraft.genres,
          minPlayers: metadataDraft.minPlayers,
          maxPlayers: metadataDraft.maxPlayers,
          maxPlayersOrMore: metadataDraft.maxPlayersOrMore,
          ageRatingAuthority: metadataDraft.ageRatingAuthority.trim() || null,
        ageRatingValue: metadataDraft.ageRatingValue.trim() || null,
        minAgeYears: metadataDraft.minAgeYears,
      });
      await applyTitleMedia(activeTitle.id, metadataDraft);
      await applyTitleShowcaseMedia(activeTitle.id);
      await refreshStudioScope(activeTitle.id);
      const refreshedTitle = await refreshTitleWorkspace(activeTitle.id);
      const nextDraft = createTitleDraft(refreshedTitle ?? activeTitle);
      setMetadataDraft(nextDraft);
      setMetadataMediaList(deriveActiveTitleMediaTypeKeys(nextDraft));
      setMetadataTouched({});
      setMetadataEditing(false);
      setMessage("Metadata saved.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateRevision(revisionNumber: number): Promise<void> {
    if (!workspace.titleId) {
      return;
    }

    setSaving(true);
    try {
      await activateTitleMetadataVersion(appConfig.apiBaseUrl, accessToken, workspace.titleId, revisionNumber);
      await refreshTitleWorkspace(workspace.titleId);
      setMessage(null);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRelease(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!workspace.titleId) {
      return;
    }

    if (!releaseCreateValidation.isValid) {
      setReleaseCreateTouched({ version: true, status: true, acquisitionUrl: true, expiresAt: true });
      return;
    }

    setSaving(true);
    setReleaseCreateError(null);
    try {
      const shouldPromptForActivation = activeTitle?.lifecycleStatus === "draft" && releases.length === 0;
      const response = await createTitleRelease(appConfig.apiBaseUrl, accessToken, workspace.titleId, {
        version: releaseCreateDraft.version.trim(),
        status: releaseCreateDraft.status,
        acquisitionUrl: releaseCreateDraft.acquisitionUrl.trim() || null,
        expiresAt: releaseCreateDraft.status === "testing" && releaseCreateDraft.expiresAt.trim() ? new Date(releaseCreateDraft.expiresAt).toISOString() : null,
      });
      await refreshTitleWorkspace(workspace.titleId, response.release.id);
      setWorkspaceState({ domain: "releases", workflow: "releases-overview", releaseId: response.release.id });
      setReleaseCreateDraft(createReleaseDraft(undefined));
      setReleaseCreateTouched({});
      if (shouldPromptForActivation) {
        setActivationPromptReleaseId(response.release.id);
      }
      setMessage("Release created.");
      setError(null);
    } catch (nextError) {
      setMessage(null);
      setError(null);
      setReleaseCreateError(formatWorkspaceActionError(nextError, { releaseVersion: releaseCreateDraft.version }));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRelease(): Promise<void> {
    if (!workspace.titleId || !activeRelease) {
      return;
    }

    if (!releaseEditing) {
      setReleaseEditing(true);
      setReleaseOverviewError(null);
      setMessage(null);
      setError(null);
      return;
    }

    if (!releaseValidation.isValid) {
      setReleaseTouched({ version: true, status: true, acquisitionUrl: true, expiresAt: true });
      return;
    }

    setSaving(true);
    setReleaseOverviewError(null);
    try {
      await updateTitleRelease(appConfig.apiBaseUrl, accessToken, workspace.titleId, activeRelease.id, {
        version: releaseDraft.version.trim(),
        status: releaseDraft.status,
        acquisitionUrl: releaseDraft.acquisitionUrl.trim() || null,
        expiresAt: releaseDraft.status === "testing" && releaseDraft.expiresAt.trim() ? new Date(releaseDraft.expiresAt).toISOString() : null,
      });
      await refreshTitleWorkspace(workspace.titleId, activeRelease.id);
      setReleaseEditing(false);
      setMessage("Release saved.");
      setError(null);
    } catch (nextError) {
      setMessage(null);
      setError(null);
      setReleaseOverviewError(formatWorkspaceActionError(nextError, { releaseVersion: releaseDraft.version }));
    } finally {
      setSaving(false);
    }
  }

  async function handleMakeReleaseCurrent(releaseId: string): Promise<void> {
    if (!workspace.titleId || !activeRelease) {
      return;
    }

    setSaving(true);
    try {
      await activateTitleRelease(appConfig.apiBaseUrl, accessToken, workspace.titleId, releaseId);
      await refreshTitleWorkspace(workspace.titleId, releaseId);
      setMessage("Current release updated.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateCurrentTitleAndRelease(): Promise<void> {
    if (!activeTitle || !activationPromptReleaseId) {
      return;
    }

    setSaving(true);
    try {
      await activateTitle(appConfig.apiBaseUrl, accessToken, activeTitle.id);
      await activateTitleRelease(appConfig.apiBaseUrl, accessToken, activeTitle.id, activationPromptReleaseId);
      await refreshTitleWorkspace(activeTitle.id, activationPromptReleaseId);
      setActivationPromptReleaseId(null);
      setMessage("Title activated and listed.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateTitleLifecycle(): Promise<void> {
    if (!activeTitle) {
      return;
    }

    setSaving(true);
    try {
      setTitleActionsError(null);
      setError(null);
      await activateTitle(appConfig.apiBaseUrl, accessToken, activeTitle.id);
      await refreshTitleWorkspace(activeTitle.id, activeRelease?.id ?? "");
      setMessage("Title is now active and listed.");
      setError(null);
    } catch (nextError) {
      setTitleActionsError(formatWorkspaceActionError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveActiveTitle(): Promise<void> {
    if (!activeTitle) {
      return;
    }

    setSaving(true);
    try {
      setTitleActionsError(null);
      setError(null);
      await archiveTitle(appConfig.apiBaseUrl, accessToken, activeTitle.id);
      await refreshTitleWorkspace(activeTitle.id, activeRelease?.id ?? "");
      setMessage("Title archived and unlisted.");
      setError(null);
    } catch (nextError) {
      setTitleActionsError(formatWorkspaceActionError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleUnarchiveActiveTitle(): Promise<void> {
    if (!activeTitle) {
      return;
    }

    setSaving(true);
    try {
      setTitleActionsError(null);
      setError(null);
      await unarchiveTitle(appConfig.apiBaseUrl, accessToken, activeTitle.id);
      await refreshTitleWorkspace(activeTitle.id, activeRelease?.id ?? "");
      setMessage("Title moved back to draft.");
      setError(null);
    } catch (nextError) {
      setTitleActionsError(formatWorkspaceActionError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteActiveTitle(): Promise<void> {
    if (!activeTitle) {
      return;
    }

    setSaving(true);
    try {
      await deleteTitle(appConfig.apiBaseUrl, accessToken, activeTitle.id, {
        currentPassword: deleteCurrentPassword,
        confirmationTitleName: deleteConfirmationName,
      });
      setDeletePasswordModalOpen(false);
      setDeleteConfirmationModalOpen(false);
      setDeleteCurrentPassword("");
      setDeleteConfirmationName("");
      setDeleteModalError(null);
      await refreshStudioScope();
      setWorkspaceState({ domain: "titles", workflow: "titles-overview", titleId: "", releaseId: "" });
      setMessage("Title deleted.");
      setError(null);
    } catch (nextError) {
      setDeleteModalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDeletePassword(): Promise<void> {
    if (!deleteCurrentPassword.trim()) {
      return;
    }

    setSaving(true);
    try {
      await verifyCurrentUserPasswordApi(appConfig.apiBaseUrl, accessToken, {
        currentPassword: deleteCurrentPassword,
      });

      setDeleteModalError(null);
      setDeletePasswordModalOpen(false);
      setDeleteConfirmationModalOpen(true);
    } catch (nextError) {
      setDeleteModalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleReportReply(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!workspace.titleId || !selectedReportId || !reportReply.trim()) {
      return;
    }

    setSaving(true);
    try {
      const response = await addDeveloperTitleReportMessage(appConfig.apiBaseUrl, accessToken, workspace.titleId, selectedReportId, { message: reportReply.trim() });
      setSelectedReport(response.report);
      setReportReply("");
      setMessage("Report reply sent.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  function renderStudioLinksSummary(draft: StudioDraft): ReactNode {
    const availableLinks = draft.links.filter((link) => link.label.trim() && link.url.trim());
    return (
      <section className="surface-panel-strong rounded-[1rem] p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Studio links</h3>
          <span className="text-xs text-slate-400">Optional</span>
        </div>
        {availableLinks.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No links added yet.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {availableLinks.map((link, index) => (
              <a key={`${link.id ?? "draft"}-${index}`} className="develop-readonly-link" href={link.url} target="_blank" rel="noreferrer">
                <span className="font-semibold text-white">{link.label}</span>
                <span className="text-sm text-slate-400">{link.url}</span>
              </a>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderStudioMediaSummary(draft: StudioDraft): ReactNode {
    const mediaItems = studioMediaDraftKeys.map((mediaRole) => {
      const media = draft[mediaRole];
      const definition = studioMediaDefinitionByDraftKey[mediaRole];
      const thumbnailUrl = getStudioMediaPreview(media);
      return {
        mediaRole,
        media,
        definition,
        thumbnailUrl,
      };
    });

    return (
      <section className="surface-panel-strong rounded-[1rem] p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Studio media</h3>
        </div>
        <div className="mt-4 space-y-3">
          {mediaItems.map(({ mediaRole, definition, thumbnailUrl }) => (
            <article key={mediaRole} className="rounded-[1rem] border border-white/10 bg-slate-950/35 p-3" data-studio-media-summary={mediaRole}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div
                  className="h-20 max-w-full shrink-0 self-start overflow-hidden rounded-[0.9rem] border border-white/12 bg-slate-950/55"
                  data-studio-media-summary-preview={mediaRole}
                  style={{ aspectRatio: buildAspectRatioValue(definition.recommendedWidth, definition.recommendedHeight) }}
                >
                  {thumbnailUrl ? (
                    <img className="h-full w-full object-cover" src={thumbnailUrl} alt={`${studioMediaLabelByDraftKey[mediaRole]} preview`} />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[11px] uppercase tracking-[0.18em] text-slate-500">No image</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">{definition.displayName}</p>
                  <p className="mt-2 text-sm text-slate-300">{definition.usageSummary}</p>
                  <p className="mt-2 break-all text-sm text-slate-300">
                    Source: <span className={thumbnailUrl ? "text-slate-100" : "text-slate-500"}>{thumbnailUrl ?? "Not added"}</span>
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderTitleGenresSummary(genres: string[]): ReactNode {
    return genres.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {genres.map((genre) => (
          <span key={genre} className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-50">
            {genreLabelBySlug.get(genre) ?? genre}
          </span>
        ))}
      </div>
    ) : (
      "No genres added yet."
    );
  }

  function renderTitleMediaSummary(draft: TitleDraft): ReactNode {
    const configuredMedia = (["avatar", "card", "quickViewBanner", "logo"] as const)
      .map((mediaRole) => {
        const media = draft.media[mediaRole];
        const definition = titleMediaDefinitionByDraftKey[mediaRole];
        const thumbnailUrl = previewMediaUrl(media);
        return hasConfiguredTitleMedia(media) || media.altText.trim()
          ? {
              mediaRole,
              media,
              definition,
              thumbnailUrl,
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return (
      <section className="surface-panel-strong rounded-[1rem] p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Title media</h3>
        </div>
        {configuredMedia.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No title media added yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {configuredMedia.map(({ mediaRole, media, definition, thumbnailUrl }) => (
              <article key={mediaRole} className="rounded-[1rem] border border-white/10 bg-slate-950/35 p-3" data-title-media-summary={definition.key}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div
                    className="h-20 max-w-full shrink-0 self-start overflow-hidden rounded-[0.9rem] border border-white/12 bg-slate-950/55"
                    data-title-media-summary-preview={definition.key}
                    style={{ aspectRatio: buildAspectRatioValue(definition.recommendedWidth, definition.recommendedHeight) }}
                  >
                    {thumbnailUrl ? (
                      <img className="h-full w-full object-cover" src={thumbnailUrl} alt={media.altText || `${definition.displayName} thumbnail`} />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[11px] uppercase tracking-[0.18em] text-slate-500">No image</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">{definition.displayName}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Alt text: <span className={media.altText.trim() ? "text-slate-100" : "text-slate-500"}>{media.altText.trim() || "Not added"}</span>
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderShowcaseMediaSummary(): ReactNode {
    const showcaseItems = (activeTitle?.showcaseMedia?.length ? activeTitle.showcaseMedia : showcaseMediaDrafts)
      .map((item, index) => ({
        id: "id" in item && item.id ? item.id : `showcase-summary-${index}`,
        kind: item.kind,
        imageUrl: item.imageUrl ?? "",
        videoUrl: item.videoUrl ?? "",
        altText: item.altText ?? "",
        displayOrder: "displayOrder" in item ? item.displayOrder : index,
      }))
      .sort((left, right) => left.displayOrder - right.displayOrder);

    return (
      <section className="surface-panel-strong rounded-[1rem] p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Showcase media</h3>
        </div>
        {showcaseItems.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No showcase media added yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {showcaseItems.map((item, index) => (
              <article key={item.id || `showcase-${index}`} className="rounded-[1rem] border border-white/10 bg-slate-950/35 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="h-20 w-full shrink-0 overflow-hidden rounded-[0.9rem] border border-white/12 bg-slate-950/55 sm:w-28">
                    {item.imageUrl ? (
                      <img className="h-full w-full object-cover" src={item.imageUrl} alt={item.altText || `Showcase media ${index + 1}`} />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[11px] uppercase tracking-[0.18em] text-slate-500">No preview</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">Gallery item {index + 1}</p>
                      <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                        {item.kind === "external_video" ? "Video preview" : "Screenshot"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      Alt text: <span className={item.altText.trim() ? "text-slate-100" : "text-slate-500"}>{item.altText.trim() || "Not added"}</span>
                    </p>
                    {item.kind === "external_video" ? (
                      <p className="mt-2 break-all text-sm text-slate-300">
                        Video URL: <span className={item.videoUrl.trim() ? "text-slate-100" : "text-slate-500"}>{item.videoUrl.trim() || "Not added"}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderMetadataSummary(draft: TitleDraft): ReactNode {
    const summarySlug = activeTitle?.slug ?? draft.slug;
    return (
      <section className="panel inset-panel space-y-5">
        <div className="grid gap-4 xl:grid-cols-2">
          <ReadOnlyField
            label="Display name"
            value={draft.displayName}
            helper={
              <>
                Slug: <span className="lowercase">{summarySlug}</span>
              </>
            }
          />
          <ReadOnlyField label="Content kind" value={formatContentKind(draft.contentKind)} />
          <ReadOnlyField label="Genres" value={renderTitleGenresSummary(draft.genres)} />
          <ReadOnlyField
            label="Age rating"
            value={draft.ageRatingAuthority && draft.ageRatingValue ? `${draft.ageRatingAuthority} ${draft.ageRatingValue}` : "Not provided"}
            helper={`Minimum age: ${formatMinimumAge(draft.minAgeYears)}`}
          />
          <ReadOnlyField label="Short description" value={<p className="max-w-3xl text-base leading-8 text-slate-200">{draft.shortDescription || "No short description added yet."}</p>} />
          <ReadOnlyField label="Player count" value={formatPlayerCount(draft)} />
        </div>

        <ReadOnlyField label="Description" value={<p className="max-w-4xl whitespace-pre-wrap text-base leading-8 text-slate-200">{draft.description || "No description added yet."}</p>} />

        {renderTitleMediaSummary(draft)}

        {renderShowcaseMediaSummary()}
      </section>
    );
  }

  function renderTitleMediaListEditor(mode: "create" | "metadata", draft: TitleDraft, editable: boolean): ReactNode {
    const mediaList = mode === "create" ? titleCreateMediaList : metadataMediaList;
    const missingMediaTypes = mode === "create" ? missingTitleCreateMediaTypes : missingMetadataMediaTypes;
    const nextMediaType = mode === "create" ? titleCreateNextMediaType : metadataNextMediaType;
    const addMediaSelectId = `add-title-media-type-${mode}`;

    return (
      <section className="surface-panel-strong rounded-[1rem] p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Title media</h3>
          <p className="mt-2 text-sm text-slate-400">Add the specific title image types you want players to see across browse, quick view, and detail pages.</p>
        </div>

        {mediaList.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No title image items added yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {mediaList.map((mediaTypeKey) => {
              const draftKey = titleMediaDraftKeyByTypeKey[mediaTypeKey];
              const availableTypeKeys = titleSingleMediaTypeKeys.filter((candidate) => candidate === mediaTypeKey || !mediaList.includes(candidate));
              return (
                <TitleMediaListItem
                  key={mediaTypeKey}
                  mediaTypeKey={mediaTypeKey}
                  definition={titleMediaDefinitionByTypeKey[mediaTypeKey]}
                  availableTypeLabels={titleMediaTypeLabelByKey}
                  availableTypeKeys={availableTypeKeys}
                  state={draft.media[draftKey]}
                  error={(mode === "create" ? titleCreateMediaErrors : metadataMediaErrors)[draftKey]}
                  disabled={!editable}
                  onTypeChange={(nextTypeKey) => changeTitleMediaListItemType(mode, mediaTypeKey, nextTypeKey)}
                  onUrlChange={(value) => {
                    updateTitleMedia(mode, draftKey, { url: value, previewUrl: value, file: null, fileName: null });
                    setTitleMediaError(mode, draftKey, null);
                  }}
                  onAltTextChange={(value) => updateTitleMedia(mode, draftKey, { altText: value })}
                  onFileChange={(file) => void handleTitleMediaUpload(mode, draftKey, file)}
                  onRemove={() => removeTitleMediaListItem(mode, mediaTypeKey)}
                />
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Add media item" asLabel={false} inputId={addMediaSelectId}>
            <select id={addMediaSelectId} value={nextMediaType} onChange={(event) => (mode === "create" ? setTitleCreateNextMediaType(event.currentTarget.value as TitleSingleMediaTypeKey) : setMetadataNextMediaType(event.currentTarget.value as TitleSingleMediaTypeKey))} disabled={!editable || missingMediaTypes.length === 0}>
              {missingMediaTypes.length === 0 ? (
                <option value={nextMediaType}>All title image types added</option>
              ) : (
                missingMediaTypes.map((mediaTypeKey) => (
                  <option key={mediaTypeKey} value={mediaTypeKey}>
                    {titleMediaTypeLabelByKey[mediaTypeKey]}
                  </option>
                ))
              )}
            </select>
          </Field>
          <button className="secondary-button" type="button" onClick={() => addTitleMediaListItem(mode, nextMediaType)} disabled={!editable || missingMediaTypes.length === 0}>
            Add media item
          </button>
        </div>
      </section>
    );
  }

  function renderShowcaseMediaEditor(editable: boolean): ReactNode {
    return (
      <section className="surface-panel-strong rounded-[1rem] p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Showcase media</h3>
          <p className="mt-2 text-sm text-slate-400">Add screenshots and video previews for the public gallery. The first screenshot also doubles as the default title detail image, and it can fall back into quick view if no quick view banner is uploaded.</p>
        </div>

        {showcaseMediaDrafts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No gallery media added yet.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {showcaseMediaDrafts.map((item, index) => (
              <article
                key={item.id ?? `showcase-${index}`}
                className="surface-panel-soft overflow-hidden rounded-[1.1rem] p-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(90deg,rgba(96,255,164,0.1),rgba(96,255,164,0.03)_22%,rgba(17,16,24,0.22)_60%,rgba(17,16,24,0.12))] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-50">Gallery item {index + 1}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-100/70">
                      {item.kind === "external_video" ? "Video preview" : "Screenshot"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50">
                      Position {index + 1} of {showcaseMediaDrafts.length}
                    </span>
                    <button className="secondary-button !min-w-0 !px-4" type="button" aria-label="Move item up" onClick={() => moveShowcaseMediaDraft(index, "up")} disabled={!editable || index === 0}>
                      ↑
                    </button>
                    <button className="secondary-button !min-w-0 !px-4" type="button" aria-label="Move item down" onClick={() => moveShowcaseMediaDraft(index, "down")} disabled={!editable || index === showcaseMediaDrafts.length - 1}>
                      ↓
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 p-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
                  <div className="surface-panel-strong space-y-3 rounded-[1rem] p-3">
                    <div className="overflow-hidden rounded-[0.95rem] border border-white/12 bg-slate-950/45 p-2">
                      <div
                        className="overflow-hidden rounded-[0.8rem] border border-white/10 bg-slate-950/70"
                        style={{ aspectRatio: buildAspectRatioValue(showcaseMediaDefinition.recommendedWidth, showcaseMediaDefinition.recommendedHeight) }}
                      >
                        {item.previewUrl || item.imageUrl ? (
                          <img className="h-full w-full object-cover" src={item.previewUrl || item.imageUrl} alt={item.altText || "Showcase preview"} />
                        ) : (
                          <div className="grid h-full place-items-center text-xs uppercase tracking-[0.18em] text-slate-500">No image</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-[0.95rem] border border-white/8 bg-black/20 p-3">
                      <CatalogMediaSpecSummary definition={showcaseMediaDefinition} />
                    </div>
                  </div>
                  <div className="rounded-[1rem] border border-white/12 bg-[linear-gradient(180deg,rgba(8,8,12,0.28),rgba(8,8,12,0.18))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="space-y-4">
                      <section className="rounded-[0.95rem] border border-white/10 bg-black/18 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Media details</p>
                        <div className="mt-3">
                          <Field label="Type">
                            <select value={item.kind} onChange={(event) => updateShowcaseMediaDraft(index, { kind: event.currentTarget.value as TitleShowcaseMediaDraft["kind"] })} disabled={!editable || Boolean(item.id)}>
                              <option value="image">Screenshot</option>
                              <option value="external_video">External video</option>
                            </select>
                          </Field>
                        </div>
                      </section>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(15rem,0.8fr)]">
                        <section className="rounded-[0.95rem] border border-white/10 bg-black/18 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Accessibility</p>
                          <div className="mt-3">
                            <Field label="Alt text">
                              <input value={item.altText} onChange={(event) => updateShowcaseMediaDraft(index, { altText: event.currentTarget.value })} disabled={!editable} />
                            </Field>
                          </div>
                        </section>

                        {item.kind === "external_video" ? (
                          <section className="rounded-[0.95rem] border border-white/10 bg-black/18 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Source</p>
                            <div className="mt-3">
                              <Field label="Video URL">
                                <input value={item.videoUrl} onChange={(event) => updateShowcaseMediaDraft(index, { videoUrl: event.currentTarget.value })} disabled={!editable} placeholder="https://..." />
                              </Field>
                            </div>
                          </section>
                        ) : !item.file ? (
                          <section className="rounded-[0.95rem] border border-white/10 bg-black/18 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Source</p>
                            <div className="mt-3">
                              <Field label="Image URL">
                                <input
                                  value={item.imageUrl}
                                  onChange={(event) => updateShowcaseMediaDraft(index, { imageUrl: event.currentTarget.value, previewUrl: event.currentTarget.value })}
                                  disabled={!editable}
                                  placeholder="https://..."
                                />
                              </Field>
                            </div>
                          </section>
                        ) : (
                          <section className="rounded-[0.95rem] border border-white/10 bg-black/18 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Source</p>
                            <div className="mt-3 rounded-[0.85rem] border border-white/12 bg-slate-950/50 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Uploaded image</p>
                              <p className="mt-2 break-all text-sm text-slate-200">{item.fileName ?? "Current upload selected"}</p>
                              <p className="mt-2 text-xs leading-6 text-slate-400">Remove the upload to switch back to an image URL.</p>
                            </div>
                          </section>
                        )}
                      </div>

                      <section className="rounded-[0.95rem] border border-white/10 bg-black/22 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Actions</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <label className={`secondary-button inline-flex cursor-pointer ${!editable ? "pointer-events-none opacity-50" : ""}`}>
                            Upload image
                            <input className="sr-only" type="file" accept={showcaseMediaDefinition.acceptedMimeTypes.join(",")} disabled={!editable} onChange={(event) => void handleShowcaseMediaUpload(index, event.currentTarget.files?.[0] ?? null)} />
                          </label>
                          {item.file ? (
                            <button className="secondary-button" type="button" onClick={() => void handleShowcaseMediaUpload(index, null)} disabled={!editable}>
                              Remove upload
                            </button>
                          ) : null}
                          <button className="danger-button" type="button" onClick={() => removeShowcaseMediaDraft(index)} disabled={!editable}>
                            Remove item
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="secondary-button" type="button" onClick={() => addShowcaseMediaDraft("image")} disabled={!editable}>
            Add screenshot
          </button>
          <button className="secondary-button" type="button" onClick={() => addShowcaseMediaDraft("external_video")} disabled={!editable}>
            Add video preview
          </button>
        </div>

        {showcaseMediaError ? <p className="error-text mt-4">{showcaseMediaError}</p> : null}
      </section>
    );
  }

  function renderStudioLinkEditor(target: "create" | "overview", draft: StudioDraft, disabled: boolean): ReactNode {
    return (
      <section className="surface-panel-strong rounded-[1rem] p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Studio links</h3>
          <span className="text-xs text-slate-400">Optional</span>
        </div>
        <div className="mt-4 space-y-3">
          {draft.links.map((link, index) => (
            <div key={link.id ?? `link-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)_auto]">
              <input
                className="w-full rounded-[1rem] border border-white/12 bg-[#111017] px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/50"
                value={link.label}
                onChange={(event) => updateStudioLinkDraft(target, index, "label", event.currentTarget.value)}
                disabled={disabled}
                placeholder="Website"
              />
              <input
                className="w-full rounded-[1rem] border border-white/12 bg-[#111017] px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/50"
                value={link.url}
                onChange={(event) => updateStudioLinkDraft(target, index, "url", event.currentTarget.value)}
                disabled={disabled}
                placeholder="https://..."
              />
              <div className="flex gap-2">
                <button className="secondary-button !px-3" type="button" onClick={() => addStudioLinkRow(target)} disabled={disabled} aria-label="Add studio link">
                  +
                </button>
                {draft.links.length > 1 ? (
                  <button className="secondary-button !px-3" type="button" onClick={() => removeStudioLinkRow(target, index)} disabled={disabled} aria-label="Remove studio link">
                    -
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderCharacterCounter(value: string, maxLength: number): ReactNode {
    if (!shouldShowCharacterCounter(value, maxLength)) {
      return null;
    }

    const count = value.trim().length;
    const tone = count > maxLength ? "text-rose-300" : "text-slate-400";
    return (
      <span className={`text-xs ${tone}`}>
        {count} / {maxLength}
      </span>
    );
  }

  function renderStudioForm(mode: "create" | "overview"): ReactNode {
    const draft = mode === "create" ? studioCreateDraft : studioOverviewDraft;
    const touched = mode === "create" ? studioCreateTouched : studioOverviewTouched;
    const validation = mode === "create" ? studioCreateValidation : studioOverviewValidation;
    const editing = mode === "create" ? true : studioOverviewEditing;
    const summarySlug = activeStudio?.slug ?? draft.slug;

    if (mode === "overview" && !editing) {
      return (
        <div className="space-y-6">
          <div className="grid gap-4">
            <ReadOnlyField
              label="Studio display name"
              value={draft.displayName}
              helper={
                <>
                  Slug: <span className="lowercase">{summarySlug}</span>
                </>
              }
            />
            <ReadOnlyField label="Description" value={<p className="max-w-4xl text-base leading-8 text-slate-200">{draft.description || "No description added yet."}</p>} />
          </div>

          {renderStudioMediaSummary(draft)}

          {renderStudioLinksSummary(draft)}

          <div className="flex flex-wrap gap-3">
            <button className="secondary-button" type="button" onClick={() => setStudioOverviewEditing(true)}>
              Edit studio
            </button>
            {activeStudio ? (
              <Link className="secondary-button" to={`/studios/${activeStudio.slug}`}>
                Open studio
              </Link>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <form className="space-y-6" onSubmit={mode === "create" ? handleCreateStudio : handleSaveStudio}>
        <h2 className="text-2xl font-semibold text-white">{mode === "create" ? "Create Studio" : "Edit Studio"}</h2>

        <Field label="Studio display name" required error={touched.displayName ? validation.errors.displayName : undefined}>
          <div>
            <input
              value={draft.displayName}
              onChange={(event) => {
                const displayName = event.currentTarget.value;
                const slug = slugifyValue(displayName);
                if (mode === "create") {
                  setStudioCreateDraft((current) => ({ ...current, displayName, slug }));
                } else {
                  setStudioOverviewDraft((current) => ({ ...current, displayName, slug }));
                }
              }}
              onBlur={() => touchField(mode === "create" ? setStudioCreateTouched : setStudioOverviewTouched, "displayName")}
              disabled={!editing}
              placeholder="Blue Harbor Games"
            />
            {draft.slug.trim() ? (
              <p className="mt-2 text-sm text-slate-400">
                SLUG: <span className="text-slate-300 lowercase">{draft.slug}</span>
              </p>
            ) : null}
            {touched.displayName && validation.errors.slug ? <p className="mt-2 text-sm text-rose-300">{validation.errors.slug}</p> : null}
          </div>
        </Field>

        <Field label="Description" required error={touched.description ? validation.errors.description : undefined} counter={renderCharacterCounter(draft.description, STUDIO_DESCRIPTION_MAX_LENGTH)}>
          <textarea
            rows={6}
            value={draft.description}
            onChange={(event) => {
              const description = event.currentTarget.value;
              if (mode === "create") {
                setStudioCreateDraft((current) => ({ ...current, description }));
              } else {
                setStudioOverviewDraft((current) => ({ ...current, description }));
              }
            }}
            onBlur={() => touchField(mode === "create" ? setStudioCreateTouched : setStudioOverviewTouched, "description")}
            disabled={!editing}
          />
        </Field>

        <section className="surface-panel-strong rounded-[1rem] p-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Studio media</h3>
            <p className="mt-2 text-sm text-slate-400">Add the studio image types you want players to see across studio cards, headers, and identity surfaces.</p>
          </div>
          <div className="mt-4 space-y-4">
            {studioMediaDraftKeys.map((mediaRole) => (
              <StudioMediaListItem
                key={mediaRole}
                mediaRole={mediaRole}
                label={studioMediaLabelByDraftKey[mediaRole]}
                state={draft[mediaRole]}
                definition={studioMediaDefinitionByDraftKey[mediaRole]}
                error={(mode === "create" ? studioCreateMediaErrors : studioOverviewMediaErrors)[mediaRole]}
                disabled={!editing}
                onUrlChange={(value) => {
                  updateStudioMedia(mode === "create" ? "create" : "overview", mediaRole, { url: value, previewUrl: value, file: null, fileName: null });
                  setStudioMediaError(mode === "create" ? "create" : "overview", mediaRole, null);
                }}
                onFileChange={(file) => void handleStudioMediaUpload(mode === "create" ? "create" : "overview", mediaRole, file)}
                onRemove={() => {
                  updateStudioMedia(mode === "create" ? "create" : "overview", mediaRole, createStudioMediaDraft(""));
                  setStudioMediaError(mode === "create" ? "create" : "overview", mediaRole, null);
                }}
              />
            ))}
          </div>
        </section>

        {renderStudioLinkEditor(mode, draft, !editing)}

        <div className="flex flex-wrap gap-3">
          {mode === "overview" ? (
            <>
              <button className={studioOverviewEditing ? "primary-button" : "secondary-button"} type="submit" disabled={studioOverviewEditing && !studioOverviewValidation.isValid}>
                {saving ? "Saving..." : studioOverviewEditing ? "Save studio" : "Edit studio"}
              </button>
              {studioOverviewEditing ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setStudioOverviewEditing(false);
                    setStudioOverviewDraft(createStudioDraft(activeStudio, links));
                    setStudioOverviewTouched({});
                  }}
                >
                  Cancel
                </button>
              ) : null}
              {activeStudio ? (
                <Link className="secondary-button" to={`/studios/${activeStudio.slug}`}>
                  Open studio
                </Link>
              ) : null}
            </>
          ) : (
            <button className="primary-button" type="submit" disabled={!studioCreateValidation.isValid || saving}>
              {saving ? "Creating..." : "Create studio"}
            </button>
          )}
        </div>
      </form>
    );
  }

  function renderTitleForm(mode: "create" | "metadata"): ReactNode {
    const draft = mode === "create" ? titleCreateDraft : metadataDraft;
    const touched = mode === "create" ? titleCreateTouched : metadataTouched;
    const validation = mode === "create" ? titleCreateValidation : metadataValidation;
    const editable = mode === "create" ? true : metadataEditing;

    if (mode === "metadata" && !editable) {
      return (
        <div className="space-y-6">
          <header className="surface-panel-strong rounded-[1.25rem] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Revision {activeTitle?.currentMetadataRevision ?? "Current"}</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Metadata</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Review the active public metadata revision, media, and copy before entering edit mode.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setMetadataEditing(true)}>
                Edit metadata
              </button>
            </div>
          </header>

          {renderMetadataSummary(draft)}

          <section className="panel inset-panel">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-white">Revision history</h3>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Newest first</span>
            </div>
            <div className="mt-4 space-y-3">
              {metadataVersions
                .slice()
                .sort((left, right) => right.revisionNumber - left.revisionNumber)
                .map((version) => (
                  <article key={version.revisionNumber} className="surface-panel-strong flex flex-wrap items-start justify-between gap-4 rounded-[1rem] p-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Revision {version.revisionNumber}</div>
                      <p className="mt-2 text-sm text-slate-300">
                        {version.displayName} · {version.isFrozen ? "Frozen" : "Editable"} · {version.isCurrent ? "Current" : "Inactive"}
                      </p>
                    </div>
                    {!version.isCurrent ? (
                      <button className="secondary-button" type="button" onClick={() => void handleActivateRevision(version.revisionNumber)} disabled={saving}>
                        Activate
                      </button>
                    ) : null}
                  </article>
                ))}
            </div>
          </section>
        </div>
      );
    }

    return (
      <form className="space-y-6" onSubmit={mode === "create" ? handleCreateTitle : handleSaveMetadata}>
        <h2 className="text-2xl font-semibold text-white">{mode === "create" ? "Create Title" : "Metadata"}</h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Display name" required error={touched.displayName ? validation.errors.displayName : undefined}>
            <div>
              <input
                value={draft.displayName}
                onChange={(event) => {
                  const displayName = event.currentTarget.value;
                  const slug = slugifyValue(displayName);
                  if (mode === "create") {
                    setTitleCreateDraft((current) => ({ ...current, displayName, slug }));
                  } else {
                    setMetadataDraft((current) => ({ ...current, displayName, slug }));
                  }
                }}
                onBlur={() => touchField(mode === "create" ? setTitleCreateTouched : setMetadataTouched, "displayName")}
                disabled={!editable}
              />
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                Slug: <span className="lowercase">{draft.slug}</span>
              </p>
              {mode === "create" && touched.displayName && validation.errors.slug ? <p className="mt-2 text-sm text-rose-300">{validation.errors.slug}</p> : null}
            </div>
          </Field>
          <Field label="Content kind" required error={touched.contentKind ? validation.errors.contentKind : undefined}>
            <select
              value={draft.contentKind}
              onChange={(event) => {
                const contentKind = event.currentTarget.value as "game" | "app";
                if (mode === "create") {
                  setTitleCreateDraft((current) => ({ ...current, contentKind }));
                } else {
                  setMetadataDraft((current) => ({ ...current, contentKind }));
                }
              }}
              onBlur={() => touchField(mode === "create" ? setTitleCreateTouched : setMetadataTouched, "contentKind")}
              disabled={!editable}
            >
              <option value="game">Game</option>
              <option value="app">App</option>
            </select>
          </Field>
        </div>

        <TokenField
          label="Genres"
          required
          placeholder="Add or search genres"
          inputValue={draft.genreInput}
          selectedValues={draft.genres.map((genreSlug) => ({ value: genreSlug, label: genreLabelBySlug.get(genreSlug) ?? genreSlug }))}
          availableValues={genreOptions}
          allowCreate
          error={touched.genres ? validation.errors.genres : undefined}
          onInputChange={(value) => (mode === "create" ? setTitleCreateDraft((current) => ({ ...current, genreInput: value })) : setMetadataDraft((current) => ({ ...current, genreInput: value })))}
          onAdd={(value) => addGenre(mode === "create" ? "create" : "metadata", value)}
          onRemove={(value) => removeGenre(mode === "create" ? "create" : "metadata", value)}
        />

        <TokenField
          label="Age rating authority"
          placeholder="Choose an authority"
          inputValue={draft.ageRatingAuthorityInput}
          selectedValues={
            draft.ageRatingAuthority
              ? [
                  {
                    value: draft.ageRatingAuthority,
                    label: ageRatingAuthorityOptions.find((authority) => authority.value === draft.ageRatingAuthority)?.label ?? draft.ageRatingAuthority,
                  },
                ]
              : []
          }
          availableValues={ageRatingAuthorityOptions}
          allowCreate={false}
          error={touched.ageRatingAuthority ? validation.errors.ageRatingAuthority : undefined}
          onInputChange={(value) => (mode === "create" ? setTitleCreateDraft((current) => ({ ...current, ageRatingAuthorityInput: value })) : setMetadataDraft((current) => ({ ...current, ageRatingAuthorityInput: value })))}
          onAdd={(value) => {
            const normalizedAuthority = normalizeSelectableValues([value], ageRatingAuthorityOptions, { canonicalizeUnknown: normalizeAuthorityCode })[0] ?? "";
            if (mode === "create") {
              setTitleCreateDraft((current) => ({ ...current, ageRatingAuthority: normalizedAuthority, ageRatingAuthorityInput: "" }));
            } else {
              setMetadataDraft((current) => ({ ...current, ageRatingAuthority: normalizedAuthority, ageRatingAuthorityInput: "" }));
            }
          }}
          onRemove={() => {
            if (mode === "create") {
              setTitleCreateDraft((current) => ({ ...current, ageRatingAuthority: "", ageRatingAuthorityInput: "" }));
            } else {
              setMetadataDraft((current) => ({ ...current, ageRatingAuthority: "", ageRatingAuthorityInput: "" }));
            }
          }}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Short description" required error={touched.shortDescription ? validation.errors.shortDescription : undefined} counter={renderCharacterCounter(draft.shortDescription, TITLE_SHORT_DESCRIPTION_MAX_LENGTH)}>
            <input
              value={draft.shortDescription}
              onChange={(event) => {
                const shortDescription = event.currentTarget.value;
                if (mode === "create") {
                  setTitleCreateDraft((current) => ({ ...current, shortDescription }));
                } else {
                  setMetadataDraft((current) => ({ ...current, shortDescription }));
                }
              }}
              onBlur={() => touchField(mode === "create" ? setTitleCreateTouched : setMetadataTouched, "shortDescription")}
              disabled={!editable}
            />
          </Field>
          <Field label="Age rating value" error={touched.ageRatingValue ? validation.errors.ageRatingValue : undefined}>
            <input
              value={draft.ageRatingValue}
              onChange={(event) => {
                const ageRatingValue = event.currentTarget.value;
                if (mode === "create") {
                  setTitleCreateDraft((current) => ({ ...current, ageRatingValue }));
                } else {
                  setMetadataDraft((current) => ({ ...current, ageRatingValue }));
                }
              }}
              onBlur={() => touchField(mode === "create" ? setTitleCreateTouched : setMetadataTouched, "ageRatingValue")}
              disabled={!editable}
              placeholder="Optional"
            />
          </Field>
        </div>

        <Field label="Description" required error={touched.description ? validation.errors.description : undefined} counter={renderCharacterCounter(draft.description, TITLE_DESCRIPTION_MAX_LENGTH)}>
          <textarea
            rows={6}
            value={draft.description}
            onChange={(event) => {
              const description = event.currentTarget.value;
              if (mode === "create") {
                setTitleCreateDraft((current) => ({ ...current, description }));
              } else {
                setMetadataDraft((current) => ({ ...current, description }));
              }
            }}
            onBlur={() => touchField(mode === "create" ? setTitleCreateTouched : setMetadataTouched, "description")}
            disabled={!editable}
          />
        </Field>

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Min players" error={touched.minPlayers ? validation.errors.minPlayers : undefined}>
            <input type="number" min={1} value={draft.minPlayers} onChange={(event) => updateTitlePlayers(mode === "create" ? "create" : "metadata", "minPlayers", event.currentTarget.value)} onBlur={() => touchField(mode === "create" ? setTitleCreateTouched : setMetadataTouched, "minPlayers")} disabled={!editable} />
          </Field>
          <Field label="Max players" error={touched.maxPlayers ? validation.errors.maxPlayers : undefined}>
            <div className="space-y-3">
              <input type="number" min={1} value={draft.maxPlayers} onChange={(event) => updateTitlePlayers(mode === "create" ? "create" : "metadata", "maxPlayers", event.currentTarget.value)} onBlur={() => touchField(mode === "create" ? setTitleCreateTouched : setMetadataTouched, "maxPlayers")} disabled={!editable} />
              <label className="inline-flex items-center gap-3 text-sm text-slate-300">
                <input
                  className="h-4 w-4 accent-emerald-400"
                  type="checkbox"
                  checked={draft.maxPlayersOrMore}
                  onChange={(event) => updateMaxPlayersOrMore(mode === "create" ? "create" : "metadata", event.currentTarget.checked)}
                  disabled={!editable}
                />
                <span>Or more</span>
              </label>
            </div>
          </Field>
          <Field label="Minimum age" error={touched.minAgeYears ? validation.errors.minAgeYears : undefined}>
            <input value={formatMinimumAge(draft.minAgeYears)} onChange={(event) => updateTitleMinimumAge(mode === "create" ? "create" : "metadata", event.currentTarget.value)} onBlur={() => touchField(mode === "create" ? setTitleCreateTouched : setMetadataTouched, "minAgeYears")} disabled={!editable} />
          </Field>
        </div>

        {renderTitleMediaListEditor(mode, draft, editable)}

        {renderShowcaseMediaEditor(editable)}

        <div className="flex flex-wrap gap-3">
          {mode === "create" ? (
            <button className="primary-button" type="submit" disabled={!validation.isValid || saving}>
              {saving ? "Creating..." : "Create title"}
            </button>
          ) : (
            <>
              <button className={metadataEditing ? "primary-button" : "secondary-button"} type="submit" disabled={metadataEditing && !validation.isValid}>
                {saving ? "Saving..." : metadataEditing ? "Save metadata" : "Edit metadata"}
              </button>
              {metadataEditing ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setMetadataEditing(false);
                    const nextDraft = createTitleDraft(activeTitle);
                    setMetadataDraft(nextDraft);
                    setMetadataMediaList(deriveActiveTitleMediaTypeKeys(nextDraft));
                    setShowcaseMediaDrafts((activeTitle?.showcaseMedia ?? []).map((item) => createTitleShowcaseMediaDraft(item)));
                    setMetadataTouched({});
                    setShowcaseMediaError(null);
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </>
          )}
        </div>

        {mode === "metadata" ? (
          <section className="panel inset-panel">
            <h3 className="text-lg font-semibold text-white">Revision history</h3>
            <div className="mt-4 space-y-3">
              {metadataVersions
                .slice()
                .sort((left, right) => right.revisionNumber - left.revisionNumber)
                .map((version) => (
                  <article key={version.revisionNumber} className="surface-panel-strong flex flex-wrap items-start justify-between gap-4 rounded-[1rem] p-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Revision {version.revisionNumber}</div>
                      <p className="mt-2 text-sm text-slate-300">
                        {version.displayName} · {version.isFrozen ? "Frozen" : "Editable"} · {version.isCurrent ? "Current" : "Inactive"}
                      </p>
                    </div>
                    {!version.isCurrent ? (
                      <button className="secondary-button" type="button" onClick={() => void handleActivateRevision(version.revisionNumber)} disabled={saving}>
                        Activate
                      </button>
                    ) : null}
                  </article>
                ))}
            </div>
          </section>
        ) : null}
      </form>
    );
  }

  function renderStudioAnalytics(): ReactNode {
    if (!activeStudio) {
      return <EmptyState title="No studio selected" detail="Select a studio to review follower activity." />;
    }

    return (
      <div className="space-y-6">
        <header className="surface-panel-strong rounded-[1.25rem] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">{activeStudio.displayName}</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Studio analytics</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">See how many players are following this studio across Board Enthusiasts right now.</p>
        </header>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="develop-stat-card p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Follower count</div>
            <div className="mt-2 text-3xl font-semibold text-white">{activeStudio.followerCount ?? 0}</div>
            <p className="mt-3 text-sm leading-7 text-slate-300">Players following this studio will see it more easily from their personal library area.</p>
          </div>
        </section>
      </div>
    );
  }

  function renderTitleAnalytics(): ReactNode {
    if (!activeTitle) {
      return <EmptyState title="No title selected" detail="Select a title to review wishlist and library interest." />;
    }

    return (
      <div className="space-y-6">
        <header className="surface-panel-strong rounded-[1.25rem] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">{activeStudio?.displayName ?? activeTitle.studioSlug}</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Title analytics</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Track early player interest for this title before and after release.</p>
        </header>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="develop-stat-card p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Wishlisted count</div>
            <div className="mt-2 text-3xl font-semibold text-white">{activeTitle.wishlistCount ?? 0}</div>
            <p className="mt-3 text-sm leading-7 text-slate-300">How many players have saved this title to revisit later.</p>
          </div>
          <div className="develop-stat-card p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Added to library count</div>
            <div className="mt-2 text-3xl font-semibold text-white">{activeTitle.libraryCount ?? 0}</div>
            <p className="mt-3 text-sm leading-7 text-slate-300">How many player libraries currently include this title.</p>
          </div>
        </section>
      </div>
    );
  }

  function renderWorkspaceMain(): ReactNode {
    if (workspaceLoading) {
      return (
        <section className="surface-panel-strong rounded-[1.25rem] p-5">
          <div className="h-8 w-48 animate-pulse rounded-full bg-white/10" />
        </section>
      );
    }

    if (workspace.workflow === "studios-create") {
      return renderStudioForm("create");
    }

    if (workspace.workflow === "studios-overview") {
      return activeStudio ? renderStudioForm("overview") : <EmptyState title="No studio selected" detail="Create a studio to get started." />;
    }

    if (workspace.workflow === "studios-analytics") {
      return renderStudioAnalytics();
    }

    if (workspace.workflow === "titles-create") {
      return activeStudio ? renderTitleForm("create") : <EmptyState title="No studio selected" detail="Select a studio before creating a title." />;
    }

    if (workspace.workflow === "titles-overview") {
      return activeTitle ? (
        <div className="space-y-6">
          <header className="surface-panel-strong rounded-[1.25rem] p-5">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">{activeStudio?.displayName ?? activeTitle.studioSlug}</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">{activeTitle.displayName}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{activeTitle.shortDescription}</p>
            </div>
          </header>

          <section className="grid gap-4 xl:grid-cols-3">
            <div className="develop-stat-card p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Active metadata revision</div>
              <div className="mt-2 text-lg font-semibold text-white">{activeTitle.currentMetadataRevision}</div>
            </div>
            <div className="develop-stat-card p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Current release</div>
              <div className="mt-2 text-lg font-semibold text-white">{activeTitle.currentRelease?.version ?? "None"}</div>
            </div>
            <div className="develop-stat-card p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Title status</div>
              <div className="mt-2 text-lg font-semibold text-white">{formatLifecycleStatus(activeTitle.lifecycleStatus)}</div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <ReadOnlyField label="Content kind" value={formatContentKind(activeTitle.contentKind)} />
            <section className="surface-panel-strong rounded-[1rem] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Visibility</div>
              {(() => {
                const visibilityTooltip = titleVisibilityToggleTooltip(activeTitle, saving);
                return (
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="group relative inline-flex">
                  <button
                    aria-label="Title visibility"
                    aria-checked={activeTitle.visibility === "listed"}
                    className={`relative inline-flex h-12 w-24 items-center rounded-full border transition ${
                      activeTitle.visibility === "listed"
                        ? "border-cyan-300/45 bg-cyan-300/20"
                        : "border-white/10 bg-slate-950/45"
                    } ${titleVisibilityCanBeChanged(activeTitle) && !saving ? "hover:border-cyan-300/60" : "cursor-not-allowed opacity-60"}`}
                    role="switch"
                    type="button"
                    disabled={!titleVisibilityCanBeChanged(activeTitle) || saving}
                    onClick={() => void handleToggleTitleVisibility()}
                  >
                    <span
                      className={`absolute left-1 h-10 w-10 rounded-full bg-white shadow-[0_0_24px_rgba(74,222,128,0.2)] transition-transform ${
                        activeTitle.visibility === "listed" ? "translate-x-12" : "translate-x-0"
                      }`}
                    />
                  </button>
                  {visibilityTooltip ? (
                    <div className="pointer-events-none absolute left-0 top-full z-10 mt-3 hidden w-72 rounded-[1rem] border border-cyan-300/30 bg-slate-950/95 px-4 py-3 text-sm leading-6 text-slate-200 shadow-[0_18px_44px_rgba(0,0,0,0.45)] group-hover:block">
                      {visibilityTooltip}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="text-base font-semibold text-white">{formatVisibility(activeTitle.visibility)}</div>
                  <p className="mt-1 text-sm leading-7 text-slate-400">
                    {titleVisibilityCanBeChanged(activeTitle)
                      ? activeTitle.visibility === "listed"
                        ? "Players can discover this title in browse and search."
                        : "This title stays out of browse and search until you list it."
                      : titleVisibilityDescription(activeTitle)}
                  </p>
                </div>
              </div>
                );
              })()}
              {titleOverviewError ? <p className="error-text mt-4">{titleOverviewError}</p> : null}
            </section>
          </div>
          <section className="surface-panel-strong rounded-[1.25rem] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Title actions</div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Manage when players can find this title and which release they should see next.
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              {titleVisibilityDescription(activeTitle)}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {titleCanBeUnarchived(activeTitle) ? (
                <button className="secondary-button" type="button" onClick={() => void handleUnarchiveActiveTitle()} disabled={saving}>
                  Unarchive title
                </button>
              ) : (
                <>
                  {activeTitle.lifecycleStatus === "active" && activeTitle.visibility === "listed" ? (
                    <Link className="secondary-button" to={`/browse/${activeTitle.studioSlug}/${activeTitle.slug}`}>
                      Open title
                    </Link>
                  ) : null}
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setWorkspaceState({
                        domain: "releases",
                        workflow: activeTitle.currentRelease ? "releases-overview" : "releases-create",
                        releaseId: activeTitle.currentRelease?.id ?? releases[0]?.id ?? "",
                      })
                    }
                  >
                    {activeTitle.currentRelease ? "Open current release" : releases.length > 0 ? "Open releases" : "Create release"}
                  </button>
                  {titleCanBeActivated(activeTitle) ? (
                    <button className="secondary-button" type="button" onClick={() => void handleActivateTitleLifecycle()} disabled={saving}>
                      Activate and list title
                    </button>
                  ) : null}
                </>
              )}
            </div>
            {activeTitle.lifecycleStatus === "archived" ? (
              <p className="mt-4 text-sm leading-7 text-slate-400">Unarchive this title before you manage releases or change whether players can discover it.</p>
            ) : titleCanBeActivated(activeTitle) && !activeTitle.currentRelease ? (
              <p className="mt-4 text-sm leading-7 text-slate-400">You can activate this title now to let players discover it as coming soon, or create a release first if you are ready for acquisition links too.</p>
            ) : null}
            {titleActionsError ? <p className="error-text mt-4">{titleActionsError}</p> : null}
            {!titleCanBeUnarchived(activeTitle) ? (
              <div className="mt-5 border-t border-white/10 pt-5">
                <button className="caution-button" type="button" onClick={() => void handleArchiveActiveTitle()} disabled={saving}>
                  Archive title
                </button>
              </div>
            ) : null}
          </section>
          <section className="rounded-[1.25rem] border border-rose-400/30 bg-rose-500/8 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-rose-200/85">Danger zone</div>
            <h3 className="mt-3 text-xl font-semibold text-white">Delete title</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-rose-50/90">
              Permanently remove this title, its releases, saved metadata, media, and related report history.
            </p>
            <div className="mt-5">
              <button className="danger-button" type="button" onClick={() => { setDeleteCurrentPassword(""); setDeleteConfirmationName(""); setDeleteModalError(null); setDeletePasswordModalOpen(true); setDeleteConfirmationModalOpen(false); }} disabled={saving || activeTitle.lifecycleStatus === "archived"}>
                Delete title
              </button>
            </div>
          </section>
        </div>
      ) : (
        <EmptyState title="No title selected" detail="Create a title or choose one to continue." />
      );
    }

    if (workspace.workflow === "titles-analytics") {
      return renderTitleAnalytics();
    }

    if (workspace.workflow === "titles-metadata") {
      return activeTitle ? renderTitleForm("metadata") : <EmptyState title="No title selected" detail="Select a title to edit its details." />;
    }

    if (workspace.workflow === "titles-reports") {
      return activeTitle ? (
        <div className="grid gap-6 xl:grid-cols-[0.42fr_minmax(0,1fr)]">
          <section className="panel inset-panel">
            <h2 className="text-2xl font-semibold text-white">Reports</h2>
            <div className="mt-4 space-y-3">
              {reports.length === 0 ? (
                <EmptyState title="No reports" detail="Player reports for this title will appear here." />
              ) : (
                reports.map((report) => (
                  <button key={report.id} className={selectedReportId === report.id ? "w-full rounded-[1rem] border border-cyan-300/45 bg-cyan-300/12 p-4 text-left" : "surface-panel-strong w-full rounded-[1rem] p-4 text-left"} type="button" onClick={() => setSelectedReportId(report.id)}>
                    <div className="text-sm font-semibold text-white">{report.reason}</div>
                    <p className="mt-2 text-sm text-slate-300">{report.status} · {report.messageCount} messages</p>
                  </button>
                ))
              )}
            </div>
          </section>
          <section className="panel inset-panel">
            {!selectedReport ? (
              <EmptyState title="No report selected" detail="Choose a report to review the message thread." />
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white">{selectedReport.report.reason}</h3>
                <p className="mt-2 text-sm text-slate-300">Reported {formatDateTime(selectedReport.report.createdAt)} · Status {selectedReport.report.status}</p>
                <div className="mt-6 space-y-3">
                  {selectedReport.messages.map((entry) => (
                    <article key={entry.id} className="surface-panel-strong rounded-[1rem] p-4">
                      <div className="text-sm font-semibold text-white">{entry.authorDisplayName ?? entry.authorEmail ?? "Unknown sender"}</div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{entry.message}</p>
                    </article>
                  ))}
                </div>
                <form className="mt-6 space-y-3" onSubmit={handleReportReply}>
                  <Field label="Reply">
                    <textarea rows={4} value={reportReply} onChange={(event) => setReportReply(event.currentTarget.value)} />
                  </Field>
                  <button className="primary-button" type="submit" disabled={saving || !reportReply.trim()}>
                    {saving ? "Sending..." : "Send reply"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      ) : (
        <EmptyState title="No title selected" detail="Select a title to review reports." />
      );
    }

    if (workspace.workflow === "releases-create") {
      return activeTitle ? (
        <form className="space-y-6" onSubmit={handleCreateRelease}>
          <header className="surface-panel-strong rounded-[1.25rem] p-5">
            <h2 className="text-2xl font-semibold text-white">Create Release</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Create a testing or production release for {activeTitle.displayName}, select the metadata revision it should ship with, and add the acquisition URL players should use.</p>
          </header>
          <section className="panel inset-panel space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Version" required error={releaseCreateTouched.version ? releaseCreateValidation.errors.version : undefined}>
                <input
                  value={releaseCreateDraft.version}
                  onChange={(event) => {
                    const version = event.currentTarget.value;
                    setReleaseCreateDraft((current) => ({ ...current, version }));
                  }}
                  onBlur={() => touchField(setReleaseCreateTouched, "version")}
                />
              </Field>
              <Field label="Release type" required error={releaseCreateTouched.status ? releaseCreateValidation.errors.status : undefined}>
                <select
                  value={releaseCreateDraft.status}
                  onChange={(event) => {
                    const status = event.currentTarget.value as ReleaseDraft["status"];
                    setReleaseCreateDraft((current) => ({ ...current, status }));
                  }}
                  onBlur={() => touchField(setReleaseCreateTouched, "status")}
                >
                  <option value="testing">Testing</option>
                  <option value="production">Production</option>
                </select>
              </Field>
              <Field label="Acquisition URL" error={releaseCreateTouched.acquisitionUrl ? releaseCreateValidation.errors.acquisitionUrl : undefined}>
                <input
                  value={releaseCreateDraft.acquisitionUrl}
                  onChange={(event) => {
                    const acquisitionUrl = event.currentTarget.value;
                    setReleaseCreateDraft((current) => ({ ...current, acquisitionUrl }));
                  }}
                  onBlur={() => touchField(setReleaseCreateTouched, "acquisitionUrl")}
                  placeholder="https://..."
                />
              </Field>
              {releaseCreateDraft.status === "testing" ? (
                <Field label="Expiration date" error={releaseCreateTouched.expiresAt ? releaseCreateValidation.errors.expiresAt : undefined}>
                  <DateTimeLocalField
                    value={releaseCreateDraft.expiresAt}
                    min={minimumReleaseExpirationInput}
                    onChange={(expiresAt) => {
                      setReleaseCreateDraft((current) => ({ ...current, expiresAt }));
                    }}
                    onBlur={() => touchField(setReleaseCreateTouched, "expiresAt")}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>Earliest allowed: {formatDateTime(minimumReleaseExpirationInput)}</span>
                    <button
                      type="button"
                      className="font-semibold text-cyan-100 underline decoration-cyan-100/35 underline-offset-4 transition hover:text-white hover:decoration-white/60"
                      onClick={() => {
                        setReleaseCreateDraft((current) => ({ ...current, expiresAt: minimumReleaseExpirationInput }));
                        touchField(setReleaseCreateTouched, "expiresAt");
                      }}
                    >
                      Use earliest allowed
                    </button>
                  </div>
                </Field>
              ) : null}
            </div>
            <button className="primary-button" type="submit" disabled={!releaseCreateValidation.isValid || saving}>
              {saving ? "Creating..." : "Create release"}
            </button>
            {releaseCreateError ? <p className="error-text">{releaseCreateError}</p> : null}
          </section>
        </form>
      ) : (
        <EmptyState title="No title selected" detail="Select a title before creating a release." />
      );
    }

    if (workspace.workflow === "releases-overview") {
      return activeRelease ? (
        <div className="space-y-6">
          <header className="surface-panel-strong rounded-[1.25rem] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">{activeTitle?.displayName ?? "Selected title"}</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Release Overview</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Update the selected release details and set whether this release should be the current release shown on the title page.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="develop-stat-card p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Release type</div>
                  <div className="mt-2 text-lg font-semibold text-white">{formatReleaseStatus(activeRelease.status)}</div>
                </div>
                <div className="develop-stat-card p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Current</div>
                  <div className="mt-2 text-lg font-semibold text-white">{activeRelease.isCurrent ? "Yes" : "No"}</div>
                </div>
                <div className="develop-stat-card p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Published</div>
                  <div className="mt-2 text-sm text-white">{formatDateTime(activeRelease.publishedAt)}</div>
                </div>
                <div className="develop-stat-card p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Expires</div>
                  <div className="mt-2 text-sm text-white">{activeRelease.expiresAt ? formatDateTime(activeRelease.expiresAt) : "No expiration"}</div>
                </div>
              </div>
            </div>
          </header>
          <section className="panel inset-panel space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Version" required error={releaseTouched.version ? releaseValidation.errors.version : undefined}>
                <input
                  value={releaseDraft.version}
                  onChange={(event) => {
                    const version = event.currentTarget.value;
                    setReleaseDraft((current) => ({ ...current, version }));
                  }}
                  onBlur={() => touchField(setReleaseTouched, "version")}
                  disabled={!releaseEditing || saving}
                />
              </Field>
              <Field label="Release type" required error={releaseTouched.status ? releaseValidation.errors.status : undefined}>
                <select
                  value={releaseDraft.status}
                  onChange={(event) => {
                    const status = event.currentTarget.value as ReleaseDraft["status"];
                    setReleaseDraft((current) => ({ ...current, status }));
                  }}
                  onBlur={() => touchField(setReleaseTouched, "status")}
                  disabled={!releaseEditing || saving}
                >
                  <option value="testing">Testing</option>
                  <option value="production">Production</option>
                </select>
              </Field>
              <Field label="Acquisition URL" error={releaseTouched.acquisitionUrl ? releaseValidation.errors.acquisitionUrl : undefined}>
                <input
                  value={releaseDraft.acquisitionUrl}
                  onChange={(event) => {
                    const acquisitionUrl = event.currentTarget.value;
                    setReleaseDraft((current) => ({ ...current, acquisitionUrl }));
                  }}
                  onBlur={() => touchField(setReleaseTouched, "acquisitionUrl")}
                  placeholder="https://..."
                  disabled={!releaseEditing || saving}
                />
              </Field>
              {releaseDraft.status === "testing" ? (
                <Field label="Expiration date" error={releaseTouched.expiresAt ? releaseValidation.errors.expiresAt : undefined}>
                  <DateTimeLocalField
                    value={releaseDraft.expiresAt}
                    min={minimumReleaseExpirationInput}
                    onChange={(expiresAt) => {
                      setReleaseDraft((current) => ({ ...current, expiresAt }));
                    }}
                    onBlur={() => touchField(setReleaseTouched, "expiresAt")}
                    disabled={!releaseEditing || saving}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>Earliest allowed: {formatDateTime(minimumReleaseExpirationInput)}</span>
                    <button
                      type="button"
                      className="font-semibold text-cyan-100 underline decoration-cyan-100/35 underline-offset-4 transition hover:text-white hover:decoration-white/60 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
                      onClick={() => {
                        setReleaseDraft((current) => ({ ...current, expiresAt: minimumReleaseExpirationInput }));
                        touchField(setReleaseTouched, "expiresAt");
                      }}
                      disabled={!releaseEditing || saving}
                    >
                      Use earliest allowed
                    </button>
                  </div>
                </Field>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <button className={releaseEditing ? "primary-button" : "secondary-button"} type="button" onClick={() => void handleSaveRelease()} disabled={saving || (releaseEditing && !releaseValidation.isValid)}>
                {saving ? "Saving..." : releaseEditing ? "Save Release" : "Edit Release"}
              </button>
              {releaseEditing ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setReleaseDraft(createReleaseDraft(activeRelease));
                    setReleaseTouched({});
                    setReleaseEditing(false);
                    setReleaseOverviewError(null);
                    setMessage(null);
                    setError(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              ) : null}
              {!activeRelease.isCurrent ? (
                <button className="secondary-button" type="button" onClick={() => void handleMakeReleaseCurrent(activeRelease.id)} disabled={saving}>
                  Make Current Release
                </button>
              ) : null}
            </div>
            {releaseOverviewError ? <p className="error-text">{releaseOverviewError}</p> : null}
          </section>
        </div>
      ) : (
        <EmptyState title="No release selected" detail="Create or select a release to manage it." />
      );
    }

    return <EmptyState title="Select a workspace section" detail="Choose a studio, title, or release section to continue." />;
  }

  if (loading) {
    return (
      <section className="app-panel p-6">
        <div className="h-8 w-52 animate-pulse rounded-full bg-white/10" />
      </section>
    );
  }

  if (!developerAccessEnabled) {
    return (
      <section className="app-workspace-shell space-y-6">
        <section className="app-workspace-content">
          <section className="app-panel p-6">
            <h1 className="app-page-title">Become a Developer</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">Enable the developer console to manage studios, titles, releases, and acquisition links.</p>
            {currentUser?.email ? <p className="mt-4 text-sm text-slate-300">Signed in as {currentUser.email}</p> : null}
            {message ? <p className="success-text mt-4">{message}</p> : null}
            {error ? <p className="error-text mt-4">{error}</p> : null}
            <button className="primary-button mt-6" type="button" onClick={() => void handleBecomeDeveloper()} disabled={saving}>
              {saving ? "Enabling..." : "Become a Developer"}
            </button>
          </section>
        </section>
      </section>
    );
  }

  const workflowButtons =
    workspace.domain === "studios"
      ? [
          { key: "studios-overview" as Workflow, label: "Overview", disabled: !activeStudio },
          { key: "studios-analytics" as Workflow, label: "Analytics", disabled: !activeStudio },
        ]
      : workspace.domain === "titles"
        ? [
            { key: "titles-overview" as Workflow, label: "Overview", disabled: !activeTitle },
            { key: "titles-analytics" as Workflow, label: "Analytics", disabled: !activeTitle },
            { key: "titles-metadata" as Workflow, label: "Metadata", disabled: !activeTitle },
            { key: "titles-reports" as Workflow, label: "Reports", disabled: !activeTitle },
          ]
        : [
            { key: "releases-overview" as Workflow, label: "Overview", disabled: !activeRelease },
          ];

  return (
    <section className="app-workspace-shell space-y-6">
      <section className="app-workspace-content">
        <section className="app-panel w-full p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button className={workspace.domain === "studios" ? "primary-button" : "secondary-button"} type="button" onClick={() => openDomain("studios")}>
                Studios
              </button>
              <button className={workspace.domain === "titles" ? "primary-button" : "secondary-button"} type="button" onClick={() => openDomain("titles")}>
                Titles
              </button>
              <button className={workspace.domain === "releases" ? "primary-button" : "secondary-button"} type="button" onClick={() => openDomain("releases")}>
                Releases
              </button>
            </div>
          </div>
        </section>

        <section className="app-workspace-grid">
          <aside className="app-panel p-4">
            <div className="space-y-5">
              <section>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Studio</div>
                <div className="mt-3 flex gap-3">
                  <select
                    value={workspace.studioId}
                    onChange={(event) => setWorkspaceState({ studioId: event.currentTarget.value, titleId: "", releaseId: "" })}
                    className="min-w-0 flex-1 rounded-[1rem] border border-white/12 bg-[#111017] px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/50"
                  >
                    {studios.length === 0 ? <option value="">No studios</option> : null}
                    {studios.map((studio) => (
                      <option key={studio.id} value={studio.id}>
                        {studio.displayName}
                      </option>
                    ))}
                  </select>
                  <button className="secondary-button !px-4" type="button" onClick={openStudioCreate} aria-label="Create studio">
                    +
                  </button>
                </div>
              </section>

              {workspace.domain !== "studios" ? (
                <section>
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Title</div>
                  <div className="mt-3 flex gap-3">
                    <select
                      value={workspace.titleId}
                      onChange={(event) => setWorkspaceState({ titleId: event.currentTarget.value, releaseId: "" })}
                      className="min-w-0 flex-1 rounded-[1rem] border border-white/12 bg-[#111017] px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/50"
                      disabled={!workspace.studioId}
                    >
                      {!workspace.studioId || titles.length === 0 ? <option value="">No titles</option> : null}
                      {titles.map((title) => (
                        <option key={title.id} value={title.id}>
                          {title.displayName}
                        </option>
                      ))}
                    </select>
                    <button className="secondary-button !px-4" type="button" onClick={openTitleCreate} aria-label="Create title" disabled={!workspace.studioId}>
                      +
                    </button>
                  </div>
                </section>
              ) : null}

              {workspace.domain === "releases" ? (
                <section>
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Release</div>
                  <div className="mt-3 flex gap-3">
                    <select
                      value={workspace.releaseId}
                      onChange={(event) => setWorkspaceState({ releaseId: event.currentTarget.value })}
                      className="min-w-0 flex-1 rounded-[1rem] border border-white/12 bg-[#111017] px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/50"
                      disabled={!workspace.titleId}
                    >
                      {!workspace.titleId || releases.length === 0 ? <option value="">No releases</option> : null}
                      {releases.map((release) => (
                        <option key={release.id} value={release.id}>
                          {release.version} ({formatReleaseStatus(release.status)})
                        </option>
                      ))}
                    </select>
                    <button className="secondary-button !px-4" type="button" onClick={openReleaseCreate} aria-label="Create release" disabled={!workspace.titleId}>
                      +
                    </button>
                  </div>
                </section>
              ) : null}

              <section>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Section</div>
                <nav className="mt-3 space-y-2">
                  {workflowButtons.map((item) => (
                    <WorkflowButton key={item.key} active={workspace.workflow === item.key} disabled={item.disabled} onClick={() => setWorkspaceState({ workflow: item.key })}>
                      {item.label}
                    </WorkflowButton>
                  ))}
                </nav>
              </section>
            </div>
          </aside>

          <section className="app-panel app-workspace-main p-6">
            {message ? <p className="success-text">{message}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
            {renderWorkspaceMain()}
          </section>
        </section>
      </section>

      {activeTitle && activationPromptReleaseId ? (
        <TitleActivationPromptModal
          title={activeTitle}
          saving={saving}
          onActivate={() => void handleActivateCurrentTitleAndRelease()}
          onSkip={() => setActivationPromptReleaseId(null)}
        />
      ) : null}
      {activeTitle && deletePasswordModalOpen ? (
        <DeleteTitlePasswordModal
          title={activeTitle}
          currentPassword={deleteCurrentPassword}
          error={deleteModalError}
          saving={saving}
          onCurrentPasswordChange={(value) => {
            setDeleteCurrentPassword(value);
            if (deleteModalError) {
              setDeleteModalError(null);
            }
          }}
          onContinue={() => void handleConfirmDeletePassword()}
          onClose={() => {
            setDeletePasswordModalOpen(false);
            setDeleteCurrentPassword("");
            setDeleteModalError(null);
          }}
        />
      ) : null}
      {activeTitle && deleteConfirmationModalOpen ? (
        <DeleteTitleConfirmationModal
          title={activeTitle}
          confirmationName={deleteConfirmationName}
          currentPassword={deleteCurrentPassword}
          error={deleteModalError}
          saving={saving}
          onConfirmationNameChange={setDeleteConfirmationName}
          onBack={() => {
            setDeleteModalError(null);
            setDeleteConfirmationModalOpen(false);
            setDeleteCurrentPassword("");
            setDeletePasswordModalOpen(true);
          }}
          onDelete={() => void handleDeleteActiveTitle()}
          onClose={() => {
            setDeleteConfirmationModalOpen(false);
            setDeleteCurrentPassword("");
            setDeleteConfirmationName("");
            setDeleteModalError(null);
          }}
        />
      ) : null}
    </section>
  );
}
