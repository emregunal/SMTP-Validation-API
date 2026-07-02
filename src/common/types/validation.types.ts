import { EmailStatus } from '../enums/email-status.enum';
import { EmailSubStatus } from '../enums/email-sub-status.enum';
import { RiskLevel } from '../enums/risk-level.enum';

/** A single MX record. */
export interface MxRecord {
  exchange: string;
  priority: number;
}

/** Result of the syntax check. */
export interface SyntaxResult {
  valid: boolean;
  /** Human-readable reason when invalid. */
  reason?: string;
}

/** Parsed domain metadata. */
export interface DomainInfo {
  localPart: string;
  domain: string;
  /** Top-level domain, e.g. "com" for "mail.example.com". */
  tld: string;
  /** True when the domain has more than 2 labels (e.g. "mail.example.com"). */
  isSubdomain: boolean;
  freeEmail: boolean;
  corporateEmail: boolean;
}

/** Outcome of DNS/MX resolution for a domain. */
export interface DnsLookupResult {
  /** Any DNS record (MX, A or AAAA) was found. */
  dnsFound: boolean;
  /** At least one usable (non-null) MX record was found. */
  mxFound: boolean;
  /** Domain explicitly refuses mail via a "null MX" (RFC 7505). */
  nullMx: boolean;
  mxRecords: MxRecord[];
  aRecords: string[];
  aaaaRecords: string[];
  /** A lookup timed out. */
  timedOut: boolean;
  /** An unexpected DNS error occurred (not a simple NXDOMAIN/no-record). */
  error: boolean;
}

export type EmailProvider =
  | 'gmail'
  | 'google_workspace'
  | 'outlook'
  | 'microsoft_365'
  | 'yahoo'
  | 'yandex'
  | 'zoho'
  | 'enterprise_gateway'
  | 'corporate'
  | 'free_email'
  | 'unknown';

export type ProviderRiskProfile = 'strict' | 'moderate' | 'relaxed' | 'unknown';

export type SmtpStatus =
  | 'accepted'
  | 'rejected'
  | 'tempfail'
  | 'timeout'
  | 'blocked'
  | 'connection_failed'
  | 'skipped'
  | 'unknown';

/** Result of the SMTP check. */
export interface SmtpSignal {
  status: SmtpStatus;
  code: number | null;
  enhancedCode: string | null;
  message: string | null;
  provider: EmailProvider;
  providerRiskProfile: ProviderRiskProfile;
  mxHost: string | null;
  durationMs: number;
  /**
   * True ONLY when a 5xx response is a mailbox-specific rejection we can
   * attribute to a missing recipient (e.g. 5.1.1 "user unknown"). A bare or
   * ambiguous 5xx (no clear mailbox reason, or a policy/IP block) is NOT a
   * mailbox-not-found and must never be treated as a definitive verdict.
   */
  mailboxNotFound?: boolean;
}

export type IpQualityStatus = 'good' | 'poor' | 'unknown' | 'not_evaluated';

/**
 * Reputation of the sending/receiving infrastructure (MX host / connecting IP).
 * Plumbing only for now: real DNSBL/reputation lookups are not performed yet,
 * so this is reported as `not_evaluated` and contributes a neutral signal.
 */
export interface IpQualitySignal {
  status: IpQualityStatus;
  mxHost: string | null;
  /** DNSBLs / reputation lists the host was found on (empty until implemented). */
  listedOn: string[];
  detail: string;
}

export type SignalOutcome =
  'positive' | 'negative' | 'neutral' | 'inconclusive';

/**
 * One factor that fed into the confidence score, with the direction and size
 * of its contribution. Surfaced in the API response so consumers can see that
 * the verdict is a weighted blend of signals, not any single check.
 */
export interface ScoreSignal {
  /** Stable identifier, e.g. 'syntax' | 'dns_mx' | 'smtp' | 'catch_all' | 'bounce_history' | 'domain_behavior' | 'role_based' | 'typo' | 'disposable' | 'ip_quality'. */
  name: string;
  outcome: SignalOutcome;
  /** Signed contribution to the 0-100 confidence score (0 when it did not move the score). */
  weight: number;
  detail: string;
}

export type CatchAllStatus =
  'detected' | 'possible' | 'not_detected' | 'unknown' | 'skipped';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface CatchAllSignal {
  status: CatchAllStatus;
  testAddress: string | null;
  smtpStatus: SmtpStatus;
  confidence: ConfidenceLevel;
}

export interface DomainBehavior {
  domain: string;
  provider: EmailProvider;
  mxCluster: string;
  lastSeenAt: string;
  acceptRate7d: number;
  rejectRate7d: number;
  tempfailRate7d: number;
  timeoutRate7d: number;
  policyBlockRate7d: number;
  catchAllObserved: boolean;
  medianLatencyMs7d: number;
  cooldownUntil: string | null;
}

export type DomainBehaviorStatus = 'known' | 'unknown';

export interface DomainBehaviorSignal {
  status: DomainBehaviorStatus;
  catchAllObserved: boolean;
  recentTempfailRate: number;
  confidenceImpact: 'lowered' | 'neutral' | 'boosted';
}

export interface HistorySignal {
  status: 'found' | 'not_found';
  lastEvent?: string;
  hardBounceCount: number;
  deliveredCount: number;
  confidenceImpact: 'high' | 'medium' | 'low' | 'none';
}

/** Boolean summary of all checks, surfaced in the API response. */
export interface EmailChecks {
  syntaxValid: boolean;
  domainValid: boolean;
  dnsFound: boolean;
  mxFound: boolean;
  nullMx: boolean;
  disposable: boolean;
  roleBased: boolean;
  freeEmail: boolean;
  typoDetected: boolean;
  smtp: SmtpSignal | null;
  catchAll: CatchAllSignal | null;
  domainBehavior: DomainBehaviorSignal | null;
  ipQuality: IpQualitySignal | null;
}

/**
 * Final scoring decision produced by RiskScoringService.
 *
 * `score` is the 0-100 confidence that the address is deliverable: a weighted
 * blend of all signals, never a single check's verdict. `signals` breaks down
 * how that confidence was reached.
 */
export interface RiskEvaluation {
  score: number;
  risk: RiskLevel;
  status: EmailStatus;
  subStatus: EmailSubStatus;
  reason: string;
  signals: ScoreSignal[];
}

/**
 * Mutable context that flows through the validation pipeline. Each sub-service
 * fills in its slice; the risk scorer reads the whole thing to decide the
 * final status.
 */
export interface ValidationContext {
  rawEmail: string;
  normalizedEmail: string | null;
  localPart: string | null;
  domain: string | null;
  domainInfo: DomainInfo | null;
  syntax: SyntaxResult;
  dns: DnsLookupResult | null;
  disposable: boolean;
  roleBased: boolean;
  /** Suggested *domain* (e.g. "gmail.com") when a typo is detected, else null. */
  typoSuggestedDomain: string | null;
  smtp: SmtpSignal | null;
  catchAll: CatchAllSignal | null;
  domainBehavior: DomainBehaviorSignal | null;
  history: HistorySignal | null;
  ipQuality: IpQualitySignal | null;
}
