import { ApiProperty } from '@nestjs/swagger';

export class AccessTokenResponseDto {
  @ApiProperty({
    description: 'Short-lived JWT access token (600s by default).',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Access token lifetime in seconds.',
    example: 600,
  })
  expiresIn!: number;

  @ApiProperty({
    description: 'Token type, always "Bearer".',
    enum: ['Bearer'],
    example: 'Bearer',
  })
  tokenType!: 'Bearer';
}
