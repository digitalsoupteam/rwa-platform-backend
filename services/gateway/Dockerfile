FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/errors/package.json ./shared/errors/
COPY shared/monitoring/package.json ./shared/monitoring/

COPY services/gateway/package.json ./services/gateway/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/gateway ./services/gateway


EXPOSE ${PORT}


CMD ["bun", "services/gateway/src/index.ts"]