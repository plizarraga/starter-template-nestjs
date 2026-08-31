import { HttpStatus } from '@nestjs/common';

type ErrorDefinition = {
  message: string;
  statusCode: HttpStatus;
};

export const errorDefinitions = {
  CANNOT_REMOVE_LAST_ADMIN: {
    message: 'This operation would leave zero administrators',
    statusCode: HttpStatus.CONFLICT,
  },
  CANNOT_REMOVE_OWN_ADMIN_ROLE: {
    message: 'Administrators cannot remove their own ADMIN role',
    statusCode: HttpStatus.CONFLICT,
  },
  FORBIDDEN: {
    message: 'Forbidden resource',
    statusCode: HttpStatus.FORBIDDEN,
  },
  INTERNAL_SERVER_ERROR: {
    message: 'An unexpected error occurred',
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  NOT_FOUND: {
    message: 'Resource not found',
    statusCode: HttpStatus.NOT_FOUND,
  },
  SERVICE_UNAVAILABLE: {
    message: 'Required service is unavailable',
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
  },
  UNAUTHORIZED: {
    message: 'Unauthorized',
    statusCode: HttpStatus.UNAUTHORIZED,
  },
  USER_EMAIL_ALREADY_EXISTS: {
    message: 'A user with this email already exists',
    statusCode: HttpStatus.CONFLICT,
  },
  USER_NOT_FOUND: {
    message: 'User was not found',
    statusCode: HttpStatus.NOT_FOUND,
  },
  VALIDATION_ERROR: {
    message: 'Request validation failed',
    statusCode: HttpStatus.BAD_REQUEST,
  },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof errorDefinitions;

export class PlatformError extends Error {
  readonly definition: ErrorDefinition;

  constructor(readonly code: ErrorCode) {
    super(errorDefinitions[code].message);
    this.definition = errorDefinitions[code];
  }
}
