import { EmailEvent, EmailReputation } from '../interfaces/bounce.interfaces';

export interface BounceEventRepository {
  /**
   * Saves a new bounce/delivery event.
   */
  saveEvent(event: EmailEvent): Promise<void>;

  /**
   * Retrieves all events for a given email address.
   */
  getEventsByEmail(email: string): Promise<EmailEvent[]>;

  /**
   * Calculates and retrieves the current reputation for a given email address.
   */
  getReputation(email: string): Promise<EmailReputation | null>;
}

export const BOUNCE_EVENT_REPOSITORY = Symbol('BOUNCE_EVENT_REPOSITORY');
