import { FREE_EMAIL_DOMAINS } from './free-email-domains.const';

/**
 * Popular domains used as the reference set for typo detection.
 * A user-supplied domain that is "close enough" (small edit distance) to one
 * of these — but not exactly equal — is reported as a possible typo.
 *
 * These are the same popular providers we treat as "free email", so the list is
 * derived from FREE_EMAIL_DOMAINS to keep a single source of truth. If typo
 * detection ever needs to diverge (e.g. add corporate providers), replace this
 * with its own explicit list.
 */
export const REFERENCE_DOMAINS: string[] = [...FREE_EMAIL_DOMAINS];
