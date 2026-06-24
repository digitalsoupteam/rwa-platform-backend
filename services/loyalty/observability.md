# Loyalty — Observability Reference

Сервис программы лояльности: реферальная система, начисление комиссий (buy/sell/token-creation/pool-creation) и
rewards для рефереров. Обрабатывает блокчейн-события из RabbitMQ, считает начисления в MongoDB, при запросе
на вывод — создаёт задачу подписания через `signers-manager` (Eden Treaty).

**Технологии:** Bun + Elysia.js, Mongoose (MongoDB), amqplib (RabbitMQ), OpenTelemetry (OTLP), Eden Treaty client.

**SERVICE_NAME:** `loyalty` (env `SERVICE_NAME`)
**SERVICE_VERSION:** `1.0.0` (из `services/loyalty/package.json`)

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `loyalty.init.main` | `src/index.ts` | ~всё время старта | всё ниже | Корневой span процесса (`tracer.startActiveSpan`) |
| `loyalty.init.repositories_plugin` | `src/app.ts` | ~init репозиториев + MongoDB connect | `.repositories.fees`, `.referral`, `.referrer_claim_history`, `.commission_history`, `.referrer_withdraw`, `.repositories_plugin.mongoose`, `.repositories.plugin` | Сборка репозиториев и подключение к MongoDB |
| `loyalty.init.repositories.fees` | `src/plugins/repositories.plugin.ts` | < 5 ms | — | Инстанцирование `FeesRepository` |
| `loyalty.init.repositories.referral` | `src/plugins/repositories.plugin.ts` | < 5 ms | — | Инстанцирование `ReferralRepository` |
| `loyalty.init.repositories.referrer_claim_history` | `src/plugins/repositories.plugin.ts` | < 5 ms | — | Инстанцирование `ReferrerClaimHistoryRepository` |
| `loyalty.init.repositories.commission_history` | `src/plugins/repositories.plugin.ts` | < 5 ms | — | Инстанцирование `CommissionHistoryRepository` |
| `loyalty.init.repositories.referrer_withdraw` | `src/plugins/repositories.plugin.ts` | < 5 ms | — | Инстанцирование `ReferrerWithdrawRepository` |
| `loyalty.init.repositories_plugin.mongoose` | `src/plugins/repositories.plugin.ts` | ~MongoDB TCP+handshake | — | `mongoose.connect(mongoUri)`. Завершается по событию `'connected'` |
| `loyalty.init.repositories.plugin` | `src/plugins/repositories.plugin.ts` | < 5 ms | — | Elysia-плагин `Repositories` |
| `loyalty.init.clients_plugin` | `src/app.ts` | ~init всех клиентов | спаны `clients.*` | Обёртка сборки clients-слоя |
| `loyalty.init.clients.signers_manager` | `src/plugins/clients.plugin.ts` | < 5 ms | — | `createSignersManagerClient(signersManagerUrl)` (Eden Treaty) |
| `loyalty.init.clients.rabbitmq` | `src/plugins/clients.plugin.ts` | < 5 ms | — | `new RabbitMQClient({...})` |
| `loyalty.init.clients.rabbitmq_connect` | `src/plugins/clients.plugin.ts` | ~AMQP handshake | — | `rabbitMQClient.connect()` |
| `loyalty.init.clients.plugin` | `src/plugins/clients.plugin.ts` | < 5 ms | — | Elysia-плагин `Clients` |
| `loyalty.init.services_plugin` | `src/app.ts` | ~init сервиса | `.services.loyalty`, `.services.plugin` | Сборка services-слоя |
| `loyalty.init.services.loyalty` | `src/plugins/services.plugin.ts` | < 5 ms | — | `new LoyaltyService(5 repos, signersManagerClient, supportedNetworks)` |
| `loyalty.init.services.plugin` | `src/plugins/services.plugin.ts` | < 5 ms | — | Elysia-плагин `Services` |
| `loyalty.init.controllers_plugin` | `src/app.ts` | ~init контроллеров | спаны `controllers.*` | Сборка controllers-слоя |
| `loyalty.init.controllers.get_fees` | `src/plugins/controllers.plugin.ts` | < 5 ms | — | `getFeesController(servicesPlugin)` |
| `loyalty.init.controllers.get_referrals` | `src/plugins/controllers.plugin.ts` | < 5 ms | — | `getReferralsController(servicesPlugin)` |
| `loyalty.init.controllers.register_referral` | `src/plugins/controllers.plugin.ts` | < 5 ms | — | `registerReferralController(servicesPlugin)` |
| `loyalty.init.controllers.get_referrer_withdraws` | `src/plugins/controllers.plugin.ts` | < 5 ms | — | `getReferrerWithdrawsController(servicesPlugin)` |
| `loyalty.init.controllers.get_referrer_claim_history` | `src/plugins/controllers.plugin.ts` | < 5 ms | — | `getReferrerClaimHistoryController(servicesPlugin)` |
| `loyalty.init.controllers.get_commission_history` | `src/plugins/controllers.plugin.ts` | < 5 ms | — | `getCommissionHistoryController(servicesPlugin)` |
| `loyalty.init.controllers.create_referrer_withdraw_task` | `src/plugins/controllers.plugin.ts` | < 5 ms | — | `createReferrerWithdrawTaskController(servicesPlugin)` |
| `loyalty.init.controllers.plugin` | `src/plugins/controllers.plugin.ts` | < 5 ms | — | Elysia-плагин `Controllers` |
| `loyalty.init.daemons_plugin` | `src/app.ts` | ~init daemon (consume start) | спаны `daemons.*` | Сборка daemons-слоя |
| `loyalty.init.daemons.blockchain_events` | `src/plugins/daemons.plugin.ts` | < 5 ms | — | `new BlockchainEventsDaemon(rabbitMQClient, loyaltyService)` |
| `loyalty.init.daemons.initialize` | `src/plugins/daemons.plugin.ts` | ~consume start | дочерние спаны от `BaseBlockchainDaemon.initialize()` (rabbitmq-бизнес-логика в shared) | `daemon.initialize()` + `daemon.start()`; лог `logger.info("Blockchain events daemon started")` |
| `loyalty.init.daemons.plugin` | `src/plugins/daemons.plugin.ts` | < 5 ms | — | Elysia-плагин `Daemons` |
| `loyalty.init.elysia` | `src/app.ts` | ~listen | — | Финальный `new Elysia().use(...).listen(port)` |

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `loyalty.stop.repositories_plugin` | `src/plugins/repositories.plugin.ts` (`.onStop()`) | `app.stop()` → SIGTERM/SIGINT | `mongoose.disconnect()` + логи подключения/отключения |
| `loyalty.stop.clients` | `src/plugins/clients.plugin.ts` (`.onStop()`) | `app.stop()` | `rabbitMQClient.disconnect()` |
| `loyalty.stop.daemons` | `src/plugins/daemons.plugin.ts` (`.onStop()`) | `app.stop()` | `blockchainEventsDaemon.stop()` (unbind consumer) |

