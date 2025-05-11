FROM oven/bun:latest

WORKDIR /app


COPY package.json .

COPY shared/elysia-plugins/package.json ./shared/elysia-plugins/
COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/rabbitmq/package.json ./shared/rabbitmq/
COPY shared/errors/package.json ./shared/errors/

COPY services/blockchain-scanner/package.json ./services/blockchain-scanner/

COPY bun.lockb .


RUN bun install


COPY shared/ ./shared/



# COPY services/ai/src/ ./services/ai/src/
# COPY services/chat/src/ ./services/chat/src/
# COPY services/virtual-balance/src/ ./services/virtual-balance/src/


COPY services/blockchain-scanner ./services/blockchain-scanner


EXPOSE ${PORT}


CMD ["bun", "services/blockchain-scanner/src/index.ts"]