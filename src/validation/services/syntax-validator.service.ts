import { Injectable } from '@nestjs/common';
import { SyntaxResult } from '../../common/types/validation.types';

/**
 * Pragmatic email syntax check.
 *
 * The goal is to reject clearly-broken addresses while accepting the common
 * real-world local-part shapes (plus-tags, dots, underscores, hyphens). It is
 * intentionally NOT a full RFC 5322 parser.
 */
@Injectable()
export class SyntaxValidatorService {
  // Local-part: letters, digits and a conservative set of specials.
  // Must not start or end with a dot, and no consecutive dots.
  private static readonly LOCAL_PART =
    /^(?!\.)(?!.*\.\.)[a-z0-9!#$%&'*+/=?^_`{|}~.-]+(?<!\.)$/;

  // A single DNS label: 1-63 chars, alphanumeric, hyphens allowed inside.
  private static readonly DOMAIN_LABEL =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

  validate(email: string): SyntaxResult {
    if (!email) {
      return { valid: false, reason: 'Email is empty.' };
    }

    if (/\s/.test(email)) {
      return { valid: false, reason: 'Email must not contain whitespace.' };
    }

    const atCount = (email.match(/@/g) ?? []).length;
    if (atCount !== 1) {
      return {
        valid: false,
        reason: 'Email must contain exactly one "@" symbol.',
      };
    }

    const [localPart, domain] = email.split('@');

    if (!localPart) {
      return { valid: false, reason: 'Local part (before "@") is empty.' };
    }

    if (!domain) {
      return { valid: false, reason: 'Domain (after "@") is empty.' };
    }

    if (!SyntaxValidatorService.LOCAL_PART.test(localPart)) {
      return {
        valid: false,
        reason: 'Local part contains invalid characters.',
      };
    }

    const domainResult = this.validateDomain(domain);
    if (!domainResult.valid) {
      return domainResult;
    }

    return { valid: true };
  }

  private validateDomain(domain: string): SyntaxResult {
    if (!domain.includes('.')) {
      return { valid: false, reason: 'Domain must contain a dot.' };
    }
    if (domain.startsWith('.')) {
      return { valid: false, reason: 'Domain must not start with a dot.' };
    }
    if (domain.endsWith('.')) {
      return { valid: false, reason: 'Domain must not end with a dot.' };
    }
    if (domain.includes('..')) {
      return {
        valid: false,
        reason: 'Domain must not contain consecutive dots.',
      };
    }

    const labels = domain.split('.');
    for (const label of labels) {
      if (!SyntaxValidatorService.DOMAIN_LABEL.test(label)) {
        return { valid: false, reason: `Invalid domain label: "${label}".` };
      }
    }

    const tld = labels[labels.length - 1];
    if (!/^[a-z]{2,}$/.test(tld)) {
      return {
        valid: false,
        reason: 'Top-level domain must be at least two letters.',
      };
    }

    return { valid: true };
  }
}
