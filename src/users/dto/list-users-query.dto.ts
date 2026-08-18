import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const sortFields = ['email', 'role', 'createdAt', 'updatedAt'] as const;
export type SortField = (typeof sortFields)[number];

export const sortOrders = ['asc', 'desc'] as const;
export type SortOrder = (typeof sortOrders)[number];

export class ListUsersQueryDto {
  /**
   * Page to return (1-based).
   * @example 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /**
   * Number of users per page.
   * @example 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

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
