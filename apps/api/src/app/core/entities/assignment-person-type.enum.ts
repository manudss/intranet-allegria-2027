/**
 * Personne visée par une affectation de trajet ou une note : fiche participant
 * (jeune ou animateur) ou bénévole (les fiches BENEVOLE ne sont que des
 * projections d'équipe, elles ne couvrent pas tous les bénévoles).
 */
export enum AssignmentPersonType {
  PARTICIPANT = 'PARTICIPANT',
  VOLUNTEER = 'VOLUNTEER',
}
