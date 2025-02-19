FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/gateway-service/package.json ./services/gateway-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/gateway-service/src ./services/gateway-service/src
COPY services/gateway-service/tsconfig.json ./services/gateway-service/

RUN bun install
RUN cd packages/shared && bun run build --sourcemap
RUN cd services/gateway-service && bun run build --sourcemap

EXPOSE ${PORT}
CMD ["bun", "services/gateway-service/dist/server.js"]
