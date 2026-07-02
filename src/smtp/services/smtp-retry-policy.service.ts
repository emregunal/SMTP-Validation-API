import { Injectable } from '@nestjs/common';
import { SmtpStatus } from '../../common/types/validation.types';

export interface RetryDecision {
  shouldRetry: boolean;
  applyCooldown: boolean;
  reason: string;
}

@Injectable()
export class SmtpRetryPolicyService {
  /**
   * Determines whether an SMTP probe should be retried based on its status.
   */
  evaluate(
    status: SmtpStatus,
    currentAttempt: number,
    maxRetries: number,
  ): RetryDecision {
    if (currentAttempt >= maxRetries) {
      return {
        shouldRetry: false,
        applyCooldown: false,
        reason: 'Max retries exceeded',
      };
    }

    switch (status) {
      case 'accepted':
      case 'rejected':
      case 'skipped':
        return {
          shouldRetry: false,
          applyCooldown: false,
          reason: `No retry for definitive status: ${status}`,
        };

      case 'blocked':
        // Policy block -> do not retry, apply cooldown immediately
        return {
          shouldRetry: false,
          applyCooldown: true,
          reason: 'Policy blocked, applying cooldown',
        };

      case 'tempfail':
      case 'timeout':
      case 'connection_failed':
      case 'unknown':
        return {
          shouldRetry: true,
          applyCooldown: false,
          reason: `Retrying transient error: ${status}`,
        };

      default:
        return {
          shouldRetry: false,
          applyCooldown: false,
          reason: `Unknown status: ${status}`,
        };
    }
  }
}
