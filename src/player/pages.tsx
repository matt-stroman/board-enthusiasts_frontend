import type { BoardProfile, CatalogMediaTypeDefinition, CatalogTitleSummary, CurrentUserResponse, PlayerTitleReportSummary, StudioSummary, TitleReportDetail, UserNotification, UserProfile } from "@board-enthusiasts/migration-contract";
import { useDeferredValue, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  addPlayerTitleReportMessage,
  enrollAsDeveloper,
  getBoardProfile,
  getCurrentUserNotifications,
  getDeveloperEnrollment,
  getPlayerFollowedStudios,
  getPlayerLibrary,
  getPlayerTitleReport,
  getPlayerTitleReports,
  getPlayerWishlist,
  getUserProfile,
  listCatalogMediaTypes,
  listManagedStudios,
  markCurrentUserNotificationRead,
  removeStudioFromPlayerFollows,
  removeTitleFromPlayerLibrary,
  removeTitleFromPlayerWishlist,
  updateUserProfile,
} from "../api";
import { hasPlatformRole, passwordRecoveryRedirectStorageKey, useAuth, type SignUpInput, type SocialAuthIntent, type SocialAuthProvider } from "../auth";
import { buildAuthRedirectUrl } from "../auth-redirects";
import { buildAcceptedMimeTypeError, normalizeImageUpload } from "../media-upload";
import {
  accountSignupConsentTextVersion,
  appConfig,
  AVATAR_UPLOAD_ACCEPT,
  avatarUploadPolicy,
  AvatarEditor,
  canViewTitleReportMessageAudience,
  createAvatarEditorState,
  CompactTitleList,
  EmptyState,
  ErrorPanel,
  Field,
  fallbackCatalogMediaTypes,
  getCatalogMediaAspectRatioValue,
  getFallbackArtworkUrl,
  getFirstCatalogImageByType,
  getStudioLogoImageUrl,
  getWorkspaceWorkflowButtonClass,
  formatNotificationCategory,
  formatNotificationTimestamp,
  formatReportStatus,
  formatTimestamp,
  getCaptchaMode,
  getConnectedAccountSummary,
  getCurrentUserAvatarUrl,
  getInitials,
  getMfaQrCodeImageSource,
  getPasswordPolicyErrors,
  getSocialAuthProviderLabel,
  isApiErrorStatus,
  isKnownStudioLink,
  isSocialAuthProvider,
  LoadingPanel,
  PasswordField,
  PlayerReportList,
  PLAYER_PAGE_DRAFT_STORAGE_KEY,
  readAvatarUpload,
  readAuthRedirectErrorMessage,
  readSessionStorageJson,
  readSessionStorageValue,
  removeSessionStorageJson,
  removeSessionStorageValue,
  renderCurrentUserAvatar,
  restoreAvatarEditorState,
  sanitizeReturnToPath,
  SIGN_IN_OAUTH_RETURN_TO_STORAGE_KEY,
  SIGN_IN_PAGE_DRAFT_STORAGE_KEY,
  SocialAuthProviderIcon,
  StudioLinkIcon,
  CaptchaWidget,
  TitleReportConversation,
  UnderlineActionLink,
  validateEmailInput,
  validatePasswordConfirmation,
  writeSessionStorageJson,
  writeSessionStorageValue,
  type AvatarEditorState,
  type ConnectedAccountIdentity,
  type PlayerPageDraftState,
  type SignInPageDraftState,
} from "../app-core";

function ArrowOutwardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path d="m256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
    </svg>
  );
}

const panelIconButtonClassName =
  "app-icon-button border-white/12 bg-slate-950/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_24px_rgba(0,0,0,0.22)] hover:bg-slate-950/95";
const dangerPanelIconButtonClassName =
  "app-icon-button border-rose-300/35 bg-rose-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_24px_rgba(42,8,16,0.28)] hover:bg-rose-900/90";

export function SignInPage() {
  const {
    client,
    session,
    currentUser,
    discordAuthEnabled,
    githubAuthEnabled,
    googleAuthEnabled,
    signIn,
    signInWithSocialAuth,
    signUp,
    requestPasswordReset,
    verifyRecoveryCode,
    updatePassword,
    signOut,
  } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const recoveryMode = searchParams.get("mode") === "recovery";
  const signInDraftRef = useRef<SignInPageDraftState | null>(null);
  if (signInDraftRef.current === null) {
    const storedDraft = readSessionStorageJson<Partial<SignInPageDraftState>>(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
    signInDraftRef.current = {
      email: storedDraft?.email ?? "",
      password: storedDraft?.password ?? "",
      showSignInPassword: storedDraft?.showSignInPassword ?? false,
      mfaChallengeOpen: storedDraft?.mfaChallengeOpen ?? false,
      mfaChallengePurpose: storedDraft?.mfaChallengePurpose === "recovery" ? "recovery" : "sign-in",
      mfaCode: storedDraft?.mfaCode ?? "",
      mfaFactorId: typeof storedDraft?.mfaFactorId === "string" ? storedDraft.mfaFactorId : null,
      mfaFactorLabel: storedDraft?.mfaFactorLabel ?? "Authenticator app",
      recoveryModalOpen: storedDraft?.recoveryModalOpen ?? recoveryMode,
      recoveryStep: storedDraft?.recoveryStep === "code" || storedDraft?.recoveryStep === "reset" ? storedDraft.recoveryStep : recoveryMode ? "reset" : "request",
      registrationEmail: storedDraft?.registrationEmail ?? "",
      registrationPassword: storedDraft?.registrationPassword ?? "",
      showRegistrationPassword: storedDraft?.showRegistrationPassword ?? false,
      registrationMarketingOptIn: storedDraft?.registrationMarketingOptIn ?? false,
      recoveryEmail: storedDraft?.recoveryEmail ?? "",
      recoveryCode: storedDraft?.recoveryCode ?? "",
      recoveryPassword: storedDraft?.recoveryPassword ?? "",
      recoveryConfirmPassword: storedDraft?.recoveryConfirmPassword ?? "",
      showRecoveryPassword: storedDraft?.showRecoveryPassword ?? false,
      showRecoveryConfirmPassword: storedDraft?.showRecoveryConfirmPassword ?? false,
    };
  }
  const signInDraft = signInDraftRef.current;
  const [email, setEmail] = useState(signInDraft.email);
  const [password, setPassword] = useState(signInDraft.password);
  const [showSignInPassword, setShowSignInPassword] = useState(signInDraft.showSignInPassword);
  const [mfaChallengeOpen, setMfaChallengeOpen] = useState(signInDraft.mfaChallengeOpen);
  const [mfaChallengePurpose, setMfaChallengePurpose] = useState<"sign-in" | "recovery">(signInDraft.mfaChallengePurpose);
  const [mfaCode, setMfaCode] = useState(signInDraft.mfaCode);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(signInDraft.mfaFactorId);
  const [mfaFactorLabel, setMfaFactorLabel] = useState(signInDraft.mfaFactorLabel);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState<SocialAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(signInDraft.recoveryModalOpen);
  const [recoveryStep, setRecoveryStep] = useState<"request" | "code" | "reset">(signInDraft.recoveryStep);
  const [registrationEmail, setRegistrationEmail] = useState(signInDraft.registrationEmail);
  const [registrationPassword, setRegistrationPassword] = useState(signInDraft.registrationPassword);
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(signInDraft.showRegistrationPassword);
  const [registrationMarketingOptIn, setRegistrationMarketingOptIn] = useState(signInDraft.registrationMarketingOptIn);
  const [registrationEmailError, setRegistrationEmailError] = useState<string | null>(null);
  const [registrationPasswordErrors, setRegistrationPasswordErrors] = useState<string[]>([]);
  const [registrationCaptchaToken, setRegistrationCaptchaToken] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState(signInDraft.recoveryEmail);
  const [recoveryCaptchaToken, setRecoveryCaptchaToken] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState(signInDraft.recoveryCode);
  const [recoveryPassword, setRecoveryPassword] = useState(signInDraft.recoveryPassword);
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState(signInDraft.recoveryConfirmPassword);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(signInDraft.showRecoveryPassword);
  const [showRecoveryConfirmPassword, setShowRecoveryConfirmPassword] = useState(signInDraft.showRecoveryConfirmPassword);
  const [registering, setRegistering] = useState(false);
  const [requestingRecovery, setRequestingRecovery] = useState(false);
  const [verifyingRecoveryCode, setVerifyingRecoveryCode] = useState(false);
  const [completingRecovery, setCompletingRecovery] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryStatusMessage, setRecoveryStatusMessage] = useState<string | null>(null);
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(null);
  const captchaMode = getCaptchaMode(appConfig.turnstileSiteKey);
  const captchaRequired = captchaMode !== "disabled";

  const returnTo = sanitizeReturnToPath(searchParams.get("returnTo") ?? readSessionStorageValue(SIGN_IN_OAUTH_RETURN_TO_STORAGE_KEY));
  const enabledSocialAuthProviders = ([
    { provider: "google", enabled: googleAuthEnabled },
    { provider: "github", enabled: githubAuthEnabled },
    { provider: "discord", enabled: discordAuthEnabled },
  ] as const).filter((entry) => entry.enabled);
  const socialAuthEnabled = enabledSocialAuthProviders.length > 0;
  const suppressAuthenticatedRedirect = recoveryMode || recoveryModalOpen || mfaChallengeOpen || submitting || Boolean(socialSubmitting);

  function clearPendingOAuthReturnTo(): void {
    removeSessionStorageJson(SIGN_IN_OAUTH_RETURN_TO_STORAGE_KEY);
  }

  useEffect(() => {
    if (session && currentUser && !suppressAuthenticatedRedirect) {
      clearPendingOAuthReturnTo();
      navigate(returnTo, { replace: true });
    }
  }, [currentUser, navigate, returnTo, session, suppressAuthenticatedRedirect]);

  useEffect(() => {
    const redirectError = readAuthRedirectErrorMessage();
    if (!redirectError) {
      return;
    }

    setError(redirectError);
    clearPendingOAuthReturnTo();
    if (typeof window !== "undefined" && window.location.hash.includes("error")) {
      window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  useEffect(() => {
    if (recoveryMode) {
      removeSessionStorageValue(passwordRecoveryRedirectStorageKey);
      setRecoveryModalOpen(true);
      setRecoveryStep("reset");
      setRecoveryError(null);
      setPasswordRecoveryError(null);
      setRecoveryStatusMessage(null);
    }
  }, [recoveryMode]);

  useEffect(() => {
    const hasDraft =
      email.trim().length > 0 ||
      password.length > 0 ||
      mfaChallengeOpen ||
      mfaCode.trim().length > 0 ||
      recoveryModalOpen ||
      registrationEmail.trim().length > 0 ||
      registrationPassword.length > 0 ||
      registrationMarketingOptIn ||
      recoveryEmail.trim().length > 0 ||
      recoveryCode.trim().length > 0 ||
      recoveryPassword.length > 0 ||
      recoveryConfirmPassword.length > 0;

    if (!hasDraft) {
      removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
      return;
    }

    writeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY, {
      email,
      password,
      showSignInPassword,
      mfaChallengeOpen,
      mfaChallengePurpose,
      mfaCode,
      mfaFactorId,
      mfaFactorLabel,
      recoveryModalOpen,
      recoveryStep,
      registrationEmail,
      registrationPassword,
      showRegistrationPassword,
      registrationMarketingOptIn,
      recoveryEmail,
      recoveryCode,
      recoveryPassword,
      recoveryConfirmPassword,
      showRecoveryPassword,
      showRecoveryConfirmPassword,
    } satisfies SignInPageDraftState);
  }, [
    email,
    mfaFactorId,
    mfaFactorLabel,
    mfaChallengeOpen,
    mfaChallengePurpose,
    mfaCode,
    password,
    recoveryCode,
    recoveryConfirmPassword,
    recoveryEmail,
    recoveryModalOpen,
    recoveryPassword,
    recoveryStep,
    registrationEmail,
    registrationMarketingOptIn,
    registrationPassword,
    showRecoveryConfirmPassword,
    showRecoveryPassword,
    showRegistrationPassword,
    showSignInPassword,
  ]);
  const registrationPasswordHint = registrationPasswordErrors.length > 0 ? (
    <ul className="field-hint-list">
      {registrationPasswordErrors.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  ) : undefined;
  const registrationPasswordHintTone = registrationPasswordErrors.length > 0 ? "error" : "default";
  const registrationCanSubmit =
    registrationEmail.trim().length > 0 &&
    registrationPassword.length > 0 &&
    !registrationEmailError &&
    (!captchaRequired || Boolean(registrationCaptchaToken));

  function validateRegistrationEmail(): boolean {
    const nextError = validateEmailInput(registrationEmail);
    setRegistrationEmailError(nextError);
    return !nextError;
  }

  function validateRegistrationPassword(): boolean {
    const nextErrors = getPasswordPolicyErrors(registrationPassword);
    setRegistrationPasswordErrors(nextErrors);
    return nextErrors.length === 0;
  }

  function resetRegistrationForm(): void {
    setRegistrationEmail("");
    setRegistrationPassword("");
    setShowRegistrationPassword(false);
    setRegistrationMarketingOptIn(false);
    setRegistrationEmailError(null);
    setRegistrationPasswordErrors([]);
    setRegistrationCaptchaToken(null);
    setRegistrationError(null);
  }

  function openRegisterModal(): void {
    setRegistrationError(null);
    setRegisterModalOpen(true);
  }

  function closeRegisterModal(): void {
    setRegisterModalOpen(false);
    resetRegistrationForm();
    removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
  }

  function resetRecoveryState(): void {
    setRecoveryStep("request");
    setRecoveryEmail("");
    setRecoveryCaptchaToken(null);
    setRecoveryCode("");
    setRecoveryPassword("");
    setRecoveryConfirmPassword("");
    setShowRecoveryPassword(false);
    setShowRecoveryConfirmPassword(false);
    setRecoveryError(null);
    setRecoveryStatusMessage(null);
    setPasswordRecoveryError(null);
  }

  function openRecoveryModal(): void {
    resetRecoveryState();
    setRecoveryModalOpen(true);
  }

  function closeRecoveryModal(): void {
    setRecoveryModalOpen(false);
    resetRecoveryState();
    removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
    if (recoveryMode) {
      navigate("/auth/signin", { replace: true });
    }
  }

  async function sendRecoveryEmail(): Promise<void> {
    if (!recoveryEmail.trim()) {
      throw new Error("Email is required.");
    }
    if (captchaRequired && !recoveryCaptchaToken) {
      throw new Error("Complete the human verification challenge.");
    }

    await requestPasswordReset(recoveryEmail.trim(), recoveryCaptchaToken);
    setRecoveryCode("");
    setRecoveryStep("code");
    setRecoveryError(null);
    setRecoveryStatusMessage("If that email matches an account, a recovery link and code have been sent.");
  }

  async function beginMfaChallengeIfRequired(purpose: "sign-in" | "recovery"): Promise<boolean> {
    const assuranceResponse = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceResponse.error) {
      throw new Error(assuranceResponse.error.message);
    }

    if (assuranceResponse.data.nextLevel !== "aal2" || assuranceResponse.data.currentLevel === "aal2") {
      return false;
    }

    const factorsResponse = await client.auth.mfa.listFactors();
    if (factorsResponse.error) {
      throw new Error(factorsResponse.error.message);
    }

    const totpFactor = factorsResponse.data.totp[0] ?? factorsResponse.data.all.find((factor) => factor.factor_type === "totp" && factor.status === "verified");
    if (!totpFactor) {
      throw new Error("Multi-factor authentication is required, but no verified authenticator app is available.");
    }

    setMfaFactorId(totpFactor.id);
    setMfaFactorLabel(totpFactor.friendly_name?.trim() || "Authenticator app");
    setMfaChallengePurpose(purpose);
    setMfaChallengeOpen(true);
    setMfaCode("");
    setMfaError(null);
    if (purpose === "recovery") {
      setRecoveryStatusMessage(null);
      setPasswordRecoveryError(null);
    } else {
      setPageMessage("Enter the code from your authenticator app to finish signing in.");
    }
    return true;
  }

  async function finishPasswordRecovery(): Promise<void> {
    await updatePassword(recoveryPassword);
    try {
      await signOut({ tolerateNetworkFailure: true });
    } catch {
      // Password recovery is complete once the password change succeeds.
      // If session revocation cannot be confirmed, continue back to sign-in.
    }
    setRecoveryModalOpen(false);
    resetRecoveryState();
    setPageMessage("Password updated. Sign in with your new password.");
    removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
    navigate("/auth/signin", { replace: true });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setPageMessage(null);
    try {
      if (!email.trim()) {
        throw new Error("Email is required.");
      }
      if (!password) {
        throw new Error("Password is required.");
      }

      await signIn(email.trim(), password);
      if (await beginMfaChallengeIfRequired("sign-in")) {
        return;
      }

      removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
      clearPendingOAuthReturnTo();
      navigate(returnTo, { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMfaSubmitting(true);
    setMfaError(null);
    try {
      if (!mfaFactorId) {
        throw new Error("No authenticator app is available for this account.");
      }
      if (!mfaCode.trim()) {
        throw new Error("Authenticator code is required.");
      }

      const response = await client.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode.trim(),
      });
      if (response.error) {
        throw new Error(response.error.message);
      }

      const challengePurpose = mfaChallengePurpose;
      setMfaChallengeOpen(false);
      setMfaCode("");
      setMfaFactorId(null);
      setMfaChallengePurpose("sign-in");
      if (challengePurpose === "recovery") {
        try {
          await finishPasswordRecovery();
        } catch (nextError) {
          setPasswordRecoveryError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } else {
        removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
        clearPendingOAuthReturnTo();
        navigate(returnTo, { replace: true });
      }
    } catch (nextError) {
      setMfaError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setMfaSubmitting(false);
    }
  }

  async function handleCancelMfaChallenge(): Promise<void> {
    try {
      await signOut({ tolerateNetworkFailure: true });
    } catch {
      // Best-effort cleanup; the page stays on the sign-in screen either way.
    }

    setMfaChallengeOpen(false);
    setMfaCode("");
    setMfaFactorId(null);
    setMfaChallengePurpose("sign-in");
    setMfaError(null);
  }

  async function handleSocialSignIn(
    provider: SocialAuthProvider,
    intent: SocialAuthIntent = "sign-in",
    options?: { marketingOptIn?: boolean; marketingConsentTextVersion?: string | null }
  ): Promise<void> {
    setSocialSubmitting(provider);
    setError(null);
    setPageMessage(null);
    writeSessionStorageValue(SIGN_IN_OAUTH_RETURN_TO_STORAGE_KEY, returnTo);

    try {
      await signInWithSocialAuth(provider, intent, options);
      setSocialSubmitting(null);
    } catch (nextError) {
      clearPendingOAuthReturnTo();
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setSocialSubmitting(null);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setRegistering(true);
    setRegistrationError(null);
    setPageMessage(null);
    try {
      const emailValid = validateRegistrationEmail();
      const passwordValid = validateRegistrationPassword();
      if (!emailValid) {
        throw new Error("Enter a valid email address.");
      }
      if (!passwordValid) {
        throw new Error("Password does not meet the required policy.");
      }
      if (captchaRequired && !registrationCaptchaToken) {
        throw new Error("Complete the human verification challenge.");
      }

      const result = await signUp({
        email: registrationEmail.trim(),
        password: registrationPassword,
        captchaToken: registrationCaptchaToken,
        marketingOptIn: registrationMarketingOptIn,
        marketingConsentTextVersion: registrationMarketingOptIn ? accountSignupConsentTextVersion : null,
      } satisfies SignUpInput);
      if (result.requiresEmailConfirmation) {
        setPageMessage("Account created. Check your email to confirm the registration, then sign in.");
      } else {
        removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
        clearPendingOAuthReturnTo();
        navigate(returnTo, { replace: true });
      }
      setRegisterModalOpen(false);
      resetRegistrationForm();
      removeSessionStorageJson(SIGN_IN_PAGE_DRAFT_STORAGE_KEY);
    } catch (nextError) {
      setRegistrationError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setRegistering(false);
    }
  }

  async function handleRequestRecovery(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setRequestingRecovery(true);
    setRecoveryError(null);
    setRecoveryStatusMessage(null);
    try {
      await sendRecoveryEmail();
    } catch (nextError) {
      setRecoveryError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setRequestingRecovery(false);
    }
  }

  async function handleRecoveryCodeSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setVerifyingRecoveryCode(true);
    setRecoveryError(null);
    setRecoveryStatusMessage(null);
    try {
      if (!recoveryCode.trim()) {
        throw new Error("Recovery code is required.");
      }
      if (!recoveryEmail.trim()) {
        throw new Error("Email is required.");
      }

      await verifyRecoveryCode(recoveryEmail.trim(), recoveryCode.trim());
      setRecoveryStep("reset");
      setRecoveryError(null);
    } catch (nextError) {
      setRecoveryError(nextError instanceof Error ? nextError.message : "That recovery code was not accepted. Re-enter it or send another.");
    } finally {
      setVerifyingRecoveryCode(false);
    }
  }

  async function handleCompleteRecovery(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCompletingRecovery(true);
    setPasswordRecoveryError(null);
    try {
      if (!recoveryPassword) {
        throw new Error("New password is required.");
      }
      if (recoveryPassword !== recoveryConfirmPassword) {
        throw new Error("Password confirmation must match.");
      }

      if (await beginMfaChallengeIfRequired("recovery")) {
        return;
      }

      await finishPasswordRecovery();
    } catch (nextError) {
      setPasswordRecoveryError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setCompletingRecovery(false);
    }
  }

  return (
    <div className="page-grid narrow">
      <section className="mx-auto w-full max-w-xl app-panel p-8 md:p-10">
        <div className="auth-panel-header">
          <h1 className="auth-panel-title">Sign In</h1>
          <p className="auth-panel-copy">Use your email and password to sign in.</p>
        </div>

        <form className="mt-8 stack-form text-left" onSubmit={handleSubmit}>
          <Field label="Email">
            <input value={email} onChange={(event) => setEmail(event.currentTarget.value)} autoComplete="email" />
          </Field>
          <PasswordField
            label="Password"
            value={password}
            autoComplete="current-password"
            show={showSignInPassword}
            onChange={setPassword}
            onToggle={() => setShowSignInPassword((current) => !current)}
          />

          {error ? <p className="error-text">{error}</p> : null}
          {pageMessage ? <p className="success-text">{pageMessage}</p> : null}

          <button type="submit" className="primary-button mt-2 w-full" disabled={submitting || Boolean(socialSubmitting)}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>

          {socialAuthEnabled ? (
            <div className="mt-6 space-y-4">
              <div className="signin-divider" aria-hidden="true">
                <div className="signin-divider-line" />
                <span className="signin-divider-label">Or</span>
                <div className="signin-divider-line" />
              </div>
              <div className="social-auth-list">
                {enabledSocialAuthProviders.map(({ provider }) => {
                  const providerLabel = getSocialAuthProviderLabel(provider);
                  const isSubmitting = socialSubmitting === provider;
                  return (
                    <button
                      key={provider}
                      type="button"
                      className="social-auth-button"
                      disabled={Boolean(socialSubmitting)}
                      onClick={() => void handleSocialSignIn(provider, "sign-in")}
                    >
                      <span className="social-auth-icon-badge">
                        <SocialAuthProviderIcon provider={provider} />
                      </span>
                      <span className="social-auth-copy">{isSubmitting ? `Connecting to ${providerLabel}...` : `Sign in with ${providerLabel}`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </form>

        <div className="signin-utility-links">
          <UnderlineActionLink onClick={openRegisterModal}>
            Create an account
          </UnderlineActionLink>
          <UnderlineActionLink
            onClick={() => {
              openRecoveryModal();
            }}
          >
            I forgot my password
          </UnderlineActionLink>
        </div>
      </section>

      {registerModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8" onClick={closeRegisterModal}>
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
              <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="register-modal-title">
                <div className="auth-panel-header">
                  <h2 id="register-modal-title" className="auth-panel-title">Create your account</h2>
                  <p className="auth-panel-copy">
                    Sign up in a minute. Already have an account?{" "}
                    <UnderlineActionLink onClick={closeRegisterModal}>Login</UnderlineActionLink>
                  </p>
                </div>

                {socialAuthEnabled ? (
                  <div className="space-y-4">
                    <div className="social-auth-list">
                      {enabledSocialAuthProviders.map(({ provider }) => {
                        const providerLabel = getSocialAuthProviderLabel(provider);
                        const isSubmitting = socialSubmitting === provider;
                        return (
                          <button
                            key={`signup-${provider}`}
                            type="button"
                            className="social-auth-button"
                            disabled={registering || Boolean(socialSubmitting)}
                            onClick={() =>
                              void handleSocialSignIn(provider, "sign-up", {
                                marketingOptIn: registrationMarketingOptIn,
                                marketingConsentTextVersion: registrationMarketingOptIn ? accountSignupConsentTextVersion : null,
                              })
                            }
                          >
                            <span className="social-auth-icon-badge">
                              <SocialAuthProviderIcon provider={provider} />
                            </span>
                            <span className="social-auth-copy">{isSubmitting ? `Connecting to ${providerLabel}...` : `Sign up with ${providerLabel}`}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="signin-divider" aria-hidden="true">
                      <div className="signin-divider-line" />
                      <span className="signin-divider-label">Or</span>
                      <div className="signin-divider-line" />
                    </div>
                  </div>
                ) : null}

                <form className="stack-form text-left" onSubmit={handleRegister}>
                  <Field label="Email" required hint={registrationEmailError} hintTone={registrationEmailError ? "error" : "default"}>
                    <input
                      value={registrationEmail}
                      onChange={(event) => {
                        setRegistrationEmail(event.currentTarget.value);
                        setRegistrationEmailError(null);
                      }}
                      onBlur={validateRegistrationEmail}
                      autoComplete="email"
                      aria-invalid={Boolean(registrationEmailError)}
                    />
                  </Field>
                  <PasswordField
                    label="Password"
                    value={registrationPassword}
                    autoComplete="new-password"
                    show={showRegistrationPassword}
                    onChange={(value) => {
                      setRegistrationPassword(value);
                      setRegistrationPasswordErrors([]);
                    }}
                    onBlur={validateRegistrationPassword}
                    onToggle={() => setShowRegistrationPassword((current) => !current)}
                    hint={registrationPasswordHint}
                    hintTone={registrationPasswordHintTone}
                    required
                  />
                  <label className="landing-consent">
                    <input
                      type="checkbox"
                      checked={registrationMarketingOptIn}
                      onChange={(event) => setRegistrationMarketingOptIn(event.currentTarget.checked)}
                      disabled={registering || Boolean(socialSubmitting)}
                    />
                    <span>I want email updates from Board Enthusiasts about launch progress, new BE resources, community announcements, and future invites.</span>
                  </label>

                  {captchaRequired ? (
                    <div className="surface-panel-strong rounded-[1rem] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Human verification</div>
                      <CaptchaWidget
                        mode={captchaMode}
                        siteKey={appConfig.turnstileSiteKey}
                        token={registrationCaptchaToken}
                        onTokenChange={setRegistrationCaptchaToken}
                      />
                    </div>
                  ) : null}

                  {registrationError ? <p className="error-text">{registrationError}</p> : null}

                  <button type="submit" className="primary-button w-full" disabled={registering || !registrationCanSubmit || Boolean(socialSubmitting)}>
                    {registering ? "Creating account..." : "Create an account"}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {recoveryModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8" onClick={closeRecoveryModal}>
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
            <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="recovery-modal-title">
              {recoveryStep === "request" ? (
                <div className="auth-panel-header">
                  <h2 id="recovery-modal-title" className="auth-panel-title">
                    Reset your password
                  </h2>
                  <p className="auth-panel-copy">
                    Enter your email and we'll send you a link to reset your password.
                  </p>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="recovery-modal-title" className="text-2xl font-semibold text-white">
                      {recoveryStep === "code" ? "Recover access" : "Set new password"}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-300">
                      {recoveryStep === "code"
                        ? "Enter the recovery code from your email. If the code does not work, send another and try again."
                        : "Enter your new password to complete account recovery."}
                    </p>
                  </div>
                  <button className="secondary-button" type="button" onClick={closeRecoveryModal}>Close</button>
                </div>
              )}

              {recoveryStep === "request" ? (
                <form className="stack-form mt-2 text-left" onSubmit={handleRequestRecovery}>
                  <Field label="Email address" required>
                    <input value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.currentTarget.value)} autoComplete="email" />
                  </Field>

                  {captchaRequired ? (
                    <div className="surface-panel-strong rounded-[1rem] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Human verification</div>
                      <CaptchaWidget
                        mode={captchaMode}
                        siteKey={appConfig.turnstileSiteKey}
                        token={recoveryCaptchaToken}
                        onTokenChange={setRecoveryCaptchaToken}
                      />
                    </div>
                  ) : null}

                  <button type="submit" className="primary-button w-full" disabled={requestingRecovery}>
                    {requestingRecovery ? "Sending..." : "Send link to email"}
                  </button>

                  <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-2 text-sm text-slate-300">
                    <UnderlineActionLink
                      onClick={() => {
                        closeRecoveryModal();
                        openRegisterModal();
                      }}
                    >
                      Create an account
                    </UnderlineActionLink>
                    <UnderlineActionLink onClick={closeRecoveryModal}>Return to login</UnderlineActionLink>
                  </div>
                </form>
              ) : null}

              {recoveryStep === "code" ? (
                <form className="stack-form text-left" onSubmit={handleRecoveryCodeSubmit}>
                  <div className="text-sm text-slate-400 mb-4">Sent to {recoveryEmail}</div>
                  <Field label="Recovery code">
                    <input value={recoveryCode} onChange={(event) => setRecoveryCode(event.currentTarget.value)} autoComplete="one-time-code" />
                  </Field>

                  <div className="button-row">
                    <button type="submit" className="primary-button" disabled={verifyingRecoveryCode}>
                      {verifyingRecoveryCode ? "Confirming..." : "Confirm code"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={requestingRecovery}
                      onClick={() => {
                        setRecoveryStep("request");
                        setRecoveryError(null);
                        setRecoveryStatusMessage(null);
                      }}
                    >
                      Send another code
                    </button>
                  </div>
                </form>
              ) : null}

              {recoveryStep === "reset" ? (
              <form className="stack-form text-left" onSubmit={handleCompleteRecovery}>
                <PasswordField
                  label="New password"
                  value={recoveryPassword}
                  autoComplete="new-password"
                  show={showRecoveryPassword}
                  onChange={setRecoveryPassword}
                  onToggle={() => setShowRecoveryPassword((current) => !current)}
                />
                <PasswordField
                  label="Confirm password"
                  value={recoveryConfirmPassword}
                  autoComplete="new-password"
                  show={showRecoveryConfirmPassword}
                  onChange={setRecoveryConfirmPassword}
                  onToggle={() => setShowRecoveryConfirmPassword((current) => !current)}
                />

                {passwordRecoveryError ? <p className="error-text">{passwordRecoveryError}</p> : null}

                <div className="button-row">
                  <button type="submit" className="primary-button" disabled={completingRecovery}>
                    {completingRecovery ? "Updating password..." : "Save new password"}
                  </button>
                </div>
              </form>
              ) : null}

              {recoveryStatusMessage ? <p className="text-sm text-cyan-100">{recoveryStatusMessage}</p> : null}
              {recoveryError ? <p className="error-text">{recoveryError}</p> : null}
            </section>
            </div>
          </div>
        </div>
      ) : null}

      {mfaChallengeOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8" onClick={() => void handleCancelMfaChallenge()}>
          <div className="mx-auto max-w-xl" onClick={(event) => event.stopPropagation()}>
            <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="mfa-modal-title">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="mfa-modal-title" className="text-2xl font-semibold text-white">
                    {mfaChallengePurpose === "recovery" ? "Verify authenticator" : "Complete sign-in"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    {mfaChallengePurpose === "recovery"
                      ? `Enter the current code from ${mfaFactorLabel.toLowerCase()} to finish resetting your password.`
                      : `Enter the current code from ${mfaFactorLabel.toLowerCase()} to finish signing in.`}
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={() => void handleCancelMfaChallenge()}>Cancel</button>
              </div>

              <form className="stack-form text-left" onSubmit={handleMfaSubmit}>
                <Field label="Authenticator code">
                  <input value={mfaCode} onChange={(event) => setMfaCode(event.currentTarget.value)} autoComplete="one-time-code" inputMode="numeric" />
                </Field>

                {mfaError ? <p className="error-text">{mfaError}</p> : null}

                <div className="button-row">
                  <button type="submit" className="primary-button" disabled={mfaSubmitting}>
                    {mfaSubmitting ? "Verifying..." : "Verify code"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}


export function SignOutPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      try {
        await signOut();
      } finally {
        if (!cancelled) {
          navigate("/", { replace: true });
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, signOut]);

  return <LoadingPanel title="Signing out..." />;
}


export function PlayerPage() {
  const { client, session, currentUser, discordAuthEnabled, githubAuthEnabled, googleAuthEnabled, refreshCurrentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReportId = searchParams.get("reportId");
  const accessToken = session?.access_token ?? "";
  const authSubject = currentUser?.subject ?? "";
  const passwordSectionRef = useRef<HTMLDivElement | null>(null);
  const pendingPasswordSectionFocusRef = useRef(false);
  const playerDraftRef = useRef<PlayerPageDraftState | null>(null);
  if (playerDraftRef.current === null) {
    const storedDraft = readSessionStorageJson<Partial<PlayerPageDraftState>>(PLAYER_PAGE_DRAFT_STORAGE_KEY);
    playerDraftRef.current = {
      displayName: storedDraft?.displayName ?? "",
      firstName: storedDraft?.firstName ?? "",
      lastName: storedDraft?.lastName ?? "",
      email: storedDraft?.email ?? "",
      settingsCurrentPassword: storedDraft?.settingsCurrentPassword ?? "",
      showSettingsCurrentPassword: storedDraft?.showSettingsCurrentPassword ?? false,
      profileAvatar: restoreAvatarEditorState(storedDraft?.profileAvatar),
      profileEditMode: storedDraft?.profileEditMode ?? false,
      settingsEditMode: storedDraft?.settingsEditMode ?? false,
      newPassword: storedDraft?.newPassword ?? "",
      confirmNewPassword: storedDraft?.confirmNewPassword ?? "",
      showNewPassword: storedDraft?.showNewPassword ?? false,
      showConfirmNewPassword: storedDraft?.showConfirmNewPassword ?? false,
      mfaEnrollmentCode: storedDraft?.mfaEnrollmentCode ?? "",
      mfaDisableCode: storedDraft?.mfaDisableCode ?? "",
      reportReply: storedDraft?.reportReply ?? "",
      selectedReportId: typeof storedDraft?.selectedReportId === "string" ? storedDraft.selectedReportId : null,
    };
  }
  const playerDraft = playerDraftRef.current;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [boardProfile, setBoardProfile] = useState<BoardProfile | null>(null);
  const [displayName, setDisplayName] = useState(playerDraft.displayName);
  const [firstName, setFirstName] = useState(playerDraft.firstName);
  const [lastName, setLastName] = useState(playerDraft.lastName);
  const [email, setEmail] = useState(playerDraft.email);
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState(playerDraft.settingsCurrentPassword);
  const [showSettingsCurrentPassword, setShowSettingsCurrentPassword] = useState(playerDraft.showSettingsCurrentPassword);
  const [profileAvatar, setProfileAvatar] = useState<AvatarEditorState>(playerDraft.profileAvatar);
  const [profileEditMode, setProfileEditMode] = useState(playerDraft.profileEditMode);
  const [settingsEditMode, setSettingsEditMode] = useState(playerDraft.settingsEditMode);
  const [newPassword, setNewPassword] = useState(playerDraft.newPassword);
  const [confirmNewPassword, setConfirmNewPassword] = useState(playerDraft.confirmNewPassword);
  const [showNewPassword, setShowNewPassword] = useState(playerDraft.showNewPassword);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(playerDraft.showConfirmNewPassword);
  const [mfaEnrollmentCode, setMfaEnrollmentCode] = useState(playerDraft.mfaEnrollmentCode);
  const [mfaDisableCode, setMfaDisableCode] = useState(playerDraft.mfaDisableCode);
  const [developerAccessEnabled, setDeveloperAccessEnabled] = useState(false);
  const [verifiedDeveloper, setVerifiedDeveloper] = useState(false);
  const [mfaTotpFactor, setMfaTotpFactor] = useState<{ id: string; friendlyName: string | null; status: "verified" | "unverified" } | null>(null);
  const [mfaAssuranceLevel, setMfaAssuranceLevel] = useState<string | null>(null);
  const [mfaPendingEnrollment, setMfaPendingEnrollment] = useState<{ id: string; qrCode: string; secret: string; friendlyName: string } | null>(null);
  const [libraryTitles, setLibraryTitles] = useState<CatalogTitleSummary[]>([]);
  const [wishlistTitles, setWishlistTitles] = useState<CatalogTitleSummary[]>([]);
  const [followedStudios, setFollowedStudios] = useState<StudioSummary[]>([]);
  const [catalogMediaTypes, setCatalogMediaTypes] = useState<CatalogMediaTypeDefinition[]>(fallbackCatalogMediaTypes);
  const [reports, setReports] = useState<PlayerTitleReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(playerDraft.selectedReportId);
  const [selectedReport, setSelectedReport] = useState<TitleReportDetail | null>(null);
  const [reportReply, setReportReply] = useState(playerDraft.reportReply);
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmailChange, setPendingEmailChange] = useState<string | null>(null);
  const [connectedAccountIdentities, setConnectedAccountIdentities] = useState<ConnectedAccountIdentity[] | null>(null);
  const [connectedAccountsLoading, setConnectedAccountsLoading] = useState(false);
  const [connectedAccountsError, setConnectedAccountsError] = useState<string | null>(null);
  const [connectedAccountActionProvider, setConnectedAccountActionProvider] = useState<SocialAuthProvider | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedAccountIdentity | null>(null);
  const [passwordRequiredDisconnectTarget, setPasswordRequiredDisconnectTarget] = useState<ConnectedAccountIdentity | null>(null);
  const [disconnectModalError, setDisconnectModalError] = useState<string | null>(null);

  useEffect(() => {
    const nextPendingEmail =
      typeof session?.user?.new_email === "string" && session.user.new_email.trim().length > 0
        ? session.user.new_email.trim().toLowerCase()
        : null;
    setPendingEmailChange(nextPendingEmail);
  }, [session?.user?.new_email]);

  async function loadBoardProfileSafe(): Promise<BoardProfile | null> {
    try {
      const response = await getBoardProfile(appConfig.apiBaseUrl, accessToken);
      return response.boardProfile;
    } catch (nextError) {
      if (isApiErrorStatus(nextError, 404)) {
        return null;
      }

      throw nextError;
    }
  }

  async function loadConnectedAccountIdentities(): Promise<ConnectedAccountIdentity[]> {
    if (!client.auth.getUserIdentities) {
      const fallbackIdentities =
        currentUser?.identityProvider && currentUser.identityProvider !== "email"
          ? [
              {
                id: `${currentUser.subject}-${currentUser.identityProvider}`,
                user_id: currentUser.subject,
                identity_id: `${currentUser.subject}-${currentUser.identityProvider}`,
                provider: currentUser.identityProvider,
                identity_data: {
                  email: currentUser.email ?? undefined,
                },
              } satisfies ConnectedAccountIdentity,
            ]
          : currentUser?.email
            ? [
                {
                  id: `${currentUser.subject}-email`,
                  user_id: currentUser.subject,
                  identity_id: `${currentUser.subject}-email`,
                  provider: "email",
                  identity_data: {
                    email: currentUser.email,
                  },
                } satisfies ConnectedAccountIdentity,
              ]
            : [];
      setConnectedAccountIdentities(fallbackIdentities);
      setConnectedAccountsError(null);
      return fallbackIdentities;
    }

    setConnectedAccountsLoading(true);
    try {
      const response = await client.auth.getUserIdentities();
      if (response.error) {
        throw new Error(response.error.message);
      }

      const identities = (response.data?.identities ?? []) as ConnectedAccountIdentity[];
      setConnectedAccountIdentities(identities);
      setConnectedAccountsError(null);
      return identities;
    } catch (nextError) {
      setConnectedAccountIdentities([]);
      setConnectedAccountsError("We couldn't load your connected sign-in options right now.");
      return [];
    } finally {
      setConnectedAccountsLoading(false);
    }
  }

  async function refreshReportList(preferredReportId?: string | null): Promise<void> {
    const response = await getPlayerTitleReports(appConfig.apiBaseUrl, accessToken);
    setReports(response.reports);
    const nextSelectedReportId =
      response.reports.find((report) => report.id === preferredReportId)?.id ??
      response.reports.find((report) => report.id === requestedReportId)?.id ??
      response.reports.find((report) => report.id === selectedReportId)?.id ??
      response.reports[0]?.id ??
      null;
    setSelectedReportId(nextSelectedReportId);
  }

  async function loadMfaState(): Promise<{
    factor: { id: string; friendlyName: string | null; status: "verified" | "unverified" } | null;
    assuranceLevel: string | null;
  }> {
    const [factorsResponse, assuranceResponse] = await Promise.all([
      client.auth.mfa.listFactors(),
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factorsResponse.error) {
      throw new Error(factorsResponse.error.message);
    }
    if (assuranceResponse.error) {
      throw new Error(assuranceResponse.error.message);
    }

    const totpFactor = factorsResponse.data.totp[0] ?? factorsResponse.data.all.find((factor) => factor.factor_type === "totp");
    return {
      factor: totpFactor
        ? {
            id: totpFactor.id,
            friendlyName: totpFactor.friendly_name?.trim() || null,
            status: totpFactor.status,
          }
        : null,
      assuranceLevel: assuranceResponse.data.currentLevel ?? "aal1",
    };
  }

  async function confirmCurrentPassword(passwordToConfirm: string): Promise<void> {
    const currentEmail = profile?.email?.trim().toLowerCase() ?? "";
    if (!currentEmail) {
      throw new Error("Email is not available for this account.");
    }
    if (!passwordToConfirm) {
      throw new Error("Current password is required.");
    }

    const response = await client.auth.signInWithPassword({
      email: currentEmail,
      password: passwordToConfirm,
    });
    if (response.error) {
      throw new Error("Current password was not accepted.");
    }
  }

  useEffect(() => {
    const hasDraft =
      profileEditMode ||
      settingsEditMode ||
      settingsCurrentPassword.length > 0 ||
      newPassword.length > 0 ||
      confirmNewPassword.length > 0 ||
      mfaEnrollmentCode.trim().length > 0 ||
      mfaDisableCode.trim().length > 0 ||
      reportReply.trim().length > 0;
    if (!hasDraft) {
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      return;
    }

    writeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY, {
      displayName,
      firstName,
      lastName,
      email,
      settingsCurrentPassword,
      showSettingsCurrentPassword,
      profileAvatar,
      profileEditMode,
      settingsEditMode,
      newPassword,
      confirmNewPassword,
      showNewPassword,
      showConfirmNewPassword,
      mfaEnrollmentCode,
      mfaDisableCode,
      reportReply,
      selectedReportId,
    } satisfies PlayerPageDraftState);
  }, [
    confirmNewPassword,
    displayName,
    email,
    firstName,
    lastName,
    mfaDisableCode,
    mfaEnrollmentCode,
    newPassword,
    profileAvatar,
    profileEditMode,
    reportReply,
    selectedReportId,
    settingsCurrentPassword,
    settingsEditMode,
    showConfirmNewPassword,
    showNewPassword,
    showSettingsCurrentPassword,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [profileResponse, enrollmentResponse, boardProfileResponse, libraryResponse, wishlistResponse, followedStudiosResponse, mediaTypesResponse] = await Promise.all([
          getUserProfile(appConfig.apiBaseUrl, accessToken),
          getDeveloperEnrollment(appConfig.apiBaseUrl, accessToken),
          loadBoardProfileSafe(),
          getPlayerLibrary(appConfig.apiBaseUrl, accessToken),
          getPlayerWishlist(appConfig.apiBaseUrl, accessToken),
          getPlayerFollowedStudios(appConfig.apiBaseUrl, accessToken),
          listCatalogMediaTypes(appConfig.apiBaseUrl, accessToken).catch(() => ({ mediaTypes: fallbackCatalogMediaTypes })),
        ]);
        const reportsResponse = await getPlayerTitleReports(appConfig.apiBaseUrl, accessToken);
        const [mfaState, identities] = await Promise.all([loadMfaState(), loadConnectedAccountIdentities()]);
        if (cancelled) {
          return;
        }

        setProfile(profileResponse.profile);
        setBoardProfile(boardProfileResponse);
        setDisplayName(profileEditMode ? displayName : profileResponse.profile.displayName ?? "");
        setFirstName(settingsEditMode ? firstName : profileResponse.profile.firstName ?? "");
        setLastName(settingsEditMode ? lastName : profileResponse.profile.lastName ?? "");
        setEmail(settingsEditMode ? email : pendingEmailChange ?? profileResponse.profile.email ?? "");
        setProfileAvatar(profileEditMode ? profileAvatar : createAvatarEditorState(profileResponse.profile));
        setDeveloperAccessEnabled(enrollmentResponse.developerEnrollment.developerAccessEnabled);
        setVerifiedDeveloper(enrollmentResponse.developerEnrollment.verifiedDeveloper);
        setMfaTotpFactor(mfaState.factor);
        setMfaAssuranceLevel(mfaState.assuranceLevel);
        if (mfaState.factor?.status === "verified") {
          setMfaPendingEnrollment(null);
        }
        setConnectedAccountIdentities(identities);
        setLibraryTitles(libraryResponse.titles);
        setWishlistTitles(wishlistResponse.titles);
        setFollowedStudios(followedStudiosResponse.studios);
        setCatalogMediaTypes(mediaTypesResponse.mediaTypes.length > 0 ? mediaTypesResponse.mediaTypes : fallbackCatalogMediaTypes);
        setReports(reportsResponse.reports);
        setSelectedReportId(
          reportsResponse.reports.find((report) => report.id === requestedReportId)?.id ??
          reportsResponse.reports.find((report) => report.id === selectedReportId)?.id ??
          reportsResponse.reports[0]?.id ??
          null,
        );
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
  }, [authSubject, pendingEmailChange, requestedReportId]);

  const hasLocalPassword =
    connectedAccountIdentities === null
      ? currentUser?.identityProvider === "email"
      : connectedAccountIdentities.some((identity) => identity.provider === "email");
  const connectedSocialAccounts = (connectedAccountIdentities ?? []).filter((identity): identity is ConnectedAccountIdentity & { provider: SocialAuthProvider } =>
    isSocialAuthProvider(identity.provider),
  );
  const connectedAccountIdentityByProvider = new Map(connectedSocialAccounts.map((identity) => [identity.provider, identity] as const));
  const availableConnectedAccountProviders = (["google", "github", "discord"] as const).filter((provider) => {
    const enabled = provider === "google" ? googleAuthEnabled : provider === "github" ? githubAuthEnabled : discordAuthEnabled;
    return enabled || connectedAccountIdentityByProvider.has(provider);
  });

  function focusPasswordSection(): void {
    if (activeWorkflow !== "account-settings") {
      pendingPasswordSectionFocusRef.current = true;
      navigate("/player?workflow=account-settings");
      return;
    }

    if (passwordSectionRef.current && typeof passwordSectionRef.current.scrollIntoView === "function") {
      passwordSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function requestConnectedAccountDisconnect(identity: ConnectedAccountIdentity & { provider: SocialAuthProvider }): void {
    setMessage(null);
    setError(null);
    setDisconnectModalError(null);

    if (!hasLocalPassword && connectedSocialAccounts.length <= 1) {
      setPasswordRequiredDisconnectTarget(identity);
      return;
    }

    setDisconnectTarget(identity);
  }

  async function handleConnectConnectedAccount(provider: SocialAuthProvider): Promise<void> {
    setConnectedAccountActionProvider(provider);
    setConnectedAccountsError(null);
    setMessage(null);
    setError(null);
    try {
      if (!client.auth.linkIdentity) {
        throw new Error("Connected account linking is not available right now.");
      }

      writeSessionStorageValue(SIGN_IN_OAUTH_RETURN_TO_STORAGE_KEY, "/player?workflow=account-connected-accounts");
      const response = await client.auth.linkIdentity({
        provider,
        options: {
          redirectTo: buildAuthRedirectUrl(window.location.origin),
        },
      });
      if (response.error) {
        throw new Error("We couldn't start that connection right now. Please try again.");
      }
    } catch (nextError) {
      setConnectedAccountsError(nextError instanceof Error ? nextError.message : String(nextError));
      setConnectedAccountActionProvider(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedReport(): Promise<void> {
      if (!selectedReportId) {
        setSelectedReport(null);
        return;
      }

      setReportLoading(true);
      try {
        const response = await getPlayerTitleReport(appConfig.apiBaseUrl, accessToken, selectedReportId);
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
          setReportLoading(false);
        }
      }
    }

    void loadSelectedReport();
    return () => {
      cancelled = true;
    };
  }, [authSubject, selectedReportId]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!profileEditMode) {
      setProfileEditMode(true);
      setMessage(null);
      setError(null);
      return;
    }

    setSaving(true);
    try {
      const response = await updateUserProfile(appConfig.apiBaseUrl, accessToken, {
        displayName,
        avatarUrl: profileAvatar.mode === "url" ? profileAvatar.url.trim() || null : null,
        avatarDataUrl: profileAvatar.mode === "upload" ? profileAvatar.dataUrl : null,
      });
      setProfile(response.profile);
      setDisplayName(response.profile.displayName ?? "");
      setProfileAvatar(createAvatarEditorState(response.profile));
      setProfileEditMode(false);
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      await refreshCurrentUser();
      setMessage("Profile updated.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleProfileAvatarUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) {
      setProfileAvatar((current) => ({ ...current, dataUrl: null, fileName: null }));
      return;
    }

    try {
      const upload = await readAvatarUpload(event);
      setProfileAvatar((current) => ({ ...current, mode: "upload", dataUrl: upload.dataUrl, fileName: upload.fileName }));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  async function handleSettingsSave(): Promise<void> {
    if (!settingsEditMode) {
      setSettingsEditMode(true);
      setMessage(null);
      setError(null);
      return;
    }

    setSaving(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const currentEmail = profile?.email?.trim().toLowerCase() ?? "";
      const emailChanged = normalizedEmail !== currentEmail;

      if (normalizedEmail.length === 0) {
        throw new Error("Email is required.");
      }

      let nextPendingEmail = pendingEmailChange;
      if (emailChanged) {
        if (!hasLocalPassword) {
          throw new Error("Add a password before changing your sign-in email.");
        }
        const emailUpdate = await client.auth.updateUser({ email: normalizedEmail });
        if (emailUpdate.error) {
          throw new Error(emailUpdate.error.message);
        }

        const updatedAuthUser = emailUpdate.data.user;
        nextPendingEmail =
          typeof updatedAuthUser?.new_email === "string" && updatedAuthUser.new_email.trim().length > 0
            ? updatedAuthUser.new_email.trim().toLowerCase()
            : null;
      }

      const response = await updateUserProfile(appConfig.apiBaseUrl, accessToken, {
        firstName,
        lastName,
      });
      await refreshCurrentUser();
      setProfile(response.profile);
      setFirstName(response.profile.firstName ?? "");
      setLastName(response.profile.lastName ?? "");
      setEmail(nextPendingEmail ?? normalizedEmail);
      setPendingEmailChange(nextPendingEmail);
      setSettingsEditMode(false);
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage(
        emailChanged && nextPendingEmail
          ? `Settings updated. Confirm the email change from the message sent to ${nextPendingEmail}.`
          : "Settings updated.",
      );
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChangeSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      const requiresCurrentPassword = hasLocalPassword;
      if (requiresCurrentPassword && !settingsCurrentPassword) {
        throw new Error("Current password is required.");
      }
      if (!newPassword) {
        throw new Error("New password is required.");
      }

      const passwordErrors = getPasswordPolicyErrors(newPassword);
      if (passwordErrors.length > 0) {
        throw new Error(passwordErrors[0] ?? "Password does not meet the required policy.");
      }
      if (validatePasswordConfirmation(newPassword, confirmNewPassword)) {
        throw new Error("Password confirmation must match.");
      }

      if (requiresCurrentPassword) {
        await confirmCurrentPassword(settingsCurrentPassword);
      }
      const response = await client.auth.updateUser(
        requiresCurrentPassword ? { password: newPassword, current_password: settingsCurrentPassword } : { password: newPassword },
      );
      if (response.error) {
        throw new Error(response.error.message);
      }

      await loadConnectedAccountIdentities();
      await refreshCurrentUser();
      setSettingsCurrentPassword("");
      setShowSettingsCurrentPassword(false);
      setNewPassword("");
      setConfirmNewPassword("");
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage(requiresCurrentPassword ? "Password updated." : "Password set. You can now sign in with your email and password too.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnectConnectedAccount(): Promise<void> {
    if (!disconnectTarget) {
      return;
    }

    setSaving(true);
    setConnectedAccountActionProvider(isSocialAuthProvider(disconnectTarget.provider) ? disconnectTarget.provider : null);
    setDisconnectModalError(null);
    try {
      if (!client.auth.unlinkIdentity) {
        throw new Error("Connected account management is not available right now.");
      }

      const response = await client.auth.unlinkIdentity(disconnectTarget);
      if (response.error) {
        throw new Error(response.error.message || "We couldn't disconnect that sign-in option right now. Please try again.");
      }

      const disconnectedProvider = disconnectTarget.provider as SocialAuthProvider;
      setConnectedAccountIdentities((current) =>
        current ? current.filter((identity) => identity.id !== disconnectTarget.id && identity.identity_id !== disconnectTarget.identity_id) : current,
      );
      setDisconnectTarget(null);
      setMessage(`${getSocialAuthProviderLabel(disconnectedProvider)} disconnected. You can reconnect it any time.`);
      setError(null);
      void refreshCurrentUser();
    } catch (nextError) {
      const nextMessage = nextError instanceof Error ? nextError.message : String(nextError);
      setDisconnectModalError(nextMessage);
      setError(nextMessage);
      setMessage(null);
    } finally {
      setConnectedAccountActionProvider(null);
      setSaving(false);
    }
  }

  async function handleStartMfaEnrollment(): Promise<void> {
    setSaving(true);
    try {
      if (mfaTotpFactor?.status === "unverified") {
        const unenrollResponse = await client.auth.mfa.unenroll({ factorId: mfaTotpFactor.id });
        if (unenrollResponse.error) {
          throw new Error(unenrollResponse.error.message);
        }
      }

      const response = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Board Enthusiasts Authenticator",
        issuer: "Board Enthusiasts",
      });
      if (response.error) {
        throw new Error(response.error.message);
      }

      setMfaPendingEnrollment({
        id: response.data.id,
        qrCode: response.data.totp.qr_code,
        secret: response.data.totp.secret,
        friendlyName: response.data.friendly_name ?? "Board Enthusiasts Authenticator",
      });
      setMfaEnrollmentCode("");
      setMessage("Scan the authenticator QR code, then enter the current code to finish enabling MFA.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyMfaEnrollment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (!mfaPendingEnrollment) {
        throw new Error("Start MFA setup before verifying a code.");
      }
      if (!mfaEnrollmentCode.trim()) {
        throw new Error("Authenticator code is required.");
      }

      const response = await client.auth.mfa.challengeAndVerify({
        factorId: mfaPendingEnrollment.id,
        code: mfaEnrollmentCode.trim(),
      });
      if (response.error) {
        throw new Error(response.error.message);
      }

      const mfaState = await loadMfaState();
      await refreshCurrentUser();
      setMfaTotpFactor(mfaState.factor);
      setMfaAssuranceLevel(mfaState.assuranceLevel);
      setMfaPendingEnrollment(null);
      setMfaEnrollmentCode("");
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage("Authenticator app enabled.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableMfa(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (!mfaTotpFactor) {
        throw new Error("No authenticator app is enabled for this account.");
      }
      if (!mfaDisableCode.trim()) {
        throw new Error("Authenticator code is required.");
      }

      const verification = await client.auth.mfa.challengeAndVerify({
        factorId: mfaTotpFactor.id,
        code: mfaDisableCode.trim(),
      });
      if (verification.error) {
        throw new Error(verification.error.message);
      }

      const unenrollResponse = await client.auth.mfa.unenroll({ factorId: mfaTotpFactor.id });
      if (unenrollResponse.error) {
        throw new Error(unenrollResponse.error.message);
      }

      const mfaState = await loadMfaState();
      await refreshCurrentUser();
      setMfaTotpFactor(mfaState.factor);
      setMfaAssuranceLevel(mfaState.assuranceLevel);
      setMfaDisableCode("");
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage("Authenticator app removed.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleCollectionRemoval(collection: "library" | "wishlist", titleId: string): Promise<void> {
    setSaving(true);
    try {
      if (collection === "library") {
        await removeTitleFromPlayerLibrary(appConfig.apiBaseUrl, accessToken, titleId);
        const response = await getPlayerLibrary(appConfig.apiBaseUrl, accessToken);
        setLibraryTitles(response.titles);
        setMessage("Removed from your library.");
      } else {
        await removeTitleFromPlayerWishlist(appConfig.apiBaseUrl, accessToken, titleId);
        const response = await getPlayerWishlist(appConfig.apiBaseUrl, accessToken);
        setWishlistTitles(response.titles);
        setMessage("Removed from your wishlist.");
      }
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleReportReplySubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedReportId) {
      return;
    }

    setSaving(true);
    try {
      const response = await addPlayerTitleReportMessage(appConfig.apiBaseUrl, accessToken, selectedReportId, {
        message: reportReply,
      });
      setSelectedReport(response.report);
      await refreshReportList(selectedReportId);
      setReportReply("");
      removeSessionStorageJson(PLAYER_PAGE_DRAFT_STORAGE_KEY);
      setMessage("Reply added to the report thread.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleFollowedStudioRemoval(studioId: string): Promise<void> {
    setSaving(true);
    try {
      await removeStudioFromPlayerFollows(appConfig.apiBaseUrl, accessToken, studioId);
      const response = await getPlayerFollowedStudios(appConfig.apiBaseUrl, accessToken);
      setFollowedStudios(response.studios);
      setMessage("Removed from your followed studios.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  function getActiveWorkflow(): "library-games" | "library-wishlist" | "library-followed-studios" | "reported-titles" | "account-profile" | "account-settings" | "account-connected-accounts" {
    const workflow = searchParams.get("workflow");
    if (location.pathname.endsWith("/wishlist")) {
      return "library-wishlist";
    }
    if (workflow === "library-followed-studios") {
      return "library-followed-studios";
    }
    if (workflow === "reported-titles") {
      return "reported-titles";
    }
    if (workflow === "account-profile") {
      return "account-profile";
    }
    if (workflow === "account-settings") {
      return "account-settings";
    }
    if (workflow === "account-connected-accounts") {
      return "account-connected-accounts";
    }
    return "library-games";
  }

  const activeWorkflow = getActiveWorkflow();
  const activeDomain = activeWorkflow.startsWith("account-") ? "account" : "library";
  const hasDeveloperRole = currentUser?.roles.includes("developer") ?? false;
  const titleShowcaseAspectRatio = getCatalogMediaAspectRatioValue(catalogMediaTypes, "title_showcase");
  const titleAvatarAspectRatio = getCatalogMediaAspectRatioValue(catalogMediaTypes, "title_avatar");
  const studioLogoAspectRatio = getCatalogMediaAspectRatioValue(catalogMediaTypes, "studio_logo");

  useEffect(() => {
    if (activeWorkflow !== "account-settings" || !pendingPasswordSectionFocusRef.current) {
      return;
    }

    pendingPasswordSectionFocusRef.current = false;
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        if (passwordSectionRef.current && typeof passwordSectionRef.current.scrollIntoView === "function") {
          passwordSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      return;
    }

    if (passwordSectionRef.current && typeof passwordSectionRef.current.scrollIntoView === "function") {
      passwordSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeWorkflow]);

  function navigateToWorkflow(workflow: string): void {
    switch (workflow) {
      case "library-games":
        navigate("/player");
        return;
      case "library-wishlist":
        navigate("/player/wishlist");
        return;
      case "library-followed-studios":
        navigate("/player?workflow=library-followed-studios");
        return;
      case "reported-titles":
        navigate("/player?workflow=reported-titles");
        return;
      case "account-profile":
        navigate("/player?workflow=account-profile");
        return;
      case "account-settings":
        navigate("/player?workflow=account-settings");
        return;
      case "account-connected-accounts":
        navigate("/player?workflow=account-connected-accounts");
        return;
      default:
        navigate("/player");
    }
  }

  if (loading) {
    return <LoadingPanel title="Loading player workspace..." />;
  }

  if (error && !profile) {
    return <ErrorPanel detail={error} />;
  }

  return (
    <section className="app-workspace-shell space-y-6">
      <section className="app-workspace-content">
        <section className="app-panel w-full p-4">
          <div className="flex flex-wrap gap-2">
            <button className={activeDomain === "library" ? "primary-button" : "secondary-button"} type="button" onClick={() => navigateToWorkflow("library-games")}>
              Library
            </button>
            <button className={activeDomain === "account" ? "primary-button" : "secondary-button"} type="button" onClick={() => navigateToWorkflow("account-profile")}>
              Account
            </button>
          </div>
        </section>

        <section className="app-workspace-grid">
          <aside className="app-panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Section</div>
            <nav className="mt-3 space-y-2">
              {[
                ["library-games", "My Games"],
                ["library-wishlist", "Wishlist"],
                ["library-followed-studios", "Studios You Follow"],
                ["reported-titles", "Reported Titles"],
                ["account-profile", "Profile"],
                ["account-settings", "Account Settings"],
                ["account-connected-accounts", "Connected Accounts"],
              ]
                .filter(([key]) => (activeDomain === "library" ? !String(key).startsWith("account-") : String(key).startsWith("account-")))
                .map(([key, label]) => (
                  <button
                    key={key}
                    className={getWorkspaceWorkflowButtonClass(activeWorkflow === key)}
                    type="button"
                    onClick={() => navigateToWorkflow(key)}
                  >
                    {label}
                  </button>
                ))}
            </nav>
          </aside>

          <section className="app-panel app-workspace-main p-6">
            {activeWorkflow === "library-games" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">My Games</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Titles you marked as owned appear here.</p>
                {libraryTitles.length > 0 ? (
                  <div className="mt-6 list-stack">
                    {libraryTitles.map((title) => (
                      <article key={title.id} className="list-item">
                        <div>
                          <strong>{title.displayName}</strong>
                          <p>{title.shortDescription}</p>
                        </div>
                        <div className="button-row compact">
                          <Link className="secondary-button" to={`/browse/${title.studioSlug}/${title.slug}`}>
                            Open title
                          </Link>
                          <button type="button" className="danger-button" disabled={saving} onClick={() => void handleCollectionRemoval("library", title.id)}>
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <CompactTitleList titles={libraryTitles} emptyTitle="Your library is empty" emptyDetail="Browse titles and add the ones you already own." />
                    <div>
                      <Link className="primary-button" to="/browse">
                        Browse
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {activeWorkflow === "library-wishlist" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Wishlist</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Save titles you want to come back to later.</p>
                {wishlistTitles.length > 0 ? (
                  <div className="mt-6 list-stack">
                    {wishlistTitles.map((title) => {
                      const showcaseImage = getFirstCatalogImageByType(title, "title_showcase");
                      const titleAvatarImage = getFirstCatalogImageByType(title, "title_avatar");
                      const previewImage = showcaseImage ?? titleAvatarImage;
                      const previewAspectRatio = showcaseImage ? titleShowcaseAspectRatio : titleAvatarAspectRatio;
                      const previewWidthClass = showcaseImage ? "max-w-[12rem]" : "max-w-[8rem]";
                      const previewSource = previewImage?.sourceUrl ?? getFallbackArtworkUrl(title);
                      const previewAlt =
                        previewImage?.altText ??
                        (showcaseImage ? `${title.displayName} showcase preview` : titleAvatarImage ? `${title.displayName} avatar` : `${title.displayName} fallback artwork`);

                      return (
                        <article key={title.id} className="list-item">
                          <div className="grid w-full gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start">
                              <div className={`w-full shrink-0 ${previewWidthClass}`}>
                                <div
                                  className="overflow-hidden rounded-[1rem] border border-white/10 bg-slate-950/70 shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
                                  data-testid={`wishlist-showcase-${title.id}`}
                                  style={{ aspectRatio: previewAspectRatio }}
                                >
                                  <img
                                    className="h-full w-full object-cover"
                                    src={previewSource}
                                    alt={previewAlt}
                                  />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <strong className="block text-lg text-white">{title.displayName}</strong>
                                <p className="mt-2">{title.shortDescription || "No summary has been added for this title yet."}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Link
                                className={panelIconButtonClassName}
                                to={`/browse/${title.studioSlug}/${title.slug}`}
                                title="Open title"
                                aria-label="Open title"
                              >
                                <ArrowOutwardIcon className="size-5" />
                              </Link>
                              <button
                                type="button"
                                className={dangerPanelIconButtonClassName}
                                title="Remove from wishlist"
                                aria-label="Remove from wishlist"
                                disabled={saving}
                                onClick={() => void handleCollectionRemoval("wishlist", title.id)}
                              >
                                <CloseIcon className="size-5" />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <CompactTitleList titles={wishlistTitles} emptyTitle="Your wishlist is empty" emptyDetail="Save titles here to revisit them later." />
                    <div>
                      <Link className="primary-button" to="/browse">
                        Browse
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {activeWorkflow === "library-followed-studios" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Studios You Follow</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">The studios you follow show up here for quick access.</p>
                {followedStudios.length > 0 ? (
                  <div className="mt-6 list-stack">
                    {followedStudios.map((studio) => {
                      const studioLogoUrl = getStudioLogoImageUrl(studio);
                      const prominentStudioLinks = studio.links.filter((link) => isKnownStudioLink(link.url));
                      const studioBackgroundStyle = studio.bannerUrl
                        ? { backgroundImage: `url('${studio.bannerUrl}')`, backgroundSize: "cover", backgroundPosition: "center" }
                        : undefined;

                      return (
                        <article
                          key={studio.id}
                          className="list-item relative overflow-hidden p-0"
                          data-testid={`followed-studio-item-${studio.id}`}
                          style={studioBackgroundStyle}
                        >
                          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(8,10,18,0.9),rgba(8,10,18,0.58),rgba(8,10,18,0.88))]" />
                          <div className="relative z-10 p-4 sm:p-5">
                            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                              <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(8.5rem,10rem)_minmax(0,1fr)] md:items-start">
                                <div className="w-full max-w-[10rem] shrink-0">
                                  <div
                                    className="flex items-center justify-center overflow-hidden rounded-[1rem] border border-white/10 bg-slate-950/50 shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
                                    data-testid={`followed-studio-logo-${studio.id}`}
                                    style={{ aspectRatio: studioLogoAspectRatio }}
                                  >
                                    {studioLogoUrl ? (
                                      <img
                                        className="h-full w-full object-cover"
                                        src={studioLogoUrl}
                                        alt={`${studio.displayName} logo`}
                                      />
                                    ) : (
                                      <div className="grid h-full w-full place-items-center text-xl font-bold uppercase tracking-[0.12em] text-slate-100">
                                        {studio.displayName.slice(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-display text-2xl font-bold leading-tight text-white sm:text-[2rem]">{studio.displayName}</h3>
                                  <p className="mt-2 whitespace-nowrap text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100/75">
                                    {studio.followerCount} follower{studio.followerCount === 1 ? "" : "s"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {prominentStudioLinks.map((link) => (
                                  <a
                                    key={link.id}
                                    className={panelIconButtonClassName}
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={link.label}
                                    aria-label={link.label}
                                  >
                                    <StudioLinkIcon url={link.url} />
                                  </a>
                                ))}
                                <Link className={panelIconButtonClassName} to={`/studios/${studio.slug}`} title="Open studio" aria-label="Open studio">
                                  <ArrowOutwardIcon className="size-5" />
                                </Link>
                                <button
                                  type="button"
                                  className={dangerPanelIconButtonClassName}
                                  title="Unfollow studio"
                                  aria-label="Unfollow studio"
                                  disabled={saving}
                                  onClick={() => void handleFollowedStudioRemoval(studio.id)}
                                >
                                  <CloseIcon className="size-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <div className="list-stack">
                      <EmptyState title="You are not following any studios yet" detail="Follow a studio to keep it here." />
                    </div>
                    <div>
                      <Link className="primary-button" to="/browse">
                        Browse
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {activeWorkflow === "reported-titles" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Reported Titles</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Track moderator follow-up on your reported titles.</p>
                <div className="mt-6 grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
                  <section className="surface-panel-soft rounded-[1.25rem] p-4">
                    <PlayerReportList reports={reports} selectedReportId={selectedReportId} onSelect={setSelectedReportId} />
                  </section>
                  <section className="surface-panel-soft rounded-[1.25rem] p-4">
                    {reportLoading ? <LoadingPanel title="Loading report..." /> : null}
                    {!reportLoading && selectedReport ? <TitleReportConversation detail={selectedReport} viewerRole="player" /> : null}
                    {!reportLoading && !selectedReport ? (
                      <EmptyState title="Select a report" detail="Open a report thread to review moderator updates or reply." />
                    ) : null}
                    {selectedReport ? (
                      <form className="mt-6 stack-form" onSubmit={handleReportReplySubmit}>
                        <Field label="Reply to moderators">
                          <textarea rows={4} value={reportReply} onChange={(event) => setReportReply(event.currentTarget.value)} />
                        </Field>
                        <div className="button-row">
                          <button type="submit" className="primary-button" disabled={saving || reportReply.trim().length === 0}>
                            {saving ? "Sending..." : "Send reply"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </section>
                </div>
              </>
            ) : null}

            {activeWorkflow === "account-profile" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Profile</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Update your profile details.</p>
                <form className="mt-6 stack-form" onSubmit={handleProfileSubmit}>
                  <Field label="Display name">
                    <input value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} disabled={!profileEditMode || saving} />
                  </Field>

                  <AvatarEditor
                    state={profileAvatar}
                    disabled={!profileEditMode || saving}
                    onModeChange={(mode) => setProfileAvatar((current) => ({ ...current, mode }))}
                    onUrlChange={(value) => setProfileAvatar((current) => ({ ...current, url: value }))}
                    onUpload={(event) => void handleProfileAvatarUpload(event)}
                  />

                  <div className="surface-panel-soft rounded-[1rem] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Board profile</div>
                    <div className="mt-2 text-white">{boardProfile ? boardProfile.displayName : "No linked Board profile"}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">Sign in to the Board Enthusiasts app on your Board console to link your Board profile.</p>
                  </div>

                  {message ? <p className="success-text">{message}</p> : null}
                  {error ? <p className="error-text">{error}</p> : null}
                  <button type="submit" className={profileEditMode ? "primary-button" : "secondary-button"} disabled={saving}>
                    {saving ? "Saving..." : profileEditMode ? "Save Profile" : "Edit Profile"}
                  </button>
                </form>
              </>
            ) : null}

            {activeWorkflow === "account-settings" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Account Settings</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Review access, verification, and account details.</p>
                <div className="mt-6 stack-form">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name">
                      <input value={firstName} onChange={(event) => setFirstName(event.currentTarget.value)} disabled={!settingsEditMode || saving} />
                    </Field>
                    <Field label="Last name">
                      <input value={lastName} onChange={(event) => setLastName(event.currentTarget.value)} disabled={!settingsEditMode || saving} />
                    </Field>
                    <Field label="Email">
                      <input type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} disabled={!settingsEditMode || saving} />
                    </Field>
                  </div>

                  <div className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
                    <div className="surface-panel-soft rounded-[1.25rem] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Email verification</div>
                      <div className="mt-2 text-base text-white">
                        {pendingEmailChange ? "Confirmation sent" : currentUser?.emailVerified ? "Verified" : "Pending"}
                      </div>
                      {pendingEmailChange ? (
                        <p className="mt-3 text-sm leading-7 text-slate-300">Confirm the change from the email sent to {pendingEmailChange}. Your current sign-in email stays active until then.</p>
                      ) : null}
                    </div>
                    <div className="surface-panel-soft rounded-[1.25rem] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Library titles</div>
                      <div className="mt-2 text-base text-white">{libraryTitles.length}</div>
                    </div>
                    <div className="surface-panel-soft rounded-[1.25rem] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Wishlist titles</div>
                      <div className="mt-2 text-base text-white">{wishlistTitles.length}</div>
                    </div>
                  </div>

                  <div className="surface-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Developer access</div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Access</div>
                        <div className="mt-2 text-base text-white">{developerAccessEnabled ? "Enabled" : "Not enabled"}</div>
                      </div>
                      {hasDeveloperRole ? (
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Verified developer</div>
                          <div className="mt-2 text-base text-white">{verifiedDeveloper ? "Verified" : "Not verified"}</div>
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      {developerAccessEnabled ? "Manage developer access from the Developer workspace." : "Enable developer access from the Developer workspace."}
                    </p>
                    <div className="mt-4">
                      <Link className="secondary-button" to="/developer">
                        Open Developer
                      </Link>
                    </div>
                  </div>

                  <div ref={passwordSectionRef} className="surface-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Password</div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {hasLocalPassword
                        ? "Change your password here without leaving the signed-in workspace."
                        : "Add a password so you can sign in directly with your email as well as any connected accounts you keep linked."}
                    </p>
                    {!hasLocalPassword ? (
                      <div className="mt-4 rounded-[1.25rem] border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-7 text-slate-200">
                        You signed up with a connected account, so this profile does not have a Board Enthusiasts password yet.
                      </div>
                    ) : null}
                    <form className="mt-4 stack-form" onSubmit={handlePasswordChangeSubmit}>
                      {hasLocalPassword ? (
                        <PasswordField
                          label="Current password"
                          value={settingsCurrentPassword}
                          autoComplete="current-password"
                          show={showSettingsCurrentPassword}
                          onChange={setSettingsCurrentPassword}
                          onToggle={() => setShowSettingsCurrentPassword((current) => !current)}
                          disabled={saving}
                        />
                      ) : null}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <PasswordField
                          label={hasLocalPassword ? "New password" : "Password"}
                          value={newPassword}
                          autoComplete="new-password"
                          show={showNewPassword}
                          onChange={setNewPassword}
                          onToggle={() => setShowNewPassword((current) => !current)}
                          disabled={saving}
                        />
                        <PasswordField
                          label="Confirm password"
                          value={confirmNewPassword}
                          autoComplete="new-password"
                          show={showConfirmNewPassword}
                          onChange={setConfirmNewPassword}
                          onToggle={() => setShowConfirmNewPassword((current) => !current)}
                          disabled={saving}
                        />
                      </div>
                      <div className="button-row">
                        <button type="submit" className="secondary-button" disabled={saving}>
                          {saving ? (hasLocalPassword ? "Updating..." : "Saving...") : hasLocalPassword ? "Change Password" : "Set Password"}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="surface-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Multi-factor authentication</div>
                    <div className="mt-3 text-base text-white">
                      {mfaTotpFactor?.status === "verified"
                        ? "Authenticator app enabled"
                        : mfaPendingEnrollment
                          ? "Finish authenticator setup"
                          : mfaTotpFactor?.status === "unverified"
                            ? "Authenticator setup incomplete"
                            : "Authenticator app not enabled"}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {mfaTotpFactor?.status === "verified"
                        ? `This account is protected with ${mfaTotpFactor.friendlyName ?? "an authenticator app"}.`
                        : mfaTotpFactor?.status === "unverified"
                          ? "A previous authenticator setup was not finished. Start setup again to generate a fresh QR code."
                          : "Use an authenticator app to add a second step during sign-in."}
                    </p>

                    {(!mfaTotpFactor || mfaTotpFactor.status === "unverified") && !mfaPendingEnrollment ? (
                      <div className="mt-4">
                        <button type="button" className="secondary-button" disabled={saving} onClick={() => void handleStartMfaEnrollment()}>
                          {saving ? "Starting..." : mfaTotpFactor?.status === "unverified" ? "Restart Authenticator Setup" : "Set Up Authenticator App"}
                        </button>
                      </div>
                    ) : null}

                    {mfaPendingEnrollment ? (
                      <form className="mt-4 stack-form" onSubmit={handleVerifyMfaEnrollment}>
                        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
                          <div className="rounded-[1rem] border border-cyan-300/20 bg-slate-950/70 p-3">
                            <img
                              src={getMfaQrCodeImageSource(mfaPendingEnrollment.qrCode)}
                              alt="Authenticator QR code"
                              className="mx-auto h-48 w-48 rounded-lg bg-white p-2"
                            />
                          </div>
                          <div className="space-y-4">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Manual setup secret</div>
                              <div className="mt-2 rounded-[1rem] border border-cyan-300/20 bg-slate-950/70 px-4 py-3 font-mono text-sm text-cyan-50">
                                {mfaPendingEnrollment.secret}
                              </div>
                            </div>
                            <Field label="Authenticator code">
                              <input value={mfaEnrollmentCode} onChange={(event) => setMfaEnrollmentCode(event.currentTarget.value)} autoComplete="one-time-code" inputMode="numeric" />
                            </Field>
                            <div className="button-row">
                              <button type="submit" className="secondary-button" disabled={saving}>
                                {saving ? "Verifying..." : "Enable MFA"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    ) : null}

                    {mfaTotpFactor?.status === "verified" ? (
                      <form className="mt-4 stack-form" onSubmit={handleDisableMfa}>
                        <Field label="Authenticator code">
                          <input value={mfaDisableCode} onChange={(event) => setMfaDisableCode(event.currentTarget.value)} autoComplete="one-time-code" inputMode="numeric" />
                        </Field>
                        <div className="button-row">
                          <button type="submit" className="danger-button" disabled={saving}>
                            {saving ? "Removing..." : "Remove Authenticator App"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>

                  {message ? <p className="success-text">{message}</p> : null}
                  {error ? <p className="error-text">{error}</p> : null}
                  <button type="button" className={settingsEditMode ? "primary-button" : "secondary-button"} disabled={saving} onClick={() => void handleSettingsSave()}>
                    {saving ? "Saving..." : settingsEditMode ? "Save Settings" : "Edit Settings"}
                  </button>
                </div>
              </>
            ) : null}

            {activeWorkflow === "account-connected-accounts" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">Connected Accounts</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Choose which sign-in options stay linked to your account and connect new ones whenever it helps.</p>
                <div className="mt-6">
                  <div className="surface-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Connected accounts</div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      Review the sign-in options currently linked to this account and disconnect any you no longer want to use.
                    </p>

                    {connectedAccountsError ? <p className="mt-4 error-text">{connectedAccountsError}</p> : null}

                    {connectedAccountsLoading ? (
                      <div className="mt-4 space-y-3">
                        <div className="h-20 animate-pulse rounded-[1.25rem] bg-white/10" />
                        <div className="h-20 animate-pulse rounded-[1.25rem] bg-white/10" />
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {connectedSocialAccounts.length === 0 ? (
                          <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                            No connected accounts yet. You can connect one of the sign-in options below whenever you want.
                          </div>
                        ) : null}

                        {availableConnectedAccountProviders.map((provider) => {
                          const identity = connectedAccountIdentityByProvider.get(provider) ?? null;
                          const providerLabel = getSocialAuthProviderLabel(provider);
                          const isDisconnecting = connectedAccountActionProvider === provider;
                          return (
                            <div key={provider} className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-4">
                                  <span className="social-auth-icon-badge">
                                    <SocialAuthProviderIcon provider={provider} />
                                  </span>
                                  <div>
                                    <div className="text-base font-semibold text-white">{providerLabel}</div>
                                    <div className="mt-1 text-sm text-slate-300">
                                      {identity ? getConnectedAccountSummary(identity) : "Not connected"}
                                    </div>
                                  </div>
                                </div>
                                {identity ? (
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={saving}
                                    onClick={() => requestConnectedAccountDisconnect(identity)}
                                  >
                                    {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={saving || Boolean(connectedAccountActionProvider)}
                                    onClick={() => void handleConnectConnectedAccount(provider)}
                                  >
                                    {isDisconnecting ? "Connecting..." : "Connect"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {message ? <p className="mt-4 success-text">{message}</p> : null}
                    {error ? <p className="mt-4 error-text">{error}</p> : null}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </section>
      </section>

      {disconnectTarget ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8"
          onClick={() => {
            setDisconnectTarget(null);
            setDisconnectModalError(null);
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
              <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="disconnect-account-title">
                <div className="auth-panel-header">
                  <h2 id="disconnect-account-title" className="auth-panel-title">Disconnect {getSocialAuthProviderLabel(disconnectTarget.provider as SocialAuthProvider)}?</h2>
                  <p className="auth-panel-copy">
                    You will no longer be able to use this connected account to sign in to Board Enthusiasts unless you link it again later.
                  </p>
                </div>

                <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-4">
                    <span className="social-auth-icon-badge">
                      <SocialAuthProviderIcon provider={disconnectTarget.provider as SocialAuthProvider} />
                    </span>
                    <div>
                      <div className="text-base font-semibold text-white">{getSocialAuthProviderLabel(disconnectTarget.provider as SocialAuthProvider)}</div>
                      <div className="mt-1 text-sm text-slate-300">{getConnectedAccountSummary(disconnectTarget)}</div>
                    </div>
                  </div>
                </div>

                {disconnectModalError ? <p className="error-text">{disconnectModalError}</p> : null}

                <div className="button-row justify-center">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving}
                    onClick={() => {
                      setDisconnectTarget(null);
                      setDisconnectModalError(null);
                    }}
                  >
                    Keep Connected
                  </button>
                  <button type="button" className="danger-button" disabled={saving} onClick={() => void handleDisconnectConnectedAccount()}>
                    {connectedAccountActionProvider ? "Disconnecting..." : "Disconnect Account"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {passwordRequiredDisconnectTarget ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8" onClick={() => setPasswordRequiredDisconnectTarget(null)}>
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
              <section className="app-panel space-y-6 p-6 md:p-8" role="dialog" aria-modal="true" aria-labelledby="set-password-first-title">
                <div className="auth-panel-header">
                  <h2 id="set-password-first-title" className="auth-panel-title">Add a password first</h2>
                  <p className="auth-panel-copy">
                    Before you disconnect your last connected sign-in option, add a Board Enthusiasts password so you do not get locked out of your account.
                  </p>
                </div>

                <div className="rounded-[1.25rem] border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-7 text-slate-200">
                  Set your password in the Password section, then come back here if you still want to disconnect {getSocialAuthProviderLabel(passwordRequiredDisconnectTarget.provider as SocialAuthProvider)}.
                </div>

                <div className="button-row justify-center">
                  <button type="button" className="secondary-button" onClick={() => setPasswordRequiredDisconnectTarget(null)}>
                    Keep Connected
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setPasswordRequiredDisconnectTarget(null);
                      focusPasswordSection();
                    }}
                  >
                    Go To Password
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
