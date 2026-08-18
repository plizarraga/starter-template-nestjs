import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const sortFields = ['email', 'role', 'createdAt', 'updatedAt'] as const;
export type SortField = (typeof sortFields)[number];

export const sortOrders = ['asc', 'desc'] as const;
export type SortOrder = (typeof sortOrders)[number];

export class ListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  search?: string;

  @IsOptional()
  @IsIn(sortFields)
  sortBy: SortField = 'createdAt';

  @IsOptional()
  @IsIn(sortOrders)
  sortOrder: SortOrder = 'desc';
}
