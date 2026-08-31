import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseUserIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (value.trim().length === 0) {
      throw new BadRequestException('Validation failed (user ID is required)');
    }
    return value;
  }
}
