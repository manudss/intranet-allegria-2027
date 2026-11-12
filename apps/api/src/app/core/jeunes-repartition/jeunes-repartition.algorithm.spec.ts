import { describe, expect, it } from 'vitest';
import {
  AlgoParticipant,
  AlgoParams,
  AlgoTeam,
  proposeJeunesAssignment,
} from './jeunes-repartition.algorithm';

const baseParams: AlgoParams = {
  jeunesPerTeam: 6,
  adultsPerTeam: 1,
  ageMode: 'mixed',
  sexMode: 'balanced',
  geoMaxPerTeam: 1,
  separateAnimators: true,
};

const jeune = (
  id: number,
  origin: string,
  overrides: Partial<AlgoParticipant> = {},
): AlgoParticipant => ({
  id,
  kind: 'JEUNE',
  age: 15,
  tranche: 'TA',
  sex: 'FEMALE',
  originKey: `group:${origin}`,
  originLabel: origin,
  ...overrides,
});

const animateur = (id: number, origin: string): AlgoParticipant => ({
  id,
  kind: 'ANIMATEUR',
  age: 25,
  tranche: '17+',
  sex: 'MALE',
  originKey: `group:${origin}`,
  originLabel: origin,
});

const team = (id: number, maxSize = 8, members: AlgoParticipant[] = []): AlgoTeam => ({
  id,
  name: `Équipe ${id}`,
  maxSize,
  members,
});

