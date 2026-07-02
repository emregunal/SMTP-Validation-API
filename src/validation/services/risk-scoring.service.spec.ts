import { EmailStatus } from '../../common/enums/email-status.enum';
import { EmailSubStatus } from '../../common/enums/email-sub-status.enum';
import { RiskLevel } from '../../common/enums/risk-level.enum';
import {
  DnsLookupResult,
  ValidationContext,
} from '../../common/types/validation.types';
import { RiskScoringService } from './risk-scoring.service';

function dns(partial: Partial<DnsLookupResult>): DnsLookupResult {
  return {
    dnsFound: true,
    mxFound: true,
    nullMx: false,
    mxRecords: [{ exchange: 'mx.example.com', priority: 10 }],
    aRecords: [],
    aaaaRecords: [],
    timedOut: false,
    error: false,
    ...partial,
  };
}

function context(partial: Partial<ValidationContext>): ValidationContext {
  return {
    rawEmail: 'user@example.com',
    normalizedEmail: 'user@example.com',
    localPart: 'user',
    domain: 'example.com',
    domainInfo: {
      localPart: 'user',
      domain: 'example.com',
      tld: 'com',
      isSubdomain: false,
      freeEmail: false,
      corporateEmail: true,
    },
    syntax: { valid: true },
    dns: dns({}),
    disposable: false,
    roleBased: false,
    typoSuggestedDomain: null,
    smtp: null,
    catchAll: null,
    domainBehavior: null,
    history: null,
    ipQuality: null,
    ...partial,
  };
}

