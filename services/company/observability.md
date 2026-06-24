# Company Service — Observability Reference

CRUD-сервис для компаний и связанных сущностей (члены компании, права
доступа). Три Mongoose-репозитория (`Company`, `Member`, `Permission`),
один сервис `CompanyService` с 9 публичными методами, 9 Elysia-роутов
(`POST /createCompany`, `/updateCompany`, `/deleteCompany`, `/getCompany`,
`/getCompanies`, `/addMember`, `/removeMember`, `/grantPermission`,
`/revokePermission`). Нет daemon-ов, нет RabbitMQ, нет Redis, нет
внешних клиентов и нет исходящих HTTP-вызовов — только MongoDB и Elysia.

- **SERVICE_NAME:** `company` (из `COMPANY_SERVICE_NAME` в `docker-compose.yml`)
- **Порт:** `COMPANY_PORT`
- **MongoDB DB:** `company` (из `COMPANY_MONGODB_DBNAME`)
- **БД:** MongoDB (коллекции `Company`, `Member`, `Permission`)
- **Клиенты:** нет
- **Daemon-ы:** нет
- **Платформа:** Bun + Elysia 1.3.5 + Mongoose 8.16.4

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Каждый span — синхронный (`withTraceSync`) или асинхронный (`withTraceAsync`).
Слева → справа порядок появления. Все литеральные имена — `company.<layer>.<op>`.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|--------------|----------|-------|
| `company.init.main` | `src/index.ts` (через `tracer.startActiveSpan`) | всё время старта | всё ниже | Корневой span запуска. Оборачивает `createApp`. |
| `company.init.repositories_plugin` | `src/app.ts` (через `withTraceAsync`) | ~MongoDB connect + создание 3 репо | все дочерние ниже | Плагин репозиториев: MongoDB + инстансы |
| `company.init.repositories.company` | `src/plugins/repositories.plugin.ts` (через `withTraceSync`) | <1ms | — | `new CompanyRepository()` |
| `company.init.repositories.member` | `src/plugins/repositories.plugin.ts` (через `withTraceSync`) | <1ms | — | `new MemberRepository()` |
| `company.init.repositories.permission` | `src/plugins/repositories.plugin.ts` (через `withTraceSync`) | <1ms | — | `new PermissionRepository()` |
| `company.init.repositories_plugin.mongoose` | `src/plugins/repositories.plugin.ts` (через `withTraceAsync`) | ~2-5s (сеть) | — | `mongoose.connect(mongoUri)`. Самый долгий span старта. `ctx.end()` зовётся в callback на `mongoose.connection.once('connected')`. |
| `company.init.repositories.plugin` | `src/plugins/repositories.plugin.ts` (через `withTraceSync`) | <1ms | — | Сборка Elysia-плагина: 3 `.decorate()` + `.onStop()` |
| `company.init.services_plugin` | `src/app.ts` (через `withTraceSync`) | <1ms | `company.init.services.company`, `company.init.services.plugin` | Плагин сервисов |
| `company.init.services.company` | `src/plugins/services.plugin.ts` (через `withTraceSync`) | <1ms | — | `new CompanyService(companyRepo, memberRepo, permissionRepo)` — DI трёх репозиториев |
| `company.init.services.plugin` | `src/plugins/services.plugin.ts` (через `withTraceSync`) | <1ms | — | Сборка Elysia-плагина: `.use(repositories)` + `.decorate("companyService", ...)` |
| `company.init.controllers_plugin` | `src/app.ts` (через `withTraceSync`) | <1ms | все 9 `controllers.<op>` + `controllers.plugin` | Плагин контроллеров — 9 роутов |
| `company.init.controllers.create_company` | `src/plugins/controllers.plugin.ts` | <1ms | — | `createCompanyController(servicesPlugin)` |
| `company.init.controllers.update_company` | `src/plugins/controllers.plugin.ts` | <1ms | — | `updateCompanyController(servicesPlugin)` |
| `company.init.controllers.delete_company` | `src/plugins/controllers.plugin.ts` | <1ms | — | `deleteCompanyController(servicesPlugin)` |
| `company.init.controllers.get_company` | `src/plugins/controllers.plugin.ts` | <1ms | — | `getCompanyController(servicesPlugin)` |
| `company.init.controllers.get_companies` | `src/plugins/controllers.plugin.ts` | <1ms | — | `getCompaniesController(servicesPlugin)` |
| `company.init.controllers.add_member` | `src/plugins/controllers.plugin.ts` | <1ms | — | `addMemberController(servicesPlugin)` |
| `company.init.controllers.remove_member` | `src/plugins/controllers.plugin.ts` | <1ms | — | `removeMemberController(servicesPlugin)` |
| `company.init.controllers.grant_permission` | `src/plugins/controllers.plugin.ts` | <1ms | — | `grantPermissionController(servicesPlugin)` |
| `company.init.controllers.revoke_permission` | `src/plugins/controllers.plugin.ts` | <1ms | — | `revokePermissionController(servicesPlugin)` |
| `company.init.controllers.plugin` | `src/plugins/controllers.plugin.ts` | <1ms | — | Сборка Elysia-плагина контроллеров (9 `.use()`) |
| `company.init.elysia` | `src/app.ts` (через `withTraceSync`) | до `.listen()` callback | — | `new Elysia().use(...).listen()`. `ctx.end()` зовётся в `listen` callback. |

