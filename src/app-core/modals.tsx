import type { CatalogTitleResponse, PlayerTitleReportSummary } from "@board-enthusiasts/migration-contract";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  addTitleToPlayerLibrary,
  addTitleToPlayerWishlist,
  createPlayerTitleReport,
  getCatalogTitle,
  getPlayerLibrary,
  getPlayerTitleReports,
  getPlayerWishlist,
  listManagedStudios,
  removeTitleFromPlayerLibrary,
  removeTitleFromPlayerWishlist,
} from "../api";
import { hasPlatformRole, useAuth } from "../auth";
import {
  appConfig,
  formatContentKindLabel,
  formatMembershipRole,
  formatReportStatus,
  formatTimestamp,
  getCatalogTitleAvailabilityNote,
  getFallbackGradient,
  getHeroImageUrl,
  parseGenreTags,
} from "./shared";
import { ErrorPanel, Field, LoadingPanel, TitleNameHeading, TitlePlayerActionButtons } from "./ui";

export function ReportTitleModal({
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

export function TitleQuickViewModal({
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
