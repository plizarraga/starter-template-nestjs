import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';

export const sortFields = ['email', 'role', 'createdAt', 'updatedAt'] as const;
export type SortField = (typeof sortFields)[number];

export const sortOrders = ['asc', 'desc'] as const;
export type SortOrder = (typeof sortOrders)[number];

export class ListUsersQueryDto extends PaginationQueryDto {
  /**
   * Case-insensitive substring match on email.
   * @example user@example.com
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  search?: string;

  /**
   * Field to sort by.
   * @example createdAt
   */
  @IsOptional()
  @IsIn(sortFields)
  sortBy: SortField = 'createdAt';

  /**
   * Sort direction.
   * @example desc
   */
  @IsOptional()
  @IsIn(sortOrders)
  sortOrder: SortOrder = 'desc';
}
