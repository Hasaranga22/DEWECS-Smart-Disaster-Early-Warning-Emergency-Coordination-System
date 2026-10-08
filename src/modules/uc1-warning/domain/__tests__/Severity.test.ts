import { describe, expect, it } from 'vitest';
import {
  compareSeverity,
  getSeverityRank,
  isHigherSeverity,
  isValidSeverity,
  nextSeverity,
  SEVERITIES,
} from '../Severity';

describe('Severity domain', () => {
  it('defines correct strict severity order: ADVISORY < WATCH < WARNING < EMERGENCY', () => {
    expect(getSeverityRank('ADVISORY')).toBeLessThan(getSeverityRank('WATCH'));
    expect(getSeverityRank('WATCH')).toBeLessThan(getSeverityRank('WARNING'));
    expect(getSeverityRank('WARNING')).toBeLessThan(getSeverityRank('EMERGENCY'));
  });

  it('correctly compares severities with compareSeverity', () => {
    expect(compareSeverity('WARNING', 'ADVISORY')).toBeGreaterThan(0);
    expect(compareSeverity('ADVISORY', 'EMERGENCY')).toBeLessThan(0);
    expect(compareSeverity('WATCH', 'WATCH')).toBe(0);
  });

  it('correctly checks isHigherSeverity', () => {
    expect(isHigherSeverity('EMERGENCY', 'WARNING')).toBe(true);
    expect(isHigherSeverity('WATCH', 'ADVISORY')).toBe(true);
    expect(isHigherSeverity('ADVISORY', 'ADVISORY')).toBe(false);
    expect(isHigherSeverity('WATCH', 'WARNING')).toBe(false);
  });

  it('returns the next higher severity level or null if at EMERGENCY', () => {
    expect(nextSeverity('ADVISORY')).toBe('WATCH');
    expect(nextSeverity('WATCH')).toBe('WARNING');
    expect(nextSeverity('WARNING')).toBe('EMERGENCY');
    expect(nextSeverity('EMERGENCY')).toBeNull();
  });

  it('validates severities with isValidSeverity', () => {
    expect(isValidSeverity('ADVISORY')).toBe(true);
    expect(isValidSeverity('EMERGENCY')).toBe(true);
    expect(isValidSeverity('UNKNOWN')).toBe(false);
    expect(isValidSeverity(null)).toBe(false);
  });
});
