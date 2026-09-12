FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY shared/openrouter/package.json ./shared/openrouter/

COPY services/ai-assistant/package.json ./services/ai-assistant/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/ai-assistant ./services/ai-assistant


EXPOSE ${PORT}


WORKDIR /app/services/ai-assistant
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]