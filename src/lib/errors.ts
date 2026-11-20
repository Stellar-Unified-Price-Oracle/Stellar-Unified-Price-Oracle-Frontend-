export type ApiErrorCategory =
  | "network"
  | "timeout"
  | "rate_limit"
  | "auth"
  | "not_found"
  | "server"
  | "validation"
  | "stale"
  | "unavailable"
  | "unknown";

export interface RecoveryCopy {
  /** Short headline shown to the user. */
  title: string;
  /** One-sentence explanation of what happened. */
  message: string;
  /** Concrete next step the user can take. */
  recovery: string;
  /** Whether retrying the same request is likely to help. */
  retryable: boolean;
}

const RECOVERY_COPY: Record<ApiErrorCategory, RecoveryCopy> = {
  network: {
    title: "Connection problem",
    message: "We couldn't reach the price oracle. Check your internet connection.",
    recovery: "Verify you're online, then try again.",
    retryable: true,
  },
  timeout: {
    title: "Request timed out",
    message: "The price oracle took too long to respond.",
    recovery: "Try again in a moment.",
    retryable: true,
  },
  rate_limit: {
    title: "Too many requests",
    message: "You've made too many requests in a short period.",
    recovery: "Wait a few seconds before refreshing prices again.",
    retryable: true,
  },
  auth: {
    title: "Not authorized",
    message: "Your session isn't allowed to fetch prices right now.",
    recovery: "Reconnect your wallet or sign in again, then retry.",
    retryable: false,
  },
  not_found: {
    title: "Price not found",
    message: "No price data exists for the requested asset pair.",
    recovery: "Check the asset pair or choose a different one.",
    retryable: false,
  },
  server: {
    title: "Oracle error",
    message: "The price oracle ran into an unexpected problem.",
    recovery: "Try again shortly. If it persists, check the status page.",
    retryable: true,
  },
  validation: {
    title: "Invalid request",
    message: "Some of the details in this request aren't valid.",
    recovery: "Review the asset pair and amount, then try again.",
    retryable: false,
  },
  stale: {
    title: "Prices may be out of date",
    message: "The latest prices couldn't be refreshed, so you're seeing the last known values.",
    recovery: "Refresh to fetch the most recent prices.",
    retryable: true,
  },
  unavailable: {
    title: "Prices unavailable",
    message: "Price data is temporarily unavailable.",
    recovery: "Try again in a moment.",
    retryable: true,
  },
  unknown: {
    title: "Something went wrong",
    message: "An unexpected error occurred while loading prices.",
    recovery: "Try again. If the problem continues, contact support.",
    retryable: true,
  },
};

/**
 * Map an HTTP status code (or thrown error) to a known API error category.
 * Falls back to "unknown" so every error has user-facing recovery copy.
 */
export function categorizeApiError(error: unknown): ApiErrorCategory {
  if (typeof error === "number") {
    return categorizeStatus(error);
  }

  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    if (name === "aborterror" || message.includes("timeout")) {
      return "timeout";
    }
    if (message.includes("network") || message.includes("failed to fetch")) {
      return "network";
    }
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") {
      return categorizeStatus(status);
    }
  }

  return "unknown";
}

function categorizeStatus(status: number): ApiErrorCategory {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 408 || status === 504) return "timeout";
  if (status === 422 || status === 400) return "validation";
  if (status === 429) return "rate_limit";
  if (status === 503) return "unavailable";
  if (status >= 500) return "server";
  return "unknown";
}

/**
 * Return user-facing recovery copy for any known API error category.
 * Accepts a category, an HTTP status code, or a thrown error.
 */
export function getRecoveryCopy(
  input: ApiErrorCategory | number | unknown,
): RecoveryCopy {
  const category =
    typeof input === "string" && input in RECOVERY_COPY
      ? (input as ApiErrorCategory)
      : categorizeApiError(input);
  return RECOVERY_COPY[category];
}
