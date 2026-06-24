# Auth Service — Observability Reference

Сервис аутентификации. Два репозитория (User, RefreshToken), один сервис
(AuthService), 5 HTTP-endpoint-ов. Нет daemon-ов, нет RabbitMQ, нет внешних
клиентов — только JWT + EIP-712 + MongoDB.

`SERVICE_NAME=auth` (из env). Все метрики префиксируются этим именем.

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Старт сервиса. Каждый span — синхронный (withTraceSync) или асинхронный (withTraceAsync).
Слева → справа порядок.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `auth.init.main` | `index.ts:4` | ~всё время старта | всё ниже | Корневой span всего запуска. Оборачивает `createApp`. |
| `auth.init.repositories_plugin` | `app.ts:22` | ~MongoDB connect | `repositories_plugin.mongoose`, `repositories.user`, `repositories.refresh_token`, `repositories.plugin` | Плагин репозиториев — MongoDB + инстансы |
| `auth.init.repositories_plugin.mongoose` | `repositories.plugin.ts:19` | ~2-5s (сеть) | — | `mongoose.connect()`. Самый долгий span старта. |
| `auth.init.repositories.user` | `repositories.plugin.ts:9` | <1ms | — | `new UserRepository()` |
| `auth.init.repositories.refresh_token` | `repositories.plugin.ts:14` | <1ms | — | `new RefreshTokenRepository()` |
| `auth.init.repositories.plugin` | `repositories.plugin.ts:29` | <1ms | — | Сборка Elysia-плагина: `.decorate()` + `.onStop()` |
| `auth.init.services_plugin` | `app.ts:27` | <1ms | `services.auth`, `services.plugin` | Плагин сервисов |
| `auth.init.services.auth` | `services.plugin.ts:15` | <1ms | — | `new AuthService(...)` — DI всех зависимостей |
| `auth.init.services.plugin` | `services.plugin.ts:28` | <1ms | — | Сборка Elysia-плагина: `.decorate("authService", ...)` |
| `auth.init.controllers` | `app.ts:39` | <1ms | `controllers.authentication`, `controllers.refresh_token`, `controllers.get_user`, `controllers.get_user_tokens`, `controllers.revoke`, `controllers.plugin` | Плагин контроллеров — 5 роутов |
| `auth.init.controllers.authentication` | `controllers.plugin.ts:12` | <1ms | — | `createAuthenticateController()` |
| `auth.init.controllers.refresh_token` | `controllers.plugin.ts:17` | <1ms | — | `createRefreshTokenController()` |
| `auth.init.controllers.get_user` | `controllers.plugin.ts:22` | <1ms | — | `createGetUserController()` |
| `auth.init.controllers.get_user_tokens` | `controllers.plugin.ts:27` | <1ms | — | `createGetUserTokensController()` |
| `auth.init.controllers.revoke` | `controllers.plugin.ts:32` | <1ms | — | `createRevokeTokensController()` |
| `auth.init.controllers.plugin` | `controllers.plugin.ts:37` | <1ms | — | Сборка Elysia-плагина контроллеров |
| `auth.init.elysia` | `app.ts:44` | ~до `.listen()` callback | — | `new Elysia().use(...).listen()`. Ждёт listen callback. |

**Как читать в Tempo:** Ищи `auth.init.main`. Если он успешен (Status=OK), сервис
поднят. Самый длинный дочерний span = `repositories_plugin.mongoose` — если он
>5s, проблемы с MongoDB.

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Дочерние | Зачем |
|-----------|---------------|-------|----------|-------|
| `auth.stop.repositories_plugin` | `repositories.plugin.ts:35` | .onStop() | — | `mongoose.disconnect()`. Закрытие соединения с БД. |

**Как читать:** Если shutdown-спан отсутствует — сервис упал (kill -9) или
mongoose.disconnect() не вызвался.

### 1.3. Runtime — бизнес-методы

Создаются через `@TraceDecorator()`. Имя спана = `<snake_class_name>.<snake_method_name>`.

Атрибуты на спаны ставятся **явно** через `setSpanAttributes()` внутри тела метода,
а не через декоратор — это единый подход во всём сервисе.

#### AuthService (префикс `auth_service`)

