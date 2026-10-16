import { ForbiddenError } from '@/modules/uc4-analysis/domain/errors'
import type { Actor, Role } from '@/shared/contracts/types'

/**
 * Shared access helpers (README §4: src/shared/access).
 *
 * The role switcher stores the caller in an `actor` cookie; API routes call
 * `getActor(request)` then `requireRole(actor, [...])`. Failures throw the
 * typed ForbiddenError, which routes map to HTTP 403.
 */

const ROLE_VALUES: readonly string[] = [
  'CITIZEN',
  'DUTY_OFFICER',
  'DMC_OFFICIAL',
  'DISTRICT_OFFICER',
]

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value)
}

/** Minimal cookie-header parser (`name=value; name2=value2`). */
function readCookie(header: string | null, name: string): string | null {
  if (header === null) {
    return null
  }
  for (const pair of header.split(';')) {
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    if (pair.slice(0, separatorIndex).trim() === name) {
      return pair.slice(separatorIndex + 1).trim()
    }
  }
  return null
}

/**
 * Resolve the caller from the request's `actor` cookie.
 *
 * Accepted formats:
 * 1. JSON payload (optionally URL-encoded): {"id":"officer-1","role":"DMC_OFFICIAL"}
 * 2. Bare role name: DMC_OFFICIAL (id derived as `cookie-<role>`)
 *
 * @throws ForbiddenError when the cookie is missing or unrecognised
 */
export async function getActor(request: Request): Promise<Actor> {
  const raw = readCookie(request.headers.get('cookie'), 'actor')
  if (raw === null) {
    throw new ForbiddenError('ANONYMOUS', 'access this endpoint')
  }

  // Format 1: JSON actor payload.
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (typeof parsed === 'object' && parsed !== null) {
      const candidate = parsed as { id?: unknown; role?: unknown }
      if (typeof candidate.id === 'string' && isRole(candidate.role)) {
        return { id: candidate.id, role: candidate.role }
      }
    }
  } catch {
    // Not JSON — fall through to the bare-role format.
  }

  // Format 2: bare role name.
  if (isRole(raw)) {
    return { id: `cookie-${raw.toLowerCase()}`, role: raw }
  }

  throw new ForbiddenError('UNKNOWN', 'access this endpoint')
}

/**
 * Guard: the actor must hold one of the allowed roles (BR1).
 *
 * @throws ForbiddenError when the actor's role is not allowed
 */
export function requireRole(actor: Actor, roles: readonly Role[]): void {
  if (!roles.includes(actor.role)) {
    throw new ForbiddenError(actor.role, `access this endpoint (requires ${roles.join(', ')})`)
  }
}
