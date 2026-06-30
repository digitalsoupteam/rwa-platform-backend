# ТЗ: Webhooks Microservice

> **Дата:** 2026-06-30
> **Контекст:** RWA Platform backend (Bun monorepo, Elysia, RabbitMQ, MongoDB, Redis, GraphQL)
> **Цель:** Исходящие вебхуки — уведомления внешних систем о событиях платформы
> **Базис:** `services/webhooks/research.md` + верификация против реального кода
> **Принцип:** Консервативный подход — ничего не ломаем, всё по существующим паттернам

---

## 0. Что НЕ делать (антипаттерны)

1. **НЕ публиковать вебхуки синхронно из HTTP-запроса.** Сервис-эмиттер публикует событие в RabbitMQ (fire-and-forget) и сразу возвращает ответ. Доставка — асинхронная, в фоне.

2. **НЕ наследовать `BaseBlockchainDaemon` для вебхук-демона.** Этот класс хардкодит `EXCHANGE_NAME = 'blockchain.events'` (`shared/blockchain-daemon/src/baseBlockchain.daemon.ts:27`). Для `webhooks.events` exchange нужен Pattern 3 — собственный демона-класс с прямым `consume()` через RabbitMQ-клиент обёртку.

3. **НЕ создавать per-endpoint очереди RabbitMQ.** 10K endpoints = 10K очередей → управленческий ад, медленный рестарт. Одна `webhook.delivery` очередь + rate limiter + circuit breaker.

4. **НЕ читать `process.env` вне `index.ts`.** Env-переменные только в `index.ts`, дальше — типизированные аргументы `createApp(port, mongoUri, rabbitMqUri, redisUrl, ...)`.

5. **НЕ использовать `RedisEventsClient` (pub/sub) как кэш подписок.** `RedisEventsClient` (`shared/redis-events/src/redis-events.client.ts`) — только pub/sub (publish/subscribe). Для кэша подписок нужен `ioredis` напрямую (`sadd`/`smembers`/`del` на ключах `webhook:events:{type}`).

6. **НЕ ломать существующие сервисы.** Эмиттеры подключаются по желанию. Webhooks service работает даже если ни один эмиттер не подключён (очередь пуста = нет сообщений).

7. **НЕ добавлять `exports` в `package.json` webhooks-сервиса.** Это ломает `import type { App as WebhooksApp } from '@services/webhooks/src'` в gateway (TS2307). Только `"private": true`, `"type": "module"`, без `exports`.

8. **НЕ изобретать HTTP-клиент.** Bun имеет встроенный `fetch`. Использовать `fetch` с `AbortSignal.timeout(10000)` для доставки.

---

## 1. Архитектура (верифицированная)

### 1.1 Поток

```
Сервисы-эмиттеры (rwa, portfolio, loyalty, dao, documents, auth, ...)
  │  rabbitMQClient.publish("webhooks.events", "pool.created", event)
  │  fire-and-forget (sub-millisecond, non-blocking)
  ▼
RabbitMQ: exchange "webhooks.events" (direct, durable)
  │
  ├─ Queue: "webhooks.events.webhooks" (durable)
  │    └─ bound to ALL event types (pool.created, pool.staked, ...)
  │    └─ consumed by WebhookEventsDaemon
  │
  └─ Queue: "webhook.delivery" (durable)
       └─ consumed by DeliveryDaemon
       └─ dead letter exchange → "webhooks.dlq" (durable)
```

### 1.2 Два демона

**WebhookEventsDaemon** — сопоставляет события с подписками:
- Consumer очереди `webhooks.events.webhooks` (Pattern 3 — plain RabbitMQ consumer)
- На каждое событие: Redis-lookup `webhook:events:{type}` → список `endpointId`
- Для каждого endpoint: проверка `active` (circuit breaker), rate limit (Redis counter)
- Создаёт delivery log в MongoDB (status=pending)
- `sendToQueue("webhook.delivery", { endpointId, eventId, eventType, payload, attempt: 0 })`

**DeliveryDaemon** — доставляет HTTP POST:
- Consumer очереди `webhook.delivery` (Pattern 3 — plain RabbitMQ consumer)
- `fetch(endpoint.url, { method: POST, body, headers, signal: AbortSignal.timeout(10000) })`
- Headers: `X-Webhook-Id`, `X-Webhook-Timestamp`, `X-Webhook-Signature: sha256=<hex>`
- 2xx → ack, обновить delivery log (status=delivered)
- 4xx → nack(requeue=false) → DLQ, деактивировать endpoint (circuit breaker)
- 5xx/timeout/network → retry с exponential backoff ИЛИ nack → DLQ после N попыток
- После N последовательных неудач → деактивировать endpoint (`active=false`)

