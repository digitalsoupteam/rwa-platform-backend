# Portfolio — Observability Reference

Микросервис `portfolio` хранит портфолио пользователей RWA-платформы: токен-балансы
по `(owner, tokenAddress, tokenId, poolAddress, chainId)` и историю переводов
(`RWA_Transfer` event из RabbitMQ). Стек: Bun + Elysia.js, MongoDB (Mongoose),
RabbitMQ, OpenTelemetry. `SERVICE_NAME = portfolio`.

Все runtime-операции идут через Elysia-роуты `POST /getBalances` и
`POST /getTransactions`, а запись — через daemon `BlockchainEventsDaemon`,
который слушает очередь `blockchain.events.portfolio`.

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Корневой span `portfolio.init.main` создаётся в `index.ts` через
`tracer.startActiveSpan('portfolio.init.main', ...)`. Внутри него идёт `createApp`,
которая последовательно оборачивает инициализацию каждого слоя в `withTraceAsync/Sync`
(см. `app.ts`). Затем `daemons.plugin.ts` отдельно оборачивает `initialize()` и `start()`
демона — это **дочерние** спаны внутри `portfolio.init.daemons_plugin`, **не** init-слоя.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `portfolio.init.main` | `index.ts:5` | всё время старта | всё ниже | Корневой span entry-point |
| `portfolio.init.repositories_plugin` | `app.ts:20` | ~MongoDB connect | `portfolio.init.repositories.tokenBalance`, `portfolio.init.repositories.transaction`, `portfolio.init.repositories_plugin.mongoose`, `portfolio.init.repositories.plugin` | Сборка repositoriesPlugin |
| `portfolio.init.repositories.tokenBalance` | `repositories.plugin.ts:9` | ~миллисекунды | — | Создание `TokenBalanceRepository` |
| `portfolio.init.repositories.transaction` | `repositories.plugin.ts:14` | ~миллисекунды | — | Создание `TransactionRepository` |
| `portfolio.init.repositories_plugin.mongoose` | `repositories.plugin.ts:19` | ~MongoDB connect | — | Установка соединения с MongoDB |
| `portfolio.init.repositories.plugin` | `repositories.plugin.ts:29` | ~миллисекунды | — | Сборка Elysia-плагина `Repositories` |
| `portfolio.init.clients_plugin` | `app.ts:25` | ~RabbitMQ connect | `portfolio.init.clients.rabbitmq`, `portfolio.init.clients.rabbitmq_connect`, `portfolio.init.clients.plugin` | Сборка clientsPlugin |
| `portfolio.init.clients.rabbitmq` | `clients.plugin.ts:11` | ~миллисекунды | — | Создание `RabbitMQClient` |
| `portfolio.init.clients.rabbitmq_connect` | `clients.plugin.ts:20` | ~RabbitMQ connect | — | Установка соединения с RabbitMQ |
| `portfolio.init.clients.plugin` | `clients.plugin.ts:27` | ~миллисекунды | — | Сборка Elysia-плагина `Clients` |
| `portfolio.init.services_plugin` | `app.ts:30` | ~миллисекунды | `portfolio.init.services.portfolio`, `portfolio.init.services.plugin` | Сборка servicesPlugin |
| `portfolio.init.services.portfolio` | `services.plugin.ts:10` | ~миллисекунды | — | Инстанциирование `PortfolioService` |
| `portfolio.init.services.plugin` | `services.plugin.ts:18` | ~миллисекунды | — | Сборка Elysia-плагина `Services` |
| `portfolio.init.daemons_plugin` | `app.ts:35` | весь жизненный цикл демона | `portfolio.init.daemons.blockchain_events`, `portfolio.init.daemons.blockchain_events_initialize`, `portfolio.init.daemons.blockchain_events_start`, `portfolio.init.daemons.plugin` | Сборка и запуск daemonsPlugin |
| `portfolio.init.daemons.blockchain_events` | `daemons.plugin.ts:12` | ~миллисекунды | — | Создание `BlockchainEventsDaemon` |
| `portfolio.init.daemons.blockchain_events_initialize` | `daemons.plugin.ts:20` | инициализация демона | — | `blockchainEventsDaemon.initialize()` |
| `portfolio.init.daemons.blockchain_events_start` | `daemons.plugin.ts:27` | запуск consume | — | `blockchainEventsDaemon.start()` → `startConsuming()` |
| `portfolio.init.daemons.plugin` | `daemons.plugin.ts:34` | ~миллисекунды | — | Сборка Elysia-плагина `Daemons` (включая `onStop`) |
| `portfolio.init.controllers_plugin` | `app.ts:40` | ~миллисекунды | `portfolio.init.controllers.get_balances`, `portfolio.init.controllers.get_transactions`, `portfolio.init.controllers.plugin` | Сборка controllersPlugin |
| `portfolio.init.controllers.get_balances` | `controllers.plugin.ts:9` | ~миллисекунды | — | Создание Elysia-роута `POST /getBalances` |
| `portfolio.init.controllers.get_transactions` | `controllers.plugin.ts:14` | ~миллисекунды | — | Создание Elysia-роута `POST /getTransactions` |
| `portfolio.init.controllers.plugin` | `controllers.plugin.ts:19` | ~миллисекунды | — | Сборка Elysia-плагина `Controllers` |
| `portfolio.init.elysia` | `app.ts:45` | ~миллисекунды | HTTP server spans | Регистрация middleware и `app.listen(port)` |

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `portfolio.stop.repositories_plugin` | `repositories.plugin.ts:35` | `.onStop()` репозиториев | `mongoose.disconnect()` |
| `portfolio.stop.clients.rabbitmq_disconnect` | `clients.plugin.ts:32` | `.onStop()` клиентов | `rabbitMQClient.disconnect()` |
| `portfolio.stop.daemons.blockchain_events` | `daemons.plugin.ts:43` | `.onStop()` демонов | `blockchainEventsDaemon.stop()` |

