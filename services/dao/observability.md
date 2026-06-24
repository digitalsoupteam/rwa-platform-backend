# DAO — Observability Reference

DAO (Decentralized Autonomous Organization) — микросервис, обслуживающий governance
DAO на блокчейне. Потребляет события governance/staking/timelock/treasury из
RabbitMQ exchange `blockchain.events.dao`, публикуемых `blockchain-scanner`-ом,
сохраняет их в MongoDB и предоставляет REST API (Elysia) для чтения
накопленного state: proposals, votes, staking, staking history, timelock tasks,
treasury withdrawals.

- **SERVICE_NAME:** `dao` (берётся из `process.env.SERVICE_NAME` → `DAO_SERVICE_NAME` в `docker-compose.yml`)
- **Порт:** `process.env.PORT` → `DAO_PORT`
- **БД:** MongoDB (БД `DAO_MONGODB_DBNAME`) — `Proposal`, `Vote`, `Staking`, `StakingHistory`, `TimelockTask`, `TreasuryWithdraw`
- **Клиенты:** `RabbitMQClient` (из `@shared/rabbitmq`) — потребление событий
- **Daemon-ы:** `BlockchainEventsDaemon` (наследник `BaseBlockchainDaemon` из `@shared/blockchain-daemon`)
- **Внешние интеграции:** нет (RPC выполняет `blockchain-scanner`)

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

