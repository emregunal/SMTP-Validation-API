import { Injectable } from '@nestjs/common';
import { FREE_EMAIL_DOMAINS } from '../../common/constants/free-email-domains.const';
import { DomainInfo } from '../../common/types/validation.types';

/**
 * Splits a (syntactically valid, normalized) email into its parts and derives
 * lightweight metadata: TLD, subdomain flag, free vs corporate.
 */
@Injectable()
export class DomainParserService {
  private readonly freeEmailDomains = new Set(FREE_EMAIL_DOMAINS);

  /**
   * @param email a normalized, syntactically valid email (exactly one "@").
   */
  parse(email: string): DomainInfo {
    const atIndex = email.lastIndexOf('@');
    const localPart = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);

    const labels = domain.split('.');
    const tld = labels[labels.length - 1] ?? '';
    const isSubdomain = labels.length > 2;
    const freeEmail = this.freeEmailDomains.has(domain);

    return {
      localPart,
      domain,
      tld,
      isSubdomain,
      freeEmail,
      // In this MVP a non-free deliverable domain is treated as corporate.
      corporateEmail: !freeEmail,
    };
  }
}
