import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toErrorResponse } from "../http/errorResponse";
import { ValidationError, BusinessRuleError } from "../errors";

describe("toErrorResponse HTTP error mapper", () => {
  it("maps DomainError to corresponding HTTP status and message", async () => {
    const err = new BusinessRuleError("Stock depleted");
    const response = toErrorResponse(err);
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json).toEqual({
      error: {
        code: "BusinessRuleError",
        message: "Stock depleted",
      },
    });
  });

  it("maps ZodError to 400 with field issue details", async () => {
    const schema = z.object({ quantity: z.number().positive() });
    const result = schema.safeParse({ quantity: -5 });
    if (!result.success) {
      const response = toErrorResponse(result.error);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.code).toBe("ValidationError");
      expect(json.error.details).toBeDefined();
    }
  });

  it("maps unknown error to 500 without leaking stack internal details", async () => {
    const err = new Error("Database crashed secret stack info");
    const response = toErrorResponse(err);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toEqual({
      error: {
        code: "InternalServerError",
        message: "An unexpected error occurred",
      },
    });
  });
});
