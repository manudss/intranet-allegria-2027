/** Formate un code de badge opaque par blocs de 4 caractères pour la lecture. */
export function formatBadgeCode(code: string): string {
  return code.replace(/(.{4})/g, '$1 ').trim();
}

/** Attribution simple ou remplacement selon l'historique (badge actif = endsAt null). */
export function deriveAssignModeForWeb(history: { endsAt: string | null }[]): 'assign' | 'replace' {
  return history.some((a) => a.endsAt === null) ? 'replace' : 'assign';
}
