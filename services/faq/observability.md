# FAQ — Observability Reference

FAQ-сервис: CRUD по темам вопросов и ответам. Двухуровневая модель
(`Topic` → `Answer` с каскадным удалением). REST на Elysia, MongoDB
(Mongoose), OpenTelemetry. Брокеров/Redis/внешних клиентов нет.

- **SERVICE_NAME**: `faq`
- **Стек**: Bun + Elysia 1.3.5 + Mongoose 8.16.4
- **Хранилище**: MongoDB (две коллекции — `Topic`, `Answer`)
- **Порт**: `${FAQ_PORT}` (default см. `.env`)

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Корневой span создаётся в `index.ts` через `tracer.startActiveSpan`.
Все вложенные `withTrace*` оборачивают соответствующие стадии инициализации.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `faq.init.main` | `index.ts` | ~всё время старта | всё ниже | Корневой span init'а сервиса |
| `faq.init.repositories_plugin` | `app.ts` | ~MongoDB connect | см. ниже | Сборка плагина репозиториев |
| `faq.init.repositories.topic` | `plugins/repositories.plugin.ts` | синхронно | — | Инстанцирование `TopicRepository` |
| `faq.init.repositories.answer` | `plugins/repositories.plugin.ts` | синхронно | — | Инстанцирование `AnswerRepository` |
| `faq.init.repositories_plugin.mongoose` | `plugins/repositories.plugin.ts` | до события `connected` | — | `mongoose.connect(mongoUri)` — ждёт, пока соединение установится, и `ctx.end()` срабатывает на `connected` |
| `faq.init.repositories.plugin` | `plugins/repositories.plugin.ts` | синхронно | `faq.stop.repositories_plugin` (через `.onStop`) | Сборка `Elysia`-плагина Repositories с `.decorate` и shutdown-хуком |
| `faq.init.services_plugin` | `app.ts` | синхронно | см. ниже | Сборка плагина сервисов |
| `faq.init.services.faq` | `plugins/services.plugin.ts` | синхронно | — | `new FaqService(topicRepository, answerRepository)` |
| `faq.init.services.plugin` | `plugins/services.plugin.ts` | синхронно | — | Сборка `Elysia`-плагина Services с `.decorate("faqService", faqService)` |
| `faq.init.controllers_plugin` | `app.ts` | синхронно | см. ниже | Сборка плагина контроллеров |
| `faq.init.controllers.create_topic` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование CreateTopicController |
| `faq.init.controllers.update_topic` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование UpdateTopicController |
| `faq.init.controllers.delete_topic` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование DeleteTopicController |
| `faq.init.controllers.get_topic` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование GetTopicController |
| `faq.init.controllers.get_topics` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование GetTopicsController |
| `faq.init.controllers.create_answer` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование CreateAnswerController |
| `faq.init.controllers.update_answer` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование UpdateAnswerController |
| `faq.init.controllers.delete_answer` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование DeleteAnswerController |
| `faq.init.controllers.get_answer` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование GetAnswerController |
| `faq.init.controllers.get_answers` | `plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование GetAnswersController |
| `faq.init.controllers.plugin` | `plugins/controllers.plugin.ts` | синхронно | — | Сборка `Elysia`-плагина Controllers с подключением всех 10 контроллеров |
| `faq.init.elysia` | `app.ts` | до вызова `.listen` callback'а | — | Создание корневого `Elysia()`, подключение monitoring/health/ErrorHandler/plugins и `.listen(port)` |

_Примечание: имена init-спанов в `services.plugin.ts` и `controllers.plugin.ts`
используют формат `<service>.init.services.faq` / `<service>.init.controllers.create_topic`
(имя узла, а не `_plugin`), потому что в этих плагинах несколько шагов инициализации
(инстанцирование + сборка плагина). В `repositories.plugin.ts` — тот же паттерн
(`faq.init.repositories.topic` для инстанцирования + `faq.init.repositories.plugin`
для сборки Elysia-плагина). Это согласуется с общим соглашением платформы._
_В `app.ts` используется сокращённая форма `faq.init.repositories_plugin` /
`faq.init.services_plugin` / `faq.init.controllers_plugin` — один шаг на плагин._

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `faq.stop.repositories_plugin` | `plugins/repositories.plugin.ts` (внутри `.onStop`) | Elysia `.onStop` callback при остановке приложения (SIGTERM/SIGINT → `index.ts:shutdown`) | `mongoose.disconnect()` |

### 1.3. Runtime — бизнес-методы

#### FaqService (span prefix: faq_service)

Все 10 методов имеют стек `@TraceDecorator()` + `@MetricsDecorator()` +
`@LogDecorator({ args: [...] })`. `setSpanAttributes()` явно не вызывается —
`@TraceDecorator` оборачивает вызовы только в `tracer.startActiveSpan`, без
дополнительных атрибутов (это особенность сервиса; см. §6).

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `faq_service.create_topic` | — | `POST /createTopic` | `TopicRepository.create` → `Model.create()` | — |
| `faq_service.update_topic` | — | `POST /updateTopic` | `TopicRepository.update` → `Model.findByIdAndUpdate` | `NotFoundError("Topic", id)` если не найден |
| `faq_service.delete_topic` | — | `POST /deleteTopic` | `AnswerRepository.findAll({topicId})` + цикл `AnswerRepository.delete` + `TopicRepository.delete` | `NotFoundError("Topic", id)` |
| `faq_service.get_topic` | — | `POST /getTopic` | `TopicRepository.findById` → `Model.findById().lean()` | `NotFoundError("Topic", id)` |
| `faq_service.get_topics` | — | `POST /getTopics` | `TopicRepository.findAll(filter, sort, limit, offset)` → `Model.find().sort().skip().limit().lean()` | — |
| `faq_service.create_answer` | — | `POST /createAnswer` | `AnswerRepository.create` → `Model.create()` | — |
| `faq_service.update_answer` | — | `POST /updateAnswer` | `AnswerRepository.update` → `Model.findByIdAndUpdate` | `NotFoundError("Answer", id)` |
| `faq_service.delete_answer` | — | `POST /deleteAnswer` | `AnswerRepository.delete` → `Model.findByIdAndDelete` | `NotFoundError("Answer", id)` |
| `faq_service.get_answer` | — | `POST /getAnswer` | `AnswerRepository.findById` → `Model.findById().lean()` | `NotFoundError("Answer", id)` |
| `faq_service.get_answers` | — | `POST /getAnswers` | `AnswerRepository.findAll(filter, sort, limit, offset)` → `Model.find().sort().skip().limit().lean()` | — |

_Примечание: span name = camelToSnakeCase(className) + '.' + camelToSnakeCase(method).
Например, `FaqService.createTopic` → `faq_service.create_topic`. `setSpanAttributes()`
в коде не вызывается — спаны имеют только стандартные атрибуты OpenTelemetry._

#### TopicRepository (span prefix: topic_repository)

Все 5 методов имеют только `@TraceDecorator()`. Без `@MetricsDecorator`,
без `@LogDecorator`, без `setSpanAttributes` — паттерн репозиториев
платформы (см. `rwa-observability` §1.5).

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `topic_repository.create` | `faq_service.create_topic` | `Topic.create(data)` | возвращает `doc.toObject()` |
| `topic_repository.update` | `faq_service.update_topic` | `Topic.findByIdAndUpdate(id, data, {new: true}).lean()` | бросает `NotFoundError("Topic", id)` если `doc == null` |
| `topic_repository.delete` | `faq_service.delete_topic` | `Topic.findByIdAndDelete(id).lean()` | бросает `NotFoundError("Topic", id)` если `doc == null` |
| `topic_repository.find_by_id` | `faq_service.get_topic` | `Topic.findById(id).lean()` | бросает `NotFoundError("Topic", id)` если `doc == null` |
| `topic_repository.find_all` | `faq_service.get_topics` | `Topic.find(filter).sort(sort).skip(offset).limit(limit).lean()` | default `sort={createdAt: asc}`, `limit=100`, `offset=0` |

#### AnswerRepository (span prefix: answer_repository)

Все 5 методов имеют только `@TraceDecorator()`. Без `@MetricsDecorator`,
без `@LogDecorator`, без `setSpanAttributes`.

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `answer_repository.create` | `faq_service.create_answer` | `Answer.create(data)` | возвращает `doc.toObject()` |
| `answer_repository.update` | `faq_service.update_answer` | `Answer.findByIdAndUpdate(id, data, {new: true}).lean()` | бросает `NotFoundError("Answer", id)` если `doc == null` |
| `answer_repository.delete` | `faq_service.delete_answer`, `faq_service.delete_topic` (внутри цикла) | `Answer.findByIdAndDelete(id).lean()` | бросает `NotFoundError("Answer", id)` если `doc == null` |
| `answer_repository.find_by_id` | `faq_service.get_answer` | `Answer.findById(id).lean()` | бросает `NotFoundError("Answer", id)` если `doc == null` |
| `answer_repository.find_all` | `faq_service.get_answers`, `faq_service.delete_topic` (для получения списка ответов топика) | `Answer.find(filter).sort(sort).skip(offset).limit(limit).lean()` | default `sort={order: desc, createdAt: asc}`, `limit=100`, `offset=0` |

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP | instrumentation-http | `POST /createTopic`, `POST /updateTopic`, `POST /deleteTopic`, `POST /getTopic`, `POST /getTopics`, `POST /createAnswer`, `POST /updateAnswer`, `POST /deleteAnswer`, `POST /getAnswer`, `POST /getAnswers` | `http.method`, `http.target`, `http.status_code` |
| MongoDB | instrumentation-mongoose | `mongoose.Topic.*`, `mongoose.Answer.*` (create, find, findById, findByIdAndUpdate, findByIdAndDelete) | `db.mongodb.collection`, `db.operation` |
| Runtime | instrumentation-runtime-node | — (метрики, не спаны) | — |

_Активные инструменты: http + mongoose + runtime-node. Нет брокеров (RabbitMQ/Redis) — соответствующие инструменты не подключены._

### 1.5. Дебаг: полная иерархия для `POST /deleteTopic`

```
POST /deleteTopic                          ← HTTP auto-instr
  └── faq_service.delete_topic             ← @TraceDecorator + @MetricsDecorator + @LogDecorator
        ├── answer_repository.find_all     ← @TraceDecorator
        │     └── mongoose.Answer.find     ← mongoose auto-instr
        ├── (loop) answer_repository.delete  ← @TraceDecorator (×N)
        │     └── mongoose.Answer.findByIdAndDelete  ← mongoose auto-instr
        └── topic_repository.delete        ← @TraceDecorator
              └── mongoose.Topic.findByIdAndDelete   ← mongoose auto-instr
