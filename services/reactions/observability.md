# Reactions Service — Observability Reference

CRUD-сервис пользовательских реакций (лайки/дизлайки/эмодзи) на
произвольные сущности платформы. Одна Mongoose-коллекция `Reaction` с
композитным уникальным индексом `{parentId, parentType, userId, reaction}`,
один репозиторий `ReactionRepository` (5 методов), один сервис
`ReactionsService` (4 публичных метода), 4 Elysia-роута (`POST /setReaction`,
`/resetReaction`, `/getEntityReactions`, `/getReactions`). Нет daemon-ов,
нет RabbitMQ, нет Redis, нет внешних клиентов и нет исходящих HTTP-вызовов —
только MongoDB и Elysia.

- **SERVICE_NAME:** `reactions` (из `REACTIONS_SERVICE_NAME` в `docker-compose.yml`)
- **Порт:** `REACTIONS_PORT`
- **MongoDB DB:** `reactions` (из `REACTIONS_MONGODB_DBNAME`)
- **БД:** MongoDB (коллекция `Reaction`)
- **Клиенты:** нет
- **Daemon-ы:** нет
- **Платформа:** Bun + Elysia 1.3.5 + Mongoose 8.16.4

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Каждый span — синхронный (`withTraceSync`) или асинхронный (`withTraceAsync`).
Слева → справа порядок появления. Все литеральные имена — `reactions.<layer>.<op>`.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|--------------|----------|-------|
| `reactions.init.main` | `src/index.ts` (через `tracer.startActiveSpan`) | всё время старта | всё ниже | Корневой span запуска. Оборачивает `createApp`. |
| `reactions.init.repositories_plugin` | `src/app.ts` (через `withTraceAsync`) | ~MongoDB connect + создание репо | все дочерние ниже | Плагин репозиториев: MongoDB + инстанс |
| `reactions.init.repositories.reaction` | `src/plugins/repositories.plugin.ts` (через `withTraceSync`) | <1ms | — | `new ReactionRepository()` |
| `reactions.init.repositories_plugin.mongoose` | `src/plugins/repositories.plugin.ts` (через `withTraceAsync`) | ~2-5s (сеть) | — | `mongoose.connect(mongoUri)`. Самый долгий span старта. `ctx.end()` зовётся в callback на `mongoose.connection.once('connected')`. |
| `reactions.init.repositories.plugin` | `src/plugins/repositories.plugin.ts` (через `withTraceSync`) | <1ms | — | Сборка Elysia-плагина: `.decorate("reactionRepository", ...)` + `.onStop()` |
| `reactions.init.services_plugin` | `src/app.ts` (через `withTraceSync`) | <1ms | `reactions.init.services.reactions`, `reactions.init.services.plugin` | Плагин сервисов |
| `reactions.init.services.reactions` | `src/plugins/services.plugin.ts` (через `withTraceSync`) | <1ms | — | `new ReactionsService(reactionRepository)` — DI одного репозитория |
| `reactions.init.services.plugin` | `src/plugins/services.plugin.ts` (через `withTraceSync`) | <1ms | — | Сборка Elysia-плагина: `.use(repositories)` + `.decorate("reactionsService", ...)` |
| `reactions.init.controllers_plugin` | `src/app.ts` (через `withTraceSync`) | <1ms | все 4 `controllers.<op>` + `controllers.plugin` | Плагин контроллеров — 4 роута |
| `reactions.init.controllers.set_reaction` | `src/plugins/controllers.plugin.ts` | <1ms | — | `setReactionController(servicesPlugin)` |
| `reactions.init.controllers.reset_reaction` | `src/plugins/controllers.plugin.ts` | <1ms | — | `resetReactionController(servicesPlugin)` |
| `reactions.init.controllers.get_entity_reactions` | `src/plugins/controllers.plugin.ts` | <1ms | — | `getEntityReactionsController(servicesPlugin)` |
| `reactions.init.controllers.get_reactions` | `src/plugins/controllers.plugin.ts` | <1ms | — | `getReactionsController(servicesPlugin)` |
| `reactions.init.controllers.plugin` | `src/plugins/controllers.plugin.ts` (через `withTraceSync`) | <1ms | — | Сборка Elysia-плагина контроллеров (4 `.use()`) |
| `reactions.init.elysia` | `src/app.ts` (через `withTraceSync`) | до `.listen()` callback | — | `new Elysia().use(...).listen()`. `ctx.end()` зовётся в `listen` callback. |

