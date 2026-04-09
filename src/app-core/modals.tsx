import type { CatalogTitleResponse } from "@board-enthusiasts/migration-contract";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import copyGlyph from "../assets/title-action-icons/content_copy_24dp.svg?raw";
import {
  addTitleToPlayerLibrary,
  addTitleToPlayerWishlist,
  getCatalogTitle,
  getPlayerLibrary,
  getPlayerWishlist,
  removeTitleFromPlayerLibrary,
  removeTitleFromPlayerWishlist,
} from "../api";
import { hasPlatformRole, useAuth } from "../auth";
import {
  appConfig,
  formatContentKindLabel,
  formatTitleLibraryInterestLabel,
  formatTitleWishlistInterestLabel,
  getCatalogTitleAvailabilityNote,
  getFallbackGradient,
  getHeroImageUrl,
  getTitleDetailPath,
  getTitleSharePageUrl,
  parseGenreTags,
  writeTextToClipboard,
} from "./shared";
import { trackAnalyticsEvent } from "./analytics";
import { ErrorPanel, LoadingPanel, TitleNameHeading, TitlePlayerActionButtons } from "./ui";

export function ShareTitleModal({
  titleDisplayName,
  shareUrl,
  onClose,
}: {
  titleDisplayName: string;
  shareUrl: string;
  onClose: () => void;
}) {
  const headingId = "share-title-heading";
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyFeedbackTone, setCopyFeedbackTone] = useState<"default" | "error">("default");
  const [copying, setCopying] = useState(false);

  async function handleCopy(): Promise<void> {
    setCopying(true);

    try {
      await writeTextToClipboard(shareUrl);
      setCopyFeedback("Link copied to your clipboard.");
      setCopyFeedbackTone("default");
    } catch {
      setCopyFeedback("We couldn't copy the link automatically. You can still copy the URL below.");
      setCopyFeedbackTone("error");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm" onClick={onClose}>
      <section
        className="app-panel w-full max-w-xl p-6 md:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Share</div>
            <h2 id={headingId} className="mt-2 text-2xl font-bold text-white">
              Share {titleDisplayName}
            </h2>
          </div>
          <button
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-slate-950/70 text-slate-100 transition hover:border-cyan-300/60 hover:text-cyan-100"
            type="button"
            aria-label="Close share dialog"
            title="Close"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
              <path d="M6 6 18 18" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/72 p-4">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75" htmlFor="share-title-url">
            Title link
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="share-title-url"
              className="min-w-0 flex-1 rounded-[1rem] border border-white/10 bg-slate-950/82 px-4 py-3 text-sm text-slate-100"
              type="text"
              value={shareUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <button className="primary-button gap-2 px-5" type="button" onClick={() => void handleCopy()} disabled={copying}>
              <span className="inline-svg-icon h-4 w-4" aria-hidden="true" dangerouslySetInnerHTML={{ __html: copyGlyph }} />
              {copying ? "Copying..." : "Copy"}
            </button>
          </div>
          {copyFeedback ? (
            <div className={`mt-3 text-sm ${copyFeedbackTone === "error" ? "text-rose-100" : "text-cyan-50"}`}>
              {copyFeedback}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function TitleQuickViewModal({
  studioIdentifier,
  titleIdentifier,
  onClose,
}: {
  studioIdentifier: string;
  titleIdentifier: string;
  onClose: () => void;
}) {
  const { session, currentUser } = useAuth();
  const location = useLocation();
  const [title, setTitle] = useState<CatalogTitleResponse["title"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerStateLoading, setPlayerStateLoading] = useState(false);
  const [playerStateError, setPlayerStateError] = useState<string | null>(null);
  const [titleInLibrary, setTitleInLibrary] = useState(false);
  const [titleInWishlist, setTitleInWishlist] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
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
      const [libraryResponse, wishlistResponse] = await Promise.all([
        getPlayerLibrary(appConfig.apiBaseUrl, accessToken),
        getPlayerWishlist(appConfig.apiBaseUrl, accessToken),
      ]);
      setTitleInLibrary(libraryResponse.titles.some((candidate) => candidate.id === nextTitleId));
      setTitleInWishlist(wishlistResponse.titles.some((candidate) => candidate.id === nextTitleId));
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
        const response = await getCatalogTitle(appConfig.apiBaseUrl, studioIdentifier, titleIdentifier, accessToken || null);
        if (cancelled) {
          return;
        }

        setTitle(response.title);
        if (accessToken && playerAccessEnabled) {
          await refreshPlayerState(response.title.id);
        } else {
          setTitleInLibrary(false);
          setTitleInWishlist(false);
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
  }, [accessToken, onClose, playerAccessEnabled, studioIdentifier, titleIdentifier]);

  useEffect(() => {
    if (!title) {
      return;
    }

    trackAnalyticsEvent({
      event: "title_quick_view_opened",
      path: `${location.pathname}${location.search}`,
      authState: session && currentUser ? "authenticated" : "anonymous",
      studioSlug: title.studioSlug,
      titleSlug: title.slug,
      surface: "quick-view",
      contentKind: title.contentKind,
      metadata: {
        titleId: title.id,
        studioId: title.studioId,
      },
    });
  }, [currentUser, location.pathname, location.search, session, title]);

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

  const heroImageUrl = title ? getHeroImageUrl(title) : null;
  const availabilityNote = title ? getCatalogTitleAvailabilityNote(title) : null;
  const isComingSoon = availabilityNote === "Coming soon";
  const titleWishlistCount = title?.wishlistCount ?? 0;
  const titleLibraryCount = title?.libraryCount ?? 0;
  const publicInterestChips = [
    titleWishlistCount > 0 ? formatTitleWishlistInterestLabel(titleWishlistCount) : null,
    titleLibraryCount > 0 ? formatTitleLibraryInterestLabel(titleLibraryCount) : null,
  ].filter((label): label is string => label !== null);
  const showOwnedActions = !isComingSoon;
  const shareUrl = title ? getTitleSharePageUrl(title.studioId, title.id) : null;
  const titleDetailPath = title ? getTitleDetailPath(title.studioSlug, title.slug) : getTitleDetailPath(studioIdentifier, titleIdentifier);

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
                  showOwnedAction={showOwnedActions}
                  showReportAction={false}
                  onToggleWishlist={() => void handleWishlistToggle(!titleInWishlist)}
                  onToggleOwned={() => void handleLibraryToggle(!titleInLibrary)}
                  onShare={() => setShareModalOpen(true)}
                />
              </div>
              {actionMessage ? <div className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{actionMessage}</div> : null}
              {playerStateError ? <div className="rounded-[1rem] border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{playerStateError}</div> : null}
              <div className="relative">
                <div
                  className="min-h-[20rem] rounded-[1.75rem] bg-cover bg-center"
                  style={heroImageUrl ? { backgroundImage: `linear-gradient(135deg, rgba(4,19,29,0.16), rgba(4,19,29,0.58)), url('${heroImageUrl}')` } : { backgroundImage: getFallbackGradient(title.genreDisplay) }}
                />
                {isComingSoon ? (
                  <span className="coming-soon-chip-overlay absolute left-4 top-4">
                    Coming Soon
                  </span>
                ) : null}
              </div>
              <div className="surface-panel-soft flex flex-wrap items-start justify-between gap-4 rounded-[1.25rem] p-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Studio</div>
                  <div className="mt-2 text-lg font-semibold text-white">{title.studioDisplayName}</div>
                </div>
                {publicInterestChips.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {publicInterestChips.map((label) => (
                      <div key={label} className="rounded-full border border-white/15 bg-slate-950/45 px-4 py-2 text-sm font-semibold text-slate-100">
                        {label}
                      </div>
                    ))}
                  </div>
                ) : null}
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
                  {title.description ? <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{title.description}</p> : null}
                  {!session ? (
                    <div className="surface-panel-strong rounded-[1rem] p-4">
                      <p className="text-sm leading-7 text-slate-300">Sign in to manage your library and save titles to your wishlist.</p>
                      <div className="mt-4">
                        <Link className="primary-button" to={`/auth/signin?returnTo=${encodeURIComponent(titleDetailPath)}`}>
                          Sign In
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
                    <Link className="rounded-full bg-cyan-300 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.18em] text-slate-950" to={titleDetailPath}>
                      Details
                    </Link>
                    {title.acquisition?.url ?? title.acquisitionUrl ? (
                      <a
                        className="rounded-full border border-white/15 px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.18em] text-slate-100"
                        href={title.acquisition?.url ?? title.acquisitionUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() =>
                          trackAnalyticsEvent({
                            event: "title_get_clicked",
                            path: `${location.pathname}${location.search}`,
                            authState: session && currentUser ? "authenticated" : "anonymous",
                            studioSlug: title.studioSlug,
                            titleSlug: title.slug,
                            surface: "quick-view",
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
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
      {title && shareUrl && shareModalOpen ? (
        <ShareTitleModal
          titleDisplayName={title.displayName}
          shareUrl={shareUrl}
          onClose={() => setShareModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
