import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';
import { BounceEventType } from '../interfaces/bounce.interfaces';

export class CreateBounceEventDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    enum: [
      'hard_bounce',
      'soft_bounce',
      'delivered',
      'complained',
      'unsubscribed',
    ],
    example: 'hard_bounce',
  })
  @IsEnum([
    'hard_bounce',
    'soft_bounce',
    'delivered',
    'complained',
    'unsubscribed',
  ])
  eventType!: BounceEventType;

  @ApiPropertyOptional({ example: '550' })
  @IsOptional()
  @IsString()
  smtpCode?: string;

  @ApiPropertyOptional({ example: '5.1.1' })
  @IsOptional()
  @IsString()
  enhancedCode?: string;

  @ApiPropertyOptional({ example: 'user_not_found' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 'sendgrid' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({
    example:
      '550 5.1.1 The email account that you tried to reach does not exist.',
  })
  @IsOptional()
  @IsString()
  rawMessage?: string;

  @ApiProperty({ example: '2026-07-01T12:00:00Z' })
  @IsISO8601()
  occurredAt!: string;
}
