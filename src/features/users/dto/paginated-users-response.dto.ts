import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';
import { UserResponseDto } from './user-response.dto';

export class PaginatedUsersResponseDto extends PaginatedResponseDto(
  UserResponseDto,
) {}
