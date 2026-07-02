import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmtpConfig } from '../../config/smtp.config';
import { SmtpSignal, EmailProvider } from '../../common/types/validation.types';
import { SmtpValidatorService } from './smtp-validator.service';
import { CooldownService } from './cooldown.service';
import { SmtpRetryPolicyService } from './smtp-retry-policy.service';
import { ProviderDetectionResult } from './provider-detection.service';

interface QueueItem {
  email: string;
  domain: string;
  mxHost: string;
  providerResult: ProviderDetectionResult;
  attempt: number;
  resolve: (value: SmtpSignal | PromiseLike<SmtpSignal>) => void;
  reject: (reason?: any) => void;
}

@Injectable()
export class SmtpQueueService {
  private readonly logger = new Logger(SmtpQueueService.name);

  private queue: QueueItem[] = [];

  private activeGlobal = 0;
  private activeDomains = new Map<string, number>();
  private activeProviders = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly smtpValidator: SmtpValidatorService,
    private readonly cooldownService: CooldownService,
    private readonly retryPolicy: SmtpRetryPolicyService,
  ) {}

  async enqueue(
    email: string,
    domain: string,
    mxHost: string,
    providerResult: ProviderDetectionResult,
  ): Promise<SmtpSignal> {
    return new Promise<SmtpSignal>((resolve, reject) => {
      this.queue.push({
        email,
        domain,
        mxHost,
        providerResult,
        attempt: 0,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  private processQueue() {
    const config = this.configService.get<SmtpConfig>('smtp');
    if (!config) return;

    if (this.activeGlobal >= config.globalConcurrency) {
      return; // Global limit reached
    }

    // Find the first item that can be processed
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];

      if (this.canProcess(item, config)) {
        // Remove from queue
        this.queue.splice(i, 1);
        this.startProcessing(item, config);

        // Loop again because we might be able to start another item
        // But we must reset the loop index or just call processQueue recursively
        this.processQueue();
        return;
      }
    }
  }

  private canProcess(item: QueueItem, config: SmtpConfig): boolean {
    // 1. Check cooldowns
    if (this.cooldownService.isCoolingDown(item.domain)) return false;
    if (this.cooldownService.isCoolingDown(item.providerResult.provider))
      return false;

    // 2. Check domain concurrency
    const domainActive = this.activeDomains.get(item.domain) || 0;
    if (domainActive >= config.domainConcurrency) return false;

    // 3. Check provider concurrency
    const providerActive =
      this.activeProviders.get(item.providerResult.provider) || 0;
    const providerLimit = this.getProviderLimit(
      item.providerResult.provider,
      config,
    );
    if (providerActive >= providerLimit) return false;

    return true;
  }

  private getProviderLimit(
    provider: EmailProvider,
    config: SmtpConfig,
  ): number {
    switch (provider) {
      case 'gmail':
        return config.providerConcurrencyGmail;
      case 'outlook':
        return config.providerConcurrencyOutlook;
      case 'yahoo':
        return config.providerConcurrencyYahoo;
      default:
        return config.providerConcurrencyDefault;
    }
  }

  private async startProcessing(item: QueueItem, config: SmtpConfig) {
    this.activeGlobal++;
    this.activeDomains.set(
      item.domain,
      (this.activeDomains.get(item.domain) || 0) + 1,
    );
    this.activeProviders.set(
      item.providerResult.provider,
      (this.activeProviders.get(item.providerResult.provider) || 0) + 1,
    );

    try {
      const signal = await this.smtpValidator.validate(
        item.email,
        item.mxHost,
        item.providerResult,
      );

      if (!signal) {
        throw new Error('SmtpValidatorService returned undefined');
      }

      const retryDec = this.retryPolicy.evaluate(
        signal.status,
        item.attempt,
        config.maxRetries,
      );

      this.logger.log(
        JSON.stringify({
          event: 'smtp_probe_completed',
          domain: item.domain,
          provider: item.providerResult.provider,
          smtpStatus: signal.status,
          smtpCode: signal.code,
          retryCount: item.attempt,
          cooldownApplied: retryDec.applyCooldown,
          durationMs: signal.durationMs,
        }),
      );

      if (retryDec.applyCooldown) {
        this.cooldownService.setCooldown(item.domain, config.domainCooldownMs);
        this.cooldownService.setCooldown(
          item.providerResult.provider,
          config.providerCooldownMs,
        );
      }

      if (retryDec.shouldRetry) {
        // Schedule retry after backoff
        setTimeout(() => {
          this.queue.push({ ...item, attempt: item.attempt + 1 });
          this.processQueue();
        }, config.retryBackoffMs);
      } else {
        item.resolve(signal);
      }
    } catch (error) {
      item.reject(error);
    } finally {
      this.activeGlobal--;
      this.activeDomains.set(
        item.domain,
        Math.max(0, (this.activeDomains.get(item.domain) || 0) - 1),
      );
      this.activeProviders.set(
        item.providerResult.provider,
        Math.max(
          0,
          (this.activeProviders.get(item.providerResult.provider) || 0) - 1,
        ),
      );

      // Try to process more
      this.processQueue();
    }
  }
}