**Как читать в Tempo:** Ищи `reactions.init.main`. Если он `Status=OK` — сервис
поднят. Самый длинный дочерний = `repositories_plugin.mongoose`; если >5s —
проблемы с MongoDB.

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Дочерние | Зачем |
|-----------|---------------|-------|----------|-------|
| `reactions.stop.repositories_plugin` | `src/plugins/repositories.plugin.ts` (`.onStop()` через `withTraceAsync`) | SIGTERM/SIGINT → `app.stop()` | — | `mongoose.disconnect()`. Закрытие соединения с БД. |

**Как читать:** Если shutdown-span отсутствует — сервис упал (kill -9) или
`mongoose.disconnect()` не вызвался.

### 1.3. Runtime — бизнес-методы

Все 4 метода сервиса и 5 методов репозитория обёрнуты в `@TraceDecorator()`.
Имя спана = `camelToSnakeCase(className) + '.' + camelToSnakeCase(methodName)`
(вычисляется в `shared/monitoring/src/traceDecorator.ts`).

Атрибуты через `setSpanAttributes()` **не** проставляются — спаны попадают в
Tempo без дополнительных полей (см. §6 «Резюме состояния»).

#### `ReactionsService` — span prefix: reactions_service (snake_case)

| Span name | HTTP endpoint | Запросы к БД | Ошибки |
|-----------|---------------|--------------|--------|
| `reactions_service.set_reaction` | `POST /setReaction` | `ReactionRepository.create` | `MongoServerError: 11000` (duplicate key, уникальный индекс `{parentId, parentType, userId, reaction}`) |
| `reactions_service.reset_reaction` | `POST /resetReaction` | `ReactionRepository.delete` | `NotFoundError("Reaction", "<parentId>:<userId>:<reaction>")` (404) |
| `reactions_service.get_entity_reactions` | `POST /getEntityReactions` | `Promise.all`: `ReactionRepository.getEntityStats(parentId, parentType)` + (если `userId`) `ReactionRepository.getUserReaction(parentId, userId)` | — |
| `reactions_service.get_reactions` | `POST /getReactions` | `ReactionRepository.findAll(filter, sort, limit, offset)` (default sort `{createdAt:"desc"}`, default limit 100) | — |

**Замечание по `getReactions`:** фильтр `params.filter` принимает произвольный
JSON (`t.Record(t.String(), t.Any())`). Запросы без `parentId`/`userId` в фильтре
проходят как `findAll({})` — потенциально тяжёлые. См. чек-лист §5.

**Замечание по `getEntityReactions`:** ответ агрегируется параллельно
через `Promise.all`. Если `userId` не передан — `userReactions` отдаётся
как `[]` (второй `Promise` резолвится пустым массивом).

#### `ReactionRepository` — span prefix: reaction_repository

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `reaction_repository.create` | `ReactionsService.setReaction` | `ReactionModel.create(data).toObject()` | Бросает `MongoServerError: 11000` если уже есть (уникальный индекс). |
| `reaction_repository.delete` | `ReactionsService.resetReaction` | `ReactionModel.findOneAndDelete(data).lean()` | Бросает `NotFoundError("Reaction", "<parentId>:<userId>:<reaction>")` если null. |
| `reaction_repository.get_entity_stats` | `ReactionsService.getEntityReactions` | `ReactionModel.aggregate([{$match:{parentId,parentType}},{$group:{_id:"$reaction",count:{$sum:1}}}])` | Возвращает `Record<string,number>` (тип реакции → количество). |
| `reaction_repository.get_user_reaction` | `ReactionsService.getEntityReactions` (если `userId` задан) | `ReactionModel.find({parentId, userId}).lean()` | Возвращает массив документов (агрегация в сервисе → массив строк `r.reaction`). |
| `reaction_repository.find_all` | `ReactionsService.getReactions` | `ReactionModel.find(filter).sort(sort).skip(offset).limit(limit).lean()` | Defaults: `sort={createdAt:"desc"}`, `limit=100`, `offset=0`. Не бросает. |

