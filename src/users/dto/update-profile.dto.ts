import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  /**
   * Current password, used to prove ownership.
   * @example Current-P@ssw0rd
   */
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  /**
   * New email. Lowercased and trimmed on arrival.
   * @example new.email@example.com
   */
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;
}
