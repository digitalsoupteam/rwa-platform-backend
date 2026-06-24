# Blockchain Scanner — Observability Reference

Фоновый сканер BSC Testnet: периодически читает блоки из JSON-RPC ноды через ethers.js,
парсит события контракта `EventEmitter`, сохраняет их в MongoDB и публикует каждое
событие в RabbitMQ exchange `blockchain.events`. Эти сообщения потребляют сервисы
`services/signer` (×3) и `services/signers-manager` для подписания транзакций и
обновления on-chain state.

- **SERVICE_NAME:** `blockchain-scanner`
- **Порт:** из `process.env.PORT`
- **БД:** MongoDB (Event, ScannerState)
- **Клиенты:** RabbitMQClient (из `@shared/rabbitmq`)
- **Внешние интеграции:** ethers.js `JsonRpcProvider` к BSC Testnet (RPC URL из env)
- **Daemon-ы:** `BlockchainScannerDaemon` (собственный тип — ethers + setInterval)

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Корневой span `blockchain-scanner.init.main` создаётся в `index.ts` через
`tracer.startActiveSpan`, и каждый слой в `app.ts` оборачивается в свой
`withTraceAsync/Sync`. Все спаны идут с префиксом `blockchain-scanner.init.*`.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `blockchain-scanner.init.main` | `index.ts` | ~всё время старта | всё ниже | Корневой span сервиса (entry point) |
| `blockchain-scanner.init.repositories_plugin` | `app.ts` | ~MongoDB connect | `init.repositories.event`, `init.repositories.scanner_state`, `init.repositories_plugin.mongoose`, `init.repositories.plugin` | Подключение к MongoDB + создание репозиториев |
| `blockchain-scanner.init.repositories.event` | `plugins/repositories.plugin.ts` | <5ms | — | Создание `EventRepository` |
| `blockchain-scanner.init.repositories.scanner_state` | `plugins/repositories.plugin.ts` | <5ms | — | Создание `ScannerStateRepository` |
| `blockchain-scanner.init.repositories_plugin.mongoose` | `plugins/repositories.plugin.ts` | ~connect | — | `mongoose.connect(mongoUri)` |
| `blockchain-scanner.init.repositories.plugin` | `plugins/repositories.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Repositories` (с `.onStop` для `mongoose.disconnect()`) |
| `blockchain-scanner.init.clients_plugin` | `app.ts` | <50ms | `init.clients.rabbitmq`, `init.clients.rabbitmq_connect`, `init.clients.plugin` | Создание RabbitMQ клиента и подключение к брокеру |
| `blockchain-scanner.init.clients.rabbitmq` | `plugins/clients.plugin.ts` | <5ms | — | `new RabbitMQClient(...)` |
| `blockchain-scanner.init.clients.rabbitmq_connect` | `plugins/clients.plugin.ts` | ~TCP connect | — | `rabbitMQClient.connect()` — handshake с broker |
| `blockchain-scanner.init.clients.plugin` | `plugins/clients.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Clients` (с `.onStop` для `rabbitMQClient.disconnect()`) |
| `blockchain-scanner.init.services_plugin` | `app.ts` | <5ms | `init.services.blockchain_scanner`, `init.services.plugin` | Создание бизнес-сервиса |
| `blockchain-scanner.init.services.blockchain_scanner` | `plugins/services.plugin.ts` | <5ms | — | `new BlockchainScannerService(...)` |
| `blockchain-scanner.init.services.plugin` | `plugins/services.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Services` |
| `blockchain-scanner.init.controllers_plugin` | `app.ts` | <10ms | `init.controllers.get_events`, `init.controllers.get_event_by_id`, `init.controllers.plugin` | Регистрация 2 контроллеров |
| `blockchain-scanner.init.controllers.get_events` | `plugins/controllers.plugin.ts` | <5ms | — | Создание `GetEventsController` |
| `blockchain-scanner.init.controllers.get_event_by_id` | `plugins/controllers.plugin.ts` | <5ms | — | Создание `GetEventByIdController` |
| `blockchain-scanner.init.controllers.plugin` | `plugins/controllers.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Controllers` |
| `blockchain-scanner.init.daemons_plugin` | `app.ts` | зависит от RPC | `init.daemons.blockchain_scanner`, `init.daemons.initialize`, `init.daemons.plugin` | Создание и запуск daemon-а |
| `blockchain-scanner.init.daemons.blockchain_scanner` | `plugins/daemons.plugin.ts` | <5ms | — | `new BlockchainScannerDaemon(...)` (ethers provider + contract) |
| `blockchain-scanner.init.daemons.initialize` | `plugins/daemons.plugin.ts` | ~RPC `getNetwork()` + БД | — | `daemon.initialize()` — проверка `chainId` против RPC, загрузка `lastProcessedBlock` из БД |
| `blockchain-scanner.init.daemons.plugin` | `plugins/daemons.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Daemons` (с `.onStop` для `daemon.stop()`) |
| `blockchain-scanner.init.elysia` | `app.ts` | ~`listen(port)` | — | Запуск Elysia `.listen(port)` |

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `blockchain-scanner.stop.repositories_plugin` | `plugins/repositories.plugin.ts` (`.onStop`) | graceful shutdown | `mongoose.disconnect()` |
| `blockchain-scanner.stop.clients` | `plugins/clients.plugin.ts` (`.onStop`) | graceful shutdown | `rabbitMQClient.disconnect()` |
| `blockchain-scanner.stop.daemons` | `plugins/daemons.plugin.ts` (`.onStop`) | graceful shutdown | `daemon.stop()` — очистка `setInterval`, флаг `isRunning=false` |

