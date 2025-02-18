FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/ai-service/package.json ./services/ai-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/ai-service/src ./services/ai-service/src
COPY services/ai-service/tsconfig.json ./services/ai-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/ai-service && bun run build

EXPOSE ${PORT}
CMD ["bun", "services/ai-service/dist/server.js"]
