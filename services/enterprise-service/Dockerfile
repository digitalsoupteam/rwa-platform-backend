FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/enterprise-service/package.json ./services/enterprise-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/enterprise-service/src ./services/enterprise-service/src
COPY services/enterprise-service/tsconfig.json ./services/enterprise-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/enterprise-service && bun run build

EXPOSE 3003
CMD ["bun", "services/enterprise-service/dist/server.js"]
