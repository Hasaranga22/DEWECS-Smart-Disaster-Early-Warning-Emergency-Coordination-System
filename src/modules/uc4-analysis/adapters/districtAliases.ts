// Known equivalent ids per district: UC1's seed scheme (seedId(1, n)), the
// legacy UI/prisma seed scheme (00000000-0000-4000-8000-...), and the pre-seed
// UUID row all name the SAME real district. Report filters arrive as any one of
// them, so readers expand before querying.
interface AliasGroup {
  name: string
  ids: string[]
}

const GROUPS: AliasGroup[] = [
  {
    name: 'Colombo',
    ids: [
      '00000000-0001-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000010',
      '550e8400-e29b-41d4-a716-446655440000',
    ],
  },
  {
    name: 'Gampaha',
    ids: [
      '00000000-0002-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000020',
      '00000000-0000-4000-8000-000000000002',
    ],
  },
  {
    name: 'Kegalle',
    ids: ['00000000-0003-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'],
  },
  { name: 'Kandy', ids: ['00000000-0004-4000-8000-000000000001'] },
  { name: 'Galle', ids: ['00000000-0005-4000-8000-000000000001'] },
  { name: 'Ratnapura', ids: ['00000000-0006-4000-8000-000000000001'] },
  { name: 'Kalutara', ids: ['00000000-0007-4000-8000-000000000001'] },
]

function groupOf(id: string): AliasGroup | undefined {
  return GROUPS.find((g) => g.ids.includes(id))
}

/** Expand one district id to its whole alias group (input id first). Unknown ids pass through. */
export function expandDistrictIds(id: string): string[] {
  const group = groupOf(id)
  return group ? [id, ...group.ids.filter((alias) => alias !== id)] : [id]
}

/** Expand a list of district ids, flattening and deduplicating in order. */
export function expandUuidDistrictIds(ids: string[]): string[] {
  const out: string[] = []
  for (const id of ids) {
    for (const alias of expandDistrictIds(id)) {
      if (!out.includes(alias)) out.push(alias)
    }
  }
  return out
}

/** Canonical display name for a district id, or undefined when unknown. */
export function canonicalDistrictName(id: string): string | undefined {
  return groupOf(id)?.name
}

/** True when free text (e.g. an alert message) names the district of this id. */
export function matchesDistrictAlias(districtId: string, text: string): boolean {
  const name = canonicalDistrictName(districtId)
  return name !== undefined && text.toLowerCase().includes(name.toLowerCase())
}
