import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PlatformError } from '../platform/errors/platform-error';
import { PlatformErrorResponseDto } from '../platform/errors/platform-error-response.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { ParseUserIdPipe } from './pipes/parse-user-id.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  description: 'Requires an active session.',
  type: PlatformErrorResponseDto,
})
@Controller('users')
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiOkResponse({
    description: 'The profile of the authenticated user.',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User was not found (USER_NOT_FOUND).',
    type: PlatformErrorResponseDto,
  })
  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    const principal = this.principal(request);
    const user = await this.users.findPublicById(principal.id);
    if (user === null) {
      throw new PlatformError('USER_NOT_FOUND');
    }
    return user;
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List users (paginated, searchable, sortable)' })
  @ApiOkResponse({
    description: 'A page of users with pagination metadata.',
    type: PaginatedUsersResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation.',
    type: PlatformErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Requires the ADMIN role.',
    type: PlatformErrorResponseDto,
  })
  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiOkResponse({
    description: 'The requested user.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'The user id failed validation.',
    type: PlatformErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Requires the ADMIN role.',
    type: PlatformErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User was not found (USER_NOT_FOUND).',
    type: PlatformErrorResponseDto,
  })
  @Get(':id')
  async getById(@Param('id', ParseUserIdPipe) id: string) {
    const user = await this.users.findPublicById(id);
    if (user === null) {
      throw new PlatformError('USER_NOT_FOUND');
    }
    return user;
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a user email or role' })
  @ApiOkResponse({
    description: 'The updated user.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'The user id or request body failed validation.',
    type: PlatformErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Requires the ADMIN role.',
    type: PlatformErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User was not found (USER_NOT_FOUND).',
    type: PlatformErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Would remove the last ADMIN (CANNOT_REMOVE_LAST_ADMIN) or the acting admin role (CANNOT_REMOVE_OWN_ADMIN_ROLE).',
    type: PlatformErrorResponseDto,
  })
  @Patch(':id')
  updateAdmin(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUserIdPipe) id: string,
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