### 1.4. Auto-instrumentation

Эти спаны создаются автоматически `@opentelemetry/instrumentation-*` —
никакого ручного кода. Настраивается в `monitoringPlugin` из
`shared/monitoring/src/monitoring.plugin.ts`.

| Тип | Инструмент | Какие спаны | Активно для reactions | Атрибуты |
|-----|-----------|-------------|----------------------|----------|
| HTTP | instrumentation-http | `POST /<endpoint>` (входящие) | **Да** | `http.status_code`, `http.target`, `http.service=reactions`, `service.name=reactions` |
| MongoDB | instrumentation-mongoose | `mongoose.Reaction.*` | **Нет** (см. `shared/monitoring/src/monitoring.plugin.ts:77` — `suppressInternalInstrumentation: true`) | `db.mongodb.collection`, `db.operation`, `db.statement` |
| Redis | instrumentation-ioredis | `redis-*` | **Нет** (reactions не использует Redis) | — |
| DNS | instrumentation-dns | `dns.lookup` | Да | — |
| FS | instrumentation-fs | `fs.*` | Да (Bun runtime) | — |
| Net | instrumentation-net | `net.*` | Да | — |
| Runtime | instrumentation-runtime-node | — (только метрики) | Да | — |
| RabbitMQ | instrumentation-amqplib | `publish` / `consume` | **Нет** (reactions не публикует и не консьюмит) | `messaging.rabbitmq.*` |

### 1.5. Дебаг: полная иерархия для `POST /setReaction`

Создание реакции пользователя на сущность:

```
POST /setReaction                                               ← HTTP auto-instr (http.service=reactions)
  └── reactions_service.set_reaction                            ← @TraceDecorator
        └── reaction_repository.create                          ← @TraceDecorator
```

**Где искать проблему:**
- `reactions_service.set_reaction` долгий (>100ms) — нет индексов под конкретные
  parentType; композитный уникальный `{parentId, parentType, userId, reaction}`
  ищется при `create`
- `reaction_repository.create` упал → `MongoServerError: 11000` (duplicate
  reaction)
- Нет `mongoose.Reaction.*` под `reaction_repository.create` → подавлено
  `suppressInternalInstrumentation: true` (см. §1.4)

### 1.6. Дебаг: `POST /getEntityReactions`

```
POST /getEntityReactions                                        ← HTTP auto-instr
  └── reactions_service.get_entity_reactions                    ← @TraceDecorator
        ├── reaction_repository.get_entity_stats                ← @TraceDecorator
        └── reaction_repository.get_user_reaction              ← @TraceDecorator (только если передан userId)
```

**Где искать проблему:** latency `reactions_service.get_entity_reactions` —
обе ветки выполняются параллельно, `get_entity_stats` использует `aggregate`
с `$match` по `{parentId, parentType}`. Без составного индекса
`{parentId:1, parentType:1}` (он есть в `src/models/entity/reaction.entity.ts:38`)
это будет collection scan.

### 1.7. Дебаг: `POST /resetReaction`

```
POST /resetReaction                                             ← HTTP auto-instr
  └── reactions_service.reset_reaction                          ← @TraceDecorator
        └── reaction_repository.delete                          ← @TraceDecorator
```

**Где искать проблему:** `reaction_repository.delete` упал с
`NotFoundError` → реакции не существует (либо уже удалена, либо был
неверный `parentType`/`userId`/`reaction`).

---

## 2. Логи

Все логи через `@LogDecorator` (уровень DEBUG при входе/выходе, WARN для
`AppError`, ERROR для прочих) + `ErrorHandlerPlugin` (ERROR для всех
непойманных). Прямых `logger.*` вызовов в коде сервиса нет — только в
`repositories.plugin.ts` (init/shutdown MongoDB).

