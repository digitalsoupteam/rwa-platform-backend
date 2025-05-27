FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/reactions/package.json ./services/reactions/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/reactions ./services/reactions


EXPOSE ${PORT}


CMD ["bun", "services/reactions/src/index.ts"]