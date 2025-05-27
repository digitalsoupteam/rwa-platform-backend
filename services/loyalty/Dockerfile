FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/loyalty/package.json ./services/loyalty/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/loyalty ./services/loyalty


EXPOSE ${PORT}


CMD ["bun", "services/loyalty/src/index.ts"]