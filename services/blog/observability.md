# Blog Service — Observability Reference

CRUD-сервис для блогов и постов. Два Mongoose-репозитория (Blog, Post),
один сервис (BlogsService) с 10 публичными методами, 10 HTTP-endpoint-ов.
Нет daemon-ов, нет RabbitMQ, нет Redis, нет внешних клиентов — только
MongoDB и Elysia.

- **SERVICE_NAME:** `blog` (из `BLOG_SERVICE_NAME`)
- **Порт:** 3000 (из `BLOG_PORT`)
- **MongoDB DB:** `blog` (из `BLOG_MONGODB_DBNAME`)
- **БД:** MongoDB (Blog, Post)
- **Клиенты:** нет
- **Daemon-ы:** нет

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Каждый span — синхронный (`withTraceSync`) или асинхронный (`withTraceAsync`).
Слева → справа порядок.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `blog.init.main` | `index.ts:4` | ~всё время старта | всё ниже | Корневой span всего запуска. Оборачивает `createApp` через `tracer.startActiveSpan`. |
| `blog.init.repositories_plugin` | `app.ts:14` | ~MongoDB connect + создание 2 репо | `repositories_plugin.mongoose`, `repositories.blog`, `repositories.post`, `repositories.plugin` | Плагин репозиториев — MongoDB + инстансы |
| `blog.init.repositories.blog` | `plugins/repositories.plugin.ts:8` | <1ms | — | `new BlogRepository()` |
| `blog.init.repositories.post` | `plugins/repositories.plugin.ts:13` | <1ms | — | `new PostRepository()` |
| `blog.init.repositories_plugin.mongoose` | `plugins/repositories.plugin.ts:18` | ~2-5s (сеть) | — | `mongoose.connect()`. Самый долгий span старта. `ctx.end()` зовётся в callback `'connected'`, поэтому длительность = время до события. |
| `blog.init.repositories.plugin` | `plugins/repositories.plugin.ts:28` | <1ms | — | Сборка Elysia-плагина: `.decorate()` ×2 + `.onStop()` |
| `blog.init.services_plugin` | `app.ts:19` | <1ms | `services.blogs`, `services.plugin` | Плагин сервисов |
| `blog.init.services.blogs` | `plugins/services.plugin.ts:9` | <1ms | — | `new BlogsService(blogRepo, postRepo)` — DI обоих репозиториев |
| `blog.init.services.plugin` | `plugins/services.plugin.ts:17` | <1ms | — | Сборка Elysia-плагина: `.use(repositories)` + `.decorate("blogsService", ...)` |
| `blog.init.controllers_plugin` | `app.ts:24` | <1ms | `controllers.create_blog`, `controllers.update_blog`, `controllers.delete_blog`, `controllers.get_blog`, `controllers.get_blogs`, `controllers.create_post`, `controllers.update_post`, `controllers.delete_post`, `controllers.get_post`, `controllers.get_posts`, `controllers.plugin` | Плагин контроллеров — 10 роутов |
| `blog.init.controllers.create_blog` | `plugins/controllers.plugin.ts:16` | <1ms | — | `createBlogController(servicesPlugin)` |
| `blog.init.controllers.update_blog` | `plugins/controllers.plugin.ts:21` | <1ms | — | `updateBlogController(servicesPlugin)` |
| `blog.init.controllers.delete_blog` | `plugins/controllers.plugin.ts:26` | <1ms | — | `deleteBlogController(servicesPlugin)` |
| `blog.init.controllers.get_blog` | `plugins/controllers.plugin.ts:31` | <1ms | — | `getBlogController(servicesPlugin)` |
| `blog.init.controllers.get_blogs` | `plugins/controllers.plugin.ts:36` | <1ms | — | `getBlogsController(servicesPlugin)` |
| `blog.init.controllers.create_post` | `plugins/controllers.plugin.ts:41` | <1ms | — | `createPostController(servicesPlugin)` |
| `blog.init.controllers.update_post` | `plugins/controllers.plugin.ts:46` | <1ms | — | `updatePostController(servicesPlugin)` |
| `blog.init.controllers.delete_post` | `plugins/controllers.plugin.ts:51` | <1ms | — | `deletePostController(servicesPlugin)` |
| `blog.init.controllers.get_post` | `plugins/controllers.plugin.ts:56` | <1ms | — | `getPostController(servicesPlugin)` |
| `blog.init.controllers.get_posts` | `plugins/controllers.plugin.ts:61` | <1ms | — | `getPostsController(servicesPlugin)` |
| `blog.init.controllers.plugin` | `plugins/controllers.plugin.ts:66` | <1ms | — | Сборка Elysia-плагина контроллеров (10 `.use()`) |
| `blog.init.elysia` | `app.ts:29` | ~до `.listen()` callback | — | `new Elysia().use(...).listen()`. `ctx.end()` зовётся в listen callback. |