**Как читать в Tempo:** Ищи `company.init.main`. Если он `Status=OK` — сервис
поднят. Самый длинный дочерний = `repositories_plugin.mongoose`; если >5s —
проблемы с MongoDB.

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Дочерние | Зачем |
|-----------|---------------|-------|----------|-------|
| `company.stop.repositories_plugin` | `src/plugins/repositories.plugin.ts` (`.onStop()` через `withTraceAsync`) | SIGTERM/SIGINT → `app.stop()` | — | `mongoose.disconnect()`. Закрытие соединения с БД. |

**Как читать:** Если shutdown-span отсутствует — сервис упал (kill -9) или
`mongoose.disconnect()` не вызвался.

### 1.3. Runtime — бизнес-методы

Все 9 методов сервиса и 17 методов репозиториев обёрнуты в `@TraceDecorator()`.
Имя спана = `camelToSnakeCase(className) + '.' + camelToSnakeCase(methodName)`
(вычисляется в `shared/monitoring/src/traceDecorator.ts`).
Атрибуты задаются явно через `setSpanAttributes()` в теле метода
(`@shared/monitoring/src/tracing`).

#### `CompanyService` — span prefix: company_service

| Span name | Атрибуты span | HTTP endpoint | Запросы к БД | Ошибки |
|-----------|--------------|---------------|--------------|--------|
| `company_service.create_company` | `ownerId` | `POST /createCompany` | `CompanyRepository.create` | — |
| `company_service.update_company` | `id` | `POST /updateCompany` | `CompanyRepository.update` | `NotFoundError("Company", id)` (404) |
| `company_service.delete_company` | `companyId` | `POST /deleteCompany` | `PermissionRepository.deleteMany({companyId})` → `MemberRepository.deleteMany({companyId})` → `CompanyRepository.delete` | `NotFoundError` от `CompanyRepository.delete` (404) |
| `company_service.get_company` | `id` | `POST /getCompany` | `CompanyRepository.findById` → затем в `mapCompanyWithDetails` (private): `MemberRepository.findAll({companyId})` + `PermissionRepository.findAll({companyId})` | `NotFoundError` (404) |
| `company_service.get_companies` | `filterKeys` (csv ключей `params.filter`), `limit`, `offset` | `POST /getCompanies` | `CompanyRepository.findAll(filter, sort, limit, offset)` | — |
| `company_service.add_member` | `companyId`, `userId` | `POST /addMember` | `MemberRepository.create` | `MongoServerError: 11000` (duplicate key, уникальный индекс `{companyId, userId}`) |
| `company_service.remove_member` | `memberId` | `POST /removeMember` | `PermissionRepository.deleteMany({memberId})` → `MemberRepository.delete` | `NotFoundError` от `MemberRepository.delete` (404) |
| `company_service.grant_permission` | `companyId`, `memberId`, `userId`, `permission`, `entity` | `POST /grantPermission` | `PermissionRepository.create` | `MongoServerError: 11000` (duplicate key, уникальный индекс `{memberId, permission, entity}`) |
| `company_service.revoke_permission` | `permissionId` | `POST /revokePermission` | `PermissionRepository.delete` | `NotFoundError` (404) |

