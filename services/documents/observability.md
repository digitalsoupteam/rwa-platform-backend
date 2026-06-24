# Documents — Observability Reference

CRUD-сервис документов и папок. Mongoose-сущности `DocumentsFolder` (папка)
и `Document` (документ со ссылкой на папку через `folderId`). 10 публичных
REST-эндпоинтов (`POST /createFolder`, `POST /updateFolder`,
`POST /deleteFolder`, `POST /getFolder`, `POST /getFolders`,
`POST /createDocument`, `POST /updateDocument`, `POST /deleteDocument`,
`POST /getDocument`, `POST /getDocuments`).

`SERVICE_NAME=documents`. Stack: Bun + Elysia.js 1.3.5 + Mongoose 8.16.4 +
OpenTelemetry. Без clients/daemons/RabbitMQ/Redis.

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `documents.init.main` | `src/index.ts:4` | ~всё время старта | всё ниже | Корневой span `tracer.startActiveSpan` |
| `documents.init.repositories_plugin` | `src/app.ts:14` | ~MongoDB connect | `documents.init.repositories.documentsFolder`, `documents.init.repositories.document`, `documents.init.repositories_plugin.mongoose`, `documents.init.repositories.plugin` | Сборка репозиториев + подключение к MongoDB |
| `documents.init.repositories.documentsFolder` | `src/plugins/repositories.plugin.ts:8` | <5ms | — | Инстанс `DocumentsFolderRepository` |
| `documents.init.repositories.document` | `src/plugins/repositories.plugin.ts:13` | <5ms | — | Инстанс `DocumentRepository` |
| `documents.init.repositories_plugin.mongoose` | `src/plugins/repositories.plugin.ts:18` | ~connect latency | — | `mongoose.connect(mongoUri)` |
| `documents.init.repositories.plugin` | `src/plugins/repositories.plugin.ts:28` | <5ms | — | Сборка Elysia-плагина + `.decorate` |
| `documents.init.services_plugin` | `src/app.ts:19` | <10ms | `documents.init.services.documents`, `documents.init.services.plugin` | Сборка сервисного слоя |
| `documents.init.services.documents` | `src/plugins/services.plugin.ts:9` | <5ms | — | Инстанс `DocumentsService` |
| `documents.init.services.plugin` | `src/plugins/services.plugin.ts:17` | <5ms | — | Elysia-плагин + `.decorate("documentsService", ...)` |
| `documents.init.controllers_plugin` | `src/app.ts:24` | <50ms | `documents.init.controllers.<verb>` × 10 | Сборка контроллеров |
| `documents.init.controllers.create_folder` | `src/plugins/controllers.plugin.ts:16` | <5ms | — | Инстанс `createFolderController` |
| `documents.init.controllers.update_folder` | `src/plugins/controllers.plugin.ts:21` | <5ms | — | Инстанс `updateFolderController` |
| `documents.init.controllers.delete_folder` | `src/plugins/controllers.plugin.ts:26` | <5ms | — | Инстанс `deleteFolderController` |
| `documents.init.controllers.get_folder` | `src/plugins/controllers.plugin.ts:31` | <5ms | — | Инстанс `getFolderController` |
| `documents.init.controllers.get_folders` | `src/plugins/controllers.plugin.ts:36` | <5ms | — | Инстанс `getFoldersController` |
| `documents.init.controllers.create_document` | `src/plugins/controllers.plugin.ts:41` | <5ms | — | Инстанс `createDocumentController` |
| `documents.init.controllers.update_document` | `src/plugins/controllers.plugin.ts:46` | <5ms | — | Инстанс `updateDocumentController` |
| `documents.init.controllers.delete_document` | `src/plugins/controllers.plugin.ts:51` | <5ms | — | Инстанс `deleteDocumentController` |
| `documents.init.controllers.get_document` | `src/plugins/controllers.plugin.ts:56` | <5ms | — | Инстанс `getDocumentController` |
| `documents.init.controllers.get_documents` | `src/plugins/controllers.plugin.ts:61` | <5ms | — | Инстанс `getDocumentsController` |
| `documents.init.controllers.plugin` | `src/plugins/controllers.plugin.ts:66` | <5ms | — | Корневой Elysia-плагин контроллеров |
| `documents.init.elysia` | `src/app.ts:29` | listen + close | — | `.listen(port, ...)` + регистрация shared плагинов |

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `documents.stop.repositories_plugin` | `src/plugins/repositories.plugin.ts:34` | `.onStop(...)` от Elysia | `mongoose.disconnect()` — корректное закрытие пула |

