FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/gallery/package.json ./services/gallery/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/gallery ./services/gallery


EXPOSE ${PORT}


CMD ["bun", "services/gallery/src/index.ts"]