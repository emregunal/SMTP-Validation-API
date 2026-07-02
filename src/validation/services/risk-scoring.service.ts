import { Injectable } from '@nestjs/common';
import { EmailStatus } from '../../common/enums/email-status.enum';
import { EmailSubStatus } from '../../common/enums/email-sub-status.enum';
import { RiskLevel } from '../../common/enums/risk-level.enum';
import {
  RiskEvaluation,
  ScoreSignal,
  SignalOutcome,
  ValidationContext,
} from '../../common/types/validation.types';

/**
 * Turns the accumulated ValidationContext into a final status/sub-status, a
 * 0-100 confidence score and a risk level.
 *
 * Philosophy: no single check is a verdict. The SMTP probe in particular is a
 * *signal* that nudges confidence, never a definitive "mailbox exists / does
 * not exist" answer:
 *   - 250 accepted  -> positive signal (not trusted on catch-all domains)
 *   - 5.1.1/user-unknown -> the ONLY SMTP path that can mark undeliverable,
 *     and even that softens to risky/unknown on catch-all/unreliable providers
 *   - bare/ambiguous 5xx -> uncertain negative, never a hard verdict
 *   - policy/IP/spam blocks & 4xx/timeouts -> infrastructure signals (unknown)
 *   - a recorded hard bounce is the single strongest signal.
 *
 * Score model: confidence starts at a base of 100 and each signal's `weight`
 * is the ACTUAL amount it moved the score (after caps). So for any result,
 * `score === clamp(100 + sum(signals.weight))` — the breakdown is auditable,
 * not decorative. (The `dns_mx` base signal carries weight 0 as it represents
 * the starting point.)
 */
@Injectable()
export class RiskScoringService {
  private static readonly MVP_NOTE =
    'SMTP check might be skipped if not enabled. When enabled, it provides an additional signal.';