```

---

## 2. Логи

### 2.1. Business-логи

Все 10 методов `FaqService` имеют `@LogDecorator({ args: [...] })`. Поля
`args` намеренно ограничены идентификаторами, чтобы не лить в логи содержимое
вопросов/ответов целиком (PII-чувствительные поля).

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `createTopic` | `createTopic — called` с `{name}` | `createTopic — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `updateTopic` | `updateTopic — called` с `{id}` | `updateTopic — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `deleteTopic` | `deleteTopic — called` с `{id}` | `deleteTopic — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getTopic` | `getTopic — called` с `{id}` | `getTopic — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getTopics` | `getTopics — called` с `{filter}` | `getTopics — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `createAnswer` | `createAnswer — called` с `{question}` | `createAnswer — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `updateAnswer` | `updateAnswer — called` с `{id}` | `updateAnswer — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `deleteAnswer` | `deleteAnswer — called` с `{id}` | `deleteAnswer — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getAnswer` | `getAnswer — called` с `{id}` | `getAnswer — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getAnswers` | `getAnswers — called` с `{filter}` | `getAnswers — ok` | `— failed` → WARN; `— system_error` → ERROR |

_Все методы репозиториев не имеют `@LogDecorator` — логи только на уровне сервиса._

### 2.2. ErrorHandlerPlugin

