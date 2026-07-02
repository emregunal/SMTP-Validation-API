import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SingleValidationDto {
  @ApiProperty({
    description: 'The email address to validate.',
    example: 'user@example.com',
    maxLength: 320,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(320) // RFC 5321 maximum email length.
  email!: string;
}
