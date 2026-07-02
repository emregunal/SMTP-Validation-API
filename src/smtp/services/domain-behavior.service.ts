import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DomainBehavior,
  EmailProvider,
  SmtpStatus,
} from '../../common/types/validation.types';
import {
  DOMAIN_BEHAVIOR_REPOSITORY_TOKEN,
  DomainBehaviorRepository,
} from '../repositories/domain-behavior.repository.interface';
import { SmtpConfig } from '../../config/smtp.config';

@Injectable()
export class DomainBehaviorService {
  constructor(
    @Inject(DOMAIN_BEHAVIOR_REPOSITORY_TOKEN)
    private readonly repository: DomainBehaviorRepository,
    private readonly configService: ConfigService,
  ) {}

  async getBehavior(domain: string): Promise<DomainBehavior | null> {
    const config = this.configService.get<SmtpConfig>('smtp');
    if (!config?.domainBehaviorCacheEnabled) {
      return null;
    }
    return this.repository.get(domain);
  }

  async updateFromSmtp(
    domain: string,
    provider: EmailProvider,
    mxHost: string,
    status: SmtpStatus,
    durationMs: number,
  ): Promise<void> {
    const config = this.configService.get<SmtpConfig>('smtp');
    if (!config?.domainBehaviorCacheEnabled) return;

    let behavior = await this.repository.get(domain);

    if (!behavior) {
      behavior = this.createDefaultBehavior(domain, provider, mxHost);
    }

    behavior.lastSeenAt = new Date().toISOString();

    // In a real production system, this would use an EWMA (Exponentially Weighted Moving Average)
    // or store raw events in a time-series DB. For this MVP memory-based approach,
    // we'll simulate an EWMA with a small alpha (0.1) to slowly adjust rates based on new signals.
    const ALPHA = 0.1;
    const updateRate = (currentRate: number, isMatch: boolean) => {
      return currentRate * (1 - ALPHA) + (isMatch ? 1 : 0) * ALPHA;
    };

    behavior.acceptRate7d = updateRate(
      behavior.acceptRate7d,
      status === 'accepted',
    );
    behavior.rejectRate7d = updateRate(
      behavior.rejectRate7d,
      status === 'rejected',
    );
    behavior.tempfailRate7d = updateRate(
      behavior.tempfailRate7d,
      status === 'tempfail',
    );
    behavior.timeoutRate7d = updateRate(
      behavior.timeoutRate7d,
      status === 'timeout',
    );
    behavior.policyBlockRate7d = updateRate(
      behavior.policyBlockRate7d,
      status === 'blocked',
    );

    // Update median latency (simple approximation EWMA)
    behavior.medianLatencyMs7d = Math.round(
      behavior.medianLatencyMs7d * (1 - ALPHA) + durationMs * ALPHA,
    );

    await this.repository.set(
      domain,
      behavior,
      config.domainBehaviorCacheTtlMs,
    );
  }

  async markCatchAll(
    domain: string,
    provider: EmailProvider,
    mxHost: string,
  ): Promise<void> {
    const config = this.configService.get<SmtpConfig>('smtp');
    if (!config?.domainBehaviorCacheEnabled) return;

    let behavior = await this.repository.get(domain);
    if (!behavior) {
      behavior = this.createDefaultBehavior(domain, provider, mxHost);
    }

    behavior.catchAllObserved = true;
    behavior.lastSeenAt = new Date().toISOString();

    await this.repository.set(
      domain,
      behavior,
      config.domainBehaviorCacheTtlMs,
    );
  }

  async setCooldown(
    domain: string,
    provider: EmailProvider,
    mxHost: string,
    untilMs: number,
  ): Promise<void> {
    const config = this.configService.get<SmtpConfig>('smtp');
    if (!config?.domainBehaviorCacheEnabled) return;

    let behavior = await this.repository.get(domain);
    if (!behavior) {
      behavior = this.createDefaultBehavior(domain, provider, mxHost);
    }

    behavior.cooldownUntil = new Date(untilMs).toISOString();
    behavior.lastSeenAt = new Date().toISOString();

    await this.repository.set(
      domain,
      behavior,
      config.domainBehaviorCacheTtlMs,
    );
  }

  private createDefaultBehavior(
    domain: string,
    provider: EmailProvider,
    mxHost: string,
  ): DomainBehavior {
    return {
      domain,
      provider,
      mxCluster: mxHost,
      lastSeenAt: new Date().toISOString(),
      acceptRate7d: 0,
      rejectRate7d: 0,
      tempfailRate7d: 0,
      timeoutRate7d: 0,
      policyBlockRate7d: 0,
      catchAllObserved: false,
      medianLatencyMs7d: 100, // starting baseline
      cooldownUntil: null,
    };
  }
}