`SIGTERM`/`SIGINT` обработчики (`src/index.ts:26-27`) вызывают `app.stop()`, что
триггерит `.onStop(...)` плагина репозиториев → спаны shutdown.

### 1.3. Runtime — бизнес-методы

#### `DocumentsService` — span prefix: documents_service

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `documents_service.create_folder` | _нет_ (см. §6) | `POST /createFolder` (controller: `createFolderController`) | `documents_folder_repository.create` → `mongoose.Model.create` | `AppError` от repository |
| `documents_service.update_folder` | _нет_ (см. §6) | `POST /updateFolder` | `documents_folder_repository.update` → `Model.findByIdAndUpdate` | `NotFoundError` если id не существует |
| `documents_service.delete_folder` | _нет_ (см. §6) | `POST /deleteFolder` | `document_repository.findAll` (получить документы папки) → `document_repository.delete` для каждого → `documents_folder_repository.delete` | `NotFoundError` от repository |
| `documents_service.get_folder` | _нет_ (см. §6) | `POST /getFolder` | `documents_folder_repository.find_by_id` → `Model.findById` | `NotFoundError` |
| `documents_service.get_folders` | _нет_ (см. §6) | `POST /getFolders` | `documents_folder_repository.find_all` → `Model.find().sort().skip().limit()` | — |
| `documents_service.create_document` | _нет_ (см. §6) | `POST /createDocument` | `document_repository.create` → `Model.create` | `AppError` |
| `documents_service.update_document` | _нет_ (см. §6) | `POST /updateDocument` | `document_repository.update` → `Model.findByIdAndUpdate` | `NotFoundError` |
| `documents_service.delete_document` | _нет_ (см. §6) | `POST /deleteDocument` | `document_repository.delete` → `Model.findByIdAndDelete` | `NotFoundError` |
| `documents_service.get_document` | _нет_ (см. §6) | `POST /getDocument` | `document_repository.find_by_id` → `Model.findById` | `NotFoundError` |
| `documents_service.get_documents` | _нет_ (см. §6) | `POST /getDocuments` | `document_repository.find_all` → `Model.find().sort().skip().limit()` | — |

_Примечание: span name = camelToSnakeCase(DocumentsService) + '.' + camelToSnakeCase(method).
Атрибуты span (`folderId`, `ownerId`, `creator`, `parentId`, `grandParentId`) не ставятся —
отсутствует вызов `setSpanAttributes()` в теле методов. См. §6._

#### `DocumentsFolderRepository` — span prefix: documents_folder_repository

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `documents_folder_repository.create` | `documents_service.create_folder` | `DocumentsFolder.create(data)` | new doc |
| `documents_folder_repository.update` | `documents_service.update_folder` | `DocumentsFolder.findByIdAndUpdate(id, data, {new:true})` | бросает `NotFoundError` если `null` |
| `documents_folder_repository.delete` | `documents_service.delete_folder` | `DocumentsFolder.findByIdAndDelete(id)` | бросает `NotFoundError` если `null` |
| `documents_folder_repository.find_by_id` | `documents_service.get_folder` | `DocumentsFolder.findById(id).lean()` | бросает `NotFoundError` если `null` |
| `documents_folder_repository.find_all` | `documents_service.get_folders` | `DocumentsFolder.find(filter).sort().skip(offset).limit(limit).lean()` | `limit` default 100, `offset` default 0 |

#### `DocumentRepository` — span prefix: document_repository

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `document_repository.create` | `documents_service.create_document` | `Document.create(data)` | new doc |
| `document_repository.update` | `documents_service.update_document` | `Document.findByIdAndUpdate(id, data, {new:true})` | бросает `NotFoundError` если `null` |
| `document_repository.delete` | `documents_service.delete_document` и `documents_service.delete_folder` (в цикле) | `Document.findByIdAndDelete(id)` | бросает `NotFoundError` если `null` |
| `document_repository.find_by_id` | `documents_service.get_document` | `Document.findById(id).lean()` | бросает `NotFoundError` если `null` |
| `document_repository.find_all` | `documents_service.get_documents` и `documents_service.delete_folder` | `Document.find(filter).sort().skip(offset).limit(limit).lean()` | в `delete_folder` фильтр `{ folderIds: [id] }` (см. §6) |

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP server | `instrumentation-http` | `POST /createFolder`, `POST /updateFolder`, `POST /deleteFolder`, `POST /getFolder`, `POST /getFolders`, `POST /createDocument`, `POST /updateDocument`, `POST /deleteDocument`, `POST /getDocument`, `POST /getDocuments` | `http.method=POST`, `http.target=/...`, `http.status_code` |
| MongoDB | `instrumentation-mongoose` | `mongoose.DocumentsFolder.<op>`, `mongoose.Document.<op>` | `db.mongodb.collection`, `db.operation` |
| DNS | `instrumentation-dns` | `dns.lookup` | — |
| FS | `instrumentation-fs` | `fs.*` | — |
| Net | `instrumentation-net` | `net.*` | — |
| Runtime | `instrumentation-runtime-node` | — (метрики) | — |