**Как читать в Tempo:** Ищи `blog.init.main`. Если он `Status=OK` — сервис
поднят. Самый длинный дочерний = `repositories_plugin.mongoose`; если >5s —
проблемы с MongoDB.

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Дочерние | Зачем |
|-----------|---------------|-------|----------|-------|
| `blog.stop.repositories_plugin` | `plugins/repositories.plugin.ts:34` | `.onStop()` (SIGTERM/SIGINT) | — | `mongoose.disconnect()`. Закрытие соединения с БД. |

**Как читать:** Если shutdown-span отсутствует — сервис упал (kill -9) или
`mongoose.disconnect()` не вызвался.

### 1.3. Runtime — бизнес-методы

Все методы сервиса и репозиториев обёрнуты в `@TraceDecorator()`. Имя спана =
`camelToSnakeCase(className) + '.' + camelToSnakeCase(methodName)`.

Атрибуты на спаны ставятся явно через `setSpanAttributes()` в теле метода
(по конвенции `rwa-observability` §1.5 — единый подход). Это позволяет в
Tempo искать все операции по конкретному блогу/посту через фильтры
`{ ownerId = "..." }`, `{ id = "..." }`, `{ blogId = "..." }` и т.п.

#### BlogsService (префикс `blogs_service`)

| Span name | Атрибуты span | HTTP endpoint | Запросы к БД | Ошибки |
|-----------|--------------|---------------|--------------|--------|
| `blogs_service.create_blog` | `ownerId`, `ownerType`, `creator`, `parentId`, `grandParentId` | `POST /createBlog` | `BlogRepository.create` | — |
| `blogs_service.update_blog` | `id` | `POST /updateBlog` | `BlogRepository.update` | `NotFoundError` (404), если id не найден |
| `blogs_service.delete_blog` | `id` | `POST /deleteBlog` | `PostRepository.findAll({blogIds:[id]})`, затем в цикле `PostRepository.delete` (×N), затем `BlogRepository.delete` | `NotFoundError` от `BlogRepository.delete` (404), если блог уже удалён |
| `blogs_service.get_blog` | `id` | `POST /getBlog` | `BlogRepository.findById` | `NotFoundError` (404), если id не найден |
| `blogs_service.get_blogs` | `filterKeys` (csv ключей `params.filter`), `limit`, `offset` | `POST /getBlogs` | `BlogRepository.findAll(filter, sort, limit, offset)` | — |
| `blogs_service.create_post` | `blogId`, `ownerId`, `ownerType`, `creator`, `parentId` | `POST /createPost` | `PostRepository.create` | — |
| `blogs_service.update_post` | `id` | `POST /updatePost` | `PostRepository.update` | `NotFoundError` (404) |
| `blogs_service.delete_post` | `id` | `POST /deletePost` | `PostRepository.delete` | `NotFoundError` (404) |
| `blogs_service.get_post` | `id` | `POST /getPost` | `PostRepository.findById` | `NotFoundError` (404) |
| `blogs_service.get_posts` | `filterKeys` (csv ключей `params.filter`), `limit`, `offset` | `POST /getPosts` | `PostRepository.findAll(filter, sort, limit, offset)` | — |

**Где искать в Tempo (примеры запросов):**
- Все операции конкретного блога: `{ id = "65f..." && name = "blogs_service.*" }`
- Все посты блога: `{ blogId = "65f..." && name = "blogs_service.*" }`
- Все действия юзера: `{ ownerId = "0x..." && name = "blogs_service.*" }`
- Запросы по ownerType: `{ ownerType = "company" && name = "blogs_service.*" }`
- Популярные filter-комбинации: `{ filterKeys =~ "ownerId,parentId" }`

