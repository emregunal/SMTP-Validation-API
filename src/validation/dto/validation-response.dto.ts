import { ApiProperty } from '@nestjs/swagger';
import { EmailStatus } from '../../common/enums/email-status.enum';
import { EmailSubStatus } from '../../common/enums/email-sub-status.enum';
import { RiskLevel } from '../../common/enums/risk-level.enum';

import {
  EmailProvider,
  ProviderRiskProfile,
  SmtpStatus,
  CatchAllStatus,
  ConfidenceLevel,
  DomainBehaviorStatus,
} from '../../common/types/validation.types';

export class SmtpSignalDto {
  @ApiProperty({
    example: 'accepted',
    description:
      'accepted | rejected | tempfail | timeout | blocked | connection_failed | skipped | unknown',
  })
  status!: SmtpStatus;

  @ApiProperty({ nullable: true, example: 250 })
  code!: number | null;

  @ApiProperty({ nullable: true, example: '2.1.5' })
  enhancedCode!: string | null;

  @ApiProperty({ nullable: true, example: 'OK' })
  message!: string | null;

  @ApiProperty({ example: 'google_workspace' })
  provider!: EmailProvider;

  @ApiProperty({
    description:
      'The risk profile of the MX provider (strict, moderate, relaxed, unknown)',
    example: 'strict',
  })
  providerRiskProfile!: ProviderRiskProfile;

  @ApiProperty({ nullable: true, example: 'mx.example.com' })
  mxHost!: string | null;

  @ApiProperty({ example: 120 })
  durationMs!: number;

  @ApiProperty({
    nullable: true,
    example: false,
    description:
      'True only for a mailbox-specific rejection (e.g. 5.1.1 "user unknown"). A bare/ambiguous 5xx or policy block is not mailbox-not-found.',
  })
  mailboxNotFound?: boolean;
}

export class IpQualitySignalDto {
  @ApiProperty({
    example: 'not_evaluated',
    description: 'good | poor | unknown | not_evaluated',
  })
  status!: string;

  @ApiProperty({ nullable: true, example: 'mx.example.com' })
  mxHost!: string | null;

  @ApiProperty({ type: [String], example: [] })
  listedOn!: string[];

  @ApiProperty({ example: 'IP/DNSBL reputation not evaluated in this build.' })
  detail!: string;
}

export class ScoreSignalDto {
  @ApiProperty({
    example: 'smtp',
    description:
      "Signal id, e.g. 'smtp', 'catch_all', 'bounce_history', 'dns_mx'.",
  })
  name!: string;

  @ApiProperty({
    example: 'positive',
    description: 'positive | negative | neutral | inconclusive',
  })
  outcome!: string;

  @ApiProperty({
    example: 10,
    description: 'Signed contribution to the 0-100 confidence score.',
  })
  weight!: number;

  @ApiProperty({ example: 'SMTP server accepted the recipient address.' })
  detail!: string;
}

export class CatchAllSignalDto {
  @ApiProperty({
    example: 'detected',
    description: 'detected | possible | not_detected | unknown | skipped',
  })
  status!: CatchAllStatus;

  @ApiProperty({ nullable: true, example: 'verify-8f92a1c3@example.com' })
  testAddress!: string | null;

  @ApiProperty({
    example: 'accepted',
    description: 'accepted | rejected | tempfail | timeout | unknown',
  })
  smtpStatus!: SmtpStatus;

  @ApiProperty({ example: 'medium', description: 'low | medium | high' })
  confidence!: ConfidenceLevel;
}

export class DomainBehaviorSignalDto {
  @ApiProperty({ example: 'known', description: 'known | unknown' })
  status!: DomainBehaviorStatus;

  @ApiProperty({ example: true })
  catchAllObserved!: boolean;

  @ApiProperty({ example: 0.18 })
  recentTempfailRate!: number;

  @ApiProperty({
    example: 'lowered',
    description: 'lowered | neutral | boosted',
  })
  confidenceImpact!: 'lowered' | 'neutral' | 'boosted';
}

export class HistorySignalDto {
  @ApiProperty({ example: 'found', description: 'found | not_found' })
  status!: 'found' | 'not_found';

  @ApiProperty({ example: 'hard_bounce', nullable: true })
  lastEvent?: string;

  @ApiProperty({ example: 1 })
  hardBounceCount!: number;

  @ApiProperty({ example: 0 })
  deliveredCount!: number;

