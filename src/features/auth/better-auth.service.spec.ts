import type { OpenAPIObject } from '@nestjs/swagger';
import { describe, expect, it } from 'vitest';
import {
  AUTH_BASE_PATH,
  deriveCookieAttributes,
  findUnaccountedAuthPaths,
  mergeAuthOpenApiDocument,
} from './better-auth.service';

/**
 * Mirrors the shape Better Auth's `openAPI()` plugin emits: every operation
 * carries a bearer requirement against schemes this starter never implements.
 */
function createAuthSchema() {
  const operation = () => ({
    security: [{ bearerAuth: [] }],
    tags: ['Default'],
  });
  return {
    components: {
      schemas: { SignUpEmailBody: { type: 'object' } },
      securitySchemes: {
        apiKeyCookie: { type: 'apiKey', in: 'cookie', name: 'apiKeyCookie' },
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
    },
    paths: {
      '/sign-up/email': { post: operation() },
      '/sign-in/email': { post: operation() },
      '/sign-out': { post: operation() },
      '/get-session': { get: operation(), post: operation() },
      '/change-password': { post: operation() },
      '/list-sessions': { get: operation() },
      '/list-accounts': { get: operation() },
      '/revoke-session': {
        post: {
          ...operation(),
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RevokeSessionBody' },
              },
            },
          },
          responses: {
            200: {
              description: 'Session revoked',
              content: {
                'application/json': { schema: { type: 'object' } },
              },
            },
          },
        },
      },
      '/revoke-sessions': { post: operation() },
      '/revoke-other-sessions': { post: operation() },
      '/update-user': { post: operation() },
      '/verify-password': { post: operation() },
      '/ok': { get: operation() },
    },
  };
}

function createStarterDocument(): OpenAPIObject {
  return {
    openapi: '3.0.0',
    info: { title: 'Backend Starter API', version: '1.0' },
    components: {
      schemas: { UserResponseDto: { type: 'object' } },
      securitySchemes: {
        cookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
        },
      },
    },
    paths: {
      '/api/v1/users/me': {
        get: { responses: {}, security: [{ cookie: [] }] },
      },
    },
  };
}

function collectSecuritySchemeNames(document: OpenAPIObject): string[] {
  return Object.values(document.paths)
    .flatMap((item) => Object.values(item))
    .flatMap((operation: { security?: Record<string, unknown>[] }) =>
      Array.isArray(operation?.security) ? operation.security : [],
    )
    .flatMap((requirement) => Object.keys(requirement));
}

describe('deriveCookieAttributes', () => {
  it('When the topology is same-site outside production, then the cookie is Lax and not Secure', () => {
    expect(deriveCookieAttributes('same-site', 'development')).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
  });

  it('When the topology is same-site in production, then the cookie is Lax and Secure', () => {
    expect(deriveCookieAttributes('same-site', 'production')).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });
  });

  it('When the topology is cross-site, then the cookie is None, Secure, and Partitioned regardless of environment', () => {
    expect(deriveCookieAttributes('cross-site', 'development')).toEqual({
      httpOnly: true,
      partitioned: true,
      sameSite: 'none',
      secure: true,
    });
    expect(deriveCookieAttributes('cross-site', 'production')).toEqual({
      httpOnly: true,
      partitioned: true,
      sameSite: 'none',
      secure: true,
    });
  });
});

