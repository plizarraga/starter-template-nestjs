import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/access-token.guard';
import { AuthService } from '../auth/auth.service';
import { PlatformError } from '../platform/errors/platform-error';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    const principal = this.principal(request);
    const user = await this.users.findPublicById(principal.id);
    if (user === null) {
      throw new PlatformError('USER_NOT_FOUND');
    }
    return user;
  }

  @Patch('me')
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() profile: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(this.principal(request).id, profile);
  }

  private principal(request: AuthenticatedRequest) {
    if (request.principal === undefined) {
      throw new PlatformError('UNAUTHORIZED');
    }
    return request.principal;
  }
}
