FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/notification-service/package.json ./services/notification-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/notification-service/src ./services/notification-service/src
COPY services/notification-service/tsconfig.json ./services/notification-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/notification-service && bun run build

EXPOSE ${PORT}
CMD ["bun", "services/notification-service/dist/server.js"]
