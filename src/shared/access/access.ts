import { ROLES, type Role } from '../domain';
import { DEMO_ACTORS, type Actor } from './actors';
import { AccessDeniedError } from './errors';

export const ROLE_COOKIE = 'dewecs_role';
export const DEFAULT_ROLE: Role = 'CITIZEN';

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Turns a raw cookie value into an Actor. Missing or invalid values fall back to Citizen. */
export function actorFromRoleValue(value: string | undefined | null): Actor {
  return DEMO_ACTORS[isRole(value) ? value : DEFAULT_ROLE];
}

/** Reads the role cookie from a raw `Cookie` header (used by API routes). */
export function getActor(request: Request): Actor {
  const header = request.headers.get('cookie') ?? '';
  const match = header.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${ROLE_COOKIE}=`));
  return actorFromRoleValue(match?.slice(ROLE_COOKIE.length + 1));
}

/** Throws AccessDeniedError unless the actor has one of the allowed roles. */
export function requireRole(actor: Actor, allowed: Role[]): void {
  if (!allowed.includes(actor.role)) throw new AccessDeniedError();
}