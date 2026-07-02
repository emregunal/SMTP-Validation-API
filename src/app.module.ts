import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { ValidationModule } from './validation/validation.module';
import { SmtpModule } from './smtp/smtp.module';
import { BounceModule } from './bounce/bounce.module';
import smtpConfig from './config/smtp.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, smtpConfig],
      envFilePath: ['.env'],
    }),
    PrismaModule,
    HealthModule,
    SmtpModule,
    ValidationModule,
    BounceModule,
  ],
})
export class AppModule {}
