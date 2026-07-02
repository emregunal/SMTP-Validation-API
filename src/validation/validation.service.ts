import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  RiskEvaluation,
  ValidationContext,
} from '../common/types/validation.types';
import { HistoryQueryDto } from './dto/history-query.dto';
import {
  HistoryItemDto,
  ValidationResponseDto,
} from './dto/validation-response.dto';
import { ValidationRepository } from './repositories/validation.repository';
import { DisposableDomainService } from './services/disposable-domain.service';
import { DnsValidatorService } from './services/dns-validator.service';
import { DomainParserService } from './services/domain-parser.service';
import { EmailNormalizerService } from './services/email-normalizer.service';
import { RiskScoringService } from './services/risk-scoring.service';
import { RoleBasedDetectorService } from './services/role-based-detector.service';
import { SyntaxValidatorService } from './services/syntax-validator.service';
import { TypoSuggestionService } from './services/typo-suggestion.service';
import { ValidationResultMapperService } from './services/validation-result-mapper.service';
import { SmtpQueueService } from '../smtp/services/smtp-queue.service';
import { ProviderDetectionService } from '../smtp/services/provider-detection.service';
import { CatchAllDetectionService } from '../smtp/services/catch-all-detection.service';
import { DomainBehaviorService } from '../smtp/services/domain-behavior.service';
import { DomainBehaviorSignal } from '../common/types/validation.types';
import { BounceService } from '../bounce/services/bounce.service';

/**
 * Result of running the check pipeline + scoring, *before* persistence.
 * Exposed so tooling (e.g. the benchmark runner) can evaluate an address
 * without writing a row to the database.
 */
export interface AnalyzedEmail {
  context: ValidationContext;
  evaluation: RiskEvaluation;
}

/**
 * Orchestrates the validation pipeline: normalize -> syntax -> parse ->
 * (disposable / DNS / MX / role / typo) -> score -> persist -> map.
 *
 * MVP 1 stops at the DNS/MX layer. The SMTP probe (EHLO/MAIL FROM/RCPT TO)
 * will slot in between the DNS checks and the risk scorer in a later MVP.
 */