describe('proposeJeunesAssignment', () => {
  it('répartit les jeunes en équilibrant les tailles autour de la cible', () => {
    const pool = Array.from({ length: 12 }, (_, i) => jeune(i + 1, `G${i + 1}`));
    const result = proposeJeunesAssignment(pool, [team(1), team(2)], baseParams);

    expect(result.unplaced).toEqual([]);
    expect(result.proposals.size).toBe(12);
    const stats = new Map(result.stats.map((s) => [s.teamId, s.jeunes]));
    expect(stats.get(1)).toBe(6);
    expect(stats.get(2)).toBe(6);
  });

  it('place un animateur par équipe en priorité', () => {
    const pool = [animateur(101, 'G1'), animateur(102, 'G2'), ...Array.from({ length: 6 }, (_, i) => jeune(i + 1, `J${i}`))];
    const result = proposeJeunesAssignment(pool, [team(1), team(2)], baseParams);

    const stats = new Map(result.stats.map((s) => [s.teamId, s.adultes]));
    expect(stats.get(1)).toBe(1);
    expect(stats.get(2)).toBe(1);
  });

  it('évite de concentrer deux jeunes du même groupe dans une équipe', () => {
    const pool = [jeune(1, 'Roanne'), jeune(2, 'Roanne'), jeune(3, 'Lyon'), jeune(4, 'Lyon')];
    const result = proposeJeunesAssignment(pool, [team(1), team(2)], { ...baseParams, jeunesPerTeam: 2 });

    const teamOf = (id: number) => result.proposals.get(id);
    expect(teamOf(1)).not.toBe(teamOf(2));
    expect(result.violations.filter((v) => v.kind === 'geo')).toHaveLength(0);
  });

  it('signale une violation quand la séparation géographique est impossible', () => {
    const pool = [jeune(1, 'Roanne'), jeune(2, 'Roanne'), jeune(3, 'Roanne')];
    const result = proposeJeunesAssignment(pool, [team(1)], { ...baseParams, jeunesPerTeam: 3 });

    expect(result.unplaced).toEqual([]);
    expect(result.violations.some((v) => v.kind === 'geo' && v.message.includes('Roanne'))).toBe(true);
  });

  it('écarte un animateur des jeunes de son groupe d origine', () => {
    const pool = [animateur(101, 'Roanne'), jeune(1, 'Roanne'), jeune(2, 'Lyon')];
    const result = proposeJeunesAssignment(pool, [team(1), team(2)], { ...baseParams, jeunesPerTeam: 1 });

    const animatorTeam = result.proposals.get(101);
    expect(result.proposals.get(1)).not.toBe(animatorTeam);
  });

  it('signale une violation animateur-origine quand il n y a pas d alternative', () => {
    const pool = [animateur(101, 'Roanne'), jeune(1, 'Roanne')];
    const result = proposeJeunesAssignment(pool, [team(1)], baseParams);

    expect(result.violations.some((v) => v.kind === 'animator-origin')).toBe(true);
  });

  it('respecte la capacité maxSize et laisse le surplus non placé', () => {
    const pool = Array.from({ length: 5 }, (_, i) => jeune(i + 1, `G${i}`));
    const result = proposeJeunesAssignment(pool, [team(1, 3)], { ...baseParams, jeunesPerTeam: 5 });

    expect(result.proposals.size).toBe(3);
    expect(result.unplaced).toHaveLength(2);
    expect(result.violations.filter((v) => v.kind === 'capacity')).toHaveLength(2);
  });

  it('compte les membres déjà en place dans la capacité et la cible', () => {
    const existing = [jeune(50, 'A'), jeune(51, 'B'), jeune(52, 'C')];
    const pool = Array.from({ length: 6 }, (_, i) => jeune(i + 1, `G${i}`));
    const result = proposeJeunesAssignment(pool, [team(1, 8, existing), team(2)], baseParams);

    const stats = new Map(result.stats.map((s) => [s.teamId, s]));
    const proposedTo1 = [...result.proposals.values()].filter((id) => id === 1).length;
    const proposedTo2 = [...result.proposals.values()].filter((id) => id === 2).length;
    expect(proposedTo1 + proposedTo2).toBe(6);
    // Les 3 membres en place comptent dans la taille et la capacité de l'équipe 1.
    expect(stats.get(1)!.jeunes).toBe(3 + proposedTo1);
    expect(stats.get(2)!.jeunes).toBe(proposedTo2);
    expect(proposedTo1).toBeLessThanOrEqual(8 - 3);
    expect(result.proposals.get(50)).toBeUndefined();
  });

  it('équilibre la mixité filles/garçons en mode balanced', () => {
    const pool = [
      ...Array.from({ length: 4 }, (_, i) => jeune(i + 1, `G${i}`, { sex: 'FEMALE' })),
      ...Array.from({ length: 4 }, (_, i) => jeune(i + 5, `H${i}`, { sex: 'MALE' })),
    ];
    const result = proposeJeunesAssignment(pool, [team(1), team(2)], { ...baseParams, jeunesPerTeam: 4 });

    for (const stat of result.stats) {
      expect(stat.sexes['FEMALE']).toBe(2);
      expect(stat.sexes['MALE']).toBe(2);
    }
  });

  it('regroupe les tranches d âge en mode tranches', () => {
    const pool = [
      ...Array.from({ length: 3 }, (_, i) => jeune(i + 1, `G${i}`, { tranche: 'TA', age: 14 })),
      ...Array.from({ length: 3 }, (_, i) => jeune(i + 4, `H${i}`, { tranche: 'ES', age: 17 })),
    ];
    const result = proposeJeunesAssignment(pool, [team(1), team(2)], {
      ...baseParams,
      ageMode: 'tranches',
      jeunesPerTeam: 3,
    });

    for (const stat of result.stats) {
      const trancheValues = Object.values(stat.tranches);
      expect(Math.max(...trancheValues)).toBe(3);
    }
  });

  it('est déterministe : même entrée, même sortie', () => {
    const pool = [animateur(101, 'G1'), ...Array.from({ length: 10 }, (_, i) => jeune(i + 1, `G${i}`))];
    const a = proposeJeunesAssignment(pool, [team(1), team(2)], baseParams);
    const b = proposeJeunesAssignment(pool, [team(2), team(1)], baseParams);

    expect([...a.proposals.entries()].sort()).toEqual([...b.proposals.entries()].sort());
  });
});
