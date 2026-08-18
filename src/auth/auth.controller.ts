import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Environment } from '../platform/config/environment';
import { PlatformError } from '../platform/errors/platform-error';
import { OriginValidator } from '../platform/http/origin-validator.service';
import { AccessTokenGuard } from './access-token.guard';
import type { AuthenticatedRequest } from './access-token.guard';
import { AuthService } from './auth.service';
import { CredentialsDto } from './dto/credentials.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environment, true>,
    private readonly origins: OriginValidator,
  ) {}

  @Post('register')
  register(@Body() credentials: CredentialsDto) {
    return this.auth.register(credentials);
  }

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

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  @UseGuards(AccessTokenGuard)
  async logoutAll(@Req() request: AuthenticatedRequest): Promise<void> {
    if (request.principal === undefined) {
      throw new PlatformError('UNAUTHORIZED');
    }
    await this.auth.logoutAll(request.principal.id);
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
