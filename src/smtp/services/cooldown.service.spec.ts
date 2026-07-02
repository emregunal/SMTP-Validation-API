import { CooldownService } from './cooldown.service';

describe('CooldownService', () => {
  let service: CooldownService;

  beforeEach(() => {
    service = new CooldownService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initially has no cooldown', () => {
    expect(service.isCoolingDown('test-domain')).toBe(false);
  });

  it('sets and checks cooldown correctly', () => {
    service.setCooldown('test-domain', 5000);
    expect(service.isCoolingDown('test-domain')).toBe(true);

    // Fast forward 4999ms
    jest.advanceTimersByTime(4999);
    expect(service.isCoolingDown('test-domain')).toBe(true);

    // Fast forward 2ms to pass expiration
    jest.advanceTimersByTime(2);
    expect(service.isCoolingDown('test-domain')).toBe(false);
  });

  it('differentiates between keys', () => {
    service.setCooldown('gmail', 10000);
    service.setCooldown('outlook', 5000);

    expect(service.isCoolingDown('gmail')).toBe(true);
    expect(service.isCoolingDown('outlook')).toBe(true);

    jest.advanceTimersByTime(6000);

    expect(service.isCoolingDown('gmail')).toBe(true);
    expect(service.isCoolingDown('outlook')).toBe(false);
  });
});
