/**
 * Top-level outcome of an email validation.
 *
 * - deliverable:   Passed basic checks, looks sendable (DNS/MX level only).
 * - undeliverable: Failed a basic check (syntax, DNS, MX, null MX, ...).
 * - risky:         Technically possible but risky (e.g. role-based).
 * - unknown:       Could not decide (e.g. DNS timeout/error).
 * - do_not_mail:   Should not be mailed (e.g. disposable domain).
 */
export enum EmailStatus {
  DELIVERABLE = 'deliverable',
  UNDELIVERABLE = 'undeliverable',
  RISKY = 'risky',
  UNKNOWN = 'unknown',
  DO_NOT_MAIL = 'do_not_mail',
}
