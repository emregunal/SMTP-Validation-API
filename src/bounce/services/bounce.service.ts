import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateBounceEventDto } from '../dto/create-bounce-event.dto';
import { EmailEvent, EmailReputation } from '../interfaces/bounce.interfaces';
import {
  BOUNCE_EVENT_REPOSITORY,
  BounceEventRepository,
} from '../repositories/bounce-event.repository.interface';

@Injectable()
export class BounceService {
  constructor(
    @Inject(BOUNCE_EVENT_REPOSITORY)
    private readonly repository: BounceEventRepository,
  ) {}

  async processEvent(dto: CreateBounceEventDto): Promise<EmailEvent> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const domain = normalizedEmail.split('@')[1] || '';

    const event: EmailEvent = {
      id: randomUUID(),
      email: dto.email,
      normalizedEmail,
      domain,
      eventType: dto.eventType,
      smtpCode: dto.smtpCode,
      enhancedCode: dto.enhancedCode,
      reason: dto.reason,
      provider: dto.provider,
      rawMessage: dto.rawMessage,
      occurredAt: dto.occurredAt,
      createdAt: new Date().toISOString(),
    };

    await this.repository.saveEvent(event);
    return event;
  }

  async getEmailHistory(email: string): Promise<{
    email: string;
    events: EmailEvent[];
    reputation: EmailReputation | null;
  }> {
    const events = await this.repository.getEventsByEmail(email);
    if (events.length === 0) {
      throw new NotFoundException(`No history found for ${email}`);
    }

    const reputation = await this.repository.getReputation(email);

    return {
      email,
      events,
      reputation,
    };
  }

  async getReputation(email: string): Promise<EmailReputation | null> {
    return this.repository.getReputation(email);
  }
}
