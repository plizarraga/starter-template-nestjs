import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  /**
   * Current password, used to prove ownership.
   * @example Current-P@ssw0rd
   */
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  /**
   * New password. All refresh sessions are revoked after the change.
   * @example New-P@ssw0rd-2026
   */
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
