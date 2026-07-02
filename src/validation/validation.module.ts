import { Module } from '@nestjs/common';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';
import { ValidationRepository } from './repositories/validation.repository';
import { EmailNormalizerService } from './services/email-normalizer.service';
import { SyntaxValidatorService } from './services/syntax-validator.service';
import { DomainParserService } from './services/domain-parser.service';
import { DnsValidatorService } from './services/dns-validator.service';
import { MxLookupService } from './services/mx-lookup.service';
import { NullMxService } from './services/null-mx.service';
import { DisposableDomainService } from './services/disposable-domain.service';
import { RoleBasedDetectorService } from './services/role-based-detector.service';
import { TypoSuggestionService } from './services/typo-suggestion.service';
import { RiskScoringService } from './services/risk-scoring.service';
import { ValidationResultMapperService } from './services/validation-result-mapper.service';

import { SmtpModule } from '../smtp/smtp.module';
import { BounceModule } from '../bounce/bounce.module';

@Module({
  imports: [SmtpModule, BounceModule],
  controllers: [ValidationController],
  providers: [
    ValidationService,
    ValidationRepository,
    EmailNormalizerService,
    SyntaxValidatorService,
    DomainParserService,
    DnsValidatorService,
    MxLookupService,
    NullMxService,
    DisposableDomainService,
    RoleBasedDetectorService,
    TypoSuggestionService,
    RiskScoringService,
    ValidationResultMapperService,
  ],
})
export class ValidationModule {}
