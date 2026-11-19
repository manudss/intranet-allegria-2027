import { describe, expect, it } from 'vitest';
import { linkedTiming, parisInstant, ShiftBindingDraft } from './mission-timing.util';
const base: ShiftBindingDraft = {
  shiftId: 1,
  previousSequenceId: null,
  startAnchor: 'START',
  endAnchor: 'END',
  startOffset: 0,
  endOffset: 0,
};
describe('Horaires liés, Europe/Paris', () => {
  it('convertit l’heure Paris hiver sans décalage implicite', () =>
    expect(new Date(parisInstant('2027-11-02', '13:30')).toISOString()).toBe(
      '2027-11-02T12:30:00.000Z',
    ));
  it('convertit l’heure été', () =>
    expect(new Date(parisInstant('2027-07-02', '13:30')).toISOString()).toBe(
      '2027-07-02T11:30:00.000Z',
    ));
  it('refuse l’heure manquante du passage été', () =>
    expect(() => parisInstant('2027-03-28', '02:30')).toThrow());
  it('refuse l’heure ambiguë du passage hiver', () =>
    expect(() => parisInstant('2027-10-31', '02:30')).toThrow());
  it('refuse une date invalide', () => expect(() => parisInstant('2027-02-30', '13:30')).toThrow());
  it('avant : deux repères début, offsets explicites', () =>
    expect(
      linkedTiming('2027-11-02', '13:30', '15:30', {
        ...base,
        endAnchor: 'START',
        startOffset: -20,
      }),
    ).toEqual({ startAt: '2027-11-02T12:10:00.000Z', endAt: '2027-11-02T12:30:00.000Z' }));
  it('pendant : suit les deux bornes', () =>
    expect(linkedTiming('2027-11-02', '13:30', '15:45', base).endAt).toBe(
      '2027-11-02T14:45:00.000Z',
    ));
  it('après : deux repères fin', () =>
    expect(
      linkedTiming('2027-11-02', '13:30', '15:30', { ...base, startAnchor: 'END', endOffset: 45 }),
    ).toEqual({ startAt: '2027-11-02T14:30:00.000Z', endAt: '2027-11-02T15:15:00.000Z' }));
  it('franchit minuit sans changer arbitrairement la durée', () =>
    expect(linkedTiming('2027-11-02', '23:30', '00:30', base)).toEqual({
      startAt: '2027-11-02T22:30:00.000Z',
      endAt: '2027-11-02T23:30:00.000Z',
    }));
  it('offset traverse le jour', () =>
    expect(
      linkedTiming('2027-11-02', '00:15', '01:15', { ...base, startOffset: -45 }).startAt,
    ).toBe('2027-11-01T22:30:00.000Z'));
  for (const bad of [null, undefined, 1.5, NaN, Infinity, 525601])
    it(`refuse offset non entier ou hors borne ${bad}`, () =>
      expect(() =>
        linkedTiming('2027-11-02', '13:30', '15:30', { ...base, startOffset: bad as number }),
      ).toThrow());
  it('ne donne pas 30 minutes par défaut', () =>
    expect(linkedTiming('2027-11-02', '13:30', '15:30', base).startAt).toBe(
      '2027-11-02T12:30:00.000Z',
    ));
  it('refuse les bornes inversées', () =>
    expect(() =>
      linkedTiming('2027-11-02', '13:30', '15:30', {
        ...base,
        startAnchor: 'END',
        endAnchor: 'START',
      }),
    ).toThrow());
  it('refuse la durée nulle', () =>
    expect(() =>
      linkedTiming('2027-11-02', '13:30', '15:30', { ...base, endAnchor: 'START' }),
    ).toThrow());
  it('refuse le repère inconnu', () =>
    expect(() =>
      linkedTiming('2027-11-02', '13:30', '15:30', { ...base, startAnchor: 'OTHER' as 'START' }),
    ).toThrow());
});
