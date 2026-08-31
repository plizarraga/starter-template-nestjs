import { Role } from '../../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'Opaque user id.',
    example: 'user-id',
  })
  id!: string;

  @ApiProperty({
    description: 'Normalized email (lowercased).',
    format: 'email',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Assigned role.',
    enum: Role,
    example: Role.USER,
  })
  role!: Role;

  @ApiProperty({
    description: 'ISO-8601 creation timestamp.',
    format: 'date-time',
    example: '2026-01-01T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'ISO-8601 last update timestamp.',
    format: 'date-time',
    example: '2026-01-01T12:00:00.000Z',
  })
  updatedAt!: Date;
}
