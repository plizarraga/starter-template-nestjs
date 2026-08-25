import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { PaginationMeta } from './pagination-metadata';

export class PaginationMetaDto implements PaginationMeta {
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

  @ApiProperty({ description: 'Total number of matching items.', example: 42 })
  total!: number;

  @ApiProperty({ description: 'Total number of pages.', example: 3 })
  totalPages!: number;
}

export function PaginatedResponseDto<T>(
  itemDto: Type<T>,
): Type<{ data: T[]; meta: PaginationMetaDto }> {
  @applyDecorators(ApiExtraModels(itemDto))
  class PaginatedResponseDtoClass {
    @ApiProperty({
      type: 'array',
      items: { $ref: getSchemaPath(itemDto) },
    })
    data!: T[];

    @ApiProperty({ type: PaginationMetaDto })
    meta!: PaginationMetaDto;
  }

  Object.defineProperty(PaginatedResponseDtoClass, 'name', {
    value: `Paginated${itemDto.name}ResponseDto`,
  });

  return PaginatedResponseDtoClass;
}
