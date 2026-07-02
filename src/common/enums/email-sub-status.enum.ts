/**
 * Fine-grained reason attached to an EmailStatus.
 */
export enum EmailSubStatus {
  FAILED_SYNTAX_CHECK = 'failed_syntax_check',
  INVALID_DOMAIN_FORMAT = 'invalid_domain_format',
  NO_DNS_ENTRIES = 'no_dns_entries',
  NO_MX_RECORDS = 'no_mx_records',
  NULL_MX = 'null_mx',
  MX_FOUND = 'mx_found',
  DISPOSABLE = 'disposable',
  ROLE_BASED = 'role_based',
  POSSIBLE_TYPO = 'possible_typo',
  FREE_EMAIL = 'free_email',
  CORPORATE_EMAIL = 'corporate_email',
  UNKNOWN_ERROR = 'unknown_error',
  TARPIT_SUSPECTED = 'tarpit_suspected',
  POSSIBLE_CATCH_ALL = 'possible_catch_all',
  CATCH_ALL = 'catch_all',
  PREVIOUS_HARD_BOUNCE = 'previous_hard_bounce',
  /** SMTP confirmed the mailbox does not exist (e.g. 5.1.1 "user unknown"). */
  MAILBOX_NOT_FOUND = 'mailbox_not_found',
  /** A 5xx rejection we could not attribute to a missing mailbox (could be policy/greylist/IP). */
  UNCONFIRMED_REJECTION = 'unconfirmed_rejection',
  /** SMTP blocked by policy / IP reputation / spam filter — an infra signal, not a mailbox verdict. */
  POLICY_BLOCK = 'policy_block',
}
