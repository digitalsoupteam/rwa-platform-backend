FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/openrouter/package.json ./shared/openrouter/
COPY shared/rabbitmq/package.json ./shared/rabbitmq/
COPY shared/blockchain-daemon/package.json ./shared/blockchain-daemon/
COPY shared/errors/package.json ./shared/errors/

COPY services/rwa/package.json ./services/rwa/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/rwa ./services/rwa


EXPOSE ${PORT}


CMD ["bun", "services/rwa/src/index.ts"]