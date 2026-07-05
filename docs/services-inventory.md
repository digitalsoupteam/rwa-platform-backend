# Services Inventory

**Project:** RWA Platform (backend/main)
**Root:** `C:\Users\User\Desktop\MY_WORK_2026\RWA\backend\main`
**Workspace root:** `C:\Users\User\Desktop\MY_WORK_2026\RWA\backend`

---

## Common Stack

| Property | Value |
|---|---|
| **Language** | TypeScript (Bun runtime) |
| **Web framework** | Elysia 1.3.5 |
| **Database** | MongoDB via Mongoose 8.16.4 |
| **Messaging** | RabbitMQ (via `@shared/rabbitmq` workspace) |
| **Caching / pub-sub** | Redis / ioredis |
| **Blockchain lib** | ethers 6.15.0 |
| **OpenTelemetry** | Full OTLP tracing, metrics, logging |
| **Package manager** | Bun (workspaces) |
| **Docker** | Each service has its own Dockerfile |
| **CI/CD** | Root scripts: docker-compose, nginx reload |

---

## Service Directory Listing

| # | Service | Directory | Purpose (inferred from models/controllers) | Framework | Key Connectors | Daemons | Key Files |
|---|---------|-----------|-------------------------------------------|-----------|----------------|---------|-----------|
| 1 | **ai-assistant** | `services/ai-assistant` | AI-powered assistants per user — create/update assistants, messages, history | Elysia 1.3.5 | OpenRouter, RWA service, Portfolio service | — | `src/index.ts`, `src/app.ts`, `src/controllers/`, `src/models/entity/assistant.entity.ts`, `src/models/entity/message.entity.ts` |
| 2 | **auth** | `services/auth` | Authentication & authorization — JWT tokens, refresh, revoke, user management | Elysia 1.3.5 | MongoDB | — | `src/index.ts`, `src/controllers/authenticate.controller.ts`, `src/models/entity/user.entity.ts`, `src/models/entity/refreshToken.entity.ts` |
| 3 | **blockchain-scanner** | `services/blockchain-scanner` | Scans blockchain events by RPC — stores events, configurable scan interval/batch/confirmations | Elysia 1.3.5 | RabbitMQ, RPC | `blockchainScanner.daemon.ts` | `src/index.ts`, `src/daemons/blockchainScanner.daemon.ts`, `src/models/entity/event.entity.ts` |
| 4 | **blog** | `services/blog` | Blog content management — blogs and posts CRUD | Elysia 1.3.5 | MongoDB | — | `src/index.ts`, `src/models/entity/blog.entity.ts`, `src/models/entity/post.entity.ts` |
| 5 | **charts** | `services/charts` | OHLC price charts, pool transactions, volume data — serves static HTML charts in `public/` | Elysia 1.3.5 | RabbitMQ, Redis, blockchain-daemon | `blockchainEvents.daemon.ts` | `src/index.ts`, `src/controllers/getOhlcPriceData.controller.ts`, `public/` (static HTML charts for business/company/rwa/user) |
| 6 | **company** | `services/company` | Company entity management — company profile, members, permissions | Elysia 1.3.5 | MongoDB | — | `src/index.ts`, `src/models/entity/company.entity.ts`, `src/controllers/company/` |
| 7 | **dao** | `services/dao` | DAO governance — proposals, staking, timelock tasks, treasury withdrawals, voting | Elysia 1.3.5 | RabbitMQ, blockchain-daemon | `blockchainEvents.daemon.ts` | `src/index.ts`, `src/models/entity/proposal.entity.ts`, `src/controllers/getProposals.controller.ts`, `src/daemons/blockchainEvents.daemon.ts` |
| 8 | **documents** | `services/documents` | Document & folder management — hierarchical document storage | Elysia 1.3.5 | MongoDB | — | `src/index.ts`, `src/models/entity/document.entity.ts`, `src/models/entity/documentsFolder.entity.ts` |
| 9 | **faq** | `services/faq` | FAQ management — topics and answers | Elysia 1.3.5 | MongoDB | — | `src/index.ts`, `src/models/entity/topic.entity.ts`, `src/models/entity/answer.entity.ts` |
| 10 | **files** | `services/files` | File storage — upload, download, delete with configurable storage root and size limits | Elysia 1.3.5 | MongoDB, local storage | — | `src/index.ts`, `src/clients/storage.client.ts`, `src/models/entity/file.entity.ts` |
| 11 | **gallery** | `services/gallery` | Gallery & image management — galleries with images | Elysia 1.3.5 | MongoDB | — | `src/index.ts`, `src/models/entity/gallery.entity.ts`, `src/models/entity/image.entity.ts` |
| 12 | **gateway** | `services/gateway` | GraphQL API gateway — federated endpoint combining all services, SSE subscriptions via GraphQL Yoga, Redis event target, codegen | Elysia 1.3.5 + GraphQL Yoga | All services (via Eden clients), Redis, RabbitMQ, all shared | — | `src/index.ts` (Elysia + GraphQL Yoga), `src/graphql/server.ts`, `src/services/`, `codegen.ts` |
| 13 | **loyalty** | `services/loyalty` | Referral & loyalty program — referral registration, commissions, fees, referrer withdraws/claims | Elysia 1.3.5 | RabbitMQ, blockchain-daemon, Signers Manager | `blockchainEvents.daemon.ts` | `src/index.ts`, `src/models/entity/referral.entity.ts`, `src/daemons/blockchainEvents.daemon.ts` |
| 14 | **portfolio** | `services/portfolio` | Portfolio tracking — token balances and transaction history on-chain | Elysia 1.3.5 | RabbitMQ, blockchain-daemon | `blockchainEvents.daemon.ts` | `src/index.ts`, `src/models/entity/tokenBalance.entity.ts`, `src/controllers/getBalances.controller.ts` |
| 15 | **questions** | `services/questions` | Q&A platform — questions, topics, likes | Elysia 1.3.5 | MongoDB | — | `src/index.ts`, `src/models/entity/question.entity.ts`, `src/models/entity/topic.entity.ts` |
| 16 | **reactions** | `services/reactions` | Entity reactions (likes/emojis) — set, reset, query reactions on any entity | Elysia 1.3.5 | MongoDB | — | `src/index.ts`, `src/controllers/setReaction.controller.ts`, `src/models/entity/reaction.entity.ts` |
| 17 | **rwa** (core) | `services/rwa` | Real-World Assets core — business, pool, token management + chain deployment via factory contract, AI integration with OpenRouter, blockchain event handling | Elysia 1.3.5 | RabbitMQ, Redis, OpenRouter, blockchain-daemon, Signers Manager | `blockchainEvents.daemon.ts` | `src/index.ts`, `src/models/entity/pool.entity.ts`, `src/models/entity/business.entity.ts`, `src/clients/poolEvents.client.ts`, `src/daemons/blockchainEvents.daemon.ts` |
| 18 | **signer** | `services/signer` | Blockchain transaction signer — listens RabbitMQ for signature tasks, signs with private key, no MongoDB | Elysia 1.3.5 | RabbitMQ, Signers Manager | `signature.daemon.ts` | `src/index.ts` (no MongoDB), `src/daemons/signature.daemon.ts`, `src/clients/signersManager.client.ts` |
| 19 | **signers-manager** | `services/signers-manager` | Signer orchestration — creates & tracks signature tasks, routes to signers via RabbitMQ | Elysia 1.3.5 | RabbitMQ, MongoDB | `taskResponses.daemon.ts` | `src/index.ts`, `src/models/entity/signatureTask.entity.ts`, `src/daemons/taskResponses.daemon.ts` |
| 20 | **testnet-faucet** | `services/testnet-faucet` | Testnet faucet — dispenses gas, HOLD token, PLATFORM token with cooldown per address | Elysia 1.3.5 | MongoDB, Provider RPC | — | `src/index.ts`, `src/models/entity/faucet.entity.ts`, `src/controllers/requestGas.controller.ts` |

