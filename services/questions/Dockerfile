FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/questions/package.json ./services/questions/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/questions ./services/questions


EXPOSE ${PORT}


CMD ["bun", "services/questions/src/index.ts"]