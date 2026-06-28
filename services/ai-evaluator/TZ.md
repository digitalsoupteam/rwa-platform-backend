# AI Evaluator Service — Техническое задание

## Назначение

Сервис `ai-evaluator` — автоматическая оценка риска (riskScore 1-100, `undefined` = не оценено) для бизнесов и пулов RWA-платформы. Заменяет примитивные `updateRiskScore` методы в rwa-сервисе на двухэтапную LLM-оценку с доступом к документам, изображениям, реакциям, Q&A, портфелю и связанным сущностям.

## Архитектурное решение

### Проблема

Текущие `updateRiskScore` в `rwa/pool.service.ts:231` и `rwa/business.service.ts:254`:
- Берут только description + tags
- Один LLM-запрос с regex-парсингом `RISK_SCORE: N`
- Нет доступа к документам, изображениям, реакциям, портфелю
- LLM-логика живёт в CRUD-сервисе

### Решение

Новый сервис `ai-evaluator` по стандартному skeleton (index.ts → app.ts → plugins):
- Сам запрашивает данные с сервисов платформы через Eden-клиенты
- Двухэтапная LLM-оценка: summary → detailed evaluation
- Сохраняет историю оценок в своей MongoDB
- Обновляет riskScore в rwa-сервисе через Eden-клиент

### Поток данных

```
Gateway (mutation: updatePoolRiskScore)
  → ai-evaluator: evaluatePoolRisk({ poolId })
      ├─ fetchPool({ poolId })                          → rwaClient.getPool
      ├─ fetchBusiness({ pool.businessId })              → rwaClient.getBusiness
      ├─ fetchSiblingPools({ businessId, excludeId })    → rwaClient.getPools
      ├─ Promise.all([
      │    fetchDocuments({ parentId: poolId })        → documentsClient.getDocuments
      │    fetchGallery({ parentId: poolId })          → galleryClient.getImages
      │    fetchReactions({ parentId, parentType })     → reactionsClient.getEntityReactions
      │    fetchQuestions({ parentId: poolId })        → questionsClient.getQuestions
      │  ])
      ├─ if pool.poolAddress: fetchPortfolio({ poolAddress })  → portfolioClient.getBalances
      │
      ├─ assemblePoolSummary({ ... })                    → LLM вызов #1
      │    summary + список доступных файлов (имя, mimeType, url)
      │    + метаданные сиблингов (name, riskScore, deployed)
      │    → LLM отвечает JSON: { requestedDocuments: [...], requestedImages: [...] }
      │
      ├─ fetch запрошенных документов/изображений по ID
      │    если не найден → AppError
      │
      ├─ evaluateWithRequestedData({ ... })              → LLM вызов #2
      │    multimodal запрос: text + file parts + image_url parts
      │    → LLM отвечает JSON: { riskScore, reasoning, factors }
      │
      ├─ evaluationRepository.create({ ... })           ← сохраняет оценку
      └─ rwaClient.setPoolRiskScore.post({ id, riskScore })
```

Оценка сохраняется ДО обновления riskScore в rwa. Если `setPoolRiskScore` упадёт — оценка в истории, можно ретраить.

---

## Структура сервиса

```
services/ai-evaluator/
├── package.json
├── tsconfig.json
├── Dockerfile
├── bunfig.toml
└── src/
    ├── index.ts
    ├── app.ts
    ├── clients/
    │   └── eden.clients.ts
    ├── controllers/
    │   ├── evaluatePoolRisk.controller.ts
    │   ├── evaluateBusinessRisk.controller.ts
    │   ├── getEvaluation.controller.ts
    │   └── getEvaluations.controller.ts
    ├── daemons/                          (нет — не нужен)
    ├── models/
    │   ├── entity/
    │   │   └── evaluation.entity.ts
    │   └── validation/
    │       └── evaluation.validation.ts
    ├── plugins/
    │   ├── repositories.plugin.ts
    │   ├── clients.plugin.ts
    │   ├── services.plugin.ts
    │   └── controllers.plugin.ts
    ├── repositories/
    │   └── evaluation.repository.ts
    └── services/
        └── riskEvaluation.service.ts
```

Слои подключаются в стандартном порядке:
```
monitoringPlugin → healthPlugin → onError(ErrorHandlerPlugin)
→ repositoriesPlugin → clientsPlugin → servicesPlugin → controllersPlugin
```

