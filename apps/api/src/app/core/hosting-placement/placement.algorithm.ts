/**
 * Algorithme de placement, pur et sans accès base de données (donc testable seul).
 *
 * Il ne PROPOSE que des places pour des personnes pas encore placées. Il ne déplace jamais
 * une affectation existante. Les règles métier non confirmées sont des options explicites.
 */

export type SexMixingRule = 'ignore' | 'avoid' | 'forbid';

export interface PlacementRules {
  /** true : animateurs et jeunes comptent ensemble dans maxCapacity. false : seuls les jeunes comptent. */
  countAnimatorsInCapacity: boolean;
  /**
   * Mixité filles/garçons dans une même famille (la chambre n'est pas modélisée) :
   * ignore = aucune règle, avoid = préférence, forbid = interdit pour les jeunes.
   */
  sexMixing: SexMixingRule;
}

/** Valeurs par défaut NON confirmées par le métier : l'interface les affiche pour validation. */
export const DEFAULT_PLACEMENT_RULES: PlacementRules = {
  countAnimatorsInCapacity: true,
  sexMixing: 'ignore',
};

export interface PlacementPerson {
  id: number;
  teamId: number;
  isAnimator: boolean;
  /**
   * Bénévole adulte rattaché à l'équipe : compte TOUJOURS dans la capacité
   * totale (même si les animateurs n'y comptent pas) et dans le quota adultes
   * (isAnimator vaut true pour lui). Jamais mineur, jamais dans la mixité jeunes.
   */
  isBenevole: boolean;
  isUnder18: boolean;
  sex: string;
}

export interface PlacementFamily {
  id: number;
  maxCapacity: number;
  maxUnder18: number;
  maxAnimators: number | null;
  /** Occupation actuelle (affectations non annulées). */
  occupants: PlacementOccupant[];
  /** Contraintes ou étiquettes libres renseignées : à relire par une personne. */
  needsReview: boolean;
}

export interface PlacementOccupant {
  teamId: number | null;
  isAnimator: boolean;
  isBenevole: boolean;
  isUnder18: boolean;
  sex: string;
}

export interface Proposal {
  participantId: number;
  hostFamilyId: number;
  needsReview: boolean;
}

export type UnplacedReason = 'NO_CAPACITY' | 'UNDER18_LIMIT' | 'ANIMATOR_LIMIT' | 'SEX_MIXING';

export interface UnplacedPerson {
  participantId: number;
  reason: UnplacedReason;
}

export interface PlacementResult {
  proposals: Proposal[];
  unplaced: UnplacedPerson[];
}

const countsInCapacity = (
  rules: PlacementRules,
  person: { isAnimator: boolean; isBenevole: boolean },
): boolean => person.isBenevole || rules.countAnimatorsInCapacity || !person.isAnimator;

export function freeSeats(family: PlacementFamily, rules: PlacementRules): number {
  const used = family.occupants.filter((o) => countsInCapacity(rules, o)).length;
  return Math.max(0, family.maxCapacity - used);
}

/** Retourne la raison du refus, ou null si la personne peut être accueillie. */
export function refusalReason(
  family: PlacementFamily,
  person: Pick<PlacementPerson, 'isAnimator' | 'isBenevole' | 'isUnder18' | 'sex'>,
  rules: PlacementRules,
): UnplacedReason | null {
  if (countsInCapacity(rules, person) && freeSeats(family, rules) < 1) return 'NO_CAPACITY';
  if (person.isUnder18 && family.occupants.filter((o) => o.isUnder18).length >= family.maxUnder18) {
    return 'UNDER18_LIMIT';
  }
  if (
    person.isAnimator &&
    family.maxAnimators !== null &&
    family.occupants.filter((o) => o.isAnimator).length >= family.maxAnimators
  ) {
    return 'ANIMATOR_LIMIT';
  }
  if (rules.sexMixing === 'forbid' && !person.isAnimator) {
    const youthSexes = new Set(family.occupants.filter((o) => !o.isAnimator).map((o) => o.sex));
    if (youthSexes.size > 0 && !youthSexes.has(person.sex)) return 'SEX_MIXING';
  }
  return null;
}

const cloneFamily = (family: PlacementFamily): PlacementFamily => ({
  ...family,
  occupants: [...family.occupants],
});

/**
 * Pour chaque équipe (la plus grande d'abord), on essaie de garder les membres ensemble :
 * - on préfère une famille qui accueille déjà des membres de cette équipe,
 * - sinon celle qui peut en prendre le plus, avec le moins de places perdues,
 * - égalité : identifiant le plus petit (résultat déterministe).
 */
export function proposePlacement(
  people: readonly PlacementPerson[],
  families: readonly PlacementFamily[],
  rules: PlacementRules = DEFAULT_PLACEMENT_RULES,
): PlacementResult {
  const work = families.map(cloneFamily);
  const byTeam = new Map<number, PlacementPerson[]>();
  for (const person of [...people].sort((a, b) => a.id - b.id)) {
    byTeam.set(person.teamId, [...(byTeam.get(person.teamId) ?? []), person]);
  }
  const teams = [...byTeam.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0]);

  const proposals: Proposal[] = [];
  const unplaced: UnplacedPerson[] = [];

  for (const [teamId, members] of teams) {
    const remaining = [...members];
    while (remaining.length > 0) {
      const first = remaining[0];
      const candidates = work
        .map((family) => ({ family, refusal: refusalReason(family, first, rules) }))
        .filter((c) => c.refusal === null)
        .map(({ family }) => {
          const free = freeSeats(family, rules);
          const fits = Math.min(remaining.length, Math.max(free, 1));
          const hasTeammates = family.occupants.some((o) => o.teamId === teamId);
          const mixPenalty =
            rules.sexMixing === 'avoid' &&
            family.occupants.some((o) => !o.isAnimator && o.sex !== first.sex)
              ? 5
              : 0;
          return {
            family,
            score: (hasTeammates ? 1000 : 0) + fits * 10 - (free - fits) - mixPenalty,
          };
        })
        .sort((a, b) => b.score - a.score || a.family.id - b.family.id);

      if (candidates.length === 0) {
        const reasons = work.map((family) => refusalReason(family, first, rules));
        const reason: UnplacedReason =
          reasons.find((r) => r === 'UNDER18_LIMIT' || r === 'ANIMATOR_LIMIT' || r === 'SEX_MIXING') ??
          'NO_CAPACITY';
        unplaced.push({ participantId: first.id, reason: reasons.length ? reason : 'NO_CAPACITY' });
        remaining.shift();
        continue;
      }

      const target = candidates[0].family;
      // Place autant de membres que possible dans cette famille avant de passer à la suivante.
      for (let i = 0; i < remaining.length; ) {
        const person = remaining[i];
        if (refusalReason(target, person, rules) === null) {
          target.occupants.push({
            teamId,
            isAnimator: person.isAnimator,
            isBenevole: person.isBenevole,
            isUnder18: person.isUnder18,
            sex: person.sex,
          });
          proposals.push({
            participantId: person.id,
            hostFamilyId: target.id,
            needsReview: target.needsReview,
          });
          remaining.splice(i, 1);
        } else {
          i += 1;
        }
      }
    }
  }

  return { proposals, unplaced };
}