describe('mergeAuthOpenApiDocument', () => {
  it('When an authentication route needs a session, then it is published against the cookie scheme the starter declares', () => {
    const document = createStarterDocument();

    mergeAuthOpenApiDocument(document, createAuthSchema(), AUTH_BASE_PATH);

    expect(document.paths[`${AUTH_BASE_PATH}/get-session`]).toMatchObject({
      get: { security: [{ cookie: [] }], tags: ['auth'] },
      post: { security: [{ cookie: [] }], tags: ['auth'] },
    });
    expect(document.paths[`${AUTH_BASE_PATH}/sign-out`]).toMatchObject({
      post: { security: [{ cookie: [] }], tags: ['auth'] },
    });
  });

  it('When an authentication route issues a session, then it is published without a security requirement', () => {
    const document = createStarterDocument();

    mergeAuthOpenApiDocument(document, createAuthSchema(), AUTH_BASE_PATH);

    expect(document.paths[`${AUTH_BASE_PATH}/sign-up/email`]).toMatchObject({
      post: { security: [], tags: ['auth'] },
    });
    expect(document.paths[`${AUTH_BASE_PATH}/sign-in/email`]).toMatchObject({
      post: { security: [], tags: ['auth'] },
    });
  });

  it('When a path item carries non-operation keys, then only its operations are rewritten', () => {
    const document = createStarterDocument();
    const schema = createAuthSchema();
    const parameters = [{ in: 'header', name: 'x-trace-id' }];
    const item = {
      ...schema.paths['/get-session'],
      description: 'Reads the current session.',
      parameters,
      summary: 'Current session',
    };

    mergeAuthOpenApiDocument(
      document,
      { ...schema, paths: { ...schema.paths, '/get-session': item } },
      AUTH_BASE_PATH,
    );

    const published = document.paths[`${AUTH_BASE_PATH}/get-session`] as Record<
      string,
      unknown
    >;
    expect(published.parameters).toEqual(parameters);
    expect(published.summary).toBe('Current session');
    expect(published.description).toBe('Reads the current session.');
    expect(published.parameters).not.toHaveProperty('tags');
    expect(published.get).toMatchObject({ tags: ['auth'] });
  });

  it('When Better Auth declares its own security schemes, then they are not published', () => {
    const document = createStarterDocument();

    mergeAuthOpenApiDocument(document, createAuthSchema(), AUTH_BASE_PATH);

    expect(Object.keys(document.components?.securitySchemes ?? {})).toEqual([
      'cookie',
    ]);
    expect(Object.keys(document.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(['SignUpEmailBody', 'UserResponseDto']),
    );
  });

  it('When the document is published, then no operation names an undeclared security scheme', () => {
    const document = createStarterDocument();

    mergeAuthOpenApiDocument(document, createAuthSchema(), AUTH_BASE_PATH);

    const declared = Object.keys(document.components?.securitySchemes ?? {});
    const referenced = collectSecuritySchemeNames(document);
    expect(referenced).not.toHaveLength(0);
    for (const name of referenced) {
      expect(declared).toContain(name);
    }
  });

  it('When Better Auth exposes routes the starter does not document, then they stay unpublished', () => {
    const document = createStarterDocument();

    mergeAuthOpenApiDocument(document, createAuthSchema(), AUTH_BASE_PATH);

    expect(Object.keys(document.paths)).toEqual([
      '/api/v1/users/me',
      `${AUTH_BASE_PATH}/sign-up/email`,
      `${AUTH_BASE_PATH}/sign-in/email`,
      `${AUTH_BASE_PATH}/sign-out`,
      `${AUTH_BASE_PATH}/get-session`,
      `${AUTH_BASE_PATH}/change-password`,
      `${AUTH_BASE_PATH}/list-sessions`,
      `${AUTH_BASE_PATH}/list-accounts`,
      `${AUTH_BASE_PATH}/revoke-session`,
      `${AUTH_BASE_PATH}/revoke-sessions`,
      `${AUTH_BASE_PATH}/revoke-other-sessions`,
      `${AUTH_BASE_PATH}/update-user`,
      `${AUTH_BASE_PATH}/verify-password`,
    ]);
  });

  it('When the session-management routes need a session, then they are published against the cookie scheme', () => {
    const document = createStarterDocument();

    mergeAuthOpenApiDocument(document, createAuthSchema(), AUTH_BASE_PATH);

    expect(document.paths[`${AUTH_BASE_PATH}/list-sessions`]).toMatchObject({
      get: { security: [{ cookie: [] }], tags: ['auth'] },
    });
    expect(document.paths[`${AUTH_BASE_PATH}/revoke-session`]).toMatchObject({
      post: { security: [{ cookie: [] }], tags: ['auth'] },
    });
    expect(document.paths[`${AUTH_BASE_PATH}/revoke-sessions`]).toMatchObject({
      post: { security: [{ cookie: [] }], tags: ['auth'] },
    });
    expect(
      document.paths[`${AUTH_BASE_PATH}/revoke-other-sessions`],
    ).toMatchObject({
      post: { security: [{ cookie: [] }], tags: ['auth'] },
    });
  });

  it('When credential and profile routes need a session, then they are published against the cookie scheme', () => {
    const document = createStarterDocument();

    mergeAuthOpenApiDocument(document, createAuthSchema(), AUTH_BASE_PATH);

    expect(document.paths[`${AUTH_BASE_PATH}/change-password`]).toMatchObject({
      post: { security: [{ cookie: [] }], tags: ['auth'] },
    });
    expect(document.paths[`${AUTH_BASE_PATH}/verify-password`]).toMatchObject({
      post: { security: [{ cookie: [] }], tags: ['auth'] },
    });
    expect(document.paths[`${AUTH_BASE_PATH}/update-user`]).toMatchObject({
      post: {
        description:
          'The starter owns user roles; this route cannot set or change a role.',
        security: [{ cookie: [] }],
        tags: ['auth'],
      },
    });
    expect(document.paths[`${AUTH_BASE_PATH}/list-accounts`]).toMatchObject({
      get: { security: [{ cookie: [] }], tags: ['auth'] },
    });
  });

  it('When a published route carries a request body and response schema, then both survive the merge', () => {
    const document = createStarterDocument();

    mergeAuthOpenApiDocument(document, createAuthSchema(), AUTH_BASE_PATH);

    const published = document.paths[`${AUTH_BASE_PATH}/revoke-session`] as {
      post: { requestBody: unknown; responses: unknown };
    };
    expect(published.post.requestBody).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/RevokeSessionBody' },
        },
      },
    });
    expect(published.post.responses).toMatchObject({
      200: { description: 'Session revoked' },
    });
  });
});

describe('findUnaccountedAuthPaths', () => {
  it('When every generated path is either published or excluded, then nothing is unaccounted', () => {
    const schema = createAuthSchema();

    expect(
      findUnaccountedAuthPaths([...Object.keys(schema.paths), '/delete-user']),
    ).toEqual([]);
  });

  it('When Better Auth generates a path neither registry names, then it is reported', () => {
    expect(
      findUnaccountedAuthPaths(['/get-session', '/a-brand-new-route']),
    ).toEqual(['/a-brand-new-route']);
  });
});
