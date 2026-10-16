import { DISTRICTS, HAZARD_TYPES, LANGUAGES } from "./_types";

export type QueryValue = string | string[] | undefined;

export type PrefillValues = Partial<{
  from: string;
  to: string;
  districtId: string;
  hazardType: (typeof HAZARD_TYPES)[number];
  language: (typeof LANGUAGES)[number];
}>;

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function buildQueryString(params: Record<string, QueryValue>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (v !== undefined) qs.set(key, v);
  }
  return qs.toString();
}

function isValidDate(value: string | undefined): value is string {
  return Boolean(value) && /^\d{4}-\d{2}-\d{2}$/.test(value!) && !Number.isNaN(Date.parse(value!));
}

function resolveDistrict(districtId?: string, district?: string): string | undefined {
  if (districtId && DISTRICTS.some((d) => d.id === districtId && d.id !== "")) return districtId;
  if (!district) return undefined;
  const byId = DISTRICTS.find((d) => d.id !== "" && d.id === district);
  if (byId) return byId.id;
  const byName = DISTRICTS.find(
    (d) => d.id !== "" && d.name.toLowerCase() === district.toLowerCase(),
  );
  return byName?.id;
}

export function prefillFromQuery(params: Record<string, QueryValue>): PrefillValues {
  const out: PrefillValues = {};

  const from = first(params.from);
  if (isValidDate(from)) out.from = from;

  const to = first(params.to);
  if (isValidDate(to)) out.to = to;

  const districtId = resolveDistrict(first(params.districtId), first(params.district));
  if (districtId) out.districtId = districtId;

  const hazardType = first(params.hazardType)?.toUpperCase();
  if (hazardType && (HAZARD_TYPES as readonly string[]).includes(hazardType)) {
    out.hazardType = hazardType as PrefillValues["hazardType"];
  }

  const language = (first(params.language) ?? first(params.lang))?.toUpperCase();
  if (language && (LANGUAGES as readonly string[]).includes(language)) {
    out.language = language as PrefillValues["language"];
  }

  return out;
}