### 2.1. Business-логи (методы `ReactionsService`)

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR при ошибке |
|-------|------------------|------------------|------------------------|
| `set_reaction` | `reactions_service.set_reaction — called` с `{data.parentId, data.userId, data.reaction}` | `— ok` | `— system_error` (duplicate key 11000) → ERROR |
| `reset_reaction` | `reactions_service.reset_reaction — called` с `{data.parentId, data.userId, data.reaction}` | `— ok` | `— failed` (`NotFoundError`) → WARN |
| `get_entity_reactions` | `reactions_service.get_entity_reactions — called` с `{params.parentId, params.parentType, params.userId}` | `— ok` | `— system_error` → ERROR |
| `get_reactions` | `reactions_service.get_reactions — called` с `{params}` (весь объект: `filter`, `sort`, `limit`, `offset`) | `— ok` | `— system_error` → ERROR |

**Замечание про `args: ['data.parentId', 'data.userId', 'data.reaction']`
для `setReaction`/`resetReaction`:** `@LogDecorator` извлекает nested-поля
через dot-path, поэтому в лог попадают только конкретные скаляры, а не
весь `data` (`parentType` намеренно не логируется). `parentId`/`userId` —
потенциальные PII в production (внешние идентификаторы пользователей).

**Замечание про `args: ['params']` для `getReactions`:** логируется **весь**
объект `params`, включая `filter` (произвольный JSON). Если клиент передаёт
в `filter` чувствительные поля (другие `userId`, токены и т.п.) — они
попадут в Loki. В production с чувствительными данными это надо учитывать
при настройке retention/scrub в Loki.

**Дублирование логов для `AppError`:** Когда сервис бросает `NotFoundError`
(через `reaction_repository.delete`), происходит:
1. `@LogDecorator` пишет `— failed` → WARN
2. `ErrorHandlerPlugin` ловит ошибку в `onError` → пишет `[NOT_FOUND_ERROR] ...` → **ERROR**

То есть одна и та же ожидаемая 4xx-ошибка логируется **дважды** с разными
уровнями (поведение shared-пакета; см. `rwa-observability-docs` §6).

**Как читать:**
- `— called` → операция началась (с аргументами)
- `— ok` → операция завершена успешно
- `— failed` → ожидаемая бизнес-ошибка (`NotFoundError`)
- `— system_error` → неожиданная ошибка (смотреть `stack`)

### 2.2. ErrorHandlerPlugin — автоматические логи