### 1.3 Почему две очереди, а не одна

- `webhooks.events.webhooks` — fast in, fast out (Redis lookup,MongoDB log, send to delivery queue). Не блокируется медленными HTTP-доставками.
- `webhook.delivery` — slow (HTTP POST, 10s timeout). Изолирует latency доставки от ingestion.
- DLQ на `webhook.delivery` → потерянных сообщений нет.

---

## 2. Структура сервиса

```
services/webhooks/
├── package.json                      — @services/webhooks, БЕЗ exports
├── tsconfig.json                     — копия api-keys/tsconfig.json
├── bunfig.toml                       — preload monitoring.plugin.ts
├── Dockerfile                        — см. §9
├── src/
│   ├── index.ts                       — process.env → createApp(...)
│   ├── app.ts                         — createApp(port, mongoUri, rabbitMqUri, redisUrl, ...)
│   ├── plugins/
│   │   ├── repositories.plugin.ts     — MongoDB: EndpointRepository, DeliveryLogRepository
│   │   ├── clients.plugin.ts          — RabbitMQClient + ioredis (Redis) + WebhookDeliveryClient
│   │   ├── services.plugin.ts         — WebhookService, DeliveryService
│   │   ├── daemons.plugin.ts          — WebhookEventsDaemon + DeliveryDaemon
│   │   └── controllers.plugin.ts      — REST API (CRUD endpoints)
│   ├── models/
│   │   ├── shared/enums.model.ts      — WebhookEventType enum, DeliveryStatus enum
│   │   ├── entity/
│   │   │   ├── endpoint.entity.ts     — webhook_endpoints (Mongoose)
│   │   │   └── deliveryLog.entity.ts  — webhook_delivery_logs (Mongoose)
│   │   └── validation/
│   │       ├── endpoint.validation.ts — TypeBox DTO (create/update/response)
│   │       └── deliveryLog.validation.ts — TypeBox DTO (response)
│   ├── repositories/
│   │   ├── endpoint.repository.ts
│   │   └── deliveryLog.repository.ts
│   ├── clients/
│   │   ├── webhookEvents.client.ts    — consume "webhooks.events.webhooks" + ack/nack
│   │   ├── webhookDelivery.client.ts  — consume "webhook.delivery" + sendToQueue + ack/nack
│   │   └── redis.client.ts            — ioredis wrapper (sadd/smembers/del/incr/expire)
│   ├── services/
│   │   ├── webhook.service.ts         — subscription CRUD + cache sync
│   │   └── delivery.service.ts        — HTTP POST + retry + circuit breaker + DLQ logic
│   ├── daemons/
│   │   ├── webhookEvents.daemon.ts    — Pattern 3 consumer → Redis lookup → enqueue delivery
│   │   └── delivery.daemon.ts         — Pattern 3 consumer → HTTP POST → ack/retry/DLQ
│   └── controllers/
│       ├── createEndpoint.controller.ts
│       ├── getEndpoints.controller.ts
│       ├── getEndpoint.controller.ts
│       ├── updateEndpoint.controller.ts
│       └── deleteEndpoint.controller.ts
```

---

## 3. Модели данных

### 3.1 endpoint.entity.ts

```typescript
{
  _id: Types.ObjectId,
  userId: { type: String, required: true, index: true },
  wallet: { type: String, required: true },         // денормализовано из auth
  url: { type: String, required: true },
  secret: { type: String, required: true },          // HMAC-SHA256 ключ (см. §10)
  events: { type: [String], required: true, default: [] }, // ["pool.created", "pool.staked"]
  description: { type: String, default: '' },
  active: { type: Boolean, default: true, index: true },
  rateLimitPerMinute: { type: Number, default: 100 },
  consecutiveFailures: { type: Number, default: 0 }, // circuit breaker counter
  maxAttempts: { type: Number, default: 8 },         // max retry attempts per event
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}
```

Indexes: `{ userId: 1 }`, `{ active: 1 }`, `{ events: 1 }` (для fallback-lookup без Redis).

### 3.2 deliveryLog.entity.ts

