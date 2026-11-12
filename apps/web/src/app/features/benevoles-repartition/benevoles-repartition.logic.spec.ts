import { describe, expect, it } from 'vitest';
import { autoProposal } from './benevoles-repartition.logic';

const team = (id: number, name: string, used: number, maxSize: number) => ({ id, name, used, maxSize });
const vol = (id: number, lastName: string, firstName = 'A') => ({ id, lastName, firstName });

describe('autoProposal', () => {
  it('équilibre les effectifs : équipe la moins remplie d’abord', () => {
    const result = autoProposal(
      [vol(1, 'Durand'), vol(2, 'Martin'), vol(3, 'Bernard')],
      [team(1, 'Aigles', 5, 10), team(2, 'Lynx', 8, 10)],
    );
    // Lynx (80 %) est toujours plus remplie qu'Aigles (50 %, 60 %, 70 %) : tout va chez Aigles.
    expect(result.unplaced).toEqual([]);
    const counts = [1, 2].map((id) => [...result.proposals.values()].filter((t) => t === id).length);
    expect(counts[0]).toBeGreaterThanOrEqual(counts[1]);
    expect(counts[0] + counts[1]).toBe(3);
    // Lynx, plus remplie, ne reçoit personne tant qu’Aigles est moins remplie.
    expect(result.proposals.get(3)).toBe(1); // Bernard, premier par ordre alphabétique
    expect(counts).toEqual([3, 0]);
  });

  it('ne dépasse jamais la taille maximale et signale les sans-solution', () => {
    const result = autoProposal(
      [vol(1, 'A'), vol(2, 'B'), vol(3, 'C')],
      [team(1, 'Aigles', 9, 10), team(2, 'Lynx', 10, 10)],
    );
    expect(result.proposals.size).toBe(1);
    expect(result.proposals.get(1)).toBe(1);
    expect(result.unplaced).toEqual([2, 3]);
  });

  it('départage à ratio égal par le nom d’équipe puis l’id, de façon déterministe', () => {
    const a = autoProposal([vol(1, 'X')], [team(2, 'Lynx', 5, 10), team(1, 'Lynx', 5, 10)]);
    const b = autoProposal([vol(1, 'X')], [team(1, 'Lynx', 5, 10), team(2, 'Lynx', 5, 10)]);
    expect(a.proposals.get(1)).toBe(1);
    expect(b.proposals.get(1)).toBe(1);
  });

  it('traite les bénévoles par nom puis prénom, quelle que soit la liste d’entrée', () => {
    const v = [vol(1, 'Zola'), vol(2, 'Adam'), vol(3, 'Adam', 'B')];
    const r1 = autoProposal(v, [team(1, 'A', 0, 10), team(2, 'B', 0, 10)]);
    const r2 = autoProposal([...v].reverse(), [team(2, 'B', 0, 10), team(1, 'A', 0, 10)]);
    expect([...r1.proposals.entries()]).toEqual([...r2.proposals.entries()]);
  });

  it('retourne des listes vides sans bénévole ni équipe', () => {
    expect(autoProposal([], [team(1, 'A', 0, 5)]).proposals.size).toBe(0);
    expect(autoProposal([vol(1, 'A')], []).unplaced).toEqual([1]);
  });

  it('une équipe déjà pleine ne reçoit aucune proposition', () => {
    const result = autoProposal([vol(1, 'A')], [team(1, 'Pleine', 12, 10), team(2, 'Libre', 0, 1)]);
    expect(result.proposals.get(1)).toBe(2);
  });
});