Daemons plugin отсутствует — фоновые задачи не нужны.

---

## Entity — `evaluation.entity.ts`

Модель данных оценки. Использует parent/grandParent паттерн из documents/gallery.

### Поля

| Поле | Тип | Назначение |
|---|---|---|
| `entityType` | `String` (enum: `'business'`, `'pool'`) | Тип оценённой сущности |
| `parentId` | `String`, required | ID оценённой сущности (businessId или poolId) |
| `grandParentId` | `String`, required | ID бизнесa (для pool — `pool.businessId`, для business — `business.id` = `parentId`, дублирование намеренное для унификации запросов) |
| `ownerId` | `String`, required | ID владельца сущности |
| `ownerType` | `String`, required | `company` / `user` |
| `riskScore` | `Number`, required, min 1, max 100 | Итоговая оценка (всегда 1-100, не может быть undefined) |
| `reasoning` | `String`, required | Текстовое обоснование от LLM |
| `factors` | `Array<{ name: String, impact: String, detail: String }>` | Факторы оценки |
| `stage1Response` | `String`, required | Сырой ответ LLM этапа 1 |
| `stage2Response` | `String`, required | Сырой ответ LLM этапа 2 |
| `evaluatedDocuments` | `Array<{ id: String, name: String, mimeType: String }>` | Документы, реально отправленные на этап 2 |
| `evaluatedImages` | `Array<{ id: String, name: String }>` | Изображения, реально отправленные на этап 2 |
| `modelUsed` | `String`, required | Какая модель OpenRouter использовалась |
| `createdAt` | `Number` | Unix timestamp (стандартный) |
| `updatedAt` | `Number` | Unix timestamp (стандартный) |

### parent/grandParent — как заполнять

Логика из `gateway/src/services/parent.service.ts`:

| entityType | parentId | grandParentId |
|---|---|---|
| `business` | businessId | business.id (сам бизнес) |
| `pool` | poolId | pool.businessId (родительский бизнес) |

Запрос `grandParentId = businessId` вернёт все оценки бизнесa + всех его пулов.

### Индексы

| Индекс | Запрос |
|---|---|
| `{ parentId: 1 }` | Все оценки одной сущности |
| `{ grandParentId: 1 }` | Все оценки бизнесa + его пулов |
| `{ ownerId: 1 }` | Все оценки одного владельца |
| `{ parentId: 1, createdAt: -1 }` | Последние оценки конкретной сущности |
| `{ entityType: 1, parentId: 1 }` | Оценки по типу + ID |

### Примеры запросов истории

| Хочу получить | Фильтр |
|---|---|
| Все оценки пула | `{ parentId: poolId, entityType: 'pool' }` |
| Все оценки бизнесa (включая его пулы) | `{ grandParentId: businessId }` |
| Только оценки бизнесa (без пулов) | `{ parentId: businessId, entityType: 'business' }` |
| Последняя оценка пула | `{ parentId: poolId, entityType: 'pool' }` sort `{ createdAt: -1 }` limit 1 |

### Шаблон entity

```typescript
import mongoose, { Schema } from 'mongoose';
import type { InferRawDocType, Types } from 'mongoose';

const evaluationSchemaDefinition = {
  entityType: {
    type: String,
    required: true,
    enum: ['business', 'pool'],
  },
  parentId: {
    type: String,
    required: true,
    trim: true,
  },
  grandParentId: {
    type: String,
    required: true,
    trim: true,
  },
  ownerId: {
    type: String,
    required: true,
    trim: true,
  },
  ownerType: {
    type: String,
    required: true,
    trim: true,
  },
  riskScore: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
  },
  reasoning: {
    type: String,
    required: true,
  },
  factors: {
    type: [
      {
        name: { type: String, required: true },
        impact: { type: String, required: true },
        detail: { type: String, required: true },
      },
    ],
    default: [],
  },
  stage1Response: {
    type: String,
    required: true,
  },
  stage2Response: {
    type: String,
    required: true,
  },
  evaluatedDocuments: {
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        mimeType: { type: String, required: true },
      },
    ],
    default: [],
  },
  evaluatedImages: {
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
      },
    ],
    default: [],
  },
  modelUsed: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Number,
    default: Math.floor(Date.now() / 1000),
  },
  updatedAt: {
    type: Number,
    default: Math.floor(Date.now() / 1000),
  },
} as const;

const evaluationSchema = new Schema(evaluationSchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

evaluationSchema.index({ parentId: 1 });
evaluationSchema.index({ grandParentId: 1 });
evaluationSchema.index({ ownerId: 1 });
evaluationSchema.index({ parentId: 1, createdAt: -1 });
evaluationSchema.index({ entityType: 1, parentId: 1 });

export type IEvaluationEntity = InferRawDocType<typeof evaluationSchemaDefinition> & {
  _id: Types.ObjectId;
};

export const EvaluationEntity = mongoose.model('Evaluation', evaluationSchema);
```