```typescript
{
  _id: Types.ObjectId,
  endpointId: { type: Types.ObjectId, required: true, index: true },
  eventType: { type: String, required: true },
  eventId: { type: String, required: true },          // UUID — idempotency key
  payload: { type: Object, required: true },
  status: { type: String, enum: ['pending', 'delivered', 'failed', 'dead_letter'], default: 'pending' },
  attempts: [{
    timestamp: { type: Date, default: Date.now },
    statusCode: { type: Number },
    responseBody: { type: String, default: '' },
    error: { type: String, default: '' },
  }],
  nextRetryAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
}
```

Indexes: `{ endpointId: 1, eventId: 1 }` (unique — дедупликация), `{ status: 1, nextRetryAt: 1 }` (для retry-sweep, если используем polling retry).

### 3.3 WebhookEvent (сообщение в RabbitMQ)

```typescript
interface WebhookEvent {
  id: string;          // UUID — idempotency key
  type: string;        // "pool.created", "pool.staked", ...
  timestamp: number;   // Date.now()
  payload: unknown;    // business data
}
```

Это контракт. Эмиттеры публикуют именно такой объект: `rabbitMQClient.publish('webhooks.events', 'pool.created', { id: crypto.randomUUID(), type: 'pool.created', timestamp: Date.now(), payload: {...} })`.

### 3.4 Типы событий (WebhookEventType enum)

```typescript
enum WebhookEventType {
  POOL_CREATED = 'pool.created',
  POOL_STAKED = 'pool.staked',
  POOL_BURNED = 'pool.burned',
  BUSINESS_CREATED = 'business.created',
  BUSINESS_VERIFIED = 'business.verified',
  DOCUMENT_UPLOADED = 'document.uploaded',
  DOCUMENT_VERIFIED = 'document.verified',
  LOYALTY_REWARD = 'loyalty.reward',
  PROPOSAL_CREATED = 'proposal.created',
  PROPOSAL_EXECUTED = 'proposal.executed',
  VOTE_CAST = 'vote.cast',
  USER_REGISTERED = 'user.registered',
  USER_VERIFIED = 'user.verified',
}
```

Список стартовый — расширяется по мере подключения эмиттеров.

---

## 4. RabbitMQ topology

```
Exchange: "webhooks.events" (direct, durable)
  ├─ Queue: "webhooks.events.webhooks" (durable)
  │    └─ bind to EACH WebhookEventType (pool.created, pool.staked, ...)
  │    └─ consumer: WebhookEventsDaemon
  │
  └─ (эмиттеры публикуют сюда)

Queue: "webhook.delivery" (durable)
  └─ consumer: DeliveryDaemon
  └─ dead letter exchange: "webhooks.dlq"
  └─ dead letter routing key: "webhook.delivery.dlq"

Queue: "webhook.delivery.dlq" (durable)
  └─ для ручного inspect/replay
```

**Bind queue to exchange:** при инициализации `WebhookEventsClient.initialize()` — для каждого значения `WebhookEventType` вызвать `bindQueue("webhooks.events.webhooks", "webhooks.events", eventType)`. Это идемпотентно.

**Dead Letter Queue:** `webhook.delivery` создаётся с `arguments: { 'x-dead-letter-exchange': 'webhooks.dlq', 'x-dead-letter-routing-key': 'webhook.delivery.dlq' }`. После `nack(msg, false)` (requeue=false) и превышения max retries → сообщение автоматически в DLQ.

**Retry strategy (выбрать одну):**

- **Вариант A (проще, рекомендуется для старта):** nack(requeue=false) → DLQ. После N попыток (считаем в delivery log) → `status=dead_letter`. Replay — вручную через admin endpoint.
- **Вариант B (сложнее, для production):** requeue с задержкой через `nextRetryAt` + polling-sweep демон. Сообщение переоткладывается, но требует отдельного процесса для retry-sweep.

**ТЗ рекомендует Вариант A** — проще, надёжнее, DLQ как safety net. Retry-sweep можно добавить позже.

---

## 5. Redis (ioredis, НЕ RedisEventsClient)

`RedisEventsClient` — pub/sub, не подходит для кэша. Использовать `ioredis` напрямую.

### 5.1 Cache keys

- `webhook:events:{eventType}` → Redis SET of `endpointId` strings
- `webhook:endpoint:{endpointId}:active` → Redis STRING "1"/"0" (circuit breaker status, TTL 60s)
- `webhook:endpoint:{endpointId}:rl` → Redis counter (rate limit, TTL 60s, incr)

