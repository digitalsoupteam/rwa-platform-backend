# ТЗ: Сервис API-ключей (`services/api-keys`)

## 1. Назначение

Сервис для управления API-ключами пользователей. Позволяет создавать, удалять, переименовывать и получать список ключей. Также предоставляет endpoint для валидации ключа (используется gateway для аутентификации запросов без JWT).

## 2. Архитектура

Полная копия структуры `services/auth`:

```
services/api-keys/
├── package.json
├── tsconfig.json
├── bunfig.toml
├── Dockerfile
└── src/
    ├── index.ts              — bootstrap, env
    ├── app.ts                — createApp, сборка плагинов
    ├── models/
    │   ├── entity/
    │   │   └── apiKey.entity.ts
    │   └── validation/
    │       └── apiKey.validation.ts
    ├── repositories/
    │   └── apiKey.repository.ts
    ├── services/
    │   └── apiKey.service.ts
    ├── controllers/
    │   ├── createApiKey.controller.ts
    │   ├── deleteApiKey.controller.ts
    │   ├── getApiKey.controller.ts
    │   ├── getApiKeys.controller.ts
    │   ├── updateApiKey.controller.ts
    │   └── validateApiKey.controller.ts
    └── plugins/
        ├── repositories.plugin.ts
        ├── services.plugin.ts
        └── controllers.plugin.ts
```

## 3. Сущность MongoDB (`apiKey.entity.ts`)

```ts
const apiKeySchemaDefinition = {
  userId:   { type: Schema.Types.ObjectId, required: true },  // без ref: 'User' — модель User живёт в БД auth
  wallet:   { type: String, required: true, lowercase: true },  // денормализовано, передаётся из gateway (из JWT context)
  name:     { type: String, required: true, trim: true },
  keyHash:  { type: String, required: true, unique: true },     // SHA-256 хеш ключа
  prefix:   { type: String, required: true },                   // первые 13 символов ключа: 'apikey_ab12cd'
  createdAt: { type: Number, default: Math.floor(Date.now() / 1000) },
  updatedAt: { type: Number, default: Math.floor(Date.now() / 1000) },
} as const;
```

Индексы:
- `{ userId: 1 }` — для получения списка ключей пользователя
- `{ keyHash: 1 }` — unique, для валидации

> `ref: 'User'` НЕ указывается — `User` модель живёт в БД сервиса auth (отдельная БД, `API_KEYS_MONGODB_DBNAME`). populate не используется и не сработает.

## 4. Формат ключа

Случайная строка: `apikey_<32 hex символа>` (всего 39 символов).

Генерация при создании:
```ts
const rawKey = 'apikey_' + crypto.randomBytes(16).toString('hex');
const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
const prefix = rawKey.slice(0, 13); // 'apikey_ab12cd' — 7 символов префикса + 6 hex
```

В БД хранится только `keyHash`. Plain key возвращается **один раз** при создании.

Префикс `apikey_` используется:
1. В `UserResolverService` (gateway) — для определения, что токен является API-ключом, а не JWT.
2. Для отображения в UI (пользователь видит `apikey_ab12cd...`).

## 5. Эндпоинты (все `.post`)

Сервис **не проверяет авторизацию** — доверяет gateway (внутренняя сеть Docker). Но **каждый CRUD-эндпоинт требует `userId` в body** для ownership-проверки: gateway инжектит `user.id` из context (JWT или API-ключ), **не из client input**.

### `POST /createApiKey`
- **Body:** `{ userId: string, wallet: string, name: string }`
- **Response:** `{ id, name, prefix, key, createdAt }`
- **key** — plain key, только здесь
- `wallet` и `userId` передаёт gateway resolver из `user.wallet` и `user.id` (из context)

### `POST /deleteApiKey`
- **Body:** `{ id: string, userId: string }`
- **Response:** `{ id }`
- Repository: `findOneAndDelete({ _id: id, userId })` → если не найден → 404
- `userId` из gateway context, не из client input

### `POST /getApiKey`
- **Body:** `{ id: string, userId: string }`
- **Response:** `{ id, name, prefix, userId, wallet, createdAt, updatedAt }`
- Repository: `findOne({ _id: id, userId })` → если не найден → 404
- `userId` из gateway context, не из client input

### `POST /getApiKeys`
- **Body:** `{ userId: string }`
- **Response:** `ApiKey[]` (без keyHash)
- Repository: `find({ userId }).select('-keyHash').lean()` — **обязательно** исключить keyHash из ответа
- `userId` из gateway context, не из client input