  @ApiProperty({ example: 'high', description: 'high | medium | low | none' })
  confidenceImpact!: 'high' | 'medium' | 'low' | 'none';
}

export class ChecksDto {
  @ApiProperty() syntaxValid!: boolean;
  @ApiProperty() domainValid!: boolean;
  @ApiProperty() dnsFound!: boolean;
  @ApiProperty() mxFound!: boolean;
  @ApiProperty() nullMx!: boolean;
  @ApiProperty() disposable!: boolean;
  @ApiProperty() roleBased!: boolean;
  @ApiProperty() freeEmail!: boolean;
  @ApiProperty() typoDetected!: boolean;

  @ApiProperty({
    type: SmtpSignalDto,
    nullable: true,
    description: 'SMTP check result. Null if SMTP validation is disabled.',
  })
  smtp!: SmtpSignalDto | null;

  @ApiProperty({
    type: CatchAllSignalDto,
    nullable: true,
    description:
      'Catch-all domain check result. Null if check is disabled or skipped.',
  })
  catchAll!: CatchAllSignalDto | null;

  @ApiProperty({
    type: DomainBehaviorSignalDto,
    nullable: true,
    description:
      'Historical domain behavior (e.g. catch-all status, tempfail rates).',
  })
  domainBehavior!: DomainBehaviorSignalDto | null;

  @ApiProperty({
    type: HistorySignalDto,
    nullable: true,
    description: 'Bounce feedback history for this specific email address.',
  })
  history!: HistorySignalDto | null;

  @ApiProperty({
    type: IpQualitySignalDto,
    nullable: true,
    description:
      'MX/IP reputation signal. Plumbing only for now (not_evaluated).',
  })
  ipQuality!: IpQualitySignalDto | null;
}

export class MxRecordDto {
  @ApiProperty({ example: 'mx.example.com' }) exchange!: string;
  @ApiProperty({ example: 10 }) priority!: number;
}

export class DnsDto {
  @ApiProperty({ type: [MxRecordDto] }) mxRecords!: MxRecordDto[];
  @ApiProperty({ type: [String], example: [] }) aRecords!: string[];
  @ApiProperty({ type: [String], example: [] }) aaaaRecords!: string[];
}

export class SuggestionDto {
  @ApiProperty({
    nullable: true,
    example: null,
    description: 'Suggested corrected email when a typo is detected.',
  })
  didYouMean!: string | null;
}

export class ValidationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'user@example.com' }) normalizedEmail!: string;

  @ApiProperty({ nullable: true, example: 'user' }) localPart!: string | null;
  @ApiProperty({ nullable: true, example: 'example.com' })
  domain!: string | null;

  @ApiProperty({ enum: EmailStatus, example: EmailStatus.DELIVERABLE })
  status!: EmailStatus;

  @ApiProperty({
    enum: EmailSubStatus,
    nullable: true,
    example: EmailSubStatus.MX_FOUND,
  })
  subStatus!: EmailSubStatus | null;

  @ApiProperty({ enum: RiskLevel, example: RiskLevel.LOW })
  risk!: RiskLevel;

  @ApiProperty({ example: 80, minimum: 0, maximum: 100 })
  score!: number;

  @ApiProperty({ type: ChecksDto })
  checks!: ChecksDto;

  @ApiProperty({
    type: [ScoreSignalDto],
    description:
      'Breakdown of the signals that produced the confidence score. The verdict is a weighted blend — no single signal is decisive.',
  })
  signals!: ScoreSignalDto[];

  @ApiProperty({ type: DnsDto })
  dns!: DnsDto;

  @ApiProperty({ type: SuggestionDto })
  suggestion!: SuggestionDto;

  @ApiProperty({
    example:
      'Email passed syntax and DNS/MX checks. SMTP mailbox verification has not been performed in this MVP.',
  })
  reason!: string;

  @ApiProperty({ format: 'date-time', example: '2026-07-01T12:00:00.000Z' })
  checkedAt!: string;
}

export class HistoryItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ enum: EmailStatus }) status!: EmailStatus;
  @ApiProperty({ enum: EmailSubStatus, nullable: true })
  subStatus!: EmailSubStatus | null;
  @ApiProperty({ enum: RiskLevel, nullable: true }) risk!: RiskLevel | null;
  @ApiProperty({ nullable: true, example: 80 }) score!: number | null;
  @ApiProperty({ format: 'date-time' }) checkedAt!: string;
}
