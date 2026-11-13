import { describe, it, expect } from 'vitest';
import { parisInstant, parisLocal } from './paris-datetime';
describe('Paris passage timestamps', () => {
  it('converts winter and summer independently of the device timezone', () => {
    expect(parisInstant('2027-07-31T12:00')).toBe('2027-07-31T10:00:00.000Z');
    expect(parisInstant('2027-01-31T12:00')).toBe('2027-01-31T11:00:00.000Z');
    expect(parisLocal('2027-07-31T10:00:00Z')).toBe('2027-07-31T12:00');
  });
  it('rejects nonexistent and ambiguous clock changes rather than guessing', () => {
    expect(() => parisInstant('2027-03-28T02:30')).toThrow('inexistante');
    expect(() => parisInstant('2027-10-31T02:30')).toThrow('ambiguë');
  });
  it('rejects incomplete or normalized invalid calendar dates', () => {
    for (const s of ['', '2027-02-30T12:00', '2027-01-01', '2027-01-01T25:00'])
      expect(() => parisInstant(s)).toThrow();
  });
});
