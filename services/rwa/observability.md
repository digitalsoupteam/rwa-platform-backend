# RWA Service — Observability Reference

Ядро домена платформы. Управляет сущностями **Business** (юр. лица,
которые токенизируются) и **Pool** (DeFi-пулы ликвидности под эти
бизнесы). Использует MongoDB, OpenRouter (для AI-генерации
параметров/risk score), RabbitMQ (потребление блокчейн-событий),
Redis (публикация доменных событий о deployed-пуле), Eden Treaty
HTTP-клиент к `signers-manager` (запрос подписей на деплой).

Самый «толстый» сервис в монорепо: 2 репозитория, 3 сервиса
(BusinessService / PoolService / TokenService), 17 контроллеров,
1 daemon (BlockchainEventsDaemon), 5 shared-клиентов.

`SERVICE_NAME=rwa` (из env). Все метрики префиксируются этим именем.

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Старт сервиса. Каждый span — синхронный (`withTraceSync`) или
асинхронный (`withTraceAsync`). Слева → справа порядок создания.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `rwa.init.main` | `index.ts:4` | ~всё время старта | всё ниже | Корневой span всего запуска. Оборачивает `createApp`. |
| `rwa.init.repositories_plugin` | `app.ts:25` | ~MongoDB connect | `repositories.business`, `repositories.pool`, `repositories_plugin.mongoose`, `repositories.plugin` | Плагин репозиториев — MongoDB + инстансы |
| `rwa.init.repositories.business` | `repositories.plugin.ts:9` | <1ms | — | `new BusinessRepository()` |
| `rwa.init.repositories.pool` | `repositories.plugin.ts:14` | <1ms | — | `new PoolRepository()` |
| `rwa.init.repositories_plugin.mongoose` | `repositories.plugin.ts:19` | ~2-5s (сеть) | — | `mongoose.connect()`. Самый долгий span старта. |
| `rwa.init.repositories.plugin` | `repositories.plugin.ts:31` | <1ms | — | Сборка Elysia-плагина: `.decorate()` + `.onStop()` |
| `rwa.init.clients_plugin` | `app.ts:30` | ~rabbit connect | `clients.signers_manager`, `clients.redis_events`, `clients.pool_events`, `clients.openrouter`, `clients.rabbitmq`, `clients.rabbitmq_connect`, `clients.plugin` | Плагин клиентов — 5 shared-клиентов |
| `rwa.init.clients.signers_manager` | `clients.plugin.ts:20` | <1ms | — | `createSignersManagerClient(url)` (Eden Treaty HTTP-клиент) |
| `rwa.init.clients.redis_events` | `clients.plugin.ts:25` | <1ms | — | `new RedisEventsClient(redisUrl, serviceName)` |
| `rwa.init.clients.pool_events` | `clients.plugin.ts:30` | <1ms | — | `new PoolEventsClient(redisEventsClient)` |
| `rwa.init.clients.openrouter` | `clients.plugin.ts:35` | <1ms | — | `new OpenRouterClient(apiKey, baseUrl)` (AI-клиент) |
| `rwa.init.clients.rabbitmq` | `clients.plugin.ts:40` | <1ms | — | `new RabbitMQClient({...})` |
| `rwa.init.clients.rabbitmq_connect` | `clients.plugin.ts:49` | ~1-3s | — | `rabbitMQClient.connect()` — устанавливает AMQP-соединение |
| `rwa.init.clients.plugin` | `clients.plugin.ts:58` | <1ms | — | Сборка Elysia-плагина клиентов: 5 `.decorate()` + `.onStop()` |
| `rwa.init.services_plugin` | `app.ts:44` | <1ms | `services.business`, `services.pool`, `services.token`, `services.plugin` | Плагин сервисов |
| `rwa.init.services.business` | `services.plugin.ts:14` | <1ms | — | `new BusinessService(...)` — DI всех зависимостей |
| `rwa.init.services.pool` | `services.plugin.ts:24` | <1ms | — | `new PoolService(...)` |
| `rwa.init.services.token` | `services.plugin.ts:35` | <1ms | — | `new TokenService(...)` |
| `rwa.init.services.plugin` | `services.plugin.ts:43` | <1ms | — | Сборка Elysia-плагина: 3 `.decorate()` |
| `rwa.init.controllers_plugin` | `app.ts:49` | <1ms | 17 `controllers.*` + `controllers.plugin` | Плагин контроллеров — 17 роутов |
| `rwa.init.controllers.create_business` | `controllers.plugin.ts:25` | <1ms | — | `createBusinessController(...)` |
| `rwa.init.controllers.edit_business` | `controllers.plugin.ts:30` | <1ms | — | `editBusinessController(...)` |
| `rwa.init.controllers.update_business_risk_score` | `controllers.plugin.ts:35` | <1ms | — | `updateBusinessRiskScoreController(...)` |
| `rwa.init.controllers.request_business_approval_signatures` | `controllers.plugin.ts:40` | <1ms | — | `requestBusinessApprovalSignaturesController(...)` |
| `rwa.init.controllers.reject_business_approval_signatures` | `controllers.plugin.ts:45` | <1ms | — | `rejectBusinessApprovalSignaturesController(...)` |
| `rwa.init.controllers.get_business` | `controllers.plugin.ts:50` | <1ms | — | `getBusinessController(...)` |
| `rwa.init.controllers.get_businesses` | `controllers.plugin.ts:55` | <1ms | — | `getBusinessesController(...)` |
| `rwa.init.controllers.create_business_with_ai` | `controllers.plugin.ts:60` | <1ms | — | `createBusinessWithAIController(...)` |
| `rwa.init.controllers.create_pool` | `controllers.plugin.ts:65` | <1ms | — | `createPoolController(...)` |
| `rwa.init.controllers.edit_pool` | `controllers.plugin.ts:70` | <1ms | — | `editPoolController(...)` |
| `rwa.init.controllers.update_pool_risk_score` | `controllers.plugin.ts:75` | <1ms | — | `updatePoolRiskScoreController(...)` |
| `rwa.init.controllers.request_pool_approval_signatures` | `controllers.plugin.ts:80` | <1ms | — | `requestPoolApprovalSignaturesController(...)` |
| `rwa.init.controllers.reject_pool_approval_signatures` | `controllers.plugin.ts:85` | <1ms | — | `rejectPoolApprovalSignaturesController(...)` |
| `rwa.init.controllers.get_pool` | `controllers.plugin.ts:90` | <1ms | — | `getPoolController(...)` |
| `rwa.init.controllers.get_pools` | `controllers.plugin.ts:95` | <1ms | — | `getPoolsController(...)` |
| `rwa.init.controllers.create_pool_with_ai` | `controllers.plugin.ts:100` | <1ms | — | `createPoolWithAIController(...)` |
| `rwa.init.controllers.get_token_metadata` | `controllers.plugin.ts:105` | <1ms | — | `getTokenMetadataController(...)` |
| `rwa.init.controllers.plugin` | `controllers.plugin.ts:110` | <1ms | — | Сборка Elysia-плагина: 17 `.use()` (роуты) |
| `rwa.init.daemons_plugin` | `app.ts:54` | ~rabbit subscribe | `daemons.blockchain_events`, `daemons.initialize`, `daemons.plugin` | Плагин daemon-ов — запуск BlockchainEventsDaemon |
| `rwa.init.daemons.blockchain_events` | `daemons.plugin.ts:12` | <1ms | — | `new BlockchainEventsDaemon(rabbit, businessService, poolService)` |
| `rwa.init.daemons.initialize` | `daemons.plugin.ts:21` | ~1-3s | — | `daemon.initialize()` + `daemon.start()` — `consume()` на AMQP-очереди |
| `rwa.init.daemons.plugin` | `daemons.plugin.ts:31` | <1ms | — | Сборка Elysia-плагина: `.decorate()` + `.onStop()` |
| `rwa.init.elysia` | `app.ts:59` | ~до `.listen()` callback | — | `new Elysia().use(...).listen()`. Ждёт listen callback. |