describe('RiskScoringService', () => {
  const service = new RiskScoringService();

  it('syntax invalid -> undeliverable / failed_syntax_check / 0 / high', () => {
    const result = service.evaluate(
      context({ syntax: { valid: false, reason: 'bad' }, dns: null }),
    );
    expect(result.status).toBe(EmailStatus.UNDELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.FAILED_SYNTAX_CHECK);
    expect(result.score).toBe(0);
    expect(result.risk).toBe(RiskLevel.HIGH);
  });

  it('disposable -> do_not_mail / disposable / 5 / high', () => {
    const result = service.evaluate(context({ disposable: true, dns: null }));
    expect(result.status).toBe(EmailStatus.DO_NOT_MAIL);
    expect(result.subStatus).toBe(EmailSubStatus.DISPOSABLE);
    expect(result.score).toBe(5);
    expect(result.risk).toBe(RiskLevel.HIGH);
  });

  it('dns error -> unknown / unknown_error / 40 / medium', () => {
    const result = service.evaluate(context({ dns: dns({ error: true }) }));
    expect(result.status).toBe(EmailStatus.UNKNOWN);
    expect(result.subStatus).toBe(EmailSubStatus.UNKNOWN_ERROR);
    expect(result.risk).toBe(RiskLevel.MEDIUM);
  });

  it('no DNS entries -> undeliverable / no_dns_entries / 0', () => {
    const result = service.evaluate(
      context({ dns: dns({ dnsFound: false, mxFound: false }) }),
    );
    expect(result.status).toBe(EmailStatus.UNDELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.NO_DNS_ENTRIES);
    expect(result.score).toBe(0);
  });

  it('null MX -> undeliverable / null_mx / 0', () => {
    const result = service.evaluate(
      context({ dns: dns({ nullMx: true, mxFound: false }) }),
    );
    expect(result.status).toBe(EmailStatus.UNDELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.NULL_MX);
    expect(result.score).toBe(0);
  });

  it('no MX records -> undeliverable / no_mx_records / 20', () => {
    const result = service.evaluate(
      context({
        dns: dns({ mxFound: false, mxRecords: [], aRecords: ['1.2.3.4'] }),
      }),
    );
    expect(result.status).toBe(EmailStatus.UNDELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.NO_MX_RECORDS);
    expect(result.score).toBe(20);
  });

  it('possible typo (with MX) -> undeliverable / possible_typo / 20', () => {
    const result = service.evaluate(
      context({ typoSuggestedDomain: 'gmail.com' }),
    );
    expect(result.status).toBe(EmailStatus.UNDELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.POSSIBLE_TYPO);
    expect(result.score).toBe(20);
    expect(result.reason).toContain('user@gmail.com');
  });

  it('role-based (with MX) -> risky / role_based / 55 / medium', () => {
    const result = service.evaluate(context({ roleBased: true }));
    expect(result.status).toBe(EmailStatus.RISKY);
    expect(result.subStatus).toBe(EmailSubStatus.ROLE_BASED);
    expect(result.score).toBe(55);
    expect(result.risk).toBe(RiskLevel.MEDIUM);
  });

  it('corporate deliverable -> deliverable / mx_found / very_low', () => {
    const result = service.evaluate(context({}));
    expect(result.status).toBe(EmailStatus.DELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.MX_FOUND);
    expect(result.risk).toBe(RiskLevel.VERY_LOW);
  });

  it('free-provider deliverable -> deliverable / mx_found / 95', () => {
    const result = service.evaluate(
      context({
        domain: 'gmail.com',
        domainInfo: {
          localPart: 'user',
          domain: 'gmail.com',
          tld: 'com',
          isSubdomain: false,
          freeEmail: true,
          corporateEmail: false,
        },
      }),
    );
    expect(result.status).toBe(EmailStatus.DELIVERABLE);
    expect(result.score).toBe(95);
  });

  it('SMTP accepted -> adds score and keeps status', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'accepted',
          code: 250,
          enhancedCode: null,
          message: null,
          provider: 'unknown',
          providerRiskProfile: 'unknown',
          mxHost: null,
          durationMs: 10,
        },
      }),
    );
    // Base 100 + 5 (corporate) + 10 (smtp) = 115, clamped to 100
    expect(result.status).toBe(EmailStatus.DELIVERABLE);
    expect(result.score).toBe(100);
    expect(result.reason).toContain('SMTP server accepted');
  });

  it('SMTP confirmed mailbox-not-found -> undeliverable', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'rejected',
          code: 550,
          enhancedCode: '5.1.1',
          message: 'User unknown',
          mailboxNotFound: true,
          provider: 'gmail',
          providerRiskProfile: 'strict',
          mxHost: null,
          durationMs: 10,
        },
      }),
    );
    expect(result.status).toBe(EmailStatus.UNDELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.MAILBOX_NOT_FOUND);
    expect(result.score).toBe(5);
    expect(result.reason).toContain('mailbox does not exist');
  });

  it('ambiguous 5xx (no mailbox reason) -> risky, not undeliverable', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'rejected',
          code: 550,
          enhancedCode: null,
          message: 'Requested action not taken',
          mailboxNotFound: false,
          provider: 'unknown',
          providerRiskProfile: 'unknown',
          mxHost: null,
          durationMs: 10,
        },
      }),
    );
    // 100 + 5 (corporate) - 30 (ambiguous) = 75
    expect(result.status).toBe(EmailStatus.RISKY);
    expect(result.subStatus).toBe(EmailSubStatus.UNCONFIRMED_REJECTION);
    expect(result.score).toBe(75);
  });

  it('SMTP blocked (policy/IP) -> risky, not invalid', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'blocked',
          code: 554,
          enhancedCode: '5.7.1',
          message: 'Spam detected',
          provider: 'unknown',
          providerRiskProfile: 'unknown',
          mxHost: null,
          durationMs: 10,
        },
      }),
    );
    // Base 100 + 5 (corporate) - 15 (blocked) = 90
    expect(result.status).toBe(EmailStatus.RISKY);
    expect(result.subStatus).toBe(EmailSubStatus.POLICY_BLOCK);
    expect(result.score).toBe(90);
    expect(result.reason).toContain('blocked by policy');
  });

  it('corporate provider accepted -> risky / possible_catch_all', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'accepted',
          code: 250,
          enhancedCode: null,
          message: null,
          provider: 'corporate',
          providerRiskProfile: 'relaxed',
          mxHost: null,
          durationMs: 10,
        },
      }),
    );
    expect(result.status).toBe(EmailStatus.RISKY);
    expect(result.subStatus).toBe(EmailSubStatus.POSSIBLE_CATCH_ALL);
    expect(result.score).toBe(80);
    expect(result.reason).toContain('corporate domains often use catch-all');
  });

  it('mailbox-not-found on a catch-all domain -> softens to unknown', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'rejected',
          code: 550,
          enhancedCode: '5.1.1',
          message: 'User unknown',
          mailboxNotFound: true,
          provider: 'unknown',
          providerRiskProfile: 'unknown',
          mxHost: null,
          durationMs: 10,
        },
        catchAll: {
          status: 'detected',
          testAddress: 'verify-1@example.com',
          smtpStatus: 'accepted',
          confidence: 'high',
        },
      }),
    );
    // Contradictory: catch-all accepts all, yet reported user-unknown -> inconclusive.
    expect(result.status).toBe(EmailStatus.UNKNOWN);
    expect(result.status).not.toBe(EmailStatus.UNDELIVERABLE);
  });

  it('enterprise_gateway timeout -> tarpit_suspected', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'timeout',
          code: null,
          enhancedCode: null,
          message: null,
          provider: 'enterprise_gateway',
          providerRiskProfile: 'strict',
          mxHost: null,
          durationMs: 10,
        },
      }),
    );
    expect(result.status).toBe(EmailStatus.UNKNOWN);
    expect(result.subStatus).toBe(EmailSubStatus.TARPIT_SUSPECTED);
    expect(result.score).toBe(85); // 100 + 5 (corp) - 20 (unknown timeout)
  });

  it('gmail tempfail -> unknown (less penalty)', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'tempfail',
          code: 450,
          enhancedCode: null,
          message: null,
          provider: 'gmail',
          providerRiskProfile: 'strict',
          mxHost: null,
          durationMs: 10,
        },
      }),
    );
    expect(result.status).toBe(EmailStatus.UNKNOWN);
    expect(result.score).toBe(95); // 100 + 5 (corp) - 10 (gmail tempfail)
  });

  it('catch-all detected -> risky and max score 60', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'accepted',
          code: 250,
          enhancedCode: null,
          message: null,
          provider: 'unknown',
          providerRiskProfile: 'unknown',
          mxHost: null,
          durationMs: 10,
        },
        catchAll: {
          status: 'detected',
          testAddress: 'verify-123@example.com',
          smtpStatus: 'accepted',
          confidence: 'high',
        },
      }),
    );
    expect(result.status).toBe(EmailStatus.RISKY);
    expect(result.subStatus).toBe(EmailSubStatus.CATCH_ALL);
    expect(result.score).toBe(60);
  });

  it('score always reconciles with the sum of signal weights (100 + sum, clamped)', () => {
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const cases: Array<Partial<ValidationContext>> = [
      {},
      { syntax: { valid: false, reason: 'bad' }, dns: null },
      { disposable: true, dns: null },
      { dns: dns({ error: true }) },
      { dns: dns({ mxFound: false, mxRecords: [], aRecords: ['1.2.3.4'] }) },
      { roleBased: true },
      { typoSuggestedDomain: 'gmail.com' },
      {
        smtp: {
          status: 'accepted',
          code: 250,
          enhancedCode: null,
          message: null,
          provider: 'unknown',
          providerRiskProfile: 'unknown',
          mxHost: null,
          durationMs: 10,
        },
      },
      {
        smtp: {
          status: 'rejected',
          code: 550,
          enhancedCode: '5.1.1',
          message: 'User unknown',
          mailboxNotFound: true,
          provider: 'gmail',
          providerRiskProfile: 'strict',
          mxHost: null,
          durationMs: 10,
        },
      },
      {
        smtp: {
          status: 'blocked',
          code: 554,
          enhancedCode: '5.7.1',
          message: 'Spam',
          provider: 'unknown',
          providerRiskProfile: 'unknown',
          mxHost: null,
          durationMs: 10,
        },
        catchAll: {
          status: 'not_detected',
          testAddress: 'x@example.com',
          smtpStatus: 'rejected',
          confidence: 'high',
        },
      },
    ];
    for (const partial of cases) {
      const result = service.evaluate(context(partial));
      const sum = result.signals.reduce((acc, s) => acc + s.weight, 0);
      expect(result.score).toBe(clamp(100 + sum));
    }
  });

  it('catch-all not_detected -> boosts score and keeps deliverable', () => {
    const result = service.evaluate(
      context({
        smtp: {
          status: 'accepted',
          code: 250,
          enhancedCode: null,
          message: null,
          provider: 'unknown',
          providerRiskProfile: 'unknown',
          mxHost: null,
          durationMs: 10,
        },
        catchAll: {
          status: 'not_detected',
          testAddress: 'verify-123@example.com',
          smtpStatus: 'rejected',
          confidence: 'high',
        },
      }),
    );
    // Base 100 + 5 (corporate) + 5 (no catch-all) + 10 (smtp accepted) = 120 -> 100
    expect(result.status).toBe(EmailStatus.DELIVERABLE);
    expect(result.score).toBe(100);
  });
});
