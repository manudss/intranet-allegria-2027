/** Logique pure de la répartition automatique jeunes/animateurs → équipes. */

export type AlgoAgeMode = 'tranches' | 'same-age' | 'mixed';
export type AlgoSexMode = 'balanced' | 'none' | 'non-mixed';

export interface AlgoParticipant {
  id: number;
  kind: 'JEUNE' | 'ANIMATEUR';
  /** Âge en années, null si inconnu. */
  age: number | null;
  /** Tranche d'âge (MEJ ou calculée) — sert aux modes « tranches » et « mixed ». */
  tranche: string;
  sex: string | null;
  /** Clé d'origine géographique selon la granularité choisie (groupe, ville, diocèse). */
  originKey: string;
  /** Libellé lisible de l'origine, pour les messages d'alerte. */
  originLabel: string;
}

export interface AlgoTeam {
  id: number;
  name: string;
  maxSize: number;
  /** Membres déjà en place (hors pool à répartir). */
  members: AlgoParticipant[];
}

export interface AlgoParams {
  jeunesPerTeam: number;
  adultsPerTeam: number;
  ageMode: AlgoAgeMode;
  sexMode: AlgoSexMode;
  geoMaxPerTeam: number;
  separateAnimators: boolean;
}

export interface AlgoViolation {
  teamId: number | null;
  participantId: number | null;
  kind: 'geo' | 'animator-origin' | 'capacity';
  message: string;
}

export interface AlgoTeamStat {
  teamId: number;
  jeunes: number;
  adultes: number;
  maxSize: number;
  sexes: Record<string, number>;
  tranches: Record<string, number>;
  origins: Record<string, number>;
}

export interface AlgoResult {
  /** participantId → teamId proposé. */
  proposals: Map<number, number>;
  unplaced: number[];
  violations: AlgoViolation[];
  stats: AlgoTeamStat[];
}

interface TeamState {
  team: AlgoTeam;
  members: AlgoParticipant[];
  originCounts: Map<string, { count: number; label: string }>;
  animatorOriginKeys: Set<string>;
  animatorOriginLabels: Map<string, string>;
  jeunes: number;
  adultes: number;
}

const increment = <K>(map: Map<K, number>, key: K): void => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

const modalKey = (counts: Map<string, number>): string | null => {
  let best: string | null = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && key < best)) {
      best = key;
      bestCount = count;
    }
  }
  return best;
};

function buildState(team: AlgoTeam): TeamState {
  const state: TeamState = {
    team,
    members: [...team.members],
    originCounts: new Map(),
    animatorOriginKeys: new Set(),
    animatorOriginLabels: new Map(),
    jeunes: 0,
    adultes: 0,
  };
  for (const member of state.members) {
    if (member.kind === 'ANIMATEUR') {
      state.adultes += 1;
      state.animatorOriginKeys.add(member.originKey);
      state.animatorOriginLabels.set(member.originKey, member.originLabel);
    } else {
      state.jeunes += 1;
      const origin = state.originCounts.get(member.originKey) ?? { count: 0, label: member.originLabel };
      origin.count += 1;
      state.originCounts.set(member.originKey, origin);
    }
  }
  return state;
}

const totalOf = (state: TeamState): number => state.members.length;

function scoreAdult(state: TeamState, params: AlgoParams): number {
  if (totalOf(state) >= state.team.maxSize) return -Infinity;
  // Priorité aux équipes en dessous du quota d'adultes, puis aux moins remplies.
  return (params.adultsPerTeam - state.adultes) * 20 - totalOf(state);
}

function scoreJeune(jeune: AlgoParticipant, state: TeamState, params: AlgoParams): number {
  if (totalOf(state) >= state.team.maxSize) return -Infinity;
  let score = (params.jeunesPerTeam - state.jeunes) * 5;

  // Séparation géographique : au-delà du quota d'origine, très forte pénalité.
  const sameOrigin = state.originCounts.get(jeune.originKey)?.count ?? 0;
  if (sameOrigin >= params.geoMaxPerTeam) score -= 1000 + sameOrigin;

  // Un animateur de la même origine : pénalité forte si l'option est active.
  if (params.separateAnimators && state.animatorOriginKeys.has(jeune.originKey)) score -= 500;

  // Âge.
  if (state.jeunes > 0) {
    const trancheCounts = new Map<string, number>();
    const ageCounts = new Map<string, number>();
    for (const m of state.members) {
      if (m.kind !== 'JEUNE') continue;
      increment(trancheCounts, m.tranche);
      if (m.age !== null) increment(ageCounts, String(m.age));
    }
    if (params.ageMode === 'tranches') {
      score += modalKey(trancheCounts) === jeune.tranche ? 20 : -20;
    } else if (params.ageMode === 'same-age') {
      if (jeune.age !== null) score += modalKey(ageCounts) === String(jeune.age) ? 20 : -20;
    } else {
      // Âges mélangés : bonus quand la tranche du jeune est sous-représentée.
      const share = (trancheCounts.get(jeune.tranche) ?? 0) / state.jeunes;
      score += 10 * (1 - share);
    }
  }

  // Mixité filles / garçons.
  if (state.jeunes > 0 && jeune.sex) {
    if (params.sexMode === 'balanced') {
      let same = 0;
      let known = 0;
      for (const m of state.members) {
        if (m.kind !== 'JEUNE' || !m.sex) continue;
        known += 1;
        if (m.sex === jeune.sex) same += 1;
      }
      if (known > 0) score += 8 * (0.5 - same / known);
    } else if (params.sexMode === 'non-mixed') {
      const sexes = new Set(
        state.members.filter((m) => m.kind === 'JEUNE' && m.sex).map((m) => m.sex as string),
      );
      if (sexes.size > 0 && !sexes.has(jeune.sex)) score -= 800;
      else score += 10;
    }
  }

  // Départage : équipe la moins remplie, puis nom, puis id.
  score -= totalOf(state) * 0.01;
  return score;
}

