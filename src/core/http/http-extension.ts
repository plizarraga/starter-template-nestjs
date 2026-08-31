import type { OpenAPIObject } from '@nestjs/swagger';
import type { RequestHandler } from 'express';

export const HTTP_EXTENSION = Symbol('HTTP_EXTENSION');

/**
 * Contract a feature implements to plug its own Express handler into the
 * request pipeline before body parsing, and to contribute the routes it owns to
 * the generated OpenAPI document.
 *
 * `configureApplication` owns middleware ordering; the feature owns what is
 * mounted and how it is documented. That keeps the dependency pointing from the
 * feature to core, never the other way around.
 */
export interface HttpExtension {
  /** Path the handler is mounted on, e.g. `/api/auth`. */
  readonly basePath: string;
  handler(): RequestHandler;
  contributeOpenApiDocument(document: OpenAPIObject): Promise<void>;
}
