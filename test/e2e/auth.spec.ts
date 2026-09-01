import { execFile as executeFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NestExpressApplication } from '@nestjs/platform-express';
import { OpenAPIObject } from '@nestjs/swagger';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { API_VERSIONED_PREFIX } from '../../src/core/http/api-version';
import { configureApplication } from '../../src/core/http/configure-application';
import {
  BetterAuthService,
  findUnaccountedAuthPaths,
} from '../../src/features/auth/better-auth.service';
import { defaultEnvironment } from '../support/default-environment';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../support/test-environment';

const execFile = promisify(executeFile);

/** Signs up and signs in a fresh user, returning its session cookie. */
async function signUpAndSignIn(
  app: NestExpressApplication,
  email: string,
): Promise<string> {
  await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .send({ name: 'Test user', email, password: 'password-123' })
    .expect(200);
  const login = await request(app.getHttpServer())
    .post('/api/auth/sign-in/email')
    .send({ email, password: 'password-123' })
    .expect(200);
  return login.headers['set-cookie']?.[0] ?? '';
}

describe('Better Auth authentication (e2e)', () => {
  let app: NestExpressApplication;
  let environment: TestEnvironment;
  let originalEnvironment: NodeJS.ProcessEnv;

  beforeAll(async () => {
    originalEnvironment = { ...process.env };
    environment = await createTestEnvironment();
    process.env = {
      ...originalEnvironment,
      ...defaultEnvironment,
      DATABASE_SCHEMA: environment.schema,
      DATABASE_URL: environment.databaseUrl,
    };
    const { AppModule } =
      (await import('../../src/app.module.js')) as typeof import('../../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    await configureApplication(app);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await environment?.stop();
    process.env = originalEnvironment;
  }, 120_000);

  it('When a browser signs up and signs in, then its session cookie authenticates the user API', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Reader',
        email: 'reader@example.com',
        password: 'password-123',
        role: 'ADMIN',
      })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ user: { role: 'USER' } }),
      );
    const login = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: 'reader@example.com', password: 'password-123' })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          user: { email: 'reader@example.com', role: 'USER' },
        }),
      );
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/users/me`)
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          email: 'reader@example.com',
          role: 'USER',
        }),
      );

    const docs = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = docs.body as OpenAPIObject;
    expect(document.paths['/api/auth/sign-in/email']).toMatchObject({
      post: { security: [] },
    });
    expect(document.paths[`${API_VERSIONED_PREFIX}/users/me`]).toMatchObject({
      get: { security: [{ cookie: [] }] },
    });
  });

  it('When a session user is deleted, then its cascaded session no longer authenticates protected routes', async () => {
    const email = 'deleted-session-user@example.com';
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ name: 'Deleted session user', email, password: 'password-123' })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'password-123' })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0] ?? '';

    const prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: environment.databaseUrl },
        { schema: environment.schema },
      ),
    });
    await prisma.user.delete({ where: { email } });
    await prisma.$disconnect();

    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/users/me`)
      .set('Cookie', cookie)
      .expect(401)
      .expect(({ body }: { body: { code: string } }) =>
        expect(body.code).toBe('UNAUTHORIZED'),
      );
  });

  it('When an active session reaches its renewal age, then a protected route renews its cookie', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Returning reader',
        email: 'returning-reader@example.com',
        password: 'password-123',
      })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({
        email: 'returning-reader@example.com',
        password: 'password-123',
      })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0] ?? '';
    const prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: environment.databaseUrl },
        { schema: environment.schema },
      ),
    });
    await prisma.session.updateMany({
      data: { expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
    });

    const response = await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/users/me`)
      .set('Cookie', cookie)
      .expect(200);
    const renewedSession = await prisma.session.findFirst({
      where: {
        expiresAt: { gt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000) },
      },
    });
    await prisma.$disconnect();

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('better-auth.session_token='),
      ]),
    );
    expect(renewedSession).not.toBeNull();
  });

  it('When browser sessions belong to users with different roles, then only the administrator can list users', async () => {
    const regularEmail = 'regular@example.com';
    const adminEmail = 'administrator@example.com';
    const promotedEmail = 'promoted-administrator@example.com';
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Regular user',
        email: regularEmail,
        password: 'password-123',
      })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Promoted administrator',
        email: promotedEmail,
        password: 'password-123',
      })
      .expect(200);

    const prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: environment.databaseUrl },
        { schema: environment.schema },
      ),
    });
    const seedEnvironment = {
      ...process.env,
      DATABASE_SCHEMA: environment.schema,
      DATABASE_URL: environment.databaseUrl,
      SEED_ADMIN_EMAIL: adminEmail,
      SEED_ADMIN_PASSWORD: 'password-123',
    };
    await execFile('pnpm', ['seed:admin'], { env: seedEnvironment });
    await execFile('pnpm', ['seed:admin'], { env: seedEnvironment });
    await execFile('pnpm', ['seed:admin'], {
      env: { ...seedEnvironment, SEED_ADMIN_EMAIL: promotedEmail },
    });
    expect(await prisma.user.count({ where: { email: adminEmail } })).toBe(1);
    expect(
      await prisma.user.findUnique({
        select: { role: true },
        where: { email: promotedEmail },
      }),
    ).toMatchObject({ role: 'ADMIN' });
    await prisma.$disconnect();

    // A tuple literal rather than `.map()`, so `Promise.all` resolves to a
    // fixed-length tuple and each login is typed as present.
    const signIn = (email: string) =>
      request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email, password: 'password-123' })
        .expect(200);
    const [regularLogin, adminLogin, promotedLogin] = await Promise.all([
      signIn(regularEmail),
      signIn(adminEmail),
      signIn(promotedEmail),
    ]);
    const regularCookie = regularLogin.headers['set-cookie']?.[0] ?? '';
    const adminCookie = adminLogin.headers['set-cookie']?.[0] ?? '';
    const promotedCookie = promotedLogin.headers['set-cookie']?.[0] ?? '';

    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/users`)
      .set('Cookie', regularCookie)
      .expect(403)
      .expect(({ body }: { body: { code: string } }) =>
        expect(body.code).toBe('FORBIDDEN'),
      );
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/users`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect(({ body }: { body: { data: Array<{ email: string }> } }) =>
        expect(body.data.map(({ email }) => email)).toEqual(
          expect.arrayContaining([regularEmail, adminEmail]),
        ),
      );
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/users`)
      .set('Cookie', promotedCookie)
      .expect(200);
  }, 20000);

  it('When an administrator updates another user, then it can promote and demote that user but cannot demote itself', async () => {
    const adminEmail = 'patch-administrator@example.com';
    const targetEmail = 'patch-target@example.com';
    await Promise.all(
      [
        { email: adminEmail, name: 'Patch administrator' },
        { email: targetEmail, name: 'Patch target' },
      ].map(({ email, name }) =>
        request(app.getHttpServer())
          .post('/api/auth/sign-up/email')
          .send({ name, email, password: 'password-123' })
          .expect(200),
      ),
    );

    const prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: environment.databaseUrl },
        { schema: environment.schema },
      ),
    });
    const [admin, target] = await Promise.all([
      prisma.user.update({
        data: { role: 'ADMIN' },
        where: { email: adminEmail },
      }),
      prisma.user.findUniqueOrThrow({ where: { email: targetEmail } }),
    ]);
    await prisma.$disconnect();

    const login = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: adminEmail, password: 'password-123' })
      .expect(200);
    const adminCookie = login.headers['set-cookie']?.[0] ?? '';

    await request(app.getHttpServer())
      .patch(`${API_VERSIONED_PREFIX}/users/${target.id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'ADMIN' })
      .expect(200)
      .expect(({ body }: { body: { role: string } }) =>
        expect(body.role).toBe('ADMIN'),
      );
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/users/${target.id}`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect(({ body }: { body: { email: string; role: string } }) =>
        expect(body).toMatchObject({ email: targetEmail, role: 'ADMIN' }),
      );
    await request(app.getHttpServer())
      .patch(`${API_VERSIONED_PREFIX}/users/${target.id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'USER' })
      .expect(200)
      .expect(({ body }: { body: { role: string } }) =>
        expect(body.role).toBe('USER'),
      );
    await request(app.getHttpServer())
      .patch(`${API_VERSIONED_PREFIX}/users/${admin.id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'USER' })
      .expect(409)
      .expect(({ body }: { body: { code: string } }) =>
        expect(body.code).toBe('CANNOT_REMOVE_OWN_ADMIN_ROLE'),
      );
  });

  it('When session cookie caching stays disabled, then a role change is visible on the very next request using the same session cookie', async () => {
    const targetEmail = 'cache-guarantee-target@example.com';
    const adminEmail = 'cache-guarantee-admin@example.com';
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Cache guarantee target',
        email: targetEmail,
        password: 'password-123',
      })
      .expect(200);
    const targetLogin = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: targetEmail, password: 'password-123' })
      .expect(200);
    const targetCookie = targetLogin.headers['set-cookie']?.[0] ?? '';

    const seedEnvironment = {
      ...process.env,
      DATABASE_SCHEMA: environment.schema,
      DATABASE_URL: environment.databaseUrl,
      SEED_ADMIN_EMAIL: adminEmail,
      SEED_ADMIN_PASSWORD: 'password-123',
    };
    await execFile('pnpm', ['seed:admin'], { env: seedEnvironment });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: adminEmail, password: 'password-123' })
      .expect(200);
    const adminCookie = adminLogin.headers['set-cookie']?.[0] ?? '';

    const prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: environment.databaseUrl },
        { schema: environment.schema },
      ),
    });
    const target = await prisma.user.findUniqueOrThrow({
      where: { email: targetEmail },
    });
    await prisma.$disconnect();

    await request(app.getHttpServer())
      .patch(`${API_VERSIONED_PREFIX}/users/${target.id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'ADMIN' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/users`)
      .set('Cookie', targetCookie)
      .expect(200);
  });

  it('When the deployment topology is cross-site, then the session cookie carries SameSite=None, Secure, and Partitioned', async () => {
    process.env = {
      ...originalEnvironment,
      ...defaultEnvironment,
      DATABASE_SCHEMA: environment.schema,
      DATABASE_URL: environment.databaseUrl,
      DEPLOYMENT_TOPOLOGY: 'cross-site',
      PUBLIC_BASE_URL: 'https://api.example.com',
    };
    // @nestjs/config validates process.env synchronously inside forRoot(), the
    // first time the module graph is imported, so a fresh module registry is
    // required to pick up the mutated env for this second application.
    vi.resetModules();
    const { AppModule: CrossSiteAppModule } =
      (await import('../../src/app.module.js')) as typeof import('../../src/app.module.js');
    const { configureApplication: configureCrossSiteApplication } =
      (await import('../../src/core/http/configure-application.js')) as typeof import('../../src/core/http/configure-application.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CrossSiteAppModule],
    }).compile();
    const crossSiteApp =
      moduleFixture.createNestApplication<NestExpressApplication>({
        bodyParser: false,
      });
    await configureCrossSiteApplication(crossSiteApp);
    await crossSiteApp.init();

    try {
      await request(crossSiteApp.getHttpServer())
        .post('/api/auth/sign-up/email')
        .send({
          name: 'Cross-site reader',
          email: 'cross-site-reader@example.com',
          password: 'password-123',
        })
        .expect(200);
      const login = await request(crossSiteApp.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({
          email: 'cross-site-reader@example.com',
          password: 'password-123',
        })
        .expect(200);
      const cookie = login.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=None');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('Partitioned');
    } finally {
      await crossSiteApp.close();
      process.env = {
        ...originalEnvironment,
        ...defaultEnvironment,
        DATABASE_SCHEMA: environment.schema,
        DATABASE_URL: environment.databaseUrl,
      };
    }
  });

  it('When Better Auth generates its live OpenAPI schema, then every path is either published or deliberately excluded', async () => {
    const schema = await app.get(BetterAuthService).generateOpenApiSchema();
    const unaccounted = findUnaccountedAuthPaths(Object.keys(schema.paths));

    expect(
      unaccounted,
      `Better Auth generates path(s) neither PUBLISHED_AUTH_PATHS nor EXCLUDED_AUTH_PATHS accounts for: ${unaccounted.join(', ')}. Classify each in src/features/auth/better-auth.service.ts.`,
    ).toEqual([]);
  });

  it('When a signed-in user lists their sessions, then the current session is returned', async () => {
    const cookie = await signUpAndSignIn(app, 'session-lister@example.com');
    const currentSession = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookie)
      .expect(200);
    const currentToken = (currentSession.body as { session: { token: string } })
      .session.token;

    const response = await request(app.getHttpServer())
      .get('/api/auth/list-sessions')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ token: currentToken }),
      ]),
    );
  });

  it('When a signed-in user revokes their other sessions, then the calling session stays signed in', async () => {
    const email = 'revoke-other-sessions@example.com';
    const cookie = await signUpAndSignIn(app, email);

    await request(app.getHttpServer())
      .post('/api/auth/revoke-other-sessions')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ user: { email } }));
  });

  it('When a signed-in user revokes one of their sessions, then the endpoint is reachable and succeeds', async () => {
    const cookie = await signUpAndSignIn(app, 'revoke-one-session@example.com');
    const sessions = await request(app.getHttpServer())
      .get('/api/auth/list-sessions')
      .set('Cookie', cookie)
      .expect(200);
    const [session] = sessions.body as { token: string }[];
    if (!session) {
      throw new Error('Expected at least one session to be listed');
    }

    await request(app.getHttpServer())
      .post('/api/auth/revoke-session')
      .set('Cookie', cookie)
      .send({ token: session.token })
      .expect(200);
  });

  it('When a signed-in user revokes all of their sessions, then the endpoint is reachable and succeeds', async () => {
    const cookie = await signUpAndSignIn(
      app,
      'revoke-all-sessions@example.com',
    );

    await request(app.getHttpServer())
      .post('/api/auth/revoke-sessions')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('When a signed-in user changes their password, then the old password no longer signs in', async () => {
    const email = 'password-changer@example.com';
    const cookie = await signUpAndSignIn(app, email);

    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'password-123', newPassword: 'password-456' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'password-123' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'password-456' })
      .expect(200);
  });

  it('When a signed-in user verifies their password, then correct and incorrect credentials are distinguished', async () => {
    const cookie = await signUpAndSignIn(app, 'password-verifier@example.com');

    await request(app.getHttpServer())
      .post('/api/auth/verify-password')
      .set('Cookie', cookie)
      .send({ password: 'password-123' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/verify-password')
      .set('Cookie', cookie)
      .send({ password: 'wrong-password' })
      .expect(400);
  });

  it('When a signed-in user updates their profile, then the role remains starter-controlled', async () => {
    const email = 'profile-updater@example.com';
    const cookie = await signUpAndSignIn(app, email);

    await request(app.getHttpServer())
      .post('/api/auth/update-user')
      .set('Cookie', cookie)
      .send({ name: 'Updated user' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/update-user')
      .set('Cookie', cookie)
      .send({ role: 'ADMIN' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          user: { email, name: 'Updated user', role: 'USER' },
        }),
      );
  });

  it('When a signed-in user lists their accounts, then the endpoint is reachable', async () => {
    const cookie = await signUpAndSignIn(app, 'account-lister@example.com');

    await request(app.getHttpServer())
      .get('/api/auth/list-accounts')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('When a signed-in user calls the excluded account-deletion route, then it fails as an undocumented capability', async () => {
    const cookie = await signUpAndSignIn(
      app,
      'delete-user-excluded@example.com',
    );

    await request(app.getHttpServer())
      .post('/api/auth/delete-user')
      .set('Cookie', cookie)
      .send({})
      .expect(404);
  });
});