`index.ts:20` объявляет `shutdown()`-хэндлер на `SIGTERM`/`SIGINT` без отдельного
span-а — корневой span на shutdown не создаётся (см. §5 чек-лист «shutdown: partial»).

### 1.3. Runtime — бизнес-методы

#### PortfolioService (префикс snake_case: portfolio_service)

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `portfolio_service.get_balances` | — (нет setSpanAttributes) | `POST /getBalances` → `getBalancesController` | `token_balance_repository.find_all` | `AppError` (NotFound невозможен — `findAll` всегда возвращает массив) |
| `portfolio_service.get_transactions` | — (нет setSpanAttributes) | `POST /getTransactions` → `getTransactionsController` | `transaction_repository.find_all` | `AppError` (NotFound невозможен) |
| `portfolio_service.process_transfer` | — (нет setSpanAttributes) | `BlockchainEventsDaemon` consume-handler `RWA_Transfer` | `transaction_repository.create` + до 2× `token_balance_repository.update_balance` | `AppError` (mongoose validation), `Error` |

_Примечание: span name = `camelToSnakeCase(className) + '.' + camelToSnakeCase(method)`,
где *PortfolioService* → *portfolio_service*, *getBalances* → *get_balances* и т.д.
В коде `setSpanAttributes()` **не вызывается** — фильтрация по `userId`/`wallet`/etc.
через span-атрибуты не работает (см. §5 чек-лист «setSpanAttributes: missing»)._

