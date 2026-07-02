import { Injectable } from '@nestjs/common';
import { Prisma, ValidationRequest } from '@prisma/client';
import {
  RiskEvaluation,
  ValidationContext,
} from '../../common/types/validation.types';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationRequestWithResult } from '../services/validation-result-mapper.service';

@Injectable()
export class ValidationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a completed validation (request + result) in a single write and
   * returns the created entity with its result relation loaded.
   */
  async create(
    context: ValidationContext,
    evaluation: RiskEvaluation,
  ): Promise<ValidationRequestWithResult> {
    const dns = context.dns;
    const didYouMean =
      context.typoSuggestedDomain && context.localPart
        ? `${context.localPart}@${context.typoSuggestedDomain}`
        : null;

    const raw = {
      domainInfo: context.domainInfo ?? null,
      dns: dns ?? null,
      smtp: context.smtp ?? null,
      catchAll: context.catchAll ?? null,
      domainBehavior: context.domainBehavior ?? null,
      history: context.history ?? null,
      ipQuality: context.ipQuality ?? null,
      evaluation,
    } as unknown as Prisma.InputJsonValue;

    return this.prisma.validationRequest.create({
      data: {
        email: context.rawEmail,
        normalizedEmail: context.normalizedEmail,
        status: evaluation.status,
        subStatus: evaluation.subStatus,
        risk: evaluation.risk,
        score: evaluation.score,
        reason: evaluation.reason,
        result: {
          create: {
            localPart: context.localPart,
            domain: context.domain,
            syntaxValid: context.syntax.valid,
            domainValid: context.domainInfo !== null,
            dnsFound: dns?.dnsFound ?? false,
            mxFound: dns?.mxFound ?? false,
            nullMx: dns?.nullMx ?? false,
            disposable: context.disposable,
            roleBased: context.roleBased,
            freeEmail: context.domainInfo?.freeEmail ?? false,
            typoDetected: context.typoSuggestedDomain !== null,
            didYouMean,
            mxRecords: (dns?.mxRecords ??
              []) as unknown as Prisma.InputJsonValue,
            aRecords: (dns?.aRecords ?? []) as unknown as Prisma.InputJsonValue,
            aaaaRecords: (dns?.aaaaRecords ??
              []) as unknown as Prisma.InputJsonValue,
            raw,
          },
        },
      },
      include: { result: true },
    });
  }

  async findById(id: string): Promise<ValidationRequestWithResult | null> {
    return this.prisma.validationRequest.findUnique({
      where: { id },
      include: { result: true },
    });
  }

  async findMany(limit: number, offset: number): Promise<ValidationRequest[]> {
    return this.prisma.validationRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