Корневой span `dao.init.main` создаётся в `index.ts` через `tracer.startActiveSpan`,
и каждый слой в `app.ts` оборачивается в свой `withTraceAsync/Sync`.
Все спаны идут с префиксом `dao.init.*`.

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `dao.init.main` | `src/index.ts` | ~всё время старта | всё ниже | Корневой span сервиса (entry point) |
| `dao.init.repositories_plugin` | `src/app.ts` | ~MongoDB connect | `init.repositories.proposal`, `init.repositories.vote`, `init.repositories.staking`, `init.repositories.staking_history`, `init.repositories.timelock_task`, `init.repositories.treasury_withdraw`, `init.repositories_plugin.mongoose`, `init.repositories.plugin` | Подключение к MongoDB + создание 6 репозиториев |
| `dao.init.repositories.proposal` | `src/plugins/repositories.plugin.ts` | <5ms | — | `new ProposalRepository()` |
| `dao.init.repositories.vote` | `src/plugins/repositories.plugin.ts` | <5ms | — | `new VoteRepository()` |
| `dao.init.repositories.staking` | `src/plugins/repositories.plugin.ts` | <5ms | — | `new StakingRepository()` |
| `dao.init.repositories.staking_history` | `src/plugins/repositories.plugin.ts` | <5ms | — | `new StakingHistoryRepository()` |
| `dao.init.repositories.timelock_task` | `src/plugins/repositories.plugin.ts` | <5ms | — | `new TimelockTaskRepository()` |
| `dao.init.repositories.treasury_withdraw` | `src/plugins/repositories.plugin.ts` | <5ms | — | `new TreasuryWithdrawRepository()` |
| `dao.init.repositories_plugin.mongoose` | `src/plugins/repositories.plugin.ts` | ~connect | — | `mongoose.connect(mongoUri)` (закрывается на событии `connected`) |
| `dao.init.repositories.plugin` | `src/plugins/repositories.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Repositories` (с `.onStop` для `mongoose.disconnect()`) |
| `dao.init.clients_plugin` | `src/app.ts` | ~TCP connect | `init.clients.rabbitmq`, `init.clients.rabbitmq_connect`, `init.clients.plugin` | Создание RabbitMQ клиента и подключение к брокеру |
| `dao.init.clients.rabbitmq` | `src/plugins/clients.plugin.ts` | <5ms | — | `new RabbitMQClient(...)` |
| `dao.init.clients.rabbitmq_connect` | `src/plugins/clients.plugin.ts` | ~TCP connect | — | `rabbitMQClient.connect()` — handshake с broker |
| `dao.init.clients.plugin` | `src/plugins/clients.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Clients` (с `.onStop` для `rabbitMQClient.disconnect()`) |
| `dao.init.services_plugin` | `src/app.ts` | <5ms | `init.services.dao`, `init.services.plugin` | Создание бизнес-сервиса |
| `dao.init.services.dao` | `src/plugins/services.plugin.ts` | <5ms | — | `new DaoService(proposal, staking, stakingHistory, timelockTask, treasuryWithdraw, vote)` |
| `dao.init.services.plugin` | `src/plugins/services.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Services` |
| `dao.init.controllers_plugin` | `src/app.ts` | <10ms | `init.controllers.get_proposals`, `init.controllers.get_votes`, `init.controllers.get_staking`, `init.controllers.get_staking_history`, `init.controllers.get_timelock_tasks`, `init.controllers.get_treasury_withdrawals`, `init.controllers.plugin` | Регистрация 6 контроллеров |
| `dao.init.controllers.get_proposals` | `src/plugins/controllers.plugin.ts` | <5ms | — | Создание `GetProposalsController` (`POST /getProposals`) |
| `dao.init.controllers.get_votes` | `src/plugins/controllers.plugin.ts` | <5ms | — | Создание `GetVotesController` (`POST /getVotes`) |
| `dao.init.controllers.get_staking` | `src/plugins/controllers.plugin.ts` | <5ms | — | Создание `GetStakingController` (`POST /getStaking`) |
| `dao.init.controllers.get_staking_history` | `src/plugins/controllers.plugin.ts` | <5ms | — | Создание `GetStakingHistoryController` (`POST /getStakingHistory`) |
| `dao.init.controllers.get_timelock_tasks` | `src/plugins/controllers.plugin.ts` | <5ms | — | Создание `GetTimelockTasksController` (`POST /getTimelockTasks`) |
| `dao.init.controllers.get_treasury_withdrawals` | `src/plugins/controllers.plugin.ts` | <5ms | — | Создание `GetTreasuryWithdrawalsController` (`POST /getTreasuryWithdrawals`) |
| `dao.init.controllers.plugin` | `src/plugins/controllers.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Controllers` |
| `dao.init.daemons_plugin` | `src/app.ts` | зависит от брокера | `init.daemons.blockchain_events`, `init.daemons.initialize`, `init.daemons.plugin` | Создание и запуск daemon-а потребления событий |
| `dao.init.daemons.blockchain_events` | `src/plugins/daemons.plugin.ts` | <5ms | — | `new BlockchainEventsDaemon(rabbitClient, daoService)` |
| `dao.init.daemons.initialize` | `src/plugins/daemons.plugin.ts` | ~broker subscribe + handler binding | — | `daemon.initialize()` + `daemon.start()` — подписка на routing keys |
| `dao.init.daemons.plugin` | `src/plugins/daemons.plugin.ts` | <5ms | — | Регистрация Elysia-плагина `Daemons` (с `.onStop` для `daemon.stop()`) |
| `dao.init.elysia` | `src/app.ts` | ~`listen(port)` | — | Запуск Elysia `.listen(port)` |

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `dao.stop.repositories_plugin` | `src/plugins/repositories.plugin.ts` (`.onStop`) | graceful shutdown | `mongoose.disconnect()` |
| `dao.stop.clients` | `src/plugins/clients.plugin.ts` (`.onStop`) | graceful shutdown | `rabbitMQClient.disconnect()` |
| `dao.stop.daemons` | `src/plugins/daemons.plugin.ts` (`.onStop`) | graceful shutdown | `daemon.stop()` — закрытие RabbitMQ-подписки |

SIGTERM/SIGINT handlers в `src/index.ts` вызывают `app.stop()`, что последовательно
триггерит все три `.onStop` коллбэка.

### 1.3. Runtime — бизнес-методы

> Span name = camelToSnakeCase(ClassName) + '.' + camelToSnakeCase(methodName)
> — вычисляется автоматически в `traceDecorator.ts` для всех методов с
> `@TraceDecorator()`. `setSpanAttributes()` в коде сервиса **не вызывается**
> ни в одном методе — атрибуты в Tempo доступны только те, что проставляют
> `mongoose`/`amqplib` auto-instrumentations (см. §1.4).

#### DaoService (prefix: dao_service)

