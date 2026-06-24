FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/files/package.json ./services/files/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/files ./services/files




EXPOSE ${PORT}


WORKDIR /app/services/files
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]