**Как читать в Tempo:** Ищи `rwa.init.main`. Если он успешен
(Status=OK), сервис поднят. Самый длинный дочерний span =
`repositories_plugin.mongoose` — если он >5s, проблемы с MongoDB.
Второй по длительности — `clients.rabbitmq_connect` (если >3s — RabbitMQ
не отвечает) и `daemons.initialize` (если >3s — не подключились к AMQP).

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Дочерние | Зачем |
|-----------|---------------|-------|----------|-------|
| `rwa.stop.repositories_plugin` | `repositories.plugin.ts:37` | `.onStop()` | — | `mongoose.disconnect()`. Закрытие соединения с БД. |
| `rwa.stop.clients` | `clients.plugin.ts:67` | `.onStop()` | — | `rabbitMQClient.disconnect()` + `redisEventsClient.close()` |
| `rwa.stop.daemons` | `daemons.plugin.ts:38` | `.onStop()` | — | `daemon.stop()` — отписка от AMQP, остановка consume-цикла |

**Как читать:** Если shutdown-спаны отсутствуют — сервис упал (`kill -9`)
или `.onStop()` не вызвался. В Tempo искать по `name=~"rwa.stop.*"`.

### 1.3. Runtime — бизнес-методы

Создаются через `@TraceDecorator()`. Имя спана =
`<snake_class_name>.<snake_method_name>` (camelToSnakeCase).

**Важно:** в текущем коде **отсутствуют вызовы `setSpanAttributes()`**
на runtime-спанах. Это значит, что в Tempo бизнес-атрибуты
(`businessId`, `poolId`, `chainId`, `wallet` и т.д.) на спанах сервисов
**не выставляются** — поиск по этим полям в Tempo работать не будет.
Исключение — `withTraceAsync` с attributes-as-second-arg (init/shutdown
спаны), которые имеют атрибуты согласно своей семантике.

#### BusinessService (префикс `business_service`)

| Span name | HTTP endpoint | Запросы к БД/сети | Ошибки |
|-----------|---------------|-------------------|--------|
| `business_service.create_business_with_ai` | `POST /createBusinessWithAI` | `openRouterClient.chatCompletion` → `business_repository.create_business` | `NotAllowedError` (unsupported chain) |
| `business_service.create_business` | `POST /createBusiness` | `business_repository.create_business` | `NotAllowedError` (unsupported chain) |
| `business_service.edit_business` | `POST /editBusiness` | `business_repository.find_by_id`, `business_repository.update_business` | `NotAllowedError` (immutable field во время pending task) |
| `business_service.update_risk_score` | `POST /updateBusinessRiskScore` | `business_repository.find_by_id`, `openRouterClient.chatCompletion`, `business_repository.update_business` | `Error` (нет name/desc/tags, parse AI response) |
| `business_service.request_approval_signatures` | `POST /requestBusinessApprovalSignatures` | `business_repository.find_by_id`, `signersManagerClient.createSignatureTask.post(...)`, `business_repository.update_business` | `NotAllowedError` (уже есть task) |
| `business_service.reject_approval_signatures` | `POST /rejectBusinessApprovalSignatures` | `business_repository.find_by_id`, `business_repository.update_business` | `NotAllowedError` (уже deployed / нет task / до истечения 24h) |
| `business_service.sync_after_deployment` | (вызывается из daemon-а) | `business_repository.update_business` | — |
| `business_service.get_business` | `POST /getBusiness` | `business_repository.find_by_id` | `NotFoundError` |
| `business_service.get_businesses` | `POST /getBusinesses` | `business_repository.find_all` | — |

Private методы (`isChainIdSupported`, `generateMessageHash`,
`generateBusinessFields`, `mapBusiness`) — **не трейсятся** (нет
декораторов, так как это хелперы/мапперы).

#### PoolService (префикс `pool_service`)