Все методы сервиса вызываются из `BlockchainEventsDaemon.getEventRouting()`
(для `process*`) или из контроллеров `POST /getXxx` (для `getXxx`).

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `dao_service.process_proposal_created` | — | `BlockchainEventsDaemon` (event `Governance_ProposalCreated`) | `proposal_repository.create` | `AppError` при constraint violation (`unique` index по `proposalId`) |
| `dao_service.process_proposal_executed` | — | `BlockchainEventsDaemon` (event `Governance_ProposalExecuted`) | `proposal_repository.update_state` | — |
| `dao_service.process_proposal_cancelled` | — | `BlockchainEventsDaemon` (event `Governance_ProposalCancelled`) | `proposal_repository.update_state` | — |
| `dao_service.process_vote_cast` | — | `BlockchainEventsDaemon` (event `Governance_VoteCast`) | `vote_repository.create` | `AppError` при constraint violation (`unique` index по `(proposalId, voterWallet)` и `(transactionHash, logIndex)`) |
| `dao_service.process_tokens_staked` | — | `BlockchainEventsDaemon` (event `DaoStaking_TokensStaked`) | `staking_repository.add_stake`, `staking_history_repository.create` | — |
| `dao_service.process_tokens_unstaked` | — | `BlockchainEventsDaemon` (event `DaoStaking_TokensUnstaked`) | `staking_repository.sub_stake`, `staking_history_repository.create` | — |
| `dao_service.process_transaction_queued` | — | `BlockchainEventsDaemon` (event `Timelock_TransactionQueued`) | `timelock_task_repository.create` | `AppError` при constraint violation (`unique` index по `txHash`) |
| `dao_service.process_transaction_executed` | — | `BlockchainEventsDaemon` (event `Timelock_TransactionExecuted`) | `timelock_task_repository.update_executed` | — |
| `dao_service.process_transaction_cancelled` | — | `BlockchainEventsDaemon` (event `Timelock_TransactionCancelled`) | — (no-op: задача остаётся как есть) | — |
| `dao_service.process_treasury_withdrawal` | — | `BlockchainEventsDaemon` (event `Treasury_Withdrawal`) | `treasury_withdraw_repository.create` | — |
| `dao_service.get_proposals` | — | `POST /getProposals` | `proposal_repository.find_all` | — |
| `dao_service.get_votes` | — | `POST /getVotes` | `vote_repository.find_all` | — |
| `dao_service.get_staking` | — | `POST /getStaking` | `staking_repository.find_all` | — |
| `dao_service.get_staking_history` | — | `POST /getStakingHistory` | `staking_history_repository.find_all` | — |
| `dao_service.get_timelock_tasks` | — | `POST /getTimelockTasks` | `timelock_task_repository.find_all` | — |
| `dao_service.get_treasury_withdrawals` | — | `POST /getTreasuryWithdrawals` | `treasury_withdraw_repository.find_all` | — |

#### ProposalRepository (префикс `proposal_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `proposal_repository.create` | `dao_service.process_proposal_created` | `ProposalEntity.create(data)` + `.toObject()` | `unique` index по `proposalId` → дубликаты событий будут падать |
| `proposal_repository.update_state` | `dao_service.process_proposal_executed`, `dao_service.process_proposal_cancelled` | `ProposalEntity.findOneAndUpdate({proposalId}, {state, updatedAt}, {new: true}).lean()` | state ∈ `pending`/`executed`/`canceled` |
| `proposal_repository.find_all` | `dao_service.get_proposals` | `ProposalEntity.find(filter).sort(sort).skip(offset).limit(limit).lean()` | `sort={createdAt:"desc"}` по умолчанию, `limit=100` по умолчанию |

#### VoteRepository (префикс `vote_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `vote_repository.create` | `dao_service.process_vote_cast` | `VoteEntity.create({...data, weight: Decimal128})` | `weight` конвертируется в `Decimal128`; `unique` index по `(proposalId, voterWallet)` и `(transactionHash, logIndex)` |
| `vote_repository.find_all` | `dao_service.get_votes` | `VoteEntity.find(filter).sort(sort).skip(offset).limit(limit).lean()` | `sort={createdAt:"desc"}`, `limit=100` по умолчанию |

