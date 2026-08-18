import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class PaginationMetaDto {
  @ApiProperty({ description: 'Whether a next page exists.', example: false })
  hasNextPage!: boolean;

  @ApiProperty({
    description: 'Whether a previous page exists.',
    example: true,
  })
  hasPreviousPage!: boolean;

  @ApiProperty({
    description: 'Number of items requested per page.',
    example: 20,
  })
  limit!: number;

  @ApiProperty({ description: 'Current page (1-based).', example: 2 })
  page!: number;

  @ApiProperty({ description: 'Total number of matching users.', example: 42 })
  total!: number;

  @ApiProperty({ description: 'Total number of pages.', example: 3 })
  totalPages!: number;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data!: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