### `POST /updateApiKey`
- **Body:** `{ id: string, userId: string, name: string }`
- **Response:** `{ id, name, prefix, userId, wallet, createdAt, updatedAt }`
- Repository: `findOneAndUpdate({ _id: id, userId }, { name }, { new: true, lean: true })` → если не найден → 404
- `userId` из gateway context, не из client input

### `POST /validateApiKey`
- **Body:** `{ apiKey: string }`
- **Response:** `{ userId: string, wallet: string }`
- **Логика:** SHA-256(apiKey) → `findOne({ keyHash })` → если найден → `{ userId, wallet }`; если нет → 404
- Вызывается gateway на каждый запрос с API-ключом. Если сервис недоступен (500/network) — gateway должен вернуть 503, не 401.

## 6. Gateway integration

### `config/index.ts`
Добавить в `SERVICES`:
```ts
API_KEYS: {
  URL: String(process.env.API_KEYS_SERVICE_URL),
},
```

### `eden.clients.ts`
Добавить:
```ts
import type { App as ApiKeysApp } from '@services/api-keys/src';
export const apiKeysClient = createEdenTreatyClient<ApiKeysApp>(CONFIG.SERVICES.API_KEYS.URL);
export type ApiKeysClient = typeof apiKeysClient;
```

### `context/types.ts`
Добавить `apiKeysClient: ApiKeysClient` в `ServiceClients`.

### Новый сервис в gateway: `UserResolverService`

Файл: `services/gateway/src/services/userResolver.service.ts`

```ts
import { AppError } from '@shared/errors/app-errors';
import type { AuthClient, ApiKeysClient } from '../clients/eden.clients';
import { extractFromToken } from '../utils/jwt.utils';

export class UserResolverService {
  constructor(
    private authClient: AuthClient,
    private apiKeysClient: ApiKeysClient,
  ) {}

  async resolveUser(token: string | null): Promise<{ userId: string; wallet: string } | null> {
    if (!token) return null;

    // 1. Если токен начинается с 'apikey_' — это API-ключ
    if (token.startsWith('apikey_')) {
      const response = await this.apiKeysClient.validateApiKey.post({ apiKey: token });
      if (response.error) {
        // 404 — ключ не найден → null (корректный 401)
        // 500/network — сервис недоступен → 503
        if (response.error.status === 404) return null;
        throw new AppError({
          message: 'API keys service unavailable',
          statusCode: 503,
          code: 'SERVICE_UNAVAILABLE',
        });
      }
      return { userId: response.data.userId, wallet: response.data.wallet };
    }

    // 2. Иначе — пробуем JWT (sync, без HTTP-вызова)
    return extractFromToken(token);
  }
}
```

> **API-key-first:** проверка prefix `apikey_` ДО попытки JWT-парсинга. Это исключает:
> - HTTP-вызов в api-keys при обычном невалидном JWT
> - error-лог от `jwt.verify` при каждом API-key запросе

### `services.init.ts`
```ts
import { ApiKeysClient } from '../clients/eden.clients';
import { UserResolverService } from './userResolver.service';
// ...
export const userResolverService = new UserResolverService(authClient, apiKeysClient);
```

### Замена `extractFromToken` на `userResolverService.resolveUser`

Заменить в **5 местах**:

1. **`graphql/server/index.ts`** — Yoga context:
```ts
async context({ request }) {     // ← добавить async
  // ...
  const user = await userResolverService.resolveUser(token);
  // ...
}
```

2. **`controllers/uploadPoolImage.controller.ts`**
3. **`controllers/uploadImage.controller.ts`**
4. **`controllers/uploadDocument.controller.ts`**
5. **`controllers/uploadBusinessImage.controller.ts`**

В upload-контроллерах (Elysia routes, не GraphQL) — импортировать `userResolverService` из `services.init.ts`:
```ts
import { userResolverService } from '../services/services.init';
// ...
const extracted = await userResolverService.resolveUser(token);
```

## 7. GraphQL модуль `api-keys`

Создать по аналогии с `graphql/modules/auth/`:

### `graphql/modules/api-keys/schema.graphql`
```graphql
type ApiKey {
  id: ID!
  name: String!
  prefix: String!
  userId: String!
  wallet: String!
  createdAt: Int!
  updatedAt: Int!
}

type CreateApiKeyResult {
  id: ID!
  name: String!
  prefix: String!
  key: String!
  createdAt: Int!
}

input CreateApiKeyInput {
  name: String!
}

input UpdateApiKeyInput {
  id: ID!
  name: String!
}

extend type Query {
  getApiKeys: [ApiKey!]!
  getApiKey(id: ID!): ApiKey!
}

extend type Mutation {
  createApiKey(input: CreateApiKeyInput!): CreateApiKeyResult!
  updateApiKey(input: UpdateApiKeyInput!): ApiKey!
  deleteApiKey(id: ID!): ID!
}
```