SIGTERM/SIGINT handlers в `index.ts` вызывают `app.stop()`, что последовательно
триггерит все три `.onStop` коллбэка.

### 1.3. Runtime — бизнес-методы

Атрибуты на спаны ставятся явно через `setSpanAttributes()` в `processBatch` (daemon)
и через параметры `tracer.startActiveSpan({attributes: ...})` в `scan` (daemon).
На сервисных и репозиторных методах `setSpanAttributes` **не используется** —
это разрыв с конвенцией `rwa-observability` §1.5 (см. раздел 6).

> Span name = camelToSnakeCase(ClassName) + '.' + camelToSnakeCase(methodName).
> Для `@TraceDecorator` это вычисляется в `traceDecorator.ts`/`decorator-utils.ts`.
> Для `withTraceAsync/Sync` — литерал в коде.

#### BlockchainScannerDaemon (префикс `blockchain_scanner_daemon`)

| Span name | Атрибуты span | Откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|-------------------|-------------------|--------|
| `blockchain_scanner_daemon.initialize` | — | `daemons.plugin.ts` (init.daemons.initialize) | ethers `provider.getNetwork()`, `service.getLastProcessedBlock()` | `BlockchainError` при mismatch `chainId` или RPC failure |
| `blockchain_scanner_daemon.start` | — | `daemons.plugin.ts` (init.daemons.initialize) | `this.scan()` (первый проход) | `BlockchainError` при падении первого `scan()` |
| `blockchain_scanner_daemon.stop` | — | `daemons.plugin.ts` (.onStop) | — | — |
| `blockchain_scanner_daemon.process_batch` | `fromBlock`, `toBlock` (через `@LogDecorator`) | `scan()` внутри `setInterval` | ethers `queryFilter()`, `event.getBlock()`, `service.applyBlockEvents()`, `service.updateLastProcessedBlock()` | `BlockchainError` при падении RPC или DB |
| `blockchain-scanner.daemon.scan` | `scanner.last_processed_block`, `scanner.batch_size`, `scanner.chain_id`, `scanner.current_block`, `scanner.confirmed_block` | `scan()` — root span через `tracer.startActiveSpan` | ethers `getLatestBlockNumber()`, `processBatch()` × N | `BlockchainError` при падении RPC или DB |

|> Цикл сканирования — отдельный root span `blockchain-scanner.daemon.scan` (см. §1.5).
|> Импорт: `import { context, ROOT_CONTEXT } from '@opentelemetry/api'` в `blockchainScanner.daemon.ts`.

#### BlockchainScannerService (префикс `blockchain_scanner_service`)