**Замечание по `getCompany`:** метод `mapCompanyWithDetails` (private,
вызывается внутри `getCompany`) делает **два неограниченных** запроса
`findAll` — `MemberRepository.findAll({companyId})` +
`PermissionRepository.findAll({companyId})`. На компаниях с тысячами
членов/прав это деградирует latency. См. чек-лист §5.

#### `CompanyRepository` — span prefix: company_repository

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `company_repository.create` | `CompanyService.createCompany` | `CompanyModel.create(data).toObject()` | — |
| `company_repository.update` | `CompanyService.updateCompany` | `CompanyModel.findByIdAndUpdate(id, data, {new:true}).lean()` | Бросает `NotFoundError("Company", id)` если null |
| `company_repository.delete` | `CompanyService.deleteCompany` | `CompanyModel.findByIdAndDelete(id).lean()` | Бросает `NotFoundError` если null |
| `company_repository.delete_many` | `CompanyService.deleteCompany` | `CompanyModel.deleteMany({companyId})` | Возвращает `deletedCount`. Не бросает. |
| `company_repository.find_by_id` | `CompanyService.getCompany` | `CompanyModel.findById(id).lean()` | Бросает `NotFoundError` |
| `company_repository.find_all` | `CompanyService.getCompanies` | `CompanyModel.find(filter).sort(sort).skip(offset).limit(limit).lean()` | Не бросает (вернёт пустой массив) |

#### `MemberRepository` (snake_case prefix: `member_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `member_repository.create` | `CompanyService.addMember` | `MemberModel.create(data).toObject()` | Уникальный индекс `{companyId, userId}` — duplicate → 11000 |
| `member_repository.update` | **(не вызывается из сервиса)** | `MemberModel.findByIdAndUpdate(id, data, {new:true}).lean()` | Метод существует, но `CompanyService` его не зовёт. |
| `member_repository.delete` | `CompanyService.removeMember` | `MemberModel.findByIdAndDelete(id).lean()` | Бросает `NotFoundError` |
| `member_repository.delete_many` | `CompanyService.deleteCompany` | `MemberModel.deleteMany({companyId})` | Возвращает `deletedCount`. Не бросает. |
| `member_repository.find_by_id` | **(не вызывается из сервиса)** | `MemberModel.findById(id).lean()` | Бросает `NotFoundError`. |
| `member_repository.find_all` | `CompanyService.getCompany` (внутри `mapCompanyWithDetails`) | `MemberModel.find({companyId}).sort({createdAt:'asc'}).lean()` | **Без limit/offset** — потенциально длинный. |

#### `PermissionRepository` (snake_case prefix: `permission_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `permission_repository.create` | `CompanyService.grantPermission` | `PermissionModel.create(data).toObject()` | Уникальный индекс `{memberId, permission, entity}` — duplicate → 11000 |
| `permission_repository.delete` | `CompanyService.revokePermission` | `PermissionModel.findByIdAndDelete(id).lean()` | Бросает `NotFoundError` |
| `permission_repository.delete_many` | `CompanyService.deleteCompany` (по `companyId`) **и** `CompanyService.removeMember` (по `memberId`) | `PermissionModel.deleteMany(filter)` | Возвращает `deletedCount`. Не бросает. |
| `permission_repository.find_all` | `CompanyService.getCompany` (внутри `mapCompanyWithDetails`) | `PermissionModel.find({companyId}).sort({createdAt:'asc'}).lean()` | **Без limit/offset** — потенциально длинный. |

### 1.4. Auto-instrumentation

Эти спаны создаются автоматически `@opentelemetry/instrumentation-*` —
никакого ручного кода. Настраивается в `monitoringPlugin` из
`shared/monitoring/src/monitoring.plugin.ts`.

| Тип | Инструмент | Какие спаны | Активно для company | Атрибуты |
|-----|-----------|-------------|---------------------|----------|
| HTTP | instrumentation-http | `POST /<endpoint>` (входящие) | **Да** | `http.status_code`, `http.target`, `http.service=company`, `service.name=company` |
| MongoDB | instrumentation-mongoose | `mongoose.Company.*`, `mongoose.Member.*`, `mongoose.Permission.*` | **Нет** (см. `shared/monitoring/src/monitoring.plugin.ts:77` — `suppressInternalInstrumentation: true`) | `db.mongodb.collection`, `db.operation`, `db.statement` |
| Redis | instrumentation-ioredis | `redis-*` | **Нет** (company не использует Redis) | — |
| DNS | instrumentation-dns | `dns.lookup` | Да | — |
| FS | instrumentation-fs | `fs.*` | Да (Bun runtime) | — |
| Net | instrumentation-net | `net.*` | Да | — |
| Runtime | instrumentation-runtime-node | — (только метрики) | Да | — |
| RabbitMQ | instrumentation-amqplib | `publish` / `consume` | **Нет** (company не публикует и не консьюмит) | `messaging.rabbitmq.*` |

