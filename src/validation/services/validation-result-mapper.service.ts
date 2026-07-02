import { Injectable } from '@nestjs/common';
import { ValidationRequest, ValidationResult } from '@prisma/client';
import { EmailStatus } from '../../common/enums/email-status.enum';
import { EmailSubStatus } from '../../common/enums/email-sub-status.enum';
import { RiskLevel } from '../../common/enums/risk-level.enum';
import { MxRecord } from '../../common/types/validation.types';
import {
  ChecksDto,
  DnsDto,
  HistoryItemDto,
  ValidationResponseDto,
} from '../dto/validation-response.dto';
import { ScoreSignal, SmtpSignal } from '../../common/types/validation.types';

export type ValidationRequestWithResult = ValidationRequest & {
  result: ValidationResult | null;
};

/**
 * Maps persisted entities to the public API response shape. Keeping this in one
 * place guarantees `POST /single` and `GET /history/:id` return identical
 * structures.
 */
@Injectable()
export class ValidationResultMapperService {
  toResponse(entity: ValidationRequestWithResult): ValidationResponseDto {
    const result = entity.result;

    const checks: ChecksDto = {
      syntaxValid: result?.syntaxValid ?? false,
      domainValid: result?.domainValid ?? false,
      dnsFound: result?.dnsFound ?? false,
      mxFound: result?.mxFound ?? false,
      nullMx: result?.nullMx ?? false,
      disposable: result?.disposable ?? false,
      roleBased: result?.roleBased ?? false,
      freeEmail: result?.freeEmail ?? false,
      typoDetected: result?.typoDetected ?? false,
      smtp: ((result?.raw as any)?.smtp as SmtpSignal) ?? null,
      catchAll: (result?.raw as any)?.catchAll
        ? {
            status: (result?.raw as any).catchAll.status,
            testAddress: (result?.raw as any).catchAll.testAddress,
            smtpStatus: (result?.raw as any).catchAll.smtpStatus,
            confidence: (result?.raw as any).catchAll.confidence,
          }
        : null,
      domainBehavior: (result?.raw as any)?.domainBehavior
        ? {
            status: (result?.raw as any).domainBehavior.status,
            catchAllObserved: (result?.raw as any).domainBehavior
              .catchAllObserved,
            recentTempfailRate: (result?.raw as any).domainBehavior
              .recentTempfailRate,
            confidenceImpact: (result?.raw as any).domainBehavior
              .confidenceImpact,
          }
        : null,
      history: (result?.raw as any)?.history
        ? {
            status: (result?.raw as any).history.status,
            lastEvent: (result?.raw as any).history.lastEvent,
            hardBounceCount: (result?.raw as any).history.hardBounceCount,
            deliveredCount: (result?.raw as any).history.deliveredCount,
            confidenceImpact: (result?.raw as any).history.confidenceImpact,
          }
        : null,
      ipQuality: (result?.raw as any)?.ipQuality ?? null,
    };

    const signals: ScoreSignal[] =
      (result?.raw as any)?.evaluation?.signals ?? [];

    const dns: DnsDto = {
      mxRecords: this.asMxRecords(result?.mxRecords),
      aRecords: this.asStringArray(result?.aRecords),
      aaaaRecords: this.asStringArray(result?.aaaaRecords),
    };

    return {
      id: entity.id,
      email: entity.email,
      normalizedEmail: entity.normalizedEmail ?? entity.email,
      localPart: result?.localPart ?? null,
      domain: result?.domain ?? null,
      status: entity.status as EmailStatus,
      subStatus: (entity.subStatus as EmailSubStatus) ?? null,
      risk: (entity.risk as RiskLevel) ?? RiskLevel.HIGH,
      score: entity.score ?? 0,
      checks,
      signals,
      dns,
      suggestion: { didYouMean: result?.didYouMean ?? null },
      reason: entity.reason ?? '',
      checkedAt: entity.createdAt.toISOString(),
    };
  }

  toHistoryItem(request: ValidationRequest): HistoryItemDto {
    return {
      id: request.id,
      email: request.email,
      status: request.status as EmailStatus,
      subStatus: (request.subStatus as EmailSubStatus) ?? null,
      risk: (request.risk as RiskLevel) ?? null,
      score: request.score ?? null,
      checkedAt: request.createdAt.toISOString(),
    };
  }

  private asMxRecords(value: unknown): MxRecord[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (v): v is { exchange: string; priority: number } =>
          typeof v === 'object' &&
          v !== null &&
          'exchange' in v &&
          'priority' in v,
      )
      .map((v) => ({
        exchange: String(v.exchange),
        priority: Number(v.priority),
      }));
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v));
  }
}
