import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Environment } from '../platform/config/environment';
import { UsersModule } from '../users/users.module';
import { AccessTokenGuard } from './access-token.guard';
import { AccessTokenService } from './access-token.service';
import { AuthController } from './auth.controller';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

@Module({
  controllers: [AuthController],
  exports: [AccessTokenGuard, AccessTokenService, AuthService],
  imports: [
    forwardRef(() => UsersModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          audience: config.getOrThrow('JWT_AUDIENCE'),
          expiresIn: config.getOrThrow('ACCESS_TOKEN_TTL_SECONDS'),
          issuer: config.getOrThrow('JWT_ISSUER'),
        },
        verifyOptions: {
          algorithms: ['HS256'],
          audience: config.getOrThrow('JWT_AUDIENCE'),
          issuer: config.getOrThrow('JWT_ISSUER'),
        },
      }),
    }),
  ],
  providers: [
    AccessTokenGuard,
    AccessTokenService,
    AuthService,
    AuthSessionRepository,
    PasswordService,
  ],
})
export class AuthModule {}
