/** Logique pure de la page de répartition jeunes/animateurs → équipes. */
import {
  ApplyJeunesRepartitionEntry,
  JeunesRepartitionParams,
  JeunesRepartitionParticipantRow,
  JeunesRepartitionTeamRow,
} from '../../models/models';

/** Critères par défaut validés : 6 jeunes et 1 animateur par équipe, tout réglable. */
export const DEFAULT_PARAMS: JeunesRepartitionParams = {
  jeunesPerTeam: 6,
  adultsPerTeam: 1,
  ageMode: 'mixed',
  sexMode: 'balanced',
  geoGranularity: 'group',
  geoMaxPerTeam: 1,
  separateAnimators: true,
  moveAssigned: false,
};

export interface TeamCounts {
  jeunes: number;
  adultes: number;
  free: number;
}

/**
 * Effectif affiché d'une équipe, affectations en cours (non validées) incluses.
 * Les compteurs de l'API intègrent déjà les membres hors pool ; on ajoute le
 * delta des membres du pool déplacés vers/depuis cette équipe.
 */
export function teamCountsWithPending(
  team: Pick<JeunesRepartitionTeamRow, 'id' | 'maxSize' | 'jeunesCount' | 'adultesCount'>,
  pool: Pick<JeunesRepartitionParticipantRow, 'id' | 'type'>[],
  desired: ReadonlyMap<number, number | null>,
  initial: ReadonlyMap<number, number | null>,
): TeamCounts {
  let jeunesDelta = 0;
  let adultesDelta = 0;
  for (const member of pool) {
    const from = initial.get(member.id) ?? null;
    const to = desired.get(member.id) ?? null;
    if (from === to) continue;
    const delta = to === team.id ? 1 : from === team.id ? -1 : 0;
    if (delta === 0) continue;
    if (member.type === 'ANIMATEUR') adultesDelta += delta;
    else jeunesDelta += delta;
  }
  const jeunes = team.jeunesCount + jeunesDelta;
  const adultes = team.adultesCount + adultesDelta;
  return { jeunes, adultes, free: Math.max(0, team.maxSize - jeunes - adultes) };
}

/** L'affectation affichée d'un participant diffère-t-elle de l'état enregistré ? */
export function isPending(
  participantId: number,
  desired: ReadonlyMap<number, number | null>,
  initial: ReadonlyMap<number, number | null>,
): boolean {
  return (desired.get(participantId) ?? null) !== (initial.get(participantId) ?? null);
}

/** Diff entre l'état enregistré et le board → entrées pour POST apply. */
export function buildApplyEntries(
  poolIds: Iterable<number>,
  desired: ReadonlyMap<number, number | null>,
  initial: ReadonlyMap<number, number | null>,
): ApplyJeunesRepartitionEntry[] {
  const entries: ApplyJeunesRepartitionEntry[] = [];
  for (const id of poolIds) {
    if (isPending(id, desired, initial)) {
      entries.push({ participantId: id, teamId: desired.get(id) ?? null });
    }
  }
  return entries;
}

/** Nom affiché : prénom seul pour un jeune (mineur), prénom + nom pour un animateur. */
export function displayName(row: Pick<JeunesRepartitionParticipantRow, 'firstName' | 'lastName' | 'type'>): string {
  return row.type === 'ANIMATEUR' && row.lastName
    ? `${row.firstName} ${row.lastName}`
    : row.firstName;
}

const SEX_SHORT: Record<string, string> = {
  FEMALE: 'F',
  MALE: 'G',
  OTHER: 'Autre',
  UNDISCLOSED: '—',
};

export function sexShort(sex: string | null | undefined): string {
  return (sex && SEX_SHORT[sex]) || '—';
}

/** Origine affichée selon la granularité choisie. */
export function originLabel(
  row: Pick<JeunesRepartitionParticipantRow, 'groupName' | 'city' | 'diocese'>,
  granularity: 'group' | 'city' | 'diocese' = 'group',
): string {
  if (granularity === 'city') return row.city ?? row.groupName ?? 'Origine inconnue';
  if (granularity === 'diocese') return row.diocese ?? 'Diocèse inconnu';
  return row.groupName ?? 'Sans groupe';
}
