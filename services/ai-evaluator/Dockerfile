FROM oven/bun:latest

WORKDIR /app

COPY package.json .

COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/
COPY shared/openrouter/package.json ./shared/openrouter/

COPY services/rwa/package.json ./services/rwa/
COPY services/documents/package.json ./services/documents/
COPY services/gallery/package.json ./services/gallery/
COPY services/reactions/package.json ./services/reactions/
COPY services/questions/package.json ./services/questions/
COPY services/portfolio/package.json ./services/portfolio/
COPY services/ai-evaluator/package.json ./services/ai-evaluator/

COPY bun.lockb .

RUN bun install

COPY shared/ ./shared/

COPY services/rwa ./services/rwa
COPY services/documents ./services/documents
COPY services/gallery ./services/gallery
COPY services/reactions ./services/reactions
COPY services/questions ./services/questions
COPY services/portfolio ./services/portfolio
COPY services/ai-evaluator ./services/ai-evaluator

EXPOSE ${PORT}

WORKDIR /app/services/ai-evaluator
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]