# AI Assistant — Observability Reference

AI-ассистент для платформы RWA. Управляет ассистентами (создание, настройка контекста),
сообщениями и интеграцией с OpenRouter для генерации AI-ответов.

- **SERVICE_NAME:** `ai-assistant`
- **Порт:** из `process.env.PORT`
- **БД:** MongoDB (Assistant, Message)
- **Клиенты:** OpenRouterClient + Eden Treaty (RWA service, Portfolio service)
- **Daemon-ы:** нет

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `ai-assistant.init.main` | `index.ts:4` | ~всё время старта | всё ниже | Корневой span сервиса |
| `ai-assistant.init.repositories_plugin` | `app.ts:20` | ~MongoDB connect | `repositories.assistant`, `repositories.message`, `repositories_plugin.mongoose` | Подключение к MongoDB + создание репозиториев |
| `ai-assistant.init.repositories.assistant` | `plugins/repositories.plugin.ts:8` | <5ms | — | Создание AssistantRepository |
| `ai-assistant.init.repositories.message` | `plugins/repositories.plugin.ts:13` | <5ms | — | Создание MessageRepository |
| `ai-assistant.init.repositories_plugin.mongoose` | `plugins/repositories.plugin.ts:18` | ~connect | — | Подключение Mongoose к MongoDB |
| `ai-assistant.init.clients_plugin` | `app.ts:25` | <10ms | `clients.openrouter`, `clients.rwa`, `clients.portfolio`, `clients.plugin` | Создание внешних клиентов |
| `ai-assistant.init.clients.openrouter` | `plugins/clients.plugin.ts:12` | <5ms | — | Создание OpenRouterClient |
| `ai-assistant.init.clients.rwa` | `plugins/clients.plugin.ts:17` | <5ms | — | Создание Eden Treaty клиента к RWA service |
| `ai-assistant.init.clients.portfolio` | `plugins/clients.plugin.ts:22` | <5ms | — | Создание Eden Treaty клиента к Portfolio service |
| `ai-assistant.init.clients.plugin` | `plugins/clients.plugin.ts:27` | <5ms | — | Регистрация Elysia-плагина Clients |
| `ai-assistant.init.services_plugin` | `app.ts:30` | <5ms | `services.context`, `services.assistant`, `services.message`, `services.plugin` | Создание сервисов бизнес-логики |
| `ai-assistant.init.services.context` | `plugins/services.plugin.ts:14` | <5ms | — | Создание ContextService |
| `ai-assistant.init.services.assistant` | `plugins/services.plugin.ts:22` | <5ms | — | Создание AssistantService |
| `ai-assistant.init.services.message` | `plugins/services.plugin.ts:27` | <5ms | — | Создание MessageService |
| `ai-assistant.init.services.plugin` | `plugins/services.plugin.ts:38` | <5ms | — | Регистрация Elysia-плагина Services |
| `ai-assistant.init.controllers_plugin` | `app.ts:35` | <10ms | 10 контроллеров | Создание и регистрация всех контроллеров |
| `ai-assistant.init.controllers.*` | `plugins/controllers.plugin.ts:16-62` | <5ms каждый | — | 10 отдельных span-ов на каждый контроллер |
| `ai-assistant.init.controllers.plugin` | `plugins/controllers.plugin.ts:66` | <5ms | — | Регистрация Elysia-плагина Controllers |
| `ai-assistant.init.elysia` | `app.ts:40` | ~listen | — | Запуск Elysia `.listen(port)` |

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `ai-assistant.stop.repositories_plugin` | `plugins/repositories.plugin.ts:34` | .onStop() | Отключение Mongoose от MongoDB |

### 1.3. Runtime — бизнес-методы

Атрибуты на спаны ставятся явно через `setSpanAttributes()` в теле метода.

#### AssistantService (префикс `assistant_service`)

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `assistant_service.create_assistant` | `userId` | `POST /createAssistant` | `assistantRepository.create()` | `NotFoundError` (не выбрасывается) |
| `assistant_service.update_assistant` | `assistantId` | `POST /updateAssistant` | `assistantRepository.update()` | `NotFoundError` если id не найден |
| `assistant_service.get_assistant` | `assistantId` | `POST /getAssistant` | `assistantRepository.findById()` | `NotFoundError` если id не найден |
| `assistant_service.get_user_assistants` | `userId` | `POST /getUserAssistants` | `assistantRepository.findAll({userId})` | — |
| `assistant_service.delete_assistant` | `assistantId` | `POST /deleteAssistant` | `assistantRepository.delete()` | `NotFoundError` если id не найден |

