import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "../errors";

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Standardized HTTP error response mapper for DEWECS API routes.
 * Maps DomainErrors, ZodErrors, and unknown errors to consistent JSON payloads.
 */
export function toErrorResponse(error: unknown): NextResponse<ErrorResponseBody> {
  if (error instanceof DomainError) {
    return NextResponse.json(
      {
        error: {
          code: error.name,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    const fieldErrors = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    return NextResponse.json(
      {
        error: {
          code: "ValidationError",
          message: "Invalid input payload",
          details: fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  // Unknown internal server error - never leak internal stack traces or database info
  return NextResponse.json(
    {
      error: {
        code: "InternalServerError",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}