| Span name | Атрибуты span | HTTP endpoint | Запросы к БД | Ошибки |
|-----------|--------------|---------------|--------------|--------|
| `auth_service.authenticate` | `wallet` | `POST /authenticate` | `UserRepository.exists`, `UserRepository.findOrCreate`, `RefreshTokenRepository.create` | timestamp >60s → Error; invalid sig → Error |
| `auth_service.verify_signature` | — | — (private) | — | EIP-712 recovery fail → return false (**тихо**, лога нет) |
| `auth_service.generate_tokens` | — | — (private) | `refresh_token_repository.create` | — |
| `auth_service.refresh_token` | `wallet` | `POST /refreshToken` | `refresh_token_repository.find_by_token_hash`, `refresh_token_repository.delete_tokens`, `user_repository.find_by_id`, `refresh_token_repository.create` | `InvalidTokenError` (expired/wrong type/not found) |
| `auth_service.verify_token` | — | — (private) | — | jwt.verify fail → Error |
| `auth_service.get_user` | `userId` | `POST /getUser` | `user_repository.find_by_id` | `NotFoundError` |
| `auth_service.get_user_tokens` | `userId` | `POST /getUserTokens` | `refresh_token_repository.find_by_user_id` | — |
| `auth_service.revoke_tokens` | `userId` | `POST /revokeTokens` | `refresh_token_repository.delete_tokens` | — |

#### UserRepository (префикс `user_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `user_repository.find_by_wallet` | (прямо не из сервиса auth) | `User.findOne({wallet})` | Выбросит NotFoundError |
| `user_repository.find_by_id` | `auth_service.get_user`, `auth_service.refresh_token` | `User.findById(id).lean()` | Выбросит NotFoundError |
| `user_repository.find_or_create` | `auth_service.authenticate` | `User.findOneAndUpdate({wallet}, {$setOnInsert}, {upsert:true})` | Upsert — если юзер новый, создаётся |
| `user_repository.exists` | `auth_service.authenticate` | `User.exists({wallet})` | Проверка существования. Нужна для метрики `auth_users_created_total` |
| `user_repository.delete` | **не используется в auth** | `User.findByIdAndDelete(id).lean()` | Dead code. Есть декоратор, но ни один метод не вызывает. |

#### RefreshTokenRepository (префикс `refresh_token_repository`)

| Span name | Вызывается из | MongoDB операция |
|-----------|---------------|-------------------|
| `refresh_token_repository.create` | `auth_service.generate_tokens` | `RefreshToken.create({userId, tokenHash, expiresAt})` |
| `refresh_token_repository.find_by_token_hash` | `auth_service.refresh_token` | `RefreshToken.findOne({tokenHash}).lean()` |
| `refresh_token_repository.find_by_user_id` | `auth_service.get_user_tokens` | `RefreshToken.find({userId}).lean()` |
| `refresh_token_repository.delete_tokens` | `auth_service.refresh_token`, `auth_service.revoke_tokens` | `RefreshToken.deleteMany({userId, tokenHash:{$in:[...]}})` |

### 1.4. Runtime — auto-instrumentation (monitoringPlugin)

Эти спаны создаются автоматически `@opentelemetry/instrumentation-*` — никакого
ручного кода.

#### HTTP (instrumentation-http)

| Span name | Когда | method + path | Атрибуты |
|-----------|-------|---------------|----------|
| `POST /authenticate` | Каждый входящий запрос | POST | `http.status_code`, `http.target`, `http.service=auth` |
| `POST /refreshToken` | Каждый входящий запрос | POST | аналогично |
| `POST /getUser` | Каждый входящий запрос | POST | аналогично |
| `POST /getUserTokens` | Каждый входящий запрос | POST | аналогично |
| `POST /revokeTokens` | Каждый входящий запрос | POST | аналогично |
| `GET /health` | Каждый health-check | GET | аналогично |

**Как читать:** HTTP span — родитель для всех `auth_service.*` спанов.
Если HTTP span есть, но дочернего `auth_service.*` нет — проблема в Elysia роутинге.

#### MongoDB (instrumentation-mongoose)

Каждый MongoDB запрос порождает span имени операции + коллекции, например:
- `mongoose.User.findOneUpdate` — для `user_repository.find_or_create`
- `mongoose.User.findOne` — для `user_repository.exists`
- `mongoose.RefreshToken.findOne` — для `refresh_token_repository.find_by_token_hash`
- `mongoose.RefreshToken.deleteMany` — для `refresh_token_repository.delete_tokens`

Атрибуты: `db.mongodb.collection`, `db.operation`, `db.statement`.