### Резолверы

Все резолверы:
1. Проверяют `if (!user) throw 401`
2. Инжектят `userId: user.id` и `wallet: user.wallet` из context в body запроса к сервису
3. Не принимают `userId`/`wallet` из client input

```ts
// Пример: getApiKeys
export const getApiKeys: QueryResolvers['getApiKeys'] = async (_parent, {}, { clients, user }) => {
  if (!user) throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  const response = await clients.apiKeysClient.getApiKeys.post({ userId: user.id });
  if (response.error) throw new AppError({ message: 'Failed to get API keys', statusCode: 502, code: 'BAD_GATEWAY' });
  return response.data;
};
```

После создания schema.graphql и резолверов — запустить `bun run codegen` для регенерации `generated/types.ts`.

## 8. Docker

### `docker-compose.yml` — добавить сервис

По аналогии с `auth` (`docker-compose.yml:79-103`):

```yaml
api-keys:
  container_name: api-keys
  build:
    context: ../..
    dockerfile: services/api-keys/Dockerfile
  environment:
    <<: [*mongo-env, *monitoring-env]
    SERVICE_NAME: ${API_KEYS_SERVICE_NAME}
    SERVICE_VERSION: ${API_KEYS_SERVICE_VERSION}
    MONGODB_DBNAME: ${API_KEYS_MONGODB_DBNAME}
    OTEL_SERVICE_NAME: ${API_KEYS_SERVICE_NAME}
    OTEL_RESOURCE_ATTRIBUTES: service.name=${API_KEYS_SERVICE_NAME},service.version=${API_KEYS_SERVICE_VERSION},deployment.environment=${DEPLOYMENT_ENVIRONMENT}
    PORT: ${API_KEYS_PORT}
  volumes: *monitoring-volumes
  networks:
    - app-network
  depends_on:
    mongodb:
      condition: service_healthy
```

В блок `gateway` добавить:
```yaml
API_KEYS_SERVICE_URL: ${API_KEYS_SERVICE_URL}
```
В `gateway.depends_on` добавить:
```yaml
api-keys:
  condition: service_started
```

### `.env` — добавить переменные
```env
API_KEYS_PORT=<порт>
API_KEYS_SERVICE_NAME=api-keys
API_KEYS_SERVICE_VERSION=1.0.0
API_KEYS_MONGODB_DBNAME=<имя_БД>
API_KEYS_SERVICE_URL=http://api-keys:<порт>
```

## 9. package.json

Убрать лишние зависимости (копия auth, но сервис не работает с JWT/ethers):
```json
{
  "dependencies": {
    "@shared/monitoring": "workspace:*",
    "@shared/errors": "workspace:*",
    "elysia": "1.3.5",
    "mongoose": "8.16.4"
  }
}
```
`ethers` и `jsonwebtoken` — **убрать**. Сервис не выпускает и не проверяет JWT, не работает с подписями.

## 10. Аутентификация внутри сервиса

Сервис **не проверяет JWT** — доверяет gateway (внутренняя сеть Docker). Все эндпоинты доступны без авторизации. Ownership обеспечивается тем, что gateway инжектит `userId` из context в каждый запрос.

## 11. Env-переменные (`index.ts`)

```ts
Number(process.env.PORT),
String(process.env.MONGODB_URI) + '/' + String(process.env.MONGODB_DBNAME),
```

Только PORT и MONGODB_URI — никаких JWT_SECRET, токенов и т.д.

## 12. Что не нужно

- `active` boolean — удаление = полное удаление из БД
- `expiresAt` — ключи бессрочные
- `lastUsedAt` — не фиксируем
- Рефреш токены — не нужны
- JWT — сервис не выпускает и не проверяет JWT
- `ref: 'User'` в entity — модель User в другой БД, populate не нужен и не сработает

---

## 13. Инструкции по проверке

После реализации выполнить **по порядку**:

### 13.1. TypeScript — без ошибок

```bash
# Из корня проекта
bun run tsc --noEmit
```

Не должно быть ни одной ошибки. `--noEmit` обязательно — иначе генерирует .js файлы.

### 13.2. Prettier — без изменений

```bash
bun run format
```

Если prettier что-то меняет — значит код не отформатирован. Поправить и повторить, пока `git diff` пустой после `bun run format`.

### 13.3. GraphQL codegen

```bash
cd services/gateway
bun run codegen
```

