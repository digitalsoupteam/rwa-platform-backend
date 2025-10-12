FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/errors/package.json ./shared/errors/
COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/redis-events/package.json ./shared/redis-events/

COPY services/gateway/package.json ./services/gateway/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/gateway ./services/gateway


EXPOSE ${PORT}

ENTRYPOINT cd services/gateway && NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register" OTEL_TRACES_EXPORTER="otlp" OTEL_LOG_LEVEL="info" OTEL_NODE_ENABLED_INSTRUMENTATIONS="http,graphql,ioredis,redis" bun ./src/index.ts

# CMD ["bun", "services/gateway/src/index.ts"]