| Span name | HTTP endpoint | Запросы к БД/сети | Ошибки |
|-----------|---------------|-------------------|--------|
| `pool_service.create_pool_with_ai` | `POST /createPoolWithAI` | `openRouterClient.chatCompletion` → `pool_repository.create_pool` | `NotAllowedError` (unsupported chain) |
| `pool_service.update_risk_score` | `POST /updatePoolRiskScore` | `pool_repository.find_by_id`, `openRouterClient.chatCompletion`, `pool_repository.update_pool` | `Error` (нет desc/tags, parse AI response) |
| `pool_service.request_approval_signatures` | `POST /requestPoolApprovalSignatures` | `pool_repository.find_by_id`, `signersManagerClient.createSignatureTask.post(...)`, `pool_repository.update_pool` | `NotAllowedError` (уже есть task); `Error` (validation: amounts/periods/fees > 0) |
| `pool_service.reject_approval_signatures` | `POST /rejectPoolApprovalSignatures` | `pool_repository.find_by_id`, `pool_repository.update_pool` | `NotAllowedError` (deployed / нет task / до expiration) |
| `pool_service.get_pool` | `POST /getPool` | `pool_repository.find_by_id` | `NotFoundError` |
| `pool_service.create_pool` | `POST /createPool` | `pool_repository.create_pool` | `NotAllowedError` (unsupported chain) |
| `pool_service.edit_pool` | `POST /editPool` | `pool_repository.find_by_id`, `pool_repository.update_pool` | `NotAllowedError` (immutable field во время pending task) |
| `pool_service.sync_pool_after_deployment` | (вызывается из daemon-а) | `pool_repository.find_by_id`, `pool_repository.update_pool`, `poolEventsClient.publishPoolDeployed` | `NotFoundError` |
| `pool_service.sync_pool_awaiting_bonus_amount` | (daemon) | `pool_repository.update_pool_by_address` | `NotFoundError` |
| `pool_service.sync_pool_awaiting_rwa_amount` | (daemon) | `pool_repository.update_pool_by_address` | `NotFoundError` |
| `pool_service.sync_pool_funds_fully_returned` | (daemon) | `pool_repository.update_pool_by_address` | `NotFoundError` |
| `pool_service.sync_pool_bonus_withdrawn` | (daemon) | `pool_repository.update_pool_by_address` | `NotFoundError` |
| `pool_service.sync_pool_incoming_return_summary` | (daemon) | `pool_repository.update_pool_by_address` | `NotFoundError` |
| `pool_service.sync_pool_incoming_tranche_update` | (daemon) | `pool_repository.find_by_address`, `pool_repository.update_pool_by_address` | `NotFoundError`, `Error` (invalid tranche index) |
| `pool_service.sync_pool_outgoing_claim_summary` | (daemon) | `pool_repository.update_pool_by_address` | `NotFoundError` |
| `pool_service.sync_pool_outgoing_tranche_claimed` | (daemon) | `pool_repository.find_by_address`, `pool_repository.update_pool_by_address` | `NotFoundError`, `Error` (invalid tranche index) |
| `pool_service.sync_pool_paused_state` | (daemon) | `pool_repository.update_pool_by_address` | `NotFoundError` |
| `pool_service.sync_pool_reserves` | (daemon) | `pool_repository.update_pool_by_address` | `NotFoundError` |
| `pool_service.sync_pool_target_reached` | (daemon) | `pool_repository.update_pool_by_address` | `NotFoundError` |
| `pool_service.get_pools` | `POST /getPools` | `pool_repository.find_all` | — |

Private методы (`isChainIdSupported`, `generatePoolFields`,
`generatePoolMessageHash`, `mapPool`) — **не трейсятся**.

#### TokenService (префикс `token_service`)

| Span name | HTTP endpoint | Запросы к БД | Ошибки |
|-----------|---------------|--------------|--------|
| `token_service.get_token_metadata` | `POST /getTokenMetadata` | `pool_repository.find_all` (filter by tokenId), `business_repository.find_by_id` | `NotFoundError` (pool not found / business not found) |

#### BusinessRepository (префикс `business_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `business_repository.create_business` | `business_service.create_business`, `business_service.create_business_with_ai` | `BusinessEntity.create(data)` | Insert |
| `business_repository.update_business` | `business_service.edit_business`, `business_service.update_risk_score`, `business_service.request_approval_signatures`, `business_service.reject_approval_signatures`, `business_service.sync_after_deployment` | `BusinessEntity.findByIdAndUpdate(id, data, {new: true}).lean()` | `NotFoundError` если не найден |
| `business_repository.find_by_id` | `business_service.get_business`, `business_service.edit_business`, `business_service.update_risk_score`, `business_service.request_approval_signatures`, `business_service.reject_approval_signatures` | `BusinessEntity.findById(id).lean()` | `NotFoundError` |
| `business_repository.find_all` | `business_service.get_businesses` | `BusinessEntity.find(filter).sort().skip().limit().lean()` | — |

#### PoolRepository (префикс `pool_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `pool_repository.create_pool` | `pool_service.create_pool`, `pool_service.create_pool_with_ai` | `PoolEntity.create(data)` | Insert |
| `pool_repository.update_pool` | `pool_service.edit_pool`, `pool_service.update_risk_score`, `pool_service.request_approval_signatures`, `pool_service.reject_approval_signatures`, `pool_service.sync_pool_after_deployment` | `PoolEntity.findByIdAndUpdate(id, data, {new: true}).lean()` | `NotFoundError` |
| `pool_repository.find_by_id` | `pool_service.get_pool`, `pool_service.edit_pool`, `pool_service.update_risk_score`, `pool_service.request_approval_signatures`, `pool_service.reject_approval_signatures`, `pool_service.sync_pool_after_deployment` | `PoolEntity.findById(id).lean()` | `NotFoundError` |
| `pool_repository.find_all` | `pool_service.get_pools`, `token_service.get_token_metadata` | `PoolEntity.find(filter).sort().skip().limit().lean()` | — |
| `pool_repository.update_pool_by_address` | `pool_service.sync_pool_*` (10 sync-методов) | `PoolEntity.findOneAndUpdate({poolAddress}, data, {new: true}).lean()` | `NotFoundError`. Ключ — адрес контракта, не _id. |
| `pool_repository.find_by_address` | `pool_service.sync_pool_incoming_tranche_update`, `pool_service.sync_pool_outgoing_tranche_claimed` | `PoolEntity.findOne({poolAddress}).lean()` | `NotFoundError` |

