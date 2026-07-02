import { Injectable } from '@nestjs/common';
import { DomainBehaviorRepository } from './domain-behavior.repository.interface';
import { DomainBehavior } from '../../common/types/validation.types';

interface CacheEntry {
  behavior: DomainBehavior;
  expiresAt: number;
}

@Injectable()
export class InMemoryDomainBehaviorRepository implements DomainBehaviorRepository {
  private readonly store = new Map<string, CacheEntry>();

  async get(domain: string): Promise<DomainBehavior | null> {
    const entry = this.store.get(domain);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(domain);
      return null;
    }

    return entry.behavior;
  }

  async set(
    domain: string,
    behavior: DomainBehavior,
    ttlMs: number,
  ): Promise<void> {
    this.store.set(domain, {
      behavior,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async delete(domain: string): Promise<void> {
    this.store.delete(domain);
  }
}
