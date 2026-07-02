import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
}

export default registerAs('database', (): DatabaseConfig => ({
  url:
    process.env.DATABASE_URL ??
    'postgresql://smtp_validator:smtp_validator@localhost:5432/smtp_validator_db',
}));
