FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/company/package.json ./services/company/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/company ./services/company


EXPOSE ${PORT}


WORKDIR /app/services/company
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]