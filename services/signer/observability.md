# Signer Service — Observability Reference

Подписант блокчейн-транзакций. Получает задания из RabbitMQ (от
`signers-manager`), подписывает через ethers.js `Wallet` и отправляет
подпись обратно в очередь `sign.responses`. Не имеет HTTP-роутов и MongoDB —
работает исключительно через AMQP. Целевая сеть — BSC Testnet (chainId 97).

`SERVICE_NAME=signer-1` / `signer-2` / `signer-3` (один и тот же код
развёрнут в трёх инстансах; все три видны в `infrastructure/docker/docker-compose.yml`).
Все метрики и трейсы префиксируются именем конкретного инстанса —
`signer-1_*`, `signer-2_*`, `signer-3_*` — что даёт раздельную
видимость per-instance в Prometheus/Tempo.

**Защищённый сервис:** приватный ключ (`SIGNER_PRIVATE_KEY`) читается
из ENV в `index.ts`, пробрасывается в `SignatureService` через
`createServicesPlugin` и существует **только** в памяти процесса как
`Wallet.privateKey` (ethers.js). В коде **нет** логирования/трейсинга
приватного ключа — `@LogDecorator({ args: [...] })` явно выбирает только
безопасные поля (`hash`, `taskId`, `expired`, `message`).

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Старт сервиса. Каждый span — синхронный (`withTraceSync`) или асинхронный
(`withTraceAsync`). Слева → справа порядок выполнения.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `signer.init.main` | `index.ts:5` | ~всё время старта | всё ниже | Корневой span всего запуска. Оборачивает `createApp`. |
| `signer.init.clients_plugin` | `app.ts:17` | ~AMQP connect + setupExchange + assertQueue + bindQueue + setupQueue | `signer.init.clients.rabbitmq`, `signer.init.clients.signers_manager`, `signer.init.clients.initialize`, `signer.init.clients.plugin` | Плагин клиентов: создание `RabbitMQClient` + `SignersManagerClient` + инициализация exchange/queues |
| `signer.init.clients.rabbitmq` | `clients.plugin.ts:12` | <10ms | — | `new RabbitMQClient(...)` — фабрика AMQP-клиента (без сетевого подключения) |
| `signer.init.clients.signers_manager` | `clients.plugin.ts:21` | <1ms | — | `new SignersManagerClient(rabbitMQClient)` — конструктор без сетевых вызовов |
| `signer.init.clients.initialize` | `clients.plugin.ts:26` | ~connect + setup | `signers_manager_client.initialize` (auto) | `rabbitMQClient.connect()` + `signersManagerClient.initialize()` (setupExchange → assertQueue → bindQueue → setupQueue). Самый долгий span старта. |
| `signer.init.clients.plugin` | `clients.plugin.ts:36` | <1ms | — | Сборка Elysia-плагина: `.decorate("rabbitMQClient"...)` + `.decorate("signersManagerClient"...)` + `.onStop()` |
| `signer.init.services_plugin` | `app.ts:22` | <1ms | `signer.init.services.signature`, `signer.init.services.plugin` | Плагин сервисов: создание `SignatureService` с приватным ключом из ENV |
| `signer.init.services.signature` | `services.plugin.ts:10` | <5ms | — | `new SignatureService(signersManagerClient, privateKey)` — `new Wallet(privateKey)` в конструкторе |
| `signer.init.services.plugin` | `services.plugin.ts:18` | <1ms | — | Сборка Elysia-плагина: `.decorate("signatureService", ...)` |
| `signer.init.daemons_plugin` | `app.ts:27` | ~consume setup | `signer.init.daemons.signature`, `signer.init.daemons.initialize`, `signer.init.daemons.plugin` | Плагин демонов: создание `SignatureDaemon` + подписка на очередь |
| `signer.init.daemons.signature` | `daemons.plugin.ts:8` | <1ms | — | `new SignatureDaemon(signersManagerClient, signatureService)` |
| `signer.init.daemons.initialize` | `daemons.plugin.ts:16` | ~consume subscribe | `signature_daemon.initialize` (auto) | `signatureDaemon.initialize()` → `signersManagerClient.consumeRequests(...)` + `signatureDaemon.start()` |
| `signer.init.daemons.plugin` | `daemons.plugin.ts:26` | <1ms | — | Сборка Elysia-плагина: `.decorate("signatureDaemon", ...)` + `.onStop()` |
| `signer.init.elysia` | `app.ts:32` | ~до `.listen()` callback | — | `new Elysia().use(...).listen()`. Ждёт listen callback. |

