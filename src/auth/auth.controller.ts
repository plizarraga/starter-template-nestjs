import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { Environment } from '../platform/config/environment';
import { PlatformError } from '../platform/errors/platform-error';
import { OriginValidator } from '../platform/http/origin-validator.service';
import { RATE_LIMIT_NAMES } from '../platform/rate-limit/rate-limit-names';
import { RedisThrottlerGuard } from '../platform/rate-limit/redis-throttler.guard';
import { AccessTokenGuard } from './access-token.guard';
import type { AuthenticatedRequest } from './access-token.guard';
import { AuthService } from './auth.service';
import { AccessTokenResponseDto } from './dto/access-token-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CredentialsDto } from './dto/credentials.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environment, true>,
    private readonly origins: OriginValidator,
  ) {}

  @UseGuards(RedisThrottlerGuard)
  @SkipThrottle({
    [RATE_LIMIT_NAMES.LOGIN]: true,
    [RATE_LIMIT_NAMES.REFRESH]: true,
  })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({
    description: 'The created user (role USER).',
    type: UserResponseDto,
  })
  @ApiConflictResponse({
    description:
      'A user with this email already exists (USER_EMAIL_ALREADY_EXISTS).',
  })
  @Post('register')
  register(@Body() credentials: CredentialsDto) {
    return this.auth.register(credentials);
  }

  @UseGuards(RedisThrottlerGuard)
  @SkipThrottle({
    [RATE_LIMIT_NAMES.REFRESH]: true,
    [RATE_LIMIT_NAMES.REGISTER]: true,
  })
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({
    description:
      'Access token payload. The refresh token is set as an httpOnly cookie scoped to /auth.',
    type: AccessTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials (INVALID_CREDENTIALS).',
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() credentials: CredentialsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...access } = await this.auth.login(credentials);
    this.setRefreshCookie(response, refreshToken);
    return access;
  }

  @UseGuards(RedisThrottlerGuard)
  @SkipThrottle({
    [RATE_LIMIT_NAMES.LOGIN]: true,
    [RATE_LIMIT_NAMES.REGISTER]: true,
  })
  @ApiOperation({ summary: 'Rotate the refresh session' })
  @ApiOkResponse({
    description:
      'New access token payload; the refresh cookie is rotated. ' +
      'Requires the refresh cookie set by login.',
    type: AccessTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing or invalid refresh cookie (INVALID_REFRESH_TOKEN), or Origin not allowed.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.origins.requireAllowed(request.headers.origin);
    const refreshToken = this.readRefreshCookie(request);
    if (refreshToken === undefined) {
      throw new PlatformError('INVALID_REFRESH_TOKEN');
    }
    const { refreshToken: replacement, ...access } =
      await this.auth.refresh(refreshToken);
    this.setRefreshCookie(response, replacement);
    return access;
  }

  @ApiOperation({ summary: 'Revoke the current refresh session' })
  @ApiNoContentResponse({
    description:
      'Refresh session revoked and cookie cleared. Requires the refresh cookie set by login.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid refresh cookie (INVALID_REFRESH_TOKEN).',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.origins.requireAllowed(request.headers.origin);
    await this.auth.logout(this.readRefreshCookie(request));
    response.clearCookie(
      this.config.getOrThrow<string>('COOKIE_NAME'),
      this.cookieOptions(),
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke all refresh sessions for the current user' })
  @ApiNoContentResponse({ description: 'All refresh sessions revoked.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  @UseGuards(AccessTokenGuard)
  async logoutAll(@Req() request: AuthenticatedRequest): Promise<void> {
    if (request.principal === undefined) {
      throw new PlatformError('UNAUTHORIZED');
    }
    await this.auth.logoutAll(request.principal.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change the current user password' })
  @ApiNoContentResponse({
    description: 'Password updated and all refresh sessions revoked.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('password')
  @UseGuards(AccessTokenGuard)
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() passwords: ChangePasswordDto,
  ): Promise<void> {
    if (request.principal === undefined) {
      throw new PlatformError('UNAUTHORIZED');
    }
    await this.auth.changePassword(request.principal.id, passwords);
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(
      this.config.getOrThrow<string>('COOKIE_NAME'),
      refreshToken,
      this.cookieOptions(),
    );
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      maxAge:
        this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 86_400_000,
      path: '/auth',
      sameSite: 'lax' as const,
      secure: this.config.getOrThrow<string>('NODE_ENV') === 'production',
    };
  }

  private readRefreshCookie(request: Request): string | undefined {
    const name = this.config.getOrThrow<string>('COOKIE_NAME');
    const entry = request.headers.cookie
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`));
    if (entry === undefined) {
      return undefined;
    }
    try {
      return decodeURIComponent(entry.slice(name.length + 1));
    } catch {
      return undefined;
    }
  }
}
