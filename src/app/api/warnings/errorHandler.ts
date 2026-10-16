import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  AlertClosedError,
  AlertNotEscalatableError,
  ForbiddenError,
  GatewayError,
  InvalidSeverityTransitionError,
  MaxSeverityError,
  NotFoundError,
  ValidationError,
  ZeroRecipientsNotConfirmedError,
} from '@/modules/uc1-warning';
import { AccessDeniedError } from '@/shared/access/errors';

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      fieldErrors[path] = issue.message;
    }
    return NextResponse.json(
      {
        error: 'Validation failed',
        fields: fieldErrors,
      },
      { status: 400 },
    );
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: error.message,
        fields: error.fields,
      },
      { status: 400 },
    );
  }

  if (error instanceof AccessDeniedError || error instanceof ForbiddenError) {
    return NextResponse.json(
      {
        error: error.message || 'Access denied',
      },
      { status: 403 },
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 404 },
    );
  }

  if (
    error instanceof MaxSeverityError ||
    error instanceof InvalidSeverityTransitionError ||
    error instanceof AlertClosedError ||
    error instanceof AlertNotEscalatableError ||
    error instanceof ZeroRecipientsNotConfirmedError
  ) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.constructor.name,
      },
      { status: 422 },
    );
  }

  if (error instanceof GatewayError) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 503 },
    );
  }

  const message = error instanceof Error ? error.message : 'Internal Server Error';
  return NextResponse.json(
    {
      error: message,
    },
    { status: 500 },
  );
}
