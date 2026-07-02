import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiKey: string;
  dnsTimeoutMs: number;
}

export default registerAs('app', (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiKey: process.env.API_KEY ?? 'development-key',
  dnsTimeoutMs: parseInt(process.env.DNS_TIMEOUT_MS ?? '5000', 10),
}));
