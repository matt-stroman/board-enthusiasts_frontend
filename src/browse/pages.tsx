import type { CatalogTitleResponse, CatalogTitleSummary, DeveloperStudioSummary, HomeSpotlightEntry, PlayerTitleReportSummary, StudioSummary, TitleMediaAsset } from "@board-enthusiasts/migration-contract";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import keyboardArrowLeftGlyph from "../assets/landing-glyphs/keyboard_arrow_left_24dp.svg?raw";
import keyboardArrowRightGlyph from "../assets/landing-glyphs/keyboard_arrow_right_24dp.svg?raw";
import { hasBeHomeBridge, publishBeHomeDiagnostics, publishBeHomeTitleDetailView } from "../be-home-bridge";
import {
  addStudioToPlayerFollows,
  addTitleToPlayerLibrary,
  addTitleToPlayerWishlist,
  createPlayerTitleReport,
  getCatalogTitle,
  getHomeSpotlights,
  getPlayerFollowedStudios,
  getPlayerLibrary,
  getPlayerTitleReports,
  getPlayerWishlist,
  getPublicStudio,
  listCatalogTitles,
  listManagedStudios,
  listPublicStudios,
  removeStudioFromPlayerFollows,
  removeTitleFromPlayerLibrary,
  removeTitleFromPlayerWishlist,
} from "../api";
import { hasPlatformRole, useAuth } from "../auth";
import {
  appConfig,
  CompactTitleList,
  EmptyState,
  ErrorPanel,
  Field,
  formatContentKindLabel,
  formatTitleLibraryInterestLabel,
  formatTitleViewInterestLabel,
  formatTitleWishlistInterestLabel,
  getCatalogMediaAspectRatioValue,
  formatMembershipRole,
  formatReportStatus,
  formatTimestamp,
  getStudioDetailPath,
  getTitleDetailPath,
  getTitleShareHelperPageUrl,
  getTitleSharePageUrl,
  getUserFacingErrorMessage,
  getCatalogTitleAvailabilityNote,
  getFallbackGradient,
  getHeroImageUrl,
  getPrimaryTitleShowcaseImageUrl,
  getStudioAvatarImageUrl,
  isKnownStudioLink,
  LoadingPanel,
  parseGenreTags,
  PLAYER_FILTER_MAX,
  PLAYER_FILTER_MIN,
  PlayerRangeField,
  rememberCatalogMediaLoadFailure,
  rememberCatalogMediaLoadSuccess,
  ShareTitleModal,
  StudioLinkIcon,
  trackAnalyticsEvent,
  StudioCard,
  TitleCard,
  TitleNameHeading,
  TitlePlayerActionButtons,
  TitlePublicInterestChip,
  TitleQuickViewModal,
  useCatalogMediaLoadState,
  useDocumentMetadata,
} from "../app-core";
import { useBeHomeTimedDiagnostics } from "../use-be-home-timed-diagnostics";

type TitleShowcaseSelection =
  | { kind: "showcase"; showcaseMediaId: string }
  | { kind: "hero" };

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : Boolean(typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError");
}

function doesTitleMatchRoute(
  title: CatalogTitleResponse["title"] | null | undefined,
  studioIdentifier: string,
  titleIdentifier: string
): boolean {
  if (!title) {
    return false;
  }

  return (
    title.studioSlug === studioIdentifier ||
    title.studioId === studioIdentifier
  ) && (
    title.slug === titleIdentifier ||
    title.id === titleIdentifier
  );
}

function GalleryArrowIcon({ markup }: { markup: string }) {
  return <span className="gallery-arrow-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}

function truncateUrlDisplay(value: string, maxLength = 48): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function tryGetUrlHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, typeof window !== "undefined" ? window.location.href : "https://boardenthusiasts.com").host;
  } catch {
    return null;
  }
}

function resolveInitialShowcaseSelection(title: CatalogTitleResponse["title"]): TitleShowcaseSelection {
  const firstShowcaseItem = title.showcaseMedia?.[0];
  if (firstShowcaseItem) {
    return {
      kind: "showcase",
      showcaseMediaId: firstShowcaseItem.id,
    };
  }

  return { kind: "hero" };
}

function getSpotlightImage(entry: HomeSpotlightEntry): string | null {
  return (
    getPrimaryTitleShowcaseImageUrl(entry.title) ??
    entry.title.cardImageUrl ??
    null
  );
}