---

## Validation — `evaluation.validation.ts`

Типы выводятся через `typeof schema.static`, не hand-written.

```typescript
import { t } from 'elysia';

export const evaluationSchema = t.Object({
  id: t.String(),
  entityType: t.Union([t.Literal('business'), t.Literal('pool')]),
  parentId: t.String(),
  grandParentId: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  riskScore: t.Number(),
  reasoning: t.String(),
  factors: t.Array(
    t.Object({
      name: t.String(),
      impact: t.String(),
      detail: t.String(),
    }),
  ),
  stage1Response: t.String(),
  stage2Response: t.String(),
  evaluatedDocuments: t.Array(
    t.Object({
      id: t.String(),
      name: t.String(),
      mimeType: t.String(),
    }),
  ),
  evaluatedImages: t.Array(
    t.Object({
      id: t.String(),
      name: t.String(),
    }),
  ),
  modelUsed: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export type IEvaluationDTO = typeof evaluationSchema.static;

/* Evaluate */
export const evaluatePoolRiskRequest = t.Object({
  poolId: t.String(),
});
export const evaluatePoolRiskResponse = evaluationSchema;

export const evaluateBusinessRiskRequest = t.Object({
  businessId: t.String(),
});
export const evaluateBusinessRiskResponse = evaluationSchema;

/* Get evaluation */
export const getEvaluationRequest = t.Pick(evaluationSchema, ['id']);
export const getEvaluationResponse = evaluationSchema;

/* Get evaluations list */
export const getEvaluationsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(
    t.Record(t.String(), t.Union([t.Literal('asc'), t.Literal('desc')])),
  ),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number()),
});
export const getEvaluationsResponse = t.Array(evaluationSchema);
```

---

## Repository — `evaluation.repository.ts`

Стандартный паттерн как `document.repository.ts`:

- `create(data)` — создаёт запись, возвращает `toObject()`
- `findById(id)` — findOne by _id, бросает `AppError 404` если не найдено
- `findAll(filter, sort, limit, offset)` — find с фильтром/пагинацией

Все методы с `@TraceDecorator()`.

---

## Clients — `eden.clients.ts`

Eden-клиенты к сервисам платформы. Паттерн как `ai-assistant/src/clients/eden.clients.ts`:

```typescript
import type { App as RwaApp } from '@services/rwa/src';
import type { App as DocumentsApp } from '@services/documents/src';
import type { App as GalleryApp } from '@services/gallery/src';
import type { App as ReactionsApp } from '@services/reactions/src';
import type { App as QuestionsApp } from '@services/questions/src';
import type { App as PortfolioApp } from '@services/portfolio/src';
import { createEdenTreatyClient } from '@shared/monitoring/src/eden';

export const createRwaClient = (url: string) => createEdenTreatyClient<RwaApp>(url);
export const createDocumentsClient = (url: string) => createEdenTreatyClient<DocumentsApp>(url);
export const createGalleryClient = (url: string) => createEdenTreatyClient<GalleryApp>(url);
export const createReactionsClient = (url: string) => createEdenTreatyClient<ReactionsApp>(url);
export const createQuestionsClient = (url: string) => createEdenTreatyClient<QuestionsApp>(url);
export const createPortfolioClient = (url: string) => createEdenTreatyClient<PortfolioApp>(url);

export type RwaClient = ReturnType<typeof createRwaClient>;
export type DocumentsClient = ReturnType<typeof createDocumentsClient>;
export type GalleryClient = ReturnType<typeof createGalleryClient>;
export type ReactionsClient = ReturnType<typeof createReactionsClient>;
export type QuestionsClient = ReturnType<typeof createQuestionsClient>;
export type PortfolioClient = ReturnType<typeof createPortfolioClient>;
```

