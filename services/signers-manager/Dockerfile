FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/
COPY shared/rabbitmq/package.json ./shared/rabbitmq/

COPY services/signers-manager/package.json ./services/signers-manager/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/signers-manager ./services/signers-manager


EXPOSE ${PORT}


CMD ["bun", "services/signers-manager/src/index.ts"]