FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/blockchain-scanner/package.json ./services/blockchain-scanner/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/blockchain-scanner/src ./services/blockchain-scanner/src
COPY services/blockchain-scanner/tsconfig.json ./services/blockchain-scanner/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/blockchain-scanner && bun run build

EXPOSE 3005
CMD ["bun", "services/blockchain-scanner/dist/server.js"]
