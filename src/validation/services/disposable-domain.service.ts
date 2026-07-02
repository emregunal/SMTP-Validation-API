import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DISPOSABLE_DOMAINS } from '../../common/constants/disposable-domains.const';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Knows which domains are disposable/throwaway providers.
 *
 * On startup it loads the active domains from the `DisposableDomain` table and
 * unions them with the built-in seed list. If the DB is unreachable it falls
 * back to the built-in list, so validation still works without a database.
 */
@Injectable()
export class DisposableDomainService implements OnModuleInit {
  private readonly logger = new Logger(DisposableDomainService.name);
  private domains = new Set<string>(DISPOSABLE_DOMAINS);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  /** Reloads the domain set from the database (falling back to constants). */
  async refresh(): Promise<void> {
    try {
      const rows = await this.prisma.disposableDomain.findMany({
        where: { active: true },
        select: { domain: true },
      });
      const merged = new Set<string>(DISPOSABLE_DOMAINS);
      for (const row of rows) {
        merged.add(row.domain.toLowerCase());
      }
      this.domains = merged;
      this.logger.log(`Loaded ${this.domains.size} disposable domains`);
    } catch (error) {
      this.logger.warn(
        `Could not load disposable domains from DB, using built-in list (${DISPOSABLE_DOMAINS.length}). ` +
          (error instanceof Error ? error.message : String(error)),
      );
      this.domains = new Set<string>(DISPOSABLE_DOMAINS);
    }
  }

  isDisposable(domain: string): boolean {
    return this.domains.has(domain.toLowerCase());
  }
}
