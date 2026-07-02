import { Injectable } from '@nestjs/common';
import { REFERENCE_DOMAINS } from '../../common/constants/reference-domains.const';

/**
 * Suggests the correct domain when the user's domain looks like a typo of a
 * popular provider, using Levenshtein (edit) distance.
 *
 * A domain that exactly matches a reference is never a typo. A domain within
 * MAX_DISTANCE edits of a reference (but not equal) is reported as a possible
 * typo; the closest reference wins.
 */
@Injectable()
export class TypoSuggestionService {
  private static readonly MAX_DISTANCE = 2;

  /**
   * @returns the suggested domain (e.g. "gmail.com") or null when no likely
   * typo is found.
   */
  suggest(domain: string): string | null {
    const candidate = domain.toLowerCase();

    // Exact match against a known provider -> definitely not a typo.
    if (REFERENCE_DOMAINS.includes(candidate)) {
      return null;
    }

    let best: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const reference of REFERENCE_DOMAINS) {
      const distance = this.levenshtein(candidate, reference);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = reference;
      }
    }

    if (
      best !== null &&
      bestDistance > 0 &&
      bestDistance <= TypoSuggestionService.MAX_DISTANCE
    ) {
      return best;
    }

    return null;
  }

  /** Classic dynamic-programming Levenshtein distance. */
  private levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    let current = new Array<number>(b.length + 1);

    for (let i = 1; i <= a.length; i++) {
      current[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1, // insertion
          previous[j] + 1, // deletion
          previous[j - 1] + cost, // substitution
        );
      }
      [previous, current] = [current, previous];
    }

    return previous[b.length];
  }
}
