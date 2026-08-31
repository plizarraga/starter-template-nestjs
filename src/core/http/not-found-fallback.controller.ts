import {
  All,
  Controller,
  NotFoundException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Public } from '../../features/auth/decorators/public.decorator';

@Controller({ version: VERSION_NEUTRAL })
@Public()
export class NotFoundFallbackController {
  @All('*path')
  handle(): never {
    throw new NotFoundException('Resource not found');
  }
}
