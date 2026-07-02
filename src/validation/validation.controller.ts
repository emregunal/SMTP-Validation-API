import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { HistoryQueryDto } from './dto/history-query.dto';
import { SingleValidationDto } from './dto/single-validation.dto';
import {
  HistoryItemDto,
  ValidationResponseDto,
} from './dto/validation-response.dto';
import { ValidationService } from './validation.service';

@ApiTags('validation')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('api/validate')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Post('single')
  @ApiOperation({ summary: 'Validate a single email address (DNS/MX level)' })
  @ApiResponse({ status: 201, type: ValidationResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  async validateSingle(
    @Body() dto: SingleValidationDto,
  ): Promise<ValidationResponseDto> {
    return this.validationService.validateSingle(dto.email);
  }

  @Get('history')
  @ApiOperation({ summary: 'List recent validations (most recent first)' })
  @ApiResponse({ status: 200, type: [HistoryItemDto] })
  async getHistory(@Query() query: HistoryQueryDto): Promise<HistoryItemDto[]> {
    return this.validationService.getHistory(query);
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Get a single validation result by id' })
  @ApiResponse({ status: 200, type: ValidationResponseDto })
  @ApiResponse({ status: 404, description: 'Validation not found' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ValidationResponseDto> {
    return this.validationService.getById(id);
  }
}
