FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/documents/package.json ./services/documents/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/documents ./services/documents


EXPOSE ${PORT}


CMD ["bun", "services/documents/src/index.ts"]