/**
 * Répartition automatique : animateurs d'abord (quota par équipe), puis jeunes
 * (gros groupes d'origine d'abord, les plus contraints). La capacité maxSize
 * n'est jamais dépassée ; les autres critères sont des préférences signalées
 * en violations quand elles ne peuvent pas être respectées. Déterministe.
 */
export function proposeJeunesAssignment(
  pool: AlgoParticipant[],
  teams: AlgoTeam[],
  params: AlgoParams,
): AlgoResult {
  const states = teams
    .map(buildState)
    .sort((a, b) => a.team.name.localeCompare(b.team.name, 'fr') || a.team.id - b.team.id);
  const proposals = new Map<number, number>();
  const unplaced: number[] = [];
  const violations: AlgoViolation[] = [];

  const originFrequency = new Map<string, number>();
  for (const p of pool) increment(originFrequency, p.originKey);

  const adults = pool
    .filter((p) => p.kind === 'ANIMATEUR')
    .sort(
      (a, b) =>
        (originFrequency.get(b.originKey) ?? 0) - (originFrequency.get(a.originKey) ?? 0) ||
        a.id - b.id,
    );
  const jeunes = pool
    .filter((p) => p.kind !== 'ANIMATEUR')
    .sort(
      (a, b) =>
        (originFrequency.get(b.originKey) ?? 0) - (originFrequency.get(a.originKey) ?? 0) ||
        a.tranche.localeCompare(b.tranche, 'fr') ||
        (a.age ?? 99) - (b.age ?? 99) ||
        a.id - b.id,
    );

  const place = (
    participant: AlgoParticipant,
    scorer: (state: TeamState) => number,
  ): TeamState | null => {
    let best: TeamState | null = null;
    let bestScore = -Infinity;
    for (const state of states) {
      const score = scorer(state);
      if (score > bestScore) {
        best = state;
        bestScore = score;
      }
    }
    return best;
  };

  for (const adult of adults) {
    const state = place(adult, (s) => scoreAdult(s, params));
    if (!state) {
      unplaced.push(adult.id);
      violations.push({
        teamId: null,
        participantId: adult.id,
        kind: 'capacity',
        message: 'Aucune équipe avec une place libre pour cet animateur.',
      });
      continue;
    }
    proposals.set(adult.id, state.team.id);
    state.members.push(adult);
    state.adultes += 1;
    state.animatorOriginKeys.add(adult.originKey);
    state.animatorOriginLabels.set(adult.originKey, adult.originLabel);
  }

  for (const jeune of jeunes) {
    const state = place(jeune, (s) => scoreJeune(jeune, s, params));
    if (!state) {
      unplaced.push(jeune.id);
      violations.push({
        teamId: null,
        participantId: jeune.id,
        kind: 'capacity',
        message: 'Aucune équipe avec une place libre pour ce jeune.',
      });
      continue;
    }
    proposals.set(jeune.id, state.team.id);
    state.members.push(jeune);
    state.jeunes += 1;
    const origin = state.originCounts.get(jeune.originKey) ?? { count: 0, label: jeune.originLabel };
    origin.count += 1;
    state.originCounts.set(jeune.originKey, origin);
  }

  // Violations calculées sur l'état final : dépassements du quota d'origine et
  // jeunes placés avec un animateur de la même origine (option active).
  for (const state of states) {
    for (const origin of state.originCounts.values()) {
      if (origin.count > params.geoMaxPerTeam) {
        violations.push({
          teamId: state.team.id,
          participantId: null,
          kind: 'geo',
          message: `${state.team.name} : ${origin.count} jeunes de « ${origin.label} » (max souhaité ${params.geoMaxPerTeam}).`,
        });
      }
    }
    if (params.separateAnimators) {
      const conflicts = new Map<string, { label: string; count: number }>();
      for (const member of state.members) {
        if (member.kind === 'JEUNE' && state.animatorOriginKeys.has(member.originKey)) {
          const entry = conflicts.get(member.originKey) ?? { label: member.originLabel, count: 0 };
          entry.count += 1;
          conflicts.set(member.originKey, entry);
        }
      }
      for (const conflict of conflicts.values()) {
        violations.push({
          teamId: state.team.id,
          participantId: null,
          kind: 'animator-origin',
          message: `${state.team.name} : ${conflict.count} jeune(s) de « ${conflict.label} » avec un animateur de la même origine.`,
        });
      }
    }
  }

  const stats: AlgoTeamStat[] = states.map((state) => {
    const sexes: Record<string, number> = {};
    const tranches: Record<string, number> = {};
    const origins: Record<string, number> = {};
    for (const member of state.members) {
      if (member.kind !== 'JEUNE') continue;
      if (member.sex) sexes[member.sex] = (sexes[member.sex] ?? 0) + 1;
      tranches[member.tranche] = (tranches[member.tranche] ?? 0) + 1;
      origins[member.originLabel] = (origins[member.originLabel] ?? 0) + 1;
    }
    return {
      teamId: state.team.id,
      jeunes: state.jeunes,
      adultes: state.adultes,
      maxSize: state.team.maxSize,
      sexes,
      tranches,
      origins,
    };
  });

  return { proposals, unplaced, violations, stats };
}
