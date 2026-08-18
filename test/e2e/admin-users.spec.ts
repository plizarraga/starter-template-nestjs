import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient, Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApplication } from '../../src/platform/http/configure-application';
import { defaultEnvironment } from '../support/default-environment';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../support/test-environment';

type PaginatedResponseBody = {
  data: Array<{ email: string; id: string; role: Role }>;
  meta: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

describe('administrative user management (e2e)', () => {
  let app: NestExpressApplication;
  let environment: TestEnvironment;
  let originalEnvironment: NodeJS.ProcessEnv;
  let prisma: PrismaClient;

  async function register(email: string, password = 'password-123') {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    return prisma.user.findUniqueOrThrow({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async function login(email: string, password = 'password-123') {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  async function registerAdmin(email: string, password = 'password-123') {
    const user = await register(email, password);
    await prisma.user.update({
      data: { role: Role.ADMIN },
      where: { id: user.id },
    });
    const accessToken = await login(email, password);
    return { accessToken, id: user.id };
  }

  beforeAll(async () => {
    originalEnvironment = { ...process.env };
    environment = await createTestEnvironment();
    const databaseUrl = new URL(environment.databaseUrl);
    databaseUrl.searchParams.set('schema', environment.schema);
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl.toString() } },
    });
    await prisma.$executeRawUnsafe(
      `CREATE TYPE "${environment.schema}"."Role" AS ENUM ('USER', 'ADMIN')`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "${environment.schema}"."User" (
        "id" UUID NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "role" "${environment.schema}"."Role" NOT NULL DEFAULT 'USER',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "User_email_key" UNIQUE ("email")
      )
    `);

    process.env = {
      ...originalEnvironment,
      ...defaultEnvironment,
      DATABASE_URL: databaseUrl.toString(),
      REDIS_URL: environment.redisUrl,
    };
    const { AppModule } =
      (await import('../../src/app.module')) as typeof import('../../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await environment?.stop();
    process.env = originalEnvironment;
  }, 120_000);

  it('When an unauthenticated request lists users, then it returns 401', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHORIZED' });
      });
  });

  it('When a non-administrator lists users, then it returns 403 and not 401', async () => {
    await register('reader-rbac@example.com');
    const accessToken = await login('reader-rbac@example.com');

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'FORBIDDEN' });
      });
  });

  it('When an administrator retrieves an unknown user, then it returns USER_NOT_FOUND', async () => {
    const admin = await registerAdmin('admin-get@example.com');

    await request(app.getHttpServer())
      .get('/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'USER_NOT_FOUND' });
      });
  });

  it('When an administrator retrieves an existing user, then it returns the public user', async () => {
    const admin = await registerAdmin('admin-get-2@example.com');
    const target = await register('target-get@example.com');

    await request(app.getHttpServer())
      .get(`/users/${target.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          email: 'target-get@example.com',
          id: target.id,
          role: Role.USER,
        });
        expect(body).not.toHaveProperty('passwordHash');
      });
  });

  it('When an administrator lists users, then it returns the canonical paginated shape', async () => {
    const admin = await registerAdmin('admin-list@example.com');
    await register('list-a@list-shape.example.com');
    await register('list-b@list-shape.example.com');

    await request(app.getHttpServer())
      .get('/users?search=list-shape.example.com')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }: { body: PaginatedResponseBody }) => {
        expect(body).toMatchObject({
          meta: {
            hasNextPage: false,
            hasPreviousPage: false,
            limit: 20,
            page: 1,
            total: 2,
            totalPages: 1,
          },
        });
        expect(body.data).toHaveLength(2);
      });
  });

  it('When an administrator requests a custom page size, then pagination reflects it', async () => {
    const admin = await registerAdmin('admin-page-size@example.com');
    await register('page-1@page-size.example.com');
    await register('page-2@page-size.example.com');
    await register('page-3@page-size.example.com');

    await request(app.getHttpServer())
      .get('/users?search=page-size.example.com&limit=2&page=1')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }: { body: PaginatedResponseBody }) => {
        expect(body.data).toHaveLength(2);
        expect(body.meta).toMatchObject({
          hasNextPage: true,
          hasPreviousPage: false,
          limit: 2,
          page: 1,
          total: 3,
          totalPages: 2,
        });
      });

    await request(app.getHttpServer())
      .get('/users?search=page-size.example.com&limit=2&page=2')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }: { body: PaginatedResponseBody }) => {
        expect(body.data).toHaveLength(1);
        expect(body.meta).toMatchObject({
          hasNextPage: false,
          hasPreviousPage: true,
          limit: 2,
          page: 2,
          total: 3,
          totalPages: 2,
        });
      });
  });

  it('When the requested limit exceeds the maximum, then it returns a validation error', async () => {
    const admin = await registerAdmin('admin-max-limit@example.com');

    await request(app.getHttpServer())
      .get('/users?limit=101')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'VALIDATION_ERROR' });
      });
  });

  it('When an administrator searches by email, then only matching users are returned', async () => {
    const admin = await registerAdmin('admin-search@example.com');
    await register('findme@search-target.example.com');
    await register('other@search-other.example.com');

    await request(app.getHttpServer())
      .get('/users?search=search-target.example.com')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }: { body: PaginatedResponseBody }) => {
        expect(body.data).toHaveLength(1);
        expect(body.data[0]).toMatchObject({
          email: 'findme@search-target.example.com',
        });
      });
  });

  it('When a search has no matches, then it returns an empty page', async () => {
    const admin = await registerAdmin('admin-search-empty@example.com');

    await request(app.getHttpServer())
      .get('/users?search=no-such-user-anywhere.example.com')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: [],
          meta: { total: 0, totalPages: 0 },
        });
      });
  });

  it('When an administrator sorts users, then ascending and descending orders are honored', async () => {
    const admin = await registerAdmin('admin-sort@example.com');
    await register('c-sort@sort-target.example.com');
    await register('a-sort@sort-target.example.com');
    await register('b-sort@sort-target.example.com');

    const ascending = await request(app.getHttpServer())
      .get('/users?search=sort-target.example.com&sortBy=email&sortOrder=asc')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const ascendingBody = ascending.body as PaginatedResponseBody;
    expect(ascendingBody.data.map((user) => user.email)).toEqual([
      'a-sort@sort-target.example.com',
      'b-sort@sort-target.example.com',
      'c-sort@sort-target.example.com',
    ]);

    const descending = await request(app.getHttpServer())
      .get('/users?search=sort-target.example.com&sortBy=email&sortOrder=desc')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const descendingBody = descending.body as PaginatedResponseBody;
    expect(descendingBody.data.map((user) => user.email)).toEqual([
      'c-sort@sort-target.example.com',
      'b-sort@sort-target.example.com',
      'a-sort@sort-target.example.com',
    ]);
  });

  it('When an unsupported sort field is requested, then it returns a validation error', async () => {
    const admin = await registerAdmin('admin-invalid-sort@example.com');

    await request(app.getHttpServer())
      .get('/users?sortBy=passwordHash')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'VALIDATION_ERROR' });
      });
  });

  it('When an administrator updates another user, then only allowed fields change', async () => {
    const admin = await registerAdmin('admin-update@example.com');
    const target = await register('target-update@example.com');

    await request(app.getHttpServer())
      .patch(`/users/${target.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ email: 'target-updated@example.com', role: Role.ADMIN })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          email: 'target-updated@example.com',
          id: target.id,
          role: Role.ADMIN,
        });
        expect(body).not.toHaveProperty('passwordHash');
      });

    await request(app.getHttpServer())
      .patch(`/users/${target.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ email: 'target-updated@example.com', isSuperAdmin: true })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'VALIDATION_ERROR' });
      });
  });

  it('When an administrator tries to remove their own ADMIN role, then it is blocked', async () => {
    const admin = await registerAdmin('admin-self-demote@example.com');
    await registerAdmin('admin-self-demote-peer@example.com');

    await request(app.getHttpServer())
      .patch(`/users/${admin.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ role: Role.USER })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'CANNOT_REMOVE_OWN_ADMIN_ROLE' });
      });
  });

  it('When demoting the last administrator, then it is blocked even with a stale admin credential', async () => {
    const soleAdmin = await registerAdmin('admin-last-sole@example.com');
    const staleAdmin = await registerAdmin('admin-last-stale@example.com');

    // Every other administrator in this shared schema (including staleAdmin)
    // is demoted directly, simulating a role change that already happened
    // while staleAdmin's previously issued access token still embeds ADMIN
    // (EDD 7.3: role changes revoke no access tokens).
    await prisma.user.updateMany({
      data: { role: Role.USER },
      where: { id: { not: soleAdmin.id } },
    });

    await request(app.getHttpServer())
      .patch(`/users/${soleAdmin.id}`)
      .set('Authorization', `Bearer ${staleAdmin.accessToken}`)
      .send({ role: Role.USER })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'CANNOT_REMOVE_LAST_ADMIN' });
      });
  });
});