Дополнительно `OpenRouterClient` из `@shared/openrouter/client` — создаётся в clients.plugin.ts напрямую.

---

## Clients Plugin — `clients.plugin.ts`

```typescript
createClientsPlugin(
  openRouterApiKey,
  openRouterBaseUrl,
  rwaServiceUrl,
  documentsServiceUrl,
  galleryServiceUrl,
  reactionsServiceUrl,
  questionsServiceUrl,
  portfolioServiceUrl,
)
```

Создаёт и decorate:
- `openRouterClient`
- `rwaClient`
- `documentsClient`
- `galleryClient`
- `reactionsClient`
- `questionsClient`
- `portfolioClient`

Все через `withTraceSync('ai-evaluator.init.clients.<name>', ...)`.

---

## Service — `riskEvaluation.service.ts`

### Конструктор

```typescript
constructor(
  private readonly evaluationRepository: EvaluationRepository,
  private readonly openRouterClient: OpenRouterClient,
  private readonly rwaClient: RwaClient,
  private readonly documentsClient: DocumentsClient,
  private readonly galleryClient: GalleryClient,
  private readonly reactionsClient: ReactionsClient,
  private readonly questionsClient: QuestionsClient,
  private readonly portfolioClient: PortfolioClient,
  private readonly openRouterModel: string,
)
```

### Методы

#### `evaluatePoolRisk({ poolId })`

Оркестратор. Каждый LLM вызов — отдельный traced+logged метод.

1. `fetchPool({ poolId })` — private, `rwaClient.getPool.post({ id: poolId })`
2. `fetchBusiness({ pool.businessId })` — private, `rwaClient.getBusiness.post({ id: pool.businessId })`
3. `fetchSiblingPools({ businessId, excludeId: poolId })` — `rwaClient.getPools.post({ filter: { businessId } })`, отфильтровать текущий пул, оставить только `{ name, riskScore, poolAddress }` для summary
4. `Promise.all([
     fetchDocuments({ parentId: poolId }),
     fetchGallery({ parentId: poolId }),
     fetchReactions({ parentId: poolId, parentType: 'pool' }),
     fetchQuestions({ parentId: poolId }),
   ])` — параллельный fetch 4 источников. Документы/галерея привязаны через parentId (не ownerId)
5. `if pool.poolAddress: fetchPortfolio({ poolAddress })` — только если пул задеплоен (poolAddress непустой), иначе portfolio = null
6. `assemblePoolSummary({ pool, business, siblingPools, documents, gallery, reactions, questions, portfolio })` → LLM #1
7. fetch запрошенных документов/изображений по ID из responses stage1 — если не найден → AppError
8. `evaluateWithRequestedData({ summary, requestedDocuments, requestedImages })` → LLM #2
9. `evaluationRepository.create({ ... })` — сохранение
10. `rwaClient.setPoolRiskScore.post({ id: poolId, riskScore })` — обновление rwa

Возвращает `IEvaluationDTO`.

#### `evaluateBusinessRisk({ businessId })`

Оркестратор. Аналогично pool, без portfolio.

1. `fetchBusiness({ businessId })` — private, `rwaClient.getBusiness.post({ id: businessId })`
2. `fetchBusinessPools({ businessId })` — `rwaClient.getPools.post({ filter: { businessId } })`, оставить только `{ name, riskScore, poolAddress }` для summary
3. `Promise.all([
     fetchDocuments({ parentId: businessId }),
     fetchGallery({ parentId: businessId }),
     fetchReactions({ parentId: businessId, parentType: 'business' }),
     fetchQuestions({ parentId: businessId }),
   ])` — параллельный fetch 4 источников. Документы/галерея привязаны через parentId (не ownerId)
4. `assembleBusinessSummary({ business, pools, documents, gallery, reactions, questions })` → LLM #1
5. fetch запрошенных документов/изображений по ID — если не найден → AppError
6. `evaluateWithRequestedData({ summary, requestedDocuments, requestedImages })` → LLM #2
7. `evaluationRepository.create({ ... })` — сохранение
8. `rwaClient.setBusinessRiskScore.post({ id: businessId, riskScore })` — обновление rwa