Поведение `shared/errors/error-handler.plugin.ts`: **все** ошибки
(и `AppError`, и любые другие) логируются через `logger.error`. Различие —
только в HTTP-статусе ответа и коде ошибки.

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` (NotFoundError, ValidationError, и т.д.) | `logger.error` | `[${error.code}] ${error.message}` | `{statusCode, path, details, stack}` |
| Любая другая (500-class) | `logger.error` | `Unexpected error:` | `{path, error: ${error.name}: ${error.message}}` |

_HTTP-статус: 4xx для AppError, 500 для всего остального._

---

## 3. Метрики

### 3.1. Business метрики

`@MetricsDecorator()` стоит только на сервисном слое (10 методов `FaqService`),
каждый генерирует пару `_total` + `_duration`. На репозиториях декоратора
нет — латентность БД недоступна через Prometheus из-за
`suppressInternalInstrumentation: true` в `shared/monitoring/src/monitoring.plugin.ts`.

`Prometheus` имя считается как `SERVICE_NAME + _ + class_snake + _ + method_snake + _ + total|duration`. Например, `FaqService.createTopic` → `faq_faq_service_create_topic_total`. Удвоение `faq_` — конвенция платформы (см. `rwa-observability-docs` §4), оставлять как есть.

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `faq_faq_service_create_topic_total` | Counter | `result=success\|error` | Каждый вызов `createTopic` | RPS создания тем |
| `faq_faq_service_create_topic_duration` | Histogram | — | Каждый вызов `createTopic` | Латентность |
| `faq_faq_service_update_topic_total` | Counter | `result=success\|error` | Каждый вызов `updateTopic` | RPS обновления тем |
| `faq_faq_service_update_topic_duration` | Histogram | — | Каждый вызов `updateTopic` | Латентность |
| `faq_faq_service_delete_topic_total` | Counter | `result=success\|error` | Каждый вызов `deleteTopic` | RPS удаления тем |
| `faq_faq_service_delete_topic_duration` | Histogram | — | Каждый вызов `deleteTopic` | Латентность (включает каскадное удаление ответов) |
| `faq_faq_service_get_topic_total` | Counter | `result=success\|error` | Каждый вызов `getTopic` | RPS чтения темы |
| `faq_faq_service_get_topic_duration` | Histogram | — | Каждый вызов `getTopic` | Латентность |
| `faq_faq_service_get_topics_total` | Counter | `result=success\|error` | Каждый вызов `getTopics` | RPS списка тем |
| `faq_faq_service_get_topics_duration` | Histogram | — | Каждый вызов `getTopics` | Латентность |
| `faq_faq_service_create_answer_total` | Counter | `result=success\|error` | Каждый вызов `createAnswer` | RPS создания ответов |
| `faq_faq_service_create_answer_duration` | Histogram | — | Каждый вызов `createAnswer` | Латентность |
| `faq_faq_service_update_answer_total` | Counter | `result=success\|error` | Каждый вызов `updateAnswer` | RPS обновления ответов |
| `faq_faq_service_update_answer_duration` | Histogram | — | Каждый вызов `updateAnswer` | Латентность |
| `faq_faq_service_delete_answer_total` | Counter | `result=success\|error` | Каждый вызов `deleteAnswer` | RPS удаления ответов |
| `faq_faq_service_delete_answer_duration` | Histogram | — | Каждый вызов `deleteAnswer` | Латентность |
| `faq_faq_service_get_answer_total` | Counter | `result=success\|error` | Каждый вызов `getAnswer` | RPS чтения ответа |
| `faq_faq_service_get_answer_duration` | Histogram | — | Каждый вызов `getAnswer` | Латентность |
| `faq_faq_service_get_answers_total` | Counter | `result=success\|error` | Каждый вызов `getAnswers` | RPS списка ответов |
| `faq_faq_service_get_answers_duration` | Histogram | — | Каждый вызов `getAnswers` | Латентность |

_Прямых `metrics.counter/histogram/gauge` вызовов в коде нет — все метрики
генерируются декоратором. Имена: `faq_faq_service_*` (двойной `faq_`) — см.
`rwa-observability-docs` §4, конвенция для случая, когда SERVICE_NAME
совпадает с snake_case именем класса._

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | runtime-node | CPU, memory, event loop lag, GC |
| `http.server.*` | HTTP auto-instr | RPS, latency, status codes |
| `db.client.*` | MongoDB auto-instr | Количество запросов, latency |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |

### 3.3. Примеры PromQL

```promql
# Ошибки создания тем за 5 минут
rate(faq_faq_service_create_topic_total{result="error"}[5m])

