FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
COPY packages/shared/package.json ./packages/shared/
COPY services/risk-management/package.json ./services/risk-management/

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY services/risk-management/src ./services/risk-management/src
COPY services/risk-management/tsconfig.json ./services/risk-management/

RUN bun install
RUN cd packages/shared && bun run build
RUN cd services/risk-management && bun run build

EXPOSE 3009
CMD ["bun", "services/risk-management/dist/server.js"]