@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    private readonly normalizer: EmailNormalizerService,
    private readonly syntaxValidator: SyntaxValidatorService,
    private readonly domainParser: DomainParserService,
    private readonly dnsValidator: DnsValidatorService,
    private readonly disposableDomain: DisposableDomainService,
    private readonly roleBasedDetector: RoleBasedDetectorService,
    private readonly typoSuggestion: TypoSuggestionService,
    private readonly riskScoring: RiskScoringService,
    private readonly mapper: ValidationResultMapperService,
    private readonly repository: ValidationRepository,
    private readonly smtpQueue: SmtpQueueService,
    private readonly providerDetection: ProviderDetectionService,
    private readonly catchAllDetection: CatchAllDetectionService,
    private readonly domainBehavior: DomainBehaviorService,
    private readonly bounceService: BounceService,
  ) {}

  async validateSingle(rawEmail: string): Promise<ValidationResponseDto> {
    const { context, evaluation } = await this.analyze(rawEmail);
    const entity = await this.repository.create(context, evaluation);
    return this.mapper.toResponse(entity);
  }

  /**
   * Runs normalize -> checks -> scoring and returns the raw context +
   * evaluation, WITHOUT persisting. Used by validateSingle (which then
   * persists) and by the benchmark runner (which does not).
   */
  async analyze(rawEmail: string): Promise<AnalyzedEmail> {
    const context = await this.buildContext(rawEmail);
    const evaluation = this.riskScoring.evaluate(context);
    return { context, evaluation };
  }

  async getHistory(query: HistoryQueryDto): Promise<HistoryItemDto[]> {
    const rows = await this.repository.findMany(query.limit, query.offset);
    return rows.map((row) => this.mapper.toHistoryItem(row));
  }

  async getById(id: string): Promise<ValidationResponseDto> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Validation "${id}" not found`);
    }
    return this.mapper.toResponse(entity);
  }

  /** Runs the check pipeline and assembles the context for scoring. */
  private async buildContext(rawEmail: string): Promise<ValidationContext> {
    const normalizedEmail = this.normalizer.normalize(rawEmail);
    const syntax = this.syntaxValidator.validate(normalizedEmail);

    const context: ValidationContext = {
      rawEmail,
      normalizedEmail,
      localPart: null,
      domain: null,
      domainInfo: null,
      syntax,
      dns: null,
      disposable: false,
      roleBased: false,
      typoSuggestedDomain: null,
      smtp: null,
      catchAll: null,
      domainBehavior: null,
      history: null,
      ipQuality: null,
    };

    if (!syntax.valid) {
      return context;
    }

    // Bounce History Check
    const reputation = await this.bounceService.getReputation(normalizedEmail);
    if (reputation) {
      context.history = {
        status: 'found',
        lastEvent: reputation.lastEventType || undefined,
        hardBounceCount: reputation.hardBounceCount,
        deliveredCount: reputation.deliveredCount,
        confidenceImpact: reputation.confidence,
      };
    } else {
      context.history = {
        status: 'not_found',
        hardBounceCount: 0,
        deliveredCount: 0,
        confidenceImpact: 'none',
      };
    }

    const domainInfo = this.domainParser.parse(normalizedEmail);
    context.domainInfo = domainInfo;
    context.localPart = domainInfo.localPart;
    context.domain = domainInfo.domain;

    // Cheap, network-free signals.
    context.disposable = this.disposableDomain.isDisposable(domainInfo.domain);
    context.roleBased = this.roleBasedDetector.isRoleBased(
      domainInfo.localPart,
    );
    context.typoSuggestedDomain = this.typoSuggestion.suggest(
      domainInfo.domain,
    );

    // Skip the DNS round-trip for disposable domains — the verdict is already
    // decided (do_not_mail) and takes priority over any DNS result.
    if (!context.disposable) {
      context.dns = await this.dnsValidator.lookup(domainInfo.domain);

      if (
        context.dns &&
        context.dns.mxFound &&
        context.dns.mxRecords.length > 0
      ) {
        try {
          // Find the MX with the lowest priority
          const primaryMx = context.dns.mxRecords.sort(
            (a, b) => a.priority - b.priority,
          )[0];

          const providerResult = this.providerDetection.detect(
            primaryMx.exchange,
            domainInfo,
          );

          // IP/infra reputation: plumbing only for now (neutral). Real
          // DNSBL/reputation lookups would populate this in a later iteration.
          context.ipQuality = {
            status: 'not_evaluated',
            mxHost: primaryMx.exchange,
            listedOn: [],
            detail: 'IP/DNSBL reputation not evaluated in this build.',
          };

          // 1) Read Domain Behavior Cache
          const behavior = await this.domainBehavior.getBehavior(
            domainInfo.domain,
          );
          if (behavior) {
            const signal: DomainBehaviorSignal = {
              status: 'known',
              catchAllObserved: behavior.catchAllObserved,
              recentTempfailRate: behavior.tempfailRate7d,
              confidenceImpact: 'neutral',
            };
            context.domainBehavior = signal;

            // If it's in a cooldown period, skip SMTP testing
            if (
              behavior.cooldownUntil &&
              new Date(behavior.cooldownUntil).getTime() > Date.now()
            ) {
              context.smtp = {
                status: 'skipped',
                code: null,
                enhancedCode: null,
                message: 'Skipped due to recent policy blocks (cooldown).',
                provider: providerResult.provider,
                providerRiskProfile: providerResult.riskProfile,
                mxHost: primaryMx.exchange,
                durationMs: 0,
              };
            }
          } else {
            context.domainBehavior = {
              status: 'unknown',
              catchAllObserved: false,
              recentTempfailRate: 0,
              confidenceImpact: 'neutral',
            };
          }

          // 2) If not skipped, run SMTP check
          if (!context.smtp) {
            context.smtp = await this.smtpQueue.enqueue(
              normalizedEmail,
              domainInfo.domain,
              primaryMx.exchange,
              providerResult,
            );

            // 3) Update Domain Behavior
            await this.domainBehavior.updateFromSmtp(
              domainInfo.domain,
              providerResult.provider,
              primaryMx.exchange,
              context.smtp.status,
              context.smtp.durationMs,
            );

            if (context.smtp.status === 'blocked') {
              // Apply block cooldown (e.g. 5 minutes)
              await this.domainBehavior.setCooldown(
                domainInfo.domain,
                providerResult.provider,
                primaryMx.exchange,
                Date.now() + 300000,
              );
            }
          }

          // 4) Catch-All check
          if (context.smtp.status === 'accepted') {
            context.catchAll = await this.catchAllDetection.detect(
              context,
              primaryMx.exchange,
              providerResult,
            );

            if (
              context.catchAll?.status === 'detected' ||
              context.catchAll?.status === 'possible'
            ) {
              await this.domainBehavior.markCatchAll(
                domainInfo.domain,
                providerResult.provider,
                primaryMx.exchange,
              );
            }
          }
        } catch {
          // SMTP queue could throw or be skipped; leave signals as-is.
        }
      }
    }

    return context;
  }
}
