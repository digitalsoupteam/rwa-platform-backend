# Charts — Observability Reference

Сервис финансовых/рыночных графиков: хранит временные ряды цен пулов и
транзакции (MINT/BURN) в MongoDB, агрегирует OHLC и Volume, публикует
обновления в Redis для downstream UI, и потребляет блокчейн-события
`Pool_ReservesUpdated` / `Pool_RwaMinted` / `Pool_RwaBurned` из RabbitMQ.

- **SERVICE_NAME** (env): `CHARTS_SERVICE_NAME` → отображается в Tempo/Prometheus как `charts`
- **Стек**: Bun + Elysia.js, MongoDB (Mongoose), Redis (`@shared/redis-events`), RabbitMQ (`@shared/rabbitmq`), OpenTelemetry
- **Health**: `GET /health` (через `healthPlugin` из `@shared/monitoring`)
- **Production**: поднимается в `infrastructure/docker/docker-compose.yml` как сервис `charts`

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Корневой span `charts.init.main` оборачивает весь запуск в `index.ts`.
Далее каждый слой — отдельный span в `app.ts` и собственных плагинах.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `charts.init.main` | `index.ts` (`tracer.startActiveSpan`) | всё время старта | всё ниже | Корневой span запуска сервиса |
| `charts.init.repositories_plugin` | `app.ts` (`withTraceAsync`) | весь импорт `repositories.plugin` | `charts.init.repositories.price_data`, `charts.init.repositories.pool_transaction`, `charts.init.repositories_plugin.mongoose` | Сборка репозиториев + connect к MongoDB |
| `charts.init.repositories.price_data` | `repositories.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Инстанцирование `PriceDataRepository` |
| `charts.init.repositories.pool_transaction` | `repositories.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Инстанцирование `PoolTransactionRepository` |
| `charts.init.repositories_plugin.mongoose` | `repositories.plugin.ts` (`withTraceAsync`) | до события `connected` | mongoose auto-spans | `mongoose.connect(uri)` и ожидание `connected` |
| `charts.init.repositories.plugin` | `repositories.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Elysia-плагин `Repositories` с `.decorate(...)` |
| `charts.init.clients_plugin` | `app.ts` (`withTraceAsync`) | весь импорт `clients.plugin` | redis/rabbit/connect спаны | Сборка клиентов |
| `charts.init.clients.redis_events` | `clients.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Инстанцирование `RedisEventsClient` |
| `charts.init.clients.chart_events` | `clients.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Инстанцирование `ChartEventsClient` |
| `charts.init.clients.rabbitmq` | `clients.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Инстанцирование `RabbitMQClient` |
| `charts.init.clients.rabbitmq_connect` | `clients.plugin.ts` (`withTraceAsync`) | до установления AMQP-соединения | amqplib auto-span | `rabbitMQClient.connect()` |
| `charts.init.clients.plugin` | `clients.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Elysia-плагин `Clients` с `.decorate(...)` |
| `charts.init.services_plugin` | `app.ts` (`withTraceSync`) | весь импорт `services.plugin` | см. ниже | Сборка сервисов |
| `charts.init.services.charts` | `services.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Инстанцирование `ChartsService` |
| `charts.init.services.transactions` | `services.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Инстанцирование `TransactionsService` |
| `charts.init.services.plugin` | `services.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Elysia-плагин `Services` с `.decorate(...)` |
| `charts.init.controllers_plugin` | `app.ts` (`withTraceSync`) | весь импорт `controllers.plugin` | спаны init'а каждого контроллера | Сборка роутов |
| `charts.init.controllers.get_raw_price_data` | `controllers.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Фабрика `getRawPriceDataController` |
| `charts.init.controllers.get_ohlc_price_data` | `controllers.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Фабрика `getOhlcPriceDataController` |
| `charts.init.controllers.get_pool_transactions` | `controllers.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Фабрика `getPoolTransactionsController` |
| `charts.init.controllers.get_volume_data` | `controllers.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Фабрика `getVolumeDataController` |
| `charts.init.controllers.plugin` | `controllers.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Elysia-плагин `Controllers` |
| `charts.init.daemons_plugin` | `app.ts` (`withTraceAsync`) | весь импорт `daemons.plugin` | см. ниже | Сборка и запуск демонов |
| `charts.init.daemons.blockchain_events` | `daemons.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Инстанцирование `BlockchainEventsDaemon` |
| `charts.init.daemons.initialize` | `daemons.plugin.ts` (`withTraceAsync`) | `initialize()` + `start()` демона | — | Конкретный запуск consumer RabbitMQ |
| `charts.init.daemons.plugin` | `daemons.plugin.ts` (`withTraceSync`) | ~миллисекунды | — | Elysia-плагин `Daemons` |
| `charts.init.elysia` | `app.ts` (`withTraceSync`) | `new Elysia().use(...).listen(port, ...)` | все спаны первого запроса | Поднятие HTTP-сервера Elysia |

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `charts.stop.repositories_plugin` | `repositories.plugin.ts` (`.onStop`) | SIGTERM/SIGINT → `app.stop()` | `mongoose.disconnect()` |
| `charts.stop.clients` | `clients.plugin.ts` (`.onStop`) | SIGTERM/SIGINT → `app.stop()` | `redisEventsClient.close()` |
| `charts.stop.daemons` | `daemons.plugin.ts` (`.onStop`) | SIGTERM/SIGINT → `app.stop()` | `blockchainEventsDaemon.stop()` (через `BaseBlockchainDaemon`) |

