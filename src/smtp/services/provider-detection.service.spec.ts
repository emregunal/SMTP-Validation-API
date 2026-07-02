import { ProviderDetectionService } from './provider-detection.service';

describe('ProviderDetectionService', () => {
  const service = new ProviderDetectionService();

  it('detects gmail', () => {
    const result = service.detect('gmail-smtp-in.l.google.com');
    expect(result.provider).toBe('gmail');
    expect(result.riskProfile).toBe('strict');
  });

  it('detects google_workspace', () => {
    const result = service.detect('aspmx.l.google.com');
    expect(result.provider).toBe('google_workspace');
    expect(result.riskProfile).toBe('strict');
  });

  it('detects microsoft_365', () => {
    const result = service.detect('test-com.mail.protection.outlook.com');
    expect(result.provider).toBe('microsoft_365');
    expect(result.riskProfile).toBe('strict');
  });

  it('detects outlook', () => {
    const result = service.detect('hotmail-com.olc.protection.outlook.com');
    expect(result.provider).toBe('outlook');
    expect(result.riskProfile).toBe('strict');
  });

  it('detects yahoo', () => {
    const result = service.detect('mta5.am0.yahoodns.net');
    expect(result.provider).toBe('yahoo');
    expect(result.riskProfile).toBe('moderate');
  });

  it('detects yandex', () => {
    const result = service.detect('mx.yandex.ru');
    expect(result.provider).toBe('yandex');
    expect(result.riskProfile).toBe('moderate');
  });

  it('detects zoho', () => {
    const result = service.detect('mx.zoho.com');
    expect(result.provider).toBe('zoho');
    expect(result.riskProfile).toBe('moderate');
  });

  it('detects enterprise_gateway', () => {
    const result = service.detect('mxa-001c1.proofpoint.com');
    expect(result.provider).toBe('enterprise_gateway');
    expect(result.riskProfile).toBe('strict');
  });

  it('falls back to corporate if unknown mx host', () => {
    const result = service.detect('mx.unknowncorp.com');
    expect(result.provider).toBe('corporate');
    expect(result.riskProfile).toBe('relaxed');
  });

  it('uses domainInfo to fallback to free_email', () => {
    const result = service.detect('mx.unknownfree.com', {
      freeEmail: true,
      corporateEmail: false,
      localPart: 'user',
      domain: 'unknownfree.com',
      tld: 'com',
      isSubdomain: false,
    });
    expect(result.provider).toBe('free_email');
    expect(result.riskProfile).toBe('relaxed');
  });
});
