FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/elysia-plugins/package.json ./shared/elysia-plugins/
COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/auth/package.json ./services/auth/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/auth ./services/auth


EXPOSE ${PORT}


CMD ["bun", "services/auth/src/index.ts"]