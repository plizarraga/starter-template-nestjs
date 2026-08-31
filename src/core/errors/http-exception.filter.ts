import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { errorDefinitions, PlatformError } from './platform-error';
import { RequestWithId } from '../request-id/request-id.middleware';

type ErrorResponse = {
  code: string;
  message: string;
  statusCode: number;
};

const errorByStatus: Record<number, ErrorResponse> = {
  [HttpStatus.BAD_REQUEST]: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    statusCode: HttpStatus.BAD_REQUEST,
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: 'UNAUTHORIZED',
    message: 'Unauthorized',
    statusCode: HttpStatus.UNAUTHORIZED,
  },
  [HttpStatus.FORBIDDEN]: {
    code: 'FORBIDDEN',
    message: 'Forbidden resource',
    statusCode: HttpStatus.FORBIDDEN,
  },
  [HttpStatus.NOT_FOUND]: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    statusCode: HttpStatus.NOT_FOUND,
  },
  [HttpStatus.CONFLICT]: {
    code: 'CONFLICT',
    message: 'Request conflicts with the current resource state',
    statusCode: HttpStatus.CONFLICT,
  },
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const exceptionStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const error =
      exception instanceof PlatformError
        ? { ...exception.definition, code: exception.code }
        : (errorByStatus[exceptionStatus] ?? {
            ...errorDefinitions.INTERNAL_SERVER_ERROR,
            code: 'INTERNAL_SERVER_ERROR',
            statusCode: exceptionStatus,
          });

    if (error.statusCode >= 500) {
      this.logger.error(
        { err: exception, requestId: request.requestId },
        'Unhandled request exception',
      );
    }

    response.status(error.statusCode).json({
      ...error,
      path: request.originalUrl,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
