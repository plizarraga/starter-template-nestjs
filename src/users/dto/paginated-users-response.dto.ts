import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UserResponseDto } from './user-response.dto';

export class PaginatedUsersResponseDto extends PaginatedResponseDto(
  UserResponseDto,
) {}
