FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/signer-service/package.json ./services/signer-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/signer-service/src ./services/signer-service/src
COPY services/signer-service/tsconfig.json ./services/signer-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/signer-service && bun run build

EXPOSE ${PORT}
CMD ["bun", "services/signer-service/dist/server.js"]
