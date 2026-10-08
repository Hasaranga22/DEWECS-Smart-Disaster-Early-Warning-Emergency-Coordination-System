import { describe, it, expect } from 'vitest';
import { CITIZENS, DISTRICTS, OFFICERS, RIVER_BASINS } from '../index';

describe('shared seed integrity', () => {
  const districtIds = new Set(DISTRICTS.map((d) => d.id));

  it('has 6 districts and 30 citizens', () => {
    expect(DISTRICTS).toHaveLength(6);
    expect(CITIZENS).toHaveLength(30);
  });

  it('every citizen belongs to a real district', () => {
    expect(CITIZENS.every((c) => districtIds.has(c.districtId))).toBe(true);
  });

  it('every basin district exists', () => {
    for (const b of RIVER_BASINS) {
      expect(b.districtIds.every((id) => districtIds.has(id))).toBe(true);
    }
  });

  it('no citizen is unreachable by both channels', () => {
    expect(CITIZENS.every((c) => c.phone || c.pushToken)).toBe(true);
  });

  it('has all officer roles and ids are unique', () => {
    const roles = new Set(OFFICERS.map((o) => o.role));
    expect(roles).toEqual(new Set(['DUTY_OFFICER', 'DMC_OFFICIAL', 'DISTRICT_OFFICER']));
    expect(new Set(CITIZENS.map((c) => c.id)).size).toBe(CITIZENS.length);
  });
});