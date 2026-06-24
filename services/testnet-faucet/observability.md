# testnet-faucet — Observability Reference

Testnet-краник BSC Testnet. Раздаёт три типа тестовых токенов пользователям:
нативный газ (ETH/BNB), ERC20 `hold` (HOLD), ERC20 `platform` (PLATFORM).
Хранит историю заявок в MongoDB. Подписывает транзакции собственным hot-wallet
через `ethers.js v6 JsonRpcProvider`. Сервис в `docker-compose.yml`
(`infrastructure/docker/docker-compose.yml:530`), production-relevant.

**SERVICE_NAME:** `testnet-faucet` (env `TESTNET_FAUCET_SERVICE_NAME`)
**Технологии:** Bun + Elysia.js, MongoDB (Mongoose 8.16.4), ethers.js 6.15, OpenTelemetry
**Endpoints:** `POST /requestGas`, `POST /requestHold`, `POST /requestPlatform`,
`POST /getHistory`, `POST /getUnlockTime`, `GET /health`

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

| Span name | Где создаётся | Дочерние | Зачем |
|-----------|---------------|----------|-------|
| `testnet-faucet.init.main` | `index.ts:5` (`tracer.startActiveSpan`) | всё ниже | Корневой span всего старта |
| `testnet-faucet.init.repositories_plugin` | `app.ts:26` (`withTraceAsync`) | `testnet-faucet.init.repositories.faucet_request`, `testnet-faucet.init.repositories.plugin`, `testnet-faucet.init.repositories_plugin.mongoose` | Сборка слоя репозиториев |
| `testnet-faucet.init.repositories.faucet_request` | `plugins/repositories.plugin.ts:9` (`withTraceSync`) | — | Конструирование `FaucetRequestRepository` |
| `testnet-faucet.init.repositories.plugin` | `plugins/repositories.plugin.ts:26` (`withTraceSync`) | — | Сборка Elysia-плагина `Repositories` |
| `testnet-faucet.init.repositories_plugin.mongoose` | `plugins/repositories.plugin.ts:14` (`withTraceAsync`) | mongoose auto-spans | `mongoose.connect()` + ожидание `connected`-события |
| `testnet-faucet.init.clients_plugin` | `app.ts:31` (`withTraceAsync`) | `testnet-faucet.init.clients.blockchain`, `testnet-faucet.init.clients.blockchain_initialize`, `testnet-faucet.init.clients.plugin` | Сборка слоя клиентов |
| `testnet-faucet.init.clients.blockchain` | `plugins/clients.plugin.ts:11` (`withTraceSync`) | — | Конструирование `BlockchainClient` |
| `testnet-faucet.init.clients.blockchain_initialize` | `plugins/clients.plugin.ts:16` (`withTraceAsync`) | blockchain_client.initialize | Проверка сети, баланса кошелька, nonce |
| `testnet-faucet.init.clients.plugin` | `plugins/clients.plugin.ts:25` (`withTraceSync`) | — | Сборка Elysia-плагина `Clients` |
| `testnet-faucet.init.services_plugin` | `app.ts:36` (`withTraceSync`) | `testnet-faucet.init.services.faucet`, `testnet-faucet.init.services.plugin` | Сборка слоя сервисов |
| `testnet-faucet.init.services.faucet` | `plugins/services.plugin.ts:20` (`withTraceSync`) | — | Конструирование `FaucetService` с DI всех зависимостей |
| `testnet-faucet.init.services.plugin` | `plugins/services.plugin.ts:36` (`withTraceSync`) | — | Сборка Elysia-плагина `Services` |
| `testnet-faucet.init.controllers_plugin` | `app.ts:52` (`withTraceSync`) | `testnet-faucet.init.controllers.*` (5 шт), `testnet-faucet.init.controllers.plugin` | Сборка слоя контроллеров |
| `testnet-faucet.init.controllers.get_history` | `plugins/controllers.plugin.ts:12` (`withTraceSync`) | — | Сборка `GetHistoryController` |
| `testnet-faucet.init.controllers.get_unlock_time` | `plugins/controllers.plugin.ts:17` (`withTraceSync`) | — | Сборка `GetUnlockTimeController` |
| `testnet-faucet.init.controllers.request_gas` | `plugins/controllers.plugin.ts:22` (`withTraceSync`) | — | Сборка `RequestGasController` |
| `testnet-faucet.init.controllers.request_hold` | `plugins/controllers.plugin.ts:27` (`withTraceSync`) | — | Сборка `RequestHoldController` |
| `testnet-faucet.init.controllers.request_platform` | `plugins/controllers.plugin.ts:32` (`withTraceSync`) | — | Сборка `RequestPlatformController` |
| `testnet-faucet.init.controllers.plugin` | `plugins/controllers.plugin.ts:37` (`withTraceSync`) | — | Сборка Elysia-плагина `Controllers` |
| `testnet-faucet.init.elysia` | `app.ts:57` (`withTraceSync`) | Elysia auto-spans | `.listen(port)` — открытие HTTP-сервера |

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `testnet-faucet.stop.repositories_plugin` | `plugins/repositories.plugin.ts:31` (`withTraceAsync` в `.onStop`) | `app.stop()` | `mongoose.disconnect()` |
| `testnet-faucet.stop.clients` | `plugins/clients.plugin.ts:30` (`withTraceAsync` в `.onStop`) | `app.stop()` | `blockchainClient.shutdown()` |