### 1.4. Daemon цикл — BlockchainEventsDaemon

`BlockchainEventsDaemon` наследует `BaseBlockchainDaemon`
(`@shared/blockchain-daemon`). Дочерние спаны consume-цикла
создаёт базовый класс — в `rwa`-сервисе переопределяется только
`getEventRouting()`. Трейсы отдельных consumed events создаёт
`BaseBlockchainDaemon.handleMessage` (см. скилл `rwa-observability` §4.2).

| Span name | Где создаётся | Когда | Дочерние | Зачем |
|-----------|---------------|-------|----------|-------|
| `blockchain_events_daemon.get_event_routing` | `daemons/blockchainEvents.daemon.ts:21` (через `@TraceDecorator`) | При первом consume | — | Маппинг `event name → handler`. Возвращает `EventRouting` для 12 событий (см. таблицу ниже). |

**Обрабатываемые события (12 типов):**

| Routing key | Service handler | Что делает |
|-------------|-----------------|------------|
| `RWA_Deployed` | `business_service.sync_after_deployment` | Проставляет `tokenAddress` + `ownerWallet` в Business |
| `Pool_Deployed` | `pool_service.sync_pool_after_deployment` | Полная инициализация Pool адресами контракта + публикация в Redis `pool:deployed` |
| `Pool_BonusWithdrawn` | `pool_service.sync_pool_bonus_withdrawn` | Обновляет `awaitingBonusAmount` + `rewardedRwaAmount` |
| `Pool_AwaitingRwaAmountUpdated` | `pool_service.sync_pool_awaiting_rwa_amount` | Обновляет `awaitingRwaAmount` |
| `Pool_FundsFullyReturned` | `pool_service.sync_pool_funds_fully_returned` | Ставит `isFullyReturned=true` + timestamp |
| `Pool_IncomingReturnSummary` | `pool_service.sync_pool_incoming_return_summary` | Обновляет `totalReturnedAmount`/`awaitingBonusAmount`/`lastCompletedIncomingTranche` |
| `Pool_IncomingTrancheUpdate` | `pool_service.sync_pool_incoming_tranche_update` | `incomingTranches[i].returnedAmount` |
| `Pool_OutgoingClaimSummary` | `pool_service.sync_pool_outgoing_claim_summary` | Обновляет `totalClaimedAmount` + `outgoingTranchesBalance` |
| `Pool_OutgoingTrancheClaimed` | `pool_service.sync_pool_outgoing_tranche_claimed` | `outgoingTranches[i].executedAmount` |
| `Pool_PausedStateChanged` | `pool_service.sync_pool_paused_state` | `paused = isPaused` |
| `Pool_ReservesUpdated` | `pool_service.sync_pool_reserves` | `realHoldReserve`/`virtualHoldReserve`/`virtualRwaReserve` |
| `Pool_TargetReached` | `pool_service.sync_pool_target_reached` | `isTargetReached=true` + `outgoingTranchesBalance` + `floatingTimestampOffset` |

**Иерархия одного consumed event в Tempo:**
```
amqplib.consume (auto-instr, queue=blockchain.events.rwa)
  └── rwa.rabbitmq.consume {eventName, blockNumber, transactionHash, queueName}
        ├── blockchain_events_daemon.get_event_routing  ← @TraceDecorator
        └── <pool_service.sync_pool_xxx>  ← @TraceDecorator
              └── pool_repository.<update_pool_by_address|find_by_address>  ← @TraceDecorator
```

### 1.5. Auto-instrumentation

Все инструменты — из `@shared/monitoring/src/monitoring.plugin.ts`.
Сервис `rwa` использует **все** активные инструменты.

| Тип | Инструмент | Активен | Какие спаны | Атрибуты |
|-----|-----------|---------|-------------|----------|
| HTTP | `@opentelemetry/instrumentation-http` | ✅ | `POST /createBusiness`, `POST /getBusiness`, `POST /createPool`, … (все 17 роутов), плюс **HTTP client spans** к `signers-manager` (Eden Treaty) | `http.method`, `http.target`, `http.status_code`, `http.service=rwa`, `service.name=rwa` |
| MongoDB | `@opentelemetry/instrumentation-mongoose` | ⚠️ **`suppressInternalInstrumentation: true`** — внутренние Mongoose-операции **не создают спаны**. Все БД-операции идут только через `@TraceDecorator` на репозиториях | — (подавлены) | — |
| Redis | `@opentelemetry/instrumentation-redis` + `instrumentation-ioredis` | ✅ | `redis.publish` для `pool:deployed` через `PoolEventsClient` | (без custom атрибутов — hooks no-op) |
| RabbitMQ | `@opentelemetry/instrumentation-amqplib` | ✅ | `amqplib.consume` на `blockchain.events.rwa` + producer spans если rwa сам паблишит (не использует напрямую) | `messaging.rabbitmq.exchange`, `messaging.rabbitmq.routing_key` |
| GraphQL | `@opentelemetry/instrumentation-graphql` | ❌ `enabled: false` | — (rwa не GraphQL, не нужно) | — |
| DNS | `@opentelemetry/instrumentation-dns` | ✅ | `dns.lookup` при каждом connect | — |
| FS | `@opentelemetry/instrumentation-fs` | ✅ | `fs.*` при чтении env / etc | — |
| Net | `@opentelemetry/instrumentation-net` | ✅ | `net.connect` к MongoDB/RabbitMQ/Redis | — |
| Runtime | `@opentelemetry/instrumentation-runtime-node` | ✅ | — (метрики, не спаны) | — |

