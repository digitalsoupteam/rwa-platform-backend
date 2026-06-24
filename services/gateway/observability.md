# Gateway — Observability Reference

`gateway` — единая точка входа RWA Platform. GraphQL-шлюз (Elysia + GraphQL Yoga),
проксирующий запросы клиентов (frontend, mobile, third-party) к 17 internal
микросервисам через **Eden Treaty** (RPC через HTTP). Подписки (subscriptions)
доставляются через **SSE** (`@graphql-yoga/plugin-graphql-sse`) поверх
**Redis PubSub** (`@graphql-yoga/redis-event-target`). Аутентификация — JWT
(access token из заголовка `Authorization: Bearer ...`).

`SERVICE_NAME=gateway` (см. `instrumentation.ts:13`, `config/index.ts:3`).

**Что у сервиса есть:**

| Слой | Технология | Где |
|------|-----------|-----|
| HTTP-сервер | Elysia 1.3.5 + `yogaServer` | `src/index.ts`, `src/graphql/server/index.ts` |
| API | GraphQL Yoga (POST `/graphql`, GET `/graphql/stream`) | `src/graphql/server/index.ts` |
| Tracing | OpenTelemetry → OTLP → Alloy → Tempo | `src/instrumentation.ts` + shared `monitoringPlugin` |
| Логи | OTel `OTelLogger` → OTLP → Loki (через `monitoringPlugin`) | shared `monitoring/src/logger.ts` |
| Метрики | OTel `OTelMetrics` → OTLP → Prometheus | `src/index.ts` (.onAfterHandle/.onError) |
| Кеш | Redis (ioredis) через `RedisWithTracing` | `src/clients/redis.client.ts` |
| Subscriptions | Redis PubSub через `RedisWithTracing` (publish + subscribe клиенты) | `src/clients/events.client.ts` |
| Auth | JWT (jsonwebtoken) verify/decode/expiry | `src/utils/jwt.utils.ts` + `graphql/server/index.ts:context` |

**Чего у сервиса НЕТ** (в отличие от internal-микросервисов):

- ❌ Нет MongoDB / Mongoose (никаких моделей/репозиториев)
- ❌ Нет RabbitMQ (нет consumer'ов, нет publish в broker)
- ❌ Нет daemon-процессов
- ❌ Нет `app.ts` и `createApp()`-фабрики (всё в одном `index.ts`)
- ❌ Нет Elysia-плагинов для DI (клиенты — синглтоны в `services.init.ts`)
- ❌ Нет `ErrorHandlerPlugin` из `shared/errors` (он для Elysia REST-роутов;
  GraphQL Yoga пробрасывает ошибки клиенту через `throw` в резолверах)
- ❌ Нет `init.<...>` root-спана — `index.ts` не оборачивает старт в
  `tracer.startActiveSpan(...)` и не использует `withTraceSync/Async`

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

**Root init-спан отсутствует.** В `index.ts:7-32` поднимается `new Elysia(...)`,
внутри `.use(monitoringPlugin)` (создаёт NodeSDK + OTLP-экспортёр) и
`.use(healthPlugin)`. Никакого `tracer.startActiveSpan('gateway.init.main', ...)`
или `withTraceAsync('gateway.init.*', ...)` нет. Старт можно наблюдать только
через дочерние спаны `@elysiajs/opentelemetry` lifecycle-хуков на первом
входящем запросе (см. 1.3) и через `process.runtime.node.*` метрики.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| _нет_ | — | — | — | Конвенция `<service>.init.main` НЕ реализована |

### 1.2. Shutdown

**Не реализовано.** `index.ts` не объявляет `.onStop(...)` / graceful
shutdown — Elysia при получении SIGTERM закроет соединения по умолчанию
без спана.

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| _нет_ | — | — | — |

### 1.3. Runtime — бизнес-методы

#### Внутренние service-классы (префикс через `camelToSnakeCase(ClassName)`)

Эти 4 класса — единственное место в gateway, где есть `@TraceDecorator`.

#### `CacheService` (префикс `cache_service`)

| Span name | Атрибуты span | Вызывается из | HTTP / запросы к сети | Ошибки |
|-----------|--------------|----------------|------------------------|--------|
| `cache_service.reset_company_cache` | — (нет `setSpanAttributes`) | Резолверы company-модуля | `RedisWithTracing.del('company:<id>')` (auto-instr `redis-DEL`) | _нет явного throw_ |
| `cache_service.get_company` | — | `OwnershipService.checkOwnership`, `OwnershipService.getOwnerWallet` | 1) `RedisWithTracing.get('company:<id>')` → кеш, 2) Eden: `companyClient.getCompany.post(...)` (auto-instr `http`) | _возвращает `response` без throw — caller проверяет_ |

