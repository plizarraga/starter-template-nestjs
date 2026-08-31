import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  DiscoveryModule,
  DiscoveryService,
  MetadataScanner,
  Reflector,
} from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { IS_PUBLIC_KEY } from '../../src/shared/decorators/public.decorator';
import { API_VERSIONED_PREFIX } from '../../src/core/http/api-version';
import { configureApplication } from '../../src/core/http/configure-application';
import { PrismaService } from '../../src/core/prisma/prisma.service';

type SupertestMethod =
  'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

type DiscoveredRoute = {
  method: SupertestMethod;
  path: string;
  isPublic: boolean;
};

function normalizePaths(value: unknown): string[] {
  if (value === undefined) {
    return [''];
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? [''] : (value as string[]);
  }
  return [value as string];
}

function joinPath(controllerPath: string, methodPath: string): string {
  const combined = `/${controllerPath}/${methodPath}`.replace(/\/+/g, '/');
  const withoutTrailingSlash =
    combined.length > 1 ? combined.replace(/\/$/, '') : combined;
  return withoutTrailingSlash.replace(/:[^/]+/g, 'route-sweep-placeholder');
}

function toSupertestMethod(requestMethod: RequestMethod): SupertestMethod {
  switch (requestMethod) {
    case RequestMethod.GET:
      return 'get';
    case RequestMethod.POST:
      return 'post';
    case RequestMethod.PUT:
      return 'put';
    case RequestMethod.DELETE:
      return 'delete';
    case RequestMethod.PATCH:
      return 'patch';
    case RequestMethod.OPTIONS:
      return 'options';
    case RequestMethod.HEAD:
      return 'head';
    case RequestMethod.ALL:
      return 'get';
    default:
      throw new Error(
        `Unsupported HTTP method in route sweep: ${String(requestMethod)}`,
      );
  }
}

function discoverRoutes(
  discovery: DiscoveryService,
  scanner: MetadataScanner,
  reflector: Reflector,
): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];

  for (const wrapper of discovery.getControllers()) {
    const instance: unknown = wrapper.instance;
    const metatype = wrapper.metatype;
    if (
      instance === null ||
      instance === undefined ||
      metatype === null ||
      metatype === undefined
    ) {
      continue;
    }
    const prototype = Object.getPrototypeOf(instance) as Record<
      string,
      unknown
    >;
    const controllerPaths = normalizePaths(
      Reflect.getMetadata(PATH_METADATA, metatype) as unknown,
    );

    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[methodName];
      const methodPathMeta = Reflect.getMetadata(
        PATH_METADATA,
        handler as object,
      ) as unknown;
      if (methodPathMeta === undefined) {
        continue;
      }
      const requestMethod = Reflect.getMetadata(
        METHOD_METADATA,
        handler as object,
      ) as RequestMethod;
      const isPublic =
        reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          handler as (...args: unknown[]) => unknown,
          metatype,
        ]) === true;

      for (const controllerPath of controllerPaths) {
        for (const methodPath of normalizePaths(methodPathMeta)) {
          routes.push({
            isPublic,
            method: toSupertestMethod(requestMethod),
            path: joinPath(controllerPath, methodPath),
          });
        }
      }
    }
  }

  return routes;
}

describe('route table sweep (e2e)', () => {
  let app: NestExpressApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('requires an active session on every registered route unless it is marked @Public()', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ check: () => Promise.resolve() })
      .compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const routes = discoverRoutes(
      moduleFixture.get(DiscoveryService),
      moduleFixture.get(MetadataScanner),
      moduleFixture.get(Reflector),
    );

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => !route.path.startsWith('/api/auth'))).toBe(
      true,
    );

    for (const route of routes) {
      const response = await request(app.getHttpServer())[route.method](
        `${API_VERSIONED_PREFIX}${route.path}`,
      );
      if (route.isPublic) {
        expect(response.status).not.toBe(401);
      } else {
        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
      }
    }
  });
});
