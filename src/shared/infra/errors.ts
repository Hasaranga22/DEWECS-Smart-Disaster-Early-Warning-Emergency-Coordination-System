/**
 * Base typed domain error class for DEWECS.
 */
export abstract class DomainError extends Error {
  public abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 400 Bad Request - Invalid client input or parameters. */
export class ValidationError extends DomainError {
  public readonly statusCode = 400;
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message);
  }
}

/** 403 Forbidden - Role or district access boundary violated. */
export class ForbiddenError extends DomainError {
  public readonly statusCode = 403;
  constructor(message: string = "Access denied: insufficient permissions or out of assigned district") {
    super(message);
  }
}

/** 404 Not Found - Entity does not exist. */
export class NotFoundError extends DomainError {
  public readonly statusCode = 404;
  constructor(message: string) {
    super(message);
  }
}

/** 409 Conflict - Optimistic locking or concurrency conflict. */
export class VersionConflictError extends DomainError {
  public readonly statusCode = 409;
  constructor(message: string = "Version conflict: entity has been updated by another action") {
    super(message);
  }
}

/** 422 Unprocessable Entity - Business rule violation. */
export class BusinessRuleError extends DomainError {
  public readonly statusCode = 422;
  constructor(message: string) {
    super(message);
  }
}

/** 503 Service Unavailable - External dependency failure. */
export class DependencyError extends DomainError {
  public readonly statusCode = 503;
  constructor(message: string) {
    super(message);
  }
}