| Span name | Откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|-------------------|-------------------|--------|
| `blockchain_scanner_service.get_event_by_id` | `POST /getEventById` | `eventRepository.findById()` | `NotFoundError` если событие не найдено |
| `blockchain_scanner_service.get_events` | `POST /getEvents` | `eventRepository.findAll(filters, sort, limit, offset)` | — |
| `blockchain_scanner_service.apply_block_events` | `daemon.processBatch()` | `eventRepository.deleteBlockEvents()`, `eventRepository.createEvents()`, **RabbitMQ publish × N**, `scannerStateRepository.updateLastScannedBlock()` | `AppError` при mismatch `blockNumber`, ошибки RabbitMQ, DB |
| `blockchain_scanner_service.get_last_processed_block` | `daemon.initialize()` | `scannerStateRepository.getLastScannedBlock()` | — |
| `blockchain_scanner_service.update_last_processed_block` | `daemon.processBatch()` | `scannerStateRepository.updateLastScannedBlock()` | `NotFoundError` если состояния нет (fallback к create) |

#### EventRepository (префикс `event_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `event_repository.find_by_id` | `service.getEventById` | `EventEntity.findById(id).lean()` | — |
| `event_repository.create_events` | `service.applyBlockEvents` | `EventEntity.insertMany(data, {ordered: true, lean: true})` | Batched insert по всем событиям блока; пустой массив → noop |
| `event_repository.delete_block_events` | `service.applyBlockEvents` | `EventEntity.deleteMany({chainId, blockNumber})` | Идемпотентный delete перед reinsert (при reorg) |
| `event_repository.find_all` | `service.getEvents` | `EventEntity.find(filters).sort({blockNumber:-1, logIndex:-1}).skip().limit().lean()` | — |

#### ScannerStateRepository (префикс `scanner_state_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `scanner_state_repository.create` | `updateLastScannedBlock` (если doc не найден) | `ScannerStateEntity.create(data)` | — |
| `scanner_state_repository.update` | (не вызывается из runtime) | `findOneAndUpdate({chainId}, data)` | Бросает `NotFoundError` если doc нет |
| `scanner_state_repository.delete` | (не вызывается из runtime) | `findOneAndDelete({chainId})` | Бросает `NotFoundError` |
| `scanner_state_repository.get_last_scanned_block` | `service.getLastProcessedBlock` → `daemon.initialize` | `findOne({chainId}).lean()` | Возвращает 0 если doc нет |
| `scanner_state_repository.update_last_scanned_block` | `service.updateLastProcessedBlock` → `daemon.processBatch` | upsert: `findOneAndUpdate({chainId}, {lastScannedBlock})` или fallback к `create()` | — |
| `scanner_state_repository.find_all` | (не вызывается из runtime) | `find().sort().skip().limit().lean()` | — |

### 1.4. Auto-instrumentation

Active instrumentations в `shared/monitoring/src/monitoring.plugin.ts`:

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP | `@opentelemetry/instrumentation-http` | `POST /getEvents`, `POST /getEventById` (входящие), HTTP-вызовы к BSC Testnet RPC | `http.status_code`, `http.target`, `http.url`, `http.service` |
| MongoDB | `@opentelemetry/instrumentation-mongoose` | `mongoose.Event.*`, `mongoose.ScannerState.*` (NB: `suppressInternalInstrumentation: true` — внутренние OTel-спаны Mongoose подавлены) | `db.mongodb.collection`, `db.operation` |
| RabbitMQ | `@opentelemetry/instrumentation-amqplib` | publish spans на `blockchain.events` exchange | `messaging.rabbitmq.exchange`, `messaging.rabbitmq.routing_key` (см. `monitoring.plugin.ts:111-116`) |
| DNS | `@opentelemetry/instrumentation-dns` | `dns.lookup` | — |
| FS | `@opentelemetry/instrumentation-fs` | `fs.*` | — |
| Net | `@opentelemetry/instrumentation-net` | `net.*` | — |
| Runtime | `@opentelemetry/instrumentation-runtime-node` | — (метрики, не спаны) | — |

> Redis/ioredis инструментации включены глобально в `monitoringPlugin`, но
> blockchain-scanner Redis не использует → спаны не создаются.

### 1.5. Дебаг: полная иерархия для одного цикла `scan()`