### 1.5. Дебаг: полная иерархия для `POST /deleteCompany`

Каскадное удаление компании вместе со всеми её членами и правами:

```
POST /deleteCompany                                                ← HTTP auto-instr (http.service=company)
  └── company_service.delete_company {companyId}                  ← @TraceDecorator + setSpanAttributes
        ├── permission_repository.delete_many                      ← @TraceDecorator ({companyId})
        ├── member_repository.delete_many                          ← @TraceDecorator ({companyId})
        └── company_repository.delete                              ← @TraceDecorator
```

**Где искать проблему:**
- `permission_repository.delete_many` долгий (>1s) → у компании тысячи permissions
- `member_repository.delete_many` долгий → аналогично
- `company_repository.delete` упал → `NotFoundError`, компания уже удалена
- Нет `mongoose.Company.*` под каждым `*_repository.*` → подавлено `suppressInternalInstrumentation: true` (см. §1.4)

### 1.6. Дебаг: `POST /createCompany`

```
POST /createCompany                                          ← HTTP auto-instr
  └── company_service.create_company {ownerId}                ← @TraceDecorator + setSpanAttributes
        └── company_repository.create                        ← @TraceDecorator
```

**Где искать проблему:** latency `company_service.create_company` >200ms →
проверить индексы `{ownerId:1}` и `{name:1}` (`src/models/entity/company.entity.ts`).
Поиск всех созданий компаний конкретного владельца:
`{ name = "company_service.create_company" && ownerId = "0x..." }`

### 1.7. Дебаг: `POST /getCompany` — потенциально тяжёлая операция

```
POST /getCompany                                             ← HTTP auto-instr
  └── company_service.get_company {id}                        ← @TraceDecorator + setSpanAttributes
        ├── company_repository.find_by_id                    ← @TraceDecorator
        ├── member_repository.find_all                       ← @TraceDecorator ({companyId}, БЕЗ limit)
        └── permission_repository.find_all                   ← @TraceDecorator ({companyId}, БЕЗ limit)
```

`mapCompanyWithDetails` (private, вызывается из `getCompany`) делает
два неограниченных `findAll`. На компаниях с большим числом членов —
деградация. См. чек-лист §5.

---

## 2. Логи

Все логи через `@LogDecorator` (уровень DEBUG при входе/выходе, WARN для
`AppError`, ERROR для прочих) + `ErrorHandlerPlugin` (ERROR для всех
непойманных). Прямых `logger.*` вызовов в коде сервиса нет — только в
`repositories.plugin.ts` (init/shutdown MongoDB).

### 2.1. Business-логи (методы `CompanyService`)

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR при ошибке |
|-------|------------------|------------------|------------------------|
| `create_company` | `company_service.create_company — called` с `{data}` | `— ok` | `— system_error` → ERROR (нет ожидаемых AppError) |
| `update_company` | `— called` с `{id, updateData}` | `— ok` | `— failed` (`NotFoundError`) → WARN |
| `delete_company` | `— called` с `{companyId}` | `— ok` | `— failed` (`NotFoundError` от `CompanyRepository.delete`) → WARN |
| `get_company` | `— called` с `{id}` | `— ok` | `— failed` (`NotFoundError`) → WARN |
| `get_companies` | `— called` с `{params}` | `— ok` | `— system_error` → ERROR |
| `add_member` | `— called` с `{data}` | `— ok` | `— system_error` (duplicate key 11000) → ERROR |
| `remove_member` | `— called` с `{memberId}` | `— ok` | `— failed` (`NotFoundError`) → WARN |
| `grant_permission` | `— called` с `{data}` | `— ok` | `— system_error` (duplicate key 11000) → ERROR |
| `revoke_permission` | `— called` с `{permissionId}` | `— ok` | `— failed` (`NotFoundError`) → WARN |