#### MessageService (префикс `message_service`)

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `message_service.create_message` | `assistantId`, `model` | `POST /createMessage` | `assistantRepository.findById()`, `messageRepository.create()` (×2), `messageRepository.findByAssistantId()`, `contextService.getContextForAssistant()`, **`openRouterClient.chatCompletion()`** | `NotFoundError`, ошибка OpenRouter |
| `message_service.get_message_history` | `assistantId` | `POST /getMessageHistory` | `assistantRepository.findById()`, `messageRepository.findByAssistantId()` | `NotFoundError` |
| `message_service.get_message` | `messageId` | `POST /getMessage` | `messageRepository.findById()` | `NotFoundError` |
| `message_service.delete_message` | `messageId` | `POST /deleteMessage` | `messageRepository.delete()` | `NotFoundError` |
| `message_service.update_message` | `messageId` | `POST /updateMessage` | `messageRepository.update()` | `NotFoundError` |

#### ContextService (префикс `context_service`)

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `context_service.get_context_for_assistant` | `userId`, `contextPreferences` (csv) | вызывается из `messageService.createMessage()` | `getPopularPoolsContext()`, `getUserPortfolioContext()` | Любые ошибки игнорируются (return null) |
| `context_service.get_popular_pools_context` | `contextType=popular_pools` | вызывается из `getContextForAssistant()` | **HTTP**: `rwaClient.getPools.post()` | Любые ошибки игнорируются (return null) |
| `context_service.get_user_portfolio_context` | `userId`, `contextType=user_portfolio` | вызывается из `getContextForAssistant()` | **HTTP**: `portfolioClient.getBalances.post()`, `rwaClient.getPools.post()` | Любые ошибки игнорируются (return null) |

#### AssistantRepository (префикс `assistant_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `assistant_repository.create` | `assistantService.createAssistant()` | `Model.create()` | — |
| `assistant_repository.update` | `assistantService.updateAssistant()` | `Model.findByIdAndUpdate()` | Бросает `NotFoundError` |
| `assistant_repository.delete` | `assistantService.deleteAssistant()` | `Model.findByIdAndDelete()` | Бросает `NotFoundError` |
| `assistant_repository.find_by_id` | `assistantService.*()`, `messageService.*()` | `Model.findById()` | Бросает `NotFoundError` |
| `assistant_repository.find_all` | `assistantService.getUserAssistants()` | `Model.find().sort().skip().limit()` | — |

#### MessageRepository (префикс `message_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `message_repository.create` | `messageService.createMessage()` | `Model.create()` | Вызывается 2 раза: user message + AI response |
| `message_repository.update` | `messageService.updateMessage()` | `Model.findByIdAndUpdate()` | Бросает `NotFoundError` |
| `message_repository.delete` | `messageService.deleteMessage()` | `Model.findByIdAndDelete()` | Бросает `NotFoundError` |
| `message_repository.find_by_id` | `messageService.getMessage()` | `Model.findById()` | Бросает `NotFoundError` |
| `message_repository.find_by_assistant_id` | `messageService.createMessage()`, `messageService.getMessageHistory()` | `Model.find({assistantId}).sort().skip().limit()` | — |

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP | instrumentation-http | `POST /...` (входящие), `POST ...` (Eden Treaty вызовы к RWA/Portfolio) | `http.status_code`, `http.target`, `http.url` |
| MongoDB | instrumentation-mongoose | `mongoose.Assistant.*`, `mongoose.Message.*` | `db.mongodb.collection`, `db.operation` |
| DNS | instrumentation-dns | `dns.lookup` | — |
| FS | instrumentation-fs | `fs.*` | — |
| Net | instrumentation-net | `net.*` | — |
| Runtime | instrumentation-runtime-node | — (метрики, не спаны) | — |

### 1.5. Полная иерархия для `createMessage`

Ключевая операция сервиса — отправка сообщения в LLM:

```
POST /createMessage                                   ← HTTP auto-instr (входящий)
  └── message_service.create_message {assistantId, model=deepseek/...}  ← @TraceDecorator + setSpanAttributes
        ├── assistant_repository.find_by_id           ← @TraceDecorator
        │     └── mongoose.Assistant.findById()       ← mongoose auto-instr
        ├── message_repository.create (user msg)      ← @TraceDecorator
        │     └── mongoose.Message.create()           ← mongoose auto-instr
        ├── message_repository.find_by_assistant_id   ← @TraceDecorator
        │     └── mongoose.Message.find()             ← mongoose auto-instr
        ├── context_service.get_context_for_assistant {userId, contextPreferences=investor_base,popular_pools}  ← @TraceDecorator + setSpanAttributes
        │   ├── context_service.get_popular_pools_context {contextType=popular_pools}
        │   │     └── HTTP POST → rwaClient         ← HTTP auto-instr (client span)
        │   └── context_service.get_user_portfolio_context {userId, contextType=user_portfolio}
        │         ├── HTTP POST → portfolioClient   ← HTTP auto-instr
        │         └── HTTP POST → rwaClient          ← HTTP auto-instr
        ├── open_router_client.chat_completion        ← @TraceDecorator (из @shared/openrouter)
        │     └── HTTP POST → openrouter.ai           ← HTTP auto-instr
        └── message_repository.create (AI response)   ← @TraceDecorator
              └── mongoose.Message.create()           ← mongoose auto-instr
```