**Как читать в Tempo:** Ищи `<SERVICE_NAME>.init.main`. Если он успешен
(Status=OK), сервис поднят и подписался на очередь. Самый длинный дочерний
span = `clients.initialize` — если он >5s, проблема с RabbitMQ
(хост недоступен / неверный URL / нет прав на `setupExchange`).

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Дочерние | Зачем |
|-----------|---------------|-------|----------|-------|
| `signer.stop.clients` | `clients.plugin.ts:42` | `.onStop()` (Elysia graceful shutdown) | `rabbitmq.disconnect` (auto, amqplib) | `rabbitMQClient.disconnect()` — закрытие AMQP-соединения |
| `signer.stop.daemons` | `daemons.plugin.ts:32` | `.onStop()` (Elysia graceful shutdown) | — | `signatureDaemon.stop()` — перевод флага `isRunning = false` |

**Как читать:** Если shutdown-span'ы отсутствуют — сервис убит
(`kill -9`) или Elysia graceful shutdown не отработал. В этом случае
RabbitMQ-соединение закрывается со стороны брокера по таймауту.

### 1.3. Runtime — бизнес-методы

Создаются через `@TraceDecorator()`. Имя спана = `<snake_class_name>.<snake_method_name>`.

**Атрибуты на спаны НЕ ставятся явно** (`setSpanAttributes` в коде
отсутствует) — поиск конкретного сообщения в Tempo ведётся через
auto-instrumentation amqplib (см. §1.4), где в `messaging.*` атрибутах
попадают `routing_key`, `exchange` и пр.

#### SignatureService (префикс `signature_service`)

| Span name | Атрибуты span | Откуда вызывается | Сетевые вызовы | Ошибки |
|-----------|--------------|-------------------|----------------|--------|
| `signature_service.sign_hash` | — (нет `setSpanAttributes`) | `signature_daemon.handle_signature_request` | `this.wallet.signMessage(...)` (локально, без сети), `signers_manager_client.send_signature` → `rabbitmq_client.send_to_queue("sign.responses", ...)` | `Error("Task expired")` если `expired < now` |

> **Не задокументировано (по конвенции §5):** сигнатура метода `get_signer_address`
> (camelToSnake: `get_signer_address`) — простой getter без `@TraceDecorator`
> (`getSignerAddress(): string { return this.wallet.address; }`). Спан не
> создаётся, метрика не считается. Метод в текущем runtime никем не вызывается
> (нет HTTP/AMQP хендлеров, его использующих) — потенциальный dead code.

**КРИТИЧНО по безопасности:** `signature_service.sign_hash` логирует
через `@LogDecorator({ args: ['hash', 'taskId', 'expired'] })` —
**только** эти три поля. Ни `this.wallet`, ни `privateKey`, ни
`signature` не попадают в логи и в span-атрибуты.

#### SignatureDaemon (префикс `signature_daemon`)

| Span name | Атрибуты span | Откуда вызывается | Сетевые вызовы | Ошибки |
|-----------|--------------|-------------------|----------------|--------|
| `signature_daemon.initialize` | — | Elysia `onStart` → `daemons.plugin.ts:20` | `signers_manager_client.consume_requests(...)` → `rabbitmq_client.consume(...)` (subscribe на `sign.exchange` через auto-generated queue) | `Error("Requests queue not initialized")` если `requestsQueue === null`; любые ошибки AMQP пробрасываются |
| `signature_daemon.handle_signature_request` | — (нет `setSpanAttributes`) | amqplib consumer callback (через `signersManagerClient.consumeRequests(handler)`) | внутри: `signature_service.sign_hash` → AMQP `send_to_queue("sign.responses")`; снаружи: `signers_manager_client.ack_message` / `nack_message` | `Error("Invalid signature request format: missing required fields")`, `Error("Invalid hash format: must be 32-byte hex string with 0x prefix")`, `Error("Task expired")` — все ловятся в `catch`, после чего вызывается `nackMessage(message, true)` для requeue |
| `signature_daemon.start` | — | `daemons.plugin.ts:21` | — | — (только флаг `isRunning = true`) |
| `signature_daemon.stop` | — | `.onStop()` → `daemons.plugin.ts:36` | — | — (только флаг `isRunning = false`) |

