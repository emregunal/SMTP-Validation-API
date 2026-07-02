import { CatchAllDetectionService } from './catch-all-detection.service';
import { ConfigService } from '@nestjs/config';
import { SmtpQueueService } from './smtp-queue.service';
import {
  ValidationContext,
  SmtpSignal,
} from '../../common/types/validation.types';

describe('CatchAllDetectionService', () => {
  let service: CatchAllDetectionService;
  let configService: jest.Mocked<ConfigService>;
  let smtpQueue: jest.Mocked<SmtpQueueService>;

  beforeEach(() => {
    configService = { get: jest.fn() } as any;
    smtpQueue = { enqueue: jest.fn() } as any;

    configService.get.mockReturnValue({
      enabled: true,
      catchAllCheckEnabled: true,
      catchAllRandomPrefix: 'verify',
      catchAllSkipProviders: ['gmail', 'yahoo'],
      catchAllTimeoutMs: 8000,
    });

    service = new CatchAllDetectionService(configService, smtpQueue);
  });

  it('returns null if check is disabled', async () => {
    configService.get.mockReturnValue({
      enabled: true,
      catchAllCheckEnabled: false,
    });
    const result = await service.detect(
      { domain: 'example.com' } as ValidationContext,
      'mx',
      { provider: 'corporate', riskProfile: 'unknown' },
    );
    expect(result).toBeNull();
  });

  it('returns skipped if provider is in skip list', async () => {
    const result = await service.detect(
      { domain: 'example.com' } as ValidationContext,
      'mx',
      { provider: 'gmail', riskProfile: 'strict' },
    );
    expect(result?.status).toBe('skipped');
    expect(smtpQueue.enqueue).not.toHaveBeenCalled();
  });

  it('returns detected if random address is accepted', async () => {
    smtpQueue.enqueue.mockResolvedValue({ status: 'accepted' } as SmtpSignal);

    const result = await service.detect(
      { domain: 'example.com' } as ValidationContext,
      'mx',
      { provider: 'corporate', riskProfile: 'relaxed' },
    );

    expect(result?.status).toBe('detected');
    expect(result?.confidence).toBe('high');
    expect(result?.smtpStatus).toBe('accepted');
    expect(result?.testAddress).toMatch(/^verify-[a-f0-9]{8}@example\.com$/);
  });

  it('returns not_detected if random address is rejected', async () => {
    smtpQueue.enqueue.mockResolvedValue({ status: 'rejected' } as SmtpSignal);

    const result = await service.detect(
      { domain: 'example.com' } as ValidationContext,
      'mx',
      { provider: 'corporate', riskProfile: 'relaxed' },
    );

    expect(result?.status).toBe('not_detected');
    expect(result?.confidence).toBe('high');
    expect(result?.smtpStatus).toBe('rejected');
  });

  it('returns unknown if random address gets tempfail', async () => {
    smtpQueue.enqueue.mockResolvedValue({ status: 'tempfail' } as SmtpSignal);

    const result = await service.detect(
      { domain: 'example.com' } as ValidationContext,
      'mx',
      { provider: 'corporate', riskProfile: 'relaxed' },
    );

    expect(result?.status).toBe('unknown');
    expect(result?.confidence).toBe('low');
    expect(result?.smtpStatus).toBe('tempfail');
  });
});
