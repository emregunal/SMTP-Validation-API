import { InMemoryDomainBehaviorRepository } from './in-memory-domain-behavior.repository';
import { DomainBehavior } from '../../common/types/validation.types';

describe('InMemoryDomainBehaviorRepository', () => {
  let repository: InMemoryDomainBehaviorRepository;
  const mockBehavior: DomainBehavior = {
    domain: 'example.com',
    provider: 'corporate',
    mxCluster: 'mx1.example.com',
    lastSeenAt: '2026-07-01T12:00:00Z',
    acceptRate7d: 0,
    rejectRate7d: 0,
    tempfailRate7d: 0,
    timeoutRate7d: 0,
    policyBlockRate7d: 0,
    catchAllObserved: false,
    medianLatencyMs7d: 0,
    cooldownUntil: null,
  };

  beforeEach(() => {
    repository = new InMemoryDomainBehaviorRepository();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves and retrieves behavior', async () => {
    await repository.set('example.com', mockBehavior, 1000);
    const result = await repository.get('example.com');
    expect(result).toEqual(mockBehavior);
  });

  it('returns null for unknown domain', async () => {
    const result = await repository.get('unknown.com');
    expect(result).toBeNull();
  });

  it('returns null if ttl expires', async () => {
    await repository.set('example.com', mockBehavior, 1000);
    jest.advanceTimersByTime(1001);
    const result = await repository.get('example.com');
    expect(result).toBeNull();
  });

  it('deletes behavior', async () => {
    await repository.set('example.com', mockBehavior, 1000);
    await repository.delete('example.com');
    const result = await repository.get('example.com');
    expect(result).toBeNull();
  });
});
