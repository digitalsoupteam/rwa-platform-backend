FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/worker-service/package.json ./services/worker-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/worker-service/src ./services/worker-service/src
COPY services/worker-service/tsconfig.json ./services/worker-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/worker-service && bun run build

EXPOSE 3006
CMD ["bun", "services/worker-service/dist/server.js"]
