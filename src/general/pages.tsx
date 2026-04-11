import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { createMarketingSignup, createSupportIssueReport, getBeHomeMetrics, getHomeOfferingSpotlights, type HomeOfferingSpotlightEntry } from "../api";
import { useAuth } from "../auth";
import { hasBeHomeBridge } from "../be-home-bridge";
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
  landingEmulatorDiscordUrl,
  landingGdkDiscordUrl,
  supportEmailAddress,
  supportEmailHref,
} from "../app-core";

const beHomeSupportAnonymousEmail = "support+be-home@boardenthusiasts.com";
const beHomeSupportConsentTextVersion = "be-home-support-v1";

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
                Discover BE resources, connect with other Board players and builders, and get updates on what is coming next.
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
            <h2>For Board players and builders.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Board Enthusiasts is an independent project for Board players and builders. It is not affiliated with or endorsed by Board or Harris Hill Products, Inc.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Questions or ideas? Email <a href="mailto:contact@boardenthusiasts.com">contact@boardenthusiasts.com</a> or join the <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>.
            </p>
          </article>

          <article className="app-panel landing-promo-card">
            <div className="eyebrow">Why join now</div>
            <h2>BE where the Board community shows up first.</h2>
            <ul className="landing-promo-list" aria-label="Reasons to join early">
              <li>See new indie releases early.</li>
              <li>Get updates as the BE Library grows.</li>
              <li>Find tools and community resources for Board.</li>
            </ul>
          </article>
        </div>

        <div className="landing-hero-rail">
          <article className="landing-showcase-card landing-showcase-card-spotlight landing-feature-card">
            <div className="landing-icon-badge" aria-hidden="true">
              <LandingGlyph kind="library" />
            </div>
            <div className="eyebrow">Coming soon</div>
              <h2>A shared place for indie Board releases.</h2>
            <p>
              The BE Library will make it easier to discover games and apps, follow studios, and keep up with what is new on Board.
            </p>
            <div className="landing-feature-list">
              <div className="landing-feature-item">
                <strong>Players</strong>
                <span>Follow new releases and save titles to revisit.</span>
              </div>
              <div className="landing-feature-item">
                <strong>Developers</strong>
                <span>Give players one more place to find your work.</span>
              </div>
            </div>
            <div className="card-actions mt-5">
              <LandingUpdatesLink className="secondary-button">Get Early Updates</LandingUpdatesLink>
            </div>
          </article>
          <article id="signup" className="landing-showcase-card landing-signup-card">
            <div className="eyebrow">Get updates</div>
            <h2>Be there when the Library opens.</h2>
            <p>
              Join the BE list for launch updates, invites, and new resources for Board players and developers.
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
                  <span>I want to create indie content for Board.</span>
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
                Questions? Email <a href="mailto:contact@boardenthusiasts.com">contact@boardenthusiasts.com</a> or join the <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>.
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
                  <h2>BE Home for Board</h2>
                </div>
              </div>
              <span className="status-chip">Available now</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A an app for Board that lets users view the BE Indie Game Index and access other BE resources, right from the Board console.
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
              Find community, track new indie releases, and get ready for one place to discover more of what is happening around Board.
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
          Board Enthusiasts currently collects the information needed to run this hosted site, protect the updates signup flow, understand basic site usage, and respond to direct contact requests.
        </p>
        <div className="mt-6 list-stack">
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>What we collect</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Email address, optional first name, selected signup interests, signup source and consent details, support request details, limited browser or device context that helps us troubleshoot reported issues, anti-abuse verification data, and anonymous analytics or browser storage identifiers used to understand site usage.
            </p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>Why we collect it</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              To operate the site, reduce abuse, send launch updates or invite emails when you ask for them, troubleshoot reported issues, and understand which public pages or actions are being used.
            </p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>Who processes it</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Cloudflare hosts the site and provides Turnstile plus site analytics tooling, Supabase supports BE application data, and Brevo supports signup and support email delivery. If you follow external links such as Discord or Board, those destinations apply their own privacy terms.
            </p>
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
          BE currently collects the information needed to create and secure accounts, run the live catalog and workspace flows, understand basic product usage, and respond to support or privacy requests.
        </p>
        <div className="mt-6 list-stack">
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>What we collect</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Account email, username, sign-in provider and account security records, optional profile and Board profile fields, player library, wishlist, followed studio, report, and message activity, developer-submitted studio, title, release, and showcase details, uploaded images and related metadata, support request details with limited troubleshooting context, optional marketing preferences, and anonymous analytics or browser storage identifiers used to understand product usage.
            </p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>Why we collect it</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              To sign you in, protect accounts, power player, developer, and moderation workflows, display catalog listings and media that developers choose to share through BE, respond when you contact us, send optional BE emails when you ask for them, and understand how the product is being used.
            </p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>What may be public</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              If a developer chooses to list a studio, title, release, image, or related profile detail on BE, that information can be shown on BE catalog pages for players and visitors. If you follow external acquisition, community, or publisher links from BE, those destinations handle their own privacy practices.
            </p>
          </div>
          <div className="surface-panel-strong rounded-[1rem] p-4">
            <h2>Who processes it</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Cloudflare hosts the web and API surfaces and provides Turnstile plus internal analytics tooling. Supabase supports authentication, account security, database, and file storage. Brevo supports optional marketing and some direct email delivery. If you choose Discord, GitHub, or Google sign-in when those options are enabled, those providers also process your sign-in request.
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