**Семантика ошибок в `handle_signature_request`:** бизнес-ошибки
(bad hash format / task expired / missing fields) НЕ пробрасываются
наверх — `catch` делает `nackMessage(message, true)` (requeue) и
сообщение уходит обратно в очередь. Это значит, что в Tempo span
`signature_daemon.handle_signature_request` будет со Status=OK даже
при невалидном сообщении (ошибка подавлена). Реальный сигнал —
рост `signer_signature_daemon_handle_signature_request_total`
при неизменном количестве успешных `sign.responses` в мониторинге
брокера.

#### SignersManagerClient (префикс `signers_manager_client`)

| Span name | Вызывается из | AMQP операция | Примечание |
|-----------|---------------|---------------|------------|
| `signers_manager_client.initialize` | `daemons.plugin.ts` (через `clients.plugin.ts:31`) | `setupExchange("sign.exchange", "fanout", {durable:true})` + `channel.assertQueue("", {exclusive:true, autoDelete:true})` + `bindQueue(queue, exchange, "")` + `setupQueue("sign.responses", {durable:true, arguments:{"x-message-ttl":3600000}})` | Одноразовая настройка при старте |
| `signers_manager_client.send_signature` | `signature_service.sign_hash` | `rabbitmq_client.send_to_queue("sign.responses", {taskId, signer, hash, signature})` | Публикация ответа менеджеру. Сообщение содержит **только** результат подписи — приватный ключ НЕ передаётся через AMQP. |
| `signers_manager_client.consume_requests` | `signature_daemon.initialize` | `rabbitmq_client.consume(requestsQueue, handler, {noAck:false})` | Запуск consumer-цикла на auto-generated queue |
| `signers_manager_client.ack_message` | `signature_daemon.handle_signature_request` (success path) | `rabbitmq_client.ack(msg)` | Подтверждение успешно обработанного сообщения |
| `signers_manager_client.nack_message` | `signature_daemon.handle_signature_request` (catch path) | `rabbitmq_client.nack(msg, requeue=true)` | Reject + requeue при любой ошибке в обработке |

**Контракт обмена сообщениями:**
- **Входящая очередь:** auto-generated, exclusive, auto-delete, привязана к fanout exchange `sign.exchange`. Очередь уникальна per signer-instance — каждый из `signer-1/2/3` получает копию каждого сообщения (fanout). Manager может фильтровать по `routing_key` или использовать header-based routing, но в текущем коде этого нет.
- **TTL входящей очереди:** не задан (auto-delete управляется lifecycle процесса).
- **TTL исходящей очереди `sign.responses`:** 3 600 000 ms = 1 час (`x-message-ttl`).
- **Ack-режим:** `noAck: false` — требуется явный ack/nack.
- **Durability:** exchange и `sign.responses` durable; входящая очередь — нет (exclusive+auto-delete).

### 1.4. Auto-instrumentation

Эти спаны создаются автоматически `@opentelemetry/instrumentation-*`
(см. `shared/monitoring/src/monitoring.plugin.ts:62-117`). Никакого
ручного кода.

#### AMQP (instrumentation-amqplib) — КРИТИЧНО для этого сервиса

| Span name | Когда | Что измеряет | Атрибуты |
|-----------|-------|--------------|----------|
| `<exchange> publish` (producer) | Каждый `sendToQueue` от `signersManagerClient.sendSignature` | Публикация ответа в `sign.responses` | `messaging.rabbitmq.exchange=""`, `messaging.rabbitmq.routing_key="sign.responses"`, `messaging.system="rabbitmq"` |
| `<queue> consume` (consumer) | Каждое входящее сообщение из fanout `sign.exchange` | Приём задания на подпись | `messaging.rabbitmq.exchange="sign.exchange"`, `messaging.rabbitmq.routing_key=""` (fanout), `messaging.system="rabbitmq"` |

**Как читать:** Auto-instrumentation amqplib создаёт **родительский**
span для каждого сообщения в consumer-loop. Дочерний span
`signature_daemon.handle_signature_request` вложен в него. Если
consumer-span есть, а дочернего daemon-span нет — `consumeRequests`
ещё не сработал (init не завершён).

#### HTTP (instrumentation-http)