### 5.2 Cache sync

На любую CRUD-операцию с endpoint:
- `create`: для каждого `event` в `endpoint.events` → `redis.sadd("webhook:events:{event}", endpointId)`
- `update`: diff old vs new events → `sadd` added, `srem` removed
- `delete`: для каждого event → `srem("webhook:events:{event}", endpointId)`
- `active=false` (circuit breaker): `redis.set("webhook:endpoint:{id}:active", "0", "EX", 60)`

### 5.3 Fallback

Если Redis недоступен (connection error) → fallback на MongoDB lookup: `endpointRepository.find({ events: eventType, active: true })`. Медленнее, но работает. Логировать warning.

---

## 6. HTTP Delivery

### 6.1 Запрос

```typescript
const body = JSON.stringify(event.payload);
const signature = createHmac('sha256', endpoint.secret).update(body).digest('hex');

const response = await fetch(endpoint.url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Id': event.id,
    'X-Webhook-Timestamp': String(event.timestamp),
    'X-Webhook-Signature': `sha256=${signature}`,
  },
  body,
  signal: AbortSignal.timeout(10000),
});
```

### 6.2 Retry logic

| HTTP status | Действие |
|---|---|
| 2xx | ack, `deliveryLog.status = 'delivered'`, сброс `consecutiveFailures = 0` |
| 3xx | ack (редирект — не наша проблема) |
| 400, 404, 410 | nack(requeue=false) → DLQ, деактивировать endpoint |
| 401, 403, 429 | retry (может быть временно), но после max → DLQ |
| 5xx | retry, increment `consecutiveFailures` |
| timeout / network error | retry, increment `consecutiveFailures` |

**Max attempts:** `endpoint.maxAttempts` (default 8). После N → `status=dead_letter`, DLQ.

**Circuit breaker:** `consecutiveFailures > 5` → `endpoint.active = false`, `redis.set("webhook:endpoint:{id}:active", "0", "EX", 3600)`. Endpoint деактивирован на час.

### 6.3 Exponential backoff (если Вариант B)

```
delay = min(1000 * 2^attempt + random(0, 250), 128000)
```

Попытки: 1s → 2s → 4s → 8s → 16s → 32s → 64s → 128s → DLQ.

---

## 7. REST API (controllers)

Все endpoints требуют `userId` + `wallet` в body (проксируется из gateway через GraphQL context).

### 7.1 POST /webhooks/endpoints — create

```typescript
body: {
  userId: string,
  wallet: string,
  url: string,
  events: string[],          // subset of WebhookEventType
  description?: string,
  rateLimitPerMinute?: number, // default 100
}
response: { id, url, events, description, active, rateLimitPerMinute, createdAt }
```

`secret` генерируется сервером (`crypto.randomUUID() + crypto.randomBytes(16)`), возвращается ОДИН раз в ответе. В БД хранится зашифрованным (см. §10).

### 7.2 GET /webhooks/endpoints?userId=...&wallet=... — list

```typescript
response: [{ id, url, events, description, active, rateLimitPerMinute, createdAt, updatedAt }]
```

`secret` НЕ возвращается.

### 7.3 GET /webhooks/endpoints/:id?userId=...&wallet=... — get one

```typescript
response: { id, userId, wallet, url, events, description, active, rateLimitPerMinute, createdAt, updatedAt }
```

### 7.4 PATCH /webhooks/endpoints/:id — update

```typescript
body: {
  userId: string,
  wallet: string,
  url?: string,
  events?: string[],
  description?: string,
  active?: boolean,
  rateLimitPerMinute?: number,
}
```

Если `url` меняется → генерировать новый `secret`, вернуть в response.

### 7.5 DELETE /webhooks/endpoints/:id?userId=...&wallet=...

Удаляет endpoint + чистит Redis cache.

### 7.6 POST /webhooks/endpoints/:id/replay — replay from DLQ (future)

Админский endpoint для replay сообщений из DLQ. Вне scope первой итерации.

---

## 8. Gateway integration (GraphQL)

### 8.1 gateway/src/config/index.ts

```typescript
WEBHOOKS: {
  URL: String(process.env.WEBHOOKS_SERVICE_URL),
},
```

### 8.2 gateway/src/clients/eden.clients.ts