#### BlogRepository (span prefix: blog_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `blog_repository.create` | `BlogsService.createBlog` | `BlogModel.create(data)` + `.toObject()` | — |
| `blog_repository.update` | `BlogsService.updateBlog` | `BlogModel.findByIdAndUpdate(id, data, {new:true}).lean()` | Бросает `NotFoundError("Blog", id)` если null |
| `blog_repository.delete` | `BlogsService.deleteBlog` | `BlogModel.findByIdAndDelete(id).lean()` | Бросает `NotFoundError("Blog", id)` если null |
| `blog_repository.find_by_id` | `BlogsService.getBlog` | `BlogModel.findById(id).lean()` | Бросает `NotFoundError` |
| `blog_repository.find_all` | `BlogsService.getBlogs` | `BlogModel.find(filter).sort(sort).skip(offset).limit(limit).lean()` | Не бросает (вернёт пустой массив) |

#### PostRepository (префикс `post_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `post_repository.create` | `BlogsService.createPost` | `PostModel.create(data)` + `.toObject()` | — |
| `post_repository.update` | `BlogsService.updatePost` | `PostModel.findByIdAndUpdate(id, data, {new:true}).lean()` | Бросает `NotFoundError("Post", id)` |
| `post_repository.delete` | `BlogsService.deletePost` **и** цикл внутри `BlogsService.deleteBlog` | `PostModel.findByIdAndDelete(id).lean()` | Бросает `NotFoundError`. В `deleteBlog` вызывается N раз (по числу постов блога) |
| `post_repository.find_by_id` | `BlogsService.getPost` | `PostModel.findById(id).lean()` | Бросает `NotFoundError` |
| `post_repository.find_all` | `BlogsService.getPosts` **и** `BlogsService.deleteBlog` (поиск постов для удаления) | `PostModel.find(filter).sort(sort).skip(offset).limit(limit).lean()` | В `deleteBlog` вызывается с `{blogIds: [id]}` |

### 1.4. Auto-instrumentation

Эти спаны создаются автоматически `@opentelemetry/instrumentation-*` —
никакого ручного кода. Настраивается в `monitoringPlugin` из `@shared/monitoring`.

| Тип | Инструмент | Какие спаны | Активно для blog | Атрибуты |
|-----|-----------|-------------|------------------|----------|
| HTTP | instrumentation-http | `POST /<endpoint>` (входящие) | **Да** | `http.status_code`, `http.target`, `http.service=blog`, `service.name=blog` |
| MongoDB | instrumentation-mongoose | `mongoose.Blog.*`, `mongoose.Post.*` | **Да** | `db.mongodb.collection`, `db.operation`, `db.statement` |
| Redis | instrumentation-redis / -ioredis | `redis-*` | **Нет** (blog не использует Redis) | — |
| DNS | instrumentation-dns | `dns.lookup` | Да | — |
| FS | instrumentation-fs | `fs.*` | Да (Bun runtime) | — |
| Net | instrumentation-net | `net.*` | Да | — |
| Runtime | instrumentation-runtime-node | — (только метрики) | Да | — |
| RabbitMQ | instrumentation-amqplib | `publish` / `consume` | **Нет** (blog не публикует и не консьюмит) | `messaging.rabbitmq.*` |
| GraphQL | instrumentation-graphql | — | Отключён глобально | — |

**Примеры MongoDB-спанов, которые появятся под репозиторными:**
- `mongoose.Blog.create` — для `blog_repository.create`
- `mongoose.Blog.findByIdAndUpdate` — для `blog_repository.update`
- `mongoose.Blog.findByIdAndDelete` — для `blog_repository.delete`
- `mongoose.Blog.findById` — для `blog_repository.find_by_id`
- `mongoose.Blog.find` — для `blog_repository.find_all`
- `mongoose.Post.create/findByIdAndUpdate/findByIdAndDelete/findById/find` — аналогично

