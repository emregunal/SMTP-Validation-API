import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ROLE_BASED_PREFIXES } from '../../common/constants/role-based-prefixes.const';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Detects role-based local-parts (info@, support@, admin@, ...).
 *
 * A "+tag" suffix is stripped before matching, so "support+news" is still
 * treated as role-based. Matching is exact (against the plus-stripped
 * local-part) to avoid false positives like "administrator" or "sales_team".
 *
 * Loads prefixes from the `RoleBasedPrefix` table on startup, unioned with the
 * built-in seed list, with a DB-failure fallback to constants.
 */
@Injectable()
export class RoleBasedDetectorService implements OnModuleInit {
  private readonly logger = new Logger(RoleBasedDetectorService.name);
  private prefixes = new Set<string>(ROLE_BASED_PREFIXES);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const rows = await this.prisma.roleBasedPrefix.findMany({
        where: { active: true },
        select: { prefix: true },
      });
      const merged = new Set<string>(ROLE_BASED_PREFIXES);
      for (const row of rows) {
        merged.add(row.prefix.toLowerCase());
      }
      this.prefixes = merged;
      this.logger.log(`Loaded ${this.prefixes.size} role-based prefixes`);
    } catch (error) {
      this.logger.warn(
        `Could not load role-based prefixes from DB, using built-in list (${ROLE_BASED_PREFIXES.length}). ` +
          (error instanceof Error ? error.message : String(error)),
      );
      this.prefixes = new Set<string>(ROLE_BASED_PREFIXES);
    }
  }

  isRoleBased(localPart: string): boolean {
    const base = localPart.split('+')[0].toLowerCase();
    return this.prefixes.has(base);
  }
}
