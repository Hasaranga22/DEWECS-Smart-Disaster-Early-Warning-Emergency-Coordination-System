import { describe, expect, it } from 'vitest'

import {
  canonicalDistrictName,
  expandDistrictIds,
  expandUuidDistrictIds,
  matchesDistrictAlias,
} from '../adapters/districtAliases'

describe('districtAliases', () => {
  it('expands a known id to every equivalent id, input first', () => {
    expect(expandDistrictIds('00000000-0001-4000-8000-000000000001')).toEqual([
      '00000000-0001-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000010',
      '550e8400-e29b-41d4-a716-446655440000',
    ])
  })

  it('returns an unknown id unchanged', () => {
    expect(expandDistrictIds('11111111-1111-4111-8111-111111111111')).toEqual([
      '11111111-1111-4111-8111-111111111111',
    ])
  })

  it('links the legacy UI id to the same Colombo group', () => {
    const ids = expandDistrictIds('00000000-0000-4000-8000-000000000010')
    expect(ids).toContain('00000000-0001-4000-8000-000000000001')
    expect(ids).toContain('550e8400-e29b-41d4-a716-446655440000')
  })

  it('covers both id schemes for Gampaha and Kegalle', () => {
    expect(expandDistrictIds('00000000-0002-4000-8000-000000000001')).toEqual([
      '00000000-0002-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000020',
      '00000000-0000-4000-8000-000000000002',
    ])
    expect(expandDistrictIds('00000000-0000-4000-8000-000000000001')).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0003-4000-8000-000000000001',
    ])
  })

  it('expands lists flat with dedup', () => {
    const out = expandUuidDistrictIds([
      '00000000-0001-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000010',
      'unknown-id',
    ])
    expect(out).toEqual([
      '00000000-0001-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000010',
      '550e8400-e29b-41d4-a716-446655440000',
      'unknown-id',
    ])
  })

  it('resolves canonical names for both id schemes', () => {
    expect(canonicalDistrictName('00000000-0003-4000-8000-000000000001')).toBe('Kegalle')
    expect(canonicalDistrictName('00000000-0000-4000-8000-000000000001')).toBe('Kegalle')
    expect(canonicalDistrictName('00000000-0000-4000-8000-000000000020')).toBe('Gampaha')
    expect(canonicalDistrictName('00000000-0005-4000-8000-000000000001')).toBe('Galle')
    expect(canonicalDistrictName('unknown')).toBeUndefined()
  })

  it('matches the district name inside message text (case-insensitive)', () => {
    expect(
      matchesDistrictAlias('00000000-0000-4000-8000-000000000001', 'Flooding reported in Kegalle town'),
    ).toBe(true)
    expect(
      matchesDistrictAlias('00000000-0000-4000-8000-000000000001', 'flooding in KEGALLE villages'),
    ).toBe(true)
    expect(matchesDistrictAlias('00000000-0000-4000-8000-000000000001', 'Gampaha river rising')).toBe(
      false,
    )
    expect(matchesDistrictAlias('unknown-id', 'anything')).toBe(false)
  })
})
