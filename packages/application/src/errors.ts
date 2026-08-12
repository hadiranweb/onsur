/**
 * Application error taxonomy. Services throw `AppError` with a stable `code`;
 * HTTP boundaries map `code` to a status without exposing internals.
 */
export type AppErrorCode =
  | 'INVALID_INPUT'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'

const STATUS: Record<AppErrorCode, number> = {
  INVALID_INPUT: 400,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
}

export class AppError extends Error {
  readonly status: number

  constructor(
    readonly code: AppErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
    this.status = STATUS[code]
  }
}

/**
 * Thrown by persistence adapters when a unique constraint is violated (e.g.
 * duplicate email, duplicate slug, or a second personal workspace for a user).
 */
export class UniqueViolationError extends Error {
  constructor(readonly constraint?: string) {
    super('unique constraint violation')
    this.name = 'UniqueViolationError'
  }
}
