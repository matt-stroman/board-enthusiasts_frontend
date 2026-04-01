import type { ModerationDeveloperSummary, TitleReportDetail, TitleReportSummary } from "@board-enthusiasts/migration-contract";
import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  addModerationTitleReportMessage,
  getModerationTitleReport,
  getModerationTitleReports,
  getVerifiedDeveloperState,
  invalidateModerationTitleReport,
  searchModerationDevelopers,
  setVerifiedDeveloperState,
  validateModerationTitleReport,
} from "../api";
import { useAuth } from "../auth";
import {
  appConfig,
  EmptyState,
  ErrorPanel,
  Field,
  LoadingPanel,
  ModerationReportList,
  TitleReportConversation,
} from "../app-core";

export function ModeratePage() {
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


