import { ApiProperty } from '@nestjs/swagger';

export class PlatformErrorResponseDto {
  @ApiProperty({ example: 'FORBIDDEN' })
  code!: string;

  @ApiProperty({ example: 'Forbidden resource' })
  message!: string;

  @ApiProperty({ example: '/users' })
  path!: string;

  @ApiProperty({ example: 'request-id' })
  requestId!: string;

  @ApiProperty({ example: 403 })
  statusCode!: number;

  @ApiProperty({
    format: 'date-time',
    example: '2026-08-23T21:00:00.000Z',
  })
  timestamp!: string;
}
