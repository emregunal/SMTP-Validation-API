import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EmailStatus } from '../common/enums/email-status.enum';
import { EmailSubStatus } from '../common/enums/email-sub-status.enum';
import { DnsLookupResult } from '../common/types/validation.types';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationRepository } from './repositories/validation.repository';
import { DisposableDomainService } from './services/disposable-domain.service';
import { DnsValidatorService } from './services/dns-validator.service';
import { DomainParserService } from './services/domain-parser.service';
import { EmailNormalizerService } from './services/email-normalizer.service';
import { MxLookupService } from './services/mx-lookup.service';
import { NullMxService } from './services/null-mx.service';
import { RiskScoringService } from './services/risk-scoring.service';
import { RoleBasedDetectorService } from './services/role-based-detector.service';
import { SyntaxValidatorService } from './services/syntax-validator.service';
import { TypoSuggestionService } from './services/typo-suggestion.service';
import { ValidationResultMapperService } from './services/validation-result-mapper.service';
import { ValidationService } from './validation.service';
import { SmtpQueueService } from '../smtp/services/smtp-queue.service';
import { ProviderDetectionService } from '../smtp/services/provider-detection.service';
import { CatchAllDetectionService } from '../smtp/services/catch-all-detection.service';
import { DomainBehaviorService } from '../smtp/services/domain-behavior.service';
import { BounceService } from '../bounce/services/bounce.service';

const mxFoundDns: DnsLookupResult = {
  dnsFound: true,
  mxFound: true,
  nullMx: false,
  mxRecords: [{ exchange: 'mx.example.com', priority: 10 }],
  aRecords: [],
  aaaaRecords: [],
  timedOut: false,
  error: false,
};

describe('ValidationService (integration)', () => {
  let service: ValidationService;
  let dnsMock: { lookup: jest.Mock };
  let findUnique: jest.Mock;
  let smtpQueueMock: { enqueue: jest.Mock };
  let providerDetectionMock: { detect: jest.Mock };
  let catchAllDetectionMock: { detect: jest.Mock };
  let domainBehaviorMock: {
    getBehavior: jest.Mock;
    updateFromSmtp: jest.Mock;
    setCooldown: jest.Mock;
    markCatchAll: jest.Mock;
  };
  let bounceServiceMock: { getReputation: jest.Mock };

  beforeEach(async () => {
    dnsMock = { lookup: jest.fn().mockResolvedValue(mxFoundDns) };
    smtpQueueMock = {
      enqueue: jest.fn().mockResolvedValue({ status: 'skipped' }),
    };
    providerDetectionMock = {
      detect: jest
        .fn()
        .mockReturnValue({ provider: 'unknown', riskProfile: 'unknown' }),
    };
    catchAllDetectionMock = { detect: jest.fn().mockResolvedValue(null) };
    domainBehaviorMock = {
      getBehavior: jest.fn().mockResolvedValue(null),
      updateFromSmtp: jest.fn().mockResolvedValue(undefined),
      setCooldown: jest.fn().mockResolvedValue(undefined),
      markCatchAll: jest.fn().mockResolvedValue(undefined),
    };
    bounceServiceMock = { getReputation: jest.fn().mockResolvedValue(null) };
    findUnique = jest.fn();

    // Minimal in-memory Prisma stand-in.
    const prismaMock = {
      validationRequest: {
        create: jest.fn(async ({ data }: any) => {
          const createdAt = new Date('2026-07-01T12:00:00.000Z');
          const resultData = data.result?.create ?? null;
          return {
            id: 'test-uuid',
            email: data.email,
            normalizedEmail: data.normalizedEmail,
            status: data.status,
            subStatus: data.subStatus,
            risk: data.risk,
            score: data.score,
            reason: data.reason,
            createdAt,
            result: resultData
              ? {
                  id: 'result-uuid',
                  requestId: 'test-uuid',
                  createdAt,
                  updatedAt: createdAt,
                  ...resultData,
                }
              : null,
          };
        }),
        findUnique,
        findMany: jest.fn(async () => []),
      },
      disposableDomain: { findMany: jest.fn(async () => []) },
      roleBasedPrefix: { findMany: jest.fn(async () => []) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
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
        { provide: DnsValidatorService, useValue: dnsMock },
        { provide: SmtpQueueService, useValue: smtpQueueMock },
        { provide: ProviderDetectionService, useValue: providerDetectionMock },
        { provide: CatchAllDetectionService, useValue: catchAllDetectionMock },
        { provide: DomainBehaviorService, useValue: domainBehaviorMock },
        { provide: BounceService, useValue: bounceServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = moduleRef.get(ValidationService);
  });

  it('rejects invalid syntax without a DNS lookup', async () => {
    const result = await service.validateSingle('invalid-email');
    expect(result.status).toBe(EmailStatus.UNDELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.FAILED_SYNTAX_CHECK);
    expect(dnsMock.lookup).not.toHaveBeenCalled();
  });

  it('flags disposable domains without a DNS lookup', async () => {
    const result = await service.validateSingle('disposable@mailinator.com');
    expect(result.status).toBe(EmailStatus.DO_NOT_MAIL);
    expect(result.subStatus).toBe(EmailSubStatus.DISPOSABLE);
    expect(result.checks.disposable).toBe(true);
    expect(dnsMock.lookup).not.toHaveBeenCalled();
  });

  it('suggests a correction for a typo domain', async () => {
    const result = await service.validateSingle('user@gmial.com');
    expect(result.subStatus).toBe(EmailSubStatus.POSSIBLE_TYPO);
    expect(result.suggestion.didYouMean).toBe('user@gmail.com');
    expect(result.checks.typoDetected).toBe(true);
  });

  it('flags role-based addresses as risky', async () => {
    const result = await service.validateSingle('admin@example.com');
    expect(result.status).toBe(EmailStatus.RISKY);
    expect(result.subStatus).toBe(EmailSubStatus.ROLE_BASED);
    expect(result.checks.roleBased).toBe(true);
  });

  it('marks a normal address with MX as deliverable', async () => {
    const result = await service.validateSingle('emre@example.com');
    expect(result.status).toBe(EmailStatus.DELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.MX_FOUND);
    expect(result.checks.mxFound).toBe(true);
    expect(result.reason).toContain(
      'SMTP check might be skipped if not enabled',
    );
  });

  it('reports no_dns_entries when the domain does not resolve', async () => {
    dnsMock.lookup.mockResolvedValueOnce({
      dnsFound: false,
      mxFound: false,
      nullMx: false,
      mxRecords: [],
      aRecords: [],
      aaaaRecords: [],
      timedOut: false,
      error: false,
    });
    const result = await service.validateSingle('noone123@xyzfakedomain99.com');
    expect(result.status).toBe(EmailStatus.UNDELIVERABLE);
    expect(result.subStatus).toBe(EmailSubStatus.NO_DNS_ENTRIES);
  });

  it('throws NotFoundException for an unknown history id', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(
      service.getById('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
