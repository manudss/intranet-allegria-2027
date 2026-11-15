/**
 * Piste d'une séquence : branche concernée (TA / ES) ou temps commun aux deux.
 * Le lieu (« location ») reste le lieu physique ; la piste dit pour qui le créneau est prévu.
 */
export enum ProgramSequenceTrack {
  TA = 'TA',
  ES = 'ES',
  COMMON = 'COMMON',
}
