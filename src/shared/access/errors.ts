/** Thrown when the current role may not perform an action. Routes map this to HTTP 403. */
export class AccessDeniedError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AccessDeniedError';
  }
}