function BrowseSpotlightRail() {
  const { session, currentUser } = useAuth();
  const [spotlightEntries, setSpotlightEntries] = useState<HomeSpotlightEntry[]>([]);
  const [spotlightLoading, setSpotlightLoading] = useState(true);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [rotationTick, setRotationTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSpotlights(): Promise<void> {
      try {
        const response = await getHomeSpotlights(appConfig.apiBaseUrl);
        if (!cancelled) {
          setSpotlightEntries(response.entries);
        }
      } catch {
        if (!cancelled) {
          setSpotlightEntries([]);
        }
      } finally {
        if (!cancelled) {
          setSpotlightLoading(false);
        }
      }
    }

    void loadSpotlights();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (spotlightEntries.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSpotlightIndex((current) => (current + 1) % spotlightEntries.length);
    }, 7000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [spotlightEntries.length, rotationTick]);

  useEffect(() => {
    if (spotlightEntries.length === 0) {
      setSpotlightIndex(0);
      return;
    }

    setSpotlightIndex((current) => Math.min(current, spotlightEntries.length - 1));
  }, [spotlightEntries.length]);

  function changeSpotlight(nextIndex: number): void {
    if (spotlightEntries.length === 0) {
      return;
    }

    setSpotlightIndex((nextIndex + spotlightEntries.length) % spotlightEntries.length);
    setRotationTick((current) => current + 1);
  }

  function trackSpotlightClick(entry: HomeSpotlightEntry): void {
    trackAnalyticsEvent({
      event: "homepage_spotlight_clicked",
      path: "/browse",
      authState: session && currentUser ? "authenticated" : "anonymous",
      studioSlug: entry.title.studioSlug,
      titleSlug: entry.title.slug,
      surface: "browse-spotlight",
      contentKind: entry.title.contentKind,
      metadata: {
        slotNumber: entry.slotNumber,
        titleId: entry.title.id,
        studioId: entry.title.studioId,
      },
    });
  }

  const activeSpotlight = spotlightEntries[spotlightIndex] ?? null;
  const activeSpotlightImage = activeSpotlight ? getSpotlightImage(activeSpotlight) : null;

  if (!activeSpotlight) {
    return (
      <section className="app-panel overflow-hidden p-6">
        <div className="eyebrow">{spotlightLoading ? "Loading spotlight" : "Featured spotlight"}</div>
        <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-[0.08em] text-white">Featured titles will show up here soon.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          In the meantime, you can explore the full catalog below.
        </p>
      </section>
    );
  }

  return (
    <section className="app-panel overflow-hidden p-0">
      <div className="grid gap-0 xl:grid-cols-[1.4fr_0.78fr]">
        <div
          className="relative h-[19rem] overflow-hidden bg-slate-950 sm:h-[22rem] lg:h-[26rem] xl:h-[32rem]"
          data-testid="browse-spotlight-media-frame"
        >
          {activeSpotlightImage ? (
            <img
              className="absolute inset-0 h-full w-full object-cover"
              data-testid="browse-spotlight-media-image"
              src={activeSpotlightImage}
              alt={activeSpotlight.title.displayName}
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.08),rgba(6,10,18,0.14)_48%,rgba(6,10,18,0.76))]" />
          {spotlightEntries.length > 1 ? (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-slate-950/80 p-3 text-slate-100 transition hover:border-cyan-300/45 hover:text-cyan-100"
                type="button"
                aria-label="Previous spotlight"
                onClick={() => changeSpotlight(spotlightIndex - 1)}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7" /></svg>
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-slate-950/80 p-3 text-slate-100 transition hover:border-cyan-300/45 hover:text-cyan-100"
                type="button"
                aria-label="Next spotlight"
                onClick={() => changeSpotlight(spotlightIndex + 1)}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true"><path d="m9.5 5 7 7-7 7" /></svg>
              </button>
            </>
          ) : null}
        </div>

        <div className="flex flex-col justify-between bg-[linear-gradient(160deg,rgba(15,24,42,0.96),rgba(8,12,20,0.99))] p-6">
          <div>
            <div className="eyebrow">Featured spotlight</div>
            <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-[0.08em] text-white">{activeSpotlight.title.displayName}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{activeSpotlight.title.shortDescription}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
              <span>{activeSpotlight.title.studioDisplayName}</span>
              <span className="text-slate-500">•</span>
              <span>{activeSpotlight.title.genreDisplay}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="primary-button" to={`/browse/${activeSpotlight.title.studioSlug}/${activeSpotlight.title.slug}`} onClick={() => trackSpotlightClick(activeSpotlight)}>
              Open title
            </Link>
            <Link className="secondary-button" to={`/studios/${activeSpotlight.title.studioSlug}`}>
              Open studio
            </Link>
          </div>

          {spotlightEntries.length > 1 ? (
            <div className="mt-6 flex justify-center gap-2">
              {spotlightEntries.map((entry, index) => (
                <button
                  key={entry.slotNumber}
                  className={`h-2.5 w-8 rounded-full transition ${index === spotlightIndex ? "bg-cyan-200" : "bg-white/18 hover:bg-white/35"}`}
                  type="button"
                  aria-label={`Show spotlight ${index + 1}`}
                  onClick={() => changeSpotlight(index)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function BrowsePage() {
  const { session, currentUser } = useAuth();
  const location = useLocation();
  const accessToken = session?.access_token ?? "";
  const embeddedBoardShell = new URLSearchParams(location.search).get("embed") === "board" || hasBeHomeBridge();
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
  const [followedStudioIds, setFollowedStudioIds] = useState<Set<string>>(new Set());
  const [busyTitleIds, setBusyTitleIds] = useState<Set<string>>(new Set());
  const [playerActionErrorMessage, setPlayerActionErrorMessage] = useState<string | null>(null);
  const [playerActionStatusMessage, setPlayerActionStatusMessage] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{ displayName: string; shareUrl: string; shareHelperUrl: string } | null>(null);
  const [quickViewTarget, setQuickViewTarget] = useState<{ studioIdentifier: string; titleIdentifier: string } | null>(null);
  const deferredQuery = useDeferredValue(query);
  const lastTrackedBrowseFilterKeyRef = useRef("");

  async function refreshPlayerState(): Promise<void> {
    if (!accessToken || !playerAccessEnabled) {
      setOwnedTitleIds(new Set());
      setWishlistedTitleIds(new Set());
      setFollowedStudioIds(new Set());
      return;
    }

    setPlayerStateLoading(true);
    try {
      const [libraryResponse, wishlistResponse, followedStudiosResponse] = await Promise.all([
        getPlayerLibrary(appConfig.apiBaseUrl, accessToken),
        getPlayerWishlist(appConfig.apiBaseUrl, accessToken),
        getPlayerFollowedStudios(appConfig.apiBaseUrl, accessToken),
      ]);
      setOwnedTitleIds(new Set(libraryResponse.titles.map((title) => title.id)));
      setWishlistedTitleIds(new Set(wishlistResponse.titles.map((title) => title.id)));
      setFollowedStudioIds(new Set(followedStudiosResponse.studios.map((followedStudio) => followedStudio.id)));
      setPlayerActionErrorMessage(null);
    } catch (nextError) {
      setPlayerActionErrorMessage(getUserFacingErrorMessage(nextError, "We couldn't refresh your player details right now. Please try again."));
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
          setError(getUserFacingErrorMessage(nextError, "We couldn't load the browse page right now. Please try again."));
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

  useEffect(() => {
    if (loading || error) {
      return;
    }

    const hasNonDefaultFilters =
      deferredQuery.trim().length > 0 ||
      contentKind !== "all" ||
      sort !== "title-asc" ||
      selectedStudios.length > 0 ||
      selectedGenres.length > 0 ||
      minPlayersFilter !== PLAYER_FILTER_MIN ||
      maxPlayersFilter !== PLAYER_FILTER_MAX;

    if (!hasNonDefaultFilters) {
      lastTrackedBrowseFilterKeyRef.current = "";
      return;
    }

    const analyticsKey = JSON.stringify({
      path: `${location.pathname}${location.search}`,
      query: deferredQuery.trim().toLowerCase(),
      contentKind,
      sort,
      selectedStudios,
      selectedGenres,
      minPlayersFilter,
      maxPlayersFilter,
      resultCount: filteredTitles.length,
    });

    if (lastTrackedBrowseFilterKeyRef.current === analyticsKey) {
      return;
    }

    lastTrackedBrowseFilterKeyRef.current = analyticsKey;
    const timeoutId = window.setTimeout(() => {
      trackAnalyticsEvent({
        event: "browse_filters_applied",
        path: `${location.pathname}${location.search}`,
        authState: session && currentUser ? "authenticated" : "anonymous",
        contentKind: contentKind === "all" ? null : (contentKind as "game" | "app"),
        metadata: {
          query: deferredQuery.trim() || null,
          sort,
          selectedStudios,
          selectedGenres,
          minPlayers: minPlayersFilter,
          maxPlayers: maxPlayersFilter,
          resultCount: filteredTitles.length,
        },
        value1: filteredTitles.length,
      });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    contentKind,
    currentUser,
    deferredQuery,
    error,
    filteredTitles.length,
    loading,
    location.pathname,
    location.search,
    maxPlayersFilter,
    minPlayersFilter,
    selectedGenres,
    selectedStudios,
    session,
    sort,
  ]);

  const normalizedResultsPerPage = resultsPerPage === "all" ? 0 : Number(resultsPerPage);
  const totalPages = normalizedResultsPerPage <= 0 ? 1 : Math.max(1, Math.ceil(filteredTitles.length / normalizedResultsPerPage));
  const pagedTitles =
    normalizedResultsPerPage <= 0 ? filteredTitles : filteredTitles.slice((currentPage - 1) * normalizedResultsPerPage, currentPage * normalizedResultsPerPage);
  const visibleResultStart =
    filteredTitles.length === 0 || pagedTitles.length === 0 ? 0 : normalizedResultsPerPage <= 0 ? 1 : (currentPage - 1) * normalizedResultsPerPage + 1;
  const visibleResultEnd = visibleResultStart === 0 ? 0 : visibleResultStart + pagedTitles.length - 1;

  useEffect(() => {
    if (!embeddedBoardShell || quickViewTarget) {
      return;
    }

    publishBeHomeDiagnostics({
      surface: "browse",
      route: `${location.pathname}${location.search}`,
      searchResultCount: pagedTitles.length,
      totalCatalogCount: filteredTitles.length,
      currentPage,
      searchQueryLength: deferredQuery.trim().length,
      selectedStudiosCount: selectedStudios.length,
      selectedGenresCount: selectedGenres.length,
    });
  }, [
    currentPage,
    deferredQuery,
    embeddedBoardShell,
    filteredTitles.length,
    location.pathname,
    location.search,
    pagedTitles.length,
    quickViewTarget,
    selectedGenres.length,
    selectedStudios.length,
  ]);

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
      setPlayerActionErrorMessage(getUserFacingErrorMessage(nextError, "We couldn't update your library right now. Please try again."));
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
      setPlayerActionErrorMessage(getUserFacingErrorMessage(nextError, "We couldn't update your wishlist right now. Please try again."));
    } finally {
      markBusy(titleId, false);
    }
  }

  return (
    <section className="space-y-8">
      {loading ? <LoadingPanel title="Loading browse surface..." /> : null}
      {error ? <ErrorPanel detail={error} /> : null}
      {!loading && !error ? (
        <>
          <BrowseSpotlightRail />

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
                      onOpenQuickView={(selectedTitle) => setQuickViewTarget({ studioIdentifier: selectedTitle.studioId, titleIdentifier: selectedTitle.id })}
                      playerActions={{
                        visible: playerAccessEnabled,
                        isBusy: playerStateLoading || busyTitleIds.has(title.id),
                        isWishlisted: wishlistedTitleIds.has(title.id),
                        isOwned: ownedTitleIds.has(title.id),
                        onToggleWishlist: () => void toggleWishlist(title.id, title.displayName),
                        onToggleOwned: () => void toggleOwned(title.id, title.displayName),
                        onShare: () => setShareTarget({
                          displayName: title.displayName,
                          shareUrl: getTitleSharePageUrl(title.studioId, title.id),
                          shareHelperUrl: getTitleShareHelperPageUrl(title.studioId, title.id),
                        }),
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
              studioIdentifier={quickViewTarget.studioIdentifier}
              titleIdentifier={quickViewTarget.titleIdentifier}
              onClose={() => setQuickViewTarget(null)}
            />
          ) : null}
          {shareTarget ? (
            <ShareTitleModal
              titleDisplayName={shareTarget.displayName}
              shareUrl={shareTarget.shareUrl}
              shareHelperUrl={shareTarget.shareHelperUrl}
              onClose={() => setShareTarget(null)}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function StudiosPage() {
  useDocumentMetadata({
    title: "Studios | Board Enthusiasts",
    description: "Browse the indie studios publishing through Board Enthusiasts.",
    canonicalUrl: `${window.location.origin}/studios`,
  });
  const [studios, setStudios] = useState<StudioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await listPublicStudios(appConfig.apiBaseUrl);
        if (!cancelled) {
          setStudios(response.studios);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(getUserFacingErrorMessage(nextError, "We couldn't load studios right now. Please try again."));
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

  return (
    <section className="space-y-8">
      <section className="space-y-2">
        <h1 className="font-display text-3xl font-bold uppercase tracking-[0.08em] text-white">Studios</h1>
        <p className="text-sm leading-7 text-slate-300">Browse the indie studios building games and apps for Board.</p>
      </section>
      {loading ? <LoadingPanel title="Loading studios..." /> : null}
      {error ? <ErrorPanel detail={error} /> : null}
      {!loading && !error ? (
        studios.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {studios
              .slice()
              .sort((left, right) => left.displayName.localeCompare(right.displayName))
              .map((studio) => (
                <StudioCard key={studio.id} studio={studio} />
              ))}
          </div>
        ) : (
          <EmptyState title="No studios yet" detail="Studios will appear here as soon as they are added to the index." />
        )
      ) : null}
    </section>
  );
}


export function StudioDetailPage() {
  const { session, currentUser } = useAuth();
  const params = useParams<{ studioSlug: string }>();
  const studioIdentifier = params.studioSlug ?? "";
  const navigate = useNavigate();
  const location = useLocation();
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
  const [followedStudioIds, setFollowedStudioIds] = useState<Set<string>>(new Set());
  const [busyTitleIds, setBusyTitleIds] = useState<Set<string>>(new Set());
  const [playerActionErrorMessage, setPlayerActionErrorMessage] = useState<string | null>(null);
  const [playerActionStatusMessage, setPlayerActionStatusMessage] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{ displayName: string; shareUrl: string; shareHelperUrl: string } | null>(null);
  const [quickViewTarget, setQuickViewTarget] = useState<{ studioIdentifier: string; titleIdentifier: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "about">("catalog");
  const [studioAvatarFailed, setStudioAvatarFailed] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const studioAvatarUrl = studio && !studioAvatarFailed ? getStudioAvatarImageUrl(studio) : null;
  const studioBannerLoadState = useCatalogMediaLoadState(studio?.bannerUrl);

  async function refreshPlayerState(): Promise<void> {
    if (!accessToken || !playerAccessEnabled) {
      setOwnedTitleIds(new Set());
      setWishlistedTitleIds(new Set());
      setFollowedStudioIds(new Set());
      return;
    }

    setPlayerStateLoading(true);
    try {
      const [libraryResponse, wishlistResponse, followedStudiosResponse] = await Promise.all([
        getPlayerLibrary(appConfig.apiBaseUrl, accessToken),
        getPlayerWishlist(appConfig.apiBaseUrl, accessToken),
        getPlayerFollowedStudios(appConfig.apiBaseUrl, accessToken),
      ]);
      setOwnedTitleIds(new Set(libraryResponse.titles.map((title) => title.id)));
      setWishlistedTitleIds(new Set(wishlistResponse.titles.map((title) => title.id)));
      setFollowedStudioIds(new Set(followedStudiosResponse.studios.map((followedStudio) => followedStudio.id)));
      setPlayerActionErrorMessage(null);
    } catch (nextError) {
      setPlayerActionErrorMessage(getUserFacingErrorMessage(nextError, "We couldn't refresh your player details right now. Please try again."));
    } finally {
      setPlayerStateLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const studioResponse = await getPublicStudio(appConfig.apiBaseUrl, studioIdentifier);
        const catalogResponse = await listCatalogTitles(appConfig.apiBaseUrl, { studioSlug: studioResponse.studio.slug });
        if (cancelled) {
          return;
        }

        setStudio(studioResponse.studio);
        setTitles(catalogResponse.titles);
        if (studioIdentifier !== studioResponse.studio.slug) {
          navigate({ pathname: getStudioDetailPath(studioResponse.studio.slug), search: location.search }, { replace: true });
        }
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(getUserFacingErrorMessage(nextError, "We couldn't load that studio right now. Please try again."));
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
  }, [location.search, navigate, studioIdentifier]);

  useEffect(() => {
    void refreshPlayerState();
  }, [accessToken, playerAccessEnabled]);

  useEffect(() => {
    setActiveTab("catalog");
  }, [studioIdentifier]);

  useEffect(() => {
    setStudioAvatarFailed(false);
  }, [studio?.id]);

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
  }, [contentKind, deferredQuery, resultsPerPage, selectedGenres, sort, studioIdentifier]);

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

  async function toggleStudioFollow(): Promise<void> {
    if (!playerAccessEnabled || !studio) {
      return;
    }

    const nextIncluded = !followedStudioIds.has(studio.id);
    setPlayerStateLoading(true);
    setPlayerActionErrorMessage(null);
    setPlayerActionStatusMessage(null);
    try {
      if (nextIncluded) {
        await addStudioToPlayerFollows(appConfig.apiBaseUrl, accessToken, studio.id);
        setFollowedStudioIds((current) => new Set(current).add(studio.id));
        setStudio((current) => current ? { ...current, followerCount: current.followerCount + 1 } : current);
        setPlayerActionStatusMessage(`You are now following ${studio.displayName}.`);
        trackAnalyticsEvent({
          event: "studio_followed",
          authState: "authenticated",
          studioSlug: studio.slug,
          surface: "studio-detail",
          metadata: {
            studioId: studio.id,
          },
        });
      } else {
        await removeStudioFromPlayerFollows(appConfig.apiBaseUrl, accessToken, studio.id);
        setFollowedStudioIds((current) => {
          const next = new Set(current);
          next.delete(studio.id);
          return next;
        });
        setStudio((current) => current ? { ...current, followerCount: Math.max(0, current.followerCount - 1) } : current);
        setPlayerActionStatusMessage(`You are no longer following ${studio.displayName}.`);
      }
    } catch (nextError) {
      setPlayerActionErrorMessage(getUserFacingErrorMessage(nextError, "We couldn't update your followed studios right now. Please try again."));
    } finally {
      setPlayerStateLoading(false);
    }
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
      setPlayerActionErrorMessage(getUserFacingErrorMessage(nextError, "We couldn't update your library right now. Please try again."));
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
      setPlayerActionErrorMessage(getUserFacingErrorMessage(nextError, "We couldn't update your wishlist right now. Please try again."));
    } finally {
      markBusy(titleId, false);
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

  const prominentStudioLinks = studio.links.filter((link) => isKnownStudioLink(link.url));
  const additionalStudioLinks = studio.links.filter((link) => !isKnownStudioLink(link.url));
  const studioAvatarAspectRatio = getCatalogMediaAspectRatioValue(undefined, "studio_avatar");
  const studioFollowed = followedStudioIds.has(studio.id);
  const studioBannerStyle = studioBannerLoadState === "loaded" && studio.bannerUrl
    ? { backgroundImage: `url('${studio.bannerUrl}')` }
    : { backgroundImage: getFallbackGradient(studio.description) };

  return (
    <section className="space-y-8">
      <section className="app-panel relative overflow-hidden p-0">
        <div className="min-h-[13rem] bg-cover bg-center" style={studioBannerStyle}>
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
                {prominentStudioLinks.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {prominentStudioLinks.map((link) => (
                      <a key={link.id} className="app-icon-button" href={link.url} target="_blank" rel="noreferrer" title={link.label} aria-label={link.label}>
                        <StudioLinkIcon url={link.url} />
                      </a>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  {playerAccessEnabled ? (
                    <button className={studioFollowed ? "secondary-button" : "primary-button"} type="button" onClick={() => void toggleStudioFollow()} disabled={playerStateLoading}>
                      {studioFollowed ? "Following" : "Follow"}
                    </button>
                  ) : null}
                  <div className="rounded-full border border-white/15 bg-slate-950/45 px-4 py-2 text-sm font-semibold text-slate-100">
                    {studio.followerCount} follower{studio.followerCount === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              {studioAvatarUrl ? (
                <div className="surface-panel-strong w-20 shrink-0 overflow-hidden rounded-[1.5rem] shadow-[0_12px_32px_rgba(0,0,0,0.35)] md:w-24" style={{ aspectRatio: studioAvatarAspectRatio }}>
                  <img
                    className="h-full w-full object-cover"
                    src={studioAvatarUrl}
                    alt={`${studio.displayName} avatar`}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => rememberCatalogMediaLoadSuccess(studioAvatarUrl)}
                    onError={() => {
                      rememberCatalogMediaLoadFailure(studioAvatarUrl);
                      setStudioAvatarFailed(true);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel p-3">
        <div className="flex flex-wrap gap-3">
          <button className={activeTab === "catalog" ? "primary-button" : "secondary-button"} type="button" onClick={() => setActiveTab("catalog")}>
            Catalog
          </button>
          <button className={activeTab === "about" ? "primary-button" : "secondary-button"} type="button" onClick={() => setActiveTab("about")}>
            About
          </button>
        </div>
      </section>

      {playerActionStatusMessage ? (
        <div className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{playerActionStatusMessage}</div>
      ) : null}

      {playerActionErrorMessage ? (
        <div className="rounded-[1rem] border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{playerActionErrorMessage}</div>
      ) : null}

      {activeTab === "catalog" ? (
        <>
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
                      onOpenQuickView={(selectedTitle) => setQuickViewTarget({ studioIdentifier: selectedTitle.studioId, titleIdentifier: selectedTitle.id })}
                      playerActions={{
                        visible: playerAccessEnabled,
                        isBusy: playerStateLoading || busyTitleIds.has(title.id),
                        isWishlisted: wishlistedTitleIds.has(title.id),
                        isOwned: ownedTitleIds.has(title.id),
                        onToggleWishlist: () => void toggleWishlist(title.id, title.displayName),
                        onToggleOwned: () => void toggleOwned(title.id, title.displayName),
                        onShare: () => setShareTarget({
                          displayName: title.displayName,
                          shareUrl: getTitleSharePageUrl(title.studioId, title.id),
                          shareHelperUrl: getTitleShareHelperPageUrl(title.studioId, title.id),
                        }),
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
        </>
      ) : (
        <section className="app-panel p-6">
          <div className="eyebrow">About the studio</div>
          {studio.description ? <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-slate-300">{studio.description}</p> : <p className="mt-4 text-base leading-8 text-slate-300">No studio description has been added yet.</p>}
          {additionalStudioLinks.length > 0 ? (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Additional links</div>
              <div className="mt-4 flex flex-wrap gap-3">
                {additionalStudioLinks.map((link) => (
                  <a key={link.id} className="secondary-button" href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {quickViewTarget ? (
        <TitleQuickViewModal
          studioIdentifier={quickViewTarget.studioIdentifier}
          titleIdentifier={quickViewTarget.titleIdentifier}
          onClose={() => setQuickViewTarget(null)}
        />
      ) : null}
      {shareTarget ? (
        <ShareTitleModal
          titleDisplayName={shareTarget.displayName}
          shareUrl={shareTarget.shareUrl}
          shareHelperUrl={shareTarget.shareHelperUrl}
          onClose={() => setShareTarget(null)}
        />
      ) : null}
    </section>
  );
}


export function TitleDetailPage() {
  const { session, currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams<{ studioSlug: string; titleSlug: string }>();
  const studioIdentifier = params.studioSlug ?? "";
  const titleIdentifier = params.titleSlug ?? "";
  const preloadedTitle = useMemo(() => {
    const nextTitle = (location.state as { preloadedTitle?: CatalogTitleResponse["title"] | null } | null)?.preloadedTitle ?? null;
    return doesTitleMatchRoute(nextTitle, studioIdentifier, titleIdentifier) ? nextTitle : null;
  }, [location.state, studioIdentifier, titleIdentifier]);
  const [title, setTitle] = useState<CatalogTitleResponse["title"] | null>(preloadedTitle);
  const [loading, setLoading] = useState(!preloadedTitle);
  const [error, setError] = useState<string | null>(null);
  const [playerStateLoading, setPlayerStateLoading] = useState(false);
  const [playerStateError, setPlayerStateError] = useState<string | null>(null);
  const [titleInLibrary, setTitleInLibrary] = useState(false);
  const [titleInWishlist, setTitleInWishlist] = useState(false);
  const [existingReport, setExistingReport] = useState<PlayerTitleReportSummary | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const autoOpenedShareRef = useRef(false);
  const [selectedShowcase, setSelectedShowcase] = useState<TitleShowcaseSelection>({ kind: "hero" });
  const [managedStudioIds, setManagedStudioIds] = useState<Set<string>>(new Set());
  const [failedPreviewImageUrls, setFailedPreviewImageUrls] = useState<Set<string>>(new Set());
  const thumbnailRailRef = useRef<HTMLDivElement | null>(null);
  const accessToken = session?.access_token ?? "";
  const playerAccessEnabled = currentUser ? hasPlatformRole(currentUser.roles, "player") : false;
  const moderatorAccessEnabled = currentUser ? hasPlatformRole(currentUser.roles, "moderator") : false;
  const embeddedBoardShell = searchParams.get("embed") === "board" || hasBeHomeBridge();

  useEffect(() => {
    setTitle(preloadedTitle);
    setLoading(!preloadedTitle);
    setError(null);
  }, [preloadedTitle]);

  useEffect(() => {
    if (!embeddedBoardShell) {
      return;
    }

    publishBeHomeDiagnostics({
      surface: "title-detail",
      route: `${location.pathname}${location.search}`,
      diagnosticsReason: "surface-navigation-start",
      studioSlug: studioIdentifier || null,
      titleSlug: titleIdentifier || null,
    });
  }, [embeddedBoardShell, location.pathname, location.search, studioIdentifier, titleIdentifier]);

  async function refreshPlayerState(nextTitleId: string, signal?: AbortSignal): Promise<void> {
    if (!accessToken || !playerAccessEnabled) {
      setTitleInLibrary(false);
      setTitleInWishlist(false);
      setExistingReport(null);
      setPlayerStateError(null);
      setPlayerStateLoading(false);
      return;
    }

    setPlayerStateLoading(true);
    try {
      const [libraryResponse, wishlistResponse, reportsResponse] = await Promise.all([
        getPlayerLibrary(appConfig.apiBaseUrl, accessToken, signal),
        getPlayerWishlist(appConfig.apiBaseUrl, accessToken, signal),
        getPlayerTitleReports(appConfig.apiBaseUrl, accessToken, signal),
      ]);
      setTitleInLibrary(libraryResponse.titles.some((candidate) => candidate.id === nextTitleId));
      setTitleInWishlist(wishlistResponse.titles.some((candidate) => candidate.id === nextTitleId));
      setExistingReport(reportsResponse.reports.find((candidate) => candidate.titleId === nextTitleId) ?? null);
      setPlayerStateError(null);
    } catch (nextError) {
      if (isAbortError(nextError)) {
        return;
      }

      setPlayerStateError(getUserFacingErrorMessage(nextError, "We couldn't refresh your player details right now. Please try again."));
    } finally {
      if (!signal?.aborted) {
        setPlayerStateLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const refreshDelayMs = preloadedTitle ? 350 : 0;

    async function load(): Promise<void> {
      try {
        if (!preloadedTitle) {
          setLoading(true);
        }

        const response = await getCatalogTitle(appConfig.apiBaseUrl, studioIdentifier, titleIdentifier, accessToken || null, controller.signal);
        setTitle(response.title);
        if (studioIdentifier !== response.title.studioSlug || titleIdentifier !== response.title.slug) {
          navigate({ pathname: getTitleDetailPath(response.title.studioSlug, response.title.slug), search: location.search }, { replace: true });
        }
        setError(null);
      } catch (nextError) {
        if (isAbortError(nextError)) {
          return;
        }

        setError(getUserFacingErrorMessage(nextError, "We couldn't load that title right now. Please try again."));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    const timeoutHandle = window.setTimeout(() => {
      void load();
    }, refreshDelayMs);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutHandle);
    };
  }, [accessToken, location.search, navigate, preloadedTitle, studioIdentifier, titleIdentifier]);

  useEffect(() => {
    const nextTitleId = title?.id ?? "";
    if (!nextTitleId) {
      setTitleInLibrary(false);
      setTitleInWishlist(false);
      setExistingReport(null);
      setPlayerStateError(null);
      setPlayerStateLoading(false);
      return;
    }

    if (!accessToken || !playerAccessEnabled) {
      setTitleInLibrary(false);
      setTitleInWishlist(false);
      setExistingReport(null);
      setPlayerStateError(null);
      setPlayerStateLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => {
      void refreshPlayerState(nextTitleId, controller.signal);
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutHandle);
    };
  }, [accessToken, playerAccessEnabled, title?.id]);

  useEffect(() => {
    if (!title || embeddedBoardShell) {
      return;
    }

    setSelectedShowcase(resolveInitialShowcaseSelection(title));
    setFailedPreviewImageUrls(new Set());
  }, [title]);

  useEffect(() => {
    if (!title || searchParams.get("share") !== "1" || autoOpenedShareRef.current) {
      return;
    }

    autoOpenedShareRef.current = true;
    setShareModalOpen(true);

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("share");
    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams, setSearchParams, title]);

  useEffect(() => {
    const rail = thumbnailRailRef.current;
    if (!rail) {
      return;
    }

    const activeThumbnail = rail.querySelector<HTMLButtonElement>("[data-showcase-selected='true']");
    if (!activeThumbnail) {
      return;
    }

    const targetLeft = activeThumbnail.offsetLeft - Math.max(0, (rail.clientWidth - activeThumbnail.offsetWidth) / 2);
    const boundedLeft = Math.max(0, Math.min(targetLeft, rail.scrollWidth - rail.clientWidth));
    if (typeof rail.scrollTo === "function") {
      rail.scrollTo({
        left: boundedLeft,
        behavior: "smooth",
      });
      return;
    }

    rail.scrollLeft = boundedLeft;
  }, [selectedShowcase]);

  useEffect(() => {
    if (!title || embeddedBoardShell) {
      return;
    }

    trackAnalyticsEvent({
      event: "title_detail_viewed",
      path: `${location.pathname}${location.search}`,
      authState: session && currentUser ? "authenticated" : "anonymous",
      studioSlug: title.studioSlug,
      titleSlug: title.slug,
      surface: "title-detail",
      contentKind: title.contentKind,
      metadata: {
        titleId: title.id,
        studioId: title.studioId,
      },
    });
  }, [currentUser, embeddedBoardShell, location.pathname, location.search, session, title]);

  useEffect(() => {
    if (!title || !embeddedBoardShell || !hasBeHomeBridge()) {
      return;
    }

    publishBeHomeTitleDetailView({
      titleId: title.id,
      studioSlug: title.studioSlug,
      titleSlug: title.slug,
      route: `${location.pathname}${location.search}`,
      surface: "title-detail",
    });
  }, [embeddedBoardShell, location.pathname, location.search, title]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => {
      void loadManagedStudios();
    }, 500);

    async function loadManagedStudios(): Promise<void> {
      if (!accessToken || !currentUser || !hasPlatformRole(currentUser.roles, "developer")) {
        setManagedStudioIds(new Set());
        return;
      }

      try {
        const response = await listManagedStudios(appConfig.apiBaseUrl, accessToken, controller.signal);
        setManagedStudioIds(new Set(response.studios.map((studio) => studio.id)));
      } catch (nextError) {
        if (!isAbortError(nextError)) {
          setManagedStudioIds(new Set());
        }
      }
    }

    return () => {
      controller.abort();
      window.clearTimeout(timeoutHandle);
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
      setPlayerStateError(getUserFacingErrorMessage(nextError, "We couldn't update your library right now. Please try again."));
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
        trackAnalyticsEvent({
          event: "title_wishlisted",
          path: `${location.pathname}${location.search}`,
          authState: "authenticated",
          studioSlug: title.studioSlug,
          titleSlug: title.slug,
          surface: "title-detail",
          contentKind: title.contentKind,
          metadata: {
            titleId: title.id,
            studioId: title.studioId,
          },
        });
      } else {
        await removeTitleFromPlayerWishlist(appConfig.apiBaseUrl, accessToken, title.id);
      }

      await refreshPlayerState(title.id);
      setActionMessage(nextIncluded ? "Added to your wishlist." : "Removed from your wishlist.");
      setPlayerStateError(null);
    } catch (nextError) {
      setPlayerStateError(getUserFacingErrorMessage(nextError, "We couldn't update your wishlist right now. Please try again."));
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
      setPlayerStateError(getUserFacingErrorMessage(nextError, "We couldn't submit that report right now. Please try again."));
      setActionMessage(null);
    } finally {
      setActionLoading(false);
    }
  }

  const heroImageUrl = title ? getPrimaryTitleShowcaseImageUrl(title) : null;
  const showcaseMedia = title?.showcaseMedia ?? [];
  const selectedShowcaseMedia = title && selectedShowcase.kind === "showcase"
    ? showcaseMedia.find((candidate) => candidate.id === selectedShowcase.showcaseMediaId) ?? null
    : null;
  const selectedPreviewImageUrl =
    selectedShowcaseMedia?.imageUrl ??
    (selectedShowcase.kind === "hero" ? heroImageUrl : null) ??
    title?.cardImageUrl ??
    null;
  const safeSelectedPreviewImageUrl = selectedPreviewImageUrl && !failedPreviewImageUrls.has(selectedPreviewImageUrl)
    ? selectedPreviewImageUrl
    : null;
  const heroImageLoadState = useCatalogMediaLoadState(heroImageUrl);
  const selectedPreviewImageLoadState = useCatalogMediaLoadState(safeSelectedPreviewImageUrl);

  useBeHomeTimedDiagnostics({
    enabled: embeddedBoardShell,
    timelineKey: title ? `title-detail|${location.pathname}${location.search}|${title.id}|${selectedShowcase.kind === "showcase" ? selectedShowcase.showcaseMediaId : "hero"}` : "",
    snapshot: title ? {
      surface: "title-detail",
      route: `${location.pathname}${location.search}`,
      titleId: title.id,
      studioId: title.studioId,
      studioSlug: title.studioSlug,
      titleSlug: title.slug,
      titleDisplayName: title.displayName,
      studioDisplayName: title.studioDisplayName,
      contentKind: title.contentKind,
      selectedPreviewKind: selectedShowcaseMedia?.kind ?? selectedShowcase.kind,
      selectedPreviewHost: tryGetUrlHost(selectedShowcaseMedia?.videoUrl ?? selectedPreviewImageUrl),
      heroImageHost: tryGetUrlHost(heroImageUrl),
      cardImageHost: tryGetUrlHost(title.cardImageUrl),
      acquisitionHost: tryGetUrlHost(title.acquisition?.url ?? title.acquisitionUrl),
      showcaseMediaCount: showcaseMedia.length,
      showcaseImageCount: showcaseMedia.filter((candidate) => candidate.kind !== "external_video").length,
      showcaseVideoCount: showcaseMedia.filter((candidate) => candidate.kind === "external_video").length,
      heroImageLoadState,
      selectedPreviewImageLoadState,
      hasHeroImage: Boolean(heroImageUrl),
      hasCardImage: Boolean(title.cardImageUrl),
      hasLogoImage: Boolean(title.logoImageUrl),
      hasAcquisitionUrl: Boolean(title.acquisition?.url ?? title.acquisitionUrl),
    } : null,
  });

  if (loading) {
    return <LoadingPanel title="Loading title..." />;
  }

  if (error) {
    return <ErrorPanel detail={error} />;
  }

  if (!title) {
    return <ErrorPanel title="Title not found" detail="The requested title could not be loaded." />;
  }

  const showcaseThumbnailAspectRatio = getCatalogMediaAspectRatioValue(undefined, "title_showcase");
  const canViewMetadata = moderatorAccessEnabled || managedStudioIds.has(title.studioId);
  const canViewCurrentReleasePanel = managedStudioIds.has(title.studioId);
  const metadataMediaAssets = title.mediaAssets.map((asset) => formatMembershipRole(asset.mediaRole)).join(", ");
  const availabilityNote = getCatalogTitleAvailabilityNote(title);
  const isComingSoon = availabilityNote === "Coming soon";
  const titleViewCount = title.viewCount ?? 0;
  const titleWishlistCount = title.wishlistCount ?? 0;
  const titleLibraryCount = title.libraryCount ?? 0;
  const publicInterestChips = [
    titleViewCount > 0
      ? { kind: "views" as const, count: titleViewCount, label: formatTitleViewInterestLabel(titleViewCount) }
      : null,
    titleWishlistCount > 0
      ? { kind: "wishlist" as const, count: titleWishlistCount, label: formatTitleWishlistInterestLabel(titleWishlistCount) }
      : null,
    titleLibraryCount > 0
      ? { kind: "library" as const, count: titleLibraryCount, label: formatTitleLibraryInterestLabel(titleLibraryCount) }
      : null,
  ].filter((chip): chip is { kind: "views" | "wishlist" | "library"; count: number; label: string } => chip !== null);
  const showOwnedAndReportActions = !isComingSoon;
  const showReportingSurface = !isComingSoon;
  const selectedPreviewIsVideo = selectedShowcaseMedia?.kind === "external_video" && Boolean(selectedShowcaseMedia?.videoUrl);
  const spotlightThumbnails = showcaseMedia;
  const showPrimaryFallbackThumbnail = showcaseMedia.length === 0 && Boolean(heroImageUrl);
  const galleryThumbnailCount = (showPrimaryFallbackThumbnail ? 1 : 0) + spotlightThumbnails.length;
  const shareUrl = getTitleSharePageUrl(title.studioId, title.id);
  const shareHelperUrl = getTitleShareHelperPageUrl(title.studioId, title.id);

  function scrollThumbnailRail(direction: -1 | 1): void {
    const rail = thumbnailRailRef.current;
    if (!rail) {
      return;
    }

    const scrollAmount = Math.max(rail.clientWidth * 0.72, 220);
    if (typeof rail.scrollBy === "function") {
      rail.scrollBy({ left: direction * scrollAmount, behavior: "smooth" });
      return;
    }

    rail.scrollLeft += direction * scrollAmount;
  }

  function rememberFailedPreviewImage(url: string | null | undefined): void {
    if (!url) {
      return;
    }

    setFailedPreviewImageUrls((current) => {
      if (current.has(url)) {
        return current;
      }

      const next = new Set(current);
      next.add(url);
      return next;
    });
  }

  return (
    <section className="space-y-8">
      <section className="app-panel overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.28fr)_minmax(22rem,0.72fr)]">
          <div className="min-w-0 bg-[linear-gradient(160deg,rgba(14,25,45,0.96),rgba(7,11,19,0.98))] p-4 md:p-5">
            <div
              className="relative h-[18rem] overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-950/80 sm:h-[20rem] md:h-[23rem] lg:h-[26rem] xl:h-[32rem]"
              style={safeSelectedPreviewImageUrl ? undefined : { backgroundImage: getFallbackGradient(title.genreDisplay) }}
            >
              {safeSelectedPreviewImageUrl ? (
                <img
                  className="h-full w-full bg-slate-950/45 object-contain xl:object-cover"
                  src={safeSelectedPreviewImageUrl}
                  alt={selectedShowcaseMedia?.altText ?? `${title.displayName} preview`}
                  decoding="async"
                  fetchPriority="high"
                  onLoad={() => rememberCatalogMediaLoadSuccess(safeSelectedPreviewImageUrl)}
                  onError={() => {
                    rememberCatalogMediaLoadFailure(safeSelectedPreviewImageUrl);
                    rememberFailedPreviewImage(safeSelectedPreviewImageUrl);
                  }}
                />
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,15,0.06),rgba(5,8,15,0.08)_55%,rgba(5,8,15,0.62))]" />
              {isComingSoon ? (
                <span className="coming-soon-chip-overlay absolute right-4 top-4">
                  Coming Soon
                </span>
              ) : null}
              {selectedPreviewIsVideo && selectedShowcaseMedia?.videoUrl ? (
                <a
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/35 bg-slate-950/82 px-4 py-2 text-xs font-semibold text-cyan-50 shadow-[0_12px_30px_rgba(0,0,0,0.32)] backdrop-blur-sm transition hover:border-cyan-200/55 hover:text-white"
                  href={selectedShowcaseMedia.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {truncateUrlDisplay(selectedShowcaseMedia.videoUrl)}
                </a>
              ) : null}
            </div>
            {(spotlightThumbnails.length > 0 || heroImageUrl) ? (
              <div className="relative mt-4">
                {galleryThumbnailCount > 1 ? (
                  <>
                    <button
                      className="absolute bottom-0 left-0 top-0 z-10 hidden w-10 items-center justify-center rounded-[1rem] border border-white/12 bg-slate-950/82 text-white shadow-[0_12px_24px_rgba(0,0,0,0.26)] transition hover:border-cyan-300/55 hover:text-cyan-100 sm:flex sm:w-11"
                      type="button"
                      aria-label="Scroll preview thumbnails left"
                      onClick={() => scrollThumbnailRail(-1)}
                    >
                      <GalleryArrowIcon markup={keyboardArrowLeftGlyph} />
                    </button>
                    <button
                      className="absolute bottom-0 right-0 top-0 z-10 hidden w-10 items-center justify-center rounded-[1rem] border border-white/12 bg-slate-950/82 text-white shadow-[0_12px_24px_rgba(0,0,0,0.26)] transition hover:border-cyan-300/55 hover:text-cyan-100 sm:flex sm:w-11"
                      type="button"
                      aria-label="Scroll preview thumbnails right"
                      onClick={() => scrollThumbnailRail(1)}
                    >
                      <GalleryArrowIcon markup={keyboardArrowRightGlyph} />
                    </button>
                  </>
                ) : null}
                <div
                  ref={thumbnailRailRef}
                  className="scrollbar-hidden flex gap-3 overflow-x-auto overflow-y-hidden pb-1 sm:px-14"
                  style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x", overscrollBehaviorX: "contain", scrollSnapType: "x mandatory" }}
                >
                  {showPrimaryFallbackThumbnail && heroImageUrl ? (
                    <button
                      className={`relative w-32 shrink-0 snap-start overflow-hidden rounded-[1rem] border ${selectedShowcase.kind === "hero" ? "border-cyan-300/65 shadow-[0_0_0_1px_rgba(103,232,249,0.25)]" : "border-white/10"} bg-slate-950/80 transition hover:border-cyan-300/45 sm:w-36`}
                      type="button"
                      aria-label="Show hero preview"
                      data-showcase-selected={selectedShowcase.kind === "hero"}
                      style={{ aspectRatio: showcaseThumbnailAspectRatio }}
                      onClick={() => setSelectedShowcase({ kind: "hero" })}
                    >
                      <img
                        className="h-full w-full object-cover"
                        src={heroImageUrl}
                        alt={`${title.displayName} hero`}
                        loading="lazy"
                        decoding="async"
                        onLoad={() => rememberCatalogMediaLoadSuccess(heroImageUrl)}
                        onError={() => rememberCatalogMediaLoadFailure(heroImageUrl)}
                      />
                    </button>
                  ) : null}
                  {spotlightThumbnails.map((mediaItem, index) => {
                    const selected = selectedShowcase.kind === "showcase" && selectedShowcase.showcaseMediaId === mediaItem.id;
                    const shouldRenderThumbnailImage = Boolean(mediaItem.imageUrl)
                      && !failedPreviewImageUrls.has(mediaItem.imageUrl ?? "");

                    return (
                      <button
                        key={mediaItem.id}
                        className={`relative w-32 shrink-0 snap-start overflow-hidden rounded-[1rem] border ${selected ? "border-cyan-300/65 shadow-[0_0_0_1px_rgba(103,232,249,0.25)]" : "border-white/10"} bg-slate-950/80 transition hover:border-cyan-300/45 sm:w-36`}
                        type="button"
                        aria-label={mediaItem.kind === "external_video" ? `Show video preview ${index + 1}` : `Show preview ${index + 1}`}
                        data-showcase-selected={selected}
                        style={{ aspectRatio: showcaseThumbnailAspectRatio }}
                        onClick={() => setSelectedShowcase({ kind: "showcase", showcaseMediaId: mediaItem.id })}
                      >
                        {shouldRenderThumbnailImage ? (
                          <img
                            className="h-full w-full object-cover"
                            src={mediaItem.imageUrl ?? undefined}
                            alt={mediaItem.altText ?? `${title.displayName} preview`}
                            loading="lazy"
                            decoding="async"
                            onLoad={() => rememberCatalogMediaLoadSuccess(mediaItem.imageUrl)}
                            onError={() => {
                              rememberCatalogMediaLoadFailure(mediaItem.imageUrl);
                              rememberFailedPreviewImage(mediaItem.imageUrl);
                            }}
                          />
                        ) : (
                          <div
                            className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_30%),linear-gradient(180deg,rgba(10,14,24,0.9),rgba(5,8,15,0.98))]"
                            style={{ backgroundImage: getFallbackGradient(title.genreDisplay) }}
                            aria-hidden="true"
                          >
                            <span className="rounded-full border border-white/12 bg-slate-950/72 px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white">
                              {mediaItem.kind === "external_video" ? "Video" : `Preview ${index + 1}`}
                            </span>
                          </div>
                        )}
                        {mediaItem.kind === "external_video" ? (
                          <span className="absolute inset-0 grid place-items-center bg-slate-950/22">
                            <span className="rounded-full border border-white/20 bg-slate-950/72 px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white">Video</span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 bg-[linear-gradient(160deg,rgba(18,31,54,0.96),rgba(8,12,20,0.99))] p-6 md:p-8">
            <div className="min-w-0 space-y-5">
              <div className="flex flex-wrap gap-2">
                {parseGenreTags(title.genreDisplay).map((genreTag) => (
                  <span key={genreTag} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
                    {genreTag}
                  </span>
                ))}
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">{title.playerCountDisplay}</span>
                {title.ageDisplay ? (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">{title.ageDisplay}</span>
                ) : null}
              </div>
              <div className="min-w-0">
                <TitleNameHeading
                  title={title}
                  level="h1"
                  className="app-page-title"
                  imageClassName="block max-h-24 w-auto max-w-full object-contain object-left"
                />
                <div className="mt-4 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100/75">{title.studioDisplayName}</div>
                {publicInterestChips.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {publicInterestChips.map((chip) => (
                      <TitlePublicInterestChip
                        key={`${chip.kind}-${chip.count}`}
                        kind={chip.kind}
                        count={chip.count}
                        label={chip.label}
                      />
                    ))}
                  </div>
                ) : null}
                <p className="mt-4 text-base leading-8 text-slate-200">{title.shortDescription}</p>
              </div>
              {title.currentRelease ? (
                <dl className="grid gap-3 text-sm text-slate-300">
                  <div className="flex justify-between gap-4">
                    <dt>Release</dt>
                    <dd className="text-right text-slate-100">{title.currentRelease.version}</dd>
                  </div>
                </dl>
              ) : null}
              <div className="flex flex-col gap-3">
                {title.acquisitionUrl ? (
                  <a
                    className="primary-button"
                    href={title.acquisitionUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      trackAnalyticsEvent({
                        event: "title_get_clicked",
                        path: `${location.pathname}${location.search}`,
                        authState: session && currentUser ? "authenticated" : "anonymous",
                        studioSlug: title.studioSlug,
                        titleSlug: title.slug,
                        surface: "title-detail",
                        contentKind: title.contentKind,
                        metadata: {
                          titleId: title.id,
                          studioId: title.studioId,
                        },
                      })
                    }
                  >
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
                  showOwnedAction={showOwnedAndReportActions}
                  showReportAction={showOwnedAndReportActions}
                  onToggleWishlist={() => void handleWishlistToggle(!titleInWishlist)}
                  onToggleOwned={() => void handleLibraryToggle(!titleInLibrary)}
                  onShare={() => setShareModalOpen(true)}
                  onReport={() => {
                    if (!existingReport) {
                      const reportField = document.getElementById("title-report-field");
                      reportField?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                />
                {actionMessage ? <div className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{actionMessage}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {playerStateError ? <div className="rounded-[1rem] border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{playerStateError}</div> : null}

      <section className={title.currentRelease && canViewCurrentReleasePanel ? "grid gap-6 lg:grid-cols-[1.2fr_0.8fr]" : "grid gap-6"}>
        <section className="app-panel p-6">
          <h2 className="text-xl font-semibold text-white">About</h2>
          <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-slate-300">{title.description}</p>
        </section>
        {title.currentRelease && canViewCurrentReleasePanel ? (
          <section className="app-panel p-6">
            <h2 className="text-xl font-semibold text-white">Current release</h2>
            <dl className="mt-4 grid gap-3 text-sm text-slate-300">
              <div className="flex justify-between gap-4">
                <dt>Version</dt>
                <dd>{title.currentRelease.version}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Acquisition</dt>
                <dd>{title.acquisitionUrl ? "Configured" : "Not configured"}</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </section>

      {showReportingSurface || canViewMetadata ? (
        <section className={`grid gap-6 ${showReportingSurface && canViewMetadata ? "lg:grid-cols-[1.15fr_0.85fr]" : ""}`}>
          {showReportingSurface ? (
            <section className="app-panel p-6">
              <h2 className="text-xl font-semibold text-white">Player reporting</h2>
              {!session ? (
                <div className="surface-panel-strong mt-6 rounded-[1rem] p-4">
                  <p>Sign in to manage your library, save titles to your wishlist, and report issues to moderators.</p>
                  <div className="mt-4">
                    <Link className="primary-button" to={`/auth/signin?returnTo=${encodeURIComponent(getTitleDetailPath(title.studioSlug, title.slug))}`}>
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
                  <p>This account can sign in, but it is not set up for player features like library, wishlist, or title reporting yet.</p>
                </div>
              )}
            </section>
          ) : null}

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
      ) : null}

      {shareModalOpen ? (
        <ShareTitleModal
          titleDisplayName={title.displayName}
          shareUrl={shareUrl}
          shareHelperUrl={shareHelperUrl}
          onClose={() => setShareModalOpen(false)}
        />
      ) : null}
    </section>
  );
}
