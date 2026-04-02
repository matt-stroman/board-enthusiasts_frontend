import type { CatalogTitleResponse, CatalogTitleSummary, DeveloperStudioSummary, PlayerTitleReportSummary, StudioSummary, TitleMediaAsset } from "@board-enthusiasts/migration-contract";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  addTitleToPlayerLibrary,
  addTitleToPlayerWishlist,
  createPlayerTitleReport,
  getCatalogTitle,
  getPlayerLibrary,
  getPlayerTitleReport,
  getPlayerTitleReports,
  getPlayerWishlist,
  getPublicStudio,
  listCatalogTitles,
  listManagedStudios,
  listPublicStudios,
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
  formatMembershipRole,
  formatReportStatus,
  formatTimestamp,
  getUserFacingErrorMessage,
  getCatalogTitleAvailabilityNote,
  getFallbackGradient,
  getHeroImageUrl,
  getStudioAvatarImageUrl,
  isKnownStudioLink,
  LoadingPanel,
  parseGenreTags,
  PLAYER_FILTER_MAX,
  PLAYER_FILTER_MIN,
  PlayerRangeField,
  ReportTitleModal,
  StudioLinkIcon,
  trackAnalyticsEvent,
  StudioCard,
  TitleCard,
  TitleNameHeading,
  TitlePlayerActionButtons,
  TitleQuickViewModal,
  useDocumentMetadata,
} from "../app-core";

export function BrowsePage() {
  const { session, currentUser } = useAuth();
  const location = useLocation();
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
  const lastTrackedBrowseFilterKeyRef = useRef("");

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
      setReportErrorMessage(getUserFacingErrorMessage(nextError, "We couldn't submit that report right now. Please try again."));
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


export function StudioDetailPage() {
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
      setReportErrorMessage(getUserFacingErrorMessage(nextError, "We couldn't submit that report right now. Please try again."));
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


export function TitleDetailPage() {
  const { session, currentUser } = useAuth();
  const location = useLocation();
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
      setPlayerStateError(getUserFacingErrorMessage(nextError, "We couldn't refresh your player details right now. Please try again."));
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
          setError(getUserFacingErrorMessage(nextError, "We couldn't load that title right now. Please try again."));
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
    if (!title) {
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
  }, [currentUser, location.pathname, location.search, session, title]);

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
              <p>This account can sign in, but it is not set up for player features like library, wishlist, or title reporting yet.</p>
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
