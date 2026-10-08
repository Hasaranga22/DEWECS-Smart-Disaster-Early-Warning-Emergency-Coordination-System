/**
 * TEMPORARY - delete when src/shared/access merges
 * Provides getActor and requireRole functions reading the `dewecs-role` cookie or header.
 * Defaults to the seeded Colombo District Officer actor.
 */

import { NextRequest } from "next/server";
import { Actor, Role } from "@/shared/contracts/types";
import { ForbiddenError } from "@/shared/infra/errors";

export const DEFAULT_COLOMBO_DISTRICT_OFFICER_ID = "00000000-0000-4000-8000-000000000999";
export const DEFAULT_COLOMBO_DISTRICT_ID = "00000000-0000-4000-8000-000000000010";

export async function getActor(request: NextRequest): Promise<Actor> {
  const roleCookie = request.cookies.get("dewecs-role")?.value;
  const roleHeader = request.headers.get("x-dewecs-role");
  const districtHeader = request.headers.get("x-dewecs-district-id");

  const role: Role = (roleCookie || roleHeader || "DISTRICT_OFFICER") as Role;
  const districtId = districtHeader || DEFAULT_COLOMBO_DISTRICT_ID;

  return {
    id: DEFAULT_COLOMBO_DISTRICT_OFFICER_ID,
    role,
    districtId,
  };
}

export function requireRole(actor: Actor, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(actor.role)) {
    throw new ForbiddenError(`Role '${actor.role}' is not allowed to perform this operation.`);
  }
}
