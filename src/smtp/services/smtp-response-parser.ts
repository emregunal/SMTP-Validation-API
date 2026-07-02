import { Injectable } from '@nestjs/common';
import {
  EmailProvider,
  ProviderRiskProfile,
  SmtpSignal,
  SmtpStatus,
} from '../../common/types/validation.types';

@Injectable()
export class SmtpResponseParser {
  /**
   * Parses raw SMTP response parts into an SmtpSignal.
   */
  parse(
    status: SmtpStatus,
    rawMessage: string | null,
    provider: EmailProvider,
    providerRiskProfile: ProviderRiskProfile,
    mxHost: string | null,
    durationMs: number,
  ): SmtpSignal {
    const signal: SmtpSignal = {
      status,
      code: null,
      enhancedCode: null,
      message: null,
      provider,
      providerRiskProfile,
      mxHost,
      durationMs,
    };

    if (!rawMessage) {
      return signal;
    }

    // Clean up message
    const lines = rawMessage
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const lastLine = lines[lines.length - 1] || rawMessage;

    // Extract code (e.g. "550", "250")
    const codeMatch = lastLine.match(/^(\d{3})(?:[\s-]|$)/);
    if (codeMatch) {
      signal.code = parseInt(codeMatch[1], 10);
    }

    // Extract enhanced status code if present (e.g. "5.1.1")
    const enhancedMatch = lastLine.match(/\b([245]\.\d{1,3}\.\d{1,3})\b/);
    if (enhancedMatch) {
      signal.enhancedCode = enhancedMatch[1];
    }

    // Extract textual message
    // Usually after the code and enhanced code. We just take the whole last line for simplicity,
    // or strip the prefix. Let's just use the last line, maybe stripping the "250-" prefix.
    const messageMatch = lastLine.match(
      /^\d{3}[\s-](?:[245]\.\d{1,3}\.\d{1,3}[\s-])?(.*)$/,
    );
    if (messageMatch) {
      signal.message = messageMatch[1].trim();
    } else {
      signal.message = lastLine;
    }

    // Attempt to refine the status based on the parsed code if the initial status wasn't definitive,
    // or if we have more specific policy logic.
    if (signal.code) {
      if (signal.code >= 200 && signal.code < 300) {
        signal.status = 'accepted';
      } else if (signal.code >= 400 && signal.code < 500) {
        // tempfail, greylisting, etc.
        signal.status = 'tempfail';
      } else if (signal.code >= 500 && signal.code < 600) {
        // A 5xx is only ever a SIGNAL, never an automatic "mailbox does not
        // exist" verdict. We split it three ways:
        //
        //   policy/infra  -> `blocked`   (5.7.x, 554, spam/IP/reputation text)
        //   mailbox gone  -> `rejected` + mailboxNotFound=true  (5.1.1 etc.)
        //   ambiguous 5xx -> `rejected` + mailboxNotFound=false  (bare 550)
        //
        // Policy is checked first so an IP/spam block is never mistaken for a
        // missing recipient.
        const lowerMsg = (signal.message ?? '').toLowerCase();
        const enh = signal.enhancedCode ?? '';

        const isPolicyBlock =
          signal.code === 554 ||
          enh.startsWith('5.7') ||
          /block|spam|blacklist|blocklist|banned|policy|reputation|\brbl\b|\bdnsbl\b|spamhaus|greylist|throttl|rate limit|too many|access denied|not authori|abuse/.test(
            lowerMsg,
          );

        const isMailboxNotFound =
          enh === '5.1.1' ||
          enh === '5.1.6' ||
          /user unknown|unknown user|no such user|user not found|no such mailbox|mailbox (?:is )?unavailable|mailbox not found|recipient not found|recipient address rejected|address (?:does not|doesn't|not) exist|(?:account|address|mailbox|user).{0,20}(?:does not|doesn't) exist|no mailbox|invalid recipient|invalid mailbox/.test(
            lowerMsg,
          );

        if (isPolicyBlock) {
          signal.status = 'blocked';
        } else if (isMailboxNotFound) {
          signal.status = 'rejected';
          signal.mailboxNotFound = true;
        } else {
          // Bare/ambiguous 5xx: treated as an uncertain negative downstream,
          // never a hard mailbox verdict.
          signal.status = 'rejected';
          signal.mailboxNotFound = false;
        }
      }
    }

    return signal;
  }
}
