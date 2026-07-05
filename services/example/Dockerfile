FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/example/package.json ./services/example/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/example ./services/example


EXPOSE ${PORT}


WORKDIR /app/services/example
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]