### 1.5. Дебаг: полная иерархия для `POST /deleteBlog`

Самая «жирная» операция — каскадное удаление блога вместе со всеми постами:

```
POST /deleteBlog                                            ← HTTP auto-instr (http.service=blog)
  └── blogs_service.delete_blog                             ← @TraceDecorator
        ├── post_repository.find_all                        ← @TraceDecorator (фильтр {blogIds:[id]})
        │     └── mongoose.Post.find                        ← mongoose auto-instr
        ├── post_repository.delete (×N — постов в блоге)    ← @TraceDecorator, по одному span на пост
        │     └── mongoose.Post.findByIdAndDelete          ← mongoose auto-instr (×N)
        └── blog_repository.delete                          ← @TraceDecorator
              └── mongoose.Blog.findByIdAndDelete          ← mongoose auto-instr
```

**Где искать проблему:**
- `post_repository.find_all` долгий (>200ms) → блок с тысячами постов, или нет индекса `blogId`
- Цикл `post_repository.delete` ×N → N виден как N однотипных дочерних спанов. Если их >100 — стоит делать bulk delete
- `blog_repository.delete` упал → `NotFoundError`, блог уже кем-то удалён
- В Tempo: `span.count > 1` для `post_repository.delete` — это норма для `deleteBlog`

### 1.6. Дебаг: `POST /createBlog`

```
POST /createBlog                                              ← HTTP auto-instr
  └── blogs_service.create_blog {ownerId, ownerType, creator,  ← @TraceDecorator + setSpanAttributes
                                parentId, grandParentId}
        └── blog_repository.create                            ← @TraceDecorator
              └── mongoose.Blog.create                        ← mongoose auto-instr
```

**Где искать проблему:**
- Если не знаешь, чей блог создали — `{ name = "blogs_service.create_blog" && ownerId = "..." }` в Tempo
- Если нужно понять контекст иерархии — атрибут `parentId`/`grandParentId` покажет вложенность

---

## 2. Логи

Все логи через `@LogDecorator` (уровень DEBUG при входе/выходе, WARN для
`AppError`, ERROR для прочих) + `ErrorHandlerPlugin` (ERROR для всех
непойманных).

### 2.1. Business-логи (`blogs_service.*`)

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR при ошибке |
|-------|------------------|------------------|------------------------|
| `create_blog` | `blogs_service.create_blog — called` с `{data}` | `— ok` | `— failed` (AppError) → WARN; `— system_error` → ERROR |
| `update_blog` | `— called` с `{params: {id, updateData:{name}}}` | `— ok` | Аналогично (`NotFoundError` → WARN) |
| `delete_blog` | `— called` с `{id}` | `— ok` | Аналогично |
| `get_blog` | `— called` с `{id}` | `— ok` | `— failed` (NotFoundError) → WARN |
| `get_blogs` | `— called` с `{params: {filter, sort, limit, offset}}` | `— ok` | `— system_error` → ERROR |
| `create_post` | `— called` с `{data}` | `— ok` | Аналогично |
| `update_post` | `— called` с `{params: {id, updateData:{title,content,images,documents}}}` | `— ok` | Аналогично |
| `delete_post` | `— called` с `{id}` | `— ok` | Аналогично |
| `get_post` | `— called` с `{id}` | `— ok` | Аналогично |
| `get_posts` | `— called` с `{params: {filter, sort, limit, offset}}` | `— ok` | Аналогично |

**Замечание про `args: ['data']` / `['params']`:** `@LogDecorator` логирует
**весь объект** `data` / `params`. В них попадают все поля блога/поста
(включая `ownerId`, `creator`, `content`, `documents`, `images`). В production
с чувствительными данными это надо учитывать при настройке retention/scrub
в Loki.

**Как читать:**
- `— called` → операция началась (с аргументами)
- `— ok` → операция завершена успешно
- `— failed` → ожидаемая бизнес-ошибка (`NotFoundError`, `ValidationError`)
- `— system_error` → неожиданная ошибка (смотреть `stack`)

### 2.2. ErrorHandlerPlugin — автоматические логи

