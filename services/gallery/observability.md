# Gallery — Observability Reference

`gallery` — микросервис RWA Platform: CRUD медиа-галерей и изображений.
Два корня агрегации (Gallery, Image), общая иерархия parent/grandParent.

- **Технологии:** Bun + Elysia.js 1.3.5, Mongoose 8.16.4 (MongoDB)
- **SERVICE_NAME:** `gallery`
- **Точка входа:** `src/index.ts` → `createApp()` (см. `src/app.ts`)
- **HTTP API:** 10 Elysia-роутов (см. §1.5)
- **Нет** daemons, RabbitMQ-клиентов, Redis-клиентов, внешних API

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `gallery.init.main` | `src/index.ts` (root, `tracer.startActiveSpan`) | ~всё время старта | все ниже | Корневой span процесса |
| `gallery.init.repositories_plugin` | `src/app.ts` (через `withTraceAsync`) | ~MongoDB connect | `gallery.init.repositories.gallery`, `gallery.init.repositories.image`, `gallery.init.repositories_plugin.mongoose`, `gallery.init.repositories.plugin` | Сборка репозиториев + подключение к MongoDB |
| `gallery.init.services_plugin` | `src/app.ts` (через `withTraceSync`) | ~мгновенно | `gallery.init.services.images`, `gallery.init.services.plugin` | Сборка сервисного слоя |
| `gallery.init.controllers_plugin` | `src/app.ts` (через `withTraceSync`) | ~мгновенно | все `gallery.init.controllers.*` ниже | Сборка контроллерного слоя |
| `gallery.init.elysia` | `src/app.ts` (через `withTraceSync`) | ~listen до колбэка | — | `Elysia().use(...).listen()` — финальная сборка приложения |
| `gallery.init.repositories.gallery` | `src/plugins/repositories.plugin.ts` | ~мгновенно | — | Конструирование `GalleryRepository` |
| `gallery.init.repositories.image` | `src/plugins/repositories.plugin.ts` | ~мгновенно | — | Конструирование `ImageRepository` |
| `gallery.init.repositories_plugin.mongoose` | `src/plugins/repositories.plugin.ts` (через `withTraceAsync`, `mongoose.connection.once('connected', ...)`) | ~время handshake до MongoDB | — | Ожидание первого подключения к MongoDB |
| `gallery.init.repositories.plugin` | `src/plugins/repositories.plugin.ts` | ~мгновенно | — | Elysia-инстанс плагина репозиториев (`.decorate(...)`) |
| `gallery.init.services.images` | `src/plugins/services.plugin.ts` | ~мгновенно | — | Конструирование `ImagesService` |
| `gallery.init.services.plugin` | `src/plugins/services.plugin.ts` | ~мгновенно | — | Elysia-инстанс плагина сервисов |
| `gallery.init.controllers.create_gallery` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `CreateGalleryController` |
| `gallery.init.controllers.update_gallery` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `UpdateGalleryController` |
| `gallery.init.controllers.delete_gallery` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `DeleteGalleryController` |
| `gallery.init.controllers.get_gallery` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `GetGalleryController` |
| `gallery.init.controllers.get_galleries` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `GetGalleriesController` |
| `gallery.init.controllers.create_image` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `CreateImageController` |
| `gallery.init.controllers.update_image` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `UpdateImageController` |
| `gallery.init.controllers.delete_image` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `DeleteImageController` |
| `gallery.init.controllers.get_image` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `GetImageController` |
| `gallery.init.controllers.get_images` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Создание `GetImagesController` |
| `gallery.init.controllers.plugin` | `src/plugins/controllers.plugin.ts` | ~мгновенно | — | Elysia-инстанс плагина контроллеров |

_Примечание: span name — литерал в коде (внутри `withTraceSync`/`withTraceAsync`)._

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `gallery.stop.repositories_plugin` | `src/plugins/repositories.plugin.ts` (`.onStop(async () => withTraceAsync(...))`) | SIGTERM / SIGINT через `app.stop()` в `src/index.ts` | `await mongoose.disconnect()` |

### 1.3. Runtime — бизнес-методы