### 1.3. Runtime — бизнес-методы

Конвенция нейминга: span = `camelToSnakeCase(<class>) + '.' + camelToSnakeCase(<method>)`.

#### ChartsService (snake_case префикс: charts_service)

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `charts_service.record_price_data` | `poolAddress`, `blockNumber` (если бы был `setSpanAttributes` — в текущем коде вызов отсутствует) | `BlockchainEventsDaemon` (consumer `Pool_ReservesUpdated`) | `PriceDataRepository.create()` (Mongo `priceData.insertOne`), `ChartEventsClient.publishPriceUpdate()` (Redis publish `charts:price:<pool>`) | `ValidationError` (virtualRwaReserve = 0) |
| `charts_service.get_raw_price_data` | — | `POST /getRawPriceData` (`getRawPriceDataController`) | `PriceDataRepository.findByPoolAndTimeRange()` → `findAll()` (Mongo query) | — |
| `charts_service.get_ohlc_price_data` | — | `POST /getOhlcPriceData` (`getOhlcPriceDataController`) | `PriceDataRepository.aggregateOhlcData()` (Mongo aggregation pipeline) | `ValidationError` (неподдерживаемый `interval`) |

_Примечание: `setSpanAttributes()` в коде сейчас нигде не вызывается
(`grep "setSpanAttributes" services/charts/src/` → 0). Это разрыв с конвенцией
`rwa-observability` §1.5. Для поиска в Tempo используются имена спанов
и автоматические `http.target` / `messaging.rabbitmq.*` атрибуты._

#### TransactionsService (snake_case префикс: transactions_service)

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `transactions_service.record_transaction` | — | `BlockchainEventsDaemon` (consumer `Pool_RwaMinted`, `Pool_RwaBurned`) | `PoolTransactionRepository.create()` (Mongo `poolTransaction.insertOne`), `ChartEventsClient.publishTransactionUpdate()` (Redis publish `charts:transactions:<pool>`) | — |
| `transactions_service.get_transactions` | — | `POST /getPoolTransactions` (`getPoolTransactionsController`) | `PoolTransactionRepository.findAll()` (Mongo query с пагинацией) | — |
| `transactions_service.get_volume_data` | — | `POST /getVolumeData` (`getVolumeDataController`) | `PoolTransactionRepository.aggregateVolumeData()` (Mongo aggregation pipeline) | `ValidationError` (неподдерживаемый `interval`) |

#### PriceDataRepository (snake_case префикс: price_data_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `price_data_repository.create` | `charts_service.record_price_data` | `PriceData.insertOne(...)` | Запись новой цены пула |
| `price_data_repository.find_all` | `price_data_repository.find_by_pool_and_time_range` (внутри) | `PriceData.find(...).sort().skip().limit().lean().exec()` | Пагинированный список с фильтром |
| `price_data_repository.find_latest_by_pool_address` | _(в текущем коде напрямую не вызывается из сервисов; зарезервирован для будущих use-кейсов)_ | `PriceData.findOne({ poolAddress }).sort({ timestamp: -1 })` | Самая свежая запись для пула |
| `price_data_repository.find_by_pool_and_time_range` | `charts_service.get_raw_price_data` | `PriceData.find({ poolAddress, timestamp: { $gte, $lte } })` | Использует составной индекс `{poolAddress:1, timestamp:-1}` |
| `price_data_repository.aggregate_ohlc_data` | `charts_service.get_ohlc_price_data` | `PriceData.aggregate([$match, $sort, $group, $project, $sort, $limit?])` | OHLC по интервалам |