Возвращает `IEvaluationDTO`.

#### `getEvaluation({ id })`

`evaluationRepository.findById(id)` → маппинг в DTO.

#### `getEvaluations({ filter, sort, limit, offset })`

`evaluationRepository.findAll(...)` → маппинг в массив DTO.

#### Private fetch-методы

- `fetchPool({ poolId })` — `rwaClient.getPool.post({ id: poolId })`
- `fetchBusiness({ businessId })` — `rwaClient.getBusiness.post({ id: businessId })`
- `fetchSiblingPools({ businessId, excludeId })` — `rwaClient.getPools.post({ filter: { businessId } })`, отфильтровать excludeId, оставить `{ name, riskScore, poolAddress }`
- `fetchBusinessPools({ businessId })` — `rwaClient.getPools.post({ filter: { businessId } })`, оставить `{ name, riskScore, poolAddress }`
- `fetchDocuments({ parentId })` — `documentsClient.getDocuments.post({ filter: { parentId } })`. Документы привязаны через parentId (не ownerId) — у documents entity есть parentId + grandParentId
- `fetchGallery({ parentId })` — `galleryClient.getImages.post({ filter: { parentId } })`. Аналогично documents
- `fetchReactions({ parentId, parentType })` — `reactionsClient.getEntityReactions.post({ parentId, parentType })` — **прямые поля, не filter**. У reactions entity есть parentType, поэтому передаём. Возвращает `{ reactions: Record<string, number>, userReactions: string[] }`
- `fetchQuestions({ parentId })` — `questionsClient.getQuestions.post({ filter: { parentId } })`. У questions entity нет parentType, только parentId + grandParentId
- `fetchPortfolio({ poolAddress })` — `portfolioClient.getBalances.post({ filter: { poolAddress } })`

#### Private LLM-методы

- `assemblePoolSummary({ pool, business, siblingPools, documents, gallery, reactions, questions, portfolio })` → LLM вызов #1, возвращает `{ stage1Response, requestedDocuments, requestedImages }`
- `assembleBusinessSummary({ business, pools, documents, gallery, reactions, questions })` → LLM вызов #1, возвращает `{ stage1Response, requestedDocuments, requestedImages }`
- `evaluateWithRequestedData({ summary, requestedDocuments, requestedImages, fetchedDocuments, fetchedImages })` → LLM вызов #2, возвращает `{ riskScore, reasoning, factors, stage2Response }`. `fetchedDocuments`/`fetchedImages` — документы/изображения, запрошенные LLM на stage1 и fetchнутые по ID (не исходные полные списки)
- `parseLLMJsonResponse(response)` — strip markdown ```json ... ``` → JSON.parse, бросает AppError при ошибке. Структура ответа НЕ валидируется — считаем, что LLM+промпт возвращают валидные данные, иначе AppError

### Декораторы

Каждый public метод:
```typescript
@TraceDecorator()
@MetricsDecorator()
@LogDecorator({ args: (a) => ({ ... }) })
```

Private методы с LLM вызовами тоже `@TraceDecorator()` + `@LogDecorator()`.

### setSpanAttributes

- `evaluatePoolRisk`: `{ entityId: poolId, entityType: 'pool' }`
- `evaluateBusinessRisk`: `{ entityId: businessId, entityType: 'business' }`
- `getEvaluation`: `{ evaluationId: id }`
- `getEvaluations`: `{ filterKeys: Object.keys(filter).join(',') }`

---

## Двухэтапная LLM-оценка — детали

### Этап 1 — Summary

Собирается структурированный текст:
- Метаданные: name, description, tags, country, businessType, socials
- Для pool: финансовые параметры (fees, amounts, tranches, periods) + данные родительского business (name, type, country, tags, socials)
- Для pool: метаданные сиблингов (другие пулы этого бизнеса) — `{ name, riskScore | "not yet evaluated", poolAddress, deployed: !!poolAddress }`
- Для business: метаданные пулов этого бизнеса — `{ name, riskScore | "not yet evaluated", poolAddress, deployed: !!poolAddress }`
- Документы: список `{ id, name, mimeType, url }` — **без содержимого**
- Изображения: список `{ id, name, url }`
- Reactions: счётчики по типам (из `getEntityReactions` — `{ reactions: Record<string, number>, userReactions: string[] }`)
- Q&A: количество вопросов, количество отвеченных
- Portfolio (для pool, только если poolAddress задан): количество инвесторов, total invested