#### TokenBalanceRepository (префикс snake_case: token_balance_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `token_balance_repository.find_by_id` | — (не используется в текущем коде) | `Model.findById().lean()` | Бросает `NotFoundError("TokenBalance", id)` если не найдено |
| `token_balance_repository.find_all` | `portfolio_service.get_balances` | `Model.find(filter).sort().skip().limit().lean()` | default: `sort=createdAt asc`, `limit=100`, `offset=0` |
| `token_balance_repository.update_balance` | `portfolio_service.process_transfer` (до 2× — from и to) | `Model.findOneAndUpdate({owner,tokenAddress,tokenId,poolAddress,chainId}, {$inc:{balance:amount}, $set:{lastUpdateBlock}, $setOnInsert:{...}}, {new:true,upsert:true}).lean()` | Upsert: либо инкрементит существующий, либо создаёт новый |

#### TransactionRepository (префикс snake_case: transaction_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `transaction_repository.create` | `portfolio_service.process_transfer` | `Model.create(data).toObject()` | Запись одной транзакции |
| `transaction_repository.find_by_id` | — (не используется в текущем коде) | `Model.findById().lean()` | Бросает `NotFoundError("Transaction", id)` если не найдено |
| `transaction_repository.find_all` | `portfolio_service.get_transactions` | `Model.find(filter).sort().skip().limit().lean()` | default: `sort=blockNumber asc`, `limit=100`, `offset=0` |

#### BlockchainEventsDaemon (префикс snake_case: blockchain_events_daemon)

| Span name | Атрибуты span | Откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|-------------------|-------------------|--------|
| `blockchain_events_daemon.get_event_routing` | — (нет setSpanAttributes) | `BaseBlockchainDaemon.handleMessage` (см. `@shared/blockchain-daemon`) | — | — |

_Примечание: метод `getEventRouting()` имеет только `@TraceDecorator()`, **без**
`@MetricsDecorator` и `@LogDecorator` — для него не создаются counter/histogram
и не пишется лог вызова (см. §5 чек-лист «getEventRouting: неполные декораторы»)._

### 1.4. Auto-instrumentation

Подключены в `shared/monitoring/src/monitoring.plugin.ts` через
`getNodeAutoInstrumentations(...)` + `new AmqplibInstrumentation(...)`.

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP | `@opentelemetry/instrumentation-http` | `POST /getBalances`, `POST /getTransactions` (server), исходящие — нет (нет внешних HTTP-вызовов) | `http.method`, `http.target`, `http.status_code`, `http.service`, `service.name` |
| MongoDB | `@opentelemetry/instrumentation-mongoose` | `TokenBalance.findById`, `TokenBalance.find`, `TokenBalance.findOneAndUpdate`, `Transaction.create`, `Transaction.findById`, `Transaction.find` | `db.mongodb.collection`, `db.operation`, `db.statement` (с `suppressInternalInstrumentation: true`) |
| RabbitMQ | `@opentelemetry/instrumentation-amqplib` | `publish` на exchange `blockchain.events`, `consume` на queue `blockchain.events.portfolio` | `messaging.system=rabbitmq`, `messaging.rabbitmq.exchange`, `messaging.rabbitmq.routing_key`, `messaging.operation` |
| DNS | `@opentelemetry/instrumentation-dns` | `dns.lookup` при сетевых подключениях | — |
| FS | `@opentelemetry/instrumentation-fs` | `fs.*` (включён, `enabled: true`) | — |
| Net | `@opentelemetry/instrumentation-net` | `net.*` | — |
| Runtime | `@opentelemetry/instrumentation-runtime-node` | — (метрики, не спаны) | — |

_Инструменты `@opentelemetry/instrumentation-graphql` отключён, `@opentelemetry/instrumentation-ioredis` включён, но Redis в portfolio **не используется** — спаны ioredis не появятся, если нет вызовов._

### 1.5. Дебаг: полная иерархия для ключевой операции

#### `POST /getBalances` (HTTP request)

```
POST /getBalances                          ← HTTP auto-instr (instrumentation-http)
  └── portfolio_service.get_balances       ← @TraceDecorator на PortfolioService.getBalances
        └── token_balance_repository.find_all   ← @TraceDecorator на TokenBalanceRepository.findAll
              └── mongoose.TokenBalance.find     ← mongoose auto-instr (instrumentation-mongoose)
```