#### StakingRepository (префикс `staking_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `staking_repository.add_stake` | `dao_service.process_tokens_staked` | `StakingEntity.findOneAndUpdate({staker, chainId}, {$inc:{amount:Decimal128(amount)}, $set:{lastStakeTimestamp, updatedAt}}, {new: true, upsert: true, setDefaultsOnInsert: true}).lean()` | Upsert с инкрементом `amount`; `amount` хранится как `Decimal128` |
| `staking_repository.sub_stake` | `dao_service.process_tokens_unstaked` | `StakingEntity.findOneAndUpdate({staker, chainId}, {$inc:{amount:Decimal128("-" + amount)}, $set:{updatedAt}}, {new: true, upsert: true, setDefaultsOnInsert: true}).lean()` | Upsert с декрементом `amount` (отрицательный Decimal128) |
| `staking_repository.find_all` | `dao_service.get_staking` | `StakingEntity.find(filter).sort(sort).skip(offset).limit(limit).lean()` | `sort={createdAt:"desc"}`, `limit=100` по умолчанию |

#### StakingHistoryRepository (префикс `staking_history_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `staking_history_repository.create` | `dao_service.process_tokens_staked`, `dao_service.process_tokens_unstaked` | `StakingHistoryEntity.create({...data, amount: Decimal128(amount)}).toObject()` | `operation` ∈ `"staked"`/`"unstaked"` |
| `staking_history_repository.find_all` | `dao_service.get_staking_history` | `StakingHistoryEntity.find(filter).sort(sort).skip(offset).limit(limit).lean()` | `sort={createdAt:"desc"}`, `limit=100` по умолчанию |

#### TimelockTaskRepository (префикс `timelock_task_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `timelock_task_repository.create` | `dao_service.process_transaction_queued` | `TimelockTaskEntity.create(data).toObject()` | `unique` index по `txHash` |
| `timelock_task_repository.update_executed` | `dao_service.process_transaction_executed` | `TimelockTaskEntity.findOneAndUpdate({txHash}, {executed, updatedAt}, {new: true}).lean()` | `executed=true` по умолчанию |
| `timelock_task_repository.find_all` | `dao_service.get_timelock_tasks` | `TimelockTaskEntity.find(filter).sort(sort).skip(offset).limit(limit).lean()` | `sort={createdAt:"desc"}`, `limit=100` по умолчанию |

#### TreasuryWithdrawRepository (префикс `treasury_withdraw_repository`)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `treasury_withdraw_repository.create` | `dao_service.process_treasury_withdrawal` | `TreasuryWithdrawEntity.create({...data, amount: Decimal128(amount)}).toObject()` | — |
| `treasury_withdraw_repository.find_all` | `dao_service.get_treasury_withdrawals` | `TreasuryWithdrawEntity.find(filter).sort(sort).skip(offset).limit(limit).lean()` | `sort={createdAt:"desc"}`, `limit=100` по умолчанию |

#### BlockchainEventsDaemon (префикс `blockchain_events_daemon`)

`BlockchainEventsDaemon` расширяет `BaseBlockchainDaemon` из `@shared/blockchain-daemon`.
Его публичный контракт — метод `getEventRouting()` (sync, обёрнут
`@TraceDecorator()` — span blockchain_events_daemon.get_event_routing создаётся
при init daemon-а, но это служебный init-вызов от базового класса, а не
runtime-бизнес-операция). Метод возвращает объект-роутер, который вызывается из
базового класса на каждое сообщение из RabbitMQ. Дочерние спаны per-event
(dao_service.process_*) появляются как реакция на consume-спан
`instrumentation-amqplib`. Успешные сообщения acкнутся, при exception в
`daoService.process*` они будут nack-нуты.