LLM промпт: «Вот описание сущности. Какие документы/изображения тебе нужно изучить для оценки риска? Верни JSON.»

Ответ: `{ "requestedDocuments": ["docId1", "docId3"], "requestedImages": ["imgId2"] }`

### Этап 2 — Detailed evaluation

Запрошенные документы и изображения подгружаются. Отправляются как multimodal content parts:
- PDF → `FileContentPart` с `fileData: url`
- Изображение → `ImageContentPart` с `imageUrl: url`
- Текст = summary из этапа 1 + reasoning

LLM отвечает: `{ "riskScore": 45, "reasoning": "...", "factors": [{ "name": "...", "impact": "...", "detail": "..." }] }`

riskScore в ответе LLM — целое число 1-100 (0 невозможен). Если LLM вернул 0 или > 100 — AppError.

### OpenRouter types

Из `@shared/openrouter/types`:
- `ChatMessage` с `content: string | ContentPart[]`
- `ContentPart` = `TextContentPart | ImageContentPart | FileContentPart | ...`
- `FileContentPart`: `{ type: 'file', file: { filename, fileData: url } }`
- `ImageContentPart`: `{ type: 'image_url', imageUrl: { url } }`

---

## Controllers

### `evaluatePoolRisk.controller.ts`

```typescript
POST /evaluatePoolRisk
body: evaluatePoolRiskRequest   { poolId: string }
response: evaluatePoolRiskResponse  (evaluationSchema)
→ riskEvaluationService.evaluatePoolRisk({ poolId })
```

### `evaluateBusinessRisk.controller.ts`

```typescript
POST /evaluateBusinessRisk
body: evaluateBusinessRiskRequest  { businessId: string }
response: evaluateBusinessRiskResponse  (evaluationSchema)
→ riskEvaluationService.evaluateBusinessRisk({ businessId })
```

### `getEvaluation.controller.ts`

```typescript
POST /getEvaluation
body: getEvaluationRequest  { id: string }
response: getEvaluationResponse  (evaluationSchema)
→ riskEvaluationService.getEvaluation({ id })
```

### `getEvaluations.controller.ts`

```typescript
POST /getEvaluations
body: getEvaluationsRequest  { filter, sort, limit, offset }
response: getEvaluationsResponse  (evaluationSchema[])
→ riskEvaluationService.getEvaluations({ filter, sort, limit, offset })
```

Все контроллеры следуют паттерну:
```typescript
export const evaluatePoolRiskController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'EvaluatePoolRiskController' })
    .use(servicesPlugin)
    .post('/evaluatePoolRisk', async ({ body, riskEvaluationService }) => {
      return await riskEvaluationService.evaluatePoolRisk(body);
    }, {
      body: evaluatePoolRiskRequest,
      response: evaluatePoolRiskResponse,
    });
};
```

---

## Controllers Plugin — `controllers.plugin.ts`

```typescript
export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const evaluatePoolRiskController = withTraceSync(
    'ai-evaluator.init.controllers.evaluate_pool_risk',
    () => createEvaluatePoolRiskController(servicesPlugin),
  );
  // ... остальные
  
  return new Elysia({ name: 'Controllers' })
    .use(servicesPlugin)
    .use(evaluatePoolRiskController)
    .use(evaluateBusinessRiskController)
    .use(getEvaluationController)
    .use(getEvaluationsController);
};
export type ControllersPlugin = ReturnType<typeof createControllersPlugin>;
```

---

## app.ts