### 1.3. Runtime — бизнес-методы

#### LoyaltyService (span prefix: loyalty_service)

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `loyalty_service.process_create_r_w_a_fee_collected` | нет (setSpanAttributes не вызывается) | `BlockchainEventsDaemon.getEventRouting` — routing-key `Factory_CreateRWAFeeCollected` (RabbitMQ consumer) | `referralRepository.findByUserWallet` → ранний `return` если нет referral; `feesRepository.addTokenCreationCommission`; `commissionHistoryRepository.create`; `processReferralReward` → `feesRepository.addReferralReward` + `commissionHistoryRepository.create` | — (все ошибки пробрасываются; AppError → WARN, plain Error → ERROR через `@LogDecorator`) |

> **Замечание про имя span:** camelToSnakeCase в `@shared/monitoring/src/decorator-utils.ts` вставляет
> `_` перед **каждой** заглавной буквой, поэтому `processCreateRWAFeeCollected` →
> `process_create_r_w_a_fee_collected` (каждая буква RWA получает свой `_`). Это валидное имя
> span в Tempo, но визуально неуклюже — при будущем рефакторинге можно переименовать метод в
> `processCreateRwaFeeCollected`, чтобы получить `process_create_rwa_fee_collected`.
| `loyalty_service.process_create_pool_fee_collected` | нет | `BlockchainEventsDaemon.getEventRouting` — routing-key `Factory_CreatePoolFeeCollected` | `referralRepository.findByUserWallet`; `feesRepository.addPoolCreationCommission`; `commissionHistoryRepository.create`; `processReferralReward` | — |
| `loyalty_service.process_rwa_minted` | нет | `BlockchainEventsDaemon.getEventRouting` — routing-key `Pool_RwaMinted` | `referralRepository.findByUserWallet`; `feesRepository.addBuyCommission`; `commissionHistoryRepository.create`; `processReferralReward` | — |
| `loyalty_service.process_rwa_burned` | нет | `BlockchainEventsDaemon.getEventRouting` — routing-key `Pool_RwaBurned` (BigInt-арифметика `holdFee + bonusFee`) | `referralRepository.findByUserWallet`; `feesRepository.addSellCommission`; `commissionHistoryRepository.create`; `processReferralReward` | — |
| `loyalty_service.process_referral_treasury_withdrawn` | нет | `BlockchainEventsDaemon.getEventRouting` — routing-key `ReferralTreasury_Withdrawn` | `referralRepository.findByReferrerWallet` → ранний `return` если нет; `referrerWithdrawRepository.addWithdrawnAmount` | — |
| `loyalty_service.register_referral` | нет | `POST /registerReferral` (controller `registerReferral`) | `referralRepository.findByUserId`; `referralRepository.create` | `NotAllowedError` (отсутствует в коде — три `throw new Error(...)` для бизнес-валидации «уже есть referrer» / «сам себя»); см. секцию «Критические gap'ы» в финальном ответе |
| `loyalty_service.create_referrer_withdraw_task` | нет | `POST /createReferrerWithdrawTask` (controller `createReferrerWithdrawTask`) | `feesRepository.findAll`; `referrerWithdrawRepository.findByReferrerAndToken`; `referrerWithdrawRepository.createOrUpdate`; **`signersManagerClient.createSignatureTask.post(...)`** (Eden Treaty HTTP к `signers-manager`); `generateWithdrawMessageHash` через `ethers.solidityPackedKeccak256` | `NotAllowedError` (unsupported chainId / нет rewards / превышен amount / активен cooldown) |
| `loyalty_service.get_fees` | нет | `POST /getFees` (controller `getFees`) | `feesRepository.findAll(filter, sort, limit, offset)` | — |
| `loyalty_service.get_referrals` | нет | `POST /getReferrals` (controller `getReferrals`) | `referralRepository.findAll(...)` | — |
| `loyalty_service.get_referrer_withdraws` | нет | `POST /getReferrerWithdraws` (controller `getReferrerWithdraws`) | `referrerWithdrawRepository.findAll(...)` | — |
| `loyalty_service.get_referrer_claim_history` | нет | `POST /getReferrerClaimHistory` (controller `getReferrerClaimHistory`) | `referrerClaimHistoryRepository.findAll(...)` | — |
| `loyalty_service.get_commission_history` | нет | `POST /getCommissionHistory` (controller `getCommissionHistory`) | `commissionHistoryRepository.findAll(...)` | — |

