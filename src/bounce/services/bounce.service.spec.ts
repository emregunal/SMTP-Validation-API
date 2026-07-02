import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateBounceEventDto } from '../dto/create-bounce-event.dto';
import { BOUNCE_EVENT_REPOSITORY } from '../repositories/bounce-event.repository.interface';
import { InMemoryBounceEventRepository } from '../repositories/in-memory-bounce-event.repository';
import { BounceService } from './bounce.service';

describe('BounceService', () => {
  let service: BounceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BounceService,
        {
          provide: BOUNCE_EVENT_REPOSITORY,
          useClass: InMemoryBounceEventRepository,
        },
      ],
    }).compile();

    service = module.get<BounceService>(BounceService);
  });

  it('should process and save event', async () => {
    const dto: CreateBounceEventDto = {
      email: ' Test@example.com ',
      eventType: 'hard_bounce',
      occurredAt: '2026-07-01T12:00:00Z',
    };

    const event = await service.processEvent(dto);
    expect(event.normalizedEmail).toBe('test@example.com');
    expect(event.domain).toBe('example.com');
    expect(event.eventType).toBe('hard_bounce');

    const history = await service.getEmailHistory('test@example.com');
    expect(history.events.length).toBe(1);
    expect(history.reputation?.hardBounceCount).toBe(1);
    expect(history.reputation?.confidence).toBe('high');
    expect(history.reputation?.reputationScore).toBe(0);
  });

  it('should compute reputation correctly with multiple events', async () => {
    await service.processEvent({
      email: 'u@example.com',
      eventType: 'soft_bounce',
      occurredAt: '2026-07-01T10:00:00Z',
    });
    await service.processEvent({
      email: 'u@example.com',
      eventType: 'delivered',
      occurredAt: '2026-07-01T11:00:00Z',
    });

    const history = await service.getEmailHistory('u@example.com');
    expect(history.events.length).toBe(2);
    expect(history.reputation?.deliveredCount).toBe(1);
    expect(history.reputation?.softBounceCount).toBe(1);
    // delivered overrides soft bounce in score
    expect(history.reputation?.confidence).toBe('high');
    expect(history.reputation?.reputationScore).toBe(100);
  });

  it('should throw NotFoundException if no history', async () => {
    await expect(
      service.getEmailHistory('unknown@example.com'),
    ).rejects.toThrow(NotFoundException);
  });
});