  evaluate(context: ValidationContext): RiskEvaluation {
    // 1. Syntax
    if (!context.syntax.valid) {
      return this.build(
        0,
        EmailStatus.UNDELIVERABLE,
        EmailSubStatus.FAILED_SYNTAX_CHECK,
        context.syntax.reason ?? 'Email failed the syntax check.',
        [this.sig('syntax', 'negative', -100, 'Email failed the syntax check.')],
      );
    }

    // Defensive: syntax passed but domain could not be parsed.
    if (!context.domainInfo) {
      return this.build(
        0,
        EmailStatus.UNDELIVERABLE,
        EmailSubStatus.INVALID_DOMAIN_FORMAT,
        'Domain has an invalid format.',
        [this.sig('syntax', 'negative', -100, 'Domain has an invalid format.')],
      );
    }

    // 2. Disposable
    if (context.disposable) {
      return this.build(
        5,
        EmailStatus.DO_NOT_MAIL,
        EmailSubStatus.DISPOSABLE,
        'Domain is a known disposable/throwaway email provider.',
        [
          this.sig(
            'disposable',
            'negative',
            -95,
            'Known disposable/throwaway domain.',
          ),
        ],
      );
    }

    const dns = context.dns;

    // 3. DNS lookup failed/timed out -> we genuinely cannot tell.
    if (!dns || dns.error || dns.timedOut) {
      return this.build(
        40,
        EmailStatus.UNKNOWN,
        EmailSubStatus.UNKNOWN_ERROR,
        'DNS lookup failed or timed out; deliverability could not be determined.',
        [
          this.sig(
            'dns_mx',
            'inconclusive',
            -60,
            'DNS lookup failed or timed out.',
          ),
        ],
      );
    }

    // 4. No DNS entries at all
    if (!dns.dnsFound) {
      return this.build(
        0,
        EmailStatus.UNDELIVERABLE,
        EmailSubStatus.NO_DNS_ENTRIES,
        'Domain has no DNS records.',
        [this.sig('dns_mx', 'negative', -100, 'Domain has no DNS records.')],
      );
    }

    // 5. Null MX (domain explicitly rejects mail)
    if (dns.nullMx) {
      return this.build(
        0,
        EmailStatus.UNDELIVERABLE,
        EmailSubStatus.NULL_MX,
        'Domain explicitly does not accept email.',
        [
          this.sig(
            'dns_mx',
            'negative',
            -100,
            'Domain publishes a null MX (rejects mail).',
          ),
        ],
      );
    }

    // 6. DNS exists but no usable MX record
    if (!dns.mxFound) {
      return this.build(
        20,
        EmailStatus.UNDELIVERABLE,
        EmailSubStatus.NO_MX_RECORDS,
        'Domain has DNS records but no MX records.',
        [
          this.sig(
            'dns_mx',
            'negative',
            -80,
            'Domain has DNS but no MX records.',
          ),
        ],
      );
    }

    // --- from here on MX is present ---

    // 7. Recorded hard bounce -> strongest signal of all.
    if (
      context.history &&
      context.history.status === 'found' &&
      context.history.hardBounceCount > 0
    ) {
      return this.build(
        0,
        EmailStatus.UNDELIVERABLE,
        EmailSubStatus.PREVIOUS_HARD_BOUNCE,
        'Previous hard bounce recorded. Mailbox does not exist.',
        [
          this.sig(
            'bounce_history',
            'negative',
            -100,
            'A previous hard bounce is on record for this address.',
          ),
        ],
      );
    }

    const signals: ScoreSignal[] = [];
    let score = 100;
    let status = EmailStatus.DELIVERABLE;
    let subStatus: EmailSubStatus | null = EmailSubStatus.MX_FOUND;
    let reason = '';

    // Records a signal whose weight is the ACTUAL delta it applied to `score`
    // (after any cap), so the surfaced breakdown always reconciles with score.
    const emit = (
      name: string,
      outcome: SignalOutcome,
      detail: string,
      next: number,
    ): void => {
      const weight = Math.round(next - score);
      score = next;
      signals.push(this.sig(name, outcome, weight, detail));
    };

    signals.push(
      this.sig('dns_mx', 'positive', 0, 'Domain has valid MX records.'),
    );

    // History bonus / penalty
    let historyReason = '';
    if (context.history && context.history.status === 'found') {
      const hist = context.history;
      if (hist.deliveredCount > 0 && hist.confidenceImpact === 'high') {
        historyReason = ' Previous successful delivery recorded.';
        signals.push(
          this.sig(
            'bounce_history',
            'positive',
            0,
            'Previous successful delivery recorded.',
          ),
        );
      } else if (
        hist.confidenceImpact === 'medium' ||
        hist.confidenceImpact === 'low'
      ) {
        historyReason =
          ' Previous negative engagements (soft bounces or complaints) recorded.';
        emit(
          'bounce_history',
          'negative',
          'Previous soft bounces/complaints recorded.',
          score - 20,
        );
      }
    }

    // Base adjustments
    if (context.domainInfo.freeEmail) {
      emit('free_email', 'neutral', 'Free email provider.', score - 5);
    }
    if (context.domainInfo.corporateEmail) {
      emit('corporate_email', 'positive', 'Corporate domain.', score + 5);
    }

    // Domain Behavior Cache
    let behaviorReason = '';
    if (context.domainBehavior && context.domainBehavior.status === 'known') {
      const behavior = context.domainBehavior;
      if (behavior.catchAllObserved) {
        status = EmailStatus.RISKY;
        subStatus = EmailSubStatus.CATCH_ALL;
        behaviorReason = ' Domain is historically known to be a catch-all.';
        context.domainBehavior.confidenceImpact = 'lowered';
        emit(
          'domain_behavior',
          'negative',
          'Domain is historically a catch-all; mailbox verification is inconclusive.',
          Math.min(score, 60),
        );
      } else if (behavior.recentTempfailRate > 0.5) {
        behaviorReason =
          ' Domain has a history of high tempfail/timeout rates.';
        context.domainBehavior.confidenceImpact = 'lowered';
        emit(
          'domain_behavior',
          'negative',
          'Domain has a high recent tempfail/timeout rate.',
          score - 15,
        );
      }
    }

    // Catch-All
    let catchAllReason = '';
    let isCatchAll = false;
    if (context.catchAll) {
      if (
        context.catchAll.status === 'detected' ||
        context.catchAll.status === 'possible'
      ) {
        status = EmailStatus.RISKY;
        subStatus = EmailSubStatus.CATCH_ALL;
        catchAllReason =
          ' Domain is configured as a catch-all, making mailbox verification inconclusive.';
        isCatchAll = true;
        emit(
          'catch_all',
          'negative',
          'Domain accepts all recipients (catch-all); SMTP accept is not trustworthy.',
          Math.min(score, 60),
        );
      } else if (context.catchAll.status === 'unknown') {
        catchAllReason = ' Catch-all verification was inconclusive.';
        emit(
          'catch_all',
          'inconclusive',
          'Catch-all verification was inconclusive.',
          score - 5,
        );
      } else if (context.catchAll.status === 'not_detected') {
        catchAllReason =
          ' Domain correctly rejects random addresses (no catch-all).';
        emit(
          'catch_all',
          'positive',
          'Domain rejects random addresses (not a catch-all).',
          score + 5,
        );
      }
    }

    // SMTP signal — treated as a contribution, never a standalone verdict.
    let smtpReason = '';
    if (context.smtp && context.smtp.status !== 'skipped') {
      const smtp = context.smtp;
      const catchAllContext =
        isCatchAll || !!context.domainBehavior?.catchAllObserved;

      if (smtp.status === 'accepted') {
        if (catchAllContext) {
          smtpReason =
            ' SMTP accepted the address (not trusted on a catch-all domain).';
          signals.push(
            this.sig(
              'smtp',
              'inconclusive',
              0,
              'SMTP accepted, but domain is catch-all — not a reliable positive.',
            ),
          );
        } else if (smtp.provider === 'corporate') {
          status = EmailStatus.RISKY;
          subStatus = EmailSubStatus.POSSIBLE_CATCH_ALL;
          smtpReason =
            ' SMTP server accepted the address, but corporate domains often use catch-all.';
          emit(
            'smtp',
            'inconclusive',
            'SMTP accepted; corporate domains often use catch-all, so treated cautiously.',
            Math.min(score, 80),
          );
        } else {
          smtpReason = ' SMTP server accepted the recipient address.';
          emit(
            'smtp',
            'positive',
            'SMTP server accepted the recipient address.',
            score + 10,
          );
        }
      } else if (smtp.status === 'rejected' && smtp.mailboxNotFound) {
        if (catchAllContext) {
          status = EmailStatus.UNKNOWN;
          smtpReason = ` SMTP reported the mailbox is unknown, but the domain is catch-all — inconclusive (${smtp.code || 'rejected'}).`;
          emit(
            'smtp',
            'inconclusive',
            'SMTP reported user-unknown but domain is catch-all — contradictory/inconclusive.',
            score - 15,
          );
        } else if (
          smtp.provider === 'corporate' ||
          smtp.providerRiskProfile === 'relaxed'
        ) {
          status = EmailStatus.RISKY;
          subStatus = EmailSubStatus.MAILBOX_NOT_FOUND;
          smtpReason = ` SMTP reported the mailbox does not exist, but this provider is unreliable for probes (${smtp.code || 'rejected'}).`;
          emit(
            'smtp',
            'negative',
            'SMTP reported mailbox-not-found from an unreliable provider — strong but not conclusive.',
            score - 40,
          );
        } else {
          status = EmailStatus.UNDELIVERABLE;
          subStatus = EmailSubStatus.MAILBOX_NOT_FOUND;
          smtpReason = ` SMTP reported the mailbox does not exist (${smtp.enhancedCode || smtp.code || 'user unknown'}).`;
          emit(
            'smtp',
            'negative',
            'SMTP reported the mailbox does not exist (user unknown). Strong signal, but a probe is still not a delivery.',
            Math.min(score, 5),
          );
        }
      } else if (smtp.status === 'rejected') {
        // Ambiguous 5xx — no clear mailbox reason. Uncertain, never a verdict.
        if (status === EmailStatus.DELIVERABLE) {
          status = EmailStatus.RISKY;
          subStatus = EmailSubStatus.UNCONFIRMED_REJECTION;
        }
        smtpReason = ` SMTP returned a 5xx rejection with no clear mailbox reason; could be policy/greylist/IP (${smtp.code || 'rejected'}).`;
        emit(
          'smtp',
          'inconclusive',
          'SMTP 5xx rejection without a mailbox reason — treated as uncertain, not undeliverable.',
          score - 30,
        );
      } else if (smtp.status === 'blocked') {
        // Policy / IP reputation / spam filter — an infra signal, not invalid.
        if (status === EmailStatus.DELIVERABLE) {
          status = EmailStatus.RISKY;
          subStatus = EmailSubStatus.POLICY_BLOCK;
        }
        smtpReason = ` SMTP blocked by policy/IP reputation/spam filter — an infrastructure signal, not a mailbox verdict (${smtp.code || 'blocked'}).`;
        emit(
          'smtp',
          'inconclusive',
          'SMTP blocked by policy/IP/spam filter — infrastructure signal, not invalid.',
          score - 15,
        );
      } else {
        // tempfail / timeout / connection_failed / unknown -> unknown / retry.
        if (
          smtp.provider === 'enterprise_gateway' &&
          (smtp.status === 'timeout' ||
            smtp.status === 'connection_failed' ||
            smtp.status === 'tempfail')
        ) {
          status = EmailStatus.UNKNOWN;
          subStatus = EmailSubStatus.TARPIT_SUSPECTED;
          smtpReason = ` Enterprise gateway suspected of tarpitting or firewall block (${smtp.status}).`;
          emit(
            'smtp',
            'inconclusive',
            'Enterprise gateway tarpit/firewall suspected — inconclusive.',
            score - 20,
          );
        } else if (
          (smtp.provider === 'gmail' || smtp.provider === 'outlook') &&
          smtp.status === 'tempfail'
        ) {
          status = EmailStatus.UNKNOWN;
          smtpReason = ` Provider tempfail likely due to IP reputation (${smtp.status}).`;
          emit(
            'smtp',
            'inconclusive',
            'Provider tempfail, likely IP reputation — retry later.',
            score - 10,
          );
        } else {
          status = EmailStatus.UNKNOWN;
          smtpReason = ` SMTP validation was inconclusive (${smtp.status}).`;
          emit(
            'smtp',
            'inconclusive',
            'SMTP validation was inconclusive (temporary/connection issue).',
            score - 20,
          );
        }
      }
    }

    // IP / infrastructure reputation — plumbing only, currently neutral.
    if (context.ipQuality) {
      signals.push(
        this.sig('ip_quality', 'neutral', 0, context.ipQuality.detail),
      );
    }

    // Possible typo of a popular provider
    if (context.typoSuggestedDomain) {
      const suggested = context.localPart
        ? `${context.localPart}@${context.typoSuggestedDomain}`
        : context.typoSuggestedDomain;
      if (status !== EmailStatus.UNDELIVERABLE) {
        status = EmailStatus.UNDELIVERABLE;
        subStatus = EmailSubStatus.POSSIBLE_TYPO;
      }
      reason = `Domain looks like a typo of a popular provider. Did you mean ${suggested}?`;
      emit(
        'typo',
        'negative',
        `Domain looks like a typo of ${context.typoSuggestedDomain}.`,
        Math.min(score, 20),
      );
    } else if (context.roleBased) {
      if (status !== EmailStatus.UNDELIVERABLE) {
        status = EmailStatus.RISKY;
        subStatus = EmailSubStatus.ROLE_BASED;
      }
      reason = `Role-based address (e.g. info@, support@); may not map to a person.`;
      emit(
        'role_based',
        'negative',
        'Role-based address (e.g. info@, support@).',
        Math.min(score, 55),
      );
    }

    reason += smtpReason + catchAllReason + behaviorReason + historyReason;
    reason = `${reason.trim()} ${RiskScoringService.MVP_NOTE}`.trim();

    return this.build(score, status, subStatus, reason, signals);
  }

  /** Maps a 0-100 score to a risk bucket. */
  scoreToRisk(score: number): RiskLevel {
    if (score <= 30) return RiskLevel.HIGH;
    if (score <= 60) return RiskLevel.MEDIUM;
    if (score <= 84) return RiskLevel.LOW;
    return RiskLevel.VERY_LOW;
  }

  private sig(
    name: string,
    outcome: SignalOutcome,
    weight: number,
    detail: string,
  ): ScoreSignal {
    return { name, outcome, weight, detail };
  }

  private build(
    score: number,
    status: EmailStatus,
    subStatus: EmailSubStatus,
    reason: string,
    signals: ScoreSignal[],
  ): RiskEvaluation {
    const clamped = this.clamp(score);
    return {
      score: clamped,
      risk: this.scoreToRisk(clamped),
      status,
      subStatus,
      reason,
      signals,
    };
  }

  private clamp(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