_Примечание: span name = camelToSnakeCase(ClassName) + '.' + camelToSnakeCase(method)._
_`setSpanAttributes()` НЕ вызывается в этом классе — для дебага по конкретному
wallet/transactionHash придётся искать через `event.transactionHash` / `event.data.sender`,
проброшенные в лог через `@LogDecorator({ args: ['event'] })`, или по `userWallet` из
`@LogDecorator({ args: ['params'] })`._

_Приватные методы `LoyaltyService` (не трейсятся):_
- `processReferralReward` — вызывается из всех 5 `process*` методов, делает
  `referralRepository.findByUserId` + `feesRepository.addReferralReward` +
  `commissionHistoryRepository.create`. Не обёрнут в `@TraceDecorator` (private, нет декоратора).
- `mapFees`, `mapReferral`, `mapReferrerWithdraw`, `mapReferrerClaimHistory`, `mapCommissionHistory` —
  pure mapping, < 1 ms.
- `isChainIdSupported`, `getNetworkConfig` — валидация chainId.
- `generateWithdrawMessageHash` — ethers hash.

#### `FeesRepository` (префикс fees_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `fees_repository.add_buy_commission` | `loyaltyService.processRwaMinted` | `FeesEntity.findOneAndUpdate({userWallet, userId, chainId, tokenAddress}, {$inc: {buyCommissionCount, buyCommissionAmount}}, {upsert: true, new: true, setDefaultsOnInsert: true})` | upsert |
| `fees_repository.add_sell_commission` | `loyaltyService.processRwaBurned` | аналогично, `$inc: {sellCommissionCount, sellCommissionAmount}` | upsert |
| `fees_repository.add_token_creation_commission` | `loyaltyService.processCreateRWAFeeCollected` | `$inc: {tokenCreationCommissionCount, tokenCreationCommissionAmount}` | upsert |
| `fees_repository.add_pool_creation_commission` | `loyaltyService.processCreatePoolFeeCollected` | `$inc: {poolCreationCommissionCount, poolCreationCommissionAmount}` | upsert |
| `fees_repository.add_referral_reward` | `processReferralReward` (из всех process* методов) | `$inc: {referralRewardCount, referralRewardAmount}` | upsert |
| `fees_repository.find_all` | `loyaltyService.getFees`, `loyaltyService.createReferrerWithdrawTask` | `FeesEntity.find(filter).sort().skip().limit().lean()` | — |