```typescript
import type { App as WebhooksApp } from '@services/webhooks/src';
export const webhooksClient = createEdenTreatyClient<WebhooksApp>(CONFIG.SERVICES.WEBHOOKS.URL);
export type WebhooksClient = typeof webhooksClient;
```

### 8.3 gateway/src/graphql/context/types.ts

```typescript
import type { WebhooksClient } from '../../clients/eden.clients';
// Add to ServiceClients:
webhooksClient: WebhooksClient;
```

### 8.4 gateway/src/graphql/server/index.ts

```typescript
// Add to context:
webhooksClient,
```

### 8.5 gateway/src/graphql/modules/webhooks/

```
webhooks/
├── schema.graphql
└── resolvers/
    ├── index.ts
    ├── queries/
    │   ├── getWebhookEndpoints.ts
    │   └── getWebhookEndpoint.ts
    └── mutations/
        ├── createWebhookEndpoint.ts
        ├── updateWebhookEndpoint.ts
        └── deleteWebhookEndpoint.ts
```

### 8.6 schema.graphql

```graphql
type WebhookEndpoint {
  id: ID!
  userId: String!
  url: String!
  events: [String!]!
  description: String
  active: Boolean!
  rateLimitPerMinute: Int!
  createdAt: String!
  updatedAt: String!
}

input CreateWebhookEndpointInput {
  url: String!
  events: [String!]!
  description: String
  rateLimitPerMinute: Int
}

input UpdateWebhookEndpointInput {
  url: String
  events: [String!]
  description: String
  active: Boolean
  rateLimitPerMinute: Int
}

type Query {
  getWebhookEndpoints: [WebhookEndpoint!]!
  getWebhookEndpoint(id: ID!): WebhookEndpoint
}

type Mutation {
  createWebhookEndpoint(input: CreateWebhookEndpointInput!): WebhookEndpoint!
  updateWebhookEndpoint(id: ID!, input: UpdateWebhookEndpointInput!): WebhookEndpoint!
  deleteWebhookEndpoint(id: ID!): Boolean!
}
```

`userId` и `wallet` берутся из GraphQL context (auth middleware), НЕ из input.

### 8.7 gateway/src/graphql/modules/index.ts

```typescript
import { webhooksResolvers } from './webhooks/resolvers';
export const resolvers = mergeResolvers([..., webhooksResolvers]);
```

### 8.8 docker-compose.yml — добавить в gateway env

```yaml
WEBHOOKS_SERVICE_URL: ${WEBHOOKS_SERVICE_URL}
```

---

## 9. Docker

### 9.1 Dockerfile (services/webhooks/Dockerfile)

```dockerfile
FROM oven/bun:latest
WORKDIR /app

COPY package.json .
COPY shared/monitoring/package.json ./shared/monitoring/
COPY shared/errors/package.json ./shared/errors/
COPY shared/rabbitmq/package.json ./shared/rabbitmq/
COPY shared/redis-events/package.json ./shared/redis-events/
COPY services/webhooks/package.json ./services/webhooks/

COPY bun.lockb .
RUN bun install

COPY shared/ ./shared/
COPY services/webhooks ./services/webhooks

EXPOSE ${PORT}
WORKDIR /app/services/webhooks
ENTRYPOINT ["bun"]
CMD ["src/index.ts"]
```

### 9.2 docker-compose.yml — добавить webhooks service

```yaml
webhooks:
  container_name: webhooks
  build:
    context: ../..
    dockerfile: services/webhooks/Dockerfile
  environment:
    <<: [*mongo-env, *monitoring-env, *rabbit-env]
    SERVICE_NAME: ${WEBHOOKS_SERVICE_NAME}
    SERVICE_VERSION: ${WEBHOOKS_SERVICE_VERSION}
    MONGODB_DBNAME: ${WEBHOOKS_MONGODB_DBNAME}
    OTEL_SERVICE_NAME: ${WEBHOOKS_SERVICE_NAME}
    OTEL_RESOURCE_ATTRIBUTES: service.name=${WEBHOOKS_SERVICE_NAME},service.version=${WEBHOOKS_SERVICE_VERSION},deployment.environment=${DEPLOYMENT_ENVIRONMENT}
    PORT: ${WEBHOOKS_PORT}
    REDIS_URL: ${REDIS_URL}
  volumes: *monitoring-volumes
  networks:
    - app-network
  depends_on:
    mongodb:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
    redis:
      condition: service_healthy
```

### 9.3 .env — добавить переменные

Файл: `infrastructure/docker/.env` (не `.env.examples` — такого файла нет в репо).

