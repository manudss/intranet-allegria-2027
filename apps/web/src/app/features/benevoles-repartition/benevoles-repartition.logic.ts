/** Logique pure de la page de répartition bénévoles → équipes. */

export interface AutoTeam {
  id: number;
  name: string;
  /** Places déjà prises (jeunes + adultes, affectations en cours incluses). */
  used: number;
  maxSize: number;
}

export interface AutoVolunteer {
  id: number;
  lastName: string;
  firstName: string;
}

export interface AutoProposalResult {
  /** volunteerId → teamId proposé. */
  proposals: Map<number, number>;
  /** Bénévoles sans solution (toutes les équipes seraient complètes). */
  unplaced: number[];
}

/**
 * Répartition automatique validée avec l'organisation : chaque bénévole sans
 * équipe rejoint l'équipe sélectionnée la moins remplie (ratio effectif/taille
 * max, puis nom d'équipe puis id pour départager), sans jamais dépasser la
 * taille maximale. Ordre de traitement déterministe : nom, prénom, id.
 */
export function autoProposal(volunteers: AutoVolunteer[], teams: AutoTeam[]): AutoProposalResult {
  const remaining = new Map(teams.map((t) => [t.id, Math.max(0, t.maxSize - t.used)]));
  const order = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.id - b.id);
  const proposals = new Map<number, number>();
  const unplaced: number[] = [];
  const sorted = [...volunteers].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, 'fr') ||
      a.firstName.localeCompare(b.firstName, 'fr') ||
      a.id - b.id,
  );
  for (const volunteer of sorted) {
    let best: AutoTeam | null = null;
    let bestRatio = Infinity;
    for (const team of order) {
      const left = remaining.get(team.id) ?? 0;
      if (left <= 0) continue;
      const ratio = team.maxSize <= 0 ? 1 : (team.maxSize - left) / team.maxSize;
      if (!best || ratio < bestRatio) {
        best = team;
        bestRatio = ratio;
      }
    }
    if (!best) {
      unplaced.push(volunteer.id);
      continue;
    }
    proposals.set(volunteer.id, best.id);
    remaining.set(best.id, (remaining.get(best.id) ?? 0) - 1);
  }
  return { proposals, unplaced };
}