|Daemon открывает **отдельный root-trace** для каждой итерации через
|`context.bind(ROOT_CONTEXT, ...)` на `setInterval` + `tracer.startActiveSpan`
|внутри `scan()`. Это сделано специально, чтобы в Tempo циклы сканирования были
|self-contained и их можно было фильтровать через
|`{ resource.service.name = "blockchain-scanner" && spanName = "blockchain-scanner.daemon.scan" }`.
|
|**Важно:** первый `scan()` вызывается синхронно внутри `start()` (до `setInterval`),
|поэтому его span всё ещё является дочерним от `init.main`. Это intentional —
|первый проход логически часть инициализации. Все последующие циклы через
|`setInterval` — отдельные root-traces благодаря `context.bind(ROOT_CONTEXT, ...)`.

```
blockchain-scanner.daemon.scan {                    ← tracer.startActiveSpan (root, НЕ nested)
  scanner.last_processed_block,                     ← атрибуты
  scanner.batch_size,
  scanner.chain_id,
  scanner.current_block,
  scanner.confirmed_block
}
  └── blockchain_scanner_daemon.process_batch {fromBlock, toBlock}
        ├── [ethers RPC] eventEmitterContract.queryFilter(...)      ← нет явного span; ethers.js не инструментирован
        ├── blockchain_scanner_service.apply_block_events
        │     ├── event_repository.delete_block_events             ← @TraceDecorator
        │     │     └── mongoose.Event.deleteMany()                ← mongoose auto-instr
        │     ├── event_repository.create_events                   ← @TraceDecorator
        │     │     └── mongoose.Event.insertMany()                ← mongoose auto-instr
        │     ├── [RabbitMQ publish × N]                           ← amqplib auto-instr
        │     │     └── messaging.rabbitmq.publish {               ← per-event span
        │     │           exchange="blockchain.events",
        │     │           routing_key=<eventName>
        │     │         }
        │     └── scanner_state_repository.update_last_scanned_block  ← @TraceDecorator
        │           └── mongoose.ScannerState.findOneAndUpdate()   ← mongoose auto-instr
        └── blockchain_scanner_service.update_last_processed_block
              └── scanner_state_repository.update_last_scanned_block  ← @TraceDecorator (второй вызов)
                    └── mongoose.ScannerState.*                    ← mongoose auto-instr
```

**Цикл `scan()`** — каждый интервал `SCAN_INTERVAL` ms. На **пустых** итерациях
(когда `lastProcessedBlock >= confirmedBlock`) span **не создаётся** — это
соответствует `rwa-observability` §6.2. Но **gauge `latest_block` снимается
ВСЕГДА** (даже на пустой итерации), чтобы видеть отставание сканера.

Каждый **publish** в RabbitMQ создаёт свой span через `AmqplibInstrumentation` —
это позволяет найти конкретное опубликованное событие в Tempo и связать его
с consumed-span в `signer`/`signers-manager` через единый traceId (propagation
через AMQP headers).

---

## 2. Логи

### 2.1. Business-логи (от `@LogDecorator`)

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `blockchain_scanner_service.get_event_by_id` | `blockchain_scanner_service.get_event_by_id — called` с `{id}` | `— ok` | `— failed` → WARN (`NotFoundError`); `— system_error` → ERROR |
| `blockchain_scanner_service.get_events` | `— called` с `{filters, sort, limit, offset}` | `— ok` | Аналогично |
| `blockchain_scanner_service.apply_block_events` | `— called` с `{blockNumber}` | `— ok` | Аналогично |
| `blockchain_scanner_service.get_last_processed_block` | `— called` (без args) | `— ok` | Аналогично |
| `blockchain_scanner_service.update_last_processed_block` | `— called` с `{blockNumber}` | `— ok` | Аналогично |
| `blockchain_scanner_daemon.process_batch` | `— called` с `{fromBlock, toBlock}` | `— ok` | Аналогично |

Daemon-методы `initialize()`, `start()`, `stop()` **не покрыты `@LogDecorator`** —
они логируют своими прямыми `logger.info/warn` вызовами:

