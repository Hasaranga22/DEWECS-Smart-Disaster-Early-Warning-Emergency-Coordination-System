import { describe, it, expect } from "vitest";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  VersionConflictError,
  BusinessRuleError,
  DependencyError,
} from "../errors";

describe("Domain Error Classes", () => {
  it("ValidationError has 400 status and optional fields", () => {
    const err = new ValidationError("Invalid input", { field: "required" });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Invalid input");
    expect(err.fields).toEqual({ field: "required" });
    expect(err.name).toBe("ValidationError");
  });

  it("ForbiddenError has 403 status", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe("ForbiddenError");
  });

  it("NotFoundError has 404 status", () => {
    const err = new NotFoundError("Not found");
    expect(err.statusCode).toBe(404);
  });

  it("VersionConflictError has 409 status", () => {
    const err = new VersionConflictError();
    expect(err.statusCode).toBe(409);
  });

  it("BusinessRuleError has 422 status", () => {
    const err = new BusinessRuleError("Rule violated");
    expect(err.statusCode).toBe(422);
  });

  it("DependencyError has 503 status", () => {
    const err = new DependencyError("External service down");
    expect(err.statusCode).toBe(503);
  });
});
