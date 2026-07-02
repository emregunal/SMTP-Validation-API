import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmtpResponseParser } from './services/smtp-response-parser';
import { SmtpValidatorService } from './services/smtp-validator.service';
import { ProviderDetectionService } from './services/provider-detection.service';
import { CooldownService } from './services/cooldown.service';
import { SmtpRetryPolicyService } from './services/smtp-retry-policy.service';
import { SmtpQueueService } from './services/smtp-queue.service';
import { CatchAllDetectionService } from './services/catch-all-detection.service';
import { DomainBehaviorService } from './services/domain-behavior.service';
import { InMemoryDomainBehaviorRepository } from './repositories/in-memory-domain-behavior.repository';
import { DOMAIN_BEHAVIOR_REPOSITORY_TOKEN } from './repositories/domain-behavior.repository.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    SmtpResponseParser,
    SmtpValidatorService,
    ProviderDetectionService,
    CooldownService,
    SmtpRetryPolicyService,
    SmtpQueueService,
    CatchAllDetectionService,
    DomainBehaviorService,
    {
      provide: DOMAIN_BEHAVIOR_REPOSITORY_TOKEN,
      useClass: InMemoryDomainBehaviorRepository,
    },
  ],
  exports: [
    SmtpQueueService,
    ProviderDetectionService,
    CatchAllDetectionService,
    DomainBehaviorService,
  ],
})
export class SmtpModule {}