Любая ошибка, не пойманная вручную в контроллере:

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` (напр. `NotFoundError`) | `logger.error` (всегда ERROR, не WARN) | `[<error.code>] <error.message>` | `{statusCode, path, details, stack}` |
| Любая другая ошибка | `logger.error` | `Unexpected error:` | `{path, error: "<Name>: <message>"}` |

**Как читать:** Все 4xx → ERROR с `statusCode` в логах (через handler) и
WARN с `error.message` (через `@LogDecorator`). 5xx → ERROR (handler).
На практике для `AppError` получается дублирование — поведение
shared-пакета.

### 2.3. Init/shutdown логи

| Когда | Уровень | Сообщение | Атрибуты |
|-------|---------|-----------|----------|
| Connect start | `info` | `Connecting to MongoDB` | — |
| Connect success | `info` | `MongoDB connected successfully` | — |
| Disconnect start | `info` | `Disconnecting from MongoDB` | — |
| Disconnect success | `info` | `MongoDB disconnected successfully` | — |

`mongoUri` не логируется — credentials защищены (см. `repositories.plugin.ts`,
init-блок логирует только статические строки).

---

## 3. Метрики

Все метрики префиксируются `SERVICE_NAME=reactions` (формируется в
`shared/monitoring/src/metrics.ts`).

Создаются через `@MetricsDecorator()` на 4 публичных методах
`ReactionsService` (counter `_total` + histogram `_duration`). На
репозитории декоратора нет — latency БД недоступна через Prometheus из-за
`suppressInternalInstrumentation: true` (см. §1.4).

### 3.1. Business метрики (`@MetricsDecorator`)

`Prometheus` имя = `SERVICE_NAME + _ + <class_snake> + _ + <method_snake> + _ + total|duration`.
Для `ReactionsService` это даёт характерное **удвоение префикса**:
`reactions_reactions_service_<method>_total` (snake_case от `ReactionsService` =
reactions_service, плюс reactions_ от `SERVICE_NAME`).

| Prometheus имя | Тип | Labels | Когда инкрементится | Зачем |
|---------------|-----|--------|---------------------|-------|
| `reactions_reactions_service_set_reaction_total` | Counter | `result=success\|error` | Каждый вызов `setReaction` | Поставленные реакции (включая дубли — `11000` тоже `error`) |
| `reactions_reactions_service_set_reaction_duration` | Histogram | — | Каждый вызов `setReaction` | Латентность |
| `reactions_reactions_service_reset_reaction_total` | Counter | `result=success\|error` | Каждый вызов `resetReaction` | Снятые реакции (включая попытки снять несуществующую — `NotFoundError`) |
| `reactions_reactions_service_reset_reaction_duration` | Histogram | — | Каждый вызов `resetReaction` | Латентность |
| `reactions_reactions_service_get_entity_reactions_total` | Counter | `result=success\|error` | Каждый вызов `getEntityReactions` | Запросы агрегата реакций сущности |
| `reactions_reactions_service_get_entity_reactions_duration` | Histogram | — | Каждый вызов `getEntityReactions` | Латентность (включает параллельный `Promise.all`) |
| `reactions_reactions_service_get_reactions_total` | Counter | `result=success\|error` | Каждый вызов `getReactions` | Запросы списка реакций по произвольному фильтру |
| `reactions_reactions_service_get_reactions_duration` | Histogram | — | Каждый вызов `getReactions` | Латентность |

**Замечание про удвоение `reactions_reactions_service_*`:** это конвенция
платформы (`SERVICE_NAME=reactions` + snake_case `ReactionsService` =
reactions_service). Prometheus-имя валидно (только snake_case), но
визуально выглядит как дублирование. Применимо к любому сервису, где
`SERVICE_NAME` совпадает с snake_case class-name (`auth`+`AuthService`,
`blog`+`BlogService` и т.п.).

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `instrumentation-runtime-node` | CPU, memory, event loop lag, GC |
| `http_server_duration` | HTTP auto-instr | RPS, latency per endpoint, status codes |
| `db_client_operations_duration` | MongoDB auto-instr | **Не поступает** — `suppressInternalInstrumentation: true` (см. §1.4) |

**Как читать:**
- `process_runtime_node_event_loop_lag_seconds` — загружен ли event loop
- `http_server_duration{http_target="/setReaction"}` — latency конкретного endpoint
- `db_client_operations_duration{db_mongodb_collection="Reaction"}` — **не работает** для reactions

### 3.3. Примеры PromQL

```promql
# Ошибки на любую операцию reactions за 5 минут
sum by(http_target) (
  rate(reactions_reactions_service_set_reaction_total{result="error"}[5m])
  or rate(reactions_reactions_service_reset_reaction_total{result="error"}[5m])
  or rate(reactions_reactions_service_get_entity_reactions_total{result="error"}[5m])
  or rate(reactions_reactions_service_get_reactions_total{result="error"}[5m])
)

# P99 latency создания реакции
histogram_quantile(0.99, rate(reactions_reactions_service_set_reaction_duration_bucket[5m]))

# Сколько реакций поставлено за сутки
increase(reactions_reactions_service_set_reaction_total{result="success"}[24h])

# Доля дубликатов при set_reaction (MongoServerError 11000)
sum(rate(reactions_reactions_service_set_reaction_total{result="error"}[1h]))
  /
sum(rate(reactions_reactions_service_set_reaction_total[1h]))

# P99 latency get_entity_reactions
histogram_quantile(0.99, rate(reactions_reactions_service_get_entity_reactions_duration_bucket[5m]))