#### PoolTransactionRepository (snake_case префикс: pool_transaction_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `pool_transaction_repository.create` | `transactions_service.record_transaction` | `PoolTransaction.insertOne(...)` | Запись MINT/BURN |
| `pool_transaction_repository.find_all` | `transactions_service.get_transactions` | `PoolTransaction.find(...).sort().skip().limit().lean()` | Использует индекс `{poolAddress:1, timestamp:-1}` и `{userAddress:1, timestamp:-1}` |
| `pool_transaction_repository.aggregate_volume_data` | `transactions_service.get_volume_data` | `PoolTransaction.aggregate([$match, $group×2, $project, $sort, $limit?])` | Объёмы MINT/BURN по интервалам |

#### ChartEventsClient (snake_case префикс: chart_events_client)

| Span name | Вызывается из | Сетевая операция | Примечание |
|-----------|---------------|-------------------|------------|
| `chart_events_client.publish_price_update` | `charts_service.record_price_data` | Redis `PUBLISH charts:price:<poolAddress>` через `RedisEventsClient.publish()` | Канал `charts:price:<pool>`, тип события `PRICE_UPDATE` |
| `chart_events_client.publish_transaction_update` | `transactions_service.record_transaction` | Redis `PUBLISH charts:transactions:<poolAddress>` | Канал `charts:transactions:<pool>`, тип события `TRANSACTION_UPDATE` |

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP (server) | `instrumentation-http` | `POST /getRawPriceData`, `POST /getOhlcPriceData`, `POST /getPoolTransactions`, `POST /getVolumeData` | `http.target`, `http.status_code`, `http.method` |
| HTTP (client) | `instrumentation-http` | любые внешние HTTP-вызовы из сервиса (в текущем коде отсутствуют) | — |
| MongoDB | `instrumentation-mongoose` | `PriceData.insertOne/find/findOne/aggregate`, `PoolTransaction.insertOne/find/aggregate` | `db.mongodb.collection`, `db.operation` |
| Redis | `instrumentation-ioredis` (+ `RedisWithTracing` через `@shared/redis-events`) | `PUBLISH charts:price:...`, `PUBLISH charts:transactions:...` | `db.redis.operation=PUBLISH`, channel name |
| RabbitMQ | `instrumentation-amqplib` (через `RabbitMQClient`) | `connect`, `publish` (если публикует сам), `consume` (в `BaseBlockchainDaemon`) | `messaging.system=rabbitmq`, exchange/queue |
| DNS | `instrumentation-dns` | `dns.lookup` при resolve хоста из `MONGODB_URI`, `REDIS_URL`, `RABBITMQ_URL` | — |
| FS | `instrumentation-fs` | чтение TLS-сертификатов, конфигов | — |
| Net | `instrumentation-net` | TCP-соединения к MongoDB/Redis/RabbitMQ | — |
| Runtime | `instrumentation-runtime-node` | — (метрики, не спаны) | — |

_`instrumentation-mongoose` активен потому что есть MongoDB._
_`instrumentation-amqplib` активен потому что daemon потребляет из RabbitMQ._
_`instrumentation-ioredis` активен потому что `ChartEventsClient` публикует в Redis._

### 1.5. Дебаг: полная иерархия для ключевой операции `record_price_data`

```
POST / (RabbitMQ amqplib consume)          ← amqplib auto-instr
  └── (amqplib consume-span от BaseBlockchainDaemon — детали в shared-пакете @shared/blockchain-daemon)
    └── Pool_ReservesUpdated handler       ← BlockchainEventsDaemon routing
        └── charts_service.record_price_data   ← @TraceDecorator
              ├── price_data_repository.create ← @TraceDecorator
              │     └── mongoose.insertOne      ← mongoose auto-instr
              └── chart_events_client.publish_price_update ← @TraceDecorator
                    └── redis PUBLISH charts:price:<pool>   ← ioredis auto-instr
```

---

## 2. Логи

### 2.1. Business-логи

