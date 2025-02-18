FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/chat-service/package.json ./services/chat-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/chat-service/src ./services/chat-service/src
COPY services/chat-service/tsconfig.json ./services/chat-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/chat-service && bun run build

EXPOSE ${PORT}
CMD ["bun", "services/chat-service/dist/server.js"]
