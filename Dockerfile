# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN apk add --no-cache openssl \
  && corepack enable

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY prisma ./prisma
RUN pnpm exec prisma generate
RUN pnpm build

FROM dependencies AS production-dependencies
RUN pnpm prune --prod

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl \
  && addgroup -S nestjs \
  && adduser -S nestjs -G nestjs

COPY --from=production-dependencies --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nestjs /app/dist ./dist
COPY --chown=nestjs:nestjs package.json ./
COPY --chown=nestjs:nestjs prisma/schema.prisma ./prisma/schema.prisma

USER nestjs
EXPOSE 3000

CMD ["node", "dist/src/main"]
