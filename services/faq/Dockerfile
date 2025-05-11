FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/faq/package.json ./services/faq/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/faq ./services/faq


EXPOSE ${PORT}


CMD ["bun", "services/faq/src/index.ts"]