Все публичные методы сервисов и daemon-routing имеют `@LogDecorator` с
диагностическими аргументами. `ErrorHandlerPlugin` логирует ошибки
через `logger.error` (и для `AppError`/`ValidationError`, и для неизвестных).

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `ChartsService.record_price_data` | `<Class>.<method> — called` с `{ data.poolAddress, data.timestamp, data.blockNumber }` | `<Class>.<method> — ok` | `ValidationError` → `logger.error` через ErrorHandlerPlugin |
| `ChartsService.get_raw_price_data` | `<Class>.<method> — called` с `{ poolAddress, startTime, endTime }` | `<Class>.<method> — ok` | ошибки БД → `logger.error` |
| `ChartsService.get_ohlc_price_data` | `<Class>.<method> — called` с `{ poolAddress, interval, startTime, endTime }` | `<Class>.<method> — ok` | `ValidationError` (неподдерживаемый `interval`) → `logger.error` |
| `TransactionsService.record_transaction` | `<Class>.<method> — called` с `{ data.poolAddress, data.transactionType, data.userAddress }` | `<Class>.<method> — ok` | ошибки БД → `logger.error` |
| `TransactionsService.get_transactions` | `<Class>.<method> — called` с `{ params.filter, params.sort }` | `<Class>.<method> — ok` | ошибки БД → `logger.error` |
| `TransactionsService.get_volume_data` | `<Class>.<method> — called` с `{ poolAddress, interval, startTime, endTime }` | `<Class>.<method> — ok` | `ValidationError` → `logger.error` |

_Репозитории (`PriceDataRepository`, `PoolTransactionRepository`) и
`ChartEventsClient` не имеют `@LogDecorator` — это намеренно по конвенции
(логи только на сервисном слое)._
_Контроллеры тоже без `@LogDecorator` — HTTP-логирование уже даёт
`@opentelemetry/instrumentation-http`._

Прямые `logger.*` вызовы в коде (помимо декораторов):

| Файл | Сообщение | Уровень | Контекст |
|------|-----------|---------|----------|
| `repositories.plugin.ts` | `"Connecting to MongoDB"` | `info` | `{ uri: mongoUri }` |
| `repositories.plugin.ts` | `"MongoDB connected successfully"` | `info` | — |
| `repositories.plugin.ts` | `"Disconnecting from MongoDB"` | `info` | (в `.onStop`) |
| `repositories.plugin.ts` | `"MongoDB disconnected successfully"` | `info` | (в `.onStop`) |
| `clients.plugin.ts` | `"Initializing clients"` | `debug` | (перед `rabbitMQClient.connect()`) |
| `clients.plugin.ts` | `"Stopping clients"` | `debug` | (в `.onStop`, перед `redisEventsClient.close()`) |
| `daemons.plugin.ts` | `"Initializing daemons"` | `debug` | (перед `blockchainEventsDaemon.initialize()` + `start()`) |

