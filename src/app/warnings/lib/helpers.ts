import { CITIZENS, DISTRICTS, RIVER_BASINS } from '@/shared/seed';

const DISTRICT_NAME_BY_ID = new Map(DISTRICTS.map((d) => [d.id, d.name]));
const CITIZEN_NAME_BY_ID = new Map(CITIZENS.map((c) => [c.id, c.name]));

export function getDistrictName(districtId: string): string {
  return DISTRICT_NAME_BY_ID.get(districtId) ?? districtId;
}

export function getCitizenName(citizenId: string): string | null {
  return CITIZEN_NAME_BY_ID.get(citizenId) ?? null;
}

export function getShortId(id: string): string {
  if (!id) return '';
  return id.length > 6 ? id.slice(-6) : id;
}

export function getTargetDisplayName(target: { districtIds?: string[]; basinId?: string }): string {
  if (target.districtIds && target.districtIds.length > 0) {
    return target.districtIds.map(getDistrictName).join(', ');
  }
  if (target.basinId) {
    const basin = RIVER_BASINS.find((b) => b.id === target.basinId);
    return basin ? basin.name : target.basinId;
  }
  return 'Sri Lanka (Island-wide)';
}

export function toggleDistrictInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function toggleBasinInState(
  selectedBasinIds: string[],
  selectedDistricts: string[],
  basinId: string,
): { nextBasinIds: string[]; nextDistricts: string[] } {
  const isSelected = selectedBasinIds.includes(basinId);
  const basin = RIVER_BASINS.find((b) => b.id === basinId);
  if (!basin) return { nextBasinIds: selectedBasinIds, nextDistricts: selectedDistricts };

  if (!isSelected) {
    return {
      nextBasinIds: [...selectedBasinIds, basinId],
      nextDistricts: Array.from(new Set([...selectedDistricts, ...basin.districtIds])),
    };
  } else {
    const nextBasins = selectedBasinIds.filter((id) => id !== basinId);
    const remainingDistricts = new Set(
      RIVER_BASINS.filter((b) => nextBasins.includes(b.id)).flatMap((b) => b.districtIds),
    );
    return {
      nextBasinIds: nextBasins,
      nextDistricts: selectedDistricts.filter(
        (dId) => !basin.districtIds.includes(dId) || remainingDistricts.has(dId),
      ),
    };
  }
}
