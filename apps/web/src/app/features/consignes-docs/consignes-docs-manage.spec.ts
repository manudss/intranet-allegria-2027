import { describe, expect, it } from 'vitest';
import { teamTypeOf } from './consignes-docs-manage';

describe('teamTypeOf', () => {
  it('prend le type avant le séparateur du nom', () => {
    expect(teamTypeOf({ name: "Sécurité · Contrôle d'accès" })).toBe('Sécurité');
    expect(teamTypeOf({ name: 'Cuisine · Service restauration' })).toBe('Cuisine');
  });

  it('classe les équipes sans séparateur dans « Autre »', () => {
    expect(teamTypeOf({ name: 'Équipe volante' })).toBe('Autre');
    expect(teamTypeOf({ name: ' · Zone seule' })).toBe('Autre');
  });
});
