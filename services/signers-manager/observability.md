# Signers-Manager — Observability Reference

Менеджер задач на подписание транзакций для signer-1/2/3. Создаёт `SignatureTask`,
отправляет запросы подписания через RabbitMQ (exchange `sign.exchange`),
принимает ответы от signer-ов из очереди `sign.responses`, агрегирует подписи
(`Signature`) до достижения `requiredSignatures`, помечает таску `completed`.

**Технологии:** Bun + Elysia.js, Mongoose (MongoDB), amqplib (RabbitMQ),
OpenTelemetry (OTLP).

**SERVICE_NAME:** `signers-manager` (env `SIGNERS_MANAGER_SERVICE_NAME`)
**SERVICE_VERSION:** `1.0.0` (env `SIGNERS_MANAGER_SERVICE_VERSION`)

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `signers-manager.init.main` | `index.ts` | ~всё время старта | всё ниже | Корневой span процесса |
| `signers-manager.init.repositories_plugin` | `app.ts` | ~init репозиториев + MongoDB connect | `.repositories.signature`, `.repositories.signature_task`, `.repositories_plugin.mongoose`, `.repositories.plugin` | Сборка репозиториев и подключение к MongoDB |
| `signers-manager.init.repositories.signature` | `plugins/repositories.plugin.ts` | < 5 ms | — | Инстанцирование `SignatureRepository` |
| `signers-manager.init.repositories.signature_task` | `plugins/repositories.plugin.ts` | < 5 ms | — | Инстанцирование `SignatureTaskRepository` |
| `signers-manager.init.repositories_plugin.mongoose` | `plugins/repositories.plugin.ts` | ~MongoDB TCP+handshake | — | `mongoose.connect(mongoUri)`. Завершается по событию `'connected'` |
| `signers-manager.init.repositories.plugin` | `plugins/repositories.plugin.ts` | < 5 ms | — | Elysia-плагин `Repositories` |
| `signers-manager.init.clients_plugin` | `app.ts` | ~init всех клиентов | спаны `clients.*` | Обёртка сборки clients-слоя |
| `signers-manager.init.clients.rabbitmq` | `plugins/clients.plugin.ts` | < 5 ms | — | `new RabbitMQClient(...)` |
| `signers-manager.init.clients.rabbitmq_connect` | `plugins/clients.plugin.ts` | ~AMQP handshake | — | `rabbitMQClient.connect()` |
| `signers-manager.init.clients.signer` | `plugins/clients.plugin.ts` | < 5 ms | — | `new SignerClient(rabbitMQClient)` |
| `signers-manager.init.clients.signer_initialize` | `plugins/clients.plugin.ts` | ~setupExchange + setupQueue | — | Декларация exchange `sign.exchange` (fanout, durable) и очереди `sign.responses` (durable, TTL 1h) |
| `signers-manager.init.clients.plugin` | `plugins/clients.plugin.ts` | < 5 ms | — | Elysia-плагин `Clients` |
| `signers-manager.init.services_plugin` | `app.ts` | ~init сервиса | `.services.signatures`, `.services.plugin` | Сборка services-слоя |
| `signers-manager.init.services.signatures` | `plugins/services.plugin.ts` | < 5 ms | — | `new SignaturesService(signatureRepository, signatureTaskRepository, signerClient)` |
| `signers-manager.init.services.plugin` | `plugins/services.plugin.ts` | < 5 ms | — | Elysia-плагин `Services` |
| `signers-manager.init.controllers_plugin` | `app.ts` | ~init контроллеров | спаны `controllers.*` | Сборка controllers-слоя |
| `signers-manager.init.controllers.create_signature_task` | `plugins/controllers.plugin.ts` | < 5 ms | — | `createSignatureTaskController(servicesPlugin)` |
| `signers-manager.init.controllers.get_signature_task` | `plugins/controllers.plugin.ts` | < 5 ms | — | `getSignatureTaskController(servicesPlugin)` |
| `signers-manager.init.controllers.plugin` | `plugins/controllers.plugin.ts` | < 5 ms | — | Elysia-плагин `Controllers` |
| `signers-manager.init.daemons_plugin` | `app.ts` | ~init daemon (consume start) | спаны `daemons.*` | Сборка daemons-слоя |
| `signers-manager.init.daemons.task_responses` | `plugins/daemons.plugin.ts` | < 5 ms | — | `new TaskResponsesDaemon(signerClient, signaturesService)` |
| `signers-manager.init.daemons.initialize` | `plugins/daemons.plugin.ts` | ~consume start | `task_responses_daemon.initialize` | `daemon.initialize()` (consume + bind handler); лог `logger.info("Task responses daemon started successfully")` |
| `signers-manager.init.daemons.plugin` | `plugins/daemons.plugin.ts` | < 5 ms | — | Elysia-плагин `Daemons` |
| `signers-manager.init.elysia` | `app.ts` | ~listen | — | Финальный `new Elysia().use(...).listen(port)` |

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `signers-manager.stop.repositories_plugin` | `plugins/repositories.plugin.ts` (`.onStop()`) | `app.stop()` → SIGTERM/SIGINT | `mongoose.disconnect()` + логи подключения/отключения |
| `signers-manager.stop.clients` | `plugins/clients.plugin.ts` (`.onStop()`) | `app.stop()` | `rabbitMQClient.disconnect()` |

