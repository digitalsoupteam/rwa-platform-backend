FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/market-data-service/package.json ./services/market-data-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/market-data-service/src ./services/market-data-service/src
COPY services/market-data-service/tsconfig.json ./services/market-data-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/market-data-service && bun run build

EXPOSE 3004
CMD ["bun", "services/market-data-service/dist/server.js"]