**Ключевая особенность rwa:** MongoDB auto-instrumentation подавлена.
Поэтому при поиске «где идёт медленный Mongo-запрос» в Tempo
**смотреть спаны репозиториев** (`business_repository.*`,
`pool_repository.*`) — это единственное место, где видна длительность
БД-операции.

### 1.6. Дебаг: полная иерархия для `POST /createPoolWithAI`

```
POST /createPoolWithAI                                  ← HTTP auto-instr
  └── pool_service.create_pool_with_ai                  ← @TraceDecorator
        ├── openrouter.chat_completion {model=...}      ← @shared/openrouter (внутренний span)
        │     └── http POST https://openrouter.ai/...   ← HTTP client auto-instr
        └── pool_repository.create_pool                 ← @TraceDecorator
              └── mongoose.PoolEntity.create (NO SPAN)  ← mongoose auto-instr ОТКЛЮЧЁН
```

**Где искать проблему:**
- `create_pool_with_ai` падает "Chain ID … is not supported" → смотреть env `RWA` networks / hardcoded `chainId: '97'` в `index.ts:20`
- AI-ответ не парсится → смотреть логи в `generatePoolFields` (нет спана, лог только через `Error` throw → попадёт в `pool_service.create_pool_with_ai — system_error`)
- `pool_repository.create_pool` долгий (>200ms) → MongoDB лагает

### 1.7. Дебаг: полная иерархия для `Pool_Deployed` event
**Иерархия одного consumed event в Tempo:**
```
amqplib.consume (queue=blockchain.events.rwa)           ← amqplib auto-instr (root span)
  └── blockchain_events_daemon.get_event_routing       ← @TraceDecorator (вызывается из handleMessage)
        └── pool_service.sync_pool_after_deployment    ← @TraceDecorator
              ├── pool_repository.find_by_id           ← @TraceDecorator
              ├── pool_repository.update_pool          ← @TraceDecorator
              └── PoolEventsClient.publishPoolDeployed (без спана — нет @TraceDecorator)
                    └── redis.publish (channel=pool:deployed, msg=POOL_DEPLOYED)
                          └── ioredis.send (auto-instr)
```

> **Замечание:** `BaseBlockchainDaemon.handleMessage` (в
> `@shared/blockchain-daemon/src/baseBlockchain.daemon.ts:100`) **не
> оборачивает** обработку в span вида rwa.rabbitmq.consume.
> Это **gap относительно конвенции `rwa-observability` §4.2** (там
> рекомендован span rwa.rabbitmq.consume per consumed event).
> Без него `eventName` / `blockNumber` / `transactionHash` не попадают
> в `attributes` активного спана в момент обработки. AmqplibInstrumentation
> создаёт только корневой span `amqplib.consume` без бизнес-атрибутов.

**Где искать проблему:**
- Нет спана rwa.rabbitmq.consume в Tempo → см. замечание выше (gap конвенции, не в runtime)
- `pool_service.sync_pool_after_deployment` падает `NotFoundError` → event приехал для `entityId`, которого нет в БД (рассинхрон business/pool)
- Redis publish упал → `PoolEventsClient.publishPoolDeployed` ловит `catch`, `logger.error` + throw (rollback транзакции? нет — update уже произошёл)

---

## 2. Логи

Все логи — через `@LogDecorator` (уровень DEBUG) + прямые `logger.*`
в плагинах/daemon-инициализации + `ErrorHandlerPlugin` (ERROR).

### 2.1. Business-логи (сервисы)

Каждый метод с `@LogDecorator({args: [...]})` логирует:
- `DEBUG` при входе: `<class>.<method> — called` с атрибутами по `args`
- `DEBUG` при успехе: `<class>.<method> — ok`
- `WARN` при `AppError`: `<class>.<method> — failed`
- `ERROR` при прочих: `<class>.<method> — system_error`

| Метод | DEBUG при вызове (args) | WARN при ошибке | ERROR |
|-------|--------------------------|-----------------|-------|
| `business_service.create_business_with_ai` | `data` | `NotAllowedError` | любая другая |
| `business_service.create_business` | `data` | `NotAllowedError` | любая другая |
| `business_service.edit_business` | `params` | `NotAllowedError` | любая другая |
| `business_service.update_risk_score` | `id` | — | парсинг AI, отсутствие полей |
| `business_service.request_approval_signatures` | `params` | `NotAllowedError` | `taskResponse.error` от signers-manager |
| `business_service.reject_approval_signatures` | `id` | `NotAllowedError` | любая другая |
| `business_service.sync_after_deployment` | `eventData` | — | любая другая |
| `business_service.get_business` | `id` | `NotFoundError` | любая другая |
| `business_service.get_businesses` | `params` | — | любая другая |
| `pool_service.create_pool_with_ai` | `data` | `NotAllowedError` | любая другая |
| `pool_service.update_risk_score` | `id` | — | парсинг AI, отсутствие полей |
| `pool_service.request_approval_signatures` | `params.id` | `NotAllowedError` | validation errors (amounts/periods/fees) |
| `pool_service.reject_approval_signatures` | `id` | `NotAllowedError` | любая другая |
| `pool_service.get_pool` | `id` | `NotFoundError` | любая другая |
| `pool_service.create_pool` | `data` | `NotAllowedError` | любая другая |
| `pool_service.edit_pool` | `params` | `NotAllowedError` | любая другая |
| `pool_service.sync_pool_after_deployment` | `event` | — | `NotFoundError`, любая другая |
| `pool_service.sync_pool_awaiting_bonus_amount` | `event` | — | `NotFoundError` |
| `pool_service.sync_pool_awaiting_rwa_amount` | `event` | — | `NotFoundError` |
| `pool_service.sync_pool_funds_fully_returned` | `event` | — | `NotFoundError` |
| `pool_service.sync_pool_bonus_withdrawn` | `event` | — | `NotFoundError` |
| `pool_service.sync_pool_incoming_return_summary` | `event` | — | `NotFoundError` |
| `pool_service.sync_pool_incoming_tranche_update` | `event` | — | `NotFoundError`, invalid tranche index |
| `pool_service.sync_pool_outgoing_claim_summary` | `event` | — | `NotFoundError` |
| `pool_service.sync_pool_outgoing_tranche_claimed` | `event` | — | `NotFoundError`, invalid tranche index |
| `pool_service.sync_pool_paused_state` | `event` | — | `NotFoundError` |
| `pool_service.sync_pool_reserves` | `event` | — | `NotFoundError` |
| `pool_service.sync_pool_target_reached` | `event` | — | `NotFoundError` |
| `pool_service.get_pools` | `params` | — | любая другая |
| `token_service.get_token_metadata` | `tokenId` | `NotFoundError` | любая другая |

