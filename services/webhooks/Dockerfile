FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/webhooks/package.json ./services/webhooks/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/webhooks ./services/webhooks


EXPOSE ${PORT}


WORKDIR /app/services/webhooks
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]