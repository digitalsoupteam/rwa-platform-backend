FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/
COPY shared/rabbitmq/package.json ./shared/rabbitmq/
COPY shared/blockchain-daemon/package.json ./shared/blockchain-daemon/

COPY services/dao/package.json ./services/dao/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/dao ./services/dao


EXPOSE ${PORT}


CMD ["bun", "services/dao/src/index.ts"]