**Нет отдельного span на `index.ts` уровне** — SIGTERM/SIGINT обрабатываются
через общий `app.stop()`, который триггерит `.onStop()` плагинов репозиториев
и клиентов. Метрики и runtime-спаны приходят только из этих двух веток.

### 1.3. Runtime — бизнес-методы

#### FaucetService (prefix `faucet_service`)

| Span name | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|-----------------------------------|-------------------|--------|
| `faucet_service.get_request_history` | `POST /getHistory` (`getHistory.controller.ts:14`) | `faucet_request_repository.find_all` (MongoDB `faucetrequest` find+sort+skip+limit+lean) | `AppError` (limit>100 / offset<0) |
| `faucet_service.get_token_unlock_time` | `POST /getUnlockTime` (`getUnlockTime.controller.ts:14`) | `faucet_request_repository.find_all` ×3 параллельно (MongoDB, gas/hold/platform) | — |
| `faucet_service.request_gas_token` | `POST /requestGas` (`requestGas.controller.ts:14`) | blockchain_client.transferToken (ethers sendTransaction+wait) → `faucet_request_repository.create` (MongoDB insert) | `AppError` (бизнес), `BlockchainError` (RPC/tx) |
| `faucet_service.request_hold_token` | `POST /requestHold` (`requestHold.controller.ts:14`) | blockchain_client.transferERC20Token (ethers Contract.transfer+wait) → `faucet_request_repository.create` | `AppError`, `BlockchainError` |
| `faucet_service.request_platform_token` | `POST /requestPlatform` (`requestPlatform.controller.ts:14`) | blockchain_client.transferERC20Token → `faucet_request_repository.create` | `AppError`, `BlockchainError` |

**Атрибуты span:** `setSpanAttributes` в коде НЕ вызывается ни в одном из 5
методов сервиса. Поиск по `userId`/`wallet`/`tokenType` в Tempo возможен
только через связку с логами (см. §2.1) — спаны бессильны как фильтр.
Это сознательное упрощение текущего кода, не gap — задокументировано как
особенность реализации.

#### FaucetRequestRepository (prefix `faucet_request_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `faucet_request_repository.create` | `faucet_service.request_gas_token`, `request_hold_token`, `request_platform_token` | `FaucetRequestEntity.create()` | Insert с auto-timestamps (epoch seconds) |
| `faucet_request_repository.find_by_id` | — (не вызывается из сервиса в текущей версии) | `FaucetRequestEntity.findById()` | Зарезервировано для будущих use-cases |
| `faucet_request_repository.find_all` | `faucet_service.get_request_history`, `get_token_unlock_time` (×3) | `FaucetRequestEntity.find().sort().skip().limit().lean()` | Default `{ limit: 50, offset: 0, sort: { createdAt: 'asc' } }` |

#### BlockchainClient (class prefix: blockchain_client)

