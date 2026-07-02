import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as dns } from 'node:dns';
import { DnsLookupResult, MxRecord } from '../../common/types/validation.types';
import { MxLookupService } from './mx-lookup.service';
import { NullMxService } from './null-mx.service';

class DnsTimeoutError extends Error {
  constructor() {
    super('DNS lookup timed out');
    this.name = 'DnsTimeoutError';
  }
}

interface ResolveOutcome<T> {
  records: T[];
  timedOut: boolean;
  error: boolean;
}

/**
 * Resolves MX / A / AAAA records for a domain using Node's `dns.promises`.
 *
 * Every lookup is wrapped in a timeout and try/catch so a slow or broken DNS
 * response can never crash a request — it surfaces as `timedOut`/`error`, which
 * the risk scorer maps to an `unknown` result.
 */
@Injectable()
export class DnsValidatorService {
  private readonly logger = new Logger(DnsValidatorService.name);
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly mxLookup: MxLookupService,
    private readonly nullMx: NullMxService,
  ) {
    this.timeoutMs = this.configService.get<number>('app.dnsTimeoutMs') ?? 5000;
  }

  async lookup(domain: string): Promise<DnsLookupResult> {
    const [mxOutcome, aOutcome, aaaaOutcome] = await Promise.all([
      this.safeResolve<{ exchange: string; priority: number }>(() =>
        dns.resolveMx(domain),
      ),
      this.safeResolve<string>(() => dns.resolve4(domain)),
      this.safeResolve<string>(() => dns.resolve6(domain)),
    ]);

    const mxRecords: MxRecord[] = this.mxLookup.sortByPriority(
      mxOutcome.records.map((r) => ({
        exchange: r.exchange,
        priority: r.priority,
      })),
    );

    const nullMx = this.nullMx.isNullMx(mxRecords);
    const mxFound = mxRecords.length > 0 && !nullMx;

    const dnsFound =
      mxRecords.length > 0 ||
      aOutcome.records.length > 0 ||
      aaaaOutcome.records.length > 0;

    return {
      dnsFound,
      mxFound,
      nullMx,
      mxRecords,
      aRecords: aOutcome.records,
      aaaaRecords: aaaaOutcome.records,
      timedOut: mxOutcome.timedOut || aOutcome.timedOut || aaaaOutcome.timedOut,
      error: mxOutcome.error || aOutcome.error || aaaaOutcome.error,
    };
  }

  private async safeResolve<T>(
    op: () => Promise<T[]>,
  ): Promise<ResolveOutcome<T>> {
    try {
      const records = await this.withTimeout(op());
      return { records, timedOut: false, error: false };
    } catch (err) {
      if (err instanceof DnsTimeoutError) {
        this.logger.warn('DNS lookup timed out');
        return { records: [], timedOut: true, error: false };
      }

      const code = (err as NodeJS.ErrnoException).code;
      // NXDOMAIN / no records for this type are expected "empty" answers,
      // not failures.
      if (code === 'ENOTFOUND' || code === 'ENODATA') {
        return { records: [], timedOut: false, error: false };
      }

      // ESERVFAIL, ETIMEOUT, EREFUSED, ... => genuine lookup problem.
      this.logger.warn(`DNS lookup error (${code ?? 'unknown'})`);
      return { records: [], timedOut: false, error: true };
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new DnsTimeoutError()), this.timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => {
      clearTimeout(timer);
    }) as Promise<T>;
  }
}