#### `ImagesService` — span prefix: `images_service`

_Имя класса после `to_snake` = `images_service`. Удвоения префикса нет (SERVICE_NAME=`gallery`, class_snake=`images_service` → `gallery_images_service_<method>_total`)._

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `images_service.create_gallery` | _нет `setSpanAttributes` — span полезен только по имени_ | `POST /createGallery` → `CreateGalleryController` | `GalleryRepository.create()` (`mongoose.model('Gallery').create(data)`) | `Error` от Mongoose (validation/cast) |
| `images_service.update_gallery` | _нет_ | `POST /updateGallery` | `GalleryRepository.update(id, data)` (`findByIdAndUpdate`) | `NotFoundError("Gallery", id)` (если id не найден) |
| `images_service.delete_gallery` | _нет_ | `POST /deleteGallery` | `ImageRepository.findAll({ galleryIds: [id] })` (loop), `ImageRepository.delete(...)` для каждой картинки, затем `GalleryRepository.delete(id)` | `NotFoundError("Gallery", id)` |
| `images_service.get_gallery` | _нет_ | `POST /getGallery` | `GalleryRepository.findById(id)` (`findById`) | `NotFoundError("Gallery", id)` |
| `images_service.get_galleries` | _нет_ | `POST /getGalleries` | `GalleryRepository.findAll(filter, sort, limit, offset)` | — |
| `images_service.create_image` | _нет_ | `POST /createImage` | `ImageRepository.create(data)` (`mongoose.model('Image').create(data)`) | `Error` от Mongoose |
| `images_service.update_image` | _нет_ | `POST /updateImage` | `ImageRepository.update(id, data)` (`findByIdAndUpdate`) | `NotFoundError("Image", id)` |
| `images_service.delete_image` | _нет_ | `POST /deleteImage` | `ImageRepository.delete(id)` (`findByIdAndDelete`) | `NotFoundError("Image", id)` |
| `images_service.get_image` | _нет_ | `POST /getImage` | `ImageRepository.findById(id)` | `NotFoundError("Image", id)` |
| `images_service.get_images` | _нет_ | `POST /getImages` | `ImageRepository.findAll(filter, sort, limit, offset)` | — |

_Примечание: span name вычисляется по `camelToSnakeCase(ClassName) + '.' + camelToSnakeCase(methodName)` (см. `shared/monitoring/src/traceDecorator.ts`). `setSpanAttributes()` явно в коде **не вызывается** ни в одном методе сервиса — см. §5 чек-лист «Нет атрибутов → сложно фильтровать в Tempo»._

#### `GalleryRepository` — span prefix: *gallery_repository*

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `gallery_repository.create` | `images_service.create_gallery` | `Model.create(data)` → `doc.toObject()` | — |
| `gallery_repository.update` | `images_service.update_gallery` | `Model.findByIdAndUpdate(id, data, { new: true }).lean()` | Бросает `NotFoundError("Gallery", id)` при `null` |
| `gallery_repository.delete` | `images_service.delete_gallery` | `Model.findByIdAndDelete(id).lean()` | Бросает `NotFoundError("Gallery", id)` при `null` |
| `gallery_repository.find_by_id` | `images_service.get_gallery` | `Model.findById(id).lean()` | Бросает `NotFoundError("Gallery", id)` при `null` |
| `gallery_repository.find_all` | `images_service.get_galleries` | `Model.find(filter).sort(sort).skip(offset).limit(limit).lean()` | Лимит по умолчанию = 100 |

#### `ImageRepository` — span prefix: `image_repository`

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `image_repository.create` | `images_service.create_image` | `Model.create(data)` → `doc.toObject()` | — |
| `image_repository.update` | `images_service.update_image` | `Model.findByIdAndUpdate(id, data, { new: true }).lean()` | Бросает `NotFoundError("Image", id)` при `null` |
| `image_repository.delete` | `images_service.delete_image`, `images_service.delete_gallery` (в цикле) | `Model.findByIdAndDelete(id).lean()` | Бросает `NotFoundError("Image", id)` при `null` |
| `image_repository.find_by_id` | `images_service.get_image` | `Model.findById(id).lean()` | Бросает `NotFoundError("Image", id)` при `null` |
| `image_repository.find_all` | `images_service.get_images`, `images_service.delete_gallery` (для каскада) | `Model.find(filter).sort(sort).skip(offset).limit(limit).lean()` | Лимит по умолчанию = 100 |

