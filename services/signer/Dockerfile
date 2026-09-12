FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/
COPY shared/rabbitmq/package.json ./shared/rabbitmq/

COPY services/signer/package.json ./services/signer/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/signer ./services/signer


EXPOSE ${PORT}


WORKDIR /app/services/signer
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]