---

## 2. Логи

### 2.1. Business-логи (от @LogDecorator)

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `assistant_service.create_assistant` | `assistant_service.create_assistant — called` с `{data}` | `— ok` | `— failed` (WARN, AppError); `— system_error` (ERROR) |
| `assistant_service.update_assistant` | `— called` с `{id, data}` | `— ok` | Аналогично |
| `assistant_service.get_assistant` | `— called` с `{id}` | `— ok` | Аналогично |
| `assistant_service.get_user_assistants` | `— called` с `{userId}` | `— ok` | Аналогично |
| `assistant_service.delete_assistant` | `— called` с `{id}` | `— ok` | Аналогично |
| `message_service.create_message` | `— called` с `{data}` | `— ok` | Аналогично |
| `message_service.get_message_history` | `— called` с `{assistantId, limit, offset}` | `— ok` | Аналогично |
| `message_service.get_message` | `— called` с `{id}` | `— ok` | Аналогично |
| `message_service.delete_message` | `— called` с `{id}` | `— ok` | Аналогично |
| `message_service.update_message` | `— called` с `{id, data}` | `— ok` | Аналогично |
| `context_service.get_context_for_assistant` | `— called` с `{contextPreferences, userId}` | `— ok` | Аналогично |

### 2.2. Логи из OpenRouterClient (в @shared/openrouter)

OpenRouterClient логирует каждый API-вызов: `open_router_client.chat_completion — called`, `— ok`, `— failed/system_error`. Дополнительно: `logger.error("OpenRouter Chat API error", { status, statusText, error })` при HTTP-ошибке.

### 2.3. ErrorHandlerPlugin

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `NotFoundError` (из репозиториев) | WARN | `error.message` | `{error, errorName, errorStack}` |
| Любая другая ошибка | ERROR | `error.message` | `{error, errorName, errorStack, path}` |

---

## 3. Метрики

### 3.1. Business метрики (от @MetricsDecorator)

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `ai-assistant_AssistantService_create_assistant_total` | Counter | `result=success\|error` | Каждый вызов createAssistant | Количество созданных ассистентов |
| `ai-assistant_AssistantService_create_assistant_duration` | Histogram | — | Каждый вызов createAssistant | Латентность создания |
| `ai-assistant_AssistantService_update_assistant_total` | Counter | `result=success\|error` | Каждый вызов updateAssistant | — |
| `ai-assistant_AssistantService_update_assistant_duration` | Histogram | — | Каждый вызов updateAssistant | — |
| `ai-assistant_AssistantService_get_assistant_total` | Counter | `result=success\|error` | Каждый вызов getAssistant | — |
| `ai-assistant_AssistantService_get_assistant_duration` | Histogram | — | Каждый вызов getAssistant | — |
| `ai-assistant_AssistantService_get_user_assistants_total` | Counter | `result=success\|error` | Каждый вызов getUserAssistants | — |
| `ai-assistant_AssistantService_get_user_assistants_duration` | Histogram | — | Каждый вызов getUserAssistants | — |
| `ai-assistant_AssistantService_delete_assistant_total` | Counter | `result=success\|error` | Каждый вызов deleteAssistant | — |
| `ai-assistant_AssistantService_delete_assistant_duration` | Histogram | — | Каждый вызов deleteAssistant | — |
| `ai-assistant_MessageService_create_message_total` | Counter | `result=success\|error` | Каждый вызов createMessage | Количество диалогов с LLM |
| `ai-assistant_MessageService_create_message_duration` | Histogram | — | Каждый вызов createMessage | Латентность всего диалога (БД + LLM) |
| `ai-assistant_MessageService_get_message_history_total` | Counter | `result=success\|error` | Каждый вызов getMessageHistory | — |
| `ai-assistant_MessageService_get_message_history_duration` | Histogram | — | Каждый вызов getMessageHistory | — |
| `ai-assistant_MessageService_get_message_total` | Counter | `result=success\|error` | Каждый вызов getMessage | — |
| `ai-assistant_MessageService_get_message_duration` | Histogram | — | Каждый вызов getMessage | — |
| `ai-assistant_MessageService_delete_message_total` | Counter | `result=success\|error` | Каждый вызов deleteMessage | — |
| `ai-assistant_MessageService_delete_message_duration` | Histogram | — | Каждый вызов deleteMessage | — |
| `ai-assistant_MessageService_update_message_total` | Counter | `result=success\|error` | Каждый вызов updateMessage | — |
| `ai-assistant_MessageService_update_message_duration` | Histogram | — | Каждый вызов updateMessage | — |
| `ai-assistant_ContextService_get_context_for_assistant_total` | Counter | `result=success\|error` | Каждый вызов getContextForAssistant | — |
| `ai-assistant_ContextService_get_context_for_assistant_duration` | Histogram | — | Каждый вызов getContextForAssistant | — |
| `ai-assistant_ContextService_get_popular_pools_context_total` | Counter | `result=success\|error` | Каждый вызов getPopularPoolsContext (private) | — |
| `ai-assistant_ContextService_get_popular_pools_context_duration` | Histogram | — | Каждый вызов getPopularPoolsContext | — |
| `ai-assistant_ContextService_get_user_portfolio_context_total` | Counter | `result=success\|error` | Каждый вызов getUserPortfolioContext (private) | — |
| `ai-assistant_ContextService_get_user_portfolio_context_duration` | Histogram | — | Каждый вызов getUserPortfolioContext | — |

