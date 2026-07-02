import { Injectable } from '@nestjs/common';

/**
 * Normalizes a raw email string before any other check runs.
 *
 * Responsibilities (MVP):
 *  - trim surrounding whitespace
 *  - strip invisible / zero-width / control characters
 *  - lowercase the whole address (MVP treats local-part as case-insensitive too)
 *
 * It deliberately does NOT strip internal spaces: an address like
 * "user name@gmail.com" must survive to the syntax check so it can be rejected.
 */
@Injectable()
export class EmailNormalizerService {
  // Zero-width space/joiner/non-joiner (U+200B-U+200D), word joiner (U+2060), BOM (U+FEFF).
  private static readonly INVISIBLE_CHARS = new RegExp(
    '[\\u200B\\u200C\\u200D\\u2060\\uFEFF]',
    'g',
  );
  // C0 control characters (U+0000-U+001F) and DEL (U+007F).
  private static readonly CONTROL_CHARS = new RegExp(
    '[\\u0000-\\u001F\\u007F]',
    'g',
  );

  normalize(raw: unknown): string {
    if (typeof raw !== 'string') {
      return '';
    }

    return raw
      .trim()
      .replace(EmailNormalizerService.INVISIBLE_CHARS, '')
      .replace(EmailNormalizerService.CONTROL_CHARS, '')
      .toLowerCase();
  }
}