`GET /health` — health-check от `healthPlugin` (см. раздел 4). Это
**единственный** HTTP-endpoint сервиса.

| Span name | Когда | Атрибуты |
|-----------|-------|----------|
| `GET /health` | Каждый health-check | `http.status_code=200`, `http.target=/health`, `http.service=<SERVICE_NAME>` |

#### DNS, FS, Net (instrumentation-dns, -fs, -net)

- `dns.lookup` — при DNS-разрешении RabbitMQ hostname
- `fs.*` — при чтении файлов (Bun runtime)
- `net.*` — при установке TCP-соединения с AMQP-брокером

**Как читать:** Обычно неинтересны, шум. Фильтровать в Tempo:
`span.duration_ms > 5`.

### 1.5. Дебаг: полная иерархия для одного задания на подпись

```
sign.exchange consume {messaging.rabbitmq.exchange="sign.exchange"}    ← amqplib auto-instr
  └── signature_daemon.handle_signature_request                        ← @TraceDecorator
        ├── JSON.parse(message.content) → {hash, taskId, expired}      ← без спана
        ├── signature_service.sign_hash                                ← @TraceDecorator
        │     ├── ethers.solidityPackedKeccak256([hash, expired])      ← без спана (CPU)
        │     ├── this.wallet.signMessage(...)                         ← без спана (CPU, <1ms)
        │     └── signers_manager_client.send_signature                ← @TraceDecorator
        │           └── rabbitmq sendToQueue("sign.responses")         ← amqplib auto-instr (producer)
        └── signers_manager_client.ack_message                         ← @TraceDecorator (success path)
              └── rabbitmq ack(msg)                                    ← amqplib auto-instr
```

**Где искать проблему:**
- `consume` span есть, а `signature_daemon.handle_signature_request` нет → `consumeRequests` не подписался (init fail или reconnect).
- `sign_hash` упал с `Error("Task expired")` → задание пришло слишком поздно (TTL истёк); сообщение requeue-ится → возможный loop, см. метрику.
- `sign_hash` упал с `Error("Invalid hash format")` → некорректный payload от `signers-manager` (баг продюсера), сообщение requeue-ится бесконечно.
- `send_signature` долгий (>500ms) → RabbitMQ тормозит или очередь переполнена.

---

## 2. Логи

Все логи через `@LogDecorator` (уровень DEBUG) + `ErrorHandlerPlugin`
(ERROR для не-AppError). Прямых `logger.*` вызовов в service-слое
нет — только в init/shutdown плагинов.

### 2.1. Business-логи

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR при ошибке |
|-------|------------------|------------------|-----------------------|
| `signature_service.sign_hash` | `signature_service.sign_hash — called` с `{hash, taskId, expired}` | `signature_service.sign_hash — ok` | `— failed` (WARN, если AppError) / `— system_error` (ERROR, иначе). На практике `signHash` бросает обычный `Error("Task expired")` → это ERROR-уровень |
| `signature_daemon.handle_signature_request` | `signature_daemon.handle_signature_request — called` с `{message}` (полный `ConsumeMessage` объект — content-buffer + поля amqplib) | `signature_daemon.handle_signature_request — ok` | **Ошибки подавляются** в `catch` → метод НЕ логирует WARN/ERROR напрямую. Сигнал об ошибке — это `nackMessage` + requeue, видно только через рост метрики без роста успешных операций |

**Безопасность логов:** `@LogDecorator({ args: ['hash', 'taskId', 'expired'] })`
на `signHash` явно фиксирует, что в логи попадают только три поля —
**не** `wallet.privateKey`, **не** подпись, **не** объект `Wallet`.
Аналогично `@LogDecorator({ args: ['message'] })` на
`handle_signature_request` логирует AMQP-сообщение, которое по
контракту содержит только `{hash, taskId, expired}` — приватный ключ
**никогда** не передаётся через AMQP.

### 2.2. Init/shutdown логи (прямой `logger.info` в плагинах)

