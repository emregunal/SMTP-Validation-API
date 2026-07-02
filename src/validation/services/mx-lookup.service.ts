import { Injectable } from '@nestjs/common';
import { MxRecord } from '../../common/types/validation.types';

/**
 * Normalizes and orders MX records. Lowest priority value = highest preference,
 * so it is placed first.
 */
@Injectable()
export class MxLookupService {
  /** Returns a new array sorted ascending by priority (preference). */
  sortByPriority(records: MxRecord[]): MxRecord[] {
    return [...records].sort((a, b) => a.priority - b.priority);
  }
}