#### `ReferralRepository` (префикс referral_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `referral_repository.create` | `loyaltyService.registerReferral` | `ReferralEntity.create(data)` | unique-index по `userWallet` и `userId` → дубликат бросает Mongoose `MongoServerError` (E11000) |
| `referral_repository.find_by_user_wallet` | `processCreateRWAFeeCollected`, `processCreatePoolFeeCollected`, `processRwaMinted`, `processRwaBurned` | `ReferralEntity.findOne({userWallet}).lean()` | — |
| `referral_repository.find_by_referrer_wallet` | `processReferralTreasuryWithdrawn` | `ReferralEntity.findOne({referrerWallet}).lean()` | — |
| `referral_repository.find_by_user_id` | `loyaltyService.registerReferral`, `processReferralReward` | `ReferralEntity.findOne({userId}).lean()` | — |
| `referral_repository.find_all` | `loyaltyService.getReferrals` | `ReferralEntity.find(filter).sort().skip().limit().lean()` | — |

#### `CommissionHistoryRepository` (префикс commission_history_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `commission_history_repository.create` | `processCreateRWAFeeCollected`, `processCreatePoolFeeCollected`, `processRwaMinted`, `processRwaBurned`, `processReferralReward` | `CommissionHistoryEntity.create({...data, amount: Decimal128.fromString(amount)})` | actionType ∈ {token_creation_commission, pool_creation_commission, buy_commission, sell_commission, referral_reward} |
| `commission_history_repository.find_all` | `loyaltyService.getCommissionHistory` | `CommissionHistoryEntity.find(filter).sort().skip().limit().lean()` | — |

#### `ReferrerClaimHistoryRepository` (префикс referrer_claim_history_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `referrer_claim_history_repository.create` | (в текущем коде не вызывается — метод определён, но ни один сервисный метод не вызывает `referrerClaimHistoryRepository.create`. `ReferrerClaimHistory` пишется в другом месте, не в `loyalty`.) | `ReferrerClaimHistoryEntity.create({...data, amount: Decimal128.fromString(amount)})` | unique-index по (transactionHash, logIndex, chainId) |
| `referrer_claim_history_repository.find_all` | `loyaltyService.getReferrerClaimHistory` | `ReferrerClaimHistoryEntity.find(filter).sort().skip().limit().lean()` | — |

#### `ReferrerWithdrawRepository` (префикс referrer_withdraw_repository)

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `referrer_withdraw_repository.create_or_update` | `loyaltyService.createReferrerWithdrawTask` | `ReferrerWithdrawEntity.findOneAndUpdate({referrerWallet, referrerId, chainId, tokenAddress}, updateData, {upsert: true, new: true})` | пишет `taskId`, `taskExpiredAt`, `taskCooldown` |
| `referrer_withdraw_repository.add_withdrawn_amount` | `processReferralTreasuryWithdrawn` | `ReferrerWithdrawEntity.findOneAndUpdate({...filter}, {$inc: {totalWithdrawnAmount}}, {upsert: true, new: true})` | upsert |
| `referrer_withdraw_repository.find_by_referrer_and_token` | `loyaltyService.createReferrerWithdrawTask` | `ReferrerWithdrawEntity.findOne({...filter}).lean()` | — |
| `referrer_withdraw_repository.find_all` | `loyaltyService.getReferrerWithdraws` | `ReferrerWithdrawEntity.find(filter).sort().skip().limit().lean()` | — |

#### BlockchainEventsDaemon (span prefix: blockchain_events_daemon)

| Span name | Вызывается из | Действия | Ошибки |
|-----------|---------------|----------|--------|
| `blockchain_events_daemon.get_event_routing` | инициализация (вызывается из `BaseBlockchainDaemon.initialize()`) | Возвращает объект с 5 handler-ами: `Factory_CreateRWAFeeCollected`, `Factory_CreatePoolFeeCollected`, `Pool_RwaMinted`, `Pool_RwaBurned`, `ReferralTreasury_Withdrawn` — каждый делегирует в `loyaltyService.process*` | — |

> **Спан consume-цикла** (parent для всех обработчиков выше) создаётся в `BaseBlockchainDaemon.handleMessage`
> (см. `@shared/blockchain-daemon/src/baseBlockchain.daemon`): оборачивает обработку одного сообщения
> (имя формируется шаблоном `<service>.rabbitmq.consume`, см. `rwa-observability` §4.2). Это shared-span,
> не принадлежит `loyalty/src/`.

#### SignersManagerClient (Eden Treaty → signers-manager HTTP)