**Особенность `args`:** для AI-методов args включает `data` (всё
тело запроса) — внутри `data` нет секретов/ключей, только
бизнес-поля. Это допустимо по конвенции (см. `rwa-observability` §2.4).

### 2.2. ErrorHandlerPlugin — автоматические логи

Подключён в `app.ts:65` через `.onError(ErrorHandlerPlugin)`. Логирует
**все** ошибки, **не пойманные** внутри `@LogDecorator`/try-catch.
Использует `logger.error` для ЛЮБЫХ ошибок (и AppError, и unknown).

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` (NotFoundError, NotAllowedError) | ERROR | `[{code}] {error.message}` | `{error, errorName, errorStack, path}` |
| Любая другая ошибка | ERROR | `Unexpected error:` + message | `{error, errorName, errorStack, path}` |

> **Важно:** `ErrorHandlerPlugin` логирует ВСЕ ошибки через `logger.error`,
> включая `AppError`. Утверждение «AppError → WARN» — некорректно для
> `ErrorHandlerPlugin` (это про `@LogDecorator`, не про error handler).
> Источник: `shared/errors/error-handler.plugin.ts:11,31`.

### 2.3. Init / shutdown логи (плагины + daemon)

| Файл / место | Уровень | Сообщение | Когда |
|---------------|---------|-----------|-------|
| `repositories.plugin.ts:22` | INFO | `Connecting to MongoDB` + `{uri}` | при старте |
| `repositories.plugin.ts:24` | INFO | `MongoDB connected successfully` | при connect callback |
| `repositories.plugin.ts:40` | INFO | `Disconnecting from MongoDB` | при `.onStop()` |
| `repositories.plugin.ts:42` | INFO | `MongoDB disconnected successfully` | после disconnect |
| `clients.plugin.ts:52` | DEBUG | `Initializing clients` | в `rabbitmq_connect` span |
| `clients.plugin.ts:54` | INFO | `RabbitMQ client connected` | после `rabbitMQClient.connect()` |
| `clients.plugin.ts:72` | INFO | `Clients disconnected` | при `.onStop()` |
| `daemons.plugin.ts:24` | DEBUG | `Initializing daemons` | в `daemons.initialize` span |
| `daemons.plugin.ts:27` | INFO | `Blockchain events daemon started` | после `daemon.start()` |
| `daemons.plugin.ts:43` | INFO | `Blockchain events daemon stopped` | при `.onStop()` |
| `clients/poolEvents.client.ts:15` | DEBUG | `Published pool deployed event for pool {address}` | успех publish |
| `clients/poolEvents.client.ts:17` | ERROR | `Failed to publish pool deployed event …` + error | publish fail |

### 2.4. Как читать

- `— called` → операция началась
- `— ok` → операция завершена успешно
- `— failed` → ожидаемая бизнес-ошибка (проверить `error` атрибут, класс `AppError`)
- `— system_error` → неожиданная ошибка (смотреть `errorStack`)

---

## 3. Метрики

Все метрики префиксируются `SERVICE_NAME=rwa`.

Создаются через:
- `@MetricsDecorator()` — на 30 публичных методах сервисов (counter + histogram)
- Прямые вызовы `metrics.*` в сервисах **отсутствуют**

### 3.1. Business counters & histograms

Имя Prometheus = `rwa_<ClassName>_<methodName>_total/_duration`.
ClassName/MethodName в Prometheus не в snake_case (берутся как есть
из декоратора; `camelToSnakeCase` в `MetricsDecorator` НЕ применяется —
см. `shared/monitoring/src/metricsDecorator.ts`).

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `rwa_BusinessService_createBusinessWithAI_total` | Counter | `result=success\|error` | каждый вызов | AI-генерация бизнеса (поле name/desc/tags) |
| `rwa_BusinessService_createBusinessWithAI_duration` | Histogram | — | каждый вызов | Латентность (доминирует AI) |
| `rwa_BusinessService_createBusiness_total` | Counter | `result=success\|error` | каждый вызов | Создание бизнеса вручную |
| `rwa_BusinessService_createBusiness_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_BusinessService_editBusiness_total` | Counter | `result=success\|error` | каждый вызов | Редактирование |
| `rwa_BusinessService_editBusiness_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_BusinessService_updateRiskScore_total` | Counter | `result=success\|error` | каждый вызов | AI risk assessment |
| `rwa_BusinessService_updateRiskScore_duration` | Histogram | — | каждый вызов | Латентность (доминирует AI) |
| `rwa_BusinessService_requestApprovalSignatures_total` | Counter | `result=success\|error` | каждый вызов | Запрос подписей на deploy |
| `rwa_BusinessService_requestApprovalSignatures_duration` | Histogram | — | каждый вызов | Латентность (включает HTTP к signers-manager) |
| `rwa_BusinessService_rejectApprovalSignatures_total` | Counter | `result=success\|error` | каждый вызов | Отзыв pending task |
| `rwa_BusinessService_rejectApprovalSignatures_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_BusinessService_syncAfterDeployment_total` | Counter | `result=success\|error` | каждый consume `RWA_Deployed` | Синхронизация после деплоя |
| `rwa_BusinessService_syncAfterDeployment_duration` | Histogram | — | каждый consume | Латентность |
| `rwa_BusinessService_getBusiness_total` | Counter | `result=success\|error` | каждый вызов | Чтение одного |
| `rwa_BusinessService_getBusiness_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_BusinessService_getBusinesses_total` | Counter | `result=success\|error` | каждый вызов | Чтение списка |
| `rwa_BusinessService_getBusinesses_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_PoolService_createPoolWithAI_total` | Counter | `result=success\|error` | каждый вызов | AI-генерация пула (большой JSON) |
| `rwa_PoolService_createPoolWithAI_duration` | Histogram | — | каждый вызов | Латентность (доминирует AI) |
| `rwa_PoolService_updateRiskScore_total` | Counter | `result=success\|error` | каждый вызов | AI risk assessment для пула |
| `rwa_PoolService_updateRiskScore_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_PoolService_requestApprovalSignatures_total` | Counter | `result=success\|error` | каждый вызов | Запрос подписей на deploy пула |
| `rwa_PoolService_requestApprovalSignatures_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_PoolService_rejectApprovalSignatures_total` | Counter | `result=success\|error` | каждый вызов | Отзыв pending task |
| `rwa_PoolService_rejectApprovalSignatures_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_PoolService_getPool_total` | Counter | `result=success\|error` | каждый вызов | Чтение одного |
| `rwa_PoolService_getPool_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_PoolService_createPool_total` | Counter | `result=success\|error` | каждый вызов | Создание пула вручную |
| `rwa_PoolService_createPool_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_PoolService_editPool_total` | Counter | `result=success\|error` | каждый вызов | Редактирование |
| `rwa_PoolService_editPool_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_PoolService_syncPoolAfterDeployment_total` | Counter | `result=success\|error` | каждый consume `Pool_Deployed` | Полная синхро-низация пула |
| `rwa_PoolService_syncPoolAfterDeployment_duration` | Histogram | — | каждый consume | Латентность (включает Redis publish) |
| `rwa_PoolService_syncPoolAwaitingBonusAmount_total` | Counter | `result=success\|error` | каждый consume `Pool_BonusWithdrawn` | Обновление `awaitingBonusAmount` |
| `rwa_PoolService_syncPoolAwaitingBonusAmount_duration` | Histogram | — | каждый consume | Латентность |
| `rwa_PoolService_syncPoolAwaitingRwaAmount_total` | Counter | `result=success\|error` | каждый consume `Pool_AwaitingRwaAmountUpdated` | Обновление |
| `rwa_PoolService_syncPoolAwaitingRwaAmount_duration` | Histogram | — | каждый consume | Латентность |
| `rwa_PoolService_syncPoolFundsFullyReturned_total` | Counter | `result=success\|error` | каждый consume `Pool_FundsFullyReturned` | Закрытие пула |
| `rwa_PoolService_syncPoolFundsFullyReturned_duration` | Histogram | — | каждый consume | Латентность |
| `rwa_PoolService_syncPoolBonusWithdrawn_total` | Counter | `result=success\|error` | каждый consume `Pool_BonusWithdrawn` | (см. выше — есть пересечение имён) |
| `rwa_PoolService_syncPoolBonusWithdrawn_duration` | Histogram | — | каждый consume | Латентность |
| `rwa_PoolService_syncPoolIncomingReturnSummary_total` | Counter | `result=success\|error` | каждый consume `Pool_IncomingReturnSummary` | |
| `rwa_PoolService_syncPoolIncomingReturnSummary_duration` | Histogram | — | каждый consume | |
| `rwa_PoolService_syncPoolIncomingTrancheUpdate_total` | Counter | `result=success\|error` | каждый consume `Pool_IncomingTrancheUpdate` | |
| `rwa_PoolService_syncPoolIncomingTrancheUpdate_duration` | Histogram | — | каждый consume | |
| `rwa_PoolService_syncPoolOutgoingClaimSummary_total` | Counter | `result=success\|error` | каждый consume `Pool_OutgoingClaimSummary` | |
| `rwa_PoolService_syncPoolOutgoingClaimSummary_duration` | Histogram | — | каждый consume | |
| `rwa_PoolService_syncPoolOutgoingTrancheClaimed_total` | Counter | `result=success\|error` | каждый consume `Pool_OutgoingTrancheClaimed` | |
| `rwa_PoolService_syncPoolOutgoingTrancheClaimed_duration` | Histogram | — | каждый consume | |
| `rwa_PoolService_syncPoolPausedState_total` | Counter | `result=success\|error` | каждый consume `Pool_PausedStateChanged` | |
| `rwa_PoolService_syncPoolPausedState_duration` | Histogram | — | каждый consume | |
| `rwa_PoolService_syncPoolReserves_total` | Counter | `result=success\|error` | каждый consume `Pool_ReservesUpdated` | |
| `rwa_PoolService_syncPoolReserves_duration` | Histogram | — | каждый consume | |
| `rwa_PoolService_syncPoolTargetReached_total` | Counter | `result=success\|error` | каждый consume `Pool_TargetReached` | |
| `rwa_PoolService_syncPoolTargetReached_duration` | Histogram | — | каждый consume | |
| `rwa_PoolService_getPools_total` | Counter | `result=success\|error` | каждый вызов | Чтение списка |
| `rwa_PoolService_getPools_duration` | Histogram | — | каждый вызов | Латентность |
| `rwa_TokenService_getTokenMetadata_total` | Counter | `result=success\|error` | каждый вызов | ERC-1155 metadata endpoint |
| `rwa_TokenService_getTokenMetadata_duration` | Histogram | — | каждый вызов | Латентность |

**Примечание:** В коде оба метода — `syncPoolBonusWithdrawn` (handler
для `Pool_BonusWithdrawn`) и `syncPoolAwaitingBonusAmount` (handler
для `Pool_AwaitingRwaAmountUpdated` — нет, на самом деле для
`Pool_AwaitingRwaAmountUpdated` это `syncPoolAwaitingRwaAmount`, а
`syncPoolAwaitingBonusAmount` используется НЕ напрямую как
routing — но в `getEventRouting` для `Pool_BonusWithdrawn` обновляются
и `awaitingBonusAmount`, и `rewardedRwaAmount`). В Tempo при поиске
события `Pool_BonusWithdrawn` оба счётчика растут
(`syncPoolAwaitingBonusAmount_total` — нет, перепроверь — на самом
деле `Pool_BonusWithdrawn` → `syncPoolBonusWithdrawn` единственный;
`syncPoolAwaitingBonusAmount` не используется в `getEventRouting`
вообще, это dead handler, но метод существует). **TODO:** проверить,
вызывается ли `syncPoolAwaitingBonusAmount` где-то ещё (сейчас
не вызывается).

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `@opentelemetry/instrumentation-runtime-node` | CPU, memory, event loop lag, GC |
| `http.server.*` | HTTP auto-instrumentation | RPS, latency per endpoint, status codes |
| `http.client.*` | HTTP auto-instrumentation (client) | RPS/latency исходящих запросов к `signers-manager` (Eden Treaty) |
| `db.client.*` | MongoDB auto-instrumentation | **подавлено** (`suppressInternalInstrumentation: true`) — фактически метрик нет |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов по сервису/имени |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |

**Как читать:**
- `process_runtime_node_event_loop_lag_seconds` — загружен ли event loop
- `http.server.duration{http.target="/createBusiness"}` — latency POST-эндпоинта (включает парсинг + всю бизнес-логику)
- `http.client.duration{http.url=~".*signers-manager.*"}` — latency запросов к signers-manager
- `traces_spanmetrics_calls_total{span_name="pool_service.create_pool_with_ai"}` — частота AI-вызовов

### 3.3. Примеры PromQL

```promql
# Ошибки создания бизнеса за 5 минут
rate(rwa_BusinessService_createBusiness_total{result="error"}[5m])

