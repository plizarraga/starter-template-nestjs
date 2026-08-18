import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
