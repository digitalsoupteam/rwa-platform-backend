# Webhooks Microservice — Research Document

> **Date:** 2026-06-30
> **Context:** RWA Platform backend (Bun monorepo, Elysia, RabbitMQ, MongoDB, GraphQL)
> **Goal:** Implement a new `webhooks` microservice for outbound webhook delivery to users
> **Author:** Hermes Agent (research + codebase analysis)

---

## Table of Contents

1. [Codebase Architecture Analysis](#1-codebase-architecture-analysis)
2. [Internet Research: Webhook Best Practices](#2-internet-research-webhook-best-practices)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Integration Points](#4-integration-points)
5. [Performance Considerations](#5-performance-considerations)
6. [Failure Modes & Reliability](#6-failure-modes--reliability)
7. [Podvodnye Kamni (Подводные камни) — Critical Findings](#7-podvodnye-kamni-подводные-камни--critical-findings)
8. [Open-Source Alternatives](#8-open-source-alternatives)
9. [Implementation Plan](#9-implementation-plan)
10. [Questions & Answers from Discussion](#10-questions--answers-from-discussion)

---

## 1. Codebase Architecture Analysis

### 1.1 Project Structure

```
rwa-backend-new2/
├── services/           # ~18 microservices
│   ├── gateway/        # GraphQL монолит (Yoga + Elysia)
│   ├── api-keys/       # Reference service (простейший)
│   ├── blockchain-scanner/  # Producer в RabbitMQ
│   ├── charts/         # Consumer blockchain.events
│   ├── dao/            # Consumer blockchain.events
│   ├── loyalty/        # Consumer blockchain.events
│   ├── rwa/            # Consumer + Producer (evaluation.requests)
│   ├── ai-evaluator/   # Consumer (evaluation.requests) + Producer (evaluation.results)
│   ├── auth/
│   ├── portfolio/
│   ├── documents/
│   ├── gallery/
│   ├── blog/
│   ├── faq/
│   ├── company/
│   ├── questions/
│   ├── reactions/
│   ├── files/
│   ├── signers-manager/
│   ├── signer/
│   └── testnet-faucet/
├── shared/
│   ├── rabbitmq/       # RabbitMQClient (connect, publish, consume, ack, nack)
│   ├── blockchain-daemon/  # BaseBlockchainDaemon (abstract consumer)
│   ├── monitoring/     # OpenTelemetry, metrics, logger, health
│   ├── errors/         # AppError, ErrorHandlerPlugin
│   ├── openrouter/     # OpenRouter client
│   ├── redis-events/   # Redis pub/sub client
│   └── files/          # File upload helpers
├── infrastructure/docker/
│   └── docker-compose.yml  # All services + RabbitMQ + MongoDB + Redis + monitoring
└── package.json        # Workspaces: services/*, shared/*
```

### 1.2 Service Pattern (Uniform Across All Services)

Every service follows the same layered architecture:

```
index.ts
  └─ createApp(port, mongoUri, rabbitMqUri?, ...)
       ├─ repositories.plugin.ts    — MongoDB (mongoose.connect + repositories)
       ├─ clients.plugin.ts         — RabbitMQClient, Redis, HTTP clients (Eden Treaty)
       ├─ services.plugin.ts        — Business logic (takes repository + client via decorator)
       ├─ daemons.plugin.ts         — Background processes (consumers, scanners)
       └─ controllers.plugin.ts     — HTTP endpoints (Elysia)
```

Each plugin is an Elysia plugin that `.decorate('name', instance)`. The next plugin accesses via `decorator.name`.

**Key imports from shared:**
```ts
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { BaseBlockchainDaemon } from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import { monitoringPlugin } from '@shared/monitoring/src/monitoring.plugin';
import { healthPlugin } from '@shared/monitoring/src/health.plugin';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';
```

### 1.3 RabbitMQ Usage Patterns

**Pattern A: Exchange → Queue (fan-out via routing keys)**

Used by: `blockchain-scanner` → `charts`, `dao`, `loyalty`, `rwa`

```
blockchain-scanner (producer)
  └─ BlockchainScannerService.applyBlockEvents()
       └─ rabbitMQClient.publish("blockchain.events", event.name, event)
            └─ exchange "blockchain.events" (direct, durable)
                 ├─ routing key "Pool_RwaMinted" → queue "blockchain.events.charts"  → charts
                 ├─ routing key "Pool_RwaMinted" → queue "blockchain.events.loyalty" → loyalty
                 ├─ routing key "Governance_ProposalCreated" → queue "blockchain.events.dao" → dao
                 └─ routing key "Pool_RwaMinted" → queue "blockchain.events.rwa"    → rwa
```

**Pattern B: Point-to-point Queue (RPC-like)**

Used by: `rwa` ↔ `ai-evaluator`

```
rwa service (producer)                    ai-evaluator (consumer)
  └─ EvaluationRequestsClient               └─ EvaluationRequestsDaemon
       .sendToQueue("evaluation.requests")       .consume("evaluation.requests")
            → queue "evaluation.requests" → handleRequest() → process
                                                              ↓
       EvaluationResultsDaemon              EvaluationResultsClient
       .consume("evaluation.results")       .sendToQueue("evaluation.results")
            ← queue "evaluation.results" ←
```

**RabbitMQClient shared API:**
```ts
// Producer
await rabbitMQClient.publish(exchange, routingKey, content, { persistent: true });
await rabbitMQClient.sendToQueue(queue, content, { persistent: true });

// Consumer
await rabbitMQClient.setupExchange(name, 'direct', { durable: true });
await rabbitMQClient.setupQueue(name, { durable: true });
await rabbitMQClient.bindQueue(queue, exchange, pattern);
await rabbitMQClient.consume(queue, handler, { noAck: false });
await rabbitMQClient.ack(message);
await rabbitMQClient.nack(message, requeue);
```

### 1.4 BaseBlockchainDaemon (Abstract Consumer)

```ts
// shared/blockchain-daemon/src/baseBlockchain.daemon.ts
abstract class BaseBlockchainDaemon {
  protected abstract getEventRouting(): EventRouting;
  // { [eventName: string]: (event) => Promise<void> }

  async initialize(): Promise<void> {
    // 1. setupExchange("blockchain.events", "direct", { durable: true })
    // 2. setupQueue(this.queueName, { durable: true })
    // 3. for each eventName → bindQueue(queue, exchange, eventName)
    // 4. consume(queue, handleMessage, { noAck: false })
  }

  private async handleMessage(message): Promise<void> {
    // Sequential processing via promise chain
    // Parse event → get handler from routing → handler(event) → ack
    // On error → nack(message, false) — requeue
  }
}
```

### 1.5 Gateway Architecture

```
gateway/src/
  index.ts              — Elysia server, listens on :3000
  config/index.ts       — CONFIG.SERVICES.{AUTH, RWA, ...}.URL
  clients/eden.clients.ts  — createEdenTreatyClient<App>(url) for each service
  graphql/
    server/index.ts     — Yoga server, context builder
    context/types.ts    — GraphQLContext interface
    modules/
      index.ts          — mergeResolvers([...])
      api-keys/         — Reference module
        schema.graphql
        resolvers/
          index.ts
          queries/
          mutations/
      auth/
      rwa/
      ... (18 modules)
```

**Adding a new service to gateway requires:**
1. `config/index.ts` — add URL
2. `clients/eden.clients.ts` — add Eden client
3. `graphql/context/types.ts` — add to ServiceClients
4. `graphql/server/index.ts` — add to context
5. `graphql/modules/{name}/schema.graphql` — GraphQL types
6. `graphql/modules/{name}/resolvers/` — resolvers
7. `graphql/modules/index.ts` — register

### 1.6 Services That Already Use RabbitMQ

| Service | Role | Exchange/Queue |
|---|---|---|
| `blockchain-scanner` | **Producer** | `blockchain.events` (exchange) |
| `charts` | **Consumer** | `blockchain.events.charts` (queue) |
| `dao` | **Consumer** | `blockchain.events.dao` (queue) |
| `loyalty` | **Consumer** | `blockchain.events.loyalty` (queue) |
| `rwa` | **Consumer + Producer** | `blockchain.events.rwa` (queue) + `evaluation.requests` (queue) |
| `ai-evaluator` | **Consumer + Producer** | `evaluation.requests` (queue) + `evaluation.results` (queue) |

**Services WITHOUT RabbitMQ:** `auth`, `blog`, `faq`, `company`, `questions`, `reactions`, `files`, `documents`, `gallery`, `portfolio`, `signers-manager`, `testnet-faucet`, `api-keys`

### 1.7 Infrastructure (docker-compose.yml)

- **RabbitMQ:** `image: rabbitmq:management`, port 5672, management UI
- **MongoDB:** `image: mongo:latest`, per-service databases
- **Redis:** `image: redis:latest`
- **Monitoring:** Prometheus + Loki + Tempo + Grafana + Alloy (OpenTelemetry)
- **Network:** `app-network` (bridge), all services communicate internally

---

## 2. Internet Research: Webhook Best Practices

### 2.1 Key Sources

1. **Hookdeck** — "Webhooks at Scale: Best Practices and Lessons Learned" (100B+ webhooks processed)
2. **Svix** — Open-source webhook server (MIT), production reference
3. **Hook0** — Open-source webhook platform (Rust, MIT)
4. **Prismatic** — "A Software Architect's View of Webhooks"
5. **Educative.io** — "Webhook System Design"
6. **System Design Handbook** — "Design a Webhook System"
7. **Didit.me** — "Webhook Reliability: Retry and Dead Letter Queue Strategies"
8. **Beeceptor** — "Webhook Architecture - Design Pattern"

### 2.2 Core Principles

**1. Queue-First Architecture**
- Never send webhooks synchronously from the main request path
- Publish event to queue → return response to user → worker delivers async
- Decouples event production from delivery

**2. Idempotency**
- Every webhook event must have a unique ID
- Receivers can deduplicate by `X-Webhook-Id` header
- Retries don't cause duplicate processing

**3. At-Least-Once Delivery**
- Webhooks are inherently at-least-once
- Consumer must handle duplicates via idempotency key
- Exactly-once is theoretically impossible in distributed systems

**4. Exponential Backoff with Jitter**
```
delay = min(base × 2^attempt + random(0, jitter), maxDelay)
```
- Prevents retry storms
- Spreads load across time

**5. Dead Letter Queue (DLQ)**
- After N failed attempts → move to DLQ
- Events in DLQ are NOT lost — can be replayed manually or automatically
- Monitor DLQ depth for alerts

**6. HMAC Signature**
- Sign payload with HMAC-SHA256 using per-endpoint secret
- Header: `X-Webhook-Signature: sha256=<hex>`
- Header: `X-Webhook-Id: <uuid>`
- Header: `X-Webhook-Timestamp: <unix_ts>`
- Receivers verify signature to confirm authenticity

**7. Tenant Isolation**
- One slow/failing endpoint should not block others
- Per-endpoint queues or per-endpoint rate limiters
- Circuit breaker pattern: after N consecutive failures, deactivate endpoint

**8. Rate Limiting**
- Per-endpoint: max N webhooks per minute
- Per-user: max N webhooks per minute total
- If exceeded: skip events or queue for later delivery

**9. Monitoring & Observability**
- Metrics: delivery count, success rate, latency, queue depth, DLQ depth
- Alerts on DLQ > 0, success rate < threshold
- OpenTelemetry tracing for end-to-end debugging

**10. Event Versioning**
- Schema changes over time
- Use versioned event types: `pool.created.v1`, `pool.created.v2`
- Old subscriptions continue to work

### 2.3 Retry Strategy (Industry Standard)

| Attempt | Delay (base=1s) | With Jitter (±25%) |
|---|---|---|
| 1 | 1s | 0.75s - 1.25s |
| 2 | 2s | 1.5s - 2.5s |
| 3 | 4s | 3s - 5s |
| 4 | 8s | 6s - 10s |
| 5 | 16s | 12s - 20s |
| 6 | 32s | 24s - 40s |
| 7 | 64s | 48s - 80s |
| 8 | 128s | 96s - 160s |
| 9+ | DLQ | — |

**When to NOT retry:**
- 4xx errors (Bad Request, Not Found, Gone) — client's fault, immediate DLQ
- 5xx errors — retry
- Timeout / connection refused — retry
- DNS resolution failure — retry

### 2.4 Database Schema (Industry Standard)

**webhook_endpoints:**
```ts
{
  _id: ObjectId,
  userId: string,
  wallet: string,
  url: string,                    // destination URL
  secret: string,                 // HMAC secret (ENCRYPTED at rest)
  events: string[],               // ["pool.created", "pool.staked", ...]
  description?: string,
  active: boolean,                // false = circuit breaker deactivated
  rateLimitPerMinute: number,     // max webhooks/min for this endpoint
  createdAt: Date,
  updatedAt: Date
}
```

**webhook_delivery_logs:**
```ts
{
  _id: ObjectId,
  endpointId: ObjectId,
  eventType: string,
  eventId: string,                // idempotency key
  payload: object,
  status: 'pending' | 'delivered' | 'failed' | 'dead_letter',
  attempts: [{
    timestamp: Date,
    statusCode: number,
    responseBody: string,
    error?: string
  }],
  nextRetryAt?: Date,
  createdAt: Date
}
```

---

## 3. Proposed Architecture

### 3.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RabbitMQ                                     │
│  Exchange "webhooks.events" (direct, durable)                       │
│  routing keys: pool.created, pool.staked, document.verified, ...   │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       │  published by any service (rwa, portfolio, loyalty, ...)
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  webhooks service                                                    │
│                                                                      │
│  ┌──────────────────────────────┐                                   │
│  │ WebhookEventsDaemon           │                                   │
│  │  └─ consume("webhooks.events")│                                   │
│  │  └─ lookup subscriptions      │                                   │
│  │  └─ for each match →          │                                   │
│  │     sendToQueue("webhook.delivery")                                │
│  └──────────┬───────────────────┘                                   │
│             │                                                       │
│             ▼                                                       │
│  ┌──────────────────────────────┐                                   │
│  │ DeliveryDaemon                │                                   │
│  │  └─ consume("webhook.delivery")                                   │
│  │  └─ HTTP POST to endpoint URL │                                   │
│  │  └─ success → ack            │                                   │
│  │  └─ fail → retry/DLQ        │                                   │
│  └──────────────────────────────┘                                   │
│                                                                      │
│  MongoDB: webhooks DB                                                │
│  ├─ webhook_endpoints                                                │
│  └─ webhook_delivery_logs                                           │
│                                                                      │
│  Redis: subscription cache                                           │
│  └─ "webhook:events:{type}" → Set[endpointId, ...]                  │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Service Structure

```
services/webhooks/src/
├── index.ts                          — createApp(port, mongoUri, rabbitMqUri, redisUrl)
├── app.ts                            — Elysia setup
├── plugins/
│   ├── repositories.plugin.ts        — MongoDB: EndpointRepository, DeliveryLogRepository
│   ├── clients.plugin.ts             — RabbitMQClient + Redis
│   ├── services.plugin.ts            — WebhookService, DeliveryService
│   ├── daemons.plugin.ts             — WebhookEventsDaemon + DeliveryDaemon
│   └── controllers.plugin.ts         — REST API for CRUD subscriptions
├── daemons/
│   ├── webhookEvents.daemon.ts       — Consumer of "webhooks.events" exchange
│   └── delivery.daemon.ts            — Consumer of "webhook.delivery" queue + HTTP POST
├── services/
│   ├── webhook.service.ts            — Subscription management + cache
│   └── delivery.service.ts           — HTTP delivery + retry + DLQ + circuit breaker
├── repositories/
│   ├── endpoint.repository.ts
│   └── deliveryLog.repository.ts
└── controllers/
    ├── createEndpoint.controller.ts
    ├── getEndpoints.controller.ts
    ├── getEndpoint.controller.ts
    ├── updateEndpoint.controller.ts
    └── deleteEndpoint.controller.ts
```

### 3.3 RabbitMQ Topology

```
Exchange: "webhooks.events" (direct, durable)
  │
  ├─ Queue: "webhooks.events.webhooks" (durable)
  │    └─ bound to all event types: pool.created, pool.staked, ...
  │    └─ consumed by WebhookEventsDaemon
  │
  └─ (services publish here, no other consumers)

Queue: "webhook.delivery" (durable)
  └─ consumed by DeliveryDaemon workers
  └─ dead letter exchange → "webhooks.dlq"
  └─ dead letter routing key → "webhook.delivery.dlq"

Queue: "webhook.delivery.dlq" (durable)
  └─ for manual inspection and replay
```

### 3.4 Delivery Flow (Detailed)

```
1. Event published to "webhooks.events" exchange
   ↓
2. WebhookEventsDaemon receives event
   ↓
3. Redis lookup: "webhook:events:{eventType}" → Set[endpointId1, endpointId2, ...]
   ↓
4. For each endpointId:
   a. Check if endpoint is active (circuit breaker)
   b. Check rate limit (Redis counter)
   c. Create delivery log entry (MongoDB)
   d. sendToQueue("webhook.delivery", { endpointId, eventId, payload, ... })
   ↓
5. DeliveryDaemon receives from "webhook.delivery"
   ↓
6. HTTP POST to endpoint URL with:
   - Body: JSON payload
   - Headers: X-Webhook-Signature, X-Webhook-Id, X-Webhook-Timestamp
   - Timeout: 10 seconds
   ↓
7. On 2xx:
   - ack message
   - Update delivery log: status = 'delivered'
   ↓
8. On 5xx / timeout / connection error:
   - nack message (requeue=false → goes to DLQ after retries)
   - Update delivery log: increment attempt count
   - If max attempts reached → status = 'dead_letter'
   - If consecutive failures > threshold → deactivate endpoint (circuit breaker)
   ↓
9. On 4xx (Bad Request, Not Found):
   - nack message (requeue=false → immediate DLQ)
   - Deactivate endpoint (client's endpoint is broken)
```

---

## 4. Integration Points

### 4.1 Integration with Gateway (GraphQL)

**Step 1:** `services/gateway/src/config/index.ts`
```ts
WEBHOOKS: {
  URL: String(process.env.WEBHOOKS_SERVICE_URL),
}
```

**Step 2:** `services/gateway/src/clients/eden.clients.ts`
```ts
import type { App as WebhooksApp } from '@services/webhooks/src';
export const webhooksClient = createEdenTreatyClient<WebhooksApp>(CONFIG.SERVICES.WEBHOOKS.URL);
```

**Step 3:** `services/gateway/src/graphql/context/types.ts`
```ts
import type { WebhooksClient } from '../../clients/eden.clients';
// Add to ServiceClients interface
webhooksClient: WebhooksClient;
```

**Step 4:** `services/gateway/src/graphql/server/index.ts`
```ts
// Add to context return
webhooksClient,
```

**Step 5:** New GraphQL module:
```
services/gateway/src/graphql/modules/webhooks/
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

**Step 6:** `services/gateway/src/graphql/modules/index.ts`
```ts
import { webhooksResolvers } from './webhooks/resolvers';
export const resolvers = mergeResolvers([..., webhooksResolvers]);
```

### 4.2 Integration with Service Emitters

**Services that SHOULD emit events** (produce business events):
- `rwa` — pool.created, pool.staked, pool.burned, business.created, business.verified
- `portfolio` — portfolio.created, portfolio.updated
- `loyalty` — loyalty.reward, loyalty.referral
- `dao` — proposal.created, proposal.executed, vote.cast
- `documents` — document.uploaded, document.verified
- `auth` — user.registered, user.verified

**What each emitter service needs to do:**

```ts
// In the service's clients.plugin.ts — add RabbitMQClient (if not already present)
const rabbitMQClient = new RabbitMQClient({ uri, reconnectAttempts, reconnectInterval });
await rabbitMQClient.connect();
// Ensure exchange exists
await rabbitMQClient.setupExchange('webhooks.events', 'direct', { durable: true });

// In the service's services.plugin.ts — pass rabbitMQClient to service
// In the service's business logic — publish event:
await this.rabbitMQClient.publish('webhooks.events', 'pool.created', {
  id: crypto.randomUUID(),
  type: 'pool.created',
  timestamp: Date.now(),
  payload: { poolId, ownerId, name, ... }
});
```

**IMPORTANT:** Services publish events **fire-and-forget**. They don't wait for delivery. The webhooks service handles all delivery logic.

### 4.3 Integration with Docker Compose

```yaml
# infrastructure/docker/docker-compose.yml
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
    OTEL_RESOURCE_ATTRIBUTES: service.name=${WEBHOOKS_SERVICE_NAME},...
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

### 4.4 Environment Variables

```bash
# .env.examples additions
WEBHOOKS_SERVICE_NAME=webhooks
WEBHOOKS_SERVICE_VERSION=1.0.0
WEBHOOKS_PORT=3000
WEBHOOKS_MONGODB_DBNAME=webhooks
WEBHOOKS_SERVICE_URL=http://webhooks:3000
```

### 4.5 Shared Module

```ts
// shared/webhooks/src/index.ts
export enum WebhookEventType {
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

export interface WebhookEvent<T = unknown> {
  id: string;           // UUID — idempotency key
  type: WebhookEventType;
  timestamp: number;
  payload: T;
}

export function signWebhookPayload(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}
```

**Note:** Service emitters do NOT need to import `@shared/webhooks`. They can use `rabbitMQClient.publish()` directly with plain objects. The shared module is only for the webhooks service itself and for type safety in the gateway.

---

## 5. Performance Considerations

### 5.1 Throughput Estimates

| Component | Capacity | Bottleneck |
|---|---|---|
| RabbitMQ exchange | 50K+ msg/sec | Disk I/O (persistent messages) |
| MongoDB lookup (no cache) | ~1K lookups/sec | Index + disk |
| Redis lookup (cached) | 100K+ lookups/sec | Network |
| HTTP delivery (fast endpoint) | ~100 req/sec per worker | Network + remote server |
| HTTP delivery (slow endpoint, 5s) | ~12 req/sec per worker | Remote server latency |

### 5.2 Scaling Strategy

- **WebhookEventsDaemon:** Single consumer (sequential processing). If throughput > 5K events/sec, add partitions or multiple queues
- **DeliveryDaemon:** Multiple workers (configurable pool). Each worker pulls from `webhook.delivery` queue
- **Redis cache:** Sub-second lookups. Cache updated on subscription CRUD
- **MongoDB:** Index on `endpointId` + `eventId` for delivery logs

### 5.3 Memory & Connections

- Each RabbitMQ consumer = 1 TCP connection
- Each HTTP delivery worker = 1 TCP connection to remote
- For 10K endpoints: 10K concurrent HTTP connections possible
- Solution: connection pooling + worker pool with max concurrency

---

## 6. Failure Modes & Reliability

### 6.1 What Happens When...

| Scenario | Behavior |
|---|---|
| **User's server is temporarily down** | Exponential backoff retries (up to ~4 min), then DLQ |
| **User's server is permanently dead** | Circuit breaker → deactivate subscription after N failures |
| **User changes endpoint URL** | They update subscription → we replay from DLQ |
| **RabbitMQ crashes** | Messages are persistent (disk). On restart, consumers reconnect and continue |
| **Webhooks service crashes** | RabbitMQ holds messages. On restart, consumers resume from last ack |
| **MongoDB is down** | WebhookEventsDaemon can't log delivery. Events stay in queue until MongoDB recovers |
| **Redis is down** | Cache miss → fallback to MongoDB lookup (slower but works) |
| **Network partition** | HTTP delivery fails → retry. No data loss |
| **10K events/sec spike** | Queue buffers. Workers process at their pace. No data loss |

### 6.2 Data Safety Guarantees

- **No event is ever lost** — RabbitMQ persistent messages survive crashes
- **At-least-once delivery** — retries guarantee delivery, duplicates possible
- **DLQ as safety net** — events that can't be delivered are preserved for manual replay
- **Delivery logs** — full audit trail of every attempt

---

## 7. Podvodnye Kamni (Подводные камни) — Critical Findings

### 🚩 7.1 NO SERVICE CURRENTLY PUBLISHES BUSINESS EVENTS

This is the **single most important finding**. Currently:
- `blockchain-scanner` publishes blockchain events to `blockchain.events` exchange
- `rwa` publishes evaluation requests to `evaluation.requests` queue
- `ai-evaluator` publishes evaluation results to `evaluation.results` queue

**No service publishes business events** (pool.created, document.verified, etc.). This means:
- Every service that wants webhooks must add `RabbitMQClient` (if not already present)
- Every service must add publish calls after business logic operations
- Services without RabbitMQ (`blog`, `faq`, `company`, `questions`, `reactions`, `files`, `documents`, `gallery`, `portfolio`, `auth`, `api-keys`, `testnet-faucet`, `signers-manager`) need a new `clients.plugin.ts` with RabbitMQ

**Work estimate per emitter service:** ~50-100 lines of code (clients plugin + publish calls)

### 🚩 7.2 MONGODB LOOKUP ON EVERY EVENT WILL NOT SCALE

Naive approach: "Daemon receives event → query MongoDB for matching subscriptions"
- At 10K events/sec, MongoDB will become the bottleneck
- Each query needs to scan `webhook_endpoints` collection for matching event types

**Solution: Redis cache layer**
```ts
// On subscription CRUD:
await redis.sadd(`webhook:events:${eventType}`, endpointId);

// On event received:
const endpointIds = await redis.smembers(`webhook:events:${eventType}`);
// ~1ms vs 10-50ms for MongoDB
```

### 🚩 7.3 QUEUE PER ENDPOINT vs SINGLE QUEUE

**Option A: Queue per endpoint** (my initial proposal)
- Pro: True tenant isolation — one slow endpoint doesn't block others
- Con: 10K endpoints = 10K queues. Management nightmare. Slow restart.
- Con: RabbitMQ has limits on concurrent consumers

**Option B: Single queue + rate limiter** (recommended)
- Pro: Simple management, fast restart
- Pro: Easy to scale workers
- Con: One slow endpoint can block the queue
- **Mitigation:** Per-endpoint rate limiter + circuit breaker + per-endpoint prefetch

**Recommendation:** Single `webhook.delivery` queue with:
- Per-endpoint rate limiting (Redis counter)
- Per-endpoint circuit breaker (consecutive failures → deactivate)
- Configurable worker pool size
- Per-endpoint timeout (10s max)

### 🚩 7.4 HMAC SECRET STORAGE

`webhook_endpoints.secret` is sensitive data. In MongoDB it's stored in plaintext.
- **Solution:** Encrypt at application level before storing
- **Alternative:** Use a KMS/Vault
- **Minimum:** At least encrypt the secret field with a service-level encryption key

### 🚩 7.5 RATE LIMITING — ONE USER CAN FLOOD THE SYSTEM

A malicious or buggy user could:
- Create 1000 endpoints pointing to the same URL
- Subscribe to all event types
- Generate 10K webhooks/sec to their server

**Mitigations:**
- Per-endpoint rate limit (e.g., 100 webhooks/min)
- Per-user rate limit (e.g., 1000 webhooks/min total)
- If exceeded: skip events or queue for later delivery
- Monitor and alert on rate limit violations

### 🚩 7.6 EXCHANGE MUST EXIST BEFORE PUBLISH

If `webhooks` service hasn't started yet, and `rwa` tries to publish to `webhooks.events` exchange — RabbitMQ will silently drop the message (if exchange doesn't exist) or auto-create it (if publisher confirms are off).

**Solution:** Each emitter service must call `setupExchange('webhooks.events', 'direct', { durable: true })` before first publish. This is idempotent — safe to call multiple times.

### 🚩 7.7 EVENT VERSIONING

When the schema of `pool.created` payload changes, old subscriptions break.
- **Solution:** Version event types: `pool.created.v1`, `pool.created.v2`
- Webhooks service can support multiple versions
- Users subscribe to specific versions

### 🚩 7.8 IDEMPOTENCY — DUPLICATE DELIVERY

RabbitMQ at-least-once delivery + retries = duplicate webhooks possible.
- **Solution:** Every event has a unique `eventId` (UUID)
- Header `X-Webhook-Id` allows receivers to deduplicate
- Webhooks service should also deduplicate: if same `eventId` already delivered to same endpoint, skip

### 🚩 7.9 GRACEFUL SHUTDOWN

When webhooks service stops:
- Need to stop consuming new messages
- Wait for in-flight deliveries to complete
- Then close RabbitMQ connection
- Otherwise messages get requeued and redelivered

**Solution:** Follow the pattern from existing services:
```ts
process.on('SIGTERM', async () => {
  await app.stop();
  process.exit(0);
});
```

### 🚩 7.10 MONITORING BLIND SPOT

Without proper monitoring, you won't know about delivery failures until users complain.
- **Required metrics:**
  - `webhook_delivery_total{status="success|failed|dead_letter"}`
  - `webhook_delivery_latency_seconds`
  - `webhook_queue_depth`
  - `webhook_dlq_depth` — alert if > 0
  - `webhook_active_endpoints`
- **Use existing OpenTelemetry infrastructure** (Prometheus + Grafana)

---

## 8. Open-Source Alternatives

| Product | License | Self-host | Description |
|---|---|---|---|
| **Svix** | MIT | ✅ | Most mature. Full platform: subscriptions, delivery, retries, DLQ, HMAC, user portal. REST API. |
| **Hook0** | MIT | ✅ | Lightweight, Rust-based. Simpler than Svix. On-premise deployment. |
| **Hookdeck Outpost** | Apache 2.0 | ✅ | Focus on delivery, not subscription management. Multi-destination. |
| **Convoy** | Elastic License v2.0 | ✅ | Source-available (not true OSS). Company no longer active. |

**Recommendation:** If you want to **not build from scratch** — use **Svix** (self-hosted, MIT). It gives you:
- Subscription management API
- Reliable delivery with retries
- DLQ
- HMAC signatures
- User-facing webhook portal
- OpenTelemetry support

If you want **full control** — build your own as described in this document. Your infrastructure (RabbitMQ, MongoDB, Redis, Bun/Elysia) is already in place.

---

## 9. Implementation Plan

### Phase 1: Foundation (1-2 days)
1. Create `services/webhooks/` skeleton (same pattern as `api-keys`)
2. Create `shared/webhooks/` with types and HMAC helper
3. Add to docker-compose.yml
4. Add to .env.examples
5. Implement `repositories.plugin.ts` (MongoDB)
6. Implement `clients.plugin.ts` (RabbitMQ + Redis)

### Phase 2: Core Logic (2-3 days)
1. Implement `WebhookService` (subscription CRUD + cache management)
2. Implement `DeliveryService` (HTTP delivery + retry + DLQ + circuit breaker)
3. Implement `WebhookEventsDaemon` (exchange consumer + subscription matcher)
4. Implement `DeliveryDaemon` (queue consumer + HTTP worker pool)
5. Implement REST controllers for subscription management

### Phase 3: Gateway Integration (1 day)
1. Add `WEBHOOKS_SERVICE_URL` to gateway config
2. Add Eden Treaty client
3. Add GraphQL module (schema + resolvers)
4. Register in context and module index

### Phase 4: Emitter Integration (2-3 days per service)
1. Add `RabbitMQClient` to each emitter service's `clients.plugin.ts`
2. Add `setupExchange('webhooks.events')` call
3. Add publish calls after business logic operations
4. **Priority order:** rwa → portfolio → loyalty → dao → documents → auth

### Phase 5: Testing & Monitoring (1-2 days)
1. Integration tests with local RabbitMQ
2. Grafana dashboard for webhook metrics
3. Alert rules for DLQ depth
4. Load testing

---

## 10. Questions & Answers from Discussion

### Q: Who "calls" the webhooks service? Do services call it directly or through RabbitMQ?

**A:** **Nobody calls webhooks service directly.** Services publish events to RabbitMQ exchange `webhooks.events` (fire-and-forget). Webhooks service consumes from that exchange asynchronously. This is the same pattern as `blockchain-scanner` → `charts`/`dao`/`loyalty`/`rwa`.

Services don't even know webhooks service exists. They just publish events. Webhooks service is just another RabbitMQ consumer.

### Q: What if we can't deliver to the user (their server is down, errors, etc.)?

**A:** The webhooks service handles this entirely on its own:

1. **First attempt:** HTTP POST to user's URL
2. **On failure:** Exponential backoff retry (1s → 2s → 4s → 8s → 16s → 32s → 64s → 128s)
3. **After N attempts:** Move to Dead Letter Queue (DLQ) — event is NOT lost
4. **Circuit breaker:** After consecutive failures → deactivate subscription automatically
5. **User notification:** Send email/telegram that their webhook endpoint is broken
6. **Manual replay:** Admin can replay from DLQ after user fixes their endpoint

### Q: How is this integrated into GraphQL?

**A:** Same pattern as `api-keys` module:
1. Gateway gets `WEBHOOKS_SERVICE_URL` in config
2. Gateway creates Eden Treaty client for type-safe HTTP calls
3. New GraphQL module `webhooks/` with queries (getEndpoints) and mutations (create/update/delete)
4. Resolvers proxy to webhooks service REST API
5. User manages subscriptions through GraphQL (same as they manage API keys)

### Q: How is this integrated into other services?

**A:** Each service that wants to emit events needs:
1. `RabbitMQClient` in its `clients.plugin.ts` (if not already present)
2. `setupExchange('webhooks.events')` call during initialization
3. `rabbitMQClient.publish('webhooks.events', 'event.type', payload)` after business logic

Services that already have RabbitMQ (`rwa`, `charts`, `dao`, `loyalty`, `ai-evaluator`) just need step 2-3. Services without RabbitMQ need all three steps.

### Q: Will there be a shared client?

**A:** Minimal shared module `@shared/webhooks` with:
- `WebhookEventType` enum
- `WebhookEvent` interface
- `signWebhookPayload()` helper

Service emitters do NOT need to import this. They use `rabbitMQClient.publish()` directly with plain objects. The shared module is for the webhooks service itself and gateway type safety.

### Q: What about performance? Can this kill our architecture?

**A:** No, if done correctly:
- Event publishing is fire-and-forget (sub-millisecond, non-blocking)
- Delivery is async (queue-based, doesn't affect API response times)
- RabbitMQ buffers spikes
- Redis cache prevents MongoDB overload
- Circuit breaker prevents cascading failures
- Worker pool scales independently

**The real risk is NOT the webhooks service itself, but the changes needed in emitter services.** Adding RabbitMQ and publish calls to 10+ services is the biggest engineering effort.

### Q: What's the biggest mistake we could make?

**A:** The top 3:
1. **Synchronous delivery** — blocking the API response waiting for webhook delivery
2. **No tenant isolation** — one bad endpoint blocks all deliveries
3. **No monitoring** — discovering delivery failures from user complaints

---

## Appendix A: Existing Service Patterns (Reference)

### api-keys (simplest service, no RabbitMQ)
```
index.ts → app.ts
  ├─ repositories.plugin.ts (MongoDB)
  ├─ services.plugin.ts
  └─ controllers.plugin.ts (REST)
```

### blockchain-scanner (producer, has daemon)
```
index.ts → app.ts
  ├─ repositories.plugin.ts (MongoDB)
  ├─ clients.plugin.ts (RabbitMQClient)
  ├─ services.plugin.ts (BlockchainScannerService — publishes to exchange)
  ├─ daemons.plugin.ts (BlockchainScannerDaemon — scans blockchain)
  └─ controllers.plugin.ts (REST)
```

### charts (consumer, has daemon)
```
index.ts → app.ts
  ├─ repositories.plugin.ts (MongoDB)
  ├─ clients.plugin.ts (RabbitMQClient + RedisEventsClient)
  ├─ services.plugin.ts
  ├─ daemons.plugin.ts (BlockchainEventsDaemon extends BaseBlockchainDaemon)
  └─ controllers.plugin.ts (REST)
```

### ai-evaluator (consumer + producer, has daemon)
```
index.ts → app.ts
  ├─ repositories.plugin.ts (MongoDB)
  ├─ clients.plugin.ts (RabbitMQClient + Eden clients + EvaluationRequestsClient + EvaluationResultsClient)
  ├─ services.plugin.ts
  ├─ daemons.plugin.ts (EvaluationRequestsDaemon — consumes queue)
  └─ controllers.plugin.ts (REST)
```

## Appendix B: Key Files Referenced

| File | Purpose |
|---|---|
| `shared/rabbitmq/src/rabbitmq.client.ts` | RabbitMQ client wrapper |
| `shared/blockchain-daemon/src/baseBlockchain.daemon.ts` | Abstract consumer daemon |
| `shared/monitoring/src/eden.ts` | Eden Treaty client factory |
| `services/blockchain-scanner/src/services/blockchainScanner.service.ts` | Producer example (publish to exchange) |
| `services/charts/src/daemons/blockchainEvents.daemon.ts` | Consumer example (extends BaseBlockchainDaemon) |
| `services/ai-evaluator/src/daemons/evaluationRequests.daemon.ts` | Consumer example (direct queue) |
| `services/ai-evaluator/src/clients/evaluationRequests.client.ts` | Queue client wrapper example |
| `services/rwa/src/clients/evaluationRequests.client.ts` | Producer client example (sendToQueue) |
| `services/gateway/src/config/index.ts` | Gateway config (add WEBHOOKS_URL) |
| `services/gateway/src/clients/eden.clients.ts` | Gateway clients (add webhooksClient) |
| `services/gateway/src/graphql/modules/api-keys/` | Reference GraphQL module |
| `infrastructure/docker/docker-compose.yml` | Docker Compose (add webhooks service) |
| `infrastructure/docker/.env.examples` | Environment variables (add webhooks vars) |
