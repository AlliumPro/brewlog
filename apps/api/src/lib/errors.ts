/**
 * Errors that are safe to show a client. Anything else becomes a generic 500 in the
 * error handler, so an unexpected failure cannot leak internals through its message.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string): AppError =>
  new AppError(404, 'not_found', `${what} not found`);

export const unauthorized = (message = 'Authentication required'): AppError =>
  new AppError(401, 'unauthorized', message);

export const conflict = (message: string): AppError => new AppError(409, 'conflict', message);

export const unprocessable = (message: string): AppError =>
  new AppError(422, 'validation_error', message);

export const unsupportedMedia = (message: string): AppError =>
  new AppError(415, 'unsupported_media_type', message);
