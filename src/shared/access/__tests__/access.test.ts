import { describe, it, expect } from 'vitest';
import { actorFromRoleValue, getActor, requireRole, AccessDeniedError, ROLE_COOKIE } from '../index';

describe('access', () => {
  it('maps a valid cookie value to that role', () => {
    expect(actorFromRoleValue('DMC_OFFICIAL').role).toBe('DMC_OFFICIAL');
  });

  it('falls back to Citizen for missing or invalid values', () => {
    expect(actorFromRoleValue(undefined).role).toBe('CITIZEN');
    expect(actorFromRoleValue('HACKER').role).toBe('CITIZEN');
  });

  it('reads the role from a Cookie header', () => {
    const req = new Request('http://x', { headers: { cookie: `a=1; ${ROLE_COOKIE}=DUTY_OFFICER` } });
    expect(getActor(req).role).toBe('DUTY_OFFICER');
  });

  it('allows a permitted role', () => {
    expect(() => requireRole(actorFromRoleValue('DMC_OFFICIAL'), ['DMC_OFFICIAL'])).not.toThrow();
  });

  it('denies a Duty Officer from issuing warnings', () => {
    expect(() => requireRole(actorFromRoleValue('DUTY_OFFICER'), ['DMC_OFFICIAL'])).toThrow(AccessDeniedError);
  });

  it('gives the District Officer a district', () => {
    expect(actorFromRoleValue('DISTRICT_OFFICER').districtId).toBeDefined();
  });
});