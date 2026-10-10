import { ROLES, type Role } from '../domain';
import { DEMO_ACTORS, type Actor } from './actors';
import { AccessDeniedError, ForbiddenError } from './errors';

export const ROLE_COOKIE = 'dewecs_role';
export const DEFAULT_ROLE: Role = 'CITIZEN';

export const ROLE_VALUES: readonly string[] = [
  'CITIZEN',
  'DUTY_OFFICER',
  'DMC_OFFICIAL',
  'DISTRICT_OFFICER',
];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Minimal cookie-header parser (`name=value; name2=value2`). */
export function readCookie(header: string | null, name: string): string | null {
  if (header === null) {
    return null;
  }
  for (const pair of header.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
 
      continue;
    }
    if (pair.slice(0, separatorIndex).trim() === name) {
      return pair.slice(separatorIndex + 1).trim();
    }
  }
  return null;
}

/** Turns a raw cookie value into an Actor. Missing or invalid values fall back to Citizen. */
export function actorFromRoleValue(value: string | undefined | null): Actor {
  return DEMO_ACTORS[isRole(value) ? value : DEFAULT_ROLE];
}

/**
 * Resolve the caller from the request's `actor` or `dewecs_role` cookie.
 * Supports:
 * 1. JSON payload: {"id":"officer-1","role":"DMC_OFFICIAL"}
 * 2. Bare role in 'actor' cookie: DMC_OFFICIAL
 * 3. Role in 'dewecs_role' cookie: DMC_OFFICIAL
 *
 * @throws ForbiddenError when cookie is missing or unrecognised
 */
export function getActor(request: Request): Actor {
  const cookieHeader = request.headers.get('cookie');

  // Check 'actor' cookie first (used by UC3/UC4)
  const rawActor = readCookie(cookieHeader, 'actor');
  if (rawActor !== null) {
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(rawActor));
      if (typeof parsed === 'object' && parsed !== null) {
        const candidate = parsed as { id?: unknown; role?: unknown; districtId?: unknown };
        if (typeof candidate.id === 'string' && isRole(candidate.role)) {
          return {
            id: candidate.id,
            userId: candidate.id,
            name: `${candidate.role} User`,
            role: candidate.role,
            districtId: typeof candidate.districtId === 'string' ? candidate.districtId : undefined,
          };
        }
      }
    } catch {
      // not JSON — fall through to bare role
    }

    if (isRole(rawActor)) {
      return DEMO_ACTORS[rawActor];
    }
  }

  // Check 'dewecs_role' cookie (used by UC1 switcher)
  const rawRole = readCookie(cookieHeader, ROLE_COOKIE);
  if (rawRole !== null) {
    return actorFromRoleValue(rawRole);
  }

  // Neither cookie is present
  throw new ForbiddenError('ANONYMOUS', 'access this endpoint');
}

/** Throws AccessDeniedError (subclass of ForbiddenError) unless the actor has one of the allowed roles. */
export function requireRole(actor: Actor, allowed: readonly Role[] | Role[]): void {
  if (!allowed.includes(actor.role)) {
    throw new AccessDeniedError(actor.role, `access this endpoint (requires ${allowed.join(', ')})`);
  }
}