_Неактивны: instrumentation-amqplib (нет RabbitMQ), instrumentation-ioredis (нет Redis),
graphql — сервис REST-only._

### 1.5. Дебаг: полная иерархия для `POST /deleteFolder`

```
POST /deleteFolder                           ← HTTP auto-instr (instrumentation-http)
  └── documents_service.delete_folder        ← @TraceDecorator
        ├── document_repository.find_all     ← @TraceDecorator
        │     └── mongoose.Document.find     ← instrumentation-mongoose
        ├── document_repository.delete       ← @TraceDecorator (×N в цикле)
        │     └── mongoose.Document.findByIdAndDelete
        └── documents_folder_repository.delete  ← @TraceDecorator
              └── mongoose.DocumentsFolder.findByIdAndDelete
```

---

## 2. Логи

### 2.1. Business-логи

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `documentsService.createFolder` | `createFolder — called` с `data` | `createFolder — ok` | `— failed` → WARN (AppError); `— system_error` → ERROR |
| `documentsService.updateFolder` | `updateFolder — called` с `id`, `updateData` | `updateFolder — ok` | как выше |
| `documentsService.deleteFolder` | `deleteFolder — called` с `id` | `deleteFolder — ok` | как выше |
| `documentsService.getFolder` | `getFolder — called` с `id` | `getFolder — ok` | как выше |
| `documentsService.getFolders` | `getFolders — called` с `params` | `getFolders — ok` | как выше |
| `documentsService.createDocument` | `createDocument — called` с `data` | `createDocument — ok` | как выше |
| `documentsService.updateDocument` | `updateDocument — called` с `id`, `updateData` | `updateDocument — ok` | как выше |
| `documentsService.deleteDocument` | `deleteDocument — called` с `id` | `deleteDocument — ok` | как выше |
| `documentsService.getDocument` | `getDocument — called` с `id` | `getDocument — ok` | как выше |
| `documentsService.getDocuments` | `getDocuments — called` с `params` | `getDocuments — ok` | как выше |

Все 10 методов покрыты `@LogDecorator({ args: [...] })` — список аргументов
указан в скобках (dot-нотация или идентификатор параметра).

_Прямых `logger.*` вызовов в коде нет — всё через `@LogDecorator`._

### 2.2. ErrorHandlerPlugin

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| Любая ошибка (включая `AppError`) | ERROR | `error.message` | `{error, errorName, errorStack, path}` |

_`ErrorHandlerPlugin` логирует ВСЕ ошибки через `logger.error` — и `NotFoundError`,
и `ValidationError`, и `ConflictError`. Уровень WARN для AppError даёт только
`@LogDecorator` (`failed`), а не `ErrorHandlerPlugin`. Различие: AppError →
WARN от `@LogDecorator` И ERROR от `ErrorHandlerPlugin` (два лога на одну ошибку,
это поведение shared-пакета)._

---

## 3. Метрики