---

## Shared Packages (`services/shared/`)

| Package | Purpose |
|---------|---------|
| `shared/monitoring` | OpenTelemetry tracing, metrics, logging; health plugin, monitoring plugin |
| `shared/errors` | Common AppError classes and error handling |
| `shared/rabbitmq` | RabbitMQ connection manager with reconnect logic |
| `shared/redis-events` | Redis pub/sub for cross-service events |
| `shared/openrouter` | OpenRouter AI API client (used by rwa + ai-assistant) |
| `shared/blockchain-daemon` | Blockchain event listener base class (used by charts, dao, loyalty, portfolio, rwa) |

---

## Dependency Overview (which services connect to which)

```
                ┌─────────────────────────────────┐
                │          GATEWAY                 │
                │   (GraphQL Yoga + Elysia)        │
                │   Federates all services         │
                └──────────┬──────────────────────┘
                           │ connects via Eden clients
     ┌─────────────────────┼─────────────────────────┐
     │                     │                         │
     ▼                     ▼                         ▼
  REST services      Event sources              Infra daemons
  ─────────────      ─────────────             ─────────────
  auth               blockchain-scanner         signer (tx signer)
  blog               (RPC → events → RMQ)       signers-manager
  company                                         (task orchestrator)
  documents
  faq
  files
  gallery
  questions
  reactions
  testnet-faucet

  Blockchain-aware (Elysia + RMQ + daemon):
  ───────────────────────────────────────
  rwa (core) — business, pool, token
  charts — prices, volume, transactions
  dao — proposals, staking, voting
  loyalty — referrals, commissions, fees
  portfolio — balances, transactions

  AI-aware:
  ──────
  ai-assistant (OpenRouter)
  rwa (OpenRouter)
```

---

## Architecture Notes

- **All services** use Elysia 1.3.5 as HTTP framework with OpenTelemetry instrumentation via `@shared/monitoring`
- **Database**: MongoDB (Mongoose) for all persistent services — except `gateway` (proxy only) and `signer` (stateless)
- **Messaging**: RabbitMQ for async cross-service communication (blockchain events, signature tasks)
- **Caching/pub-sub**: Redis for real-time data (charts price data, gateway subscriptions)
- **Daemon pattern**: Services with `daemons/` directories run background workers that listen for blockchain events via RabbitMQ
- **Eden clients**: Services use `@elysiajs/eden` for type-safe HTTP calls to sibling services (ai-assistant→rwa, ai-assistant→portfolio, loyalty→signers-manager, rwa→signers-manager)
