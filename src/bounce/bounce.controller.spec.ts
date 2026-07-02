import { Test, TestingModule } from '@nestjs/testing';
import { BounceController } from './bounce.controller';
import { BounceService } from './services/bounce.service';
import { CreateBounceEventDto } from './dto/create-bounce-event.dto';
import { ConfigService } from '@nestjs/config';

describe('BounceController', () => {
  let controller: BounceController;
  let service: BounceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BounceController],
      providers: [
        {
          provide: BounceService,
          useValue: {
            processEvent: jest.fn(),
            getEmailHistory: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('dummy') },
        },
      ],
    }).compile();

    controller = module.get<BounceController>(BounceController);
    service = module.get<BounceService>(BounceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createEvent', () => {
    it('should call service.processEvent', async () => {
      const dto: CreateBounceEventDto = {
        email: 'test@example.com',
        eventType: 'hard_bounce',
        occurredAt: '2026-07-01T12:00:00Z',
      };
      const result = {
        id: 'uuid',
        ...dto,
        normalizedEmail: 'test@example.com',
        domain: 'example.com',
        createdAt: '',
      };
      jest.spyOn(service, 'processEvent').mockResolvedValue(result);

      expect(await controller.createEvent(dto)).toBe(result);
      expect(service.processEvent).toHaveBeenCalledWith(dto);
    });
  });

  describe('getEmailHistory', () => {
    it('should call service.getEmailHistory', async () => {
      const email = 'test@example.com';
      const result = { email, events: [], reputation: null };
      jest.spyOn(service, 'getEmailHistory').mockResolvedValue(result);

      expect(await controller.getEmailHistory(email)).toBe(result);
      expect(service.getEmailHistory).toHaveBeenCalledWith(email);
    });
  });
});