#### `RWA_Transfer` event (RabbitMQ consume)

```
amqplib publish-span (внешний сервис rwa/blockchain-scanner)
  └── amqplib consume-span                ← instrumentation-amqplib на queue
        blockchain.events.portfolio
        └── blockchain_events_daemon.get_event_routing  ← @TraceDecorator (НЕ с @MetricsDecorator)
              └── portfolio_service.process_transfer    ← @TraceDecorator + @MetricsDecorator + @LogDecorator
                    ├── transaction_repository.create   ← @TraceDecorator
                    │     └── mongoose.Transaction.create  ← mongoose auto-instr
                    ├── token_balance_repository.update_balance (from, если != zero)
                    │     └── mongoose.TokenBalance.findOneAndUpdate  ← mongoose auto-instr
                    └── token_balance_repository.update_balance (to, если != zero)
                          └── mongoose.TokenBalance.findOneAndUpdate  ← mongoose auto-instr
```

_Примечание: `BaseBlockchainDaemon.handleMessage` в `@shared/blockchain-daemon` **не
оборачивает** обработку в `withTraceAsync`, поэтому отдельный span вида
`portfolio.rabbitmq.consume` от самого portfolio не создаётся. Дочерние спаны от
`getEventRouting` и `processTransfer` идут прямо под auto-consume-span от
`instrumentation-amqplib`._

---

## 2. Логи

### 2.1. Business-логи

Уровни: `@LogDecorator` пишет `logger.debug('<name> — called', {args})` при входе,
`logger.debug('<name> — ok')` при успехе, `logger.warn('<name> — failed')` для
`AppError` (с `error.message`), `logger.error('<name> — system_error')` для прочих
`Error` (с `error.message`, `errorStack`).

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `PortfolioService.getBalances` | `get_balances — called` с `{params}` | `get_balances — ok` | `get_balances — failed` → WARN; `get_balances — system_error` → ERROR |
| `PortfolioService.getTransactions` | `get_transactions — called` с `{params}` | `get_transactions — ok` | `get_transactions — failed` → WARN; `get_transactions — system_error` → ERROR |
| `PortfolioService.processTransfer` | `process_transfer — called` с `{data}` | `process_transfer — ok` | `process_transfer — failed` → WARN; `process_transfer — system_error` → ERROR |
| `BlockchainEventsDaemon.getEventRouting` | нет лога (нет `@LogDecorator`) | нет лога | нет лога |
| `TokenBalanceRepository.*` | нет лога (нет `@LogDecorator` в репо) | нет лога | нет лога |
| `TransactionRepository.*` | нет лога (нет `@LogDecorator` в репо) | нет лога | нет лога |

Прямые `logger.*` вызовы в коде portfolio отсутствуют (поиск `logger\.` → 0 совпадений
в `services/portfolio/src/`).

### 2.2. ErrorHandlerPlugin

