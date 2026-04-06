export const STUDIO_DESCRIPTION_MAX_LENGTH = 1600;
export const TITLE_SHORT_DESCRIPTION_MAX_LENGTH = 220;
export const TITLE_DESCRIPTION_MAX_LENGTH = 1600;

export type ValidationErrors = Record<string, string>;

export interface ValidationResult {
  errors: ValidationErrors;
  isValid: boolean;
}

interface StudioValidationInput {
  displayName: string;
  slug: string;
  description: string;
}

interface TitleFormValidationInput {
  displayName: string;
  slug: string;
  contentKind: string;
  genres: string[];
  shortDescription: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  ageRatingAuthority: string;
  ageRatingValue: string;
  minAgeYears: number;
}

interface TitleOverviewValidationInput {
  contentKind: string;
  visibility: string;
}

interface ReleaseValidationInput {
  version: string;
  status: string;
  acquisitionUrl: string;
  expiresAt?: string;
}

function buildValidationResult(errors: ValidationErrors): ValidationResult {
  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getMinimumReleaseExpirationDate(now = new Date()): Date {
  const minimum = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  minimum.setSeconds(0, 0);
  return minimum;
}

export function clampMinimumAge(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(18, Math.trunc(value)));
}

export function clampPlayerRange(minPlayers: number, maxPlayers: number): { minPlayers: number; maxPlayers: number } {
  const safeMin = Math.max(1, Math.trunc(Number.isFinite(minPlayers) ? minPlayers : 1));
  const safeMax = Math.max(safeMin, Math.trunc(Number.isFinite(maxPlayers) ? maxPlayers : safeMin));
  return {
    minPlayers: safeMin,
    maxPlayers: safeMax,
  };
}

export function shouldShowCharacterCounter(value: string, maxLength: number): boolean {
  return value.trim().length >= Math.floor(maxLength * 0.9);
}

export function validateStudioInput(
  input: StudioValidationInput,
  context: { existingSlugs: string[]; currentSlug?: string | null },
): ValidationResult {
  const errors: ValidationErrors = {};
  const displayName = input.displayName.trim();
  const slug = input.slug.trim().toLowerCase();
  const description = input.description.trim();

  if (!displayName) {
    errors.displayName = "Studio display name is required.";
  }

  if (!slug) {
    errors.slug = "Studio slug is required.";
  } else {
    const currentSlug = context.currentSlug?.trim().toLowerCase() ?? null;
    const duplicate = context.existingSlugs.some((candidate) => candidate.trim().toLowerCase() === slug && candidate.trim().toLowerCase() !== currentSlug);
    if (duplicate) {
      errors.slug = "This studio slug is already in use.";
    }
  }

  if (!description) {
    errors.description = "Description is required.";
  } else if (description.length > STUDIO_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Keep the description at or under ${STUDIO_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  return buildValidationResult(errors);
}

export function validateTitleFormInput(
  input: TitleFormValidationInput,
  context: { existingSlugs: string[]; currentSlug?: string | null },
): ValidationResult {
  const errors: ValidationErrors = {};
  const displayName = input.displayName.trim();
  const slug = input.slug.trim().toLowerCase();
  const shortDescription = input.shortDescription.trim();
  const description = input.description.trim();
  const ageRatingAuthority = input.ageRatingAuthority.trim();
  const ageRatingValue = input.ageRatingValue.trim();

  if (!displayName) {
    errors.displayName = "Display name is required.";
  }

  if (!slug) {
    errors.slug = "Title slug is required.";
  } else {
    const currentSlug = context.currentSlug?.trim().toLowerCase() ?? null;
    const duplicate = context.existingSlugs.some((candidate) => candidate.trim().toLowerCase() === slug && candidate.trim().toLowerCase() !== currentSlug);
    if (duplicate) {
      errors.slug = "This title slug is already in use for the selected studio.";
    }
  }

  if (!input.contentKind.trim()) {
    errors.contentKind = "Content kind is required.";
  }

  if (input.genres.length === 0) {
    errors.genres = "Select at least one genre.";
  }

  if (!shortDescription) {
    errors.shortDescription = "Short description is required.";
  } else if (shortDescription.length > TITLE_SHORT_DESCRIPTION_MAX_LENGTH) {
    errors.shortDescription = `Keep the short description at or under ${TITLE_SHORT_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (!description) {
    errors.description = "Description is required.";
  } else if (description.length > TITLE_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Keep the description at or under ${TITLE_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (ageRatingAuthority && !ageRatingValue) {
    errors.ageRatingValue = "Add a rating value when you choose an age rating authority.";
  }

  if (!ageRatingAuthority && ageRatingValue) {
    errors.ageRatingAuthority = "Choose an age rating authority when you add a rating value.";
  }

  if (!Number.isFinite(input.minPlayers) || input.minPlayers < 1) {
    errors.minPlayers = "Minimum players must be at least 1.";
  }

  if (!Number.isFinite(input.maxPlayers) || input.maxPlayers < 1) {
    errors.maxPlayers = "Maximum players must be at least 1.";
  } else if (input.maxPlayers < input.minPlayers) {
    errors.maxPlayers = "Maximum players must be greater than or equal to minimum players.";
  }

  if (!Number.isFinite(input.minAgeYears) || input.minAgeYears < 0 || input.minAgeYears > 18) {
    errors.minAgeYears = "Minimum age must be between 0 and 18.";
  }

  return buildValidationResult(errors);
}

export function validateTitleOverviewInput(
  input: TitleOverviewValidationInput,
  _context: { existingSlugs: string[]; currentSlug?: string | null },
): ValidationResult {
  const errors: ValidationErrors = {};

  if (!input.contentKind.trim()) {
    errors.contentKind = "Content kind is required.";
  }

  if (input.visibility !== "unlisted" && input.visibility !== "listed") {
    errors.visibility = "Visibility is required.";
  }

  return buildValidationResult(errors);
}

export function validateReleaseInput(input: ReleaseValidationInput): ValidationResult {
  const errors: ValidationErrors = {};

  if (!input.version.trim()) {
    errors.version = "Version is required.";
  }

  if (input.status !== "testing" && input.status !== "production") {
    errors.status = "Release type is required.";
  }

  if (input.acquisitionUrl.trim() && !isAbsoluteUrl(input.acquisitionUrl.trim())) {
    errors.acquisitionUrl = "Acquisition URL must be an absolute URL.";
  }

  if (input.status === "production" && input.expiresAt?.trim()) {
    errors.expiresAt = "Only testing releases can have an expiration date.";
  }

  if (input.expiresAt?.trim() && Number.isNaN(Date.parse(input.expiresAt.trim()))) {
    errors.expiresAt = "Expiration date must be a valid date and time.";
  }

  if (!errors.expiresAt && input.status === "testing" && input.expiresAt?.trim()) {
    const expirationDate = new Date(input.expiresAt.trim());
    if (expirationDate.getTime() < getMinimumReleaseExpirationDate().getTime()) {
      errors.expiresAt = "Choose an expiration date at least 24 hours from now.";
    }
  }

  return buildValidationResult(errors);
}