```typescript
export async function createApp(
  port: number,
  mongoUri: string,
  openRouterApiKey: string,
  openRouterBaseUrl: string,
  openRouterModel: string,
  rwaServiceUrl: string,
  documentsServiceUrl: string,
  galleryServiceUrl: string,
  reactionsServiceUrl: string,
  questionsServiceUrl: string,
  portfolioServiceUrl: string,
) {
  const repositoriesPlugin = await withTraceAsync(
    'ai-evaluator.init.repositories_plugin',
    async () => await createRepositoriesPlugin(mongoUri),
  );

  const clientsPlugin = withTraceSync('ai-evaluator.init.clients_plugin', () =>
    createClientsPlugin(
      openRouterApiKey, openRouterBaseUrl,
      rwaServiceUrl, documentsServiceUrl, galleryServiceUrl,
      reactionsServiceUrl, questionsServiceUrl, portfolioServiceUrl,
    ),
  );

  const servicesPlugin = withTraceSync('ai-evaluator.init.services_plugin', () =>
    createServicesPlugin(repositoriesPlugin, clientsPlugin, openRouterModel),
  );

  const controllersPlugin = withTraceSync('ai-evaluator.init.controllers_plugin', () =>
    createControllersPlugin(servicesPlugin),
  );

  const app = withTraceSync('ai-evaluator.init.elysia', (ctx) => {
    const result = new Elysia()
      .use(monitoringPlugin)
      .use(healthPlugin)
      .onError(ErrorHandlerPlugin)
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .use(servicesPlugin)
      .use(controllersPlugin)
      .listen(port, () => { ctx.end(); });
    return result;
  });

  return app;
}
```

---

## index.ts

```typescript
import { createApp } from './app';
import { tracer } from '@shared/monitoring/src/tracing';

const app = await tracer.startActiveSpan('ai-evaluator.init.main', async (span) => {
  const appInstance = await createApp(
    Number(process.env.PORT),
    String(process.env.MONGODB_URI) + '/' + String(process.env.MONGODB_DBNAME),
    String(process.env.OPENROUTER_API_KEY),
    String(process.env.OPENROUTER_BASE_URL),
    String(process.env.OPENROUTER_MODEL),
    String(process.env.RWA_SERVICE_URL),
    String(process.env.DOCUMENTS_SERVICE_URL),
    String(process.env.GALLERY_SERVICE_URL),
    String(process.env.REACTIONS_SERVICE_URL),
    String(process.env.QUESTIONS_SERVICE_URL),
    String(process.env.PORTFOLIO_SERVICE_URL),
  );
  span.end();
  return appInstance;
});

const shutdown = async () => {
  try { await app.stop(); process.exit(0); }
  catch { process.exit(1); }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export type App = typeof app;
```

---

## package.json

Зависимости (по аналогии с ai-assistant):

```json
{
  "name": "@services/ai-evaluator",
  "version": "1.0.0",
  "private": true,
  "exports": {
    "types": "./src/index.ts",
    "import": "./src/index.ts"
  },
  "dependencies": {
    "@shared/monitoring": "workspace:*",
    "@shared/errors": "workspace:*",
    "@shared/openrouter": "workspace:*",
    "@services/rwa": "workspace:*",
    "@services/documents": "workspace:*",
    "@services/gallery": "workspace:*",
    "@services/reactions": "workspace:*",
    "@services/questions": "workspace:*",
    "@services/portfolio": "workspace:*",
    "elysia": "...",
    "mongoose": "..."
  }
}
```

Точные версии elysia/mongoose — скопировать из ai-assistant/package.json.

---

## tsconfig.json

Скопировать из ai-assistant/tsconfig.json.

---

## Что меняется в других сервисах

### RWA service — ДО/ВМЕСТЕ С ai-evaluator

`setPoolRiskScore`/`setBusinessRiskScore` эндпоинты нужны **до** запуска ai-evaluator — оркестратор вызывает их на шаге 10/8.

### RWA service

#### riskScore: undefined = «не оценено»

Pool и Business entity:
- Убрать `default: 100` — поле отсутствует в документе, если не было оценки
- `min: 1, max: 100` — риск всегда 1-100 (0 невозможен, платформа не заявляет «риска нет»)

Pool и Business validation (Elysia):
- `riskScore: t.Optional(t.Number())` — поле может отсутствовать (undefined = не оценено)

GraphQL schema (`rwa/schema.graphql`):
- `riskScore: Int` (убрать `!`, поменять `Float` → `Int`) — nullable, целое число

Gateway generated types — перегенерить после изменения schema.graphql.

#### `updateRiskScore` → `setRiskScore`

- Убрать LLM-логику, openRouterClient (если не нужен для createWithAI)
- Метод: `setRiskScore({ id, riskScore })` — validate range 1-100, update DB
- Controller: `POST /setPoolRiskScore` с body `{ id, riskScore }`
- Validation: `updatePoolRiskScoreRequest` → `setPoolRiskScoreRequest = t.Object({ id: t.String(), riskScore: t.Number() })`
- Аналогично для business: `POST /setBusinessRiskScore`, `setBusinessRiskScoreRequest`

