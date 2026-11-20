/**
 * SDK error types.
 *
 * All errors thrown by the SDK extend {@link SdkError} so consumers can
 * reliably distinguish SDK failures from unrelated runtime errors.
 */

export interface SdkErrorOptions {
  /** Underlying error that triggered this failure, if any. */
  cause?: unknown;
  /** Optional machine-readable error code. */
  code?: string;
}

/**
 * Base class for all errors raised by the SDK.
 */
export class SdkError extends Error {
  /** Machine-readable error code, when available. */
  readonly code?: string;

  constructor(message: string, options: SdkErrorOptions = {}) {
    super(message);
    this.name = 'SdkError';
    this.code = options.code;
    // Assign `cause` manually instead of passing it as a second argument to
    // `super()`, which requires `es2022.error` in the configured lib target.
    if (options.cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        enumerable: false,
        writable: true,
        configurable: true,
      });
    }
    // Restore prototype chain for environments that down-level classes.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised when the SDK receives an invalid or unexpected response.
 */
export class SdkResponseError extends SdkError {
  /** HTTP status code associated with the failure, when available. */
  readonly status?: number;

  constructor(message: string, options: SdkErrorOptions & { status?: number } = {}) {
    super(message, options);
    this.name = 'SdkResponseError';
    this.status = options.status;
  }
}

/**
 * Raised when a request to the API fails at the transport layer.
 */
export class SdkNetworkError extends SdkError {
  constructor(message: string, options: SdkErrorOptions = {}) {
    super(message, options);
    this.name = 'SdkNetworkError';
  }
}
