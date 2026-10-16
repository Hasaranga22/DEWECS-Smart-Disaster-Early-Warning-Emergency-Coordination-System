import { ForbiddenError } from '@/modules/uc4-analysis/domain/errors';

export { ForbiddenError };

/** Thrown when the current role may not perform an action. Routes map this to HTTP 403. */
export class AccessDeniedError extends ForbiddenError {
  constructor(role = 'UNKNOWN', action = 'perform this action') {
    super(role, action);
    this.name = 'AccessDeniedError';
    this.message = 'Access denied';
  }
}