import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PlatformError } from '../platform/errors/platform-error';
import { PublicUser, UsersService } from '../users/users.service';
import { AccessTokenService } from './access-token.service';
import { AuthSessionRepository } from './auth-session.repository';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CredentialsDto } from './dto/credentials.dto';
import { PasswordService } from './password.service';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly accessTokens: AccessTokenService,
    private readonly sessions: AuthSessionRepository,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
  ) {}

  async register(credentials: CredentialsDto): Promise<PublicUser> {
    const email = this.normalizeEmail(credentials.email);
    const passwordHash = await this.passwords.hash(credentials.password);
    const user = await this.users.create({
      email,
      passwordHash,
      role: Role.USER,
    });
    this.logger.info({ event: 'auth.register.success', userId: user.id });
    return user;
  }

  async login(credentials: CredentialsDto) {
    const user = await this.users.findByEmailWithPassword(
      this.normalizeEmail(credentials.email),
    );
    if (user === null) {
      await this.passwords.consumeVerificationCost(credentials.password);
      return this.rejectInvalidCredentials();
    }
    if (
      !(await this.passwords.verify(credentials.password, user.passwordHash))
    ) {
      return this.rejectInvalidCredentials();
    }

    const refreshToken = await this.sessions.create(user.id);
    const accessToken = await this.accessTokens.issue({
      id: user.id,
      role: user.role,
    });
    this.logger.info({
      event: 'auth.login.success',
      sessionId: refreshToken.split('.')[0],
      userId: user.id,
    });

    return {
      accessToken,
      expiresIn: this.accessTokens.expiresIn(),
      refreshToken,
      tokenType: 'Bearer' as const,
    };
  }

  async refresh(refreshToken: string) {
    const replacement = await this.sessions.rotate(refreshToken);
    const user = await this.users.findById(replacement.userId);
    if (user === null) {
      throw new PlatformError('INVALID_REFRESH_TOKEN');
    }
    const accessToken = await this.accessTokens.issue(user);
    this.logger.info({
      event: 'auth.refresh.success',
      sessionId: replacement.refreshToken.split('.')[0],
      userId: user.id,
    });
    return {
      accessToken,
      expiresIn: this.accessTokens.expiresIn(),
      refreshToken: replacement.refreshToken,
      tokenType: 'Bearer' as const,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    await this.sessions.revoke(refreshToken);
    this.logger.info({ event: 'auth.logout' });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAll(userId);
    this.logger.info({ event: 'auth.logout_all', userId });
  }

  async updateProfile(
    userId: string,
    profile: UpdateProfileDto,
  ): Promise<PublicUser> {
    const user = await this.currentUser(userId, profile.currentPassword);
    const updated = await this.users.transact(async (users) => {
      const updated = await users.updateEmail(
        user.id,
        this.normalizeEmail(profile.email),
      );
      await this.sessions.revokeAll(user.id);
      return updated;
    });
    this.logger.info({ event: 'auth.profile_updated', userId: user.id });
    return updated;
  }

  async changePassword(
    userId: string,
    passwords: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.currentUser(userId, passwords.currentPassword);
    const passwordHash = await this.passwords.hash(passwords.newPassword);
    await this.users.transact(async (users) => {
      await users.updatePassword(user.id, passwordHash);
      await this.sessions.revokeAll(user.id);
    });
    this.logger.info({ event: 'auth.password_changed', userId: user.id });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async currentUser(userId: string, password: string) {
    const user = await this.users.findByIdWithPassword(userId);
    if (user === null) {
      throw new PlatformError('USER_NOT_FOUND');
    }
    if (!(await this.passwords.verify(password, user.passwordHash))) {
      throw new PlatformError('INVALID_CREDENTIALS');
    }
    return user;
  }

  private rejectInvalidCredentials(): never {
    this.logger.warn({ event: 'auth.login.failure' });
    throw new PlatformError('INVALID_CREDENTIALS');
  }
}
