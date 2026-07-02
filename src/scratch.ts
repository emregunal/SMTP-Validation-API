import { Test } from '@nestjs/testing';
import { BounceService } from './bounce/services/bounce.service';
import { ValidationService } from './validation/validation.service';
import { ValidationRepository } from './validation/repositories/validation.repository';
import { PrismaService } from './prisma/prisma.service';
import { EmailNormalizerService } from './validation/services/email-normalizer.service';
import { SyntaxValidatorService } from './validation/services/syntax-validator.service';
import { DomainParserService } from './validation/services/domain-parser.service';
import { DisposableDomainService } from './validation/services/disposable-domain.service';
import { RoleBasedDetectorService } from './validation/services/role-based-detector.service';
import { TypoSuggestionService } from './validation/services/typo-suggestion.service';
import { RiskScoringService } from './validation/services/risk-scoring.service';
import { ValidationResultMapperService } from './validation/services/validation-result-mapper.service';
import { MxLookupService } from './validation/services/mx-lookup.service';
import { NullMxService } from './validation/services/null-mx.service';
import { DnsValidatorService } from './validation/services/dns-validator.service';
import { SmtpQueueService } from './smtp/services/smtp-queue.service';
import { ProviderDetectionService } from './smtp/services/provider-detection.service';
import { CatchAllDetectionService } from './smtp/services/catch-all-detection.service';
import { DomainBehaviorService } from './smtp/services/domain-behavior.service';
import { BOUNCE_EVENT_REPOSITORY } from './bounce/repositories/bounce-event.repository.interface';
import { InMemoryBounceEventRepository } from './bounce/repositories/in-memory-bounce-event.repository';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const testEmails = [
    'kontakt@123it.sk',
    'info@2cosyliving.sk',
    'help@trade.sk',
  ];

  const prismaMock = {
    validationRequest: {
      create: async ({ data }: any) => {
        const createdAt = new Date();
        const resultData = data.result?.create ?? null;
        return {
          id: 'mock-id',
          email: data.email,
          normalizedEmail: data.normalizedEmail,
          status: data.status,
          subStatus: data.subStatus,
          risk: data.risk,
          score: data.score,
          reason: data.reason,
          createdAt,
          result: resultData
            ? { ...resultData, createdAt, updatedAt: createdAt }
            : null,
        };
      },
      findUnique: async () => null,
      findMany: async () => [],
    },
    disposableDomain: { findMany: async () => [] },
    roleBasedPrefix: { findMany: async () => [] },
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      BounceService,
      {
        provide: BOUNCE_EVENT_REPOSITORY,
        useClass: InMemoryBounceEventRepository,
      },
      ValidationService,
      ValidationRepository,
      EmailNormalizerService,
      SyntaxValidatorService,
      DomainParserService,
      DisposableDomainService,
      RoleBasedDetectorService,
      TypoSuggestionService,
      RiskScoringService,
      ValidationResultMapperService,
      MxLookupService,
      NullMxService,
      {
        provide: DnsValidatorService,
        useValue: {
          lookup: async () => ({
            dnsFound: true,
            mxFound: true,
            mxRecords: [{ exchange: 'mail.google.com', priority: 10 }],
            aRecords: [],
            aaaaRecords: [],
          }),
        },
      },
      {
        provide: SmtpQueueService,
        useValue: { enqueue: async () => ({ status: 'skipped' }) },
      },
      ProviderDetectionService,
      {
        provide: CatchAllDetectionService,
        useValue: { detect: async () => null },
      },
      {
        provide: DomainBehaviorService,
        useValue: {
          getBehavior: async () => null,
          updateFromSmtp: async () => {},
          setCooldown: async () => {},
          markCatchAll: async () => {},
        },
      },
      { provide: PrismaService, useValue: prismaMock },
      { provide: ConfigService, useValue: { get: () => 5000 } },
    ],
  }).compile();

  const bounceService = moduleRef.get(BounceService);
  const validationService = moduleRef.get(ValidationService);

  console.log('\n======================================================');
  console.log(' ADIM 1: SİSTEMDE HİÇBİR BOUNCE GEÇMİŞİ YOKKEN (İLK DOĞRULAMA)');
  console.log('======================================================');
  for (const email of testEmails) {
    const result = await validationService.validateSingle(email);
    console.log(`\nEmail: ${email}`);
    console.log(
      `Status: ${result.status} | SubStatus: ${result.subStatus} | Risk: ${result.risk} | Score: ${result.score}`,
    );
    console.log(`Sebep: ${result.reason}`);
    console.log(`History Signal: ${JSON.stringify(result.checks?.history)}`);
  }

  console.log('\n======================================================');
  console.log(' ADIM 2: CSV DOSYASINDAN BOUNCE VERİLERİ YÜKLENİYOR');
  console.log('======================================================');
  for (const email of testEmails) {
    await bounceService.processEvent({
      email,
      eventType: 'hard_bounce',
      occurredAt: new Date().toISOString(),
      reason: 'from_csv_import',
    });
    console.log(`> ${email} için HARD BOUNCE event'i kaydedildi.`);
  }

  console.log('\n======================================================');
  console.log(' ADIM 3: AYNI ADRESLER TEKRAR DOĞRULANIYOR');
  console.log('======================================================');
  for (const email of testEmails) {
    const result = await validationService.validateSingle(email);
    console.log(`\nEmail: ${email}`);
    console.log(
      `Status: ${result.status} | SubStatus: ${result.subStatus} | Risk: ${result.risk} | Score: ${result.score}`,
    );
    console.log(`Sebep: ${result.reason}`);
    console.log(`History Signal: ${JSON.stringify(result.checks?.history)}`);
    // console.dir(result, { depth: null });
  }
}

bootstrap();