| Span name | Где создаётся | Длительность | Зачем |
|-----------|---------------|-------------|-------|
| blockchain_events_daemon.get_event_routing | `src/daemons/blockchainEvents.daemon.ts` (sync) | <5ms | `new EventRouting({...})` с 10 handlers на каждое blockchain-событие. Вызывается однократно при `daemon.initialize()` |

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP | `instrumentation-http` | `POST /getProposals`, `POST /getVotes`, `POST /getStaking`, `POST /getStakingHistory`, `POST /getTimelockTasks`, `POST /getTreasuryWithdrawals` | `http.method=POST`, `http.target`, `http.status_code`, `http.service=dao` (см. `applyCustomAttributesOnSpan` в `monitoring.plugin.ts`) |
| MongoDB | `instrumentation-mongoose` | `mongoose.Collection.operation` — но **внутренние** спаны подавлены (`suppressInternalInstrumentation: true`), `instrumentation-mongoose` создаёт только **client-level** спаны при `mongoose.connect/disconnect` | `db.name=dao`, `db.system=mongodb` |
| RabbitMQ | `instrumentation-amqplib` | producer-side спаны в `blockchain-scanner` (вне этого сервиса), consumer-side спаны здесь: `amqp consume <exchange>` для каждого routing key + per-message `amqp deliver` | `messaging.system=rabbitmq`, `messaging.rabbitmq.exchange=blockchain.events.dao`, `messaging.rabbitmq.routing_key=Governance_ProposalCreated` (или иное из 10 событий) |
| DNS | `instrumentation-dns` | `dns.lookup` (mongodb / rabbitmq hostnames) | — |
| FS | `instrumentation-fs` | `fs.readFileSync` / `fs.open` (bun runtime) | — |
| Net | `instrumentation-net` | `net.connect` (TCP handshake до MongoDB / RabbitMQ) | — |
| Runtime | `instrumentation-runtime-node` | — (метрики, не спаны) | — |

### 1.5. Дебаг: полная иерархия для ключевой операции

#### Обработка блокчейн-события `Governance_VoteCast`

```
amqp deliver {Governance_VoteCast, chainId=...}    ← amqplib auto-instr (consumer)
  └── blockchain_events_daemon.get_event_routing   ← @TraceDecorator (base class callback)
        └── dao_service.process_vote_cast          ← @TraceDecorator
              └── vote_repository.create           ← @TraceDecorator
                    └── mongoose.Collection.create ← mongoose auto-instr (suppressed: no internal span)
```

#### REST-запрос `POST /getProposals`

```
HTTP server POST /getProposals {http.service=dao}   ← http auto-instr
  └── dao_service.get_proposals                     ← @TraceDecorator
        └── proposal_repository.find_all            ← @TraceDecorator
              └── mongoose.Collection.find/sort/limit ← mongoose auto-instr (suppressed)
```

---

## 2. Логи

### 2.1. Business-логи

