/**
 * Remplissage des équipes du rassemblement (seed de démonstration).
 *
 * La capacité d'une équipe vaut jeunes + animateurs + marge. La marge varie
 * volontairement d'une équipe à l'autre pour disposer de données réalistes :
 * équipes pleines, équipes à moitié remplies, équipes avec de la marge —
 * l'auto-répartition des bénévoles doit trouver des places libres.
 */

/** ~20 % des équipes restent sans second animateur : ces bénévoles ne sont
 * rattachés à aucune équipe du rassemblement (démo de la répartition). */
export const hasSecondaryAnimator = (teamIndex: number): boolean => teamIndex % 5 !== 4;

/** Capacité d'une équipe : place garantie pour jeunes et animateurs, marge variable. */
export const computeTeamMaxSize = (
  youthCount: number,
  animatorCount: number,
  teamIndex: number,
): number => {
  const members = youthCount + animatorCount;
  switch (teamIndex % 5) {
    case 0:
      return members; // équipe pleine : aucune place libre
    case 1:
      return members * 2; // équipe à moitié remplie
    case 2:
      return members + 4;
    case 3:
      return members + 2;
    default:
      return members + 3;
  }
};
