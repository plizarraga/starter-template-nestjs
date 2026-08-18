import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PlatformError } from '../platform/errors/platform-error';
import { PublicUser } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { AccessTokenService } from './access-token.service';
import { AuthSessionRepository } from './auth-session.repository';
import { CredentialsDto } from './dto/credentials.dto';
import { PasswordService } from './password.service';

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
    if (
      user === null ||
      !(await this.passwords.verify(credentials.password, user.passwordHash))
    ) {
      this.logger.warn({ event: 'auth.login.failure' });
      throw new PlatformError('INVALID_CREDENTIALS');
    }

    const sessionId = await this.sessions.create(user.id);
    const accessToken = await this.accessTokens.issue({
      id: user.id,
      role: user.role,
    });
    this.logger.info({
      event: 'auth.login.success',
      sessionId,
      userId: user.id,
    });

    return {
      accessToken,
      expiresIn: this.accessTokens.expiresIn(),
      tokenType: 'Bearer' as const,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
