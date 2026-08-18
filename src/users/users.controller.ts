import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/access-token.guard';
import { AuthService } from '../auth/auth.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PlatformError } from '../platform/errors/platform-error';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
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

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  async getById(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.users.findPublicById(id);
    if (user === null) {
      throw new PlatformError('USER_NOT_FOUND');
    }
    return user;
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  updateAdmin(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() patch: AdminUpdateUserDto,
  ) {
    return this.users.updateAdmin(this.principal(request).id, id, patch);
  }

  private principal(request: AuthenticatedRequest) {
    if (request.principal === undefined) {
      throw new PlatformError('UNAUTHORIZED');
    }
    return request.principal;
  }
}