# P99 латентность удаления темы (включает каскадное удаление ответов)
histogram_quantile(0.99, rate(faq_faq_service_delete_topic_duration_bucket[5m]))

# Количество операций чтения за 24ч
increase(faq_faq_service_get_topics_total[24h])

# Доля ошибок по операциям с темами за 5 минут
sum(rate(faq_faq_service_create_topic_total{result="error"}[5m]))
  / sum(rate(faq_faq_service_create_topic_total[5m]))
```

---

## 4. Health-check

### `GET /health`

Подключён `healthPlugin` из `@shared/monitoring/src/health.plugin` в
`app.ts` (на том же уровне, что и `monitoringPlugin` + `ErrorHandlerPlugin`).
Стандартный для платформы health-endpoint, см. `rwa-observability` skill.

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Долгий `POST /deleteTopic` | span `faq_service.delete_topic` → каскад из N вызовов `answer_repository.delete`; метрика `faq_faq_service_delete_topic_duration` |
| `404` при `POST /getTopic` / `POST /getAnswer` | WARN-лог `getTopic — failed` / `getAnswer — failed` от `@LogDecorator` (NotFoundError), ERROR-лог `[NOT_FOUND] Topic ...` от `ErrorHandlerPlugin` |
| `500` на любой операции | ERROR-лог `<method> — system_error` (от `@LogDecorator`) И `Unexpected error:` (от `ErrorHandlerPlugin`) |
| Медленные ответы MongoDB | метрики `db.client.*`; спаны `mongoose.Topic.*` / `mongoose.Answer.*` под репозиторными спанами |
| Сервис не стартует | span `faq.init.repositories_plugin.mongoose` — зависает, если MongoDB недоступна |
| Утечка Mongo-соединений при перезапуске | shutdown-span `faq.stop.repositories_plugin` (должен сработать по SIGTERM/SIGINT → `index.ts:shutdown`) |