`DaoService` использует `@LogDecorator({ args: ['event'] })` для всех `process*`
методов и `@LogDecorator({ args: ['params'] })` для всех `get*` методов
(см. `@shared/monitoring/src/logDecorator.ts`).

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `processProposalCreated` | `processProposalCreated — called` с `{event}` | `processProposalCreated — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `processProposalExecuted` | `processProposalExecuted — called` с `{event}` | `processProposalExecuted — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `processProposalCancelled` | `processProposalCancelled — called` с `{event}` | `processProposalCancelled — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `processVoteCast` | `processVoteCast — called` с `{event}` | `processVoteCast — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `processTokensStaked` | `processTokensStaked — called` с `{event}` | `processTokensStaked — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `processTokensUnstaked` | `processTokensUnstaked — called` с `{event}` | `processTokensUnstaked — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `processTransactionQueued` | `processTransactionQueued — called` с `{event}` | `processTransactionQueued — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `processTransactionExecuted` | `processTransactionExecuted — called` с `{event}` | `processTransactionExecuted — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `processTransactionCancelled` | `processTransactionCancelled — called` с `{event}` | `processTransactionCancelled — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `processTreasuryWithdrawal` | `processTreasuryWithdrawal — called` с `{event}` | `processTreasuryWithdrawal — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getProposals` | `getProposals — called` с `{params}` | `getProposals — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getVotes` | `getVotes — called` с `{params}` | `getVotes — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getStaking` | `getStaking — called` с `{params}` | `getStaking — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getStakingHistory` | `getStakingHistory — called` с `{params}` | `getStakingHistory — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getTimelockTasks` | `getTimelockTasks — called` с `{params}` | `getTimelockTasks — ok` | `— failed` → WARN; `— system_error` → ERROR |
| `getTreasuryWithdrawals` | `getTreasuryWithdrawals — called` с `{params}` | `getTreasuryWithdrawals — ok` | `— failed` → WARN; `— system_error` → ERROR |

> `args: ['event']` / `args: ['params']` — `event` содержит `data` (hex-строка
> calldata, потенциально большая) и `reason` (vote reason, пользовательский
> ввод). Это нормально для этого сервиса (данные из on-chain событий, не секреты).

### 2.2. ErrorHandlerPlugin

`ErrorHandlerPlugin` подключён в `src/app.ts:50` через `.onError(ErrorHandlerPlugin)`.
Все необработанные ошибки REST-роутов идут через него. Согласно
`@shared/errors/error-handler.plugin.ts`, **все** ошибки логируются через
`logger.error` (и `AppError`, и любые другие) — уровень WARN для `AppError`
здесь **не применяется**. WARN для `AppError` создаёт только `@LogDecorator`
(см. таблицу выше).

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `AppError` | ERROR | `error.message` | `{error, errorName, errorStack, path}` |
| Любая другая | ERROR | `error.message` | `{error, errorName, errorStack, path}` |

### 2.3. Прямые logger-вызовы в плагинах

| Файл | Строка (приблизительно) | Уровень | Сообщение | Контекст |
|------|-------------------------|---------|-----------|----------|
| `src/plugins/repositories.plugin.ts` | init | `info` | `Connecting to MongoDB` | `{ uri: mongoUri }` |
| `src/plugins/repositories.plugin.ts` | init (on `connected`) | `info` | `MongoDB connected successfully` | — |
| `src/plugins/repositories.plugin.ts` | `.onStop` | `info` | `Disconnecting from MongoDB` | — |
| `src/plugins/repositories.plugin.ts` | `.onStop` | `info` | `MongoDB disconnected successfully` | — |
| `src/plugins/clients.plugin.ts` | init | `debug` | `Initializing clients` | — |
| `src/plugins/clients.plugin.ts` | init | `info` | `RabbitMQ client connected` | — |
| `src/plugins/clients.plugin.ts` | `.onStop` | `info` | `RabbitMQ client disconnected` | — |
| `src/plugins/daemons.plugin.ts` | init | `debug` | `Initializing daemons` | — |
| `src/plugins/daemons.plugin.ts` | init | `info` | `Blockchain events daemon started` | — |
| `src/plugins/daemons.plugin.ts` | `.onStop` | `info` | `Blockchain events daemon stopped` | — |

---

## 3. Метрики

### 3.1. Business метрики

Каждый метод `DaoService` помечен `@MetricsDecorator()`, что создаёт пару
`<service>_<class_snake>_<method_snake>_total` (counter, label `result=success|error`)
и `<service>_<class_snake>_<method_snake>_duration` (histogram).

> Согласно `rwa-observability` §1.5, `result` label создаётся автоматически
> декоратором. `userId`/`wallet` как label **не используются** (anti-pattern).

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `dao_dao_service_process_proposal_created_total` | Counter | `result=success\|error` | Каждый вызов `processProposalCreated` | Объём создаваемых proposals |
| `dao_dao_service_process_proposal_created_duration` | Histogram | — | Каждый вызов | Латентность обработки `Governance_ProposalCreated` |
| `dao_dao_service_process_proposal_executed_total` | Counter | `result=success\|error` | Каждый вызов `processProposalExecuted` | Объём executed-предложений |
| `dao_dao_service_process_proposal_executed_duration` | Histogram | — | Каждый вызов | Латентность обработки `Governance_ProposalExecuted` |
| `dao_dao_service_process_proposal_cancelled_total` | Counter | `result=success\|error` | Каждый вызов `processProposalCancelled` | Объём canceled-предложений |
| `dao_dao_service_process_proposal_cancelled_duration` | Histogram | — | Каждый вызов | Латентность обработки `Governance_ProposalCancelled` |
| `dao_dao_service_process_vote_cast_total` | Counter | `result=success\|error` | Каждый вызов `processVoteCast` | Объём голосов |
| `dao_dao_service_process_vote_cast_duration` | Histogram | — | Каждый вызов | Латентность обработки `Governance_VoteCast` |
| `dao_dao_service_process_tokens_staked_total` | Counter | `result=success\|error` | Каждый вызов `processTokensStaked` | Объём stake-операций |
| `dao_dao_service_process_tokens_staked_duration` | Histogram | — | Каждый вызов | Латентность обработки `DaoStaking_TokensStaked` |
| `dao_dao_service_process_tokens_unstaked_total` | Counter | `result=success\|error` | Каждый вызов `processTokensUnstaked` | Объём unstake-операций |
| `dao_dao_service_process_tokens_unstaked_duration` | Histogram | — | Каждый вызов | Латентность обработки `DaoStaking_TokensUnstaked` |
| `dao_dao_service_process_transaction_queued_total` | Counter | `result=success\|error` | Каждый вызов `processTransactionQueued` | Объём queued timelock-транзакций |
| `dao_dao_service_process_transaction_queued_duration` | Histogram | — | Каждый вызов | Латентность обработки `Timelock_TransactionQueued` |
| `dao_dao_service_process_transaction_executed_total` | Counter | `result=success\|error` | Каждый вызов `processTransactionExecuted` | Объём executed timelock-транзакций |
| `dao_dao_service_process_transaction_executed_duration` | Histogram | — | Каждый вызов | Латентность обработки `Timelock_TransactionExecuted` |
| `dao_dao_service_process_transaction_cancelled_total` | Counter | `result=success\|error` | Каждый вызов `processTransactionCancelled` | Объём cancelled timelock-транзакций |
| `dao_dao_service_process_transaction_cancelled_duration` | Histogram | — | Каждый вызов | Латентность обработки `Timelock_TransactionCancelled` |
| `dao_dao_service_process_treasury_withdrawal_total` | Counter | `result=success\|error` | Каждый вызов `processTreasuryWithdrawal` | Объём treasury withdrawals |
| `dao_dao_service_process_treasury_withdrawal_duration` | Histogram | — | Каждый вызов | Латентность обработки `Treasury_Withdrawal` |
| `dao_dao_service_get_proposals_total` | Counter | `result=success\|error` | Каждый вызов `getProposals` | Объём запросов к API |
| `dao_dao_service_get_proposals_duration` | Histogram | — | Каждый вызов | Латентность `POST /getProposals` |
| `dao_dao_service_get_votes_total` | Counter | `result=success\|error` | Каждый вызов `getVotes` | Объём запросов к API |
| `dao_dao_service_get_votes_duration` | Histogram | — | Каждый вызов | Латентность `POST /getVotes` |
| `dao_dao_service_get_staking_total` | Counter | `result=success\|error` | Каждый вызов `getStaking` | Объём запросов к API |
| `dao_dao_service_get_staking_duration` | Histogram | — | Каждый вызов | Латентность `POST /getStaking` |
| `dao_dao_service_get_staking_history_total` | Counter | `result=success\|error` | Каждый вызов `getStakingHistory` | Объём запросов к API |
| `dao_dao_service_get_staking_history_duration` | Histogram | — | Каждый вызов | Латентность `POST /getStakingHistory` |
| `dao_dao_service_get_timelock_tasks_total` | Counter | `result=success\|error` | Каждый вызов `getTimelockTasks` | Объём запросов к API |
| `dao_dao_service_get_timelock_tasks_duration` | Histogram | — | Каждый вызов | Латентность `POST /getTimelockTasks` |
| `dao_dao_service_get_treasury_withdrawals_total` | Counter | `result=success\|error` | Каждый вызов `getTreasuryWithdrawals` | Объём запросов к API |
| `dao_dao_service_get_treasury_withdrawals_duration` | Histogram | — | Каждый вызов | Латентность `POST /getTreasuryWithdrawals` |

> `dao_dao_service_*` (двойное `dao_`) — потому что SERVICE_NAME = `dao` и
> имя класса после `to_snake` = *dao_service* → даёт `dao_dao_service_<method>`.
> Это валидное Prometheus имя (snake_case-only requirement соблюдён).

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | `instrumentation-runtime-node` | CPU, memory, event loop lag, GC |
| `http.server.*` | `instrumentation-http` | RPS, latency, status codes для всех POST-эндпоинтов |
| `db.client.*` | `instrumentation-mongoose` | Количество запросов, latency (suppressed internal — только client-level) |
| `messaging.*` / `amqp.*` | `instrumentation-amqplib` | Publish/consume counters, consumer latency |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов по имени |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов по имени |

### 3.3. Примеры PromQL

```promql
# Ошибки обработки голосов за 5 минут
rate(dao_dao_service_process_vote_cast_total{result="error"}[5m])

