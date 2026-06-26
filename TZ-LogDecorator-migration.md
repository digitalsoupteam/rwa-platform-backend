# ТЗ: Миграция LogDecorator на новый формат

## Что нужно сделать

Во всех перечисленных файлах заменить декораторы `@LogDecorator` со старого формата на новый.

### Старый формат (удалить):
```typescript
@LogDecorator({ args: ['paramName'] })
@LogDecorator({ args: ['paramName', 'anotherParam'] })
@LogDecorator({ args: ['params.id'] })  // точка = вложенное поле
@LogDecorator({ args: ['event'] })
```

### Новый формат (поставить):
```typescript
@LogDecorator({
  args: (a) => ({ fieldName: a[0] }),
})
@LogDecorator({
  args: (a) => ({
    id: a[0],
    name: a[1].name,
  }),
})
```

### Правила

1. **`a[N]`** — позиционный доступ к аргументам метода. `a[0]` = первый параметр, `a[1]` = второй, и т.д.
2. **Плоские поля** — логировать только примитивы (string, number, boolean), НЕ объекты целиком. Если параметр — объект, достать из него конкретные поля: `a[0].name`, а не `a[0]`.
3. **Имена меток** — осмысленные, совпадают с названием поля/параметра.
4. **`@LogDecorator()` без `args`** — не трогать, это декоратор без логирования аргументов.
5. **Вложенные поля** — старый формат `['params.id']` означал `params.id`. В новом: `a[0].id` (если `params` это `a[0]`).
6. **Отступы** — не важны, после миграции будет запущен Prettier.
7. **Только `@LogDecorator`** — `@TraceDecorator` и `@MetricsDecorator` не трогать.

### Примеры

**Было:**
```typescript
@LogDecorator({ args: ['id'] })
async getPool(id: string) {
```

**Стало:**
```typescript
@LogDecorator({
  args: (a) => ({ id: a[0] }),
})
async getPool(id: string) {
```

**Было:**
```typescript
@LogDecorator({ args: ['data'] })
async createPool(data: {
  ownerId: string;
  businessId: string;
  chainId: string;
}) {
```

**Стало:**
```typescript
@LogDecorator({
  args: (a) => ({
    ownerId: a[0].ownerId,
    businessId: a[0].businessId,
    chainId: a[0].chainId,
  }),
})
async createPool(data: {
  ownerId: string;
  businessId: string;
  chainId: string;
}) {
```

**Было:**
```typescript
@LogDecorator({ args: ['event'] })
async syncPoolReserves(event: { emittedFrom: string; realHoldReserve: string }) {
```

**Стало:**
```typescript
@LogDecorator({
  args: (a) => ({
    poolAddress: a[0].emittedFrom,
    realHoldReserve: a[0].realHoldReserve,
  }),
})
async syncPoolReserves(event: { emittedFrom: string; realHoldReserve: string }) {
```

### Файлы для обработки (28 файлов, 154 декоратора)

| № | Файл | Кол-во |
|---|---|---|
| 1 | `services/dao/src/services/dao.service.ts` | 16 |
| 2 | `services/questions/src/services/questions.service.ts` | 13 |
| 3 | `services/loyalty/src/services/loyalty.service.ts` | 12 |
| 4 | `services/blog/src/services/blogs.service.ts` | 10 |
| 5 | `services/gallery/src/services/images.service.ts` | 10 |
| 6 | `services/faq/src/services/faq.service.ts` | 10 |
| 7 | `services/documents/src/services/documents.service.ts` | 10 |
| 8 | `services/company/src/services/company.service.ts` | 9 |
| 9 | `services/rwa/src/services/business.service.ts` | 9 |
| 10 | `shared/openrouter/client.ts` | 4 |
| 11 | `services/testnet-faucet/src/services/faucet.service.ts` | 5 |
| 12 | `services/reactions/src/services/reactions.service.ts` | 4 |
| 13 | `services/blockchain-scanner/src/services/blockchainScanner.service.ts` | 5 |
| 14 | `services/files/src/services/file.service.ts` | 5 |
| 15 | `services/charts/src/services/transactions.service.ts` | 3 |
| 16 | `services/charts/src/services/charts.service.ts` | 3 |
| 17 | `services/signers-manager/src/services/signatures.service.ts` | 3 |
| 18 | `services/blockchain-scanner/src/daemons/blockchainScanner.daemon.ts` | 3 |
| 19 | `services/portfolio/src/services/portfolio.service.ts` | 3 |
| 20 | `services/signers-manager/src/daemons/taskResponses.daemon.ts` | 1 |
| 21 | `services/testnet-faucet/src/clients/blockchain.client.ts` | 2 |
| 22 | `services/gateway/src/services/validation.service.ts` | 2 |
| 23 | `services/gateway/src/services/ownership.service.ts` | 2 |
| 24 | `services/gateway/src/services/cache.service.ts` | 2 |
| 25 | `services/rwa/src/services/token.service.ts` | 1 |
| 26 | `services/signer/src/services/signature.service.ts` | 1 |
| 27 | `services/signer/src/daemons/signature.daemon.ts` | 1 |
| 28 | `services/gateway/src/services/parent.service.ts` | 1 |

### Уже обработано (не трогать)

- `services/ai-assistant/src/services/assistant.service.ts` ✅
- `services/ai-assistant/src/services/context.service.ts` ✅
- `services/ai-assistant/src/services/message.service.ts` ✅
- `services/auth/src/services/auth.service.ts` ✅
- `services/rwa/src/services/pool.service.ts` ✅

### Проверка после миграции

```bash
# найти все оставшиеся старые форматы:
grep -rn "@LogDecorator({ args: \[" services/ shared/
# должно вернуть 0 результатов
```

Корневая папка проекта: `C:\Users\User\Desktop\WORK2025\rwa-backend-new2`