| Сетевая операция | Где | Описание |
|------------------|-----|----------|
| Eden Treaty POST к signers-manager (HTTP-автоинструментация создаёт client-span вида `HTTP POST` с атрибутами `http.url`, `http.method=POST`, `http.status_code`) | `loyaltyService.createReferrerWithdrawTask` | Eden inject traceparent → distributed-trace продолжается на стороне signers-manager, где сервисный слой обрабатывает `createSignatureTask` (см. `services/signers-manager/observability.md`). |

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты | Активен? |
|-----|-----------|-------------|----------|----------|
| HTTP | instrumentation-http | `POST /getFees`, `POST /getReferrals`, `POST /registerReferral`, `POST /getReferrerWithdraws`, `POST /getReferrerClaimHistory`, `POST /getCommissionHistory`, `POST /createReferrerWithdrawTask` (Elysia-роуты); HTTP client-span на Eden Treaty вызов к `signers-manager` | `http.method`, `http.target`, `http.status_code`, `http.url` (для client) | ✅ |
| MongoDB | instrumentation-mongoose | внутренние `mongoose.Collection.*` спаны | `db.mongodb.collection`, `db.operation` | ✅ (но репозитории трейсятся вручную через `@TraceDecorator` поверх Mongoose-вызовов) |
| RabbitMQ | instrumentation-amqplib | `publish blockchain.events.loyalty` (если loyalty паблишит — не паблишит, только consumes); `consume blockchain.events.loyalty` (от `BaseBlockchainDaemon.consume()`); `ack`/`nack` | `messaging.rabbitmq.exchange`, `messaging.rabbitmq.routing_key` | ✅ (consumer) |
| DNS | instrumentation-dns | `dns.lookup` (при MongoDB/AMQP TCP) | — | ✅ |
| FS | instrumentation-fs | `fs.*` (чтение `package.json`, `tsconfig.json` Bun runtime) | — | ✅ |
| Net | instrumentation-net | `net.*` (TCP connect к Mongo/AMQP) | — | ✅ |
| Runtime | instrumentation-runtime-node | — (только метрики: process_runtime_node_*) | — | ✅ |
| Redis | instrumentation-redis / ioredis | — | — | ❌ Redis-клиент не используется |
| GraphQL | instrumentation-graphql | — | — | ❌ Сервис REST-only (Elysia HTTP) |

### 1.5. Дебаг: полная иерархия для «обработать событие Pool_RwaMinted»

```
amqplib consume blockchain.events.loyalty    ← Amqplib auto-instr (consumer span, parent: producer от rwa-сервиса)
  └─ base_blockchain_daemon.handle_message   ← shared @shared/blockchain-daemon (содержит withTraceAsync '*.rabbitmq.consume')
      └─ blockchain_events_daemon.get_event_routing ← @TraceDecorator на самом методе возвращает routing map
          └─ loyalty_service.process_rwa_minted       ← @TraceDecorator + @MetricsDecorator + @LogDecorator
                ├── referral_repository.find_by_user_wallet  ← @TraceDecorator
                │     └── mongoose.Collection.findOne  ← mongoose auto-instr
                ├── fees_repository.add_buy_commission        ← @TraceDecorator
                │     └── mongoose.Collection.findOneAndUpdate  ← mongoose auto-instr
                ├── commission_history_repository.create      ← @TraceDecorator
                │     └── mongoose.Collection.create        ← mongoose auto-instr
                └─ processReferralReward (private, НЕ трейсится) — разрыв
                      ├── referral_repository.find_by_user_id
                      ├── fees_repository.add_referral_reward
                      └── commission_history_repository.create
```

### 1.6. Дебаг: полная иерархия для «создать задачу на вывод»

```
POST /createReferrerWithdrawTask                 ← HTTP auto-instr (Elysia server-span)
  └─ loyalty_service.create_referrer_withdraw_task  ← @TraceDecorator + @MetricsDecorator + @LogDecorator
        ├── fees_repository.find_all
        ├── referrer_withdraw_repository.find_by_referrer_and_token
        ├── generateWithdrawMessageHash (private, ethers — НЕ трейсится)
        ├── Eden POST signers-manager/createSignatureTask  ← HTTP auto-instr (client-span)
        │     ↳ distributed trace в signers-manager
        │       └─ signers-manager: span сервисного слоя (см. observability.md signers-manager)  (продолжение trace)
        │             └─ amqplib publish sign.exchange
        └── referrer_withdraw_repository.create_or_update
```

---

## 2. Логи

### 2.1. Business-логи