type OfferingAction =
  | { label: string; to: string }
  | { label: string; href: string; external: true };

type OfferingEntry = {
  title: string;
  eyebrow: string;
  description: string;
  status: "Available now" | "Coming soon";
  glyph: "api" | "discord" | "library" | "spark" | "toolkit" | "youtube";
  action?: OfferingAction;
};

const liveOfferingEntries: OfferingEntry[] = [
  {
    title: "BE Game Index",
    eyebrow: "Index",
    description: "Browse indie Board games and apps in one place as the community catalog keeps growing.",
    status: "Available now",
    glyph: "library",
    action: { label: "Browse Index", to: "/browse" },
  },
  {
    title: "BE Discord",
    eyebrow: "Community",
    description: "Join players and builders shaping the Board ecosystem together, asking questions, and sharing what they are working on.",
    status: "Available now",
    glyph: "discord",
    action: { label: "Join Discord", href: landingDiscordUrl, external: true },
  },
  {
    title: "BE YouTube",
    eyebrow: "Channel",
    description: "Watch Board guides, feature walkthroughs, community showcases, and practical videos for players and builders.",
    status: "Available now",
    glyph: "youtube",
    action: { label: "Watch Channel", href: "https://www.youtube.com/@boardenthusiasts", external: true },
  },
  {
    title: "BE GPT",
    eyebrow: "Resource",
    description: "Use a Board-focused assistant informed by official docs, FAQ, and troubleshooting guidance.",
    status: "Available now",
    glyph: "spark",
    action: { label: "Open GPT", href: landingGptUrl, external: true },
  },
  {
    title: "BE Home for Board",
    eyebrow: "Utility",
    description: "View the BE Indie Game Index, BE YouTube, and other BE resources, right from the Board console!",
    status: "Available now",
    glyph: "toolkit",
    action: { label: "Learn More", href: "https://discord.gg/wqdcusHUKM", external: true },
  },
];

const publicApiDocsOfferingEntry: OfferingEntry = {
  title: "Board Enthusiasts API",
  eyebrow: "Developer resource",
  description: "Explore the public API reference for catalog browsing plus supported player and developer workflows.",
  status: "Available now",
  glyph: "api",
  action: { label: "Open API Docs", href: "https://documenter.getpostman.com/view/3468151/2sBXiompb8", external: true },
};

const comingSoonOfferingEntries: OfferingEntry[] = [
  {
    title: "BE Emulator for Board",
    eyebrow: "Developer tool",
    description: "An in-editor Board OS emulator for faster testing workflows inside Unity.",
    status: "Coming soon",
    glyph: "toolkit",
    action: { label: "Follow in Discord", href: landingEmulatorDiscordUrl, external: true },
  },
  {
    title: "BE GDK for Board",
    eyebrow: "Developer tool",
    description: "A higher-level toolkit intended to help developers build for Board with smoother workflows and supporting systems.",
    status: "Coming soon",
    glyph: "toolkit",
    action: { label: "Follow in Discord", href: landingGdkDiscordUrl, external: true },
  },
];

const homepageValueCards = [
  {
    title: "For Players",
    description: "Discover indie Board games and apps in one place.",
  },
  {
    title: "For Developers",
    description: "Show up where players are already browsing and following launches.",
  },
  {
    title: "For the Ecosystem",
    description: "Build community, tools, and momentum around Board.",
  },
];

const ecosystemFitCards = [
  {
    title: "Discover",
    description: "Find indie Board games and apps through the BE Game Index.",
  },
  {
    title: "Connect",
    description: "Stay close to players, builders, and community discussion through BE channels.",
  },
  {
    title: "Build",
    description: "Use or follow the tools BE is creating to support Board development workflows.",
  },
];