### 1.4. Auto-instrumentation

Активные инструменты из `@shared/monitoring/src/monitoring.plugin.ts` (`getNodeAutoInstrumentations`):

| Тип | Инструмент | Какие спаны | Атрибуты | Активен для gallery? |
|-----|-----------|-------------|----------|----------------------|
| HTTP | `instrumentation-http` | `POST /createGallery`, `POST /getGallery`, … | `http.status_code`, `http.target`, `http.service`, `service.name` | ✅ |
| MongoDB | `instrumentation-mongoose` | `mongoose.Collection.create`, `mongoose.Collection.find`, … | `db.mongodb.collection`, `db.operation` | ⚠️ активен, но `suppressInternalInstrumentation: true` (см. `monitoring.plugin.ts:77`) — внутренние DB-спаны **подавлены** |
| RabbitMQ | `instrumentation-amqplib` | — | — | ❌ сервис не публикует/не консьюмит |
| Redis | `instrumentation-redis`, `instrumentation-ioredis` | — | — | ❌ сервис не использует Redis |
| GraphQL | `instrumentation-graphql` | — | — | ❌ отключён глобально (`enabled: false`); сервис REST, не GraphQL |
| DNS | `instrumentation-dns` | `dns.lookup` | — | ✅ |
| FS | `instrumentation-fs` | `fs.readFileSync` и т.п. | — | ✅ |
| Net | `instrumentation-net` | `net.*` | — | ✅ |
| Runtime-node | `instrumentation-runtime-node` | — (метрики, не спаны) | — | ✅ |

### 1.5. Дебаг: полная иерархия для `POST /createGallery`

```
POST /createGallery                       ← HTTP auto-instr (instrumentation-http)
  └── images_service.create_gallery       ← @TraceDecorator на ImagesService.createGallery
        └── gallery_repository.create     ← @TraceDecorator на GalleryRepository.create
              └── mongoose.Gallery.create ← instrumentation-mongoose (подавлен suppressInternalInstrumentation)
```

_Примечание: span `images_service.create_gallery` не имеет `setSpanAttributes` — для фильтрации в Tempo доступен только по `name=images_service.create_gallery` и `service.name=gallery`._

### 1.6. Дебаг: полная иерархия для `POST /deleteGallery` (каскад)

```
POST /deleteGallery                       ← HTTP auto-instr
  └── images_service.delete_gallery       ← @TraceDecorator
        ├── image_repository.find_all     ← @TraceDecorator (поиск картинок галереи)
        │     └── mongoose.Image.find     ← instrumentation-mongoose (подавлен)
        ├── image_repository.delete       ← @TraceDecorator (×N для каждой картинки)
        │     └── mongoose.Image.delete   ← instrumentation-mongoose (подавлен)
        └── gallery_repository.delete     ← @TraceDecorator
              └── mongoose.Gallery.delete ← instrumentation-mongoose (подавлен)
```

_Каскадное удаление: на каждый `delete_image` создаётся полная иерархия спанов. На галерее с 1000 картинок — 1000 дочерних `image_repository.delete` спанов._

---

## 2. Логи

### 2.1. Business-логи