# P99 латентность обработки голосов
histogram_quantile(0.99, rate(dao_dao_service_process_vote_cast_duration_bucket[5m]))

# Количество обработанных stake-операций за сутки
increase(dao_dao_service_process_tokens_staked_total[24h])

# Соотношение executed vs canceled proposals
sum(rate(dao_dao_service_process_proposal_executed_total[1h]))
  /
sum(rate(dao_dao_service_process_proposal_cancelled_total[1h]))

# Дропы сообщений в consumer (высокий error rate — broker проблемы)
rate(dao_dao_service_process_vote_cast_total{result="error"}[5m])
  /
rate(dao_dao_service_process_vote_cast_total[5m])
```

---

## 4. Health-check

### `GET /health`

Подключён через `monitoringPlugin` + `healthPlugin` из `@shared/monitoring`
(см. `src/app.ts:48-49`). Возвращает `200 OK` с информацией о сервисе
(подробный контракт — в `shared/monitoring/src/health.plugin.ts`, который
используется всеми сервисами одинаково).

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Service не стартует, долго висит | `dao.init.repositories_plugin` (Mongoose connect) / `dao.init.clients.rabbitmq_connect` (broker handshake) — смотреть в Tempo, затем проверить env `MONGODB_URI` / `RABBITMQ_URL` |
| Proposals не появляются в БД | Spans chain: `amqp deliver` → blockchain_events_daemon.get_event_routing → dao_service.process_proposal_created → `proposal_repository.create`; если есть error на `process_proposal_created` — смотреть `reason` в логе (скорее всего duplicate `proposalId`) |
| Vote дубликаты (одна `(proposalId, voterWallet)` пара дважды) | `vote_repository.create` вернёт error → метрика `dao_dao_service_process_vote_cast_total{result="error"}` растёт → смотреть `mongo` логи на `E11000 duplicate key error` (unique index `(proposalId, voterWallet)` и `(transactionHash, logIndex)`) |
| Timelock `processTransactionCancelled` «исчезает» | В коде метод **no-op** (см. dao.service.ts:255-256, TODO). Задача остаётся со старым `executed` статусом, ничего не пишется в БД. Если нужен cancelled-флаг — это разрыв с дизайном `TimelockTaskEntity` (нет поля `cancelled`) |
| Staking amount «отрицательный» после unstake | `staking_repository.sub_stake` инкрементирует отрицательным Decimal128 — это ожидаемо; проверить `$inc` в MongoDB-логе, искать ошибки Mongoose cast |
| RabbitMQ отключается | `dao.stop.clients` в Tempo + `RabbitMQ client disconnected` в логах. Проверить `RABBITMQ_URL` и доступность брокера |
| Daemon не обрабатывает события | `dao.init.daemons.initialize` в Tempo — должен завершиться без ошибок. Если зависает — проблема с подпиской на routing keys. Проверить `RABBITMQ_EXCHANGE` env (должен совпадать с publisher exchange в `blockchain-scanner`) |
| Высокий error rate на `getXxx` | Смотреть `http.server.duration{status_code=500}` + логи `ErrorHandlerPlugin` (ERROR с stack) |
| `messaging.rabbitmq.exchange` пустой | Producer или broker не передаёт exchange. Проверить конфиг `blockchain-scanner` (publisher) и `blockchain-scanner → RABBITMQ_BLOCKCHAIN_EVENTS_EXCHANGE` env |
| service health-check возвращает `503` | `healthPlugin` пингует зависимости — скорее всего упал MongoDB или RabbitMQ. Смотреть `health.plugin.ts` и env-переменные |