| Метод | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|------------------|------------------|------------|
| `loyaltyService.processCreateRWAFeeCollected` | `loyalty_service.process_create_r_w_a_fee_collected — called` с `{event}` | `loyalty_service.process_create_r_w_a_fee_collected — ok` | `— failed` → WARN (AppError) / `— system_error` → ERROR (Mongoose/ethers) |
| `loyaltyService.processCreatePoolFeeCollected` | `loyalty_service.process_create_pool_fee_collected — called` с `{event}` | `... — ok` | то же |
| `loyaltyService.processRwaMinted` | `loyalty_service.process_rwa_minted — called` с `{event}` | `... — ok` | то же |
| `loyaltyService.processRwaBurned` | `loyalty_service.process_rwa_burned — called` с `{event}` | `... — ok` | то же |
| `loyaltyService.processReferralTreasuryWithdrawn` | `loyalty_service.process_referral_treasury_withdrawn — called` с `{event}` | `... — ok` | то же |
| `loyaltyService.registerReferral` | `loyalty_service.register_referral — called` с `{params}` | `... — ok` | `— failed` → WARN / `— system_error` → ERROR. **Бизнес-ошибки «User already has a referrer» / «User cannot refer themselves» бросаются как `Error`, а не `AppError` → попадут в `system_error` (ERROR-уровень, ищется как инцидент), а не в `failed` (WARN, ожидаемое поведение)** — см. секцию «Критические gap'ы» в финальном ответе |
| `loyaltyService.createReferrerWithdrawTask` | `loyalty_service.create_referrer_withdraw_task — called` с `{params}` | `... — ok` | `— failed` → WARN (NotAllowedError: unsupported chainId / no rewards / amount exceeds / cooldown) |
| `loyaltyService.getFees` | `loyalty_service.get_fees — called` с `{params}` | `... — ok` | — |
| `loyaltyService.getReferrals` | `loyalty_service.get_referrals — called` с `{params}` | `... — ok` | — |
| `loyaltyService.getReferrerWithdraws` | `loyalty_service.get_referrer_withdraws — called` с `{params}` | `... — ok` | — |
| `loyaltyService.getReferrerClaimHistory` | `loyalty_service.get_referrer_claim_history — called` с `{params}` | `... — ok` | — |
| `loyaltyService.getCommissionHistory` | `loyalty_service.get_commission_history — called` с `{params}` | `... — ok` | — |

> **Замечание про PII в `event`:** `event.data` содержит адреса кошельков и суммы токенов. Это
> публичные on-chain данные, не секреты. Логирование целиком `event` допустимо, но при
> желании можно сузить до `['event.data.sender', 'event.data.amount', 'event.chainId', 'event.transactionHash']`
> для уменьшения шума.

> **Замечание про `params` в `registerReferral`:** содержит `userWallet` и `referrerWallet`
> (адреса 0x...), `userId` и `referrerId` (UUID-подобные строки) — это не PII, логирование
> целиком допустимо.

### 2.2. ErrorHandlerPlugin

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| `error instanceof AppError` (NotAllowedError) | `logger.error` | `[<code>] <message>` (например `[NOT_ALLOWED] Chain ID 56 is not supported`) | `{statusCode, path: request.url, details, stack}` |
| Любая другая ошибка (включая `Error("User already has a referrer")`, `Error("User cannot refer themselves")`, Mongoose-ошибки, AMQP-ошибки, Eden HTTP-ошибки) | `logger.error` | `Unexpected error:` | `{path: request.url, error: "<ErrorName>: <message>"}` |

> **Важно:** в `ErrorHandlerPlugin` (см. `shared/errors/error-handler.plugin.ts`) и `AppError`,
> и прочие ошибки логируются через `logger.error`. Слово «WARN» в колонке про AppError относится
> только к декоратору `@LogDecorator`, а не к error-handler.

### 2.3. Прямые вызовы `logger.*` в коде сервиса

| Файл | Уровень | Сообщение | Контекст |
|------|---------|-----------|----------|
| `src/plugins/repositories.plugin.ts` | `info` | `Connecting to MongoDB` | `{uri: mongoUri}` |
| `src/plugins/repositories.plugin.ts` | `info` | `MongoDB connected successfully` | — (по событию `mongoose.connection.once('connected')`) |
| `src/plugins/repositories.plugin.ts` (onStop) | `info` | `Disconnecting from MongoDB` | — |
| `src/plugins/repositories.plugin.ts` (onStop) | `info` | `MongoDB disconnected successfully` | — |
| `src/plugins/clients.plugin.ts` | `debug` | `Initializing clients` | — |
| `src/plugins/clients.plugin.ts` | `info` | `RabbitMQ client connected` | — |
| `src/plugins/clients.plugin.ts` (onStop) | `info` | `RabbitMQ client disconnected` | — |
| `src/plugins/daemons.plugin.ts` | `debug` | `Initializing daemons` | — |
| `src/plugins/daemons.plugin.ts` | `info` | `Blockchain events daemon started` | — |
| `src/plugins/daemons.plugin.ts` (onStop) | `info` | `Blockchain events daemon stopped` | — |

