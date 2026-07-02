import { registerAs } from '@nestjs/config';

export interface SmtpConfig {
  enabled: boolean;
  connectTimeoutMs: number;
  readTimeoutMs: number;
  ehloName: string;
  mailFrom: string;
  startTlsEnabled: boolean;
  pipeliningEnabled: boolean;

  // Rate Limit / Queue
  globalConcurrency: number;
  domainConcurrency: number;
  providerConcurrencyDefault: number;
  providerConcurrencyGmail: number;
  providerConcurrencyOutlook: number;
  providerConcurrencyYahoo: number;

  // Retry & Cooldown
  maxRetries: number;
  retryBackoffMs: number;
  providerCooldownMs: number;
  domainCooldownMs: number;

  // Catch-All
  catchAllCheckEnabled: boolean;
  catchAllRandomPrefix: string;
  catchAllTimeoutMs: number;
  catchAllSkipProviders: string[];

  // Domain Behavior Cache
  domainBehaviorCacheEnabled: boolean;
  domainBehaviorCacheTtlMs: number;
  domainBehaviorMinSampleSize: number;
}

export default registerAs('smtp', (): SmtpConfig => ({
  enabled: process.env.SMTP_VALIDATION_ENABLED === 'true',
  connectTimeoutMs: parseInt(process.env.SMTP_CONNECT_TIMEOUT_MS ?? '8000', 10),
  readTimeoutMs: parseInt(process.env.SMTP_READ_TIMEOUT_MS ?? '8000', 10),
  ehloName: process.env.SMTP_EHLO_NAME ?? 'mail.validator.example.com',
  mailFrom: process.env.SMTP_MAIL_FROM ?? 'probe@validator.example.com',
  startTlsEnabled: process.env.SMTP_STARTTLS_ENABLED !== 'false',
  pipeliningEnabled: process.env.SMTP_PIPELINING_ENABLED === 'true', // default kapalı

  globalConcurrency: parseInt(process.env.SMTP_GLOBAL_CONCURRENCY ?? '10', 10),
  domainConcurrency: parseInt(process.env.SMTP_DOMAIN_CONCURRENCY ?? '1', 10),
  providerConcurrencyDefault: parseInt(
    process.env.SMTP_PROVIDER_CONCURRENCY_DEFAULT ?? '2',
    10,
  ),
  providerConcurrencyGmail: parseInt(
    process.env.SMTP_PROVIDER_CONCURRENCY_GMAIL ?? '1',
    10,
  ),
  providerConcurrencyOutlook: parseInt(
    process.env.SMTP_PROVIDER_CONCURRENCY_OUTLOOK ?? '1',
    10,
  ),
  providerConcurrencyYahoo: parseInt(
    process.env.SMTP_PROVIDER_CONCURRENCY_YAHOO ?? '1',
    10,
  ),

  maxRetries: parseInt(process.env.SMTP_MAX_RETRIES ?? '1', 10),
  retryBackoffMs: parseInt(process.env.SMTP_RETRY_BACKOFF_MS ?? '30000', 10),
  providerCooldownMs: parseInt(
    process.env.SMTP_PROVIDER_COOLDOWN_MS ?? '60000',
    10,
  ),
  domainCooldownMs: parseInt(
    process.env.SMTP_DOMAIN_COOLDOWN_MS ?? '60000',
    10,
  ),

  catchAllCheckEnabled: process.env.SMTP_CATCH_ALL_CHECK_ENABLED === 'true',
  catchAllRandomPrefix: process.env.SMTP_CATCH_ALL_RANDOM_PREFIX ?? 'verify',
  catchAllTimeoutMs: parseInt(
    process.env.SMTP_CATCH_ALL_TIMEOUT_MS ?? '8000',
    10,
  ),
  catchAllSkipProviders: (
    process.env.SMTP_CATCH_ALL_SKIP_PROVIDERS ?? 'gmail,outlook,yahoo'
  )
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0),

  domainBehaviorCacheEnabled:
    process.env.DOMAIN_BEHAVIOR_CACHE_ENABLED !== 'false',
  domainBehaviorCacheTtlMs: parseInt(
    process.env.DOMAIN_BEHAVIOR_CACHE_TTL_MS ?? '86400000',
    10,
  ),
  domainBehaviorMinSampleSize: parseInt(
    process.env.DOMAIN_BEHAVIOR_MIN_SAMPLE_SIZE ?? '3',
    10,
  ),
}));
