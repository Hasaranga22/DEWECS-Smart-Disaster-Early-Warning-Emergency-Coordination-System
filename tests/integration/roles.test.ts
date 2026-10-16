import { describe, expect, it } from 'vitest'

import type { Actor } from '@/shared/contracts/types'

import { requireRole } from '@/shared/access'
import { ForbiddenError } from '@/modules/uc4-analysis/domain/errors'

// ─── Actors ────────────────────────────────────────────────────────────────────

const dmcOfficial: Actor = { id: 'officer-001', role: 'DMC_OFFICIAL' }
const districtOfficer: Actor = { id: 'district-001', role: 'DISTRICT_OFFICER' }
const citizen: Actor = { id: 'citizen-001', role: 'CITIZEN' }

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('UC4 role guards', () => {
  const requiredRoles = ['DMC_OFFICIAL'] as const

  it('ROLE-01: District Officer actor → requireRole([DMC_OFFICIAL]) throws ForbiddenError', () => {
    const error = expect(() => requireRole(districtOfficer, requiredRoles)).toThrow(ForbiddenError)

    // Also verify the error details
    try {
      requireRole(districtOfficer, requiredRoles)
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError)
      expect((e as ForbiddenError).role).toBe('DISTRICT_OFFICER')
      expect((e as ForbiddenError).action).toContain('DMC_OFFICIAL')
    }
  })

  it('ROLE-02: Citizen actor → requireRole([DMC_OFFICIAL]) throws ForbiddenError', () => {
    const error = expect(() => requireRole(citizen, requiredRoles)).toThrow(ForbiddenError)

    try {
      requireRole(citizen, requiredRoles)
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError)
      expect((e as ForbiddenError).role).toBe('CITIZEN')
      expect((e as ForbiddenError).action).toContain('DMC_OFFICIAL')
    }
  })

  it('ROLE-03: DMC Official actor → requireRole([DMC_OFFICIAL]) does not throw', () => {
    // Should not throw
    expect(() => requireRole(dmcOfficial, requiredRoles)).not.toThrow()

    // Also verify it returns normally
    const result = requireRole(dmcOfficial, requiredRoles)
    expect(result).toBeUndefined()
  })
})
