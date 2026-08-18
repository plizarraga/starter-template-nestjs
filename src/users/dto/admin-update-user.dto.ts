import { Role } from '../../generated/prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export class AdminUpdateUserDto {
  /**
   * New email for the user.
   * @example user@example.com
   */
  @IsOptional()
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  /**
   * New role for the user.
   * @example USER
   */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
