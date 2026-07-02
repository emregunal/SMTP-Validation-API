import { SmtpQueueService } from './smtp-queue.service';
import { ConfigService } from '@nestjs/config';
import { SmtpValidatorService } from './smtp-validator.service';
import { CooldownService } from './cooldown.service';
import { SmtpRetryPolicyService } from './smtp-retry-policy.service';
import { SmtpSignal } from '../../common/types/validation.types';

describe('SmtpQueueService', () => {
  let service: SmtpQueueService;
  let configService: jest.Mocked<ConfigService>;
  let smtpValidator: jest.Mocked<SmtpValidatorService>;
  let cooldownService: jest.Mocked<CooldownService>;
  let retryPolicy: jest.Mocked<SmtpRetryPolicyService>;

  beforeEach(() => {
    configService = { get: jest.fn() } as any;
    smtpValidator = {
      validate: jest.fn().mockResolvedValue({ status: 'skipped' }),
    } as any;
    cooldownService = {
      isCoolingDown: jest.fn(),
      setCooldown: jest.fn(),
    } as any;
    retryPolicy = { evaluate: jest.fn() } as any;

    configService.get.mockReturnValue({
      globalConcurrency: 2,
      domainConcurrency: 1,
      providerConcurrencyDefault: 2,
      providerConcurrencyGmail: 1,
      providerConcurrencyOutlook: 1,
      providerConcurrencyYahoo: 1,
      maxRetries: 1,
      retryBackoffMs: 1000,
      providerCooldownMs: 5000,
      domainCooldownMs: 5000,
    });

    service = new SmtpQueueService(
      configService,
      smtpValidator,
      cooldownService,
      retryPolicy,
    );

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('processes a single item immediately', async () => {
    const mockSignal: SmtpSignal = {
      status: 'accepted',
      code: 250,
      enhancedCode: null,
      message: null,
      provider: 'gmail',
      providerRiskProfile: 'strict',
      mxHost: 'mx',
      durationMs: 10,
    };
    smtpValidator.validate.mockResolvedValueOnce(mockSignal);
    retryPolicy.evaluate.mockReturnValueOnce({
      shouldRetry: false,
      applyCooldown: false,
      reason: '',
    });
    cooldownService.isCoolingDown.mockReturnValue(false);

    const promise = service.enqueue('user@gmail.com', 'gmail.com', 'mx', {
      provider: 'gmail',
      riskProfile: 'strict',
    });

    // Resolve any pending promises in the queue processing loop
    await Promise.resolve();

    const result = await promise;
    expect(result).toEqual(mockSignal);
    expect(smtpValidator.validate).toHaveBeenCalledTimes(1);
  });

  it('respects domain concurrency limit', async () => {
    let resolveFirst: any;
    smtpValidator.validate.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveFirst = res;
        }),
    );

    const promise1 = service.enqueue('user1@example.com', 'example.com', 'mx', {
      provider: 'corporate',
      riskProfile: 'relaxed',
    });

    // Process first item
    await Promise.resolve();

    // Enqueue second item for SAME domain. It should be queued because domainConcurrency=1
    // Queued for the same domain to exercise domainConcurrency=1; result unused.
    void service.enqueue('user2@example.com', 'example.com', 'mx', {
      provider: 'corporate',
      riskProfile: 'relaxed',
    });

    await Promise.resolve();

    expect(smtpValidator.validate).toHaveBeenCalledTimes(1);

    // Resolve first item
    const mockSignal: SmtpSignal = {
      status: 'accepted',
      code: 250,
      enhancedCode: null,
      message: null,
      provider: 'corporate',
      providerRiskProfile: 'relaxed',
      mxHost: 'mx',
      durationMs: 10,
    };
    retryPolicy.evaluate.mockReturnValue({
      shouldRetry: false,
      applyCooldown: false,
      reason: '',
    });
    resolveFirst(mockSignal);

    await promise1;
    await Promise.resolve(); // Allow processQueue to run for the next item

    // Now validate should be called for the second item
    expect(smtpValidator.validate).toHaveBeenCalledTimes(2);
  });

  it('handles retries with backoff', async () => {
    const tempfailSignal: SmtpSignal = {
      status: 'tempfail',
      code: 450,
      enhancedCode: null,
      message: null,
      provider: 'gmail',
      providerRiskProfile: 'strict',
      mxHost: 'mx',
      durationMs: 10,
    };
    const successSignal: SmtpSignal = {
      ...tempfailSignal,
      status: 'accepted',
      code: 250,
    };

    smtpValidator.validate
      .mockResolvedValueOnce(tempfailSignal)
      .mockResolvedValueOnce(successSignal);

    retryPolicy.evaluate
      .mockReturnValueOnce({
        shouldRetry: true,
        applyCooldown: false,
        reason: 'Retry',
      })
      .mockReturnValueOnce({
        shouldRetry: false,
        applyCooldown: false,
        reason: 'Done',
      });

    const promise = service.enqueue('user@gmail.com', 'gmail.com', 'mx', {
      provider: 'gmail',
      riskProfile: 'strict',
    });

    // Process initial
    await Promise.resolve();

    // It should have failed and scheduled a retry in 1000ms
    expect(smtpValidator.validate).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();

    expect(smtpValidator.validate).toHaveBeenCalledTimes(2);

    const result = await promise;
    expect(result.status).toBe('accepted');
  });

  it('applies cooldown and rejects immediately if in cooldown', async () => {
    cooldownService.isCoolingDown.mockReturnValue(true);

    // Rejected immediately due to cooldown; result intentionally unused.
    void service
      .enqueue('user@gmail.com', 'gmail.com', 'mx', {
        provider: 'gmail',
        riskProfile: 'strict',
      })
      .catch(() => undefined);
    await Promise.resolve();

    // It shouldn't even call validate
    expect(smtpValidator.validate).not.toHaveBeenCalled();
  });
});