function OfferingCard({ entry }: { entry: OfferingEntry }) {
  const action = entry.action;

  return (
    <article className="app-panel p-6 landing-offering-card">
      <div className="landing-offering-heading-row">
        <div className="landing-offering-heading-group">
          <div className="landing-icon-badge" aria-hidden="true">
            <LandingGlyph kind={entry.glyph} />
          </div>
          <div>
            <div className="eyebrow">{entry.eyebrow}</div>
            <h2>{entry.title}</h2>
          </div>
        </div>
        <span className="status-chip">{entry.status}</span>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-300">{entry.description}</p>
      {action ? (
        <div className="card-actions mt-5">
          {"to" in action ? (
            <Link className="secondary-button" to={action.to}>
              {action.label}
            </Link>
          ) : (
            <a className="secondary-button" href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined}>
              {action.label}
            </a>
          )}
        </div>
      ) : null}
    </article>
  );
}

function OfferingGroupSection({
  id,
  title,
  description,
  entries,
}: {
  id?: string;
  title: string;
  description: string;
  entries: OfferingEntry[];
}) {
  return (
    <section id={id} className="landing-section">
      <div className="landing-section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="landing-card-grid">
        {entries.map((entry) => (
          <OfferingCard key={entry.title} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function CommunityProjectStrip() {
  return (
    <section className="landing-section">
      <article className="app-panel p-6">
        <div className="eyebrow">Independent and community-built</div>
        <h2>Board Enthusiasts is independent and community-built.</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Board Enthusiasts is an independent community project for Board players and builders. It is not affiliated with, endorsed by, or sponsored by Board or Harris Hill Products, Inc.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Questions? Email <a href="mailto:contact@boardenthusiasts.com">contact@boardenthusiasts.com</a> or join the <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>.
        </p>
      </article>
    </section>
  );
}

function HomeOfferingsSpotlight() {
  const [entries, setEntries] = useState<HomeOfferingSpotlightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [rotationTick, setRotationTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await getHomeOfferingSpotlights(appConfig.apiBaseUrl);
        if (!cancelled) {
          setEntries(response.entries);
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
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
    if (entries.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % entries.length);
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, [entries.length, rotationTick]);

  useEffect(() => {
    if (entries.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => Math.min(current, entries.length - 1));
  }, [entries.length]);

  function changeEntry(nextIndex: number): void {
    if (entries.length === 0) {
      return;
    }

    setActiveIndex((nextIndex + entries.length) % entries.length);
    setRotationTick((current) => current + 1);
  }

  const activeEntry = entries[activeIndex] ?? null;

  if (!activeEntry) {
    return (
      <section className="landing-section">
        <article className="landing-showcase-card landing-showcase-card-spotlight">
          <div className="eyebrow">{loading ? "Loading offerings" : "BE offerings"}</div>
          <h2>Featured offerings will appear here.</h2>
          <p>You can still explore everything on the Offerings page.</p>
          <div className="card-actions mt-5">
            <Link className="secondary-button" to="/offerings">Open Offerings</Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="landing-section">
      <article className="landing-showcase-card landing-showcase-card-spotlight overflow-hidden p-0">
        <div className="relative grid gap-0 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="flex min-h-[15rem] items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(96,255,164,0.18),transparent_32%),linear-gradient(180deg,rgba(15,22,34,0.98),rgba(8,12,20,0.98))] px-8 py-10">
            <div className="landing-icon-badge !mb-0 !size-20 rounded-[1.9rem]" aria-hidden="true">
              <LandingGlyph kind={activeEntry.glyph} />
            </div>
          </div>
          <div className="relative p-6 md:p-8">
            {entries.length > 1 ? (
              <>
                <button
                  className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-slate-950/80 p-3 text-slate-100 transition hover:border-cyan-300/45 hover:text-cyan-100"
                  type="button"
                  aria-label="Previous offering spotlight"
                  onClick={() => changeEntry(activeIndex - 1)}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7" /></svg>
                </button>
                <button
                  className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-slate-950/80 p-3 text-slate-100 transition hover:border-cyan-300/45 hover:text-cyan-100"
                  type="button"
                  aria-label="Next offering spotlight"
                  onClick={() => changeEntry(activeIndex + 1)}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true"><path d="m9.5 5 7 7-7 7" /></svg>
                </button>
              </>
            ) : null}
            <div className="mx-auto flex h-full max-w-3xl flex-col justify-center">
              <div className="flex flex-wrap items-center gap-3">
                <div className="eyebrow">{activeEntry.eyebrow}</div>
                <span className="status-chip">{activeEntry.statusLabel}</span>
              </div>
              <h2 className="mt-3">{activeEntry.title}</h2>
              <p className="mt-3">{activeEntry.description}</p>
              {activeEntry.actionLabel && activeEntry.actionUrl ? (
                <div className="card-actions mt-5">
                  {activeEntry.actionExternal ? (
                    <a className="secondary-button" href={activeEntry.actionUrl} target="_blank" rel="noreferrer">
                      {activeEntry.actionLabel}
                    </a>
                  ) : (
                    <Link className="secondary-button" to={activeEntry.actionUrl}>
                      {activeEntry.actionLabel}
                    </Link>
                  )}
                </div>
              ) : null}
              {entries.length > 1 ? (
                <div className="mt-6 flex items-center gap-2">
                  {entries.map((entry, index) => (
                    <button
                      key={`${entry.slotNumber}-${entry.title}`}
                      className={`h-2.5 w-8 rounded-full transition ${index === activeIndex ? "bg-cyan-200" : "bg-white/18 hover:bg-white/35"}`}
                      type="button"
                      aria-label={`Show ${entry.title}`}
                      aria-pressed={index === activeIndex}
                      onClick={() => changeEntry(index)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

export function HomePage() {
  useDocumentMetadata({
    title: liveMetadata.homeTitle,
    description: liveMetadata.homeDescription,
    canonicalUrl: liveMetadata.homeCanonical,
  });
  const [beHomeActiveNow, setBeHomeActiveNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBeHomeMetrics(): Promise<void> {
      try {
        const response = await getBeHomeMetrics(appConfig.apiBaseUrl);
        if (!cancelled) {
          setBeHomeActiveNow(response.metrics.activeNowTotal);
        }
      } catch {
        if (!cancelled) {
          setBeHomeActiveNow(null);
        }
      }
    }

    void loadBeHomeMetrics();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="landing-shell page-grid">
      <section className="landing-hero">
        <div className="landing-hero-column">
          <div className="hero-panel landing-hero-panel">
            <div className="landing-hero-copy">
              <div className="eyebrow">Live now</div>
              <h1>Discover indie Board games in one place.</h1>
              <p>
                The BE Game Index is live. Browse indie Board games and apps, follow new releases, and explore BE tools built around the platform.
              </p>
            </div>
            <div className="landing-hero-footer">
              <div className="hero-actions">
                <Link className="primary-button" to="/browse">Browse Index</Link>
                <Link className="secondary-button" to="/offerings">Explore Offerings</Link>
                <DiscordIconButton />
              </div>
              {beHomeActiveNow !== null ? (
                <p className="mt-4 text-sm leading-7 text-cyan-100">
                  {beHomeActiveNow.toLocaleString()} players active in BE Home right now. This is a live BE Home community count, not an official Board platform metric.
                </p>
              ) : null}
              <p className="landing-hero-note">
                Looking for official Board news, hardware, or platform information? Visit <a href={landingBoardUrl} target="_blank" rel="noreferrer">board.fun</a>.
              </p>
            </div>
          </div>
        </div>

        <div className="landing-hero-rail">
          <article className="landing-showcase-card landing-showcase-card-spotlight">
            <div className="eyebrow">Why it matters</div>
            <h2>A better way to keep up with indie Board releases.</h2>
            <div className="landing-feature-list">
              <div className="landing-feature-item">
                <strong>Browse titles</strong>
                <span>See indie Board games and apps in one place.</span>
              </div>
              <div className="landing-feature-item">
                <strong>Follow what is new</strong>
                <span>Keep up with upcoming releases, studios, and new additions.</span>
              </div>
              <div className="landing-feature-item">
                <strong>Explore BE tools</strong>
                <span>Find the resources and community spaces built around the index.</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <HomeOfferingsSpotlight />

      <section className="landing-section">
        <div className="landing-section-heading">
          <h2>Why BE exists</h2>
          <p>BE's mission is to help support and grow the community around Board, in whatever capacity that needs to be as Board evolves.</p>
          <p>In its nascent stages, we're filling perceived gaps for players and indie developers until Board is able to release official solutions. When those solutions arrive (e.g. Board's new Sideloaded menu), corresponding BE resources (e.g. the old BE App Launcher) will be phased out and point back to Board's official one.</p>
          <p>As Board evolves, BE will continue to adapt and provide value to the community in ways that complement Board's official offerings.</p>
          <p><b>We can't wait to see what indie game develoeprs create for the platform, and we're here to support you and your players for the long haul!</b></p>
        </div>
        <div className="landing-card-grid">
          {homepageValueCards.map((card) => (
            <article key={card.title} className="app-panel p-6 landing-offering-card">
              <h2>{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <CommunityProjectStrip />
    </div>
  );
}

export function OfferingsPage() {
  useDocumentMetadata({
    title: liveMetadata.offeringsTitle,
    description: liveMetadata.offeringsDescription,
    canonicalUrl: liveMetadata.offeringsCanonical,
  });

  const offeringsPageLiveEntries = [...liveOfferingEntries, publicApiDocsOfferingEntry];

  return (
      <div className="landing-shell page-grid">
        <section className="landing-section">
        <div className="hero-panel landing-hero-panel landing-hero-panel-compact">
          <div className="landing-hero-copy">
            <div className="eyebrow">BE ecosystem</div>
            <h1>Explore the BE ecosystem.</h1>
            <p>
              Beyond the Game Index, BE includes community spaces, helper tools, utility apps, and in-progress developer offerings.
            </p>
          </div>
          <div className="landing-hero-footer">
            <div className="hero-actions">
              <Link className="primary-button" to="/browse">Browse Game Index</Link>
              <a className="secondary-button" href={landingDiscordUrl} target="_blank" rel="noreferrer">Join Discord</a>
            </div>
          </div>
        </div>
      </section>

      <OfferingGroupSection
        id="available-now"
        title="Available Now"
        description="These BE offerings are already live today."
        entries={offeringsPageLiveEntries}
      />

      <OfferingGroupSection
        title="Coming Soon"
        description="These are the next BE tools and supporting platform pieces now in progress."
        entries={comingSoonOfferingEntries}
      />

      <section className="landing-section">
        <div className="landing-section-heading">
          <h2>How BE fits together</h2>
          <p>Discovery, community, and tooling each play a distinct role in the broader BE ecosystem.</p>
        </div>
        <div className="landing-card-grid">
          {ecosystemFitCards.map((card) => (
            <article key={card.title} className="app-panel p-6 landing-offering-card">
              <h2>{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <article className="landing-showcase-card landing-showcase-card-spotlight">
          <div className="eyebrow">Back to the index</div>
          <h2>Browse the live BE Game Index.</h2>
          <p>
            When you are ready to discover what is available right now, jump back into the live index and explore indie Board games and apps.
          </p>
          <div className="card-actions mt-5">
            <Link className="primary-button" to="/browse">Browse Game Index</Link>
            <Link className="secondary-button" to="/">Return Home</Link>
          </div>
        </article>
      </section>
    </div>
  );
}


export function InstallGuidePage() {
  const boardDeveloperBridgeUrl = "https://dev.board.fun/#:~:text=Board%20Developer%20Bridge%20(bdb)";
  const boardInstallInstructionsUrl = "https://docs.dev.board.fun/getting-started/deploy#board-developer-bridge-bdb";

    return (
      <div className="page-grid">
        <section className="space-y-8">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold uppercase tracking-[0.08em] text-white">Install Guide</h1>
            <p className="text-sm leading-7 text-slate-300">
              Follow these steps to find an indie Board game and install it onto your Board today.
            </p>
          </div>

        <section className="home-card-grid">
          <section className="app-panel p-6">
            <div className="eyebrow">1. Discover on BE</div>
            <h2>Browse the index and pick an indie title to install.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Start in the <Link className="text-cyan-100 transition hover:text-white" to="/browse">BE Game Index</Link> to browse indie Board games and apps, compare listings, and decide what you want to install.
            </p>
          </section>
          <section className="app-panel p-6">
            <div className="eyebrow">2. Download on your PC</div>
            <h2>Get the title from the developer onto your computer.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Use the <code>Get Title</code> link on the listing to purchase or download the title from the developer&apos;s site. Keep the download on your PC, since Board currently requires PC-assisted installation through <code>bdb</code>.
            </p>
          </section>
          <section className="app-panel p-6">
            <div className="eyebrow">3. Download the installer</div>
            <h2>Get Board&apos;s install tool onto your computer.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              On Board&apos;s developer portal, you&apos;ll need to unlock the download first and then choose the version for your computer.
            </p>
            <ul className="bullet-list mt-3">
              <li>Open <a className="text-cyan-100 transition hover:text-white" href={boardDeveloperBridgeUrl} target="_blank" rel="noreferrer">Board Developer Bridge (bdb)</a> on Board&apos;s developer portal.</li>
              <li>Read Board&apos;s <a className="text-cyan-100 transition hover:text-white" href="https://dev.board.fun/" target="_blank" rel="noreferrer">Developer Terms of Use</a>.</li>
              <li>Check the agreement box to enable the download buttons.</li>
              <li>Download the version for your operating system.</li>
            </ul>
          </section>
          <section className="app-panel p-6">
            <div className="eyebrow">4. Install on Board</div>
            <h2>Follow Board&apos;s setup steps and finish the install.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Follow <a className="text-cyan-100 transition hover:text-white" href={boardInstallInstructionsUrl} target="_blank" rel="noreferrer">Board&apos;s instructions</a> for connecting Board and installing your game.
            </p>
          </section>
        </section>
      </section>
    </div>
  );
}

export function SupportPage() {
  useDocumentMetadata({
    title: liveMetadata.supportTitle,
    description: liveMetadata.supportDescription,
    canonicalUrl: liveMetadata.supportCanonical,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, session } = useAuth();
  const beHomeSupportEnabled = hasBeHomeBridge();
  const autoOpenSupportRequest = searchParams.get("beHomeSupportOpen") === "1";
  const signedInEmail = currentUser?.email?.trim() ?? "";
  const signedInDisplayName = currentUser?.displayName?.trim() ?? "";
  const emailLocked = Boolean(session && signedInEmail);
  const supportDialogRef = useRef<HTMLElement | null>(null);
  const supportFormRef = useRef<HTMLFormElement | null>(null);
  const autoOpenedSupportRef = useRef(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportVisibleViewportHeight, setSupportVisibleViewportHeight] = useState<number | null>(null);
  const [supportKeyboardInset, setSupportKeyboardInset] = useState(0);
  const [supportStatusMessage, setSupportStatusMessage] = useState<string | null>(null);
  const [supportRequestError, setSupportRequestError] = useState<string | null>(null);
  const [submittingSupportRequest, setSubmittingSupportRequest] = useState(false);
  const [showSupportValidation, setShowSupportValidation] = useState(false);
  const [supportFirstName, setSupportFirstName] = useState(signedInDisplayName);
  const [supportEmail, setSupportEmail] = useState(emailLocked ? signedInEmail : "");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportDescription, setSupportDescription] = useState("");
  const [supportMarketingConsent, setSupportMarketingConsent] = useState(false);

  const supportEmailValue = emailLocked ? signedInEmail : supportEmail.trim();
  const supportEmailError = supportEmailValue ? validateEmailInput(supportEmailValue) : null;
  const supportFirstNameError = supportFirstName.trim() ? null : "Enter your first name.";
  const supportSubjectError = supportSubject.trim() ? null : "Enter a subject.";
  const supportDescriptionError = supportDescription.trim() ? null : "Tell us what happened so we can help.";
  const showSupportConsent = !emailLocked && Boolean(supportEmailValue) && !supportEmailError;

  useEffect(() => {
    if (!beHomeSupportEnabled || !autoOpenSupportRequest || autoOpenedSupportRef.current) {
      return;
    }

    autoOpenedSupportRef.current = true;
    openSupportModal();

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("beHomeSupportOpen");
    setSearchParams(nextSearchParams, { replace: true });
  }, [autoOpenSupportRequest, beHomeSupportEnabled, searchParams, setSearchParams]);

  useEffect(() => {
    if (!supportModalOpen) {
      setSupportVisibleViewportHeight(null);
      setSupportKeyboardInset(0);
      return;
    }

    function updateSupportViewportMetrics(): void {
      const viewport = window.visualViewport;
      const fallbackHeight = window.innerHeight;
      const visibleHeight = viewport
        ? Math.max(0, Math.floor(viewport.height + viewport.offsetTop))
        : fallbackHeight;
      setSupportVisibleViewportHeight(visibleHeight);
      setSupportKeyboardInset(Math.max(0, Math.floor(window.innerHeight - visibleHeight)));
    }

    updateSupportViewportMetrics();

    const viewport = window.visualViewport;
    window.addEventListener("resize", updateSupportViewportMetrics);
    viewport?.addEventListener("resize", updateSupportViewportMetrics);
    viewport?.addEventListener("scroll", updateSupportViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateSupportViewportMetrics);
      viewport?.removeEventListener("resize", updateSupportViewportMetrics);
      viewport?.removeEventListener("scroll", updateSupportViewportMetrics);
    };
  }, [supportModalOpen]);

  function openSupportModal(): void {
    setSupportStatusMessage(null);
    setSupportRequestError(null);
    setShowSupportValidation(false);
    setSupportFirstName(signedInDisplayName);
    setSupportEmail(emailLocked ? signedInEmail : "");
    setSupportSubject("");
    setSupportDescription("");
    setSupportMarketingConsent(false);
    setSupportModalOpen(true);
  }

  function closeSupportModal(): void {
    if (submittingSupportRequest) {
      return;
    }

    setSupportModalOpen(false);
  }

  function handleSupportFieldFocus(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>): void {
    const target = event.currentTarget;
    const bringFieldIntoView = () => {
      const fieldContainer = target.closest("[data-support-field='true']");
      if (supportFormRef.current && fieldContainer instanceof HTMLElement) {
        const formRect = supportFormRef.current.getBoundingClientRect();
        const fieldRect = fieldContainer.getBoundingClientRect();
        const anchorOffset = Math.max(Math.min(supportFormRef.current.clientHeight * 0.24, 144), 40);
        const desiredTop = Math.max(
          supportFormRef.current.scrollTop + fieldRect.top - formRect.top - anchorOffset,
          0,
        );
        if (typeof supportFormRef.current.scrollTo === "function") {
          supportFormRef.current.scrollTo({
            top: desiredTop,
            behavior: "smooth",
          });
        }
        else {
          supportFormRef.current.scrollTop = desiredTop;
        }
      }

      const scrollTarget = supportDialogRef.current;
      if (scrollTarget && typeof scrollTarget.scrollIntoView === "function") {
        try {
          scrollTarget.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
        } catch {
          scrollTarget.scrollIntoView();
        }
      }

      if (typeof target.scrollIntoView === "function") {
        try {
          target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        } catch {
          target.scrollIntoView();
        }
      }
    };

    window.setTimeout(bringFieldIntoView, 80);
    window.setTimeout(bringFieldIntoView, 280);
    window.setTimeout(bringFieldIntoView, 640);
    window.setTimeout(bringFieldIntoView, 1000);
  }

  const supportAvailableHeight =
    supportVisibleViewportHeight ?? (typeof window === "undefined" ? null : window.innerHeight);
  const supportDialogMaxHeight = supportAvailableHeight
    ? `${Math.max(320, Math.min(supportAvailableHeight - 32, 720))}px`
    : undefined;
  const supportFormBottomPadding = `${supportKeyboardInset > 0 ? supportKeyboardInset + 128 : 260}px`;

  async function handleSupportSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setShowSupportValidation(true);
    setSupportStatusMessage(null);
    setSupportRequestError(null);

    if (submittingSupportRequest || supportFirstNameError || supportSubjectError || supportDescriptionError || supportEmailError) {
      return;
    }

    setSubmittingSupportRequest(true);
    try {
      const effectiveReplyToEmail = supportEmailValue || beHomeSupportAnonymousEmail;
      await createSupportIssueReport(appConfig.apiBaseUrl, {
        category: "be_home_contact",
        firstName: supportFirstName.trim(),
        email: effectiveReplyToEmail,
        subject: supportSubject.trim(),
        description: supportDescription.trim(),
        marketingConsentGranted: showSupportConsent && supportMarketingConsent,
        marketingConsentTextVersion: showSupportConsent && supportMarketingConsent ? beHomeSupportConsentTextVersion : null,
        pageUrl: window.location.href,
        apiBaseUrl: appConfig.apiBaseUrl,
        occurredAt: new Date().toISOString(),
        errorMessage: null,
        technicalDetails: null,
        userAgent: typeof navigator === "undefined" ? null : navigator.userAgent,
        language: typeof navigator === "undefined" ? null : navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        viewportWidth: typeof window.innerWidth === "number" ? window.innerWidth : null,
        viewportHeight: typeof window.innerHeight === "number" ? window.innerHeight : null,
        screenWidth: typeof window.screen?.width === "number" ? window.screen.width : null,
        screenHeight: typeof window.screen?.height === "number" ? window.screen.height : null,
      });

      setSupportModalOpen(false);
      setSupportStatusMessage("Your support request is on its way. We'll follow up as soon as we can.");
    } catch (error) {
      setSupportRequestError("We couldn't send your support request right now. Please try again in a moment.");
    } finally {
      setSubmittingSupportRequest(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold uppercase tracking-[0.08em] text-white">Contact Us</h1>
          <p className="text-sm leading-7 text-slate-300">
            If something on Board Enthusiasts is not working the way you expected, we&apos;re here to help.
          </p>
        </div>

        <section className="app-panel p-6">
          <div className="eyebrow">Support</div>
          <h2>Email the BE team.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Reach us at <a className="text-cyan-100 transition hover:text-white" href={supportEmailHref}>{supportEmailAddress}</a>. We&apos;ll help with sign-in issues, broken pages, account questions, and anything else that seems off in the site.
          </p>
          {supportStatusMessage ? (
            <div className="mt-4 rounded-[1.2rem] border border-emerald-300/35 bg-emerald-400/10 px-4 py-3 text-sm text-cyan-50">
              {supportStatusMessage}
            </div>
          ) : null}
          <div className="card-actions mt-5">
            {beHomeSupportEnabled ? (
              <button className="primary-button" type="button" onClick={openSupportModal}>Email Support</button>
            ) : (
              <a className="primary-button" href={supportEmailHref}>Email Support</a>
            )}
            <Link className="secondary-button" to="/browse">Browse the Index</Link>
          </div>
        </section>

        <section className="home-card-grid">
          <section className="app-panel p-6">
            <div className="eyebrow">What to include</div>
            <h2>Help us understand what happened.</h2>
            <ul className="bullet-list mt-3">
              <li>Tell us what you were trying to do.</li>
              <li>Include the page or feature where the problem happened.</li>
              <li>Share a screenshot if one helps explain the issue faster.</li>
            </ul>
          </section>
          <section className="app-panel p-6">
            <div className="eyebrow">Before you email</div>
            <h2>A couple of quick checks can help.</h2>
            <ul className="bullet-list mt-3">
              <li>Refresh the page and try again.</li>
              <li>Make sure your internet connection is still active.</li>
              <li>If you were signing in, double-check that you are using the right account or provider.</li>
            </ul>
          </section>
        </section>
      </section>

      {beHomeSupportEnabled && supportModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/82 p-4 pt-6 backdrop-blur-sm" onClick={closeSupportModal}>
          <section
            ref={supportDialogRef}
            className="app-panel my-4 grid min-h-0 w-full max-w-3xl grid-rows-[auto,minmax(0,1fr)] overflow-hidden overscroll-contain p-6 md:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="be-home-support-title"
            onClick={(event) => event.stopPropagation()}
            style={supportDialogMaxHeight ? { maxHeight: supportDialogMaxHeight } : undefined}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow">BE Home support</div>
                <h2 id="be-home-support-title" className="mt-2 text-2xl font-bold text-white">
                  Send a support request
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                  Tell us what went wrong on your Board and we&apos;ll send it straight to the BE support inbox.
                </p>
              </div>
              <button
                className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-slate-950/70 text-slate-100 transition hover:border-cyan-300/60 hover:text-cyan-100"
                type="button"
                aria-label="Close support request dialog"
                title="Close"
                onClick={closeSupportModal}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
                  <path d="M6 6 18 18" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </div>

            <form
              ref={supportFormRef}
              className="mt-4 min-h-0 overflow-y-scroll overscroll-contain pr-2"
              onSubmit={(event) => void handleSupportSubmit(event)}
              style={{
                paddingBottom: supportFormBottomPadding,
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="First name"
                  required
                  hint={showSupportValidation && supportFirstNameError ? supportFirstNameError : undefined}
                  hintTone={showSupportValidation && supportFirstNameError ? "error" : "default"}
                >
                  <div data-support-field="true">
                    <input
                      type="text"
                      value={supportFirstName}
                      onChange={(event) => setSupportFirstName(event.currentTarget.value)}
                      autoComplete="given-name"
                      onFocus={handleSupportFieldFocus}
                    />
                  </div>
                </Field>

                <Field
                  label="From email"
                  hint={
                    emailLocked
                      ? "Using the email address from your BE account."
                      : supportEmailError
                        ? supportEmailError
                        : "Leave this blank if you'd prefer to stay anonymous on Board."
                  }
                  hintTone={supportEmailError ? "error" : "default"}
                >
                  <div data-support-field="true">
                    <input
                      type="email"
                      value={emailLocked ? signedInEmail : supportEmail}
                      onChange={(event) => setSupportEmail(event.currentTarget.value)}
                      autoComplete="email"
                      disabled={emailLocked}
                      onFocus={handleSupportFieldFocus}
                    />
                  </div>
                </Field>
              </div>

              <Field
                label="Subject"
                required
                hint={showSupportValidation && supportSubjectError ? supportSubjectError : undefined}
                hintTone={showSupportValidation && supportSubjectError ? "error" : "default"}
              >
                <div data-support-field="true">
                  <input
                    type="text"
                    value={supportSubject}
                    onChange={(event) => setSupportSubject(event.currentTarget.value)}
                    onFocus={handleSupportFieldFocus}
                  />
                </div>
              </Field>

              <Field
                label="Description"
                required
                hint={showSupportValidation && supportDescriptionError ? supportDescriptionError : undefined}
                hintTone={showSupportValidation && supportDescriptionError ? "error" : "default"}
                reserveHintSpace={false}
              >
                <div data-support-field="true">
                  <textarea
                    rows={8}
                    value={supportDescription}
                    onChange={(event) => setSupportDescription(event.currentTarget.value)}
                    onFocus={handleSupportFieldFocus}
                  />
                </div>
              </Field>

              {showSupportConsent ? (
                <label className="field block">
                  <span className="text-sm text-slate-300">
                    <input
                      className="mr-3 align-middle"
                      type="checkbox"
                      checked={supportMarketingConsent}
                      onChange={(event) => setSupportMarketingConsent(event.currentTarget.checked)}
                    />
                    I&apos;m okay with occasional Board Enthusiasts email updates about releases, tools, and community news.
                  </span>
                  <small className="field-hint-slot">
                    You can unsubscribe at any time.
                  </small>
                </label>
              ) : null}

              {supportRequestError ? (
                <div className="rounded-[1rem] border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {supportRequestError}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button className="secondary-button" type="button" onClick={closeSupportModal} disabled={submittingSupportRequest}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={submittingSupportRequest}>
                  {submittingSupportRequest ? "Sending..." : "Send request"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
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