`ErrorHandlerPlugin` подключён в `app.ts:50` через `.onError(ErrorHandlerPlugin)`.
Логирует **ВСЕ** ошибки через `logger.error` (и `AppError`, и `Error`) с
`{error, errorName, errorStack, path}`. Разделение уровней AppError/WARN vs.
`Error`/ERROR делает `@LogDecorator` (см. §2.1).

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` (например, `NotFoundError` из репозитория) | `logger.error` | `error.message` | `{error, errorName, errorStack, path}` |
| Любая другая ошибка | `logger.error` | `error.message` | `{error, errorName, errorStack, path}` |

---

## 3. Метрики

### 3.1. Business метрики

`@MetricsDecorator` создаёт `counter: <className>_<methodName>_total` (label
`result=success|error`) и `histogram: <className>_<methodName>_duration` (ms).
`OTelMetrics` префиксирует именем сервиса: `SERVICE_NAME=portfolio` →
`portfolio_portfolio_service_<method>_total` и т.д.

_Замечание про двойной префикс метрик: `SERVICE_NAME=portfolio` + snake_case
класса `PortfolioService` даёт *portfolio_service*, и Prometheus-имя получает
префикс `portfolio_<snake_class>_<method>_total`. В данном случае итоговое имя
выглядит как *portfolio_portfolio_service_*. Это валидное Prometheus-имя
(snake_case-only), но визуально выглядит дублированием._

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `portfolio_portfolio_service_get_balances_total` | Counter | `result=success\|error` | Каждый вызов `getBalances` | Кол-во запросов балансов |
| `portfolio_portfolio_service_get_balances_duration` | Histogram | — | Каждый вызов `getBalances` | Латентность запросов балансов |
| `portfolio_portfolio_service_get_transactions_total` | Counter | `result=success\|error` | Каждый вызов `getTransactions` | Кол-во запросов транзакций |
| `portfolio_portfolio_service_get_transactions_duration` | Histogram | — | Каждый вызов `getTransactions` | Латентность запросов транзакций |
| `portfolio_portfolio_service_process_transfer_total` | Counter | `result=success\|error` | Каждый вызов `processTransfer` (при consume `RWA_Transfer`) | Кол-во обработанных переводов |
| `portfolio_portfolio_service_process_transfer_duration` | Histogram | — | Каждый вызов `processTransfer` | Латентность обработки перевода |

_Метод `BlockchainEventsDaemon.getEventRouting` имеет только `@TraceDecorator`, **без**
`@MetricsDecorator` — для него не создаются counter/histogram. Методы репозиториев
`TokenBalanceRepository.*` и `TransactionRepository.*` также имеют только
`@TraceDecorator`, без `@MetricsDecorator` — для них Prometheus-метрик не создаётся.
Прямых вызовов `metrics.counter/histogram/gauge` в коде portfolio нет (поиск `metrics\.` → 0)._

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `@opentelemetry/instrumentation-runtime-node` | CPU, memory, event loop lag, GC |
| `http.server.*` | `@opentelemetry/instrumentation-http` | RPS, latency, status codes |
| `db.client.*` | `@opentelemetry/instrumentation-mongoose` | Кол-во запросов, latency по `db.system=mongodb` |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Кол-во спанов |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |
| `messaging.client.*` (от instrumentation-amqplib) | `@opentelemetry/instrumentation-amqplib` | publish/consume счётчики и latency по RabbitMQ |

### 3.3. Примеры PromQL

```promql
# Ошибки processTransfer за 5 минут
rate(portfolio_portfolio_service_process_transfer_total{result="error"}[5m])

# P99 латентность getBalances
histogram_quantile(0.99, rate(portfolio_portfolio_service_get_balances_duration_bucket[5m]))

# Количество обработанных RWA_Transfer за 24h
increase(portfolio_portfolio_service_process_transfer_total[24h])