---

## 3. Метрики

### 3.1. Business метрики

Все метрики именуются как `<SERVICE_NAME>_<class_snake>_<method_snake>_{total|duration}`
и автоматически получают префикс `loyalty_` от `OTelMetrics` (см. `shared/monitoring/src/metrics.ts`).
`@MetricsDecorator` создаёт:
- `loyalty_<class_snake>_<method_snake>_total{result="success"|"error"}` — Counter
- `loyalty_<class_snake>_<method_snake>_duration` — Histogram (ms)

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `loyalty_loyalty_service_process_create_r_w_a_fee_collected_total` | Counter | `result=success\|error` | Каждый вызов `processCreateRWAFeeCollected` (т.е. каждое blockchain-событие `Factory_CreateRWAFeeCollected`) | Подсчёт обработанных fee-событий |
| `loyalty_loyalty_service_process_create_r_w_a_fee_collected_duration` | Histogram | — | Каждый вызов | Латентность обработки |
| `loyalty_loyalty_service_process_create_pool_fee_collected_total` | Counter | `result=success\|error` | Аналогично для `Factory_CreatePoolFeeCollected` | — |
| `loyalty_loyalty_service_process_create_pool_fee_collected_duration` | Histogram | — | — | — |
| `loyalty_loyalty_service_process_rwa_minted_total` | Counter | `result=success\|error` | Для `Pool_RwaMinted` | — |
| `loyalty_loyalty_service_process_rwa_minted_duration` | Histogram | — | — | — |
| `loyalty_loyalty_service_process_rwa_burned_total` | Counter | `result=success\|error` | Для `Pool_RwaBurned` | — |
| `loyalty_loyalty_service_process_rwa_burned_duration` | Histogram | — | — | — |
| `loyalty_loyalty_service_process_referral_treasury_withdrawn_total` | Counter | `result=success\|error` | Для `ReferralTreasury_Withdrawn` | — |
| `loyalty_loyalty_service_process_referral_treasury_withdrawn_duration` | Histogram | — | — | — |
| `loyalty_loyalty_service_register_referral_total` | Counter | `result=success\|error` | `POST /registerReferral` | Подсчёт новых реферальных связей |
| `loyalty_loyalty_service_register_referral_duration` | Histogram | — | — | Латентность |
| `loyalty_loyalty_service_create_referrer_withdraw_task_total` | Counter | `result=success\|error` | `POST /createReferrerWithdrawTask` | Подсчёт созданных withdraw-тасок |
| `loyalty_loyalty_service_create_referrer_withdraw_task_duration` | Histogram | — | — | Латентность (включает Eden HTTP к signers-manager) |
| `loyalty_loyalty_service_get_fees_total` | Counter | `result=success\|error` | `POST /getFees` | RPS list-endpoint |
| `loyalty_loyalty_service_get_fees_duration` | Histogram | — | — | — |
| `loyalty_loyalty_service_get_referrals_total` | Counter | `result=success\|error` | `POST /getReferrals` | — |
| `loyalty_loyalty_service_get_referrals_duration` | Histogram | — | — | — |
| `loyalty_loyalty_service_get_referrer_withdraws_total` | Counter | `result=success\|error` | `POST /getReferrerWithdraws` | — |
| `loyalty_loyalty_service_get_referrer_withdraws_duration` | Histogram | — | — | — |
| `loyalty_loyalty_service_get_referrer_claim_history_total` | Counter | `result=success\|error` | `POST /getReferrerClaimHistory` | — |
| `loyalty_loyalty_service_get_referrer_claim_history_duration` | Histogram | — | — | — |
| `loyalty_loyalty_service_get_commission_history_total` | Counter | `result=success\|error` | `POST /getCommissionHistory` | — |
| `loyalty_loyalty_service_get_commission_history_duration` | Histogram | — | — | — |

> **Двойной префикс** `loyalty_loyalty_service_*`: `SERVICE_NAME=loyalty` + `to_snake(LoyaltyService)=loyalty_service` →
> `loyalty_loyalty_service_<method>_total`. Визуально выглядит дублированием, но это валидное
> Prometheus-имя (snake_case-only), не опечатка. Применимо ко всем сервисам, у которых `SERVICE_NAME`
> совпадает с snake_case class-name (по аналогии с `dao_dao_service_*`, `blog_blog_service_*`,
> `auth_auth_service_*`).

