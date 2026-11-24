import { describe, expect, it } from 'vitest';
import { ACRONYM_HINTS, GLOSSARY, tourFor } from './help-content';

describe('aide intégrée', () => {
  it('propose une visite de 3 étapes pour chaque rôle', () => {
    for (const roles of [['ADMIN'], ['COORDINATOR'], ['HEALTH'], ['CATERING'], ['SCANNER'], ['BADGE_MANAGER'], []]) {
      expect(tourFor(roles)).toHaveLength(3);
    }
  });

  it('adapte la dernière étape au rôle principal', () => {
    expect(tourFor(['SCANNER', 'ADMIN'])[2].title).toContain('administration');
    expect(tourFor(['SCANNER'])[2].title).toContain('contrôle d’accès');
    expect(tourFor([])[2].title).toContain('bénévole');
  });

  it('explique chaque sigle affiché dans l’interface', () => {
    const terms = GLOSSARY.map((e) => e.term);
    expect(terms).toEqual(expect.arrayContaining(['TA', 'ES', 'Habilitation']));
    expect(ACRONYM_HINTS.TA).toContain('Témoins Aujourd');
    expect(ACRONYM_HINTS.ES).toContain('Équipes Espérance');
  });
});