```bash
# Webhooks service
WEBHOOKS_SERVICE_NAME=webhooks
WEBHOOKS_SERVICE_VERSION=1.0.0
WEBHOOKS_PORT=3020
WEBHOOKS_MONGODB_DBNAME=webhooks
WEBHOOKS_SERVICE_URL=http://webhooks:3020
```

Порт 3020 — следующий свободный после существующих сервисов.

---

## 10. Безопасность

### 10.1 HMAC secret storage

`endpoint.secret` — чувствительные данные. Хранить зашифрованным в MongoDB.

**Минимум:** шифровать на уровне приложения через service-level encryption key.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.WEBHOOKS_ENCRYPTION_KEY; // 32 bytes, base64

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'base64'), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(encrypted: string): string {
  const buf = Buffer.from(encrypted, 'base64');
  const iv = buf.subarray(0, 16);
  const authTag = buf.subarray(16, 32);
  const encryptedData = buf.subarray(32);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'base64'), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8');
}
```

Добавить `WEBHOOKS_ENCRYPTION_KEY` в .env (32 bytes base64).

### 10.2 URL validation

- Только `https://` URLs (reject `http://` в production)
- Reject localhost / 127.0.0.1 / 10.x / 172.16-31.x / 192.168.x (SSRF protection)
- Max URL length: 2048

### 10.3 Rate limiting

- Per-endpoint: `rateLimitPerMinute` (default 100). Redis counter: `incr("webhook:endpoint:{id}:rl")`, если > limit → skip event, log warning.
- Per-user: max 50 endpoints per user (hard limit в createEndpoint controller).

### 10.4 Event payload size

- Max payload size: 256KB. Если больше → обрезать или отклонить.

---

## 11. Эмиттеры (интеграция с другими сервисами)

### 11.1 Что нужно каждому эмиттеру

Сервисы, которые УЖЕ имеют RabbitMQ (`rwa`, `charts`, `dao`, `loyalty`, `ai-evaluator`, `blockchain-scanner`):
- Добавить `setupExchange('webhooks.events', 'direct', { durable: true })` в `clients.plugin.ts` (после `rabbitMQClient.connect()`)
- Добавить `publish('webhooks.events', 'pool.created', { id, type, timestamp, payload })` в business logic

Сервисы БЕЗ RabbitMQ (`portfolio`, `documents`, `auth`, `blog`, `faq`, `company`, `questions`, `reactions`, `files`, `gallery`):
- Добавить `RabbitMQClient` в `clients.plugin.ts`
- Добавить `*rabbit-env` в docker-compose env для этого сервиса
- Добавить `RABBITMQ_URL`, `RABBITMQ_RECONNECT_INTERVAL`, `RABBITMQ_MAX_RECONNECT_ATTEMPTS` в .env
- Затем — publish calls

### 11.2 Пример: rwa service — publish pool.created

```typescript
// services/rwa/src/services/pool.service.ts — в методе создания пула:
await this.rabbitMQClient.publish('webhooks.events', 'pool.created', {
  id: crypto.randomUUID(),
  type: 'pool.created',
  timestamp: Date.now(),
  payload: { poolId, ownerId, name, ... },
});
```

### 11.3 Порядок подключения эмиттеров (приоритет)

1. `rwa` — pool.created, pool.staked, pool.burned, business.created, business.verified
2. `portfolio` — portfolio.created, portfolio.updated
3. `loyalty` — loyalty.reward
4. `dao` — proposal.created, proposal.executed, vote.cast
5. `documents` — document.uploaded, document.verified
6. `auth` — user.registered, user.verified

**Важно:** webhooks service работает БЕЗ эмиттеров. Эмиттеры подключаются инкрементально, по одному. Webhooks service просто получает пустую очередь — это нормально.

### 11.4 Существующий Redis pub/sub в rwa

`rwa/src/clients/poolEvents.client.ts` уже публикует `pool:deployed` через RedisEventsClient (pub/sub). Это ДРУГОЙ механизм — для внутренних real-time обновлений (websocket gateway). Webhooks — отдельный канал для внешних систем. Не путать, не объединять.

---

## 12. Мониторинг

### 12.1 Метрики (через @shared/monitoring metrics)

