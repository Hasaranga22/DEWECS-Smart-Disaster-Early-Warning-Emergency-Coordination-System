export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends DomainError {
  public readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.fields = fields;
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Access denied') {
    super(message);
  }
}

export class AlertClosedError extends DomainError {
  constructor(alertId: string, status: string) {
    super(`Cannot modify alert ${alertId} because it is closed in state ${status}.`);
  }
}

export class MaxSeverityError extends DomainError {
  constructor(alertId: string) {
    super(`Alert ${alertId} is already at maximum severity (EMERGENCY) and cannot be escalated further.`);
  }
}

export class InvalidSeverityTransitionError extends DomainError {
  constructor(fromSeverity: string, toSeverity: string) {
    super(`Cannot transition severity from ${fromSeverity} to ${toSeverity}. Escalation must increase severity.`);
  }
}

export class AlertNotEscalatableError extends DomainError {
  constructor(reason: string) {
    super(reason);
  }
}

export class ZeroRecipientsNotConfirmedError extends DomainError {
  constructor() {
    super('Target area has zero recipients. Explicit confirmation required to issue with zero recipients.');
  }
}

export class GatewayError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
