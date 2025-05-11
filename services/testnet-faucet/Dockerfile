FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/

COPY services/testnet-faucet/package.json ./services/testnet-faucet/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/


COPY services/testnet-faucet ./services/testnet-faucet


EXPOSE ${PORT}


CMD ["bun", "services/testnet-faucet/src/index.ts"]