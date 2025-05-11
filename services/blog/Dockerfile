FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/blog/package.json ./services/blog/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/blog ./services/blog


EXPOSE ${PORT}


CMD ["bun", "services/blog/src/index.ts"]