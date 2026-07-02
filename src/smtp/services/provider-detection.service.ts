import { Injectable } from '@nestjs/common';
import {
  DomainInfo,
  EmailProvider,
  ProviderRiskProfile,
} from '../../common/types/validation.types';

export interface ProviderDetectionResult {
  provider: EmailProvider;
  riskProfile: ProviderRiskProfile;
}

@Injectable()
export class ProviderDetectionService {
  /**
   * Detects the email provider and its risk profile based on the MX host
   * and domain info.
   */
  detect(mxHost: string, domainInfo?: DomainInfo): ProviderDetectionResult {
    const host = mxHost.toLowerCase();

    // 1. Google / Gmail
    if (host.includes('google.com') || host.includes('googlemail.com')) {
      if (domainInfo?.freeEmail || host.includes('gmail-smtp-in')) {
        return { provider: 'gmail', riskProfile: 'strict' };
      }
      return { provider: 'google_workspace', riskProfile: 'strict' };
    }

    // 2. Microsoft / Outlook / Office 365
    if (host.includes('olc.protection.outlook.com')) {
      return { provider: 'outlook', riskProfile: 'strict' };
    }
    if (host.includes('protection.outlook.com')) {
      return { provider: 'microsoft_365', riskProfile: 'strict' };
    }
    if (host.includes('outlook.com') || host.includes('hotmail.com')) {
      return { provider: 'outlook', riskProfile: 'strict' };
    }

    // 3. Yahoo
    if (host.includes('yahoodns.net') || host.includes('yahoo.com')) {
      return { provider: 'yahoo', riskProfile: 'moderate' };
    }

    // 4. Yandex
    if (host.includes('yandex.net') || host.includes('yandex.ru')) {
      return { provider: 'yandex', riskProfile: 'moderate' };
    }

    // 5. Zoho
    if (host.includes('zoho.com') || host.includes('zohomail.com')) {
      return { provider: 'zoho', riskProfile: 'moderate' };
    }

    // 6. Enterprise Gateways (Proofpoint, Mimecast, Barracuda, etc.)
    if (
      host.includes('proofpoint.com') ||
      host.includes('mimecast.com') ||
      host.includes('barracudanetworks.com') ||
      host.includes('messagelabs.com') ||
      host.includes('trendmicro.com')
    ) {
      return { provider: 'enterprise_gateway', riskProfile: 'strict' };
    }

    // Fallbacks based on domain info if MX host didn't match known patterns
    if (domainInfo) {
      if (domainInfo.freeEmail) {
        return { provider: 'free_email', riskProfile: 'relaxed' };
      }
      if (domainInfo.corporateEmail) {
        return { provider: 'corporate', riskProfile: 'relaxed' };
      }
    }

    // Default catch-all
    return { provider: 'corporate', riskProfile: 'relaxed' };
  }
}
