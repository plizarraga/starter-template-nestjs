import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../shared/decorators/public.decorator';
import {
  LivenessResponseDto,
  ReadinessResponseDto,
} from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @ApiOperation({ summary: 'Check process liveness' })
  @ApiOkResponse({
    description: 'The process is responding.',
    type: LivenessResponseDto,
  })
  @Get('live')
  live(): LivenessResponseDto {
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Check PostgreSQL readiness' })
  @ApiOkResponse({
    description: 'PostgreSQL is available.',
    type: ReadinessResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'PostgreSQL is unavailable.',
    type: ReadinessResponseDto,
  })
  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    const { ready, checks } = await this.health.checkReadiness();
    response.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ready ? 'ok' : 'error', checks };
  }
}
