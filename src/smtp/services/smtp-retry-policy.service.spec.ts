import { SmtpRetryPolicyService } from './smtp-retry-policy.service';

describe('SmtpRetryPolicyService', () => {
  const service = new SmtpRetryPolicyService();

  it('does not retry accepted/rejected', () => {
    expect(service.evaluate('accepted', 0, 1).shouldRetry).toBe(false);
    expect(service.evaluate('rejected', 0, 1).shouldRetry).toBe(false);
  });

  it('does not retry and applies cooldown for blocked', () => {
    const result = service.evaluate('blocked', 0, 1);
    expect(result.shouldRetry).toBe(false);
    expect(result.applyCooldown).toBe(true);
  });

  it('retries tempfails and timeouts', () => {
    expect(service.evaluate('tempfail', 0, 1).shouldRetry).toBe(true);
    expect(service.evaluate('timeout', 0, 1).shouldRetry).toBe(true);
    expect(service.evaluate('connection_failed', 0, 1).shouldRetry).toBe(true);
  });

  it('respects max retries', () => {
    // Current attempt is 1, max is 1
    const result = service.evaluate('tempfail', 1, 1);
    expect(result.shouldRetry).toBe(false);
    expect(result.reason).toContain('Max retries exceeded');
  });
});