| Метод | Лог |
|-------|-----|
| `daemon.initialize` | `logger.info("Initializing Blockchain Scanner Daemon")`, `logger.info("Chain ID verified: ...")` (×2), `logger.info("Last processed block: ...")` (×2), `logger.info("Blockchain Scanner Daemon initialized successfully")`. При ошибке: `logger.error("Failed to initialize ...", error)` |
| `daemon.start` | `logger.info("Starting blockchain scanner")`, `logger.info("Scanner started. Scanning every N seconds")`. При повторном вызове: `logger.warn("Scanner is already running")`. При ошибке: `logger.error("Failed to start scanner", error)` |
| `daemon.stop` | `logger.info("Stopping blockchain scanner")`, `logger.info("Scanner stopped")`. Если не запущен: `logger.warn("Scanner is not running")` |
| `daemon.scan` | На пустой итерации: `logger.debug('No new blocks to scan', {lastProcessedBlock, confirmedBlock})`. На RPC-ошибке перед span: `logger.error('Error getting latest block in scan', error, {chainId})`. Внутри span на ошибке: `logger.error('Error during scan', error, {lastProcessedBlock, chainId})`. В `setInterval`: `logger.error('Error during periodic scan', error)` |
| `daemon.getEvents` (private) | На ошибке: `logger.error("Failed to get events from <fromBlock> to <toBlock>", error)` |
| `daemon.getLatestBlockNumber` (private) | На ошибке: `logger.error("Failed to get latest block number", error)` |
| `daemon.getGenesisBlock` (private) | На ошибке: `logger.error("Failed to get genesis block", error)` → возвращает 0 |
| `daemon.parseEventData` (private) | На ошибке: `logger.error("Failed to parse event data", error)` → возвращает `{}` |

### 2.2. Init/shutdown логи (прямые `logger.*` в плагинах)

| Файл | Сообщение | Уровень |
|------|-----------|---------|
| `plugins/repositories.plugin.ts` | `Connecting to MongoDB` (`{uri}`), `MongoDB connected successfully`, `Disconnecting from MongoDB`, `MongoDB disconnected successfully` | INFO |
| `plugins/clients.plugin.ts` | `Initializing RabbitMQ client`, `RabbitMQ client initialized successfully`, `Shutting down RabbitMQ client`, `RabbitMQ client shut down successfully` | INFO |
| `plugins/daemons.plugin.ts` | `Initializing blockchain scanner`, `Blockchain scanner startup initiated`, `Stopping blockchain scanner`, `Blockchain scanner stopped successfully`. Если `start()` падает: `Failed to start blockchain scanner: <msg>` | INFO / ERROR |