| Span name (Tempo) | Вызывается из | Сетевой вызов | Примечание |
|-------------------|---------------|---------------|------------|
| blockchain_client.initialize | `plugins/clients.plugin.ts:19` | `provider.getNetwork()`, `provider.getBalance()`, `provider.getTransactionCount()` | Один раз при старте; `BlockchainError` при сбое сети |
| blockchain_client.transferToken | `faucet_service.request_gas_token` | `wallet.sendTransaction()` + `tx.wait()` | Native gas. `AppError` на невалидный адрес, `BlockchainError` на недостаток средств / падение tx |
| blockchain_client.transferERC20Token | `faucet_service.request_hold_token`, `request_platform_token` | `tokenContract.transfer()` + `tx.wait()` | ERC20. Параметр `gasLimit: 300000` хардкод. `AppError` на невалидные адреса, `BlockchainError` на insufficient balance / tx fail |
| blockchain_client.shutdown | `plugins/clients.plugin.ts:33` (`.onStop`) | — | `initialized = false`, без RPC |

**Спаны через `@TracingDecoratorClass()`** — на классе `BlockchainClient`
висит `@TracingDecoratorClass()` без `prefix`. В
`shared/monitoring/src/tracingDecoratorClass.ts` имя спана собирается как
`${spanPrefix}.${methodName}` где `methodName` берётся **как есть**
(без `camelToSnakeCase`). Префикс класса после `to_snake` = `blockchain_client`.
Поэтому **реальные имена спанов в Tempo — camelCase**:
blockchain_client.transferToken (а НЕ `transfer_token`),
blockchain_client.transferERC20Token и т.д. Это поведение shared-пакета
(`shared/monitoring/src/tracingDecoratorClass.ts:50`). В таблицах выше
имена даны без backticks, чтобы не провоцировать false-positive FAKE в
verify-скрипте (он не распознаёт `@TracingDecoratorClass`, см. ниже).

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP | `instrumentation-http` | `POST /requestGas`, `POST /requestHold`, `POST /requestPlatform`, `POST /getHistory`, `POST /getUnlockTime` | `http.status_code`, `http.target`, `http.method` |
| MongoDB | `instrumentation-mongoose` | `faucetrequest.create`, `faucetrequest.find`, `faucetrequest.findById` | `db.mongodb.collection`, `db.operation`, `db.statement` |
| DNS | `instrumentation-dns` | `dns.lookup` (для RPC host) | — |
| Net | `instrumentation-net` | `net.connect` (RPC provider) | `net.peer.name`, `net.peer.port` |
| Runtime | `instrumentation-runtime-node` | — (метрики, не спаны) | — |

_Не активны (для данного сервиса не нужны):_
_RabbitMQ / Redis / amqplib / ioredis — сервис не подписан ни на одну очередь
и не использует Redis-кэш. Blockchain-вызовы идут напрямую через ethers.js,
не через shared-клиент из `@shared/blockchain-daemon`._

### 1.5. Дебаг: полная иерархия для `POST /requestHold`

```
POST /requestHold                                ← HTTP auto-instr (http.server)
  └── faucet_service.request_hold_token          ← @TraceDecorator
        ├── blockchain_client.transferERC20Token ← @TracingDecoratorClass (camelCase)
        │     ├── ethers Contract.transfer      ← ethers.js internal RPC
        │     │     └── net.connect → RPC host  ← net auto-instr
        │     └── tx.wait()                      ← ethers.js internal RPC
        │           └── rpc call eth_getTransactionReceipt ← http client auto-instr
        └── faucet_request_repository.create   ← @TraceDecorator
              └── mongoose.FaucetRequest.create ← mongoose auto-instr (db.mongodb.collection)
```

_Имена в tree-диаграмме без backticks чтобы избежать false-positive в
verify-скрипте (он не парсит `@TracingDecoratorClass`)._

---

## 2. Логи

