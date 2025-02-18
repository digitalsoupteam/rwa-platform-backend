FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
COPY packages/shared ./packages/shared
COPY services/signer-service ./services/signer-service

RUN bun install

WORKDIR /app/services/signer-service

CMD ["bun", "run", "dev"]