Все 10 методов `ImagesService` имеют `@LogDecorator({ args: [...] })`. Репозитории — без `@LogDecorator` (только `@TraceDecorator`).

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `images_service.create_gallery` | `images_service.create_gallery — called` с `{data.name}` | `images_service.create_gallery — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `images_service.update_gallery` | `images_service.update_gallery — called` с `{params}` | `— ok` | `— failed` → WARN; `— system_error` → ERROR |
| `images_service.delete_gallery` | `images_service.delete_gallery — called` с `{id}` | `— ok` | `— failed` → WARN; `— system_error` → ERROR |
| `images_service.get_gallery` | `images_service.get_gallery — called` с `{id}` | `— ok` | `— failed` → WARN; `— system_error` → ERROR |
| `images_service.get_galleries` | `images_service.get_galleries — called` с `{params}` | `— ok` | `— failed` → WARN; `— system_error` → ERROR |
| `images_service.create_image` | `images_service.create_image — called` с `{data.name}` | `— ok` | `— failed` → WARN; `— system_error` → ERROR |
| `images_service.update_image` | `images_service.update_image — called` с `{params}` | `— ok` | `— failed` → WARN; `— system_error` → ERROR |
| `images_service.delete_image` | `images_service.delete_image — called` с `{id}` | `— ok` | `— failed` → WARN; `— system_error` → ERROR |
| `images_service.get_image` | `images_service.get_image — called` с `{id}` | `— ok` | `— failed` → WARN; `— system_error` → ERROR |
| `images_service.get_images` | `images_service.get_images — called` с `{params}` | `— ok` | `— failed` → WARN; `— system_error` → ERROR |

_AppError (`NotFoundError`) → WARN через `@LogDecorator` (`shared/monitoring/src/logDecorator.ts:58,73`). Любой другой `Error` → ERROR (`logger.error(..._system_error)`)._

### 2.2. ErrorHandlerPlugin

Источник: `shared/errors/error-handler.plugin.ts` (подключён в `src/app.ts:35` через `.onError(ErrorHandlerPlugin)`).

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` (включая `NotFoundError`, `ValidationError`, `ConflictError`) | **ERROR** | `[${error.code}] ${error.message}` | `{statusCode, path, details, stack}` |
| Любая другая | **ERROR** | `Unexpected error:` | `{path, error}` |

_Важно: `ErrorHandlerPlugin` логирует **ВСЕ** ошибки через `logger.error`, включая `AppError` (4xx-ошибки). Уровень WARN для AppError используется **только** в `@LogDecorator` — это другой слой. Дублирование логов (WARN от `@LogDecorator` + ERROR от `ErrorHandlerPlugin`) — поведение shared-пакета._

---

## 3. Метрики

### 3.1. Business метрики

`@MetricsDecorator()` стоит на всех 10 методах `ImagesService`. Каждый метод генерирует пару `_<method>_total` + `_<method>_duration`.

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `gallery_images_service_create_gallery_total` | Counter | `result=success\|error` | Каждый вызов `createGallery` | Подсчёт попыток создания галереи |
| `gallery_images_service_create_gallery_duration` | Histogram | — | Каждый вызов `createGallery` | Латентность createGallery |
| `gallery_images_service_update_gallery_total` | Counter | `result=success\|error` | Каждый вызов `updateGallery` | Подсчёт попыток обновления галереи |
| `gallery_images_service_update_gallery_duration` | Histogram | — | Каждый вызов `updateGallery` | Латентность updateGallery |
| `gallery_images_service_delete_gallery_total` | Counter | `result=success\|error` | Каждый вызов `deleteGallery` | Подсчёт попыток удаления галереи (включая каскад) |
| `gallery_images_service_delete_gallery_duration` | Histogram | — | Каждый вызов `deleteGallery` | Латентность deleteGallery (с каскадом!) |
| `gallery_images_service_get_gallery_total` | Counter | `result=success\|error` | Каждый вызов `getGallery` | Подсчёт попыток получения галереи |
| `gallery_images_service_get_gallery_duration` | Histogram | — | Каждый вызов `getGallery` | Латентность getGallery |
| `gallery_images_service_get_galleries_total` | Counter | `result=success\|error` | Каждый вызов `getGalleries` | Подсчёт попыток получения списка |
| `gallery_images_service_get_galleries_duration` | Histogram | — | Каждый вызов `getGalleries` | Латентность getGalleries |
| `gallery_images_service_create_image_total` | Counter | `result=success\|error` | Каждый вызов `createImage` | Подсчёт попыток создания изображения |
| `gallery_images_service_create_image_duration` | Histogram | — | Каждый вызов `createImage` | Латентность createImage |
| `gallery_images_service_update_image_total` | Counter | `result=success\|error` | Каждый вызов `updateImage` | Подсчёт попыток обновления изображения |
| `gallery_images_service_update_image_duration` | Histogram | — | Каждый вызов `updateImage` | Латентность updateImage |
| `gallery_images_service_delete_image_total` | Counter | `result=success\|error` | Каждый вызов `deleteImage` | Подсчёт попыток удаления изображения |
| `gallery_images_service_delete_image_duration` | Histogram | — | Каждый вызов `deleteImage` | Латентность deleteImage |
| `gallery_images_service_get_image_total` | Counter | `result=success\|error` | Каждый вызов `getImage` | Подсчёт попыток получения изображения |
| `gallery_images_service_get_image_duration` | Histogram | — | Каждый вызов `getImage` | Латентность getImage |
| `gallery_images_service_get_images_total` | Counter | `result=success\|error` | Каждый вызов `getImages` | Подсчёт попыток получения списка |
| `gallery_images_service_get_images_duration` | Histogram | — | Каждый вызов `getImages` | Латентность getImages |

