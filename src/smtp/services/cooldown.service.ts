import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CooldownService {
  private readonly logger = new Logger(CooldownService.name);

  // Stores expiration timestamps for each key (domain or provider)
  private cooldowns = new Map<string, number>();

  /**
   * Sets a cooldown for the specified key.
   * @param key The domain or provider string (e.g. 'gmail' or 'example.com')
   * @param durationMs Duration in milliseconds
   */
  setCooldown(key: string, durationMs: number): void {
    const expiresAt = Date.now() + durationMs;
    this.cooldowns.set(key, expiresAt);
    this.logger.warn(`Applied cooldown to ${key} for ${durationMs}ms`);

    // Clean up to prevent memory leaks over time
    const timer = setTimeout(() => {
      const current = this.cooldowns.get(key);
      if (current === expiresAt) {
        this.cooldowns.delete(key);
      }
    }, durationMs + 1000);

    // Unref is only available in Node environment. Prevent breaking if run in browser-like test env
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  /**
   * Checks if the specified key is currently in cooldown.
   */
  isCoolingDown(key: string): boolean {
    const expiresAt = this.cooldowns.get(key);
    if (!expiresAt) return false;

    if (Date.now() < expiresAt) {
      return true;
    }

    // Lazy cleanup
    this.cooldowns.delete(key);
    return false;
  }
}
