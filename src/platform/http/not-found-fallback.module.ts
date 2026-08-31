import { Module } from '@nestjs/common';
import { NotFoundFallbackController } from './not-found-fallback.controller';

@Module({
  controllers: [NotFoundFallbackController],
})
export class NotFoundFallbackModule {}
