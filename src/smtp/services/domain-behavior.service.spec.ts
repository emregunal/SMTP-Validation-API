import { DomainBehaviorService } from './domain-behavior.service';
import { DomainBehaviorRepository } from '../repositories/domain-behavior.repository.interface';
import { ConfigService } from '@nestjs/config';

describe('DomainBehaviorService', () => {
  let service: DomainBehaviorService;
  let repository: jest.Mocked<DomainBehaviorRepository>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    repository = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn().mockReturnValue({
        domainBehaviorCacheEnabled: true,
        domainBehaviorCacheTtlMs: 1000,
      }),
    } as any;

    service = new DomainBehaviorService(repository, configService);
  });

  it('gets behavior when enabled', async () => {
    const mockBehavior = { domain: 'example.com' } as any;
    repository.get.mockResolvedValue(mockBehavior);

    const result = await service.getBehavior('example.com');
    expect(result).toBe(mockBehavior);
  });

  it('returns null when cache is disabled', async () => {
    configService.get.mockReturnValue({ domainBehaviorCacheEnabled: false });
    const result = await service.getBehavior('example.com');
    expect(result).toBeNull();
    expect(repository.get).not.toHaveBeenCalled();
  });

  it('creates and sets default behavior on first update', async () => {
    await service.updateFromSmtp(
      'example.com',
      'corporate',
      'mx.example.com',
      'tempfail',
      150,
    );

    expect(repository.set).toHaveBeenCalledTimes(1);
    const [domain, behavior] = repository.set.mock.calls[0];

    expect(domain).toBe('example.com');
    expect(behavior.tempfailRate7d).toBeGreaterThan(0); // EWMA applied
    expect(behavior.acceptRate7d).toBe(0);
    expect(behavior.provider).toBe('corporate');
  });

  it('updates existing behavior', async () => {
    const existing = {
      domain: 'example.com',
      provider: 'corporate' as any,
      mxCluster: 'mx.example.com',
      lastSeenAt: 'old',
      acceptRate7d: 0.5,
      rejectRate7d: 0,
      tempfailRate7d: 0,
      timeoutRate7d: 0,
      policyBlockRate7d: 0,
      catchAllObserved: false,
      medianLatencyMs7d: 100,
      cooldownUntil: null,
    };
    repository.get.mockResolvedValue(existing);

    await service.updateFromSmtp(
      'example.com',
      'corporate',
      'mx.example.com',
      'accepted',
      100,
    );

    const [, behavior] = repository.set.mock.calls[0];
    expect(behavior.acceptRate7d).toBeGreaterThan(0.5); // EWMA should increase this
    expect(behavior.lastSeenAt).not.toBe('old');
  });

  it('marks catch-all correctly', async () => {
    await service.markCatchAll('example.com', 'corporate', 'mx');

    const [, behavior] = repository.set.mock.calls[0];
    expect(behavior.catchAllObserved).toBe(true);
  });

  it('sets cooldown correctly', async () => {
    const future = Date.now() + 5000;
    await service.setCooldown('example.com', 'corporate', 'mx', future);

    const [, behavior] = repository.set.mock.calls[0];
    expect(new Date(behavior.cooldownUntil!).getTime()).toBe(future);
  });
});