### 3.1. Business метрики

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `documents_documents_service_create_folder_total` | Counter | `result=success\|error` | Каждый вызов `createFolder` | Сколько раз создали папку |
| `documents_documents_service_create_folder_duration` | Histogram | — | Каждый вызов | Латентность |
| `documents_documents_service_update_folder_total` | Counter | `result=success\|error` | Каждый вызов `updateFolder` | Сколько раз обновили папку |
| `documents_documents_service_update_folder_duration` | Histogram | — | Каждый вызов | Латентность |
| `documents_documents_service_delete_folder_total` | Counter | `result=success\|error` | Каждый вызов `deleteFolder` | Сколько раз удалили папку |
| `documents_documents_service_delete_folder_duration` | Histogram | — | Каждый вызов | Латентность (включает каскадное удаление документов) |
| `documents_documents_service_get_folder_total` | Counter | `result=success\|error` | Каждый вызов `getFolder` | Частота чтения одной папки |
| `documents_documents_service_get_folder_duration` | Histogram | — | Каждый вызов | Латентность |
| `documents_documents_service_get_folders_total` | Counter | `result=success\|error` | Каждый вызов `getFolders` | Частота list-запросов |
| `documents_documents_service_get_folders_duration` | Histogram | — | Каждый вызов | Латентность list |
| `documents_documents_service_create_document_total` | Counter | `result=success\|error` | Каждый вызов `createDocument` | Сколько раз создали документ |
| `documents_documents_service_create_document_duration` | Histogram | — | Каждый вызов | Латентность |
| `documents_documents_service_update_document_total` | Counter | `result=success\|error` | Каждый вызов `updateDocument` | Сколько раз обновили документ |
| `documents_documents_service_update_document_duration` | Histogram | — | Каждый вызов | Латентность |
| `documents_documents_service_delete_document_total` | Counter | `result=success\|error` | Каждый вызов `deleteDocument` | Сколько раз удалили документ |
| `documents_documents_service_delete_document_duration` | Histogram | — | Каждый вызов | Латентность |
| `documents_documents_service_get_document_total` | Counter | `result=success\|error` | Каждый вызов `getDocument` | Частота чтения одного документа |
| `documents_documents_service_get_document_duration` | Histogram | — | Каждый вызов | Латентность |
| `documents_documents_service_get_documents_total` | Counter | `result=success\|error` | Каждый вызов `getDocuments` | Частота list-запросов |
| `documents_documents_service_get_documents_duration` | Histogram | — | Каждый вызов | Латентность list |

_Prometheus имя = SERVICE_NAME + _ + class_snake + _ + method_snake + _ + total|duration.
Все 20 метрик (10 × 2) сгенерированы автоматически через `@MetricsDecorator()`.
На репозиториях `@MetricsDecorator` не используется — латентность БД недоступна
через Prometheus из-за `suppressInternalInstrumentation: true` в shared-пакете._

_Прямых `metrics.counter`/`metrics.histogram`/`metrics.gauge` вызовов в коде нет._

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | runtime-node | CPU, memory, event loop lag, GC |
| `http.server.*` | HTTP auto-instr | RPS, latency, status codes (на 10 endpoint'ах) |
| `db.client.*` | MongoDB auto-instr | Количество запросов, latency |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |

### 3.3. Примеры PromQL

```promql
# Ошибки при создании папок за 5 минут
rate(documents_documents_service_create_folder_total{result="error"}[5m])

# P99 латентность удаления папки (включает каскад)
histogram_quantile(0.99, rate(documents_documents_service_delete_folder_duration_bucket[5m]))

# Количество успешно созданных документов за 24 часа
increase(documents_documents_service_create_document_total{result="success"}[24h])

# Соотношение ошибок по всем операциям
sum by (result) (rate(documents_documents_service_*_total[5m]))
```

---

## 4. Health-check

### `GET /health`

Доступен через `healthPlugin` (из `@shared/monitoring/src/health.plugin.ts`),
подключён в `src/app.ts:33`. Возвращает стандартный health-check сервиса.

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует | `documents.init.main` / `documents.init.repositories_plugin` / `documents.init.repositories_plugin.mongoose` — найти, на каком этапе упал старт |
| `documents_folder_repository.find_all` медленный | MongoDB auto-spans (`db.client.*`); проверить индексы `DocumentsFolderSchema` (есть `ownerId`, `creator`, `parentId`, `grandParentId`) |
| `deleteFolder` отрабатывает долго | Внутри несколько `document_repository.delete` в цикле; проверить `documents_service.delete_folder_total` + `_duration` |
| 404 при update/delete | `NotFoundError` → WARN-лог от `@LogDecorator` + ERROR от `ErrorHandlerPlugin`; искать по `errorName=NotFoundError` в Loki |
| Ошибка валидации Elysia | Возникает до сервисного слоя (роутер не доходит до `documentsService.*`); искать HTTP server span со `http.status_code=422` |
| Поиск действий пользователя | Все 10 спанов сервиса НЕ содержат `ownerId`/`creator` атрибутов (нет `setSpanAttributes`) — искать в Loki по `traceId` из DEBUG-лога `@LogDecorator` (`creator` фигурирует в `data`/`params`) |
| Проверить каскадное удаление | В Tempo найти `documents_service.delete_folder` → посмотреть дочерние `document_repository.delete` (их будет N штук) |