### 2.3. ErrorHandlerPlugin

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` / `NotFoundError` (любой HTTP-запрос) | ERROR | `error.message` | `{error, errorName, errorStack, path}` |

> NB: `ErrorHandlerPlugin` в `shared/errors/error-handler.plugin.ts` логирует
> **ВСЕ** ошибки через `logger.error` — и `AppError`, и неизвестные. `WARN` для
> `AppError` даёт только `@LogDecorator` на уровне сервиса (см. §2.1).

---

## 3. Метрики

### 3.1. Business метрики (от `@MetricsDecorator`)

`@MetricsDecorator` создаёт counter `<className>.<methodName>_total` (label: `result=success|error`)
и histogram `<className>.<methodName>_duration`. После префиксации
`SERVICE_NAME` через `OTelMetrics` Prometheus получает:
`blockchain-scanner_<className>.<methodName>_total` (OTel экспортирует точки в
именах как underscores, итого: `blockchain-scanner_<className>_<methodName>_total`).

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `blockchain-scanner_blockchain_scanner_service_get_event_by_id_total` | Counter | `result=success\|error` | Каждый вызов `getEventById` | API-запросы по id события |
| `blockchain-scanner_blockchain_scanner_service_get_event_by_id_duration` | Histogram | — | Каждый вызов `getEventById` | Латентность API |
| `blockchain-scanner_blockchain_scanner_service_get_events_total` | Counter | `result=success\|error` | Каждый вызов `getEvents` | API-запросы списка событий |
| `blockchain-scanner_blockchain_scanner_service_get_events_duration` | Histogram | — | Каждый вызов `getEvents` | Латентность API |
| `blockchain-scanner_blockchain_scanner_service_apply_block_events_total` | Counter | `result=success\|error` | Каждый вызов `applyBlockEvents` | Количество обработанных блоков (одна транзакция = один блок, включая пустые) |
| `blockchain-scanner_blockchain_scanner_service_apply_block_events_duration` | Histogram | — | Каждый вызов `applyBlockEvents` | Латентность обработки блока (DB write + RabbitMQ publish) |
| `blockchain-scanner_blockchain_scanner_service_get_last_processed_block_total` | Counter | `result=success\|error` | Каждый вызов `getLastProcessedBlock` (при инициализации daemon) | Служебная метрика |
| `blockchain-scanner_blockchain_scanner_service_get_last_processed_block_duration` | Histogram | — | Каждый вызов `getLastProcessedBlock` | Латентность чтения состояния |
| `blockchain-scanner_blockchain_scanner_service_update_last_processed_block_total` | Counter | `result=success\|error` | Каждый вызов `updateLastProcessedBlock` (после каждого batch) | Persistence heartbeat сканера |
| `blockchain-scanner_blockchain_scanner_service_update_last_processed_block_duration` | Histogram | — | Каждый вызов `updateLastProcessedBlock` | Латентность записи состояния |
| `blockchain-scanner_blockchain_scanner_daemon_process_batch_total` | Counter | `result=success\|error` | Каждый вызов `processBatch` (внутри `scan()`) | Количество обработанных batch-ей блоков |
| `blockchain-scanner_blockchain_scanner_daemon_process_batch_duration` | Histogram | — | Каждый вызов `processBatch` | Латентность одного batch (RPC fetch + DB + publish) |

### 3.2. Прямые метрики (через `metrics.*`)

Вызываются из `BlockchainScannerDaemon.scan()` и `BlockchainScannerService.applyBlockEvents()`:

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `blockchain-scanner_latest_block` | UpDownCounter (gauge) | `chainId=<id>` | Каждая итерация `scan()` (ВКЛЮЧАЯ пустые) | Текущая высота chain head |
| `blockchain-scanner_latest_confirmed_block` | UpDownCounter (gauge) | `chainId=<id>` | Каждая итерация `scan()` (ВКЛЮЧАЯ пустые) | `currentBlock - blockConfirmations` — от этого значения отстаёт `lastProcessedBlock` |
| `blockchain-scanner_scan_cycles_total` | Counter | `chainId=<id>` | Только успешный цикл с обработкой батчей (НЕ инкрементится на пустых) | Количество активных циклов сканирования |
| `blockchain-scanner_events_processed_total` | Counter | `event_name=<EventName>`, `chain_id=<id>` | Каждое успешно опубликованное событие в RabbitMQ | Номенклатура событий: `PoolDeployed`, `BusinessCreated`, и т.д. (зависит от ABI `EventEmitter.json`) |

### 3.3. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | runtime-node | CPU, memory, event loop lag, GC |
| `http.server.duration` | HTTP auto-instr | RPS, latency входящих запросов к `POST /getEvents`, `POST /getEventById` |
| `http.client.duration` | HTTP auto-instr | RPS, latency исходящих (JSON-RPC к BSC Testnet) |
| `db.client.operations.duration` | MongoDB auto-instr | Количество запросов, latency БД (Event, ScannerState) |
| `messaging.*` | amqplib auto-instr | Latency publish операций в RabbitMQ |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов по span_name |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов по span_name |

### 3.4. Примеры PromQL

```promql
# Сколько блоков отсканировано за последние 5 минут
rate(blockchain-scanner_blockchain_scanner_daemon_process_batch_total{result="success"}[5m])

# Текущая высота chain head (gauge)
blockchain-scanner_latest_block{chainId="97"}

# Отставание сканера (block head — lastProcessedBlock)
#   lastProcessedBlock нет как прямой метрики, но его можно вычислить из логов
#   или через max(block_number) на коллекции events.

# Ошибки обработки блоков
rate(blockchain-scanner_blockchain_scanner_service_apply_block_events_total{result="error"}[5m])

# P99 обработки одного батча (RPC + DB + publish)
histogram_quantile(0.99, rate(blockchain-scanner_blockchain_scanner_daemon_process_batch_duration_bucket[5m]))

# Какие события генерируются чаще всего
topk(5, sum by(event_name) (rate(blockchain-scanner_events_processed_total[1h])))

# Количество циклов scan() с обработкой vs без
rate(blockchain-scanner_scan_cycles_total[5m])
```

---

## 4. Health-check

### `GET /health`

Стандартный health-check от `@shared/monitoring`. Регистрируется в `app.ts`
через `.use(healthPlugin)`. Возвращает:

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "service": "blockchain-scanner"
}
```

