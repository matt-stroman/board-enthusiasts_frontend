import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createMarketingSignup, createSupportIssueReport } from "../api";
import {
  appConfig,
  buildLandingSupportIssuePayload,
  CaptchaWidget,
  DiscordIconButton,
  Field,
  getCaptchaMode,
  LANDING_SIGNUP_DRAFT_STORAGE_KEY,
  landingBoardUrl,
  landingConsentTextVersion,
  landingDiscordUrl,
  landingGptUrl,
  landingMetadata,
  landingPrivacyRoute,
  landingSignupSource,
  landingSupportMailtoHref,
  LandingGlyph,
  LandingUpdatesLink,
  liveMetadata,
  Panel,
  readSessionStorageJson,
  removeSessionStorageJson,
  useDocumentMetadata,
  validateEmailInput,
  writeSessionStorageJson,
  type LandingSignupDraftState,
  type TurnstileWidgetStatus,
} from "../app-core";

export function LandingPage() {
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


export function LandingPrivacyPage() {
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


export function LivePrivacyPage() {
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


export function HomePage() {
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


export function InstallGuidePage() {
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


export function NotFoundPage() {
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