`generated/types.ts` должен содержать типы `ApiKey`, `CreateApiKeyResult`, `CreateApiKeyInput`, `UpdateApiKeyInput` и резолверы `getApiKeys`, `getApiKey`, `createApiKey`, `updateApiKey`, `deleteApiKey`. Без этого резолверы не получат типы и `tsc` упадёт.

### 13.4. Структура файлов

Проверить что все файлы из section 2 существуют:
```bash
find services/api-keys/src -type f | sort
```

Должно быть ровно 15 файлов:
- `index.ts`, `app.ts`
- `models/entity/apiKey.entity.ts`, `models/validation/apiKey.validation.ts`
- `repositories/apiKey.repository.ts`
- `services/apiKey.service.ts`
- 6 контроллеров
- 3 плагина

### 13.5. Docker — сервис поднимается

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d api-keys
docker compose -f infrastructure/docker/docker-compose.yml logs api-keys --tail 20
```

Логи не должны содержать ошибок. Сервис должен слушать порт из `API_KEYS_PORT`.

### 13.6. Gateway видит сервис

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d gateway
docker compose -f infrastructure/docker/docker-compose.yml logs gateway --tail 20
```

Gateway должен запуститься без ошибок. `apiKeysClient` должен резолвиться по `API_KEYS_SERVICE_URL`.

### 13.7. End-to-end: создание ключа через GraphQL

```graphql
mutation {
  createApiKey(input: { name: "test-key" }) {
    id
    name
    prefix
    key
    createdAt
  }
}
```

Header: `Authorization: Bearer ***

Ожидаемый ответ:
```json
{
  "data": {
    "createApiKey": {
      "id": "...",
      "name": "test-key",
      "prefix": "apikey_......",
      "key": "apikey_......",
      "createdAt": 1234567890
    }
  }
}
```

`key` — полный plain key, возвращается **только здесь**. `prefix` — первые 13 символов.

### 13.8. End-to-end: валидация ключа

Использовать `key` из шага 13.7 как `Authorization: Bearer ***

```graphql
query {
  getApiKeys {
    id
    name
    prefix
    userId
    wallet
  }
}
```

Ожидаемый ответ — массив с созданным ключом. `keyHash` **не должен** присутствовать в ответе. `userId` и `wallet` должны совпадать с JWT-юзером.

### 13.9. End-to-end: JWT по-прежнему работает

```graphql
query {
  getApiKeys { id name }
}
```

Header: `Authorization: Bearer ***

Должен вернуть те же ключи. JWT path не сломан.

### 13.10. End-to-end: ownership

Юзер A создаёт ключ. Юзер B пытается:
- `getApiKey(id: <ключ-A>)` → должен получить 404 (не владеет)
- `updateApiKey(input: { id: <ключ-A>, name: "hack" })` → должен получить 404
- `deleteApiKey(id: <ключ-A>)` → должен получить 404

### 13.11. End-to-end: невалидный токен

```graphql
query { getApiKeys { id } }
```

Header: `Authorization: Bearer invalid_token_string`

Должен вернуть 401. Логи gateway **не должны** содержать error-лог от `jwt.verify` — `resolveUser` возвращает null без вызова `extractFromToken` (токен не начинается с `apikey_`, но и не является валидным JWT → `extractFromToken` возвращает null).

> **Примечание:** `extractFromToken` → `verifyToken` → `jwt.verify` всё равно вызывается для не-API-key токенов и может логировать error при невалидном JWT. Это существующее поведение, не регрессия. Если error-log мешает — понизить уровень с `logger.error` на `logger.debug` в `verifyToken`.

### 13.12. End-to-end: сервис api-keys недоступен

Остановить сервис:
```bash
docker compose -f infrastructure/docker/docker-compose.yml stop api-keys
```

Отправить запрос с валидным API-ключом:
```graphql
query { getApiKeys { id } }
```

Header: `Authorization: Bearer ***

Ожидаемый ответ — 503 `SERVICE_UNAVAILABLE`, **не** 401. `UserResolverService` различает 404 (ключ не найден) и 500/network (сервис упал).

Поднять сервис обратно:
```bash
docker compose -f infrastructure/docker/docker-compose.yml start api-keys
```

### 13.13. Логи не засоряются

При запросе с API-ключом (шаг 13.8) — проверить логи gateway:
```bash
docker compose -f infrastructure/docker/docker-compose.yml logs gateway --tail 50
```

Не должно быть записей вида `Error verifying JWT token: ...` — потому что `resolveUser` при `apikey_` prefix не вызывает `extractFromToken`/`verifyToken`.