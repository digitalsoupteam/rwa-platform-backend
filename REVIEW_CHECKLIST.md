# Review Checklist

**Инструкция:** скопируй этот файл в описание PR или в локальный файл, пройдись по пунктам, отметь выполненные галочкой. Для каждого нарушения — заполни комментарий с ссылкой на нарушенный паттерн и конкретным предложением по исправлению.

---

## 1. Архитектура

- [ ] **DI-слои соблюдены** — цепочка `repositories.plugin → services.plugin → controllers.plugin` не разорвана и не перепутана.
  *См.: [services-code-analysis.md §1.1](docs/services-code-analysis.md#11-plugin-based-di-architecture) | [examples.service.ts.md §7a–7c](services/example/examples.service.ts.md#7-плагины--сборка-слоёв)*
- [ ] **Контроллер — pass-through** — нет бизнес-логики, `return await service.method(body)`.
  *См.: [examples.service.ts.md §5 п.6](services/example/examples.service.ts.md#5-контроллер--controllersentitycreateentitycontroller)*
- [ ] **process.env — только в index.ts** — ни один другой файл не читает переменные окружения.
  *См.: [services-code-analysis.md §8](docs/services-code-analysis.md#8-processenv-usage)*
- [ ] **Плагин соединён через .use()** — зависимости передаются через `.decorate().use(nextPlugin)`, а не импортом классов напрямую.
  *См.: [services-code-analysis.md §1.1](docs/services-code-analysis.md#11-plugin-based-di-architecture)*
- [ ] **SIGTERM/SIGINT shutdown** — `app.stop()` → `process.exit(0|1)`.
  *См.: [services-code-analysis.md §1.2](docs/services-code-analysis.md#12-bootstrap-pattern)*

> **Комментарий по архитектуре:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> (нарушенный паттерн, что не так, как исправить)

---

## 2. Сущность / Модель

- [ ] **`as const` на схеме** — без него `InferRawDocType` даёт неверные типы.
  *См.: [examples.service.ts.md §2 п.1](services/example/examples.service.ts.md#2-сущность--modelsentitynameentity)*
- [ ] **Таймстемпы — Unix seconds (Number)** — не `Date`, не ISO-строка.
  *См.: [examples.service.ts.md §2 п.2](services/example/examples.service.ts.md#2-сущность--modelsentitynameentity)*
- [ ] **Поля владения присутствуют** — `ownerId`, `ownerType`, `creator`, `parentId`, `grandParentId`.
  *См.: [examples.service.ts.md §2 п.3](services/example/examples.service.ts.md#2-сущность--modelsentitynameentity)*
- [ ] **Тип экспортирован как `I<Name>Entity`** — не `any`.
  *См.: [examples.service.ts.md §2 п.4](services/example/examples.service.ts.md#2-сущность--modelsentitynameentity)*
- [ ] **Название модели — единственное число** (`BlogEntity`, `BusinessEntity`).
  *См.: [examples.service.ts.md §2 п.5](services/example/examples.service.ts.md#2-сущность--modelsentitynameentity)*
- [ ] **Индексы только под запросы сервиса** — без лишних композитных индексов.
  *См.: [examples.service.ts.md §2](services/example/examples.service.ts.md#2-сущность--modelsentitynameentity)*

> **Комментарий по модели:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> (нарушенный паттерн, что не так, как исправить)

---

## 3. Репозиторий

- [ ] **`@TracingDecorator()` на классе** (class-level), не на методах.
  *См.: [examples.service.ts.md §3 п.1](services/example/examples.service.ts.md#3-репозиторий--repositoriesnamerepository)*
- [ ] **`findAll` — `.lean()`** — не возвращает Mongoose-документы с отслеживанием.
  *См.: [examples.service.ts.md §3 п.2](services/example/examples.service.ts.md#3-репозиторий--repositoriesnamerepository)*
- [ ] **`create` — `.toObject()`** — не возвращает документ с методами.
  *См.: [examples.service.ts.md §3 п.3](services/example/examples.service.ts.md#3-репозиторий--repositoriesnamerepository)*
- [ ] **`update`/`delete`/`findById` бросают `AppError` на missing** — не возвращают `null`.
  *См.: [examples.service.ts.md §3 п.4](services/example/examples.service.ts.md#3-репозиторий--repositoriesnamerepository)*
- [ ] **Нет `: Promise<...>`** — TypeScript выводит сам.
  *См.: [examples.service.ts.md §3 п.5](services/example/examples.service.ts.md#3-репозиторий--repositoriesnamerepository)*
- [ ] **Дефолтная пагинация:** `limit=100`, `offset=0`, `sort={createdAt: 'asc'}`.
  *См.: [examples.service.ts.md §3 п.6](services/example/examples.service.ts.md#3-репозиторий--repositoriesnamerepository)*

> **Комментарий по репозиторию:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> (нарушенный паттерн, что не так, как исправить)

---

## 4. Сервис (бизнес-логика)

- [ ] **`@TracingDecorator()` на классе** — а не на методах.
  *См.: [examples.service.ts.md §4.1 п.1](services/example/examples.service.ts.md#41-приватный-mapper-паттерн-для-всех-новых-сервисов)*
- [ ] **Логгер из `@shared/monitoring/src/logger`** — не из `monitoring.plugin`.
  *См.: [examples.service.ts.md §4.1 п.2](services/example/examples.service.ts.md#41-приватный-mapper-паттерн-для-всех-новых-сервисов)*
- [ ] **`logger.debug()` внутри каждого метода** — логгируем входные данные.
  *См.: [examples.service.ts.md §4.1 п.3](services/example/examples.service.ts.md#41-приватный-mapper-паттерн-для-всех-новых-сервисов)*
- [ ] **Приватный mapper используется** — не inline-маппинг в каждом методе.
  *См.: [examples.service.ts.md §4.1 п.4](services/example/examples.service.ts.md#41-приватный-mapper-паттерн-для-всех-новых-сервисов) + [§4.2 Антипаттерн](services/example/examples.service.ts.md#42-антипаттерн--inline-маппинг-так-не-делаем)*
- [ ] **Нет explicit `: Promise<...>`** — TS выводит сам.
  *См.: [examples.service.ts.md §4.1 п.5](services/example/examples.service.ts.md#41-приватный-mapper-паттерн-для-всех-новых-сервисов)*
- [ ] **Нет лишних декораторов** — `@LogDecorator`, `@MetricsDecorator` не нужны (19/20 сервисов без них).
  *См.: [examples.service.ts.md §4.1 п.7](services/example/examples.service.ts.md#41-приватный-mapper-паттерн-для-всех-новых-сервисов)*

> **Комментарий по сервису:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> (нарушенный паттерн, что не так, как исправить)

---

## 5. Контроллер / Роуты

- [ ] **Все роуты POST** — никаких GET/PUT/DELETE/PATCH.
  *См.: [services-code-analysis.md §1.3](docs/services-code-analysis.md#13-all-endpoints-are-post) | [examples.service.ts.md §5 п.4](services/example/examples.service.ts.md#5-контроллер--controllersentitycreateentitycontroller)*
- [ ] **`logger.info("POST /path - ...")` ДО вызова сервиса**.
  *См.: [examples.service.ts.md §5 п.3](services/example/examples.service.ts.md#5-контроллер--controllersentitycreateentitycontroller) | [services-code-analysis.md §6](docs/services-code-analysis.md#6-controller-logging-consistency)*
- [ ] **Elysia instance именован** — `{ name: 'CreateBlogController' }` (нужно для OTel span).
  *См.: [examples.service.ts.md §5 п.2](services/example/examples.service.ts.md#5-контроллер--controllersentitycreateentitycontroller)*
- [ ] **`body` и `response` указаны** — валидация на каждый роут.
  *См.: [examples.service.ts.md §5 п.5](services/example/examples.service.ts.md#5-контроллер--controllersentitycreateentitycontroller)*
- [ ] **Factory-функция принимает `servicesPlugin`** — один аргумент (исключения документированы).
  *См.: [examples.service.ts.md §5 п.1](services/example/examples.service.ts.md#5-контроллер--controllersentitycreateentitycontroller)*

> **Комментарий по контроллеру:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> (нарушенный паттерн, что не так, как исправить)

---

## 6. Валидация (Elysia `t.*`)

- [ ] **Базовая схема — единственный источник правды** — переиспользуется через `t.Pick()`, `t.Partial()`, `t.Composite()`.
  *См.: [examples.service.ts.md §6 п.1–2](services/example/examples.service.ts.md#6-валидация--modelsvalidationnamevalidation)*
- [ ] **Списочный запрос — всегда `{ filter, sort?, limit?, offset? }`** — единая сигнатура.
  *См.: [examples.service.ts.md §6 п.3](services/example/examples.service.ts.md#6-валидация--modelsvalidationnamevalidation)*
- [ ] **Enum через `as const` + `t.Union([t.Literal(...)])`** — не TS `enum`.
  *См.: [examples.service.ts.md §6 п.4](services/example/examples.service.ts.md#6-валидация--modelsvalidationnamevalidation)*

> **Комментарий по валидации:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> (нарушенный паттерн, что не так, как исправить)

---

## 7. Observability

- [ ] **`withTraceSync/withTraceAsync` в init** — каждый плагин обёрнут в трейсинг при сборке.
  *См.: [services-code-analysis.md §1.2](docs/services-code-analysis.md#12-bootstrap-pattern)*
- [ ] **AppError для доменных ошибок** — `NotFoundError`, `NotAllowedError`, `ValidationError`, `InvalidTokenError` из `@shared/errors/app-errors`.
  *См.: [services-code-analysis.md §1.10](docs/services-code-analysis.md#110-error-handling)*
- [ ] **Global `.onError(ErrorHandlerPlugin)`** — из `@shared/errors/error-handler.plugin`.
  *См.: [services-code-analysis.md §1.10](docs/services-code-analysis.md#110-error-handling)*

> **Комментарий по observability:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> (нарушенный паттерн, что не так, как исправить)

---

## 8. Daemon (если применимо)

- [ ] **Daemon extends `BaseBlockchainDaemon`** (кроме blockchain-scanner — документированное исключение).
  *См.: [services-code-analysis.md §2.3](docs/services-code-analysis.md#23-blockchain-aware-services-with-daemons) | [§10](docs/services-code-analysis.md#10-shared-blockchains-daemon-architecture)*
- [ ] **`getEventRouting()` возвращает `Record<string, (event) => Promise<void>>`**.
  *См.: [services-code-analysis.md §10](docs/services-code-analysis.md#10-shared-blockchains-daemon-architecture)*
- [ ] **`super(rabbitClient, "blockchain.events.<routingKey>")`** — правильный routing key.
  *См.: [services-code-analysis.md §2.3](docs/services-code-analysis.md#23-blockchain-aware-services-with-daemons)*

> **Комментарий по daemon:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> (нарушенный паттерн, что не так, как исправить)

---

## Общий вывод

```
Что проверено:     _________________________________________________________________
Нарушений найдено: ___
Критических:       ___
Комментарии:       ___
Статус:            [ ] Принято  [ ] На доработку  [ ] Отклонено

Общее впечатление: _______________________________________________________________
__________________________________________________________________________________
__________________________________________________________________________________
```