Любая ошибка, не пойманная вручную в контроллере:

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` (`NotFoundError` и т.д.) | `logger.error` (⚠️ именно ERROR, не WARN) | `[<error.code>] <error.message>` (например `[NOT_FOUND_ERROR] Blog with id ... not found`) | `{statusCode, path, details, stack}` |
| Любая другая ошибка | `logger.error` | `Unexpected error:` | `{path, error: "<Name>: <message>"}` |

⚠️ **Расхождение с доками `auth`/`ai-assistant`:** там написано WARN для
`AppError`. На самом деле `ErrorHandlerPlugin` логирует **все** ошибки через
`logger.error` (см. `shared/errors/error-handler.plugin.ts:11,31`). WARN
использует только `@LogDecorator` для `AppError`. Если дебажишь blog и
видишь только ERROR — это `ErrorHandlerPlugin`.

**Как читать:** Все 4xx → ERROR с `statusCode` в логах (через handler) и
WARN с `error.message` (через LogDecorator). 5xx → ERROR (handler).

---

## 3. Метрики

Все метрики префиксируются `SERVICE_NAME=blog` (формируется в
`shared/monitoring/src/metrics.ts:16`).

Создаются через `@MetricsDecorator()` на 10 публичных методах `BlogsService`
(counter `_total` + histogram `_duration`). На репозиториях декоратора нет —
latency БД доступна только через auto-instrumentation (`db.client.*`).

### 3.1. Business counters

| Prometheus имя | Тип | Labels | Когда инкрементится | Зачем |
|---------------|-----|--------|---------------------|-------|
| `blog_blogs_service_create_blog_total` | Counter | `result=success\|error` | Каждый вызов `createBlog` | Созданные блоги |
| `blog_blogs_service_create_blog_duration` | Histogram | — | Каждый вызов `createBlog` | Латентность создания |
| `blog_blogs_service_update_blog_total` | Counter | `result=success\|error` | Каждый вызов `updateBlog` | Обновления блогов |
| `blog_blogs_service_update_blog_duration` | Histogram | — | Каждый вызов `updateBlog` | Латентность |
| `blog_blogs_service_delete_blog_total` | Counter | `result=success\|error` | Каждый вызов `deleteBlog` | Удалённые блоги (включая каскад постов) |
| `blog_blogs_service_delete_blog_duration` | Histogram | — | Каждый вызов `deleteBlog` | Латентность всего каскада |
| `blog_blogs_service_get_blog_total` | Counter | `result=success\|error` | Каждый вызов `getBlog` | Запросы одного блога |
| `blog_blogs_service_get_blog_duration` | Histogram | — | Каждый вызов `getBlog` | Латентность |
| `blog_blogs_service_get_blogs_total` | Counter | `result=success\|error` | Каждый вызов `getBlogs` | Запросы списка блогов |
| `blog_blogs_service_get_blogs_duration` | Histogram | — | Каждый вызов `getBlogs` | Латентность |
| `blog_blogs_service_create_post_total` | Counter | `result=success\|error` | Каждый вызов `createPost` | Созданные посты |
| `blog_blogs_service_create_post_duration` | Histogram | — | Каждый вызов `createPost` | Латентность |
| `blog_blogs_service_update_post_total` | Counter | `result=success\|error` | Каждый вызов `updatePost` | Обновления постов |
| `blog_blogs_service_update_post_duration` | Histogram | — | Каждый вызов `updatePost` | Латентность |
| `blog_blogs_service_delete_post_total` | Counter | `result=success\|error` | Каждый вызов `deletePost` | Удалённые посты |
| `blog_blogs_service_delete_post_duration` | Histogram | — | Каждый вызов `deletePost` | Латентность |
| `blog_blogs_service_get_post_total` | Counter | `result=success\|error` | Каждый вызов `getPost` | Запросы одного поста |
| `blog_blogs_service_get_post_duration` | Histogram | — | Каждый вызов `getPost` | Латентность |
| `blog_blogs_service_get_posts_total` | Counter | `result=success\|error` | Каждый вызов `getPosts` | Запросы списка постов |
| `blog_blogs_service_get_posts_duration` | Histogram | — | Каждый вызов `getPosts` | Латентность |

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `@opentelemetry/instrumentation-runtime-node` | CPU, memory, event loop lag, GC |
| `http.server.duration` | HTTP auto-instrumentation | RPS, latency per endpoint, status codes |
| `http.client.duration` | HTTP auto-instrumentation | (нет исходящих вызовов у blog) |
| `db.client.operations.duration` | MongoDB auto-instrumentation | Количество запросов, latency по коллекциям `Blog`/`Post` |

**Как читать:**
- `process_runtime_node_event_loop_lag_seconds` — загружен ли event loop
- `http.server.duration{http.target="/createBlog"}` — latency конкретного endpoint
- `db.client.operations.duration{db.mongodb.collection="Blog"}` — latency
  постовых операций в MongoDB

### 3.3. Примеры PromQL

```promql
# Ошибки на любую операцию blog за 5 минут
sum by(http_target) (
  rate(blog_blogs_service_create_blog_total{result="error"}[5m])
  or rate(blog_blogs_service_update_blog_total{result="error"}[5m])
  or rate(blog_blogs_service_delete_blog_total{result="error"}[5m])
  or rate(blog_blogs_service_get_blog_total{result="error"}[5m])
  or rate(blog_blogs_service_create_post_total{result="error"}[5m])
  or rate(blog_blogs_service_update_post_total{result="error"}[5m])
  or rate(blog_blogs_service_delete_post_total{result="error"}[5m])
  or rate(blog_blogs_service_get_post_total{result="error"}[5m])
)