**Замечание про `args: ['data']` / `['params']`:** `@LogDecorator`
логирует **весь объект** `data` / `params`. В них попадают все поля
(`ownerId`, `name`, `userId`, `memberId`, `permission`, `entity`).
PII (имена людей — `name`) логируется. В production с чувствительными
данными это надо учитывать при настройке retention/scrub в Loki.

**Дублирование логов для `AppError`:** Когда сервис бросает `NotFoundError`,
происходит:
1. `@LogDecorator` пишет `— failed` → WARN
2. `ErrorHandlerPlugin` ловит ошибку в `onError` → пишет `[NOT_FOUND_ERROR] ...` → **ERROR**

То есть одна и та же ожидаемая 4xx-ошибка логируется **дважды** с разными
уровнями (поведение shared-пакета; см. `rwa-observability-docs` §6).

**Как читать:**
- `— called` → операция началась (с аргументами)
- `— ok` → операция завершена успешно
- `— failed` → ожидаемая бизнес-ошибка (`NotFoundError`)
- `— system_error` → неожиданная ошибка (смотреть `stack`)

### 2.2. ErrorHandlerPlugin — автоматические логи

Любая ошибка, не пойманная вручную в контроллере:

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` (напр. `NotFoundError`) | `logger.error` (всегда ERROR, не WARN) | `[<error.code>] <error.message>` | `{statusCode, path, details, stack}` |
| Любая другая ошибка | `logger.error` | `Unexpected error:` | `{path, error: "<Name>: <message>"}` |

**Как читать:** Все 4xx → ERROR с `statusCode` в логах (через handler) и
WARN с `error.message` (через `@LogDecorator`). 5xx → ERROR (handler).
На практике для `AppError` получается дублирование — поведение
shared-пакета.

### 2.3. Init/shutdown логи

| Когда | Уровень | Сообщение | Атрибуты |
|-------|---------|-----------|----------|
| Connect start | `info` | `Connecting to MongoDB` | — |
| Connect success | `info` | `MongoDB connected successfully` | — |
| Disconnect start | `info` | `Disconnecting from MongoDB` | — |
| Disconnect success | `info` | `MongoDB disconnected successfully` | — |

`mongoUri` не логируется — credentials защищены (см. §6 Fix #2).

---

## 3. Метрики

Все метрики префиксируются `SERVICE_NAME=company` (формируется в
`shared/monitoring/src/metrics.ts`).

Создаются через `@MetricsDecorator()` на 9 публичных методах
`CompanyService` (counter `_total` + histogram `_duration`). На
репозиториях декоратора нет — latency БД недоступна через Prometheus
из-за `suppressInternalInstrumentation: true` (см. §1.4).

### 3.1. Business метрики (`@MetricsDecorator`)

`Prometheus` имя = `SERVICE_NAME + _ + <class_snake> + _ + <method_snake> + _ + total|duration`

| Prometheus имя | Тип | Labels | Когда инкрементится | Зачем |
|---------------|-----|--------|---------------------|-------|
| `company_company_service_create_company_total` | Counter | `result=success\|error` | Каждый вызов `createCompany` | Созданные компании |
| `company_company_service_create_company_duration` | Histogram | — | Каждый вызов `createCompany` | Латентность |
| `company_company_service_update_company_total` | Counter | `result=success\|error` | Каждый вызов `updateCompany` | Обновления компаний |
| `company_company_service_update_company_duration` | Histogram | — | Каждый вызов `updateCompany` | Латентность |
| `company_company_service_delete_company_total` | Counter | `result=success\|error` | Каждый вызов `deleteCompany` | Удалённые компании (включая каскад permissions+members) |
| `company_company_service_delete_company_duration` | Histogram | — | Каждый вызов `deleteCompany` | Латентность всего каскада |
| `company_company_service_get_company_total` | Counter | `result=success\|error` | Каждый вызов `getCompany` | Запросы одной компании с деталями |
| `company_company_service_get_company_duration` | Histogram | — | Каждый вызов `getCompany` | Латентность |
| `company_company_service_get_companies_total` | Counter | `result=success\|error` | Каждый вызов `getCompanies` | Запросы списка компаний |
| `company_company_service_get_companies_duration` | Histogram | — | Каждый вызов `getCompanies` | Латентность |
| `company_company_service_add_member_total` | Counter | `result=success\|error` | Каждый вызов `addMember` | Добавленные members |
| `company_company_service_add_member_duration` | Histogram | — | Каждый вызов `addMember` | Латентность |
| `company_company_service_remove_member_total` | Counter | `result=success\|error` | Каждый вызов `removeMember` | Удалённые members (включая каскад permissions) |
| `company_company_service_remove_member_duration` | Histogram | — | Каждый вызов `removeMember` | Латентность |
| `company_company_service_grant_permission_total` | Counter | `result=success\|error` | Каждый вызов `grantPermission` | Выданные permissions |
| `company_company_service_grant_permission_duration` | Histogram | — | Каждый вызов `grantPermission` | Латентность |
| `company_company_service_revoke_permission_total` | Counter | `result=success\|error` | Каждый вызов `revokePermission` | Отозванные permissions |
| `company_company_service_revoke_permission_duration` | Histogram | — | Каждый вызов `revokePermission` | Латентность |

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `instrumentation-runtime-node` | CPU, memory, event loop lag, GC |
| `http_server_duration` | HTTP auto-instr | RPS, latency per endpoint, status codes |
| `db_client_operations_duration` | MongoDB auto-instr | **Не поступает** — `suppressInternalInstrumentation: true` (см. §1.4) |

**Как читать:**
- `process_runtime_node_event_loop_lag_seconds` — загружен ли event loop
- `http_server_duration{http_target="/createCompany"}` — latency конкретного endpoint
- `db_client_operations_duration{db_mongodb_collection="Company"}` — **не работает** для company

### 3.3. Примеры PromQL

```promql
# Ошибки на любую операцию company за 5 минут
sum by(http_target) (
  rate(company_company_service_create_company_total{result="error"}[5m])
  or rate(company_company_service_update_company_total{result="error"}[5m])
  or rate(company_company_service_delete_company_total{result="error"}[5m])
  or rate(company_company_service_get_company_total{result="error"}[5m])
  or rate(company_company_service_add_member_total{result="error"}[5m])
  or rate(company_company_service_remove_member_total{result="error"}[5m])
  or rate(company_company_service_grant_permission_total{result="error"}[5m])
  or rate(company_company_service_revoke_permission_total{result="error"}[5m])
)