### 2.2. ErrorHandlerPlugin

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` (включая `ValidationError`) | `error` | `error.message` | `{ error, errorName, errorStack, path }` |
| Любая другая ошибка | `error` | `error.message` | `{ error, errorName, errorStack, path }` |

> `ErrorHandlerPlugin` из `@shared/errors/error-handler.plugin.ts` логирует
> ВСЕ ошибки через `logger.error` (и `AppError`, и любые другие). Это
> соответствует конвенции `rwa-observability` §9.1.

---

## 3. Метрики

### 3.1. Business метрики

Все метрики автоматически префиксируются именем сервиса (`SERVICE_NAME=charts`)
через `OTelMetrics`.

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `charts_charts_service_record_price_data_total` | Counter | `result=success\|error` | Каждый вызов `recordPriceData` (consumer `Pool_ReservesUpdated`) | Объём записанных цен |
| `charts_charts_service_record_price_data_duration` | Histogram | — | Каждый вызов `recordPriceData` | Латентность обработки reserves |
| `charts_charts_service_get_raw_price_data_total` | Counter | `result=success\|error` | Каждый HTTP-запрос `POST /getRawPriceData` | Использование API |
| `charts_charts_service_get_raw_price_data_duration` | Histogram | — | Каждый вызов `getRawPriceData` | Латентность чтения |
| `charts_charts_service_get_ohlc_price_data_total` | Counter | `result=success\|error` | Каждый HTTP-запрос `POST /getOhlcPriceData` | Использование API |
| `charts_charts_service_get_ohlc_price_data_duration` | Histogram | — | Каждый вызов `getOhlcPriceData` | Латентность агрегации OHLC |
| `charts_transactions_service_record_transaction_total` | Counter | `result=success\|error` | Каждый вызов `recordTransaction` (consumers `Pool_RwaMinted`, `Pool_RwaBurned`) | Объём записанных транзакций |
| `charts_transactions_service_record_transaction_duration` | Histogram | — | Каждый вызов `recordTransaction` | Латентность обработки MINT/BURN |
| `charts_transactions_service_get_transactions_total` | Counter | `result=success\|error` | Каждый HTTP-запрос `POST /getPoolTransactions` | Использование API |
| `charts_transactions_service_get_transactions_duration` | Histogram | — | Каждый вызов `getTransactions` | Латентность чтения |
| `charts_transactions_service_get_volume_data_total` | Counter | `result=success\|error` | Каждый HTTP-запрос `POST /getVolumeData` | Использование API |
| `charts_transactions_service_get_volume_data_duration` | Histogram | — | Каждый вызов `getVolumeData` | Латентность агрегации Volume |

_Все `_total` метрики получаются из `@MetricsDecorator` (Prometheus-имя
собирается как `<SERVICE_NAME>_<class_snake>_<method_snake>_total`,
точки в имени класса/метода заменяются на `_`)._

_Прямых `metrics.counter/histogram/gauge` вызовов в коде нет
(`grep "metrics\\.\\(counter\\|histogram\\|gauge\\|batchCounter\\)" services/charts/src/` → 0).
Все метрики — от `@MetricsDecorator`._

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | runtime-node | CPU, memory, event loop lag, GC |
| `http.server.*` | HTTP auto-instr | RPS, latency, status codes для `POST /get*` |
| `db.client.*` | MongoDB auto-instr | Количество запросов к `priceData`/`poolTransaction`, latency |
| `db.client.connections.*` | ioredis auto-instr | Соединения Redis |
| `messaging.*` | amqplib auto-instr | Публикация/потребление в `blockchain.events.charts` |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |

### 3.3. Примеры PromQL

```promql
# Ошибки записи цены за 5 минут
rate(charts_charts_service_record_price_data_total{result="error"}[5m])

# P99 латентность OHLC-агрегации
histogram_quantile(0.99, rate(charts_charts_service_get_ohlc_price_data_duration_bucket[5m]))

# Количество обработанных MINT/BURN за сутки
increase(charts_transactions_service_record_transaction_total[24h])

# Доля ошибок в getVolumeData
sum(rate(charts_transactions_service_get_volume_data_total{result="error"}[5m]))
  /
sum(rate(charts_transactions_service_get_volume_data_total[5m]))
```

---

## 4. Health-check

### `GET /health`

Подключён через `healthPlugin` из `@shared/monitoring`. Возвращает
стандартный JSON-ответ сервиса. Проверка используется в Uptime Kuma
(`http://charts:3000/health`) и в docker-compose health-чеке.

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует | `charts.init.main` → `charts.init.repositories_plugin` → `charts.init.repositories_plugin.mongoose` (зависает = MongoDB недоступна). Проверить `MONGODB_URI` |
| OHLC/Volume возвращают 500 | `charts_charts_service_get_ohlc_price_data_total{result="error"}` + логи с `errorStack`. Типично — `ValidationError` на нестандартный `interval` |
| Графики не обновляются в UI | `charts_transactions_service_record_transaction_total` (нет инкремента = consumer RabbitMQ не работает). Проверить `RABBITMQ_URL` и `charts.init.daemons.initialize` / `blockchainEventsDaemon` |
| Публикация Redis не доходит до UI | `chart_events_client.publish_price_update` / `publish_transaction_update` — ищем ошибки внутри. Также проверить `db.client.connections` от ioredis |
| Redis-клиент не закрывается при shutdown | `charts.stop.clients` — должно содержать `redisEventsClient.close()` |
| Daemon не останавливается | `charts.stop.daemons` — `BlockchainEventsDaemon.stop()` через `BaseBlockchainDaemon` |
| Потребление RabbitMQ рассинхронизировано | Искать спаны `BaseBlockchainDaemon.handleMessage` (rabbitmq-consume auto-span от amqplib instrumentation) — `eventName`, `blockNumber`, `transactionHash` атрибуты |
| Высокая латентность OHLC | `histogram_quantile` на `charts_charts_service_get_ohlc_price_data_duration` + проверить индексы `priceDataSchema.index({ poolAddress: 1, timestamp: -1 })` |