| Файл | Сообщение | Уровень | Когда |
|------|-----------|---------|-------|
| `clients.plugin.ts:29` | `Initializing RabbitMQ client` | INFO | Перед `rabbitMQClient.connect()` |
| `clients.plugin.ts:32` | `RabbitMQ client initialized successfully` | INFO | После `signersManagerClient.initialize()` |
| `clients.plugin.ts:45` | `Shutting down RabbitMQ client` | INFO | В `.onStop()` перед `disconnect()` |
| `clients.plugin.ts:47` | `RabbitMQ client shut down successfully` | INFO | После `disconnect()` |
| `daemons.plugin.ts:19` | `Initializing signature daemon` | INFO | Перед `signatureDaemon.initialize()` |
| `daemons.plugin.ts:22` | `Signature daemon started successfully` | INFO | После `signatureDaemon.start()` |
| `daemons.plugin.ts:35` | `Stopping signature daemon` | INFO | В `.onStop()` перед `stop()` |
| `daemons.plugin.ts:37` | `Signature daemon stopped successfully` | INFO | После `stop()` |

### 2.3. ErrorHandlerPlugin — автоматические логи

Сервис регистрирует `ErrorHandlerPlugin` через `.onError()` в `app.ts:38`,
но **Elysia-роутов не имеет** (только `healthPlugin`). ErrorHandlerPlugin
сработает только если какой-то плагин бросит исключение на старте или
при shutdown — в runtime он не активируется, потому что ошибки
`handle_signature_request` подавляются внутри метода.

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` | WARN | `error.message` | `{error, errorName, errorStack}` |
| Любая другая ошибка | ERROR | `error.message` | `{error, errorName, errorStack, path}` |

**На практике:** Если сервис падает при старте — ошибка уходит
в `console.error` от Bun (не в Loki), потому что ErrorHandlerPlugin
ещё не подключился. **Признак:** контейнер рестартится в loop →
смотреть `docker logs signer-1`.

### 2.4. Прямые `logger.*` вызовы вне декораторов

- `clients.plugin.ts:29,32,45,47` — init/shutdown сообщения (см. §2.2).
- `daemons.plugin.ts:19,22,35,37` — init/shutdown сообщения (см. §2.2).

Это единственные места с прямыми `logger.info` в сервисе — допустимо
по конвенции (init/shutdown сценарии не трейсятся в ErrorHandlerPlugin).

---

## 3. Метрики

Все метрики префиксируются `SERVICE_NAME` (`signer-1`, `signer-2` или
`signer-3` — разные инстансы одного кода). Prometheus exporter
нормализует точки в именах метрик в подчёркивания, поэтому в таблице
ниже использован bare-`signer_` префикс. **В PromQL** заменяй на
конкретный инстанс: `signer_1_*`, `signer_2_*`, `signer_3_*`.

Сервис **не имеет** прямых `metrics.counter/histogram` вызовов — все
метрики порождаются `@MetricsDecorator` (см. `shared/monitoring/src/metricsDecorator.ts`).
Каждый декорированный метод → counter (`_total` с label `result=success|error`)
+ histogram (`_duration` в ms).

### 3.1. Business counters

| Prometheus имя | Тип | Labels | Когда инкрементится | Зачем |
|---------------|-----|--------|---------------------|-------|
| `signer_signature_service_sign_hash_total` | Counter | `result=success\|error` | Каждый вызов `signHash` | Успешные/ошибочные подписи |
| `signer_signature_service_sign_hash_duration` | Histogram | — | Каждый вызов `signHash` | Латентность подписи (включает ethers sign + AMQP publish) |
| `signer_signature_daemon_handle_signature_request_total` | Counter | `result=success\|error` | Каждый вызов `handleSignatureRequest` | Успешно/неуспешно обработанные входящие сообщения |
| `signer_signature_daemon_handle_signature_request_duration` | Histogram | — | Каждый вызов `handleSignatureRequest` | Латентность обработки одного сообщения (от получения до ack/nack) |

**Примечание о counter `result=error`:** `handle_signature_request`
**подавляет** ошибки в `catch`, поэтому метод всегда завершается
success. Counter `result=error` для этого метода будет **всегда
равен нулю**. Реальный сигнал об ошибках — это расхождение
между `handle_signature_request_total` и `sign_hash_total`
(второе должно быть ≤ первого), а также рост счётчика requeue
в RabbitMQ broker metrics.

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `@opentelemetry/instrumentation-runtime-node` | CPU, memory, event loop lag, GC — все 3 инстанса |
| `http.server.*` | HTTP auto-instrumentation | RPS/latency для `GET /health` (минимальный трафик) |
| `messaging.client.*` | amqplib auto-instrumentation | Количество publish/consume операций, latency per queue/exchange |

### 3.3. Примеры PromQL

```promql
# Сколько подписей в секунду делает signer-1 (успешных)
rate(signer_1_signature_service_sign_hash_total{result="success"}[5m])