> **Прямых `metrics.counter/gauge/histogram` вызовов в коде сервиса нет** — вся бизнес-метрика
> идёт через `@MetricsDecorator`. Бизнес-KPI с разрезностью по `actionType` (token_creation_commission /
> pool_creation_commission / buy_commission / sell_commission / referral_reward) или по chainId /
> tokenAddress на текущий момент не выделены отдельными счётчиками — для ответа «сколько referral_reward
> начислено за час по каждой сети» придётся вытаскивать через `getCommissionHistory` API. Это потенциальная
> зона роста observability (прямые `metrics.counter('loyalty_commission_total', {actionType, chainId})`),
> но НЕ зафиксирована как gap в этой доке (требовало бы правок runtime, не входило в задачу).

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | runtime-node | CPU, memory, event loop lag, GC |
| `http_server_*` | HTTP auto-instr | RPS, latency, status codes (для Elysia-роутов) |
| `db_client_*` | MongoDB auto-instr | Количество запросов, latency |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |
| `traces_service_graph_request_*` | Tempo service-graph | Distributed-trace граф (loyalty → signers-manager через Eden) |

### 3.3. Примеры PromQL

```promql
# Ошибки обработки blockchain-событий за 5 минут
sum(rate(loyalty_loyalty_service_process_create_rwa_fee_collected_total{result="error"}[5m]))
  + sum(rate(loyalty_loyalty_service_process_create_pool_fee_collected_total{result="error"}[5m]))
  + sum(rate(loyalty_loyalty_service_process_rwa_minted_total{result="error"}[5m]))
  + sum(rate(loyalty_loyalty_service_process_rwa_burned_total{result="error"}[5m]))

# P99 латентность создания withdraw-таски (включает Eden → signers-manager)
histogram_quantile(0.99, rate(loyalty_loyalty_service_create_referrer_withdraw_task_duration_bucket[5m]))

# Количество новых реферальных связей за 24ч
increase(loyalty_loyalty_service_register_referral_total{result="success"}[24h])

# Общий RPS list-endpoint-ов
sum(rate(loyalty_loyalty_service_get_fees_total[5m]))
  + sum(rate(loyalty_loyalty_service_get_referrals_total[5m]))
  + sum(rate(loyalty_loyalty_service_get_referrer_withdraws_total[5m]))
  + sum(rate(loyalty_loyalty_service_get_referrer_claim_history_total[5m]))
  + sum(rate(loyalty_loyalty_service_get_commission_history_total[5m]))
```

---

## 4. Health-check

`GET /health` — подключён через `healthPlugin` (см. `src/app.ts:52`). Возвращает стандартный
Elysia-health-response со статусом `up` после успешного старта (post `loyalty.init.elysia`).
Используется docker-compose healthcheck и k8s liveness probe.

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Blockchain-события не обрабатываются | 1) `loyalty.init.daemons.initialize` — был ли запущен daemon? 2) Amqplib consume-span `consume blockchain.events.loyalty` — есть ли сообщения? 3) `loyalty_loyalty_service_process_*_total{result="error"}` — не растёт ли счётчик ошибок? |
| `registerReferral` падает с `system_error` | Это БАГ: 3 бизнес-ошибки (`User already has a referrer`, `User cannot refer themselves` x2) бросаются как `Error`, а не `AppError`, и попадают в ERROR-логи вместо WARN. Искать в Loki по `error_message="User already has a referrer"` или `error_message="User cannot refer themselves"` — см. секцию «Критические gap'ы» |
| Withdraw-таска не создаётся | 1) `loyalty_loyalty_service_create_referrer_withdraw_task_total{result="error"}` — какая ошибка. 2) `notAllowedError` — неподдерживаемый chainId / нет rewards / превышен amount / cooldown активен. 3) Eden client-span к signers-manager — есть ли HTTP 4xx/5xx? |
| `BaseBlockchainDaemon.handleMessage` не находит handler | Routing-таблица в `BlockchainEventsDaemon.getEventRouting` (5 routing keys). Если `routingKey` события не совпадает — BaseBlockchainDaemon падает в `Unhandled event`. |
| Сервис не стартует | 1) `loyalty.init.main` / `loyalty.init.repositories_plugin.mongoose` — connect timeout. 2) `loyalty.init.clients.rabbitmq_connect` — AMQP handshake. |
| Реферал не получает reward | `loyalty_service.process_*_method` → `processReferralReward` (private, НЕ трейсится — span-разрыв на этом методе) → найти можно по `commission_history_repository.create` с `actionType=referral_reward` |
| Метрики не появляются в Prometheus | 1) `@MetricsDecorator` есть на 11 методах `LoyaltyService` — если сервис не получал ни одного запроса, `_total = 0` (нормально, метрика появится после первого вызова). 2) Проверить `loyalty_<class>_<method>_total` (Counter) и `loyalty_<class>_<method>_duration_count` (Histogram) в `/api/v1/label/__name__/values` |
