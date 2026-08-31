import { PaginatedResponseDto } from '../../../shared/pagination/pagination.dto';
import { UserResponseDto } from './user-response.dto';

export class PaginatedUsersResponseDto extends PaginatedResponseDto(
  UserResponseDto,
) {}
