import { Injectable } from '@nestjs/common';
import { MxRecord } from '../../common/types/validation.types';

/**
 * Detects a "null MX" record (RFC 7505): a single MX RR whose exchange is the
 * root ("." — some resolvers report it as an empty string) with preference 0.
 * It signals that the domain intentionally accepts no mail.
 */
@Injectable()
export class NullMxService {
  isNullMx(records: MxRecord[]): boolean {
    if (records.length !== 1) {
      return false;
    }
    const [record] = records;
    const exchange = record.exchange.trim();
    return exchange === '.' || exchange === '';
  }
}
