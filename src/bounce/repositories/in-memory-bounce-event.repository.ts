import { Injectable } from '@nestjs/common';
import { BounceEventRepository } from './bounce-event.repository.interface';
import { EmailEvent, EmailReputation } from '../interfaces/bounce.interfaces';

@Injectable()
export class InMemoryBounceEventRepository implements BounceEventRepository {
  private events: EmailEvent[] = [];
  private readonly MAX_EVENTS = 10000;

  async saveEvent(event: EmailEvent): Promise<void> {
    this.events.push(event);

    // Evict old events if we exceed the limit
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift(); // Remove the oldest event
    }
  }

  async getEventsByEmail(email: string): Promise<EmailEvent[]> {
    const normalized = email.trim().toLowerCase();
    return this.events.filter((e) => e.normalizedEmail === normalized);
  }

  async getReputation(email: string): Promise<EmailReputation | null> {
    const events = await this.getEventsByEmail(email);
    if (events.length === 0) return null;

    const normalized = email.trim().toLowerCase();
    const domain = normalized.split('@')[1] || '';

    let hardBounceCount = 0;
    let softBounceCount = 0;
    let deliveredCount = 0;
    let complaintCount = 0;
    let unsubscribedCount = 0;

    // Sort by occurredAt ascending to find the true 'last' event
    const sortedEvents = [...events].sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );

    const lastEvent = sortedEvents[sortedEvents.length - 1];

    for (const e of sortedEvents) {
      switch (e.eventType) {
        case 'hard_bounce':
          hardBounceCount++;
          break;
        case 'soft_bounce':
          softBounceCount++;
          break;
        case 'delivered':
          deliveredCount++;
          break;
        case 'complained':
          complaintCount++;
          break;
        case 'unsubscribed':
          unsubscribedCount++;
          break;
      }
    }

    let confidence: 'high' | 'medium' | 'low' = 'low';
    let reputationScore = 50;

    if (hardBounceCount > 0) {
      confidence = 'high';
      reputationScore = 0;
    } else if (complaintCount > 0) {
      confidence = 'high';
      reputationScore = 10;
    } else if (deliveredCount > 0) {
      confidence = 'high';
      reputationScore = 100;
    } else if (softBounceCount > 0) {
      confidence = 'medium';
      reputationScore = 30;
    }

    return {
      email,
      normalizedEmail: normalized,
      domain,
      lastEventType: lastEvent.eventType,
      hardBounceCount,
      softBounceCount,
      deliveredCount,
      complaintCount,
      unsubscribedCount,
      lastSeenAt: lastEvent.occurredAt,
      reputationScore,
      confidence,
    };
  }

  // Used only for testing
  clear() {
    this.events = [];
  }
}
