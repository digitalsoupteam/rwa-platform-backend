FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/auth-service/package.json ./services/auth-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/auth-service/src ./services/auth-service/src
COPY services/auth-service/tsconfig.json ./services/auth-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/auth-service && bun run build

EXPOSE 3001
CMD ["bun", "services/auth-service/dist/server.js"]
