/**
 * Typed domain errors for UC2 – Ground Reports.
 *
 * Rules:
 *  - Never throw plain Error("some string") inside services or domain.
 *  - Always throw these typed classes so the UI can assert the type
 *    and show the correct message.
 */

/** Thrown when the optimistic-lock version does not match the stored version. */
export class VersionConflictError extends Error {
  readonly name = "VersionConflictError";

  constructor(reportId: string, expected: number, actual: number) {
    super(
      `Version conflict on report "${reportId}": expected ${expected}, got ${actual}.`
    );
    Object.setPrototypeOf(this, VersionConflictError.prototype);
  }
}

/**
 * Thrown when a state-machine transition is not allowed from the
 * current ReviewStatus (e.g. verify() on an already-REJECTED report).
 */
export class InvalidStateTransitionError extends Error {
  readonly name = "InvalidStateTransitionError";

  constructor(from: string, action: string) {
    super(`Cannot perform "${action}" on a report in status "${from}".`);
    Object.setPrototypeOf(this, InvalidStateTransitionError.prototype);
  }
}

/**
 * Thrown by the repository when a sync attempt arrives with a
 * localId that already exists in the database.
 * The caller should treat this as a successful de-dup and return the
 * existing record instead of failing.
 */
export class DuplicateLocalIdError extends Error {
  readonly name = "DuplicateLocalIdError";

  constructor(localId: string) {
    super(`A report with localId "${localId}" already exists.`);
    Object.setPrototypeOf(this, DuplicateLocalIdError.prototype);
  }
}

/**
 * Thrown when a required field (hazard type, description, location)
 * is missing during report validation.
 */
export class ValidationError extends Error {
  readonly name = "ValidationError";

  constructor(
    public readonly fields: ReadonlyArray<string>,
    message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
