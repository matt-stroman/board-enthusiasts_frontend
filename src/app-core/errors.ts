import { ApiError } from "../api";

export const supportRoute = "/support";
export const supportEmailAddress = "support@boardenthusiasts.com";
export const supportEmailHref = `mailto:${supportEmailAddress}`;

function readErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return null;
}

function looksTechnical(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    "board enthusiasts api",
    "configured frontend api base url",
    "failed to fetch",
    "load failed",
    "networkerror",
    "duplicate key value",
    "violates",
    "constraint",
    "row for relation",
    "relation \"",
    "sql",
    "supabase",
    "storage.objects",
    "jwt",
    "auth session missing",
  ].some((pattern) => normalized.includes(pattern));
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallback = "We couldn't complete that right now. Please try again.",
): string {
  const message = readErrorMessage(error)?.trim();
  if (!message) {
    return fallback;
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes("could not reach the board enthusiasts api") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("networkerror")
  ) {
    return "We couldn't reach Board Enthusiasts right now. Please check your connection and try again.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "That email and password combination wasn't accepted. Check your details and try again.";
  }

  if (normalized.includes("email not confirmed") || normalized.includes("email not verified")) {
    return "Please confirm your email address before signing in.";
  }

  if (normalized.includes("user already registered")) {
    return "An account with that email already exists. Try signing in instead.";
  }

  if (normalized.includes("unable to validate email address")) {
    return "Enter a valid email address and try again.";
  }

  if (
    normalized.includes("otp expired") ||
    normalized.includes("token has expired") ||
    normalized.includes("invalid token") ||
    normalized.includes("expired")
  ) {
    return "That code or link has expired. Request a new one and try again.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Board Enthusiasts is getting more requests than usual right now. Please wait a moment and try again.";
  }

  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session is no longer active. Please sign in again and try once more.";
    }

    if (error.status === 403) {
      return "This part of Board Enthusiasts isn't available to your account.";
    }

    if (error.status === 404) {
      return "We couldn't find what you were looking for.";
    }

    if (error.status === 409 && (normalized.includes("already") || normalized.includes("duplicate") || normalized.includes("exists"))) {
      return "That information is already in use. Review it and try again.";
    }

    if (error.status === 429) {
      return "Board Enthusiasts is getting more requests than usual right now. Please wait a moment and try again.";
    }

    if (error.status >= 500 || looksTechnical(message)) {
      return "Board Enthusiasts is having trouble right now. Please try again in a moment.";
    }
  }

  if (looksTechnical(message)) {
    return fallback;
  }

  return message;
}
