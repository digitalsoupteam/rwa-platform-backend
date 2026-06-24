# Files — Observability Reference

Files-сервис: загрузка, хранение и выдача файлов с метаданными. Файлы
сохраняются на диск через локальное хранилище (`StorageClient` — обычная
файловая система, write/unlink через `node:fs/promises`), метаданные
(`name`, `path`, `size`, `mimeType`) — в MongoDB. Двухуровневой модели
нет, единственная сущность `File`.

REST на Elysia, MongoDB (Mongoose), OpenTelemetry. Брокеров, Redis и
внешних сетевых клиентов нет — только локальная ФС.

- **SERVICE_NAME:** `files` (env `SERVICE_NAME` / `FILES_SERVICE_NAME`)
- **Стек:** Bun + Elysia 1.3.5 + Mongoose 8.16.4
- **Хранилище:** MongoDB (одна коллекция — `files`)
- **Дисковая директория:** `${FILES_STORAGE_ROOT_DIR}` (default см. `.env`), подключена в контейнер как volume `files_storage:/app/storage`
- **Порт:** `${FILES_PORT}` (default см. `.env`)
- **Health:** `http://files:3000/health` (uptime-kuma ping, интервал 60с)

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Корневой span создаётся в `index.ts` через `tracer.startActiveSpan`. Все
вложенные `withTrace*` оборачивают соответствующие стадии инициализации.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `files.init.main` | `src/index.ts` | ~всё время старта | всё ниже | Корневой span init'а сервиса |
| `files.init.repositories_plugin` | `src/app.ts` | ~MongoDB connect | `files.init.repositories.file`, `files.init.repositories_plugin.mongoose`, `files.init.repositories.plugin` | Сборка плагина репозиториев |
| `files.init.repositories.file` | `src/plugins/repositories.plugin.ts` | синхронно | — | Инстанцирование `FileRepository` |
| `files.init.repositories_plugin.mongoose` | `src/plugins/repositories.plugin.ts` | до события `connected` | — | `mongoose.connect(mongoUri)` — завершается по `mongoose.connection.once('connected', ...)` |
| `files.init.repositories.plugin` | `src/plugins/repositories.plugin.ts` | синхронно | `files.stop.repositories_plugin` (через `.onStop`) | Сборка Elysia-плагина Repositories с `.decorate("fileRepository", ...)` и shutdown-хуком |
| `files.init.clients_plugin` | `src/app.ts` | синхронно | `files.init.clients.storage`, `files.init.clients.plugin` | Сборка плагина клиентов |
| `files.init.clients.storage` | `src/plugins/clients.plugin.ts` | синхронно | — | Инстанцирование `StorageClient(rootDir)` (создаёт rootDir через `mkdirSync({recursive:true})` если не существует) |
| `files.init.clients.plugin` | `src/plugins/clients.plugin.ts` | синхронно | — | Сборка Elysia-плагина Clients с `.decorate("storageClient", ...)` |
| `files.init.services_plugin` | `src/app.ts` | синхронно | `files.init.services.file`, `files.init.services.plugin` | Сборка плагина сервисов |
| `files.init.services.file` | `src/plugins/services.plugin.ts` | синхронно | — | `new FileService(fileRepository, storageClient)` |
| `files.init.services.plugin` | `src/plugins/services.plugin.ts` | синхронно | — | Сборка Elysia-плагина Services с `.decorate("fileService", ...)` |
| `files.init.controllers_plugin` | `src/app.ts` | синхронно | см. ниже | Сборка плагина контроллеров |
| `files.init.controllers.create_file` | `src/plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование CreateFileController |
| `files.init.controllers.get_file` | `src/plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование GetFileController |
| `files.init.controllers.update_file` | `src/plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование UpdateFileController |
| `files.init.controllers.delete_file` | `src/plugins/controllers.plugin.ts` | синхронно | — | Инстанцирование DeleteFileController |
| `files.init.controllers.plugin` | `src/plugins/controllers.plugin.ts` | синхронно | — | Сборка Elysia-плагина Controllers с подключением всех 4 контроллеров |
| `files.init.elysia` | `src/app.ts` | до вызова `.listen` callback'а | — | Создание корневого `Elysia()`, подключение monitoring/health/ErrorHandler/plugins и `.listen(port)` |

_Примечание: имена init-спанов в `services.plugin.ts` и `controllers.plugin.ts`
используют формат `<service>.init.services.file` / `<service>.init.controllers.create_file`
(имя узла, а не `_plugin`), потому что в этих плагинах несколько шагов
инициализации (инстанцирование + сборка плагина). В `repositories.plugin.ts` —
тот же паттерн (`files.init.repositories.file` для инстанцирования +
`files.init.repositories.plugin` для сборки Elysia-плагина). Это согласуется
с общим соглашением платформы._

_В `app.ts` используется сокращённая форма `files.init.repositories_plugin` /
`files.init.clients_plugin` / `files.init.services_plugin` /
`files.init.controllers_plugin` — один шаг на плагин._

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `files.stop.repositories_plugin` | `src/plugins/repositories.plugin.ts` (внутри `.onStop`) | Elysia `.onStop` callback при остановке приложения (SIGTERM/SIGINT → `index.ts:shutdown`) | `mongoose.disconnect()` |

### 1.3. Runtime — бизнес-методы

#### FileService (span prefix: file_service)

Все 5 методов имеют стек `@TraceDecorator()` + `@MetricsDecorator()` +
`@LogDecorator({...})`. `setSpanAttributes()` явно не вызывается —
`@TraceDecorator` оборачивает вызовы только в `tracer.startActiveSpan`,
без дополнительных атрибутов. Для дебага по конкретному файлу искать
через `id` / `path`, пробрасываемые в лог через `@LogDecorator({args:['id'|'path']})`.

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `file_service.create_file` | нет (setSpanAttributes не вызывается) | `POST /createFile` (controller `createFileController`) | `StorageClient.generatePath` (UUID + ext) → `StorageClient.saveFile` (fs.writeFile) → `fileRepository.create` (`File.create({name, path, size, mimeType})`) | `Error` если `body.file.size > maxFileSize` (кидается в controller, см. секцию «Критические gap'ы») |
| `file_service.get_file` | нет | `POST /getFiles` (controller `getFileController`) | `fileRepository.findById` (`File.findById(id).lean()`) → `StorageClient.fileExists` (fs.existsSync) | `NotFoundError("File", id)` если записи нет; `Error("Physical file not found")` если БД-запись есть, а файл на диске отсутствует (см. секцию «Критические gap'ы») |
| `file_service.get_file_by_path` | нет | — (метод не вызывается ни одним controller'ом) | `fileRepository.findByPath` (`File.findOne({path}).lean()`) → `StorageClient.fileExists` | `NotFoundError("File", path)`; `Error("Physical file not found")` |
| `file_service.update_file` | нет | `POST /updateFile` (controller `updateFileController`) | `fileRepository.update` (`File.findByIdAndUpdate(id, {$set: data}, {new:true}).lean()`) → `StorageClient.fileExists` | `NotFoundError("File", id)`; `Error("Physical file not found")` |
| `file_service.delete_file` | нет | `POST /deleteFile` (controller `deleteFileController`) | `fileRepository.findById` → `StorageClient.deleteFile` (fs.unlink, no-op если нет на диске) → `fileRepository.delete` (`File.findByIdAndDelete(id).lean()`) | `NotFoundError("File", id)` |

_Примечание: span name = camelToSnakeCase(className) + '.' + camelToSnakeCase(method).
Например, `FileService.createFile` → `file_service.create_file`, `FileService.getFileByPath` →
`file_service.get_file_by_path`._

_`getFileByPath` объявлен в сервисном слое, но не вызывается ни одним
controller'ом в текущей кодовой базе — это публичный API сервиса, доступный
для будущих интеграций (например, прямого вызова из `gateway` через Eden Treaty)._

#### FileRepository (span prefix: file_repository)

Все 5 методов имеют только `@TraceDecorator()`. Без `@MetricsDecorator`,
без `@LogDecorator`, без `setSpanAttributes` — паттерн репозиториев
платформы (см. `rwa-observability` §1.5).

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `file_repository.create` | `file_service.create_file` | `File.create({name, path, size, mimeType})` | возвращает `doc.toObject()` |
| `file_repository.find_by_id` | `file_service.get_file`, `file_service.delete_file` | `File.findById(id).lean()` | бросает `NotFoundError("File", id)` если `doc == null` |
| `file_repository.find_by_path` | `file_service.get_file_by_path` | `File.findOne({path}).lean()` | бросает `NotFoundError("File", path)` если `doc == null`; индекс `path_1` (см. `models/entity/file.entity.ts`) |
| `file_repository.update` | `file_service.update_file` | `File.findByIdAndUpdate(id, {$set: data}, {new: true}).lean()` | бросает `NotFoundError("File", id)` если `doc == null` |
| `file_repository.delete` | `file_service.delete_file` | `File.findByIdAndDelete(id).lean()` | бросает `NotFoundError("File", id)` если `doc == null` |

#### StorageClient (span prefix: storage_client)

Все 4 метода имеют только `@TraceDecorator()`. Без `@MetricsDecorator`,
без `@LogDecorator`, без `setSpanAttributes` — этот класс не входит в
основные observability-контракты платформы (см. `rwa-observability` §3.6:
метрики для shared-клиентов добавляются в сам shared-пакет, а
`StorageClient` живёт в `services/files/src/clients/`, не в `@shared/*`).

| Span name | Вызывается из | Файловая операция | Примечание |
|-----------|---------------|-------------------|------------|
| `storage_client.generate_path` | `file_service.create_file` | — (pure) | `join(rootDir, ${randomUUID()}.${ext})`; `ext` — последняя часть `originalName` после `.` (пустая строка если точки нет) |
| `storage_client.save_file` | `file_service.create_file` | `fs.writeFile(path, data)`; опционально `fs.mkdirSync(dir, {recursive:true})` если parent-директория не существует | атомарной записи нет — между `mkdirSync` и `writeFile` возможен частичный failure |
| `storage_client.delete_file` | `file_service.delete_file` | `fs.unlink(path)` | no-op если `fs.existsSync(path) == false` (ранний return без throw) |
| `storage_client.file_exists` | `file_service.get_file`, `file_service.get_file_by_path`, `file_service.update_file` | `fs.existsSync(path)` | pure, синхронный; возвращает `boolean` |

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP | instrumentation-http | `POST /createFile`, `POST /getFiles`, `POST /updateFile`, `POST /deleteFile` | `http.method`, `http.target`, `http.status_code` |
| MongoDB | instrumentation-mongoose | `mongoose.File.*` (create, findById, findOne, findByIdAndUpdate, findByIdAndDelete) | `db.mongodb.collection`, `db.operation` |
| Runtime | instrumentation-runtime-node | — (метрики, не спаны) | — |

_Активные инструменты: http + mongoose + runtime-node. Нет брокеров
(RabbitMQ/Redis), нет внешних HTTP-клиентов — соответствующие инструменты
не подключены._

### 1.5. Дебаг: полная иерархия для `POST /createFile`

```
POST /createFile                          ← HTTP auto-instr
  └── file_service.create_file            ← @TraceDecorator + @MetricsDecorator + @LogDecorator
        ├── storage_client.generate_path  ← @TraceDecorator
        ├── storage_client.save_file      ← @TraceDecorator
        │     └── (fs.writeFile — НЕ трейсится)
        └── file_repository.create        ← @TraceDecorator
              └── mongoose.File.create    ← mongoose auto-instr
```

---

## 2. Логи

### 2.1. Business-логи

Все 5 методов `FileService` имеют `@LogDecorator({args:[...]})` (на `createFile`
без args — логируется только факт вызова). Поля `args` ограничены
идентификаторами, чтобы не лить в логи содержимое файла (PII, бинарь).

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `createFile` | `createFile — called` без args | `createFile — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getFile` | `getFile — called` с `{id}` | `getFile — ok` | `— failed` → WARN (NotFoundError); `— system_error` → ERROR (включая `Error("Physical file not found")` — см. секцию «Критические gap'ы») |
| `getFileByPath` | `getFileByPath — called` с `{path}` | `getFileByPath — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `updateFile` | `updateFile — called` с `{id, data}` | `updateFile — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `deleteFile` | `deleteFile — called` с `{id}` | `deleteFile — ok` | `— failed` → WARN; `— system_error` → ERROR |

_Все методы репозиториев и `StorageClient` не имеют `@LogDecorator` — логи
только на уровне сервиса._

_Контроллер `createFileController` бросает `Error("File size exceeds maximum allowed size of N bytes")`
для превышения лимита (size > `MAX_FILE_SIZE`). Поскольку это plain `Error`
(а не `ValidationError`), он попадёт в `— system_error` → ERROR-уровень
вместо ожидаемого WARN — см. секцию «Критические gap'ы»._

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

`@MetricsDecorator()` стоит только на сервисном слое (5 методов
`FileService`), каждый генерирует пару `_total` + `_duration`. На
репозиториях и `StorageClient` декоратора нет — латентность БД/ФС
недоступна через Prometheus из-за `suppressInternalInstrumentation: true`
в `shared/monitoring/src/monitoring.plugin.ts`.

`Prometheus` имя считается как `SERVICE_NAME + _ + class_snake + _ +
method_snake + _ + total|duration`. Например, `FileService.createFile` →
`files_file_service_create_file_total`, `FileService.getFileByPath` →
`files_file_service_get_file_by_path_total`/`_duration`.

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `files_file_service_create_file_total` | Counter | `result=success\|error` | Каждый вызов `createFile` | RPS загрузки файлов |
| `files_file_service_create_file_duration` | Histogram | — | Каждый вызов `createFile` | Латентность (включает writeFile + INSERT) |
| `files_file_service_get_file_total` | Counter | `result=success\|error` | Каждый вызов `getFile` | RPS чтения файла |
| `files_file_service_get_file_duration` | Histogram | — | Каждый вызов `getFile` | Латентность |
| `files_file_service_get_file_by_path_total` | Counter | `result=success\|error` | Каждый вызов `getFileByPath` | RPS чтения по path (в текущей кодовой базе не вызывается controller'ами) |
| `files_file_service_get_file_by_path_duration` | Histogram | — | Каждый вызов `getFileByPath` | Латентность |
| `files_file_service_update_file_total` | Counter | `result=success\|error` | Каждый вызов `updateFile` | RPS обновления метаданных |
| `files_file_service_update_file_duration` | Histogram | — | Каждый вызов `updateFile` | Латентность |
| `files_file_service_delete_file_total` | Counter | `result=success\|error` | Каждый вызов `deleteFile` | RPS удаления файлов |
| `files_file_service_delete_file_duration` | Histogram | — | Каждый вызов `deleteFile` | Латентность (включает unlink + DELETE) |

_Прямых `metrics.counter/histogram/gauge` вызовов в коде нет — все метрики
генерируются декоратором. Удвоения `files_files_service_*` нет: имя сервиса
`files` (без подчёркивания), snake_case `FileService` = `file_service` →
`files_file_service_*` — одиночный префикс._

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
# Ошибки загрузки за 5 минут
rate(files_file_service_create_file_total{result="error"}[5m])

# P99 латентность удаления (включает unlink + Mongo delete)
histogram_quantile(0.99, rate(files_file_service_delete_file_duration_bucket[5m]))

# Количество успешных загрузок за 24ч
increase(files_file_service_create_file_total{result="success"}[24h])

# Доля ошибок чтения за 5 минут
sum(rate(files_file_service_get_file_total{result="error"}[5m]))
  / sum(rate(files_file_service_get_file_total[5m]))
```

---

## 4. Health-check

### `GET /health`

Подключён `healthPlugin` из `@shared/monitoring/src/health.plugin` в
`app.ts` (на том же уровне, что и `monitoringPlugin` + `ErrorHandlerPlugin`).
Стандартный для платформы health-endpoint, см. `rwa-observability` skill.
В `infrastructure/docker/uptime-kuma/uptime-kuma-import.json` пингуется
как `http://files:3000/health` (HTTP GET, интервал 60с).

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Долгий `POST /createFile` | span `file_service.create_file` → дочерние `storage_client.generate_path` (быстро) → `storage_client.save_file` (writeFile, основное время); метрика `files_file_service_create_file_duration` |
| `404` при `POST /getFiles` / `POST /updateFile` / `POST /deleteFile` | WARN-лог `<method> — failed` от `@LogDecorator` (NotFoundError), ERROR-лог `[NOT_FOUND] File ...` от `ErrorHandlerPlugin` |
| `500` на `POST /getFiles` / `POST /updateFile` | ERROR-лог `<method> — system_error` (от `@LogDecorator`) И `Unexpected error: Error: Physical file not found` (от `ErrorHandlerPlugin`) — рассинхрон БД↔ФС |
| `500` на `POST /createFile` с большим файлом | ERROR-лог `createFile — system_error` от `ErrorHandlerPlugin: Unexpected error: Error: File size exceeds maximum allowed size of N bytes` — валидация размера кидает plain Error вместо ValidationError (см. секцию «Критические gap'ы») |
| Файл есть на диске, но отсутствует запись в MongoDB (или наоборот) | Это разрыв данных, не observability. Симптом: `getFile` падает с `Error: Physical file not found`; вероятная причина — failed `writeFile` после `Model.create` или ручное удаление из ФС. Repair: удалить `File` документ и/или восстановить файл из бэкапа. |
| Медленные ответы MongoDB | метрики `db.client.*`; спаны `mongoose.File.*` под репозиторными спанами |
| Сервис не стартует | span `files.init.repositories_plugin.mongoose` — зависает, если MongoDB недоступна |
| Утечка Mongo-соединений при перезапуске | shutdown-span `files.stop.repositories_plugin` (должен сработать по SIGTERM/SIGINT → `index.ts:shutdown`) |
| `502` от gateway на загрузку файла | upstream health-check `http://files:3000/health`; метрики `http.server.*` для `files` контейнера |