# Все consume-spans на queue blockchain.events.portfolio
sum(rate(messaging_client_consumed_total[5m])) by (destination)
```

---

## 4. Health-check

### `GET /health`

`healthPlugin` подключён в `app.ts:49` через `.use(healthPlugin)`. Доступен по
`GET /health` (используется стандартный плагин из `@shared/monitoring`). Возвращает
`{ status: "ok" }` если процесс жив, `{ status: "degraded" }` если MongoDB-соединение
потеряно.

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Балансы не возвращаются | span `portfolio_service.get_balances` → дочерний `token_balance_repository.find_all` → `db.client.connections`; metric `portfolio_portfolio_service_get_balances_total{result=error}` |
| Перевод не записан | consume-span `instrumentation-amqplib` на queue `blockchain.events.portfolio` → `blockchain_events_daemon.get_event_routing` → `portfolio_service.process_transfer`; metric `portfolio_portfolio_service_process_transfer_total{result=error}` |
| Рассинхрон балансов | сравнить `increase(portfolio_portfolio_service_process_transfer_total[1h])` (события) с количеством дочерних спанов `token_balance_repository.update_balance` в Tempo (должно быть ≈1:2 — 1 transfer = 2 update) |
| Сервис не стартует | root `portfolio.init.main` → дочерние `portfolio.init.repositories_plugin` / `clients_plugin` — в каком слое ошибка; лог `monitoringPlugin` |
| MongoDB недоступна | span `portfolio.init.repositories_plugin.mongoose` (должен закрыться на `connected` event); на shutdown — `portfolio.stop.repositories_plugin` |
| RabbitMQ недоступен | span `portfolio.init.clients.rabbitmq_connect`; metric `messaging.client.*` |
| Демон не остановился при SIGTERM | `portfolio.stop.daemons.blockchain_events` (должен быть); если отсутствует — `daemonsPlugin.onStop` не отработал |
| `NotFoundError` на `findById` | warn в `@LogDecorator` (`failed`); error-лог от `ErrorHandlerPlugin` |
| Mongoose validation error на `create` / `findOneAndUpdate` | error-лог от `ErrorHandlerPlugin` + `process_transfer_total{result=error}` |
| `throw new Error("...")` для бизнес-ошибок | проверять по `logger.error('process_transfer — system_error', error)` — если в коде появится бизнес-ошибка, заброшенная как `Error` (а не `AppError`), она попадёт в ERROR-уровень как системная |

---

## 6. Состояние соответствия конвенциям rwa-observability

| Элемент конвенции | Состояние | Примечание |
|-------------------|-----------|-----------|
| `index.ts`: `tracer.startActiveSpan('<service>.init.main', ...)` | OK | `portfolio.init.main` в `index.ts:5` |
| `app.ts`: каждый слой обёрнут в `withTraceAsync/Sync('*.init.*', ...)` | OK | repositories, clients, services, daemons, controllers — все есть |
| `monitoringPlugin` + `healthPlugin` подключены первыми | OK | `app.ts:48-49` |
| `ErrorHandlerPlugin` подключён | OK | `app.ts:50` |
| `SIGTERM/SIGINT` handlers | OK | `index.ts:29-30` |
| `onStop` для daemon | OK | `daemons.plugin.ts:40-50` |
| `setSpanAttributes()` в публичных методах сервиса | **отсутствует** | 0 совпадений `setSpanAttributes` в `services/portfolio/src` — нельзя фильтровать спаны по `wallet`/`chainId`/etc. |
| Публичные методы сервисов: `@TraceDecorator` + `@MetricsDecorator` + `@LogDecorator` | частично | `PortfolioService` — OK; `BlockchainEventsDaemon.getEventRouting` — **только `@TraceDecorator`**, без `@MetricsDecorator` и `@LogDecorator` |
| `withTraceAsync` на `handleMessage` в `BaseBlockchainDaemon` | **отсутствует** | `shared/blockchain-daemon/src/baseBlockchain.daemon.ts:100-133` — обработка не обёрнута в span, полагается только на auto-consume-span от `instrumentation-amqplib` |
| Auto-instrumentation (mongoose, http, amqplib, runtime-node) | OK | включены в `shared/monitoring/src/monitoring.plugin.ts` |
| `console.log` в коде | OK | 0 совпадений в `services/portfolio/src` |
| Метрики `userId`/`wallet` как label | OK | нет таких метрик |
| RabbitMQ publish/consume span per event | частично | один consume-span от amqplib auto-instr (на всё сообщение); отдельный `withTraceAsync('*.rabbitmq.consume', ...)` не вызывается |
| `withTraceAsync('<service>.stop.<component>', ...)` на shutdown | частично | есть для `repositories_plugin`, `clients.rabbitmq_disconnect`, `daemons.blockchain_events`; корневой span на `shutdown()` в `index.ts` отсутствует |