# P99 latency создания блога
histogram_quantile(0.99, rate(blog_blogs_service_create_blog_duration_bucket[5m]))

# Сколько блогов создано за сутки
increase(blog_blogs_service_create_blog_total{result="success"}[24h])

# P99 latency каскадного deleteBlog (должен расти с числом постов)
histogram_quantile(0.99, rate(blog_blogs_service_delete_blog_duration_bucket[5m]))

# RPS по операциям
sum(rate(blog_blogs_service_get_blogs_total[1h]))
```

---

## 4. Health-check

### `GET /health`

Не трейсится (нет декораторов, нет авто-инструментации для health plugin —
быстрый ответ). Возвращает:

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "service": "blog"
}
```

**Как читать:** Если `/health` не отвечает — сервис не стартанул.
Используется в Docker Compose healthcheck.

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует | docker logs — ошибка в init-фазе (MongoDB URI, BLOG_SERVICE_NAME) |
| `getBlog` возвращает 404 | Span `blog_repository.find_by_id` — ищи `NOT_FOUND_ERROR` в логах |
| `updateBlog` падает | `blog_blogs_service_update_blog_total{result="error"}`. Лог `blogs_service.update_blog — failed` |
| `deleteBlog` долго работает | `blog_blogs_service_delete_blog_duration` histogram. Если >1s — много постов в блоге (нет bulk delete). В Tempo видно N однотипных `post_repository.delete` спанов |
| `getBlogs` падает на большом filter | `db.client.operations.duration{db.mongodb.collection="Blog"}` — проверь наличие индексов `{ownerId:1}`, `{creator:1}`, `{parentId:1}`, `{grandParentId:1}` (уже созданы в `models/entity/blog.entity.ts:44-47`) |
| `getPosts` без индексов | Аналогично — индексы `{ownerId:1}`, `{creator:1}`, `{parentId:1}`, `{grandParentId:1}` есть (`models/entity/post.entity.ts:61-64`), но **нет индекса по `blogId`** — самый частый filter при каскаде. Если `findAll({blogIds:[id]})` лагает — добавить индекс `{blogId:1}` |
| Метрик нет в Prometheus | Проверить `SERVICE_NAME=blog`, target status, экспортёр Alloy |
| Логи не идут в Loki | Проверить `OTEL_EXPORTER_OTLP_ENDPOINT`, Alloy health |
| Найти все операции по блогу | Tempo: `{ http.target = "/createBlog" }` и фильтр по `_id` через `traceId` |
| `blogId` в URL приходит как строка, а Post.blogId — ObjectId | TypeScript: контроллер передаёт `body.id` строкой в репозиторий, Mongoose сам кастит. Если ошибка — лог `blogs_service.create_post — system_error` с `CastError` |