# P99 latency создания компании
histogram_quantile(0.99, rate(company_company_service_create_company_duration_bucket[5m]))

# Сколько компаний создано за сутки
increase(company_company_service_create_company_total{result="success"}[24h])

# P99 latency каскадного deleteCompany
histogram_quantile(0.99, rate(company_company_service_delete_company_duration_bucket[5m]))

# RPS по операциям
sum(rate(company_company_service_get_companies_total[1h]))
```

---

## 4. Health-check

### `GET /health`

Не трейсится (нет декораторов, нет авто-инструментации для health plugin —
быстрый ответ). Возвращает JSON со `status: ok`, `timestamp`, `uptime`,
`service: company` (см. `shared/monitoring/src/health.plugin.ts`).

**Как читать:** Если `/health` не отвечает — сервис не стартанул.
Используется в Docker Compose healthcheck и Uptime Kuma
(`infrastructure/docker/uptime-kuma/uptime-kuma-import.json:552`).

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует | docker logs — ошибка в init-фазе (MongoDB URI, COMPANY_SERVICE_NAME) |
| `getCompany` возвращает 404 | Span `company_repository.find_by_id` — ищи `NOT_FOUND_ERROR` в логах (WARN от `@LogDecorator` + ERROR от `ErrorHandlerPlugin`) |
| `updateCompany` падает | `company_company_service_update_company_total{result="error"}`. Лог `company_service.update_company — failed` (WARN) + `[NOT_FOUND_ERROR] ...` (ERROR) |
| `deleteCompany` долго работает | `company_company_service_delete_company_duration` histogram. Если >1s — много members/permissions. В Tempo видно 3 дочерних спана: `permission_repository.delete_many` + `member_repository.delete_many` + `company_repository.delete` |
| `getCompany` деградирует на больших компаниях | `company_company_service_get_company_duration`. В Tempo видно 3 дочерних: `find_by_id` + 2× `find_all` БЕЗ limit |
| `addMember` падает на дубликате | `MongoServerError: 11000` (duplicate key) на индексе `{companyId, userId}` (`src/models/entity/members.entity.ts:33`) |
| `grantPermission` падает на дубликате | Аналогично — уникальный индекс `{memberId, permission, entity}` (`src/models/entity/permissions.entity.ts:42`) |
| В Tempo отфильтровать операции по `companyId`/`ownerId`/`userId` | Атрибуты проставляются через `setSpanAttributes` в каждом методе `CompanyService` (см. §6 Fix #1) |
| `getCompanies` падает на большом filter | Индексы `{ownerId:1}` и `{name:1}` (`src/models/entity/company.entity.ts`). Других индексов нет |
| Метрик нет в Prometheus | Проверить `SERVICE_NAME=company`, target status, экспортёр Alloy |
| Логи не идут в Loki | Проверить `OTEL_EXPORTER_OTLP_ENDPOINT`, Alloy health |
| Дублирование 4xx в логах (WARN + ERROR) | Поведение shared-пакета: `@LogDecorator` пишет WARN, `ErrorHandlerPlugin` пишет ERROR |
| Найти все операции по конкретной компании в Tempo | Прямой фильтр: `{ companyId = "65f..." }` — работает благодаря Fix #1 |

---

## 6. История фиксов

### Fix #1 — `setSpanAttributes` добавлен в 9 методов сервиса

**Что было:** `setSpanAttributes` нигде не вызывался. Все 9 публичных
методов `CompanyService` создавали спаны без атрибутов → нельзя было
фильтровать операции в Tempo по `companyId` / `ownerId` / `userId`.

**Что сделано:** В `src/services/company.service.ts` добавлены вызовы
`setSpanAttributes` сразу после `@LogDecorator` (перед первым обращением
к репозиторию):

| Метод | Атрибуты |
|-------|----------|
| `createCompany` | `{ ownerId }` |
| `updateCompany` | `{ id }` |
| `deleteCompany` | `{ companyId }` |
| `getCompany` | `{ id }` |
| `getCompanies` | `{ filterKeys, limit, offset }` (`limit: -1` если не задан) |
| `addMember` | `{ companyId, userId }` |
| `removeMember` | `{ memberId }` |
| `grantPermission` | `{ companyId, memberId, userId, permission, entity }` |
| `revokePermission` | `{ permissionId }` |

**Примеры фильтров в Tempo (теперь работают):**
- Все операции конкретной компании: `{ companyId = "65f..." }`
- Все действия владельца: `{ ownerId = "0x..." }`
- Все выданные права конкретного юзера: `{ userId = "0x..." && name = "company_service.grant_permission" }`
- Популярные filter-комбинации для `getCompanies`: `{ filterKeys =~ "ownerId,name" }`

**Контроль:** `grep -rn "setSpanAttributes" services/company/src/` → 10
(1 импорт + 9 вызовов).

### Fix #2 — credentials убраны из init-логов

**Что было:** `src/plugins/repositories.plugin.ts` логировал полный
`mongoUri` (включая `user:password@host`) в `Connecting to MongoDB`.
В Loki утекал пароль БД.

**Что сделано:** Удалён второй аргумент `{ uri: mongoUri }` из
`logger.info("Connecting to MongoDB")`. Строка подключения больше не
логируется ни в каком виде.

---

## 7. Резюме состояния production-readiness

| Аспект | Статус | Комментарий |
|--------|--------|-------------|
| Init-спаны (`company.init.*`) | OK | 18+ спанов, корневой `company.init.main` |
| Shutdown-span | OK | `company.stop.repositories_plugin` |
| HTTP auto-instr | OK | `instrumentation-http` работает |
| `@TraceDecorator` на 9 методах сервиса | OK | Полное покрытие |
| `@TraceDecorator` на 17 методах репо | OK | Полное покрытие |
| `@MetricsDecorator` на 9 методах сервиса | OK | 18 метрик (counter+histogram × 9) |
| `@LogDecorator` на 9 методах сервиса | OK | Покрытие |
| `setSpanAttributes` для фильтрации в Tempo | OK | 9 вызовов — все методы `CompanyService` |
| Документация (этот файл) | OK | Создана |
| Health-check | OK | `GET /health` |
| Uptime Kuma integration | OK | `infrastructure/docker/uptime-kuma/uptime-kuma-import.json:552` |
| Graceful shutdown | OK | SIGTERM/SIGINT → `app.stop()` → `mongoose.disconnect()` |
| Credentials в логах | OK | `mongoUri` не логируется |
| `console.*` в коде | OK | Отсутствуют |
