FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/charts/package.json ./services/charts/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/charts ./services/charts


EXPOSE ${PORT}


CMD ["bun", "services/charts/src/index.ts"]