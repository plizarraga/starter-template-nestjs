import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CredentialsDto {
  /**
   * Email used to sign in. Lowercased and trimmed on arrival.
   * @example user@example.com
   */
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  /**
   * Plain-text password (argon2 hashed server-side).
   * @example P@ssw0rd-1234
   */
  @IsString()
  @MinLength(8)
  password!: string;
}