### 3.2. Метрики OpenRouter (из @shared/openrouter)

OpenRouterClient добавляет метрики для всех API-вызовов. Они префиксируются SERVICE_NAME сервиса-потребителя:

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `<service>_openrouter_requests_total` | Counter | `model`, `result=success\|error`, `type=chat\|completion` | Каждый запрос к OpenRouter API | Количество AI-вызовов по моделям |
| `<service>_openrouter_request_duration` | Histogram | `model`, `type=chat\|completion` | Каждый запрос к OpenRouter API | Latency LLM (метрика P95 для AI) |
| `<service>_OpenRouterClient_chat_completion_total` | Counter | `result=success\|error` | Каждый вызов chatCompletion | Дублирует openrouter_requests_total без model |
| `<service>_OpenRouterClient_chat_completion_duration` | Histogram | — | Каждый вызов chatCompletion | Дублирует openrouter_request_duration без model |

Для ai-assistant в Prometheus: `ai-assistant_openrouter_requests_total{model="deepseek/deepseek-v4-flash", result="success"}`

### 3.3. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | runtime-node | CPU, memory, event loop lag, GC |
| `http.server.duration` | HTTP auto-instr | RPS, latency входящих запросов |
| `http.client.duration` | HTTP auto-instr | RPS, latency исходящих (Eden Treaty, OpenRouter) |
| `db.client.operations.duration` | MongoDB auto-instr | Количество запросов, latency БД |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов по span_name |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов по span_name |

### 3.4. Примеры PromQL

```promql
# AI-запросы по моделям за 5м
sum by(model) (rate(ai-assistant_openrouter_requests_total{result="success"}[5m]))

# Ошибки OpenRouter
rate(ai-assistant_openrouter_requests_total{result="error"}[5m])

# P95 latency LLM
histogram_quantile(0.95, rate(ai-assistant_openrouter_request_duration_bucket[5m]))

# Ошибки создания сообщения (включая ошибки LLM)
rate(ai-assistant_MessageService_create_message_total{result="error"}[5m])

# P99 создания ассистента
histogram_quantile(0.99, rate(ai-assistant_AssistantService_create_assistant_duration_bucket[5m]))
```

---

## 4. Health-check

### `GET /health`

Стандартный health-check от `@shared/monitoring`. Возвращает:
```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "service": "ai-assistant"
}
```

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Медленный ответ AI | `ai-assistant_openrouter_request_duration` histogram. Если latency >5s — проблема в OpenRouter/модели |
| createMessage падает | `ai-assistant_MessageService_create_message_total{result="error"}`. Детали в логах: `message_service.create_message — failed/system_error` |
| Нет ответа от AI | `ai-assistant_openrouter_requests_total` за последние 5м. Если 0 — не доходят до OpenRouter. Если есть `result=error` — ошибка API |
| Контекст пустой | `context_service.get_context_for_assistant` span в Tempo. Проверить дочерние `get_popular_pools_context` и `get_user_portfolio_context` — могли вернуть null без ошибки |
| Assistant не создаётся | `ai-assistant_AssistantService_create_assistant_total{result="error"}`. Лог `assistant_service.create_assistant — failed` |
| Медленный старт сервиса | `ai-assistant.init.repositories_plugin.mongoose` span — сколько длилось подключение к MongoDB |
| Потерялись запросы пользователя | Tempo search: `{ userId = "..." }` или по span name `message_service.create_message` |