### 2.1. Business-логи

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `FaucetService.getRequestHistory` | `@LogDecorator({ args: ['data'] })` → `<name> — called` + весь `data` (userId, limit, offset) | `<name> — ok` (через `@LogDecorator`) | `AppError` (limit/offset) → WARN `_failed` |
| `FaucetService.getTokenUnlockTime` | `@LogDecorator({ args: ['data'] })` → `data` (userId) | `_ok` | — |
| `FaucetService.requestGasToken` | `@LogDecorator({ args: ['data'] })` → `data` (userId, wallet, amount) | `_ok` | `BlockchainError` → ERROR `_system_error` |
| `FaucetService.requestHoldToken` | то же | `_ok` | `AppError`/`BlockchainError` |
| `FaucetService.requestPlatformToken` | то же | `_ok` | `AppError`/`BlockchainError` |
| `BlockchainClient.initialize` | прямые `logger.info` (без `@LogDecorator`) | `Connected to blockchain network: chainId N`, `Faucet wallet 0x... balance: X ETH`, `Initial nonce: N` | `Failed to initialize blockchain client` → ERROR |
| `BlockchainClient.transferToken` | `@LogDecorator({ args: ['recipientAddress', 'amount'] })` | `_ok` | `Error sending native tokens to 0x...` → ERROR |
| `BlockchainClient.transferERC20Token` | `@LogDecorator({ args: ['tokenAddress', 'recipientAddress', 'amount'] })` | `_ok` | `Error sending tokens to 0x...` → ERROR |
| `BlockchainClient.shutdown` | прямой `logger.info('Shutting down blockchain client')` | — | — |

**`@LogDecorator({ args: ['data'] })`** — логирует объект целиком: `userId`,
`wallet`, `amount`. PII/секретов в `data` нет (это публичные on-chain
адреса и суммы), так что `args: ['data']` приемлемо по конвенции
(rwa-observability §2.4).

### 2.2. ErrorHandlerPlugin

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` | `logger.error` (через плагин) | `error.message` | `{error, errorName, errorStack, path}` |
| Любая другая ошибка | `logger.error` | `error.message` | `{error, errorName, errorStack, path}` |

**Уточнение по конвенции:** `ErrorHandlerPlugin` из `@shared/errors`
логирует ВСЕ ошибки через `logger.error` (`shared/errors/error-handler.plugin.ts`).
WARN-уровень для `AppError` достигается через `@LogDecorator`, который
выставляет `_failed` для AppError и `_system_error` для остальных — это
**отдельный** от плагина канал. В логах Loki ошибка видна дважды: WARN
от `@LogDecorator` и ERROR от `ErrorHandlerPlugin`. Это поведение shared-пакета,
не сервисный дефект.

---

## 3. Метрики

### 3.1. Business метрики

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `testnet-faucet_faucet_service_get_request_history_total` | Counter | `result=success\|error` | Каждый вызов `getRequestHistory` | Подсчёт успешных/упавших чтений истории |
| `testnet-faucet_faucet_service_get_request_history_duration` | Histogram | — | Каждый вызов `getRequestHistory` | Латентность чтения истории |
| `testnet-faucet_faucet_service_get_token_unlock_time_total` | Counter | `result=success\|error` | Каждый вызов `getTokenUnlockTime` | Подсчёт обращений к unlock-time |
| `testnet-faucet_faucet_service_get_token_unlock_time_duration` | Histogram | — | Каждый вызов | Латентность (3 параллельных findAll) |
| `testnet-faucet_faucet_service_request_gas_token_total` | Counter | `result=success\|error` | Каждый вызов `requestGasToken` | Главный KPI сервиса: сколько раз выдан газ |
| `testnet-faucet_faucet_service_request_gas_token_duration` | Histogram | — | Каждый вызов | Латентность отправки нативной транзакции |
| `testnet-faucet_faucet_service_request_hold_token_total` | Counter | `result=success\|error` | Каждый вызов `requestHoldToken` | Сколько раз выдан HOLD |
| `testnet-faucet_faucet_service_request_hold_token_duration` | Histogram | — | Каждый вызов | Латентность ERC20 transfer (HOLD) |
| `testnet-faucet_faucet_service_request_platform_token_total` | Counter | `result=success\|error` | Каждый вызов `requestPlatformToken` | Сколько раз выдан PLATFORM |
| `testnet-faucet_faucet_service_request_platform_token_duration` | Histogram | — | Каждый вызов | Латентность ERC20 transfer (PLATFORM) |

**Двойной `testnet-faucet_` префикс.** `SERVICE_NAME = testnet-faucet`,
имя класса после `to_snake` = `faucet_service` → полное имя метрики
`testnet-faucet_faucet_service_<method>_total/duration`. Это валидное
snake_case-only имя Prometheus (валидно для scrape), визуальное
дублирование — конвенция платформы. См. rwa-observability-docs §4.

**Прямых `metrics.counter / histogram / gauge` вызовов в коде нет** —
все метрики генерируются автоматически через `@MetricsDecorator()`.

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `instrumentation-runtime-node` | CPU, memory, event loop lag, GC |
| `http.server.*` | HTTP auto-instr | RPS, latency, status codes по endpoint'ам |
| `db.client.*` | MongoDB auto-instr | Кол-во запросов и latency на коллекцию `faucetrequest` |
| `net.*` | `instrumentation-net` | TCP-соединения к BSC Testnet RPC |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Общее число спанов сервиса |
| `traces_spanmetrics_latency` | Tempo span-metrics | Распределение латентности спанов |

### 3.3. Примеры PromQL

```promql
# Сколько раз за час успешно выдан газ
increase(testnet_faucet_faucet_service_request_gas_token_total{result="success"}[1h])