# P99 латентность подписи на signer-2
histogram_quantile(0.99,
  rate(signer_2_signature_service_sign_hash_duration_bucket[5m])
)

# Ошибки подписи на signer-3 за последний час
increase(signer_3_signature_service_sign_hash_total{result="error"}[1h])

# Нагрузка на все 3 signer-инстанса суммарно (RPS подписей)
sum(rate(signer_1_signature_service_sign_hash_total[1m])
  + rate(signer_2_signature_service_sign_hash_total[1m])
  + rate(signer_3_signature_service_sign_hash_total[1m]))

# Дисбаланс нагрузки между инстансами (должно быть ~одинаково)
rate(signer_1_signature_service_sign_hash_total[5m])
  / rate(signer_2_signature_service_sign_hash_total[5m])
```

---

## 4. Health-check

### `GET /health`

Стандартный health-check от `healthPlugin` (`@shared/monitoring/src/health.plugin`).
Возвращает `200 OK` если процесс жив и Elysia-сервер слушает порт.
**Не проверяет** состояние AMQP-соединения — если RabbitMQ умер, health
всё равно вернёт 200 (потому что процесс не упал). Для проверки
AMQP-доступности смотри span `signer.init.clients.initialize` при
старте или `signer.stop.clients` при последнем shutdown.

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует / рестартится loop | `docker logs signer-1` → нет init-spans в Tempo для `signer.init.main` → упало в Bun до того, как Elysia подключила ErrorHandlerPlugin. Смотреть `clients.initialize` — там `rabbitMQClient.connect()` + `setupExchange` (нет прав на exchange?). |
| Сообщения из `sign.exchange` не обрабатываются | Tempo: `sign.exchange consume` span есть, но `signature_daemon.handle_signature_request` отсутствует → `consumeRequests` не подписался. Метрика: `signer_signature_daemon_handle_signature_request_total == 0`. |
| Задания подписываются, но ответы не доходят до `signers-manager` | Tempo: внутри `signature_daemon.handle_signature_request` найти `signers_manager_client.send_signature` → есть ли дочерний amqplib producer span на `sign.responses`? Если producer-span есть, но ack-сообщения нет в логах `signers-manager` — проверить RabbitMQ DLX / queue depth. |
| `signHash` бросает `Error("Task expired")` | Это не баг — TTL задания истёк. Если массово → `signers-manager` шлёт задания с уже истёкшим `expired`. Метрика `signer_signature_service_sign_hash_total{result="error"}` (или `signer_1_*`, `signer_2_*`, `signer_3_*` per-instance) будет расти. |
| Один из `signer-1/2/3` не получает сообщения (fanout) | Tempo: проверить, есть ли `sign.exchange consume` span для конкретного инстанса. Если нет — контейнер жив, но auto-generated queue не забиндена. Перезапустить инстанс (exclusive+auto-delete queue будет создана заново). |
| Health-check возвращает 200, но реально RabbitMQ недоступен | Health не проверяет AMQP. Смотреть `signer.init.clients.initialize` при последнем успешном старте + `signer.stop.clients` при последнем shutdown. В период между — статус AMQP не виден. Реальный сигнал — отсутствие `signature_service.sign_hash` spans. |
| `nackMessage` requeue-ится в loop | Сообщения с `Invalid hash format` или `missing required fields` всегда requeue-ится (см. `signature.daemon.ts:65`). Если продюсер шлёт мусор — будет infinite loop. Решение — на стороне `signers-manager` (проверка формата до publish) или DLX на exchange. |
| Утечка приватного ключа в логах/Tempo | **Не должно быть** по текущему коду: `SignatureService` хранит ключ только в `this.wallet`, `@LogDecorator` явно выбирает только безопасные поля, `privateKey` нигде не передаётся в `logger.*`/`setSpanAttributes`. Проверить: `grep -r "privateKey" services/signer/src/` → допустимы только `index.ts` (чтение ENV), `app.ts` (параметр `createApp`), `services.plugin.ts` (проброс в конструктор), `signature.service.ts` (конструктор → `new Wallet`). Если появился новый путь — это утечка. |
