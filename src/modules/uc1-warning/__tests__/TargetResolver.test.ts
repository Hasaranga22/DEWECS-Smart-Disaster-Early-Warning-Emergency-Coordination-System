import { describe, expect, it } from 'vitest';
import type { Citizen, RiverBasin } from '@/shared/domain';
import { TargetResolver } from '../services/TargetResolver';

describe('TargetResolver service', () => {
  const mockCitizens: Citizen[] = [
    {
      id: 'cit-1',
      name: 'Kamal Perera',
      districtId: 'dist-colombo',
      phone: '+94771234567',
      pushToken: 'push-tok-1',
      isVolunteer: false,
    },
    {
      id: 'cit-2',
      name: 'Nimal Silva',
      districtId: 'dist-colombo',
      phone: '+94772345678', // only phone
      isVolunteer: false,
    },
    {
      id: 'cit-3',
      name: 'Sunil Fernando',
      districtId: 'dist-gampaha',
      pushToken: 'push-tok-3', // only push
      isVolunteer: false,
    },
    {
      id: 'cit-4',
      name: 'Anura Kumara',
      districtId: 'dist-kegalle',
      isVolunteer: false, // neither
    },
    {
      id: 'cit-5',
      name: 'Ruwan Dissanayake',
      districtId: 'dist-kandy',
      phone: '+94775555555',
      pushToken: 'push-tok-5',
      isVolunteer: true,
    },
  ];

  const mockBasin: RiverBasin = {
    id: 'basin-kelani',
    name: 'Kelani River Basin',
    districtIds: ['dist-colombo', 'dist-gampaha', 'dist-kegalle'],
  };

  const citizenProvider = {
    listAll: async () => mockCitizens,
  };

  const basinProvider = {
    getById: async (id: string) => (id === 'basin-kelani' ? mockBasin : null),
  };

  const resolver = new TargetResolver(citizenProvider, basinProvider);

  it('resolves unique citizens for a single target district with appropriate channels', async () => {
    const recipients = await resolver.resolve({ districtIds: ['dist-colombo'] });
    expect(recipients).toHaveLength(2);
    expect(recipients.map((r) => r.citizen.id)).toEqual(['cit-1', 'cit-2']);

    const r1 = recipients.find((r) => r.citizen.id === 'cit-1')!;
    expect(r1.channels).toEqual(['PUSH', 'SMS']);

    const r2 = recipients.find((r) => r.citizen.id === 'cit-2')!;
    expect(r2.channels).toEqual(['SMS']);
  });

  it('resolves river basin target into Colombo + Gampaha + Kegalle unique citizens', async () => {
    const recipients = await resolver.resolve({ basinId: 'basin-kelani' });
    expect(recipients).toHaveLength(4);
    const ids = recipients.map((r) => r.citizen.id);
    expect(ids).toContain('cit-1');
    expect(ids).toContain('cit-2');
    expect(ids).toContain('cit-3');
    expect(ids).toContain('cit-4');
    expect(ids).not.toContain('cit-5'); // Kandy not in Kelani basin
  });

  it('deduplicates when overlapping districts and basin targets are both specified', async () => {
    const recipients = await resolver.resolve({
      districtIds: ['dist-colombo', 'dist-gampaha'],
      basinId: 'basin-kelani',
    });
    // Total citizens in Colombo, Gampaha, Kegalle is 4, no duplicates
    expect(recipients).toHaveLength(4);
    const uniqueIds = new Set(recipients.map((r) => r.citizen.id));
    expect(uniqueIds.size).toBe(4);
  });

  it('correctly handles excludeCitizenIds for target widening', async () => {
    const excluded = new Set(['cit-1', 'cit-2']);
    const newRecipients = await resolver.resolve({ basinId: 'basin-kelani' }, excluded);
    expect(newRecipients).toHaveLength(2);
    expect(newRecipients.map((r) => r.citizen.id)).toEqual(['cit-3', 'cit-4']);
  });

  it('returns empty array when target has no districts or unknown basin', async () => {
    const recipients = await resolver.resolve({ districtIds: [] });
    expect(recipients).toEqual([]);

    const unknownBasinRecipients = await resolver.resolve({ basinId: 'unknown-basin' });
    expect(unknownBasinRecipients).toEqual([]);
  });

  it('resolves multi-basin district union with no duplicate citizens', async () => {
    // Multi-basin union: e.g. Kelani (colombo, gampaha, kegalle) + Attanagalu Oya (gampaha) + Kandy
    // Notice gampaha is in both basins; districtIds contains gampaha twice
    const multiBasinDistricts = ['dist-colombo', 'dist-gampaha', 'dist-kegalle', 'dist-gampaha', 'dist-kandy'];
    const recipients = await resolver.resolve({
      districtIds: multiBasinDistricts,
    });
    // Total citizens in mockCitizens across colombo (2), gampaha (1), kegalle (1), kandy (1) is 5
    expect(recipients).toHaveLength(5);
    const uniqueCitizenIds = new Set(recipients.map((r) => r.citizen.id));
    expect(uniqueCitizenIds.size).toBe(5);
  });
});