_Имена вычисляются по `SERVICE_NAME + _ + class_snake + _ + method_snake + _total|_duration` (`shared/monitoring/src/metricsDecorator.ts`). Прямых `metrics.counter/histogram/gauge` вызовов в коде нет — только `@MetricsDecorator`._

_Латентность БД (GalleryRepository, ImageRepository) недоступна через Prometheus — `instrumentation-mongoose` имеет `suppressInternalInstrumentation: true` (`shared/monitoring/src/monitoring.plugin.ts:77`)._

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | runtime-node | CPU, memory, event loop lag, GC |
| `http.server.*` | HTTP auto-instr | RPS, latency, status codes |
| `db.client.*` | MongoDB auto-instr | Количество запросов, latency (подавлено) |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |

### 3.3. Примеры PromQL

```promql
# Ошибки createImage за 5 минут
rate(gallery_images_service_create_image_total{result="error"}[5m])

# P99 латентность deleteGallery (включая каскад)
histogram_quantile(0.99, rate(gallery_images_service_delete_gallery_duration_bucket[5m]))

# Количество созданных галерей за 24 часа
increase(gallery_images_service_create_gallery_total{result="success"}[24h])

# Доля ошибок для всех gallery-операций
sum(rate(gallery_images_service_*_total{result="error"}[5m]))
  / sum(rate(gallery_images_service_*_total[5m]))
```

---

## 4. Health-check

### `GET /health`

Из `shared/monitoring/src/health.plugin.ts` (подключён в `src/app.ts:34` через `.use(healthPlugin)`).

Возвращает:
```json
{
  "status": "ok",
  "timestamp": "<ISO8601>",
  "uptime": "<seconds since process start>",
  "service": "gallery"
}
```

_Health-check **не трейсится** (health plugin не оборачивает спаны) и не публикует метрик._

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует | `gallery.init.main` → `gallery.init.repositories_plugin` → `gallery.init.repositories_plugin.mongoose` (handshake до MongoDB) |
| MongoDB не отвечает при старте | `gallery.init.repositories_plugin.mongoose` (зависает до срабатывания `mongoose.connection.once('connected', ...)`) |
| HTTP 404 на `getGallery` / `getImage` | span `images_service.get_gallery` / `images_service.get_image` → WARN `— failed` в логе (NotFoundError) |
| Медленный deleteGallery | метрика `gallery_images_service_delete_gallery_duration` (включает каскадное удаление картинок); проверять `image_repository.delete` в трейсе |
| Медленный createImage | метрика `gallery_images_service_create_image_duration` (span `images_service.create_image` в трейсе) |
| Ошибка валидации body | WARN `— failed` от `@LogDecorator` + ERROR от `ErrorHandlerPlugin` (валидация бросает `AppError`) |
| Mongoose CastError на `id` | ERROR `— system_error` от `@LogDecorator` + ERROR от `ErrorHandlerPlugin` |
| Health-check 500 | `healthPlugin` не зависит от MongoDB, проверить сам процесс (`process_runtime_node_*` метрики) |