> Healthcheck **не проверяет** работоспособность daemon-а (RPC-соединение,
> MongoDB, RabbitMQ). Если daemon умер — `GET /health` всё равно вернёт 200.
> Для проверки daemon-а используйте метрики `blockchain-scanner_latest_block`
> (растёт?) и `blockchain-scanner_scan_cycles_total` (инкрементится?).

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сканер не публикует события | `blockchain-scanner_blockchain_scanner_service_apply_block_events_total` — есть ли инкременты? Если есть, но `blockchain-scanner_events_processed_total` стоит — падает RabbitMQ publish. Смотреть amqplib spans в Tempo. |
| Сканер отстаёт от chain head | `blockchain-scanner_latest_block{chainId}` vs `lastProcessedBlock` в БД (коллекция `events`, `max(blockNumber)`). Если растёт `latest_block`, но не `max(blockNumber)` — daemon не обрабатывает. |
| Daemon не запустился | `blockchain-scanner.init.daemons.initialize` span в Tempo + логи: `Failed to start blockchain scanner`, `Chain ID mismatch`. Проверить `RPC_URL` и `CHAIN_ID` env. |
| RPC ошибки | `blockchain_scanner_daemon.process_batch` spans со статусом ERROR. Логи: `Failed to get events from X to Y`. |
| MongoDB disconnect | `blockchain-scanner.stop.repositories_plugin` span + лог `Disconnecting from MongoDB`. Auto-instrumentation mongoose перестанет писать spans. |
| RabbitMQ disconnect | `blockchain-scanner.stop.clients` span + `logger.error` в `rabbitmq.client.ts:handleConnectionError`. Переподключение через `reconnectAttempts`. |
| Cycle выполняется, но событий 0 | `blockchain-scanner_events_processed_total` нулевая, но `scan_cycles_total` растёт — нормально (пустые блоки). Если есть `apply_block_events_total{result="error"}` — смотреть детали. |
| Медленный startup | `blockchain-scanner.init.repositories_plugin.mongoose` (MongoDB connect), `init.clients.rabbitmq_connect` (broker connect), `init.daemons.initialize` (RPC `getNetwork()`). |
| Потеряли trace конкретного события | Tempo search: `{ resource.service.name = "blockchain-scanner" && .messaging.rabbitmq.routing_key = "PoolDeployed" }` или по `.blockchain-scanner.daemon.scan` span name. |
| Daemon упал и не восстановился | `logger.error('Error during periodic scan', error)` в setInterval — daemon продолжает работать (try/catch), но `lastProcessedBlock` не двигается. |

---

## 6. Известные расхождения с конвенциями

> Список **незафикшенных** gap-ов вынесен в conversation/PR description, не
> в observability.md как gap-план. Здесь только фиксация текущего состояния.

| Расхождение | Где | Что есть | Что требуется по конвенции |
|-------------|-----|----------|---------------------------|
| Нет `setSpanAttributes()` на методах сервиса | `blockchainScanner.service.ts` (все 5 методов), `event.repository.ts`, `scannerState.repository.ts` | `@TraceDecorator` создаёт span, но атрибуты не ставятся | `rwa-observability` §1.5 — `setSpanAttributes({id})` / `{blockNumber}` / `{fromBlock,toBlock}` в теле метода |
| RPC-вызовы ethers.js не инструментированы | `daemon.getEvents` (`eventEmitterContract.queryFilter`), `getLatestBlockNumber`, `getBlock`, `getGenesisBlock` | Нет auto-instrumentation для ethers.js | Спаны ethers RPC отсутствуют — для drilldown в Tempo можно полагаться только на span `blockchain_scanner_daemon.process_batch` |
| `daemon.initialize` / `start` / `stop` без `@MetricsDecorator` / `@LogDecorator` | `blockchainScanner.daemon.ts` | Только `@TraceDecorator`, метрик и логов нет | Добавить `@MetricsDecorator` для visibility в Prometheus (success/error rate старта/стопа) |
| `daemon.scan` не покрыт `@LogDecorator` | `blockchainScanner.daemon.ts:299` | Логирование через прямые `logger.error/debug` | Можно оставить (метрика `scan_cycles_total` компенсирует), но `@LogDecorator` стандартизирует формат |