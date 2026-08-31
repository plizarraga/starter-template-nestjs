import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const requestIdHeader = 'x-request-id';
const trustedRequestId = /^[A-Za-z0-9._-]{1,128}$/;

export type RequestWithId = Request & { requestId: string };

export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const requestId = request.header(requestIdHeader);

  request.requestId =
    requestId !== undefined && trustedRequestId.test(requestId)
      ? requestId
      : randomUUID();
  response.setHeader(requestIdHeader, request.requestId);
  next();
}