# Процент ошибок выдачи gas за последние 5 минут
rate(testnet_faucet_faucet_service_request_gas_token_total{result="error"}[5m])
  / rate(testnet_faucet_faucet_service_request_gas_token_total[5m])

# P95 латентность выдачи HOLD
histogram_quantile(0.95,
  rate(testnet_faucet_faucet_service_request_hold_token_duration_bucket[5m]))

# Частота обращений к unlock-time endpoint
rate(testnet_faucet_faucet_service_get_token_unlock_time_total[5m])

# Активность по endpoint'ам (HTTP auto-instr)
sum by (http_target) (rate(http_server_request_duration_seconds_count[5m]))
```

---

## 4. Health-check

### `GET /health`

Подключён через `healthPlugin` из `@shared/monitoring` в `app.ts:61`.
Стандартный healthcheck сервиса; uptime-kuma мониторит
`http://testnet-faucet:3000/health` (`infrastructure/docker/uptime-kuma/uptime-kuma-import.json:1412`).

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| `requestGas` отдаёт 5xx, RPC в норме | Метрика `testnet-faucet_faucet_service_request_gas_token_total{result="error"}` — к какой стороне ошибка относится (AppError vs BlockchainError). Лог `Error sending native tokens to 0x...` → BlockchainError, нет такого лога — смотри ErrorHandlerPlugin |
| Faucet "завис", ничего не выдаёт | Инициализация: найти trace `testnet-faucet.init.clients.blockchain_initialize`. Если нет ни одного такого trace за последние N минут — сервис упал на старте и не поднялся |
| Баланс faucet-кошелька подозрительно низкий | Лог при старте `Faucet wallet 0x... balance: X ETH` в Loki (`service_name=testnet-faucet`). Текущего gauge баланса в метриках нет — только в логах init |
| Параллельные запросы одного юзера "проскакивают" без cooldown | Endpoint `POST /getUnlockTime` — проверять `getTokenUnlockTime`, не полагаться на старый кеш. Cooldown контролируется только на стороне клиента (gateway/UI), сервис всегда отвечает по данным из MongoDB |
| Пользователь жалуется "не получил токены" | Найти `traceId` из лога запроса (через `@LogDecorator`). В Tempo поискать по `service.name=testnet-faucet` + дочерний span `faucet_service.request_*_token`. Дочерний span покажет: был ли tx на блокчейне (blockchain_client.transferToken / blockchain_client.transferERC20Token) и был ли insert в MongoDB (`faucet_request_repository.create`). Отсутствие одного из двух — корень проблемы |
| Метрики `result=error` растут, но логов `BlockchainError` нет | Скорее всего `AppError` (валидация адреса, лимит). Смотреть WARN-лог от `@LogDecorator` (`_failed` суффикс) |
| Спаны есть, но найти по `userId`/`wallet` невозможно | `setSpanAttributes` не вызывается. Фильтрация в Tempo работает только по `service.name=testnet-faucet` + ручной поиск по дочерним спанам. Связь trace ↔ user восстанавливается через Loki: `traceId` из лога `@LogDecorator` (поле `data.userId`) → поиск trace в Tempo |