### Gateway

Резолверы перенаправляются:
- `rwaClient.updatePoolRiskScore.post({ id })` → `aiEvaluatorClient.evaluatePoolRisk.post({ poolId })`
- `rwaClient.updateBusinessRiskScore.post({ id })` → `aiEvaluatorClient.evaluateBusinessRisk.post({ businessId })`
- Auth + ownership проверка остаётся в gateway

### docker-compose

Добавить сервис `ai-evaluator` с env:
- `PORT`, `MONGODB_URI`, `MONGODB_DBNAME`
- `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL`
- `RWA_SERVICE_URL`, `DOCUMENTS_SERVICE_URL`, `GALLERY_SERVICE_URL`
- `REACTIONS_SERVICE_URL`, `QUESTIONS_SERVICE_URL`, `PORTFOLIO_SERVICE_URL`

---

## Pitfalls

- **Не читать `process.env` в слоях.** Только в `index.ts`. Передавать через `createApp` → plugin factories → constructor.
- **Типы через `typeof schema.static`.** Не hand-written `IEvaluationDTO`.
- **Single-object-parameter для service методов.** `evaluatePoolRisk({ poolId })`, не `evaluatePoolRisk(poolId)`.
- **Каждый LLM вызов — отдельный метод с `@TraceDecorator`.** Оркестратор вызывает 2+ traced метода.
- **DTO с `id: string`**, не `_id: ObjectId`. Конвертация в service слое.
- **`@LogDecorator` args selector — flat primitives.** `(a) => ({ poolId: a[0].poolId })`, не `(a) => ({ pool: a[0] })`.
- **`!!array` → `.length > 0`.** Для логирования наличия документов/изображений.
- **OpenRouterClient — generic HTTP wrapper.** `openRouterModel` передаётся в service constructor, не в client. Одна модель для stage1 и stage2.
- **Eden-клиенты типизированы через `App` тип сервиса.** `createEdenTreatyClient<RwaApp>(url)`.
- **Plugin factory параметры — typed, не `any`.** Иначе Eden treaty ломается.
- **Multimodal content parts.** PDF → `FileContentPart` с `fileData: url`. Image → `ImageContentPart` с `imageUrl: url`. URL берётся из document/image DTO (поле `url`).
- **JSON-парсинг LLM ответа.** Не regex. LLM может обернуть JSON в markdown code block — нужно strip ```json ... ``` перед JSON.parse. Структура ответа не валидируется — если LLM вернул мусор, AppError.
- **Reactions — прямой вызов, не через filter.** `reactionsClient.getEntityReactions.post({ parentId, parentType })` — возвращает агрегированные статы `{ reactions: Record<string, number>, userReactions: string[] }`, не сырые реакции.
- **Pool/Business riskScore = undefined, не null.** В entity убрать `default: 100`, в validation `t.Optional(t.Number())`, в GraphQL `Int` (убрать `!`). undefined = «не оценено», число 1-100 = «оценено».
- **riskScore range 1-100, не 0-100.** 0 невозможен — платформа не заявляет «риска нет». evaluation entity: required 1-100. setRiskScore: валидирует 1-100.
- **poolAddress может быть пустым.** Пул может быть не задеплоен на момент оценки — пропускаем fetchPortfolio, не ошибка.
- **LLM запросил несуществующий документ/изображение.** Stage 2 fetch по ID из stage1 response — если не найден, AppError.
- **Параллельный fetch.** documents, gallery, reactions, questions — через `Promise.all`. portfolio — отдельно, только если poolAddress.
- **Сиблинги/пулы — только метаданные в summary.** `getPools.post({ filter: { businessId } })` возвращает полный `poolSchema[]`, но service оставляет только `{ name, riskScore, poolAddress }` для текста summary. `riskScore` может быть undefined → «not yet evaluated» в тексте.
- **Два отдельных assemble-метода.** `assemblePoolSummary` и `assembleBusinessSummary` — разная структура данных, generic-метод не нужен.
- **OpenRouter модель должна поддерживать multimodal input** (image_url + file). Модель задаётся через `OPENROUTER_MODEL` env. Stage 2 отправляет PDF и изображения — модель должна их принимать.