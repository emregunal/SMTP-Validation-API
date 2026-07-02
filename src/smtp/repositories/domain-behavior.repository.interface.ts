import { DomainBehavior } from '../../common/types/validation.types';

export interface DomainBehaviorRepository {
  /** Gets the behavior for a domain if it exists and hasn't expired. */
  get(domain: string): Promise<DomainBehavior | null>;

  /** Saves or updates the domain behavior. */
  set(domain: string, behavior: DomainBehavior, ttlMs: number): Promise<void>;

  /** Deletes the domain behavior from the cache. */
  delete(domain: string): Promise<void>;
}

export const DOMAIN_BEHAVIOR_REPOSITORY_TOKEN = Symbol(
  'DomainBehaviorRepository',
);
