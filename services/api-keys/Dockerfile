FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/api-keys/package.json ./services/api-keys/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/api-keys ./services/api-keys


EXPOSE ${PORT}


WORKDIR /app/services/api-keys
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]
