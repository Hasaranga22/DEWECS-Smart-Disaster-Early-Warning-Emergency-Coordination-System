import { NextRequest } from "next/server";
import { Actor, Role } from "@/shared/contracts/types";
import { ForbiddenError } from "@/shared/infra/errors";

export const DEFAULT_COLOMBO_DISTRICT_OFFICER_ID = "00000000-0000-4000-8000-000000000999";
export const DEFAULT_COLOMBO_DISTRICT_ID = "00000000-0000-4000-8000-000000000010";

const roleUuids: Record<Role, string> = {
  DMC_OFFICIAL: "00000000-0000-4000-8000-000000000888",
  DUTY_OFFICER: "00000000-0000-4000-8000-000000000777",
  DISTRICT_OFFICER: "00000000-0000-4000-8000-000000000999",
  CITIZEN: "00000000-0000-4000-8000-000000000555",
};

export async function getActor(request: NextRequest): Promise<Actor> {
  const roleCookie = request.cookies.get("dewecs-role")?.value || request.cookies.get("actor")?.value;
  const roleHeader = request.headers.get("x-dewecs-role");
  const districtHeader = request.headers.get("x-dewecs-district-id");

  const rawRole = roleCookie || roleHeader || "DMC_OFFICIAL";
  const role: Role = (["DMC_OFFICIAL", "DISTRICT_OFFICER", "DUTY_OFFICER", "CITIZEN"].includes(rawRole)
    ? rawRole
    : "DMC_OFFICIAL") as Role;

  const districtId = districtHeader || DEFAULT_COLOMBO_DISTRICT_ID;
  const actorId = roleUuids[role] || DEFAULT_COLOMBO_DISTRICT_OFFICER_ID;

  return {
    id: actorId,
    role,
    districtId,
  };
}

export function requireRole(actor: Actor, allowedRoles: Role[]): void {
  const expandedRoles = [...allowedRoles];
  if (allowedRoles.includes("DISTRICT_OFFICER")) {
    if (!expandedRoles.includes("DMC_OFFICIAL")) expandedRoles.push("DMC_OFFICIAL");
    if (!expandedRoles.includes("DUTY_OFFICER")) expandedRoles.push("DUTY_OFFICER");
  }

  if (!expandedRoles.includes(actor.role)) {
    throw new ForbiddenError(`Role '${actor.role}' is not allowed to perform this operation.`);
  }
}
