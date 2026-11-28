import { describe, expect, it } from 'vitest';
import { composeIso, defaultTimes, splitIso } from './transport-dates';

describe('dates par défaut des sous-délégations', () => {
  it('aller : 31/10/2027, retour : 03/11/2027, heures vides', () => {
    expect(defaultTimes('ALLER')).toEqual({ depDate: '2027-10-31', depTime: '', arrDate: '2027-10-31', arrTime: '' });
    expect(defaultTimes('RETOUR')).toEqual({ depDate: '2027-11-03', depTime: '', arrDate: '2027-11-03', arrTime: '' });
  });
  it('sans heure, aucun horaire n est composé', () => {
    expect(composeIso('2027-10-31', '')).toBeNull();
    expect(composeIso('', '08:30')).toBeNull();
  });
  it('avec heure, compose un ISO qui se relit à l identique', () => {
    const iso = composeIso('2027-10-31', '08:30');
    expect(iso).not.toBeNull();
    expect(splitIso(iso, 'x')).toEqual({ date: '2027-10-31', time: '08:30' });
  });
  it('splitIso sans valeur reprend la date par défaut', () => {
    expect(splitIso(null, '2027-11-03')).toEqual({ date: '2027-11-03', time: '' });
  });
});