**Как читать:** Дочерние спаны соответствующего `user_repository.*` /
`refresh_token_repository.*`. Если MongoDB span отсутствует — репозиторий
не вызвался (ошибка до запроса).

#### DNS, FS, Net (instrumentation-dns, -fs, -net)

- `dns.lookup` — при DNS-разрешении MongoDB hostname
- `fs.*` — при чтении файлов (Bun runtime)
- `net.*` — при установке TCP-соединений

**Как читать:** Обычно неинтересны, шум. Фильтровать в Tempo: `span.duration_ms > 5`.

### 1.5. Дебаг: полная иерархия для `POST /authenticate`

```
POST /authenticate                                         ← HTTP auto-instr
  └── auth_service.authenticate {wallet=0x...}             ← @TraceDecorator + setSpanAttributes
        ├── user_repository.exists                         ← @TraceDecorator
        │     └── mongoose.User.findOne                    ← mongoose auto-instr (exists return null)
        ├── auth_service.verify_signature                  ← @TraceDecorator, EIP-712 recovery
        ├── user_repository.find_or_create                  ← @TraceDecorator
        │     └── mongoose.User.findOneAndUpdate           ← mongoose auto-instr
        └── auth_service.generate_tokens                    ← @TraceDecorator
              ├── jwt sign access + refresh                ← без спана (быстро)
              └── refresh_token_repository.create            ← @TraceDecorator
                    └── mongoose.RefreshToken.create         ← mongoose auto-instr
```

**Где искать проблему:**
- `verify_signature` упал → ошибка recovery / не та цепочка / bad signature
- `find_or_create` долгий (>200ms) → MongoDB лагает / нет индекса
- `generate_tokens` упал → JWT_SECRET не установлен или Mongo не отвечает

---

## 2. Логи

Все логи через `@LogDecorator` (уровень DEBUG) + `ErrorHandlerPlugin` (ERROR/WARN).

### 2.1. Business-логи (auth_service.*)

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR при ошибке |
|-------|------------------|------------------|-----------------------|
| `authenticate` | `auth_service.authenticate — called` с `{wallet, timestamp}` | `auth_service.authenticate — ok` | `— failed` (ошибка подписи/таймстамп) → WARN; `— system_error` (любая другая) → ERROR |
| `refreshToken` | `auth_service.refresh_token — called` (без аргументов — нет args) | `auth_service.refresh_token — ok` | `— failed` → WARN (InvalidTokenError — ожидаемо); `— system_error` → ERROR |
| `getUser` | `auth_service.get_user — called` с `{userId}` | `auth_service.get_user — ok` | `— failed` → WARN (NotFoundError); `— system_error` → ERROR |
| `getUserTokens` | `auth_service.get_user_tokens — called` с `{userId}` | `auth_service.get_user_tokens — ok` | `— system_error` → ERROR |
| `revokeTokens` | `auth_service.revoke_tokens — called` с `{userId}` | `auth_service.revoke_tokens — ok` | `— system_error` → ERROR |

**Как читать:**
- `— called` → операция началась
- `— ok` → операция завершена успешно
- `— failed` → ожидаемая бизнес-ошибка (проверить `error` атрибут)
- `— system_error` → неожиданная ошибка (смотреть `errorStack`)

### 2.2. ErrorHandlerPlugin — автоматические логи

