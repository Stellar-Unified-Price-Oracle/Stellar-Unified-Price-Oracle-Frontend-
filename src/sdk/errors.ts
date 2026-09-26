/** Documented server error codes. See docs/sdk-errors.md. */
export type OracleErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_failed'
  | 'rate_limited'
  | 'server_error'
  | 'unavailable'
  | 'network_error'
  | 'invalid_response'
  | 'unknown'

export interface OracleErrorInit {
  status?: number
  code?: OracleErrorCode
  retryAfterMs?: number | null
  body?: unknown
  cause?: unknown
}

export class OracleError extends Error {
  readonly status?: number
  readonly code: OracleErrorCode
  readonly retryable: boolean
  readonly retryAfterMs: number | null
  readonly body?: unknown
  constructor(message: string, init: OracleErrorInit = {}, retryable = false) {
    super(message, init.cause === undefined ? undefined : { cause: init.cause })
    this.name = new.target.name
    this.status = init.status
    this.code = init.code ?? 'unknown'
    this.retryable = retryable
    this.retryAfterMs = init.retryAfterMs ?? null
    this.body = init.body
  }
}
export class OracleBadRequestError extends OracleError {
  constructor(m: string, i: OracleErrorInit = {}) { super(m, { code: 'bad_request', ...i }) }
}
export class OracleAuthError extends OracleError {
  constructor(m: string, i: OracleErrorInit = {}) { super(m, { code: 'unauthorized', ...i }) }
}
export class OracleNotFoundError extends OracleError {
  constructor(m: string, i: OracleErrorInit = {}) { super(m, { code: 'not_found', ...i }) }
}
export class OracleConflictError extends OracleError {
  constructor(m: string, i: OracleErrorInit = {}) { super(m, { code: 'conflict', ...i }) }
}
export class OracleValidationError extends OracleError {
  constructor(m: string, i: OracleErrorInit = {}) { super(m, { code: 'validation_failed', ...i }) }
}
export class OracleRateLimitError extends OracleError {
  constructor(m: string, i: OracleErrorInit = {}) { super(m, { code: 'rate_limited', ...i }, true) }
}
export class OracleServerError extends OracleError {
  constructor(m: string, i: OracleErrorInit = {}) { super(m, { code: 'server_error', ...i }, true) }
}
export class OracleUnavailableError extends OracleError {
  constructor(m: string, i: OracleErrorInit = {}) { super(m, { code: 'unavailable', ...i }, true) }
}
export class OracleNetworkError extends OracleError {
  constructor(m: string, i: OracleErrorInit = {}) { super(m, { code: 'network_error', ...i }, true) }
}

const CODE_MAP: Record<string, new (m: string, i?: OracleErrorInit) => OracleError> = {
  bad_request: OracleBadRequestError,
  unauthorized: OracleAuthError,
  forbidden: OracleAuthError,
  not_found: OracleNotFoundError,
  conflict: OracleConflictError,
  validation_failed: OracleValidationError,
  rate_limited: OracleRateLimitError,
  server_error: OracleServerError,
  unavailable: OracleUnavailableError,
}

const STATUS_CODE: Record<number, string> = {
  400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict',
  422: 'validation_failed', 429: 'rate_limited', 503: 'unavailable',
}

/** Map an HTTP status and optional parsed body (`{ code }` / `{ error: { code } }`) to a typed error. */
export function errorFromResponse(status: number, statusText: string, body: unknown, retryAfterMs: number | null): OracleError {
  const b = body as { code?: unknown; error?: { code?: unknown; message?: unknown } | string; message?: unknown } | null
  const serverCode = typeof b?.code === 'string' ? b.code : typeof b?.error === 'object' && typeof b.error?.code === 'string' ? b.error.code : undefined
  const key = serverCode && serverCode in CODE_MAP ? serverCode : STATUS_CODE[status] ?? (status >= 500 ? 'server_error' : 'bad_request')
  const Ctor = CODE_MAP[key] ?? OracleError
  const msg = `Oracle API request failed (${status} ${statusText})`
  const err = new Ctor(msg, { status, retryAfterMs, body })
  if (key === 'forbidden') return Object.assign(err, { code: 'forbidden' as const })
  return err
}