- `webhook_events_received_total{type="..."}` — счётчик входящих событий
- `webhook_delivery_total{status="success|failed|dead_letter"}` — счётчик доставок
- `webhook_delivery_latency_seconds` — гистограмма времени доставки
- `webhook_queue_depth` — gauge глубины очереди (через RabbitMQ management API ИЛИ channel.check)
- `webhook_dlq_depth` — gauge глубины DLQ (alert если > 0)
- `webhook_active_endpoints` — gauge активных подписок
- `webhook_circuit_breaker_trips_total` — счётчик срабатываний circuit breaker

### 12.2 Grafana dashboard

Добавить dashboard в `infrastructure/docker/grafana/dashboards/`. Alert rules:
- DLQ depth > 0 → alert
- success rate < 95% за 5 мин → alert
- circuit breaker trips > 10 за час → alert

---

## 13. Этапы реализации

### Этап 1: Foundation (1-2 дня)

1. Создать `services/webhooks/` скелет по паттерну `api-keys` (package.json, tsconfig, bunfig, Dockerfile, src/index.ts, src/app.ts)
2. Создать модели: enums.model.ts, endpoint.entity.ts, deliveryLog.entity.ts, validation schemas
3. Создать repositories: endpoint.repository.ts, deliveryLog.repository.ts
4. Создать clients: redis.client.ts (ioredis wrapper), webhookEvents.client.ts, webhookDelivery.client.ts
5. Создать plugins: repositories, clients, services, daemons, controllers
6. Добавить в docker-compose.yml, .env
7. `bun install` → `bun run tsc --noEmit` — проверить компиляцию

**Критерий приёмки Этапа 1:** сервис запускается, `/health` отвечает 200, tsc --noEmit без ошибок.

### Этап 2: Core logic (2-3 дня)

1. `webhook.service.ts` — CRUD + Redis cache sync
2. `delivery.service.ts` — HTTP POST + retry + circuit breaker + DLQ logic
3. `webhookEvents.daemon.ts` — consume `webhooks.events.webhooks`, Redis lookup, enqueue delivery
4. `delivery.daemon.ts` — consume `webhook.delivery`, HTTP POST, ack/retry/DLQ
5. REST controllers (create/get/list/update/delete endpoint)
6. Тест: вручную опубликовать сообщение в `webhooks.events` → проверить доставку

**Критерий приёмки Этапа 2:** end-to-end работает. Создаём endpoint → пабликум событие → вебхук доставлен.

### Этап 3: Gateway integration (1 день)

1. Добавить `WEBHOOKS_SERVICE_URL` в gateway config
2. Добавить Eden client в eden.clients.ts
3. Создать GraphQL модуль (schema + resolvers)
4. Регистрировать в modules/index.ts
5. Добавить env в gateway docker-compose

**Критерий приёмки Этапа 3:** GraphQL queries/mutations работают через gateway.

### Этап 4: Emitter integration (по 0.5-1 дню на сервис)

По приоритету из §11.3. Каждый эмиттер:
1. Если нет RabbitMQ — добавить RabbitMQClient в clients.plugin.ts + docker-compose env
2. `setupExchange('webhooks.events', 'direct', { durable: true })` в init
3. Publish calls в business logic
4. Тест: событие → вебхук доставлен

**Критерий приёмки Этапа 4:** бизнес-события доходят до внешних систем.

### Этап 5: Monitoring & polish (1 день)

1. Метрики (counters, histograms, gauges)
2. Grafana dashboard
3. Alert rules
4. Нагрузочный тест (10K events spike)

---

## 14. Риски и митигации

| Риск | Вероятность | Impact | Митигация |
|---|---|---|---|
| Один медленный endpoint блокирует очередь delivery | Средняя | Высокий | Per-endpoint timeout 10s + circuit breaker + max concurrency в DeliveryDaemon |
| Redis недоступен → lookup падает | Низкая | Средний | Fallback на MongoDB lookup, лог warning |
| Эмиттер публикует до создания exchange | Средняя | Низкий | Каждый эмиттер вызывает `setupExchange` (идемпотентно) перед publish |
| MongoDB недоступен → delivery log не пишется | Низкая | Средний | Вебхук всё равно доставляется (RabbitMQ держит сообщение), лог пишется при восстановлении |
| Secret утечка из MongoDB | Низкая | Высокий | AES-256-GCM шифрование (§10.1) |
| SSRF через webhook URL | Средняя | Высокий | URL validation (§10.2): только https, reject private IPs |
| Payload > 256KB | Низкая | Низкий | Truncate или reject в WebhookEventsDaemon |
| 10K endpoints → Redis SET огромный | Низкая | Средний | Redis держит SET из 10K строк без проблем (~1MB). При 100K+ — sharding |