> **Примечание:** для `daemons` (TaskResponsesDaemon) `.onStop()` не зарегистрирован
> в `plugins/daemons.plugin.ts` — это известное расхождение, см. секцию «Критические
> gap'ы» в финальном ответе (НЕ в самой документе).

### 1.3. Runtime — бизнес-методы

#### `SignaturesService` (префикс `signatures_service`)

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `signatures_service.create_task` | нет (setSpanAttributes не вызывается — см. секцию «Критические gap'ы») | `POST /createSignatureTask` (controller `createSignatureTask`) | `signatureTaskRepository.create(...)`, `signerClient.sendSignatureTask(...)` → `rabbitClient.publish('sign.exchange', '', request)` (Amqplib auto-instr: `publish sign.exchange`) | `Error` от Mongoose (валидация, дубликат по `hash` unique-index), ошибка AMQP publish |
| `signatures_service.add_signature` | нет | вызывается из `TaskResponsesDaemon.handleResponse` (RabbitMQ consumer span) | `signatureTaskRepository.findById(...)`, `signatureRepository.create(...)`, `signatureRepository.countByTaskId(...)`, `signatureTaskRepository.update(...)` (если `isCompleted`) | `NotFoundError("SignatureTask", id)`; `Error("Task already completed")`; `Error("Task expired")` — последние два бросаются как `Error`, не `AppError` (см. секцию «Критические gap'ы») |
| `signatures_service.get_signature_task` | нет | `POST /getSignatureTask` (controller `getSignatureTask`) | `signatureTaskRepository.findById(...)`; `signatureRepository.findByTaskId(...)` (только если `task.completed`) | `NotFoundError("SignatureTask", id)` |

_Примечание: span name = camelToSnakeCase(ClassName) + '.' + camelToSnakeCase(method).
`setSpanAttributes()` НЕ вызывается в этом классе — это расхождение с конвенцией
rwa-observability §1.5, для дебага по конкретному taskId придётся искать через
AMQP-корреляцию или request-id из upstream._

#### `SignatureRepository` (префикс `signature_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `signature_repository.create` | `signaturesService.addSignature` | `SignatureEntity.create(...)` | Вставка одной подписи |
| `signature_repository.find_by_id` | — (метод определён, но в текущем `SignaturesService` не вызывается) | `SignatureEntity.findById(id).lean()` | Бросает `NotFoundError("Signature", id)` |
| `signature_repository.find_by_task_id` | `signaturesService.getSignatureTask` (если task completed) | `SignatureEntity.find({taskId}).sort({createdAt: 'asc'}).lean()` | Список всех подписей задачи |
| `signature_repository.count_by_task_id` | `signaturesService.addSignature` | `SignatureEntity.countDocuments({taskId})` | Используется для проверки `>= requiredSignatures` |
| `signature_repository.find_all` | — (служебный, не вызывается из текущего сервиса) | `SignatureEntity.find(filters).sort().skip().limit().lean()` | Пагинация, не используется в runtime |

#### `SignatureTaskRepository` (префикс `signature_task_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `signature_task_repository.create` | `signaturesService.createTask` | `SignatureTask.create(...)` | Создание задачи. Unique-index по `hash` → дубликат бросает Mongoose `MongoServerError` (E11000) |
| `signature_task_repository.update` | `signaturesService.addSignature` (если `isCompleted`) | `SignatureTask.findByIdAndUpdate(id, {completed: true}, {new: true}).lean()` | Бросает `NotFoundError("SignatureTask", id)` |
| `signature_task_repository.find_by_id` | `signaturesService.addSignature`, `signaturesService.getSignatureTask` | `SignatureTask.findById(id).lean()` | Бросает `NotFoundError("SignatureTask", id)` |
| `signature_task_repository.find_by_hash` | — (служебный, не вызывается из текущего сервиса) | `SignatureTask.findOne({hash}).lean()` | Бросает `NotFoundError("SignatureTask", "hash: ...")` |
| `signature_task_repository.find_all` | — (служебный, не вызывается из текущего сервиса) | `SignatureTask.find(filters).sort().skip().limit().lean()` | Пагинация, не используется в runtime |
| `signature_task_repository.find_active` | — (служебный, не вызывается из текущего сервиса) | `findAll({$or: [{expired: {$gt: now}}, {expired: {$exists: false}}]})` | Не используется в runtime |

#### `SignerClient` (префикс `signer_client`)

| Span name | Вызывается из | Сетевая операция | Примечание |
|-----------|---------------|-------------------|------------|
| `signer_client.initialize` | `clients.plugin.ts` (init) | `rabbitClient.setupExchange('sign.exchange', 'fanout', {durable: true})` + `setupQueue('sign.responses', {durable: true, arguments: {x-message-ttl: 3600000}})` | Один раз при старте |
| `signer_client.send_signature_task` | `signaturesService.createTask` | `rabbitClient.publish('sign.exchange', '', {hash, taskId, expired})` (fanout → всем signer-ам) | Amqplib auto-instr: `publish sign.exchange` со span-атрибутами `messaging.rabbitmq.exchange`, `messaging.rabbitmq.routing_key` |
| `signer_client.consume_responses` | `taskResponsesDaemon.initialize` | `rabbitClient.consume('sign.responses', handler, {noAck: false})` | Amqplib auto-instr: `consume sign.responses`. Каждое входящее сообщение порождает consumer-span (parent: producer sign.exchange publish, если signer-сервис propagate traceparent через headers) |
| `signer_client.ack_message` | `taskResponsesDaemon.handleResponse` (в success-ветке) | `rabbitClient.ack(msg)` | Amqplib auto-instr: ack-span |
| `signer_client.nack_message` | `taskResponsesDaemon.handleResponse` (в catch) | `rabbitClient.nack(msg, requeue=false)` | Используется `requeue=false` — «мёртвые» сообщения выбрасываются из очереди. Amqplib auto-instr: nack-span |

#### `TaskResponsesDaemon` (префикс `task_responses_daemon`)

| Span name | Вызывается из | Действия | Ошибки |
|-----------|---------------|----------|--------|
| `task_responses_daemon.initialize` | `daemons.plugin.ts` (init) | `signerClient.consumeResponses(this.handleResponse)` | Ошибка AMQP consume |
| `task_responses_daemon.handle_response` | RabbitMQ consumer `sign.responses` (parent: amqplib consume-span) | Парсит `JSON.parse(message.content)`, валидирует поля, вызывает `signaturesService.addSignature(...)`, в success — `signerClient.ackMessage(msg)`, в catch — `signerClient.nackMessage(msg, false)` | `Error("Invalid signature response format")` (пустые поля) — обрабатывается catch → nack; любая ошибка из `addSignature` (NotFoundError, Task already completed, Task expired) — nack; **catch проглатывает ошибку без `logger.error`/`logger.warn`** (см. секцию «Критические gap'ы») |

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты | Активен? |
|-----|-----------|-------------|----------|----------|
| HTTP | instrumentation-http | `POST /createSignatureTask`, `POST /getSignatureTask` (от Elysia-роутов) | `http.method`, `http.target`, `http.status_code`, `http.service` | ✅ |
| MongoDB | instrumentation-mongoose (с `suppressInternalInstrumentation: true`) | — (внутренние `mongoose.Collection.*` спаны подавлены; репозитории трейсятся вручную через `@TraceDecorator`) | — | ⚠️ Частично — auto-Span подавлены, ручные — активны |
| RabbitMQ | instrumentation-amqplib | `publish sign.exchange` (из `sendSignatureTask`); `consume sign.responses`; `ack`/`nack` | `messaging.rabbitmq.exchange`, `messaging.rabbitmq.routing_key` | ✅ |
| DNS | instrumentation-dns | `dns.lookup` (при MongoDB/AMQP TCP) | — | ✅ |
| FS | instrumentation-fs | `fs.*` (чтение `package.json`, `tsconfig.json` Bun runtime) | — | ✅ |
| Net | instrumentation-net | `net.*` (TCP connect к Mongo/AMQP) | — | ✅ |
| Runtime | instrumentation-runtime-node | — (только метрики: process_runtime_node_*) | — | ✅ |
| Redis | instrumentation-redis / ioredis | — | — | ❌ Redis-клиент не используется в этом сервисе |
| GraphQL | instrumentation-graphql | — | — | ❌ Отключён глобально (`enabled: false`) |

### 1.5. Дебаг: полная иерархия для «создать задачу и отправить в signer-ы»

```
POST /createSignatureTask                   ← HTTP auto-instr (Elysia)
  └── signatures_service.create_task        ← @TraceDecorator + @MetricsDecorator + @LogDecorator
        ├── signature_task_repository.create ← @TraceDecorator
        │     └── (mongoose auto-instr подавлен, но запрос виден в MongoDB profiler)
        └── amqplib publish sign.exchange   ← Amqplib auto-instr (producer span)
              ↳ fanout → signer-1, signer-2, signer-3
```

### 1.6. Дебаг: полная иерархия для «получить подпись от signer-а»

```
amqplib consume sign.responses              ← Amqplib auto-instr (consumer span, parent: producer от signer-а)
  └── task_responses_daemon.handle_response ← @TraceDecorator + @MetricsDecorator + @LogDecorator
        ├── signatures_service.add_signature ← @TraceDecorator + @MetricsDecorator + @LogDecorator
        │     ├── signature_task_repository.find_by_id
        │     ├── signature_repository.create
        │     ├── signature_repository.count_by_task_id
        │     └── signature_task_repository.update (если isCompleted)
        └── amqplib ack (success) / nack requeue=false (error)
```

---

## 2. Логи

### 2.1. Business-логи

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `signaturesService.createTask` | `signatures_service.create_task — called` с `{data: {ownerId, ownerType, hash, requiredSignatures, expired}}` | `signatures_service.create_task — ok` | `— failed` → WARN (если AppError); `— system_error` → ERROR (если Mongoose/AMQP-ошибка) |
| `signaturesService.addSignature` | `signatures_service.add_signature — called` с `{taskId: data.taskId, signer: data.signer}` (signature в лог не уходит — dot-нотация вытаскивает только перечисленные поля) | `signatures_service.add_signature — ok` | `— failed` → WARN (NotFoundError от репозиториев); `— system_error` → ERROR (бизнес-ошибки «Task already completed» / «Task expired» бросаются как `Error`, а не `AppError`, поэтому попадут в `system_error`, а не в `failed`) |
| `signaturesService.getSignatureTask` | `signatures_service.get_signature_task — called` с `{taskId}` | `signatures_service.get_signature_task — ok` | `— failed` → WARN (NotFoundError) |
| `taskResponsesDaemon.handleResponse` | `task_responses_daemon.handle_response — called` с `{message?.fields?.routingKey}` | `task_responses_daemon.handle_response — ok` | `— failed` → WARN / `— system_error` → ERROR (от LogDecorator), **но catch в `handleResponse` сам не логирует** — только nack без следа в логах кроме того, что пишет LogDecorator поверх переброшенной ошибки |

> **Замечание про PII:** `data` в `createTask` содержит `hash` подписываемого сообщения —
> это не секрет (хеш публичен on-chain), но при желании можно сузить до `['data.hash', 'data.requiredSignatures']`,
> если потребуется. На текущий момент логируется целиком `data`.

> **Замечание про `addSignature`:** аргумент `data.signature` (сама подпись) НЕ логируется —
> в `args: ["data.taskId", "data.signer"]` поле `signature` отсутствует намеренно.

### 2.2. ErrorHandlerPlugin

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `error instanceof AppError` (NotFoundError из репозиториев) | `logger.error` | `[<code>] <message>` (например `[NOT_FOUND] SignatureTask <id> not found`) | `{statusCode, path: request.url, details, stack}` |
| Любая другая ошибка (включая `Error("Task already completed")`, `Error("Task expired")`, `Error("Invalid signature response format")`, Mongoose/MongoDB-ошибки, AMQP-ошибки) | `logger.error` | `Unexpected error:` | `{path: request.url, error: "<ErrorName>: <message>"}` |

> **Важно:** в `ErrorHandlerPlugin` (см. `shared/errors/error-handler.plugin.ts`) и `AppError`,
> и прочие ошибки логируются через `logger.error`. Слово «WARN» в колонке про AppError
> относится только к декоратору `@LogDecorator`, а не к error-handler. Это соответствует
> конвенции (см. anti-pattern в rwa-observability-docs §6).

### 2.3. Прямые вызовы `logger.*` в коде сервиса

| Файл | Уровень | Сообщение | Контекст |
|------|---------|-----------|----------|
| `plugins/repositories.plugin.ts` | `info` | `Connecting to MongoDB` | `{uri: mongoUri}` |
| `plugins/repositories.plugin.ts` | `info` | `MongoDB connected successfully` | — (по событию `mongoose.connection.once('connected')`) |
| `plugins/repositories.plugin.ts` (onStop) | `info` | `Disconnecting from MongoDB` | — |
| `plugins/repositories.plugin.ts` (onStop) | `info` | `MongoDB disconnected successfully` | — |
| `plugins/daemons.plugin.ts` | `debug` | `Initializing daemons` | — |
| `plugins/daemons.plugin.ts` | `info` | `Task responses daemon started successfully` | — |

---

## 3. Метрики

### 3.1. Business метрики

Все метрики именуются как `<SERVICE_NAME>_<class_snake>_<method_snake>_{total|duration}`
и автоматически получают префикс `signers-manager_` от `OTelMetrics` (см.
`shared/monitoring/src/metrics.ts:16`).

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `signers-manager_signatures_service_create_task_total` | Counter | `result=success\|error` | Каждый вызов `signaturesService.createTask` | Сколько задач создано (с разбивкой success/error) |
| `signers-manager_signatures_service_create_task_duration` | Histogram | — | Каждый вызов | Латентность (включает Mongo insert + AMQP publish) |
| `signers-manager_signatures_service_add_signature_total` | Counter | `result=success\|error` | Каждый вызов `signaturesService.addSignature` | Сколько подписей добавлено (включая nack-ветки как error) |
| `signers-manager_signatures_service_add_signature_duration` | Histogram | — | Каждый вызов | Латентность (4 последовательных Mongo-запроса) |
| `signers-manager_signatures_service_get_signature_task_total` | Counter | `result=success\|error` | Каждый вызов `signaturesService.getSignatureTask` | Сколько раз запрашивали задачу |
| `signers-manager_signatures_service_get_signature_task_duration` | Histogram | — | Каждый вызов | Латентность |
| `signers-manager_task_responses_daemon_handle_response_total` | Counter | `result=success\|error` | Каждое входящее сообщение из `sign.responses` | Сколько ответов от signer-ов обработано. `error` включает: invalid format, task already completed, task expired, NotFoundError |
| `signers-manager_task_responses_daemon_handle_response_duration` | Histogram | — | Каждое сообщение | Латентность обработки одного ответа |

> **Прямых `metrics.counter/gauge/histogram` вызовов в коде сервиса нет** — все метрики
> идут через `@MetricsDecorator()`. Кастомных (без декоратора) метрик нет.

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | runtime-node | CPU, memory, event loop lag, GC |
| `http.server.*` | HTTP auto-instr | RPS, latency, status codes для `POST /createSignatureTask`, `POST /getSignatureTask` |
| `db.client.*` | MongoDB auto-instr | Количество запросов, latency (внимание: в коде `suppressInternalInstrumentation: true` для mongoose — спаны подавлены, но `db.client.*` метрики могут быть) |
| `messaging.client.*` | amqplib auto-instr | Publish/consume операции с `sign.exchange` / `sign.responses` |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |

### 3.3. Примеры PromQL

```promql
# Ошибки обработки ответов от signer-ов (5m rate)
rate(signers_manager_task_responses_daemon_handle_response_total{result="error"}[5m])

# P99 латентность создания задачи (включает AMQP publish)
histogram_quantile(0.99, rate(signers_manager_signatures_service_create_task_duration_bucket[5m]))

# Количество созданных задач за сутки
increase(signers_manager_signatures_service_create_task_total{result="success"}[24h])

# Сколько подписей приходит от signer-ов в секунду
rate(signers_manager_signatures_service_add_signature_total[1m])
```

---

## 4. Health-check

`GET /health` — стандартный из `@shared/monitoring/src/health.plugin.ts`,
проверяет базовую живость процесса. Кастомных healthcheck-ов (Mongo ping, AMQP
channel state) в этом сервисе не реализовано.

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Задача создаётся, но signer-ы не получают запрос | Span `signatures_service.create_task` → дочерний Amqplib `publish sign.exchange` (есть ли вообще?). Проверить логи RabbitMQ, что exchange `sign.exchange` (fanout) существует и к нему привязаны очереди signer-1/2/3 |
| Signer-ы присылают ответ, но `Signature` не появляется в Mongo | Span `task_responses_daemon.handle_response` — какой результат (`result=success/error` в метрике)? Если error — какой именно (NotFoundError, Task already completed, Task expired, invalid format)? |
| `addSignature` падает с `Task already completed` | Бизнес-ошибка: signer прислал подпись, когда задача уже помечена completed другим signer-ом ранее. Это нормальная race, но частота должна быть низкой. Смотреть rate `add_signature_total{result="error"}` |
| Метрики `add_signature_duration` аномально высокие | 4 последовательных Mongo-запроса в `addSignature`. Проверить индексы: `signatures.taskId`, `signatures.{taskId, signer}` (unique), `signature_tasks._id` |
| `create_task_total{result="error"}` растёт | Скорее всего E11000 duplicate key по `hash` (unique-index). Задача с таким `hash` уже создана — это может быть retry от upstream. Проверить по `data.hash` в DEBUG-логах `create_task` |
| Сервис не стартует | `signers-manager.init.repositories_plugin.mongoose` (timeout connect) или `signers-manager.init.clients.rabbitmq_connect` (AMQP handshake). Оба дочерние от `init.main` |
| `sign.responses` не доходят до handler | Проверить `signers-manager.init.daemons.initialize` — был ли успешный `consume` start. Если RabbitMQ-сервер перезапустился и потерял consumer — нужен reconnect (в текущей реализации `RabbitMQClient` отвечает за это, но не документировано в этом сервисе) |
