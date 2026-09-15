import { describe, it, expect } from 'vitest';
import { getTone } from '../Employees';

describe('getTone', () => {
  it('returns "cyan" for falsy or empty inputs', () => {
    expect(getTone()).toBe('cyan');
    expect(getTone('')).toBe('cyan');
    expect(getTone(null)).toBe('cyan');
    expect(getTone(undefined)).toBe('cyan');
  });

  it('returns a consistent tone for the same string', () => {
    const string1 = 'EMP001';
    const string2 = 'EMP002';

    // The tone for a specific string should be consistent across calls
    expect(getTone(string1)).toBe(getTone(string1));
    expect(getTone(string2)).toBe(getTone(string2));
  });

  it('returns a valid tone from the predefined list', () => {
    const validTones = ['cyan', 'coral', 'amber', 'violet', 'lime'];
    const testStrings = ['A', 'B', 'C', 'EMP001', 'John Doe', 'Very Long String That Might Cause Different Hashes 1234567890'];

    testStrings.forEach(str => {
      const tone = getTone(str);
      expect(validTones).toContain(tone);
    });
  });

  it('handles strings with special characters', () => {
    const validTones = ['cyan', 'coral', 'amber', 'violet', 'lime'];
    const specialStr = '!@#$%^&*()_+';
    const tone = getTone(specialStr);

    expect(validTones).toContain(tone);
  });
});