# P99 latency AI-генерации пула
histogram_quantile(0.99, rate(rwa_PoolService_createPoolWithAI_duration_bucket[5m]))

# Количество созданных бизнесов за сутки
increase(rwa_BusinessService_createBusiness_total{result="success"}[24h])

# Доля failed consume-событий
sum(rate(rwa_PoolService_syncPoolAfterDeployment_total{result="error"}[5m]))
  / sum(rate(rwa_PoolService_syncPoolAfterDeployment_total[5m]))

# Средняя длительность sync после деплоя пула
rate(rwa_PoolService_syncPoolAfterDeployment_duration_sum[5m])
  / rate(rwa_PoolService_syncPoolAfterDeployment_duration_count[5m])

# Топ самых долгих эндпоинтов (P95)
topk(5,
  histogram_quantile(0.95,
    rate(http_server_duration_bucket{service_name="rwa"}[5m])
  )
)
```

---

## 4. Health-check

### `GET /health`

Подключён через `healthPlugin` (`@shared/monitoring/src/health.plugin.ts`).
Не трейсится (быстрый ответ, без декораторов). Возвращает:

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "service": "rwa"
}
```

**Как читать:** Если `/health` не отвечает — сервис не стартанул.
Используется в Docker Compose healthcheck (см. `docker-compose.yml:428`).

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует | docker logs — ошибка в init-фазе (MongoDB URI, RabbitMQ, OpenRouter API key) |
| Init зависает на `repositories_plugin.mongoose` | MongoDB недоступна / неверный URI; проверить `MONGODB_URI` env |
| Init зависает на `clients.rabbitmq_connect` | RabbitMQ недоступна; проверить `RABBITMQ_URL` |
| Init зависает на `daemons.initialize` | Не подключились к AMQP-очереди; см. `RABBITMQ_EXCHANGE=blockchain.events` |
| `createBusinessWithAI` падает на AI | Логи `pool_service.create_business_with_ai — system_error` + `Error: Failed to parse AI response`; проверить `OPENROUTER_API_KEY` |
| `requestApprovalSignatures` падает "Network not found" | Хардкод `chainId: '97'` в `index.ts:20`; добавить нужную сеть |
| `syncPoolAfterDeployment` падает `NotFoundError` | Event приехал для `entityId`, которого нет в БД; проверить ранее созданный pool |
| `PoolEventsClient` не паблишит | `logger.error` в `poolEvents.client.ts:17`; проверить Redis URL |
| Спан потребления сообщения (rwa.rabbitmq.consume) отсутствует в Tempo | См. замечание в §1.7 — `BaseBlockchainDaemon.handleMessage` не оборачивает обработку в `withTraceAsync`. Это gap конвенции, не runtime-баг. |
| Mongo-запрос долгий (>200ms) | Смотреть спаны `business_repository.*` / `pool_repository.*` (mongoose auto-instr подавлен) |
| Метрика `rwa_*_total` отсутствует | `@MetricsDecorator` не подключился — проверить, что импорт `MetricsDecorator` из `@shared/monitoring/src/metricsDecorator` |
| Сервис не пишет в Loki | Проверить `OTEL_EXPORTER_OTLP_ENDPOINT` env, Alloy health |
| Метрики идут без префикса `rwa_` | `SERVICE_NAME` env не задан в docker-compose; проверить `RWA_SERVICE_NAME` |
| AI-метод медленный (>5s) | `histogram_quantile(0.99, rate(rwa_BusinessService_createBusinessWithAI_duration_bucket[5m]))`; обычно ddos OpenRouter |
| Все `NotAllowedError` | AppError → WARN в `@LogDecorator`, ERROR в `ErrorHandlerPlugin`; фильтровать в Loki по `errorName=NotAllowedError` |
| Контроллеры не отвечают | Проверить, что `rwa.init.controllers_plugin` зелёный в Tempo; иначе ошибка инициализации роута |
