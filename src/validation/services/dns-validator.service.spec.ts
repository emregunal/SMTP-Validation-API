import { ConfigService } from '@nestjs/config';
import { promises as dns } from 'node:dns';
import { DnsValidatorService } from './dns-validator.service';
import { MxLookupService } from './mx-lookup.service';
import { NullMxService } from './null-mx.service';

jest.mock('node:dns', () => ({
  promises: {
    resolveMx: jest.fn(),
    resolve4: jest.fn(),
    resolve6: jest.fn(),
  },
}));

const resolveMx = dns.resolveMx as jest.Mock;
const resolve4 = dns.resolve4 as jest.Mock;
const resolve6 = dns.resolve6 as jest.Mock;

function errno(code: string): NodeJS.ErrnoException {
  const err = new Error(code) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

describe('DnsValidatorService', () => {
  let service: DnsValidatorService;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      get: () => 5000,
    } as unknown as ConfigService;
    service = new DnsValidatorService(
      config,
      new MxLookupService(),
      new NullMxService(),
    );
  });

  it('reports mxFound when MX records exist', async () => {
    resolveMx.mockResolvedValue([
      { exchange: 'alt.mx.example.com', priority: 20 },
      { exchange: 'mx.example.com', priority: 10 },
    ]);
    resolve4.mockResolvedValue(['1.2.3.4']);
    resolve6.mockRejectedValue(errno('ENODATA'));

    const result = await service.lookup('example.com');

    expect(result.mxFound).toBe(true);
    expect(result.dnsFound).toBe(true);
    expect(result.nullMx).toBe(false);
    // sorted ascending by priority
    expect(result.mxRecords[0].priority).toBe(10);
  });

  it('detects null MX', async () => {
    resolveMx.mockResolvedValue([{ exchange: '.', priority: 0 }]);
    resolve4.mockRejectedValue(errno('ENODATA'));
    resolve6.mockRejectedValue(errno('ENODATA'));

    const result = await service.lookup('nomail.example.com');

    expect(result.nullMx).toBe(true);
    expect(result.mxFound).toBe(false);
    expect(result.dnsFound).toBe(true);
  });

  it('reports no DNS entries on NXDOMAIN (not an error)', async () => {
    resolveMx.mockRejectedValue(errno('ENOTFOUND'));
    resolve4.mockRejectedValue(errno('ENOTFOUND'));
    resolve6.mockRejectedValue(errno('ENOTFOUND'));

    const result = await service.lookup('xyzfakedomain99.com');

    expect(result.dnsFound).toBe(false);
    expect(result.error).toBe(false);
    expect(result.timedOut).toBe(false);
  });

  it('flags an error on server failure (ESERVFAIL)', async () => {
    resolveMx.mockRejectedValue(errno('ESERVFAIL'));
    resolve4.mockRejectedValue(errno('ENOTFOUND'));
    resolve6.mockRejectedValue(errno('ENOTFOUND'));

    const result = await service.lookup('broken.example.com');

    expect(result.error).toBe(true);
  });
});