# RPS по операциям
sum(rate(reactions_reactions_service_get_reactions_total[1h]))
```

---

## 4. Health-check

### `GET /health`

Не трейсится (нет декораторов, нет авто-инструментации для health plugin —
быстрый ответ). Возвращает JSON со `status: ok`, `timestamp`, `uptime`,
`service: reactions` (см. `shared/monitoring/src/health.plugin.ts`).

**Как читать:** Если `/health` не отвечает — сервис не стартанул.
Используется в Docker Compose healthcheck и Uptime Kuma
(`infrastructure/docker/uptime-kuma/uptime-kuma-import.json:1253`).

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует | docker logs — ошибка в init-фазе (MongoDB URI, REACTIONS_SERVICE_NAME) |
| `resetReaction` возвращает 404 | Span `reaction_repository.delete` — ищи `NOT_FOUND_ERROR` в логах (WARN от `@LogDecorator` + ERROR от `ErrorHandlerPlugin`) |
| `setReaction` падает на дубликате | `reactions_reactions_service_set_reaction_total{result="error"}`. Лог `reactions_service.set_reaction — system_error` (ERROR) + `[MongoServerError]` стек. Уникальный индекс `{parentId, parentType, userId, reaction}` (`src/models/entity/reaction.entity.ts:39`) |
| `getEntityReactions` долго работает | `reactions_reactions_service_get_entity_reactions_duration`. Два параллельных репо-спана: `get_entity_stats` (`aggregate`) + `get_user_reaction` (`find`). `aggregate` использует индекс `{parentId:1, parentType:1}` (entity:38) |
| `getReactions` падает на большом filter | Произвольный `filter` без селективных полей → `findAll({})` без индексов. Дефолтный `limit=100` спасает, но offset-скан на больших коллекциях медленный. Доступные индексы: `parentId`, `parentType`, `userId`, `reaction`, `{parentId,parentType}`, `{parentId,parentType,userId,reaction}` |
| В Tempo отфильтровать операции по конкретной сущности/пользователю | **`setSpanAttributes` НЕ вызывается** — фильтровать по `parentId`/`userId` через атрибуты span'а **нельзя**. Искать через полнотекст в `body` запроса (не трейсится) или через Loki по `reactions_service.* — called` логам |
| Метрик нет в Prometheus | Проверить `SERVICE_NAME=reactions`, target status, экспортёр Alloy |
| Логи не идут в Loki | Проверить `OTEL_EXPORTER_OTLP_ENDPOINT`, Alloy health |
| Дублирование 4xx в логах (WARN + ERROR) | Поведение shared-пакета: `@LogDecorator` пишет WARN, `ErrorHandlerPlugin` пишет ERROR |
| Аггрегация по сущности даёт странные числа | `reaction_repository.get_entity_stats` группирует по полю `reaction` (строка, а не enum). Если `reaction` пустая строка или `null` — попадёт в общий ключ |

---

## 6. Резюме состояния production-readiness

| Аспект | Статус | Комментарий |
|--------|--------|-------------|
| Init-спаны (`reactions.init.*`) | OK | 16 спанов, корневой `reactions.init.main` |
| Shutdown-span | OK | `reactions.stop.repositories_plugin` |
| HTTP auto-instr | OK | `instrumentation-http` работает |
| `@TraceDecorator` на 4 методах сервиса | OK | Полное покрытие |
| `@TraceDecorator` на 5 методах репо | OK | Полное покрытие |
| `@MetricsDecorator` на 4 методах сервиса | OK | 8 метрик (counter+histogram × 4) |
| `@LogDecorator` на 4 методах сервиса | OK | Покрытие |
| `setSpanAttributes` для фильтрации в Tempo | **НЕ реализовано** | Все 4 метода `ReactionsService` создают спаны без атрибутов — фильтрация в Tempo по `parentId`/`userId`/`reaction` невозможна |
| Документация (этот файл) | OK | Создана |
| Health-check | OK | `GET /health` |
| Uptime Kuma integration | OK | `infrastructure/docker/uptime-kuma/uptime-kuma-import.json:1253` |
| Graceful shutdown | OK | SIGTERM/SIGINT → `app.stop()` → `mongoose.disconnect()` |
| Credentials в логах | OK | `mongoUri` не логируется |
| `console.*` в коде | OK | Отсутствуют |
| `throw new Error` для бизнес-ошибок | OK | Единственная доменная ошибка — `NotFoundError` (через репозиторий), все 4 публичных метода сервиса не бросают `new Error` |
