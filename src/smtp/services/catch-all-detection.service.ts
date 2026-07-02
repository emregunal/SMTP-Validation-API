import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmtpConfig } from '../../config/smtp.config';
import {
  CatchAllSignal,
  ValidationContext,
} from '../../common/types/validation.types';
import { SmtpQueueService } from './smtp-queue.service';
import { ProviderDetectionResult } from './provider-detection.service';
import { randomBytes } from 'crypto';

@Injectable()
export class CatchAllDetectionService {
  private readonly logger = new Logger(CatchAllDetectionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly smtpQueue: SmtpQueueService,
  ) {}

  /**
   * Performs a Catch-All test by generating a random local-part and queueing an SMTP check.
   */
  async detect(
    context: ValidationContext,
    mxHost: string,
    providerResult: ProviderDetectionResult,
  ): Promise<CatchAllSignal | null> {
    const config = this.configService.get<SmtpConfig>('smtp');
    if (!config || !config.catchAllCheckEnabled || !config.enabled) {
      return null;
    }

    if (config.catchAllSkipProviders.includes(providerResult.provider)) {
      this.logger.debug(
        `Skipping catch-all for provider ${providerResult.provider}`,
      );
      return {
        status: 'skipped',
        testAddress: null,
        smtpStatus: 'skipped',
        confidence: 'high',
      };
    }

    if (!context.domain) {
      return null;
    }

    const randomSuffix = randomBytes(4).toString('hex'); // 8 chars
    const testLocalPart = `${config.catchAllRandomPrefix}-${randomSuffix}`;
    const testEmail = `${testLocalPart}@${context.domain}`;

    this.logger.debug(
      `Queueing catch-all test for ${context.domain} using ${testEmail}`,
    );

    try {
      const signal = await this.smtpQueue.enqueue(
        testEmail,
        context.domain,
        mxHost,
        providerResult,
      );

      let catchAllStatus: CatchAllSignal['status'] = 'unknown';
      let confidence: CatchAllSignal['confidence'] = 'low';

      switch (signal.status) {
        case 'accepted':
          // The domain accepted a random address. It's highly likely a catch-all.
          catchAllStatus = 'detected';
          confidence = 'high';
          break;
        case 'rejected':
          // The domain rejected the random address. It's not a catch-all.
          catchAllStatus = 'not_detected';
          confidence = 'high';
          break;
        case 'blocked':
        case 'connection_failed':
        case 'tempfail':
        case 'timeout':
        case 'unknown':
          catchAllStatus = 'unknown';
          confidence = 'low';
          break;
      }

      return {
        status: catchAllStatus,
        testAddress: testEmail,
        smtpStatus: signal.status,
        confidence,
      };
    } catch (error: any) {
      this.logger.error(
        `Catch-all check failed for ${context.domain}: ${error.message}`,
      );
      return {
        status: 'unknown',
        testAddress: testEmail,
        smtpStatus: 'unknown',
        confidence: 'low',
      };
    }
  }
}
