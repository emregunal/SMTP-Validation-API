import { Module } from '@nestjs/common';
import { BounceController } from './bounce.controller';
import { BOUNCE_EVENT_REPOSITORY } from './repositories/bounce-event.repository.interface';
import { InMemoryBounceEventRepository } from './repositories/in-memory-bounce-event.repository';
import { BounceService } from './services/bounce.service';

@Module({
  controllers: [BounceController],
  providers: [
    BounceService,
    {
      provide: BOUNCE_EVENT_REPOSITORY,
      useClass: InMemoryBounceEventRepository,
    },
  ],
  exports: [BounceService],
})
export class BounceModule {}
