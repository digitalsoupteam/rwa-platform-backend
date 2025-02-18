FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/kyc-service/package.json ./services/kyc-service/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/kyc-service/src ./services/kyc-service/src
COPY services/kyc-service/tsconfig.json ./services/kyc-service/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/kyc-service && bun run build

EXPOSE ${PORT}
CMD ["bun", "services/kyc-service/dist/server.js"]