#### `OwnershipService` (префикс `ownership_service`)

| Span name | Атрибуты span | Вызывается из | Запросы к сети | Ошибки |
|-----------|--------------|----------------|----------------|--------|
| `ownership_service.check_ownership` | — | `createBusiness`, `editBusiness`, `createPool`, `createPoolWithAI`, `createDocument`, `updateDocument`, `updateFolder`, и т.д. (все мутации с owner-проверкой) | 1) `cacheService.getCompany(...)` (дочерний `cache_service.get_company`), 2) `authClient.getUser.post(...)` для `ownerType=company` (auto-instr `http`) | `ForbiddenError` (если `ownerId !== userId` для user; если нет member'а с нужным permission) |
| `ownership_service.get_owner_wallet` | — | Резолверы, которым нужен кошелёк владельца (например, для подписания) | 1) `cacheService.getCompany(...)`, 2) `authClient.getUser.post(...)` (получить wallet owner'а компании) | `ForbiddenError` (если company не найдена или owner не найден) |

#### `ParentService` (префикс `parent_service`)

| Span name | Атрибуты span | Вызывается из | Запросы к сети | Ошибки |
|-----------|--------------|----------------|----------------|--------|
| `parent_service.get_parent_info` | — | Резолверы rwa / company (для иерархии `business→pool→user`) | `rwaClient.getBusiness.post(...)` (type=`business`) или `rwaClient.getPool.post(...)` (type=`pool`); для `user` — без сети | `Error('Failed to get business/pool data')`, `Error('User type not equal parentId and userId')`, `Error('Invalid parent type')` |

#### `ValidationService` (префикс `validation_service`)

| Span name | Атрибуты span | Вызывается из | Запросы к сети | Ошибки |
|-----------|--------------|----------------|----------------|--------|
| `validation_service.validate_country` | — | `createBusiness`, `editBusiness` и др. (перед отправкой в `rwa`/`company`) | _без сети/БД_ (regex `/^[A-Z]{2}$/`) | `GraphQLError('Invalid country code...')` |
| `validation_service.validate_socials` | — | То же | _без сети/БД_ (regex URL-patterns) | `GraphQLError` на неверный type/url |

_Примечание: span name = camelToSnakeCase(ClassName) + '.' + camelToSnakeCase(method).
`setSpanAttributes()` НЕ вызывается ни в одном из 4 service-классов — это
разрыв с конвенцией `rwa-observability` §1.5, при поиске в Tempo спаны
различаются только по имени._

#### GraphQL резолверы

**Резолверы GraphQL НЕ имеют `@TraceDecorator`.** Per-resolver спаны отключены
через `useOpenTelemetry({ resolvers: false, ... })` в `graphql/server/index.ts:44-48`.
Каждый резолвер виден в трейсе как:

| Span name (от `@envelop/opentelemetry`) | Атрибуты | Откуда вызывается | Что внутри | Ошибки |
|------------------------------------------|----------|--------------------|------------|--------|
| `query.<OperationName>` | `graphql.operation.name`, `graphql.operation.type=query` | Yoga при POST `/graphql` (batched/неbatched) | `logger.debug('Getting ...', { ... })` → `clients.*Client.<method>.post(...)` → `if (response.error) throw new Error(...)` | `Error('Failed to ...')` пробрасывается клиенту; логируется через `logger.error` |
| `mutation.<OperationName>` | `graphql.operation.name`, `graphql.operation.type=mutation` | Yoga при POST `/graphql` | Дополнительно: `if (!user) throw AuthenticationError(...)`, `services.validation.validateCountry(...)`, `services.validation.validateSocials(...)`, `services.ownership.checkOwnership(...)` | `AuthenticationError` (нет user), `GraphQLError` (валидация), `ForbiddenError` (ownership), `Error(...)` (downstream) |
| `subscription.<OperationName>` | `graphql.operation.name`, `graphql.operation.type=subscription` | Yoga при GET `/graphql/stream` (SSE) | `pubSub.subscribe('channel-name')` → pipe → map → отдаёт SSE-клиенту | _на subscribe — нет throw; ошибки приходят в `error:` SSE-фрейме_ |

> **Имена операций** — это `Query.*` / `Mutation.*` / `Subscription.*` GraphQL-схемы,
> по одной на каждый резолвер. Полный список — `src/graphql/modules/*/schema.graphql`.
> Самые нагруженные модули: `rwa` (business/pool CRUD + subscriptions), `blog`,
> `company`, `documents`, `gallery`, `ai-assistant`, `loyalty`, `dao`.

### 1.4. Auto-instrumentation

Активные инструменты (источник: `instrumentation.ts:18-30` — собственный OTel
SDK gateway, плюс импортируемый `shared/monitoring/src/monitoringPlugin`).
Ниже — фактически работающие для gateway:

| Тип | Инструмент | Какие спаны | Атрибуты | Где вкл/выкл |
|-----|-----------|-------------|----------|--------------|
| HTTP | `instrumentation-http` | `POST http://auth:3001/...`, `POST http://rwa:3001/...` (все Eden-вызовы), `POST /graphql`, `POST /graphql/stream` | `http.method`, `http.target`, `http.status_code`, + кастомный `http.service='gateway'`, `service.name='gateway'` (см. `instrumentation.ts:21-24`) | `enabled: true` (default), override в `instrumentation.ts:19-25` |
| Redis | `instrumentation-ioredis` | `redis-GET company:<id>`, `redis-SETEX company:<id> 300 ...`, `redis-DEL company:<id>`, `redis-PUBLISH`, `redis-SUBSCRIBE` (через `RedisWithTracing` в `redis.client.ts` и `events.client.ts`) | `db.system='redis'`, `db.statement` | `enabled: true` (через shared `monitoringPlugin`); gateway **не** передаёт override в `getNodeAutoInstrumentations` для redis — дефолт ON |
| DNS | `instrumentation-dns` | `dns.lookup` (при резолве имен сервисов) | — | default ON |
| FS | `instrumentation-fs` | `fs.readFileSync` (загрузка `.graphql` файлов Yoga) | — | default ON |
| Net | `instrumentation-net` | `net.connect` (Eden-TCP-соединения к internal сервисам) | — | default ON |
| Runtime | `instrumentation-runtime-node` | _не спаны, метрики_ (см. §3.2) | — | default ON |
| Elysia lifecycle | `@elysiajs/opentelemetry` | `request`, `handle`, `afterHandle` (per-request lifecycle-хуки) | `http.route`, `http.method` | auto, без override |
| GraphQL Yoga | `@envelop/opentelemetry` | `mutation.<Name>`, `query.<Name>`, `subscription.<Name>` | `graphql.operation.name`, `graphql.operation.type` | `resolvers: false` — per-resolver спаны отключены (`graphql/server/index.ts:44-48`); `variables: false`, `result: false` — body не логируется |
| GraphQL | `instrumentation-graphql` (auto) | не активен — gateway передаёт `enabled: true` (см. `instrumentation.ts:26-28`), но Yoga уже отдаёт `query.*`/`mutation.*` через `@envelop/opentelemetry`, дополнительные спаны дублируются | — | `enabled: true` в gateway (NB: shared `monitoringPlugin` ставит `false` — gateway **override'ит** на `true`) |
| Mongoose | `instrumentation-mongoose` | _не активен_ — у gateway нет MongoDB | — | не подключён |
| AMQP / RabbitMQ | `instrumentation-amqplib` | _не активен_ — gateway не публикует и не консьюмит | — | не подключён в `instrumentation.ts` gateway (shared `monitoringPlugin` его подключает, но gateway использует свой `instrumentation.ts` через `monitoringPlugin` — финальный список зависит от merge-логики `@opentelemetry/auto-instrumentations-node`) |

### 1.5. Дебаг: полная иерархия для типового запроса (mutation `createBusiness`)

```
nginx-gateway                  ← /gateway/graphql  (NGINX upstream root span)
  └ gateway                   ── POST /graphql       ← instrumentation-http
       ├── request                                ← @elysiajs/opentelemetry (Elysia onRequest)
       ├── handle                                 ← @elysiajs/opentelemetry (Elysia onHandle)
       │    ├── graphql.parse / graphql.validate  ← graphql-yoga
       │    ├── mutation.createBusiness           ← @envelop/opentelemetry (op type=mutation)
       │    │    ├── ownership_service.check_ownership      ← @TraceDecorator
       │    │    │    ├── cache_service.get_company         ← @TraceDecorator
       │    │    │    │    ├── redis-GET company:<id>       ← instrumentation-ioredis
       │    │    │    │    └── POST http://company:.../getCompany  ← instrumentation-http
       │    │    │    └── POST http://auth:.../getUser      ← instrumentation-http
       │    │    └── POST http://rwa:.../createBusiness     ← instrumentation-http
       │    └── graphql.execute / graphql.sendResponse
       └── afterHandle                             ← @elysiajs/opentelemetry
```

Для запроса с подпиской (SSE) вместо `mutation.*` будет `subscription.*`
и далее `redis-SUBSCRIBE` из `instrumentation-ioredis` (через
`pubSub.subscribe('pool:deployed')` в `rwa/resolvers/subscriptions/poolDeployed.ts`).

---

## 2. Логи

Логгер: shared `OTelLogger` (`@shared/monitoring/src/monitoring.plugin`,
поле `logger`) → OTel `LoggerProvider` → OTLP → Loki.
Локально — `ConsoleLogRecordExporter` (см. `shared/monitoring/src/monitoring.plugin.ts:37`).

### 2.1. Business-логи

Все 4 service-класса покрыты `@LogDecorator({ args: [...] })` (см. §1.3):

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `CacheService.resetCompanyCache(companyId)` | `cache_service.reset_company_cache — called` с `{companyId}` | `cache_service.reset_company_cache — ok` | нет throw |
| `CacheService.getCompany(params)` | `cache_service.get_company — called` с `{params}` | `cache_service.get_company — ok` | нет throw (возвращает `response`) |
| `OwnershipService.checkOwnership(params)` | `ownership_service.check_ownership — called` с `{params}` | `ownership_service.check_ownership — ok` | `ForbiddenError` (см. §1.3) — логируется как ERROR в `ErrorHandlerPlugin`, но gateway его не подключает (см. §2.2) |
| `OwnershipService.getOwnerWallet(params)` | `ownership_service.get_owner_wallet — called` с `{params}` | `ownership_service.get_owner_wallet — ok` | `ForbiddenError` (нет в `ErrorHandlerPlugin`) |
| `ParentService.getParentInfo(type, parentId, userId)` | `parent_service.get_parent_info — called` с `{type, parentId, userId}` | `parent_service.get_parent_info — ok` | `Error` (не AppError) |
| `ValidationService.validateCountry(country)` | `validation_service.validate_country — called` с `{country}` | `validation_service.validate_country — ok` | `GraphQLError` |
| `ValidationService.validateSocials(socials)` | `validation_service.validate_socials — called` с `{socials}` | `validation_service.validate_socials — ok` | `GraphQLError` |

Резолверы GraphQL: `@LogDecorator` НЕ используется. Каждый резолвер
вызывает `logger.debug('Action', { relevant_arg })` в начале и
`logger.error('Failed to ...', response.error)` при `response.error`.
Полный список таких вызовов — в каждом файле `src/graphql/modules/*/resolvers/**/*.ts`
(117 вызовов `logger.{debug,info,error,warn}` по всему сервису).

Особые случаи:

- `registerReferral.ts:34` — единственный `logger.warn` в gateway: если
  referrer запрошен через `input.referrerId`, но `authClient.getUser`
  вернул ошибку, логируется WARN и referral продолжается без `referrerWallet`.
- `jwt.utils.ts:26,43,58,76` — все 4 функции утилит ловят `try/catch` и
  пишут `logger.error('Error verifying/decoding/checking/extracting ... JWT token: ...')`.

### 2.2. ErrorHandlerPlugin

**НЕ подключён к gateway.** `shared/errors/error-handler.plugin.ts` —
это Elysia-плагин (`onError` хук с `{ error, set, request }`),
который работает только для Elysia REST-роутов. Gateway не объявляет
`ErrorHandlerPlugin` ни в `index.ts`, ни в `controllers/graphql.controller.ts`.

Следствие: ошибки, выброшенные из резолвера (например, `Error('Failed to get business')`),
**не проходят** через единый handler. Их судьба:

- GraphQL Yoga: `throw new Error(...)` в резолвере → автоматически попадает
  в GraphQL response.errors (с `logger.error('Failed to ...: ', error)`
  в самом резолвере).
- `AuthenticationError` / `ForbiddenError` (из `@shared/errors/app-errors`):
  наследуют `Error`, обрабатываются Yoga так же; отдельного statusCode
  gateway не выставляет (в отличие от Elysia-роутов, где
  `ErrorHandlerPlugin` ставил бы `error.statusCode`).
- `GraphQLError` (из `graphql`): попадает в response.errors как
  `GRAPHQL_VALIDATION_FAILED` (для `ValidationService`).

Если нужен централизованный handler для gateway — добавить в Yoga
`plugins: [useErrorHandler(...)]` или в `formatError`.

---

## 3. Метрики

Источник: `shared/monitoring/src/metrics.ts:15-25` (OTel `OTelMetrics`).
Имя метрики в Prometheus = `SERVICE_NAME + '_' + <name>`,
где `<name>` — первый аргумент `metrics.counter/histogram/gauge(...)`.
OTel-экспортёр отдаёт в OTLP → Prometheus scrape (через Alloy).

### 3.1. Business метрики

#### Прямые вызовы в `index.ts` (3 метрики на каждый HTTP-запрос)

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `gateway_request_duration_ms` | Histogram | `path`, `method` | `index.ts:21` (`.onAfterHandle`) и `index.ts:26` (`.onError`) | Латентность любого HTTP-запроса к gateway (включая `/graphql`, `/graphql/stream`, `/health`) |
| `gateway_requests_total` | Counter | `path`, `method`, `status` | `index.ts:22` (success) и `index.ts:27` (error) | RPS с разбивкой по path/method/status (status — HTTP код или Elysia `code`) |
| `gateway_errors_total` | Counter | `path`, `method`, `error_type` | `index.ts:28` (только в `.onError`) | Количество ошибок, тип — `error?.name` или `'unknown'` |

> ⚠️ Label `path` принимает **любые** значения — это потенциально
> high-cardinality. На практике gateway отвечает только на
> `/graphql`, `/graphql/stream`, `/health` (3 значения), плюс 404.

#### Метрики от `@MetricsDecorator` на 4 service-классах (7 методов × 2 = 14)

Префикс `gateway_` + `<className>.<methodName>` (точка сохраняется в имени
counter'а; Prometheus нормализует её в `_` при scrape):

| Prometheus имя (как отдаёт OTel) | Тип | Labels | Источник |
|----------------------------------|-----|--------|---------|
| `gateway_cache_service.reset_company_cache_total` | Counter | `result=success\|error` | `@MetricsDecorator` на `CacheService.resetCompanyCache` |
| `gateway_cache_service.reset_company_cache_duration` | Histogram | — | то же |
| `gateway_cache_service.get_company_total` | Counter | `result=success\|error` | `@MetricsDecorator` на `CacheService.getCompany` |
| `gateway_cache_service.get_company_duration` | Histogram | — | то же |
| `gateway_ownership_service.check_ownership_total` | Counter | `result=success\|error` | `@MetricsDecorator` на `OwnershipService.checkOwnership` |
| `gateway_ownership_service.check_ownership_duration` | Histogram | — | то же |
| `gateway_ownership_service.get_owner_wallet_total` | Counter | `result=success\|error` | `@MetricsDecorator` на `OwnershipService.getOwnerWallet` |
| `gateway_ownership_service.get_owner_wallet_duration` | Histogram | — | то же |
| `gateway_parent_service.get_parent_info_total` | Counter | `result=success\|error` | `@MetricsDecorator` на `ParentService.getParentInfo` |
| `gateway_parent_service.get_parent_info_duration` | Histogram | — | то же |
| `gateway_validation_service.validate_country_total` | Counter | `result=success\|error` | `@MetricsDecorator` на `ValidationService.validateCountry` |
| `gateway_validation_service.validate_country_duration` | Histogram | — | то же |
| `gateway_validation_service.validate_socials_total` | Counter | `result=success\|error` | `@MetricsDecorator` на `ValidationService.validateSocials` |
| `gateway_validation_service.validate_socials_duration` | Histogram | — | то же |

> В Tempo/Prometheus имя метрики будет с `_` вместо `.` (Prometheus
> заменяет все не-`[a-zA-Z0-9_]` на `_`). Реальное scrape-имя:
> `gateway_cache_service_reset_company_cache_total` и т.д.

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `instrumentation-runtime-node` | CPU, memory, event loop lag, GC |
| `http_server_*` / `http_client_*` | `instrumentation-http` | RPS, latency, status codes (HTTP-сервер gateway + HTTP-клиент к Eden-сервисам) |
| `db_client_*` (redis) | `instrumentation-ioredis` | Количество операций Redis, latency (для `RedisWithTracing` в `redis.client.ts` и `events.client.ts`) |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов (например, `mutation.createBusiness`) |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |

### 3.3. Примеры PromQL

```promql
# Ошибки HTTP за последние 5 минут (по path)
sum by (path) (rate(gateway_errors_total[5m]))

# Доля ошибок GraphQL-запросов
sum(rate(gateway_requests_total{path="/graphql",status=~"5.."}[5m]))
  /
sum(rate(gateway_requests_total{path="/graphql"}[5m]))

# P99 латентность любых запросов
histogram_quantile(0.99,
  sum by (le) (rate(gateway_request_duration_ms_bucket[5m]))
)

# Длительность кеш-чтения company (cache_service.get_company)
histogram_quantile(0.95,
  rate(gateway_cache_service.get_company_duration_bucket[5m])
)

# Проверки ownership — частота и доля ошибок
sum(rate(gateway_ownership_service.check_ownership_total{result="error"}[5m]))
  /
sum(rate(gateway_ownership_service.check_ownership_total[5m]))

# Сколько GraphQL-мутаций в секунду
sum(rate(traces_spanmetrics_calls_total{span_name=~"mutation\\..*"}[5m]))

# Redis-нагрузка от cache-service и pubsub
sum by (operation) (rate(db_client_operation_duration_seconds_count{db.system="redis"}[5m]))
```

---

## 4. Health-check

### `GET /health`

Подключён через `healthPlugin` (`shared/monitoring/src/health.plugin.ts`)
в `index.ts:13`. **Не под `monitoringPlugin` в Elysia-router** — это
обычный Elysia-route, отвечает синхронно без спана.

**Ответ (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "<ISO 8601>",
  "uptime": <seconds>,
  "service": "<process.env.SERVICE_NAME>"
}
```

**Проверки зависимостей нет** — gateway не проверяет Eden-клиентов
(внутренние сервисы) и Redis. Если `rwa` или `redis` упадут,
`/health` продолжит возвращать `200 ok` (пока процесс gateway жив).

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Запрос `/graphql` зависает | Спан `POST /graphql` (HTTP auto-instr) — внутри должен быть `mutation.*` / `query.*` (`@envelop/opentelemetry`); если есть, но висит — смотреть `http` спаны к downstream (`auth:3001/...`, `rwa:3001/...`); если `mutation.*` нет — Yoga не дошёл до execute (валидация/parse спаны) |
| `ForbiddenError` от `OwnershipService` | Спан `ownership_service.check_ownership` (`@TraceDecorator`) — атрибутов нет, искать по `service.name=gateway` + `span_name=ownership_service.check_ownership`; внутри — `cache_service.get_company` (отсутствие компании → `ForbiddenError('Failed to get company data')`) и `POST http://auth:.../getUser` (owner не найден) |
| Redis-кеш не работает | `db_client_operation_duration_seconds{db.system="redis"}` + спан `cache_service.get_company`; в логах OTel — `redis-GET company:<id>` / `redis-SETEX company:<id> 300 ...` спаны от `instrumentation-ioredis` |
| SSE-подписка не присылает события | Спан `subscription.poolDeployed` / `subscription.priceUpdates` (с типом `subscription.*`); внутри — `redis-SUBSCRIBE` (`instrumentation-ioredis`); проверить, что `publishClient` в `events.client.ts:7` и реальный `pubsub publisher` в `rwa` пишет в один и тот же Redis channel (`pool:deployed`, `charts:price:<addr>`) |
| HTTP 500 на `/graphql` | `gateway_errors_total{path="/graphql"}` + спан `request`/`handle` (Elysia lifecycle) + внутри `mutation.*` / `query.*` с `status=error` от Yoga; в `logger.error` — `Failed to <action>: <error>` |
| Медленная аутентификация | `gateway_request_duration_ms_bucket{path="/graphql"}`; в HTTP auto-instr — `POST http://auth:.../authenticate` (Eden), `POST http://auth:.../refreshToken`, `POST http://auth:.../getUserTokens` |
| Gateway сам не стартует | Init root-спана **нет** — смотреть stdout контейнера `gateway` (Bun падает на импорте или на `monitoringPlugin`); `/health` не отвечает → контейнер перезапускается по healthcheck'у Docker Compose (см. `infrastructure/docker/docker-compose.yml:314`) |
| Проверка JWT падает с ошибкой | `logger.error('Error verifying JWT token: ...')` в `utils/jwt.utils.ts:26` (verify), `:43` (decode), `:58` (isTokenExpired), `:76` (extractFromToken); в коде — это `logger.error`, **не** `logger.warn` |
| `registerReferral` без referrer | `logger.warn('Failed to get referrer user data', { error: ... })` в `loyalty/resolvers/mutations/registerReferral.ts:34` — единственный `logger.warn` в gateway |
| `validation` ругается на country/socials | `logger.error` от `@LogDecorator` на `validation_service.validate_country` / `validation_service.validate_socials` (выбрасывают `GraphQLError`, который попадает в response.errors без отдельного логирования на уровне gateway — `ErrorHandlerPlugin` не подключён) |
