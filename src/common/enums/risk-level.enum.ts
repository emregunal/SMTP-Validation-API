/**
 * Risk bucket derived from the 0-100 score.
 *
 *   0-30   -> high
 *   31-60  -> medium
 *   61-84  -> low
 *   85-100 -> very_low
 */
export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
