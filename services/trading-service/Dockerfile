FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/trading-service/package.json ./services/trading-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/trading-service/src ./services/trading-service/src
COPY services/trading-service/tsconfig.json ./services/trading-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/trading-service && bun run build

EXPOSE 3003
CMD ["bun", "services/trading-service/dist/server.js"]
