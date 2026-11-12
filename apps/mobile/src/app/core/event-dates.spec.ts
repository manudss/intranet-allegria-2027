import { describe, expect, it } from 'vitest';
import { dayLabel, defaultDay, eventDays } from './event-dates';

describe('event-dates', () => {
  it('liste les 4 jours de l\'événement', () => {
    expect(eventDays()).toEqual([
      '2027-10-31',
      '2027-11-01',
      '2027-11-02',
      '2027-11-03',
    ]);
  });

  it('retourne aujourd\'hui pendant l\'événement, J1 sinon', () => {
    expect(defaultDay('2027-11-02')).toBe('2027-11-02');
    expect(defaultDay('2026-06-15')).toBe('2027-10-31');
    expect(defaultDay('2027-12-24')).toBe('2027-10-31');
  });

  it('formate le libellé du jour', () => {
    expect(dayLabel('2027-10-31')).toContain('J1');
    expect(dayLabel('2027-11-03')).toContain('J4');
  });
});