---

## 15. Критерии приёмки (определение готовности)

- [ ] `bun run tsc --noEmit` из `services/webhooks/` — 0 ошибок (в `src/`)
- [ ] `bun run format` — без изменений (код отформатирован)
- [ ] Сервис запускается в Docker, `/health` → 200
- [ ] Создание endpoint через REST → 201, secret возвращается один раз
- [ ] Публикация события в `webhooks.events` → HTTP POST доставлен на URL
- [ ] 2xx ответ → ack, delivery log status=delivered
- [ ] 5xx ответ → retry, после max → DLQ
- [ ] 4xx ответ → DLQ, endpoint деактивирован
- [ ] Circuit breaker: 5 consecutive failures → endpoint.active=false
- [ ] HMAC signature валиден (receiver может verify)
- [ ] Redis cache: CRUD endpoint → cache updated
- [ ] Redis down → fallback на MongoDB, delivery продолжается
- [ ] GraphQL: createWebhookEndpoint / getWebhookEndpoints / updateWebhookEndpoint / deleteWebhookEndpoint — работают
- [ ] Метрики видны в Prometheus/Grafana
- [ ] DLQ depth alert работает
- [ ] docker-compose up — весь стек поднимается, webhooks отвечает

---

## 16. Open questions (требуют решения)

1. **Retry strategy:** Вариант A (DLQ после max retries, без requeue delay) vs Вариант B (requeue с exponential backoff + retry-sweep демон)? ТЗ рекомендует A — проще, надёжнее.

2. **Admin replay endpoint:** Нужен ли REST endpoint для replay из DLQ? Или ручная работа через RabbitMQ management UI?

3. **Webhook payload versioning:** `pool.created.v1` vs `pool.created`? Начать без версионности, добавить при первом breaking change.

4. **Endpoint ownership:** `userId` + `wallet` в body. Как обрабатывается смена владельца? Удалять endpoints или передавать?

5. **Concurrency в DeliveryDaemon:** Сколько параллельных HTTP-доставок? Начать с 1 (sequential, как в BaseBlockchainDaemon), добавить prefetch позже.

---

## 17. Ссылки на реальный код (для реализации)

| Что | Где смотреть |
|---|---|
| RabbitMQ client API | `shared/rabbitmq/src/rabbitmq.client.ts` |
| Plain RabbitMQ consumer daemon (Pattern 3) | `services/ai-evaluator/src/daemons/evaluationRequests.daemon.ts` |
| Plain RabbitMQ consumer client wrapper | `services/ai-evaluator/src/clients/evaluationRequests.client.ts` |
| Service skeleton (без RabbitMQ) | `services/api-keys/src/` |
| Service skeleton (с RabbitMQ + daemons) | `services/ai-evaluator/src/` |
| Producer (publish to exchange) | `services/blockchain-scanner/src/services/blockchainScanner.service.ts:155` |
| Producer (sendToQueue) | `services/rwa/src/clients/evaluationRequests.client.ts:21` |
| Redis pub/sub (НЕ для кэша) | `shared/redis-events/src/redis-events.client.ts` |
| Gateway config | `services/gateway/src/config/index.ts` |
| Gateway Eden clients | `services/gateway/src/clients/eden.clients.ts` |
| Docker compose | `infrastructure/docker/docker-compose.yml` |
| .env | `infrastructure/docker/.env` |
| BaseBlockchainDaemon (НЕ наследовать!) | `shared/blockchain-daemon/src/baseBlockchain.daemon.ts` |
| api-keys Dockerfile (простейший) | `services/api-keys/Dockerfile` |
| api-keys package.json (простейший) | `services/api-keys/package.json` |

---

## 18. TL;DR

Webhooks microservice — асинхронный delivery pipeline. Эмиттеры публикуют события в RabbitMQ exchange `webhooks.events` (fire-and-forget). Webhooks service: потребляет события → находит подписки (Redis cache) → ставит delivery tasks в очередь → DeliveryDaemon делает HTTP POST с HMAC подписью → retry/DLQ/circuit breaker. Gateway: GraphQL модуль для CRUD подписок. Безопасность: шифрование secret, URL validation (SSRF), rate limiting. Эмиттеры подключаются инкрементально — webhooks service работает сразу, даже без единого эмиттера.