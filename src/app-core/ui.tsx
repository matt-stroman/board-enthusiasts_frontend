import type {
  CatalogTitleResponse,
  CatalogTitleSummary,
  DeveloperStudioSummary,
  PlayerTitleReportSummary,
  StudioSummary,
  TitleReportDetail,
  TitleReportSummary,
} from "@board-enthusiasts/migration-contract";
import { useId, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import shareGlyph from "../assets/title-action-icons/share_24dp.svg?raw";
import { formatMediaUploadGuidance } from "../media-upload";
import { rememberCatalogMediaLoadFailure, rememberCatalogMediaLoadSuccess, useCatalogMediaLoadState } from "./media";
import { supportRoute } from "./errors";
import type { AvatarEditorState } from "./shared";
import {
  AVATAR_UPLOAD_ACCEPT,
  PLAYER_FILTER_MAX,
  PLAYER_FILTER_MIN,
  avatarUploadPolicy,
  canViewTitleReportMessageAudience,
  getCatalogMediaAspectRatioValue,
  formatAudienceLabel,
  formatContentKindLabel,
  formatMembershipRole,
  formatReportStatus,
  formatTimestamp,
  formatPlayerFilterSummary,
  getCatalogTitleAvailabilityNote,
  getCurrentUserAvatarUrl,
  getFallbackGradient,
  getInitials,
  getStudioAvatarImageUrl,
  getTitleAvatarImageUrl,
  getTitleCardImageUrl,
  getTitleLogoAsset,
  parseGenreTags,
} from "./shared";

export function FilePicker({
  accept,
  disabled,
  onChange,
  buttonLabel = "Choose file",
  selectedFileName,
  emptyLabel = "No file chosen",
}: {
  accept: string;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  buttonLabel?: string;
  selectedFileName?: string | null;
  emptyLabel?: string;
}) {
  const inputId = useId();

  return (
    <div className="file-picker">
      <label
        htmlFor={inputId}
        className={disabled ? "file-picker-button pointer-events-none opacity-50" : "file-picker-button"}
        aria-disabled={disabled}
      >
        {buttonLabel}
      </label>
      <span className="file-picker-name">{selectedFileName?.trim() || emptyLabel}</span>
      <input id={inputId} className="sr-only" type="file" accept={accept} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel">
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <h2>{title}</h2>
      {description ? <p className="panel-description">{description}</p> : null}
      {children}
    </section>
  );
}

export function LoadingPanel({ title = "Loading..." }: { title?: string }) {
  return (
    <Panel title={title} eyebrow="Status">
      <div className="status-chip">Working</div>
    </Panel>
  );
}

export function ErrorPanel({
  title = "Something went wrong",
  detail,
  showSupportLink = true,
}: {
  title?: string;
  detail: string;
  showSupportLink?: boolean;
}) {
  return (
    <Panel title={title} eyebrow="Error">
      <p>{detail}</p>
      {showSupportLink ? (
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Need a hand? <Link className="text-cyan-100 transition hover:text-white" to={supportRoute}>Contact Us</Link>.
        </p>
      ) : null}
    </Panel>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

export function getWorkspaceWorkflowButtonClass(active: boolean): string {
  return active ? "workflow-active-button" : "workflow-button surface-panel-strong";
}

export function Field({
  label,
  children,
  hint,
  hintTone = "default",
  required = false,
  reserveHintSpace = true,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  hintTone?: "default" | "error" | "success";
  required?: boolean;
  reserveHintSpace?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? (
          <>
            {" "}
            <span aria-hidden="true" className="field-required-marker">*</span>
          </>
        ) : null}
      </span>
      {children}
      {hint || reserveHintSpace ? (
        <small
          className={`field-hint-slot ${hintTone === "error" ? "field-hint-error" : hintTone === "success" ? "field-hint-success" : ""}`.trim()}
          aria-hidden={hint ? undefined : true}
        >
          {hint ?? "\u00A0"}
        </small>
      ) : null}
    </label>
  );
}

export function PasswordField({
  label,
  value,
  autoComplete,
  show,
  onChange,
  onToggle,
  onBlur,
  hint,
  hintTone = "default",
  required = false,
  disabled = false,
  reserveHintSpace = true,
}: {
  label: string;
  value: string;
  autoComplete: string;
  show: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  onBlur?: () => void;
  hint?: React.ReactNode;
  hintTone?: "default" | "error" | "success";
  required?: boolean;
  disabled?: boolean;
  reserveHintSpace?: boolean;
}) {
  return (
    <Field label={label} hint={hint} hintTone={hintTone} required={required} reserveHintSpace={reserveHintSpace}>
      <div className="password-field">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button
          type="button"
          className="password-toggle-button"
          tabIndex={-1}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          title={show ? "Hide password" : "Show password"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggle}
          disabled={disabled}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {show ? null : <path d="M4 4 20 20" />}
          </svg>
        </button>
      </div>
    </Field>
  );
}

export function AvatarEditor({
  state,
  disabled,
  onModeChange,
  onUrlChange,
  onUpload,
}: {
  state: AvatarEditorState;
  disabled: boolean;
  onModeChange: (mode: AvatarEditorState["mode"]) => void;
  onUrlChange: (value: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const previewSrc = state.mode === "upload" ? state.dataUrl : state.url.trim() || null;

  return (
    <div className="surface-panel-strong rounded-[1rem] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Avatar</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={state.mode === "url" ? "primary-button" : "secondary-button"} onClick={() => onModeChange("url")} disabled={disabled}>
              Avatar URL
            </button>
            <button type="button" className={state.mode === "upload" ? "primary-button" : "secondary-button"} onClick={() => onModeChange("upload")} disabled={disabled}>
              Upload image
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-white/12 bg-slate-950/70">
            {previewSrc ? <img className="h-full w-full object-cover" src={previewSrc} alt="Avatar preview" /> : <span className="text-xs uppercase tracking-[0.18em] text-slate-400">None</span>}
          </div>
        </div>
      </div>

      {state.mode === "url" ? (
        <div className="mt-4">
          <Field label="Avatar URL">
            <input value={state.url} onChange={(event) => onUrlChange(event.currentTarget.value)} placeholder="https://example.com/avatar.png" disabled={disabled} />
          </Field>
        </div>
      ) : (
        <div className="mt-4">
          <Field label="Upload image">
            <FilePicker
              accept={AVATAR_UPLOAD_ACCEPT}
              selectedFileName={state.fileName}
              onChange={onUpload}
              disabled={disabled}
            />
          </Field>
          <p className="mt-2 text-xs text-slate-400">
            {formatMediaUploadGuidance(avatarUploadPolicy, { optional: true })}
          </p>
        </div>
      )}
    </div>
  );
}

export function TitleNameHeading({
  title,
  id,
  level,
  className,
  imageClassName,
}: {
  title: CatalogTitleResponse["title"];
  id?: string;
  level: "h1" | "h2";
  className: string;
  imageClassName: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoAsset = getTitleLogoAsset(title);
  const HeadingTag = level;

  return (
    <HeadingTag id={id} className={className}>
      {logoAsset && !logoFailed ? (
        <img
          className={imageClassName}
          src={logoAsset.sourceUrl}
          alt={logoAsset.altText ?? `${title.displayName} logo`}
          decoding="async"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        title.displayName
      )}
    </HeadingTag>
  );
}

export function StudioCard({ studio }: { studio: StudioSummary | DeveloperStudioSummary }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = getStudioAvatarImageUrl(studio);
  const safeAvatarUrl = avatarFailed ? null : avatarUrl;
  const bannerLoadState = useCatalogMediaLoadState(studio.bannerUrl);
  const studioAvatarAspectRatio = getCatalogMediaAspectRatioValue(undefined, "studio_avatar");
  const bannerStyle = bannerLoadState === "loaded" && studio.bannerUrl
    ? { backgroundImage: `url('${studio.bannerUrl}')` }
    : { backgroundImage: getFallbackGradient(studio.description) };

  return (
    <article className="app-panel overflow-hidden p-0">
      <div
        className="min-h-48 bg-cover bg-center"
        style={bannerStyle}
      >
        <div className="h-full bg-[linear-gradient(120deg,rgba(8,10,18,0.88),rgba(8,10,18,0.52),rgba(8,10,18,0.82))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              {"role" in studio ? <div className="eyebrow">{formatMembershipRole(studio.role)}</div> : <div className="eyebrow">Studio</div>}
              <h3 className="font-display text-2xl font-bold text-white">{studio.displayName}</h3>
              <p className="max-w-xl text-sm leading-7 text-slate-300">{studio.description ?? "No studio summary yet."}</p>
            </div>
            {safeAvatarUrl ? (
              <div className="w-16 shrink-0 overflow-hidden rounded-[1rem] border border-white/10 md:w-24" style={{ aspectRatio: studioAvatarAspectRatio }}>
                <img
                  className="h-full w-full object-cover"
                  src={safeAvatarUrl}
                  alt={`${studio.displayName} avatar`}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => rememberCatalogMediaLoadSuccess(safeAvatarUrl)}
                  onError={() => {
                    rememberCatalogMediaLoadFailure(safeAvatarUrl);
                    setAvatarFailed(true);
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className="mt-5">
            <Link className="secondary-button" to={`/studios/${studio.slug}`}>
              Open studio
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function TitlePlayerActionButtons({
  visible,
  isBusy,
  isWishlisted,
  isOwned,
  showOwnedAction = true,
  isReported = false,
  canReport = true,
  showShareAction = true,
  showReportAction = true,
  compact,
  onToggleWishlist,
  onToggleOwned,
  onReport,
  onShare,
}: {
  visible: boolean;
  isBusy: boolean;
  isWishlisted: boolean;
  isOwned: boolean;
  isReported?: boolean;
  canReport?: boolean;
  showOwnedAction?: boolean;
  showShareAction?: boolean;
  showReportAction?: boolean;
  compact?: boolean;
  onToggleWishlist: () => void;
  onToggleOwned?: () => void;
  onReport?: () => void;
  onShare?: () => void;
}) {
  if (!visible && !showShareAction) {
    return null;
  }

  const sizeClass = compact ? "h-11 w-11" : "h-11 w-11";
  const baseClass = `${sizeClass} inline-flex items-center justify-center rounded-full border text-slate-100 transition disabled:cursor-not-allowed disabled:opacity-50`;
  const getButtonClass = (active: boolean) =>
    `${baseClass} ${
      active
        ? "border-cyan-200/70 bg-[radial-gradient(circle_at_top,rgba(220,247,234,0.16),transparent_55%),linear-gradient(180deg,rgba(18,42,35,0.96),rgba(10,24,20,0.96))] text-cyan-50 shadow-[0_0_0_1px_rgba(157,226,194,0.15),0_16px_34px_rgba(6,10,17,0.42)]"
        : "border-white/18 bg-[linear-gradient(180deg,rgba(13,18,29,0.88),rgba(7,10,17,0.9))] text-slate-50 shadow-[0_12px_28px_rgba(6,10,17,0.34)] hover:border-cyan-200/55 hover:text-cyan-100 hover:bg-[linear-gradient(180deg,rgba(17,23,36,0.94),rgba(10,14,24,0.94))]"
    } backdrop-blur-md`;

  function handleAction(event: React.MouseEvent<HTMLButtonElement>, action: () => void): void {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap gap-3"}>
      {visible ? (
        <button
          className={getButtonClass(isWishlisted)}
          type="button"
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(event) => handleAction(event, onToggleWishlist)}
          disabled={isBusy}
        >
          <svg viewBox="0 0 24 24" className={`h-4 w-4 ${isWishlisted ? "fill-current stroke-[1.6]" : "fill-none stroke-2"} stroke-current`} aria-hidden="true">
            <path d="M12 21 4.7 13.8a4.9 4.9 0 0 1 6.9-6.9L12 7.3l.4-.4a4.9 4.9 0 0 1 6.9 6.9Z" />
          </svg>
        </button>
      ) : null}
      {visible && showOwnedAction && onToggleOwned ? (
        <button
          className={getButtonClass(isOwned)}
          type="button"
          title={isOwned ? "Remove from my games" : "Add to my games"}
          aria-label={isOwned ? "Remove from my games" : "Add to my games"}
          onClick={(event) => handleAction(event, onToggleOwned)}
          disabled={isBusy}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
            {isOwned ? (
              <path d="m5 12 4.2 4.2L19 6.5" />
            ) : (
              <>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </>
            )}
          </svg>
        </button>
      ) : null}
      {visible && showReportAction && onReport ? (
        <button
          className={getButtonClass(isReported)}
          type="button"
          title={canReport ? "Report title" : "Report already submitted"}
          aria-label={canReport ? "Report title" : "Report already submitted"}
          onClick={(event) => handleAction(event, onReport)}
          disabled={isBusy || !canReport}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
            <path d="M6 3v18" />
            <path d="M6 4h9l-1.5 3L15 10H6" />
          </svg>
        </button>
      ) : null}
      {showShareAction && onShare ? (
        <button
          className={getButtonClass(false)}
          type="button"
          title="Share title"
          aria-label="Share title"
          onClick={(event) => handleAction(event, onShare)}
          disabled={isBusy}
        >
          <span className="inline-svg-icon h-4 w-4" aria-hidden="true" dangerouslySetInnerHTML={{ __html: shareGlyph }} />
        </button>
      ) : null}
    </div>
  );
}

export function isKnownStudioLink(url: string): boolean {
  return tryGetStudioLinkIconKey(url) !== null;
}

export function tryGetStudioLinkIconKey(url: string): string | null {
  try {
    const uri = new URL(url);
    const host = uri.host.toLowerCase();
    if (host.includes("linkedin.com")) {
      return "linkedin";
    }
    if (host === "x.com" || host.endsWith(".x.com") || host.includes("twitter.com")) {
      return "x";
    }
    if (host.includes("discord.com") || host.includes("discord.gg")) {
      return "discord";
    }
    if (host.includes("facebook.com")) {
      return "facebook";
    }
    if (host.includes("instagram.com")) {
      return "instagram";
    }
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      return "youtube";
    }
    if (host.includes("github.com")) {
      return "github";
    }
  } catch {
    return null;
  }

  return null;
}

export function StudioLinkIcon({ url }: { url: string }) {
  const iconKey = tryGetStudioLinkIconKey(url);
  switch (iconKey) {
    case "linkedin":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M4.98 3.5a2.48 2.48 0 1 1 0 4.96 2.48 2.48 0 0 1 0-4.96ZM3 9h4v12H3Zm7 0h3.83v1.64h.05c.53-1.01 1.84-2.08 3.79-2.08C21.73 8.56 24 10.6 24 15v6h-4v-5.32c0-1.27-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21h-4Z" /></svg>;
    case "x":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M18.9 2H22l-6.78 7.74L23 22h-6.1l-4.78-6.26L6.64 22H3.53l7.25-8.29L1 2h6.25l4.33 5.71L18.9 2Zm-1.07 18h1.69L6.33 3.9H4.52Z" /></svg>;
    case "discord":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.56 3l-.24.49a18.3 18.3 0 0 1 4.44 1.36 15.7 15.7 0 0 0-15.52 0A18.3 18.3 0 0 1 8.68 3.5L8.44 3A19.8 19.8 0 0 0 3.68 4.37C.67 8.91-.14 13.33.27 17.69A19.9 19.9 0 0 0 6.13 20.6l1.26-1.72a12.7 12.7 0 0 1-1.98-.95l.47-.37c3.83 1.8 7.98 1.8 11.76 0l.47.37c-.63.38-1.29.7-1.98.95l1.26 1.72a19.9 19.9 0 0 0 5.86-2.91c.49-5.05-.83-9.44-2.93-13.32ZM9.54 15.07c-1.15 0-2.09-1.06-2.09-2.36s.93-2.36 2.09-2.36c1.17 0 2.1 1.06 2.09 2.36 0 1.3-.93 2.36-2.09 2.36Zm4.92 0c-1.15 0-2.09-1.06-2.09-2.36s.93-2.36 2.09-2.36c1.17 0 2.1 1.06 2.09 2.36 0 1.3-.92 2.36-2.09 2.36Z" /></svg>;
    case "facebook":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.87.25-1.46 1.49-1.46H16.7V5.02A23.2 23.2 0 0 0 14.14 4.9c-2.53 0-4.26 1.55-4.26 4.4V11H7v3h2.88v8Z" /></svg>;
    case "instagram":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5Zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5Zm5.25-3.1a1.1 1.1 0 1 1-1.1 1.1 1.1 1.1 0 0 1 1.1-1.1Z" /></svg>;
    case "youtube":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.4.58A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.12c1.86.58 9.4.58 9.4.58s7.54 0 9.4-.58a3 3 0 0 0 2.1-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.7V8.3l6.4 3.7-6.4 3.7Z" /></svg>;
    case "github":
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M12 .5A12 12 0 0 0 8.2 23.9c.6.1.82-.26.82-.58v-2.03c-3.34.73-4.04-1.41-4.04-1.41-.55-1.4-1.34-1.78-1.34-1.78-1.1-.75.08-.74.08-.74 1.2.09 1.84 1.24 1.84 1.24 1.08 1.84 2.83 1.31 3.52 1 .1-.78.42-1.31.76-1.61-2.67-.31-5.47-1.34-5.47-5.94 0-1.31.47-2.39 1.24-3.23-.12-.31-.54-1.56.12-3.25 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.69.24 2.94.12 3.25.77.84 1.24 1.92 1.24 3.23 0 4.61-2.81 5.62-5.49 5.92.43.38.82 1.11.82 2.24v3.32c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm6.9 9h-3.13a15.6 15.6 0 0 0-1.16-5.01A8.03 8.03 0 0 1 18.9 11ZM12 4.04c.83 1.1 1.83 3.29 2.15 6.96H9.85C10.17 7.33 11.17 5.14 12 4.04ZM4.1 13h3.13a15.6 15.6 0 0 0 1.16 5.01A8.03 8.03 0 0 1 4.1 13Zm3.13-2H4.1a8.03 8.03 0 0 1 4.29-5.01A15.6 15.6 0 0 0 7.23 11Zm2.62 2h4.3c-.32 3.67-1.32 5.86-2.15 6.96-.83-1.1-1.83-3.29-2.15-6.96Zm0-2c.32-3.67 1.32-5.86 2.15-6.96.83 1.1 1.83 3.29 2.15 6.96Zm4.76 7.01A15.6 15.6 0 0 0 15.77 13h3.13a8.03 8.03 0 0 1-4.29 5.01Z" /></svg>;
  }
}

export function TitleCard({
  title,
  onOpenQuickView,
  playerActions,
}: {
  title: CatalogTitleSummary;
  onOpenQuickView?: (title: CatalogTitleSummary) => void;
  playerActions?: {
    visible: boolean;
    isBusy: boolean;
    isWishlisted: boolean;
    isOwned: boolean;
    onToggleWishlist: () => void;
    onToggleOwned: () => void;
    onShare: () => void;
  };
}) {
  const [cardImageFailed, setCardImageFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const cardImageUrl = !cardImageFailed ? getTitleCardImageUrl(title) : null;
  const titleAvatarUrl = !avatarFailed ? getTitleAvatarImageUrl(title) : null;
  const titleAvatarAspectRatio = getCatalogMediaAspectRatioValue(undefined, "title_avatar");
  const genreTags = parseGenreTags(title.genreDisplay);
  const panelClassName = titleAvatarUrl ? "browse-title-card-panel browse-title-card-panel-logo" : "browse-title-card-panel";
  const availabilityNote = getCatalogTitleAvailabilityNote(title);
  const allowOwnedAndReportActions = availabilityNote !== "Coming soon";
  const fallbackGradient = getFallbackGradient(title.genreDisplay);
  const cardBody = (
    <div className="relative flex h-full flex-col justify-end">
      <div className="absolute inset-0 overflow-hidden">
        {cardImageUrl ? (
          <img
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.045] group-hover:brightness-105 group-hover:saturate-[1.08] group-focus-within:scale-[1.045] group-focus-within:brightness-105 group-focus-within:saturate-[1.08]"
            src={cardImageUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            onLoad={() => rememberCatalogMediaLoadSuccess(cardImageUrl)}
            onError={() => {
              rememberCatalogMediaLoadFailure(cardImageUrl);
              setCardImageFailed(true);
            }}
          />
        ) : (
          <div
            className="relative h-full w-full overflow-hidden transition duration-500 ease-out group-hover:scale-[1.045] group-hover:brightness-105 group-hover:saturate-[1.08] group-focus-within:scale-[1.045] group-focus-within:brightness-105 group-focus-within:saturate-[1.08]"
            style={{ backgroundImage: fallbackGradient }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_34%),linear-gradient(180deg,rgba(5,8,15,0.04),rgba(5,8,15,0.18)_52%,rgba(5,8,15,0.55))]" />
            <div className="absolute -left-12 top-8 h-44 w-44 rounded-full bg-white/12 blur-3xl" />
            <div className="absolute right-[-2.5rem] top-16 h-36 w-36 rounded-full bg-slate-950/25 blur-3xl" />
            <div className="absolute bottom-16 left-10 h-28 w-28 rounded-[2.25rem] border border-white/10 bg-white/8 backdrop-blur-[2px]" />
            <div className="absolute bottom-10 left-32 h-18 w-40 rounded-[1.8rem] border border-white/10 bg-slate-950/14" />
            <div className="absolute right-12 top-28 h-20 w-20 rotate-12 rounded-[1.6rem] border border-white/10 bg-white/7" />
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_30%),linear-gradient(180deg,rgba(7,9,14,0.02),rgba(7,9,14,0.07)_44%,rgba(7,9,14,0.22)_100%)]" />
      <div className="pointer-events-none absolute -left-10 top-0 h-40 w-48 -translate-x-8 bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.14),rgba(255,255,255,0))] opacity-0 blur-2xl transition duration-500 ease-out group-hover:translate-x-10 group-hover:opacity-60 group-focus-within:translate-x-10 group-focus-within:opacity-60" />
      {title.isReported ? (
        <div className="absolute left-3 top-3 z-20">
          <div
            className="inline-flex size-10 items-center justify-center rounded-full border border-amber-200/35 bg-amber-300/18 text-amber-100/85 shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm"
            role="img"
            aria-label="Reported title"
            title="Title has been reported"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M12 3 1.8 20.5h20.4Zm0 4.25 6.3 10.8H5.7Zm-1 2.85v4.45h2V10.1Zm0 5.8v2h2v-2Z" />
            </svg>
          </div>
        </div>
      ) : null}
      <div className="relative p-3 md:p-4">
        <div className={panelClassName}>
          <div className="flex min-h-[3.75rem] items-center">
            {titleAvatarUrl ? (
              <div className="flex items-center gap-3">
                <div className="w-16 shrink-0 overflow-hidden rounded-[1rem] border border-white/10" style={{ aspectRatio: titleAvatarAspectRatio }}>
                  <img
                    className="h-full w-full object-cover"
                    src={titleAvatarUrl}
                    alt={`${title.displayName} avatar`}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => rememberCatalogMediaLoadSuccess(titleAvatarUrl)}
                    onError={() => {
                      rememberCatalogMediaLoadFailure(titleAvatarUrl);
                      setAvatarFailed(true);
                    }}
                  />
                </div>
                <div className="min-w-0 text-xl font-bold leading-tight text-white">{title.displayName}</div>
              </div>
            ) : (
              <div className="text-[1.85rem] font-bold leading-tight text-white">{title.displayName}</div>
            )}
          </div>
          <div className="overflow-hidden transition-all duration-300 ease-out max-h-0 translate-y-2 opacity-0 group-hover:mt-3 group-hover:max-h-[22rem] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:mt-3 group-focus-within:max-h-[22rem] group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-50/85">{title.studioDisplayName}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-cyan-50/90">
              <span className="shrink-0 rounded-full border border-white/15 px-3 py-1">{formatContentKindLabel(title.contentKind)}</span>
              <span className="shrink-0 rounded-full border border-white/15 px-3 py-1">{title.playerCountDisplay}</span>
            </div>
            <p
              className="mt-4 text-sm leading-6 text-slate-50/95"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {title.shortDescription}
            </p>
            {availabilityNote ? (
              <div className="mt-3 inline-flex rounded-full border border-amber-200/30 bg-amber-300/12 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-50">
                {availabilityNote}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {genreTags.map((tag) => (
                <span key={tag} className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-100">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <article className="app-panel group relative min-h-[26rem] overflow-hidden p-0 text-left transition duration-300 hover:-translate-y-1.5 hover:border-cyan-300/35 focus-within:-translate-y-1.5 focus-within:border-cyan-300/35">
      {playerActions ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20">
          <div className="pointer-events-auto">
            <TitlePlayerActionButtons
              visible={playerActions.visible}
              compact
              isBusy={playerActions.isBusy}
              isWishlisted={playerActions.isWishlisted}
              isOwned={playerActions.isOwned}
              showOwnedAction={allowOwnedAndReportActions}
              showReportAction={false}
              onToggleWishlist={playerActions.onToggleWishlist}
              onToggleOwned={playerActions.onToggleOwned}
              onShare={playerActions.onShare}
            />
          </div>
        </div>
      ) : null}
      {onOpenQuickView ? (
        <button className="block h-full w-full text-left" type="button" aria-label={title.displayName} onClick={() => onOpenQuickView(title)}>
          {cardBody}
        </button>
      ) : (
        <Link className="block h-full w-full text-left" aria-label={title.displayName} to={`/browse/${title.studioSlug}/${title.slug}`}>
          {cardBody}
        </Link>
      )}
    </article>
  );
}

export function PlayerRangeField({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}) {
  const minPercent = ((minValue - PLAYER_FILTER_MIN) / (PLAYER_FILTER_MAX - PLAYER_FILTER_MIN)) * 100;
  const maxPercent = ((maxValue - PLAYER_FILTER_MIN) / (PLAYER_FILTER_MAX - PLAYER_FILTER_MIN)) * 100;

  return (
    <div className="space-y-2 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-300">
          <span className="mr-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/85">Players</span>
          <span>{formatPlayerFilterSummary(minValue, maxValue)}</span>
        </div>
      </div>
      <div className="dual-range">
        <div className="dual-range-track" />
        <div className="dual-range-fill" style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }} />
        <input
          className="dual-range-input"
          type="range"
          min={PLAYER_FILTER_MIN}
          max={PLAYER_FILTER_MAX}
          step={1}
          value={minValue}
          aria-label="Minimum players"
          onChange={(event) => onMinChange(Number(event.currentTarget.value))}
        />
        <input
          className="dual-range-input"
          type="range"
          min={PLAYER_FILTER_MIN}
          max={PLAYER_FILTER_MAX}
          step={1}
          value={maxValue}
          aria-label="Maximum players"
          onChange={(event) => onMaxChange(Number(event.currentTarget.value))}
        />
      </div>
      <div className="flex items-center justify-between text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span>{PLAYER_FILTER_MIN}</span>
        <span>{PLAYER_FILTER_MAX}+</span>
      </div>
    </div>
  );
}

export function CompactTitleList({
  titles,
  emptyTitle,
  emptyDetail,
  onOpenQuickView,
}: {
  titles: CatalogTitleSummary[];
  emptyTitle: string;
  emptyDetail: string;
  onOpenQuickView?: (title: CatalogTitleSummary) => void;
}) {
  if (titles.length === 0) {
    return <EmptyState title={emptyTitle} detail={emptyDetail} />;
  }

  return (
    <div className="list-stack">
      {titles.map((title) => (
        <article key={title.id} className="list-item">
          <div>
            <strong>{title.displayName}</strong>
            <p>
              {title.studioDisplayName} · {title.playerCountDisplay} · {formatContentKindLabel(title.contentKind)}
            </p>
            {getCatalogTitleAvailabilityNote(title) ? <p className="mt-1 text-sm text-amber-200">{getCatalogTitleAvailabilityNote(title)}</p> : null}
          </div>
          <div className="button-row compact">
            {onOpenQuickView ? (
              <button className="secondary-button" type="button" onClick={() => onOpenQuickView(title)}>
                Quick view
              </button>
            ) : (
              <Link className="secondary-button" to={`/browse/${title.studioSlug}/${title.slug}`}>
                Open title
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function PlayerReportList({
  reports,
  selectedReportId,
  onSelect,
}: {
  reports: PlayerTitleReportSummary[];
  selectedReportId: string | null;
  onSelect: (reportId: string) => void;
}) {
  if (reports.length === 0) {
    return <EmptyState title="No reported titles" detail="Reports you submit from title pages will appear here." />;
  }

  return (
    <div className="list-stack">
      {reports.map((report) => (
        <button
          key={report.id}
          type="button"
          className={report.id === selectedReportId ? "list-item border-cyan-300/45 bg-cyan-300/10 text-left" : "list-item text-left"}
          onClick={() => onSelect(report.id)}
        >
          <div>
            <strong>{report.titleDisplayName}</strong>
            <p>
              {formatReportStatus(report.status)} · {formatTimestamp(report.updatedAt)}
            </p>
          </div>
          <div className="status-chip">{formatReportStatus(report.status)}</div>
        </button>
      ))}
    </div>
  );
}

export function ModerationReportList({
  reports,
  selectedReportId,
  onSelect,
}: {
  reports: TitleReportSummary[];
  selectedReportId: string | null;
  onSelect: (reportId: string) => void;
}) {
  if (reports.length === 0) {
    return <EmptyState title="No reports need review" detail="Open player reports will appear here for moderators." />;
  }

  return (
    <div className="list-stack">
      {reports.map((report) => (
        <button
          key={report.id}
          type="button"
          className={report.id === selectedReportId ? "list-item border-cyan-300/45 bg-cyan-300/10 text-left" : "list-item text-left"}
          onClick={() => onSelect(report.id)}
        >
          <div>
            <strong>{report.titleDisplayName}</strong>
            <p>
              {report.reporterDisplayName ?? report.reporterUserName ?? report.reporterEmail ?? "Unknown reporter"} · {formatTimestamp(report.updatedAt)}
            </p>
          </div>
          <div className="status-chip">{formatReportStatus(report.status)}</div>
        </button>
      ))}
    </div>
  );
}

export function TitleReportConversation({
  detail,
  viewerRole,
}: {
  detail: TitleReportDetail;
  viewerRole: "player" | "developer" | "moderator";
}) {
  const visibleMessages = detail.messages.filter((message) => canViewTitleReportMessageAudience(message.audience, viewerRole));

  return (
    <div className="list-stack">
      <article className="list-item">
        <div>
          <strong>{detail.report.titleDisplayName}</strong>
          <p>
            {detail.report.studioDisplayName} · {formatReportStatus(detail.report.status)} · opened {formatTimestamp(detail.report.createdAt)}
          </p>
        </div>
        <div className="status-chip">{formatReportStatus(detail.report.status)}</div>
      </article>

      <section className="surface-panel-soft rounded-[1rem] p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Original report</div>
        <p className="mt-3 text-sm leading-7 text-slate-300">{detail.report.reason}</p>
        {detail.resolutionNote ? (
          <div className="surface-panel-soft mt-4 rounded-[1rem] p-4 text-sm text-slate-300">
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Resolution note</div>
            <p className="mt-2">{detail.resolutionNote}</p>
          </div>
        ) : null}
      </section>

      {visibleMessages.length > 0 ? (
        <div className="list-stack">
          {visibleMessages.map((message) => (
            <article key={message.id} className="surface-panel-soft rounded-[1rem] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">
                  {message.authorDisplayName ?? message.authorUserName ?? message.authorEmail ?? message.authorSubject}
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
                  {formatMembershipRole(message.authorRole)} · {formatAudienceLabel(message.audience)}
                </div>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{message.message}</p>
              <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">{formatTimestamp(message.createdAt)}</div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No conversation yet" detail="Messages from players, developers, and moderators will appear here." />
      )}
    </div>
  );
}
