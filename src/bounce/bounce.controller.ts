import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CreateBounceEventDto } from './dto/create-bounce-event.dto';
import { BounceService } from './services/bounce.service';

@ApiTags('bounce')
@Controller('api')
export class BounceController {
  constructor(private readonly bounceService: BounceService) {}

  @Post('bounce-events')
  @UseGuards(ApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true, description: 'API anahtarı' })
  @ApiOperation({ summary: 'Yeni bir bounce/delivery event kaydeder' })
  @ApiResponse({ status: 201, description: 'Event başarıyla kaydedildi' })
  async createEvent(@Body() dto: CreateBounceEventDto) {
    return this.bounceService.processEvent(dto);
  }

  @Get('email-history/:email')
  @UseGuards(ApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true, description: 'API anahtarı' })
  @ApiOperation({
    summary:
      'Belirli bir email adresine ait geçmiş logları ve reputation değerini döner',
  })
  @ApiResponse({
    status: 200,
    description: 'Email geçmişi ve reputation objesi',
  })
  @ApiResponse({ status: 404, description: 'Email için kayıt bulunamadı' })
  async getEmailHistory(@Param('email') email: string) {
    return this.bounceService.getEmailHistory(email);
  }
}