Любая ошибка, не пойманная вручную:

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` (NotFoundError, InvalidTokenError) | WARN | `error.message` | `{error, errorName, errorStack}` |
| Любая другая ошибка | ERROR | `error.message` | `{error, errorName, errorStack, path}` |

**Как читать:** Все 4xx → WARN (ожидаемо). 5xx → ERROR (смотреть stack).

### 2.3. Init логи (мониторинг plugin)

При старте сервиса логи не ставятся напрямую — но если ошибка в init-фазе,
`ErrorHandlerPlugin` не успеет подключиться, ошибка упадёт в консоль/stdio
(но не в Loki). **Признак:** сервис запустился, потом сразу умер — смотреть
docker logs.

### 2.4. Известная дыра — verifySignature

`auth_service.verify_signature` ловит `catch (error)` и просто возвращает `false`.
Ошибка ethers (неверный формат signature, проблемы c domain) **не логируется**.
Клиент видит `"Invalid signature"`, но в логах нет контекста — ethers упал
или подпись реально не сошлась.

Если эта диагностика понадобится — добавить `logger.warn` в catch.

---

## 3. Метрики

Все метрики префиксируются `SERVICE_NAME=auth`.

Создаются через:
- `@MetricsDecorator()` — на 5 публичных методах `AuthService` (counter + histogram)
- Прямой вызов `metrics.counter()` — на `auth_users_created_total`

### 3.1. Business counters

| Prometheus имя | Тип | Labels | Когда инкрементится | Зачем |
|---------------|-----|--------|---------------------|-------|
| `auth_auth_service_authenticate_total` | Counter | `result=success\|error` | Каждый вызов `authenticate` | Успешные/ошибочные логины |
| `auth_auth_service_authenticate_duration` | Histogram | — | Каждый вызов `authenticate` | Распределение времени логина |
| `auth_auth_service_refresh_token_total` | Counter | `result=success\|error` | Каждый вызов `refreshToken` | Обновления токенов |
| `auth_auth_service_refresh_token_duration` | Histogram | — | Каждый вызов `refreshToken` | Латентность обновления токена |
| `auth_auth_service_get_user_total` | Counter | `result=success\|error` | Каждый вызов `getUser` | Запросы данных пользователя |
| `auth_auth_service_get_user_duration` | Histogram | — | Каждый вызов `getUser` | Латентность |
| `auth_auth_service_get_user_tokens_total` | Counter | `result=success\|error` | Каждый вызов `getUserTokens` | Запросы списка токенов |
| `auth_auth_service_get_user_tokens_duration` | Histogram | — | Каждый вызов `getUserTokens` | Латентность |
| `auth_auth_service_revoke_tokens_total` | Counter | `result=success\|error` | Каждый вызов `revokeTokens` | Отзывы токенов |
| `auth_auth_service_revoke_tokens_duration` | Histogram | — | Каждый вызов `revokeTokens` | Латентность |
| `auth_users_created_total` | Counter | — | Когда `UserRepository.exists` вернул `false` и `findOrCreate` создал нового юзера | **Сколько новых пользователей зарегистрировалось** |

**Как читать в PromQL:**
```promql
# Ошибки аутентификации в минуту
rate(auth_auth_service_authenticate_total{result="error"}[5m])

# P99 латентность обновления токена
histogram_quantile(0.99, rate(auth_auth_service_refresh_token_duration_bucket[5m]))

# Нагрузка на сервис (RPS)
sum(rate(auth_auth_service_authenticate_total[1h]))

# Сколько новых юзеров за последний час
increase(auth_users_created_total[1h])
```

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `@opentelemetry/instrumentation-runtime-node` | CPU, memory, event loop lag, GC |
| `http.server.*` | HTTP auto-instrumentation | RPS, latency per endpoint, status codes |
| `db.client.*` | MongoDB auto-instrumentation | Количество запросов, latency по коллекциям |

**Как читать:**
- `process_runtime_node_event_loop_lag_seconds` — загружен ли event loop
- `http.server.duration` — latency всего HTTP-сервера (включая парсинг тела)
- Запросы вида `{http.target="/authenticate"}` — фильтр по endpoint

---

## 4. Health-check

### `GET /health`

Не трейсится (нет декораторов, нет авто-инструментации — быстрый ответ).
Возвращает:

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "service": "auth"
}
```

**Как читать:** Если `/health` не отвечает — сервис не стартанул.
Используется в Docker Compose healthcheck.

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует | docker logs — ошибка в init-фазе (MongoDB URI, JWT_SECRET) |
| authenticate падает "Timestamp too far" | Атрибут `timestamp` в span `auth_service.authenticate` |
| authenticate падает "Invalid signature" | Span `auth_service.verify_signature` — ethers мог упасть (нет лога) |
| Токен не обновляется | Span `auth_service.refresh_token` — какой throw: InvalidTokenError / NotFoundError |
| getUser возвращает 404 | Span `user_repository.find_by_id` — NotFoundError |
| Сервис медленный | Histogram `auth_auth_service_authenticate_duration` → P50/P95/P99, глубже в MongoDB spans |
| Сервис не пишет в Loki | Проверить `OTEL_EXPORTER_OTLP_ENDPOINT` env, Alloy health |
| Метрики пустые | Проверить `SERVICE_NAME=auth`, Prometheus target status |
| Вопрос "сколько новых юзеров?" | `increase(auth_users_created_total[24h])` в Grafana |
| Вопрос "что делал конкретный юзер?" | Tempo search: `{ wallet = "0x..." }` |
