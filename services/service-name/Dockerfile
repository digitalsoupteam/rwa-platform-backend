FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/<service-name>/package.json ./services/<service-name>/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/<service-name> ./services/<service-name>


EXPOSE ${PORT}


WORKDIR /app/services/<service-name>
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]
