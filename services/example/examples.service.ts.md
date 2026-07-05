# Example Service — Эталонный референс

**Все файлы сервиса мы пишем именно так, как описано ниже.**  
Это не «теоретический гайд» — это выжимка из 20 живых сервисов (rwa, auth, blog, documents, company, faq, gallery, questions, files, ai-assistant, blockchain-scanner, charts, dao, loyalty, portfolio, reactions, signer, signers-manager, testnet-faucet, gateway).

Каждое соглашение здесь — это то, что повторяется **почти в каждом сервисе**.  
Там где есть исключения — они явно указаны, и для нового сервиса ты **обязан** придерживаться мажоритарного паттерна, а не исключения.

---

## 1. Структура директорий (обязательный скелет)

```
services/<service-name>/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts                     # Entry point — process.env ТОЛЬКО здесь
│   ├── app.ts                       # createApp() — сборка плагинов
│   ├── plugins/
│   │   ├── repositories.plugin.ts   # Mongoose connect + экземпляры репозиториев
│   │   ├── services.plugin.ts       # Экземпляры сервис-классов
│   │   ├── controllers.plugin.ts    # Регистрация роутов
│   │   ├── clients.plugin.ts        # Внешние клиенты (опционально)
│   │   └── daemons.plugin.ts        # Фоновые воркеры (опционально)
│   ├── models/
│   │   ├── entity/
│   │   │   └── <name>.entity.ts     # Mongoose схема + тип (as const)
│   │   ├── validation/
│   │   │   ├── <name>.validation.ts # Elysia t.* схемы
│   │   │   └── shared.validation.ts # Переиспользуемые хелперы (опционально)
│   │   └── shared/
│   │       └── enums.model.ts       # as-const списки (опционально)
│   ├── repositories/
│   │   └── <name>.repository.ts     # CRUD слой доступа к БД
│   ├── services/
│   │   └── <name>.service.ts        # Бизнес-логика + приватные mapper'ы
│   ├── controllers/
│   │   └── <entity>/
│   │       ├── create<Entity>.controller.ts
│   │       ├── get<Entity>.controller.ts
│   │       ├── get<Entities>.controller.ts   # множественное число = список
│   │       ├── update<Entity>.controller.ts
│   │       └── delete<Entity>.controller.ts
│   ├── clients/                     # Внешние API-клиенты (опционально)
│   │   └── <name>.client.ts
│   └── daemons/                     # Фоновые воркеры (опционально)
│       └── <name>.daemon.ts
```

**Жёсткие правила:**
- Один `.ts` файл на один контроллер — никогда не пиши все роуты в одном файле.
- Контроллеры группируются по поддиректориям entity: `controllers/business/`, `controllers/pool/`.
- Имена файлов всегда в camelCase: `getBlog.controller.ts`, `createBlog.controller.ts`.

---

## 2. Сущность — `models/entity/<name>.entity.ts`

```ts
import mongoose, { Schema, Types } from 'mongoose';
import type { InferRawDocType } from 'mongoose';

const blogSchemaDefinition = {
  ownerId:     { type: String, required: true, trim: true },
  ownerType:   { type: String, required: true, trim: true },
  creator:     { type: String, required: true, trim: true },
  parentId:    { type: String, required: true, trim: true },
  grandParentId: { type: String, required: true, trim: true },
  // Поля сущности ниже
  name:        { type: String, required: true, trim: true },
  // Таймстемпы — Unix seconds, НЕ ISO строки и НЕ Date
  createdAt:   { type: Number, default: Math.floor(Date.now() / 1000) },
  updatedAt:   { type: Number, default: Math.floor(Date.now() / 1000) },
} as const;  // ← as const ОБЯЗАТЕЛЕН для корректного вывода типа

const blogSchema = new Schema(blogSchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

// Индексы — только то, что нужно для запросов
blogSchema.index({ ownerId: 1 });
blogSchema.index({ creator: 1 });

export type IBlogEntity = InferRawDocType<typeof blogSchemaDefinition> & {
  _id: Types.ObjectId;
};

export const BlogEntity = mongoose.model('Blog', blogSchema);
```

**Соглашения (отступление от них — баг):**
1. `as const` — обязательно. Без него `InferRawDocType` даёт неправильные типы.
2. Таймстемпы — **только Unix seconds (Number)**, не `Date`, не ISO-строка.  
   И в схеме `createdAt: { type: Number, ... }`, и в `timestamps: { currentTime: () => Math.floor(Date.now() / 1000) }`.
3. Поля владения — всегда присутствуют: `ownerId`, `ownerType`, `creator`, `parentId`, `grandParentId`.
4. Тип экспортируется как `I<Name>Entity` — **никогда не используй `any`** в сигнатуре entity-типа.
5. Название модели — **единственное число**: `BlogEntity`, `BusinessEntity`, `PoolEntity`.

---

## 3. Репозиторий — `repositories/<name>.repository.ts`

```ts
import { AppError } from '@shared/errors/app-errors';
import type { FilterQuery, SortOrder } from 'mongoose';
import { BlogEntity } from '../models/entity/blog.entity';
import type { IBlogEntity } from '../models/entity/blog.entity';
import { TracingDecorator } from '@shared/monitoring/src/tracingDecorator';

@TracingDecorator()
export class BlogRepository {
  constructor(private readonly model = BlogEntity) {}

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `Blog ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }

  async create(data: Pick<IBlogEntity, 'name' | 'ownerId' | 'ownerType' | 'creator' | 'parentId' | 'grandParentId'>) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<IBlogEntity, 'name'>>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new AppError({ message: `Blog ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `Blog ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return id;
  }
}
```

**Соглашения:**
1. `@TracingDecorator()` на **классе** (class-level), НЕ на каждом методе.  
   Так в 100% сервисов — `TracingDecorator` (с большой T и полным названием), из `@shared/monitoring/src/tracingDecorator`.
2. `findAll` — всегда `.lean()`. Нельзя возвращать Mongoose-документы с отслеживанием изменений.
3. `create` — `.toObject()` (Mongoose `.create()` возвращает документ с методами, `.toObject()` делает plain object).
4. `update` / `delete` / `findById` — бросают `AppError` на отсутствие документа. **Никогда** не возвращают `null`.
5. **Нет `: Promise<...>`** — TypeScript выводит тип сам. Исключение: если метод возвращает сложный композитный тип, который TS не выводит — только тогда явная аннотация.
6. Дефолтная пагинация: `limit=100`, `offset=0`, `sort={createdAt: 'asc'}`.
7. Доменные методы (`findByAddress`, `updateByAddress`) добавляются per-service по необходимости.

**Типичная ошибка:** сортировка `{ createdAt: 'asc' }` (с заглавной C).  
Правильно: `{ createdAt: 'asc' }` — поле в Mongoose называется `createdAt` (camelCase), не `createAt` и не `created_at`.

---

## 4. Сервис — `services/<name>.service.ts`

### 4.1. Приватный mapper (паттерн для ВСЕХ новых сервисов)

15 из 20 сервисов (blog, auth, documents, faq, gallery, questions, files, ai-assistant, blockchain-scanner, dao, loyalty, testnet-faucet, signer, signers-manager) повторяют inline-маппинг в каждом методе — **это антипаттерн**.  
5 сервисов (rwa, company, reactions, charts, portfolio) используют приватный mapper — **это правильный паттерн, который мы закрепляем**.

```ts
import { logger } from '@shared/monitoring/src/logger';
import { BlogRepository } from '../repositories/blog.repository';
import { PostRepository } from '../repositories/post.repository';
import type { IBlogEntity } from '../models/entity/blog.entity';
import type { SortOrder } from 'mongoose';
import { TracingDecorator } from '@shared/monitoring/src/tracingDecorator';

@TracingDecorator()
export class BlogsService {
  constructor(
    private readonly blogRepository: BlogRepository,
    private readonly postRepository: PostRepository,
  ) {}

  // ── Приватный mapper ─────────────────────────────────

  private mapBlog(blog: IBlogEntity) {  // ← параметр строго типизирован, НЕ any
    return {
      id: blog._id.toString(),
      name: blog.name,
      ownerId: blog.ownerId,
      ownerType: blog.ownerType,
      creator: blog.creator,
      parentId: blog.parentId,
      grandParentId: blog.grandParentId,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };
  }

  // ── CRUD методы ──────────────────────────────────────

  async createBlog(data: {
    name: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    logger.debug('Creating new blog', { name: data.name });
    const blog = await this.blogRepository.create(data);
    return this.mapBlog(blog);  // ← один вызов, никакого inline
  }

  async updateBlog(params: { id: string; updateData: { name: string } }) {
    logger.debug('Updating blog', params);
    const blog = await this.blogRepository.update(params.id, params.updateData);
    return this.mapBlog(blog);
  }

  async deleteBlog(id: string) {
    logger.debug('Deleting blog', { id });
    await this.blogRepository.delete(id);
    return { id };
  }

  async getBlog(id: string) {
    logger.debug('Getting blog', { id });
    const blog = await this.blogRepository.findById(id);
    return this.mapBlog(blog);
  }

  async getBlogs(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug('Getting blogs list', params);
    const blogs = await this.blogRepository.findAll(
      params.filter, params.sort, params.limit, params.offset,
    );
    return blogs.map((item) => this.mapBlog(item));
  }
}
```

**Соглашения:**
1. `@TracingDecorator()` на **классе** — не на методах.  
   Импорт: `import { TracingDecorator } from '@shared/monitoring/src/tracingDecorator'`.
2. **Логгер**: `import { logger } from '@shared/monitoring/src/logger'`.  
   **НЕ** `@shared/monitoring/src/monitoring.plugin` — так импортируют ВСЕ 20 сервисов.
3. `logger.debug()` внутри каждого метода (`'Creating new blog', { name: ... }`) — логгируем входные данные.
4. Приватный mapper: `private mapBlog(blog: IBlogEntity)` — имя `map<Entity>`, параметр строго типизирован.
5. **Нет explicit `: Promise<...>`** на возврате.
6. **Нет `setSpanAttributes`** — это используется только в сложных сервисах (rwa), не в простом CRUD.
7. **Нет дополнительных декораторов** (`@LogDecorator`, `@MetricsDecorator`) — они не применяются в 19/20 сервисов.
8. Каждый публичный метод возвращает через mapper: `return this.mapBlog(blog)`.

### 4.2. Антипаттерн — inline маппинг (так НЕ ДЕЛАЕМ)

```ts
// ❌ Inline маппинг — повторяется в каждом методе. DRY нарушен.
async getBlog(id: string) {
  const blog = await this.blogRepository.findById(id);
  return {                              // ← те же 9 полей
    id: blog._id.toString(),            //    повторяются в createBlog,
    name: blog.name,                    //    updateBlog, getBlogs
    ownerId: blog.ownerId,
    // ...
  };
}
```

---

## 5. Контроллер — `controllers/<entity>/create<Entity>.controller.ts`

```ts
import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';
import type { ServicesPlugin } from '../../plugins/services.plugin';
import {
  createBlogRequest,
  createBlogResponse,
} from '../../models/validation/blogs.validation';

export const createBlogController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'CreateBlogController' })  // ← имя для OpenTelemetry
    .use(servicesPlugin)
    .post(
      '/createBlog',
      async ({ body, blogsService }) => {
        logger.info(
          `POST /createBlog - Creating blog with name: ${body.name}`,
        );

        return await blogsService.createBlog(body);
      },
      {
        body: createBlogRequest,
        response: createBlogResponse,
      },
    );
};
```

**Соглашения:**
1. Factory-функция — `export const createBlogController = (servicesPlugin: ServicesPlugin) => { ... }`.  
   Это метод, а не класс. Принимает один аргумент — `servicesPlugin`.
   Исключения: `files/createFile.controller.ts` принимает второй параметр (`maxFileSize`).
2. Elysia instance **обязательно** с именем `{ name: 'CreateBlogController' }` — нужно для OpenTelemetry span.
3. **`logger.info("POST /path - Description ${field}")` ДО вызова сервиса** — так во всех контроллерах, кроме auth.  
   Для нового сервиса — добавляй logger.info обязательно.
4. Роут — **всегда POST**, путь в camelCase: `/createBlog`, `/getBlog`, `/updateBlog`, `/deleteBlog`, `/getBlogs`.  
   Никаких GET/PUT/DELETE/PATCH.
5. `body` и `response` — всегда указаны (валидация).
6. Контроллер — чистый pass-through: `return await service.method(body)`.  
   **Никакой бизнес-логики в контроллере** (кроме AI-генерации в rwa, где есть особые случаи).

---

## 6. Валидация — `models/validation/<name>.validation.ts`

```ts
import { t } from 'elysia';

// Базовая схема сущности (ответ)
export const blogSchema = t.Object({
  id: t.String(),
  name: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  creator: t.String(),
  parentId: t.String(),
  grandParentId: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

// Create
export const createBlogRequest = t.Pick(blogSchema, [
  'name', 'ownerId', 'ownerType', 'creator', 'parentId', 'grandParentId',
]);
export const createBlogResponse = blogSchema;

// Update
export const updateBlogRequest = t.Object({
  id: t.String(),
  updateData: t.Partial(t.Pick(blogSchema, ['name'])),
});
export const updateBlogResponse = blogSchema;

// Delete
export const deleteBlogRequest = t.Pick(blogSchema, ['id']);
export const deleteBlogResponse = t.Pick(blogSchema, ['id']);

// Get
export const getBlogRequest = t.Pick(blogSchema, ['id']);
export const getBlogResponse = blogSchema;

// Get List
export const getBlogsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal('asc'), t.Literal('desc')]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number()),
});
export const getBlogsResponse = t.Array(blogSchema);
```

**Соглашения:**
1. Базовая схема (`<name>Schema`) — единственный источник правды. Переиспользуй через `t.Pick()`, `t.Partial()`, `t.Composite()`, `t.Optional()`.
2. **Никогда не переопределяй поля вручную** — композируй из базовой схемы.
3. Списочный запрос всегда: `filter`, `sort?`, `limit?`, `offset?`.
4. Для enum/ограниченных значений — **никаких TS enum**. Используй `as const` массив + `t.Union([t.Literal('...'), ...])`.

---

## 7. Плагины — сборка слоёв

### 7a. Репозитории — `plugins/repositories.plugin.ts`

```ts
import { Elysia } from 'elysia';
import mongoose from 'mongoose';
import { BlogRepository } from '../repositories/blog.repository';
import { PostRepository } from '../repositories/post.repository';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const blogRepository = withTraceSync('blog.init.repositories.blog', () => new BlogRepository());
  const postRepository = withTraceSync('blog.init.repositories.post', () => new PostRepository());

  await withTraceAsync('blog.init.repositories_plugin.mongoose', async (ctx) => {
    mongoose.connection.once('connected', () => {
      ctx.end();
    });
    await mongoose.connect(mongoUri);
  });

  const plugin = withTraceSync('blog.init.repositories.plugin', () =>
    new Elysia({ name: 'Repositories' })
      .decorate('blogRepository', blogRepository)
      .decorate('postRepository', postRepository)
      .onStop(async () => {
        await withTraceAsync('blog.stop.repositories_plugin', async () => {
          await mongoose.disconnect();
        });
      }),
  );

  return plugin;
};

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>;
```

### 7b. Сервисы — `plugins/services.plugin.ts`

```ts
import { Elysia } from 'elysia';
import { BlogsService } from '../services/blogs.service';
import type { RepositoriesPlugin } from './repositories.plugin';
import { withTraceSync } from '@shared/monitoring/src/tracing';

export const createServicesPlugin = (repositoriesPlugin: RepositoriesPlugin) => {
  const blogsService = withTraceSync(
    'blog.init.services.blogs',
    () => new BlogsService(
      repositoriesPlugin.decorator.blogRepository,
      repositoriesPlugin.decorator.postRepository,
    ),
  );

  const plugin = withTraceSync('blog.init.services.plugin', () =>
    new Elysia({ name: 'Services' })
      .use(repositoriesPlugin)
      .decorate('blogsService', blogsService),
  );

  return plugin;
};

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>;
```

### 7c. Контроллеры — `plugins/controllers.plugin.ts`

```ts
import { Elysia } from 'elysia';
import { createBlogController } from '../controllers/blogs/createBlog.controller';
import { updateBlogController } from '../controllers/blogs/updateBlog.controller';
import { deleteBlogController } from '../controllers/blogs/deleteBlog.controller';
import { getBlogController } from '../controllers/blogs/getBlog.controller';
import { getBlogsController } from '../controllers/blogs/getBlogs.controller';
import { withTraceSync } from '@shared/monitoring/src/tracing';
import type { ServicesPlugin } from './services.plugin';

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createBlogCtrl = withTraceSync('blog.init.controllers.create_blog', () => createBlogController(servicesPlugin));
  const updateBlogCtrl = withTraceSync('blog.init.controllers.update_blog', () => updateBlogController(servicesPlugin));
  const deleteBlogCtrl = withTraceSync('blog.init.controllers.delete_blog', () => deleteBlogController(servicesPlugin));
  const getBlogCtrl    = withTraceSync('blog.init.controllers.get_blog',    () => getBlogController(servicesPlugin));
  const getBlogsCtrl   = withTraceSync('blog.init.controllers.get_blogs',   () => getBlogsController(servicesPlugin));

  const plugin = withTraceSync('blog.init.controllers.plugin', () =>
    new Elysia({ name: 'Controllers' })
      .use(createBlogCtrl)
      .use(updateBlogCtrl)
      .use(deleteBlogCtrl)
      .use(getBlogCtrl)
      .use(getBlogsCtrl),
  );

  return plugin;
};

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>;
```

**Соглашения для ВСЕХ плагинов:**
1. Каждая инстанциация оборачивается в `withTraceSync('<svc>.init.<layer>.<item>', ...)`.
2. `repositories.plugin.ts` — **async** (ждёт mongoose.connect).  
   `services.plugin.ts` и `controllers.plugin.ts` — **sync**.
3. Имена декораторов: `decorator.<name>Repository`, `decorator.<name>Service` — camelCase.
4. Декоратор называется так же как service class, но с маленькой буквы:  
   `BlogsService` → `decorator.blogsService` / в контроллере `{ body, blogsService }`.

---

## 8. Bootstrap — `app.ts`

```ts
import { Elysia } from 'elysia';
import { monitoringPlugin } from '@shared/monitoring/src/monitoring.plugin';
import { healthPlugin } from '@shared/monitoring/src/health.plugin';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createRepositoriesPlugin } from './plugins/repositories.plugin';
import { createServicesPlugin } from './plugins/services.plugin';
import { createControllersPlugin } from './plugins/controllers.plugin';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export async function createApp(port: number, mongoUri: string) {
  const repositoriesPlugin = await withTraceAsync(
    'blog.init.repositories_plugin',
    async () => await createRepositoriesPlugin(mongoUri),
  );

  const servicesPlugin = withTraceSync('blog.init.services_plugin', () =>
    createServicesPlugin(repositoriesPlugin),
  );

  const controllersPlugin = withTraceSync('blog.init.controllers_plugin', () =>
    createControllersPlugin(servicesPlugin),
  );

  const app = withTraceSync('blog.init.elysia', (ctx) => {
    const result = new Elysia()
      .use(monitoringPlugin)
      .use(healthPlugin)
      .onError(ErrorHandlerPlugin)
      .use(repositoriesPlugin)
      .use(servicesPlugin)
      .use(controllersPlugin)
      .listen(port, () => {
        ctx.end();
      });
    return result;
  });

  return app;
}
```

**Порядок плагинов (всегда такой):**
1. `monitoringPlugin` — OpenTelemetry
2. `healthPlugin` — health-check endpoint
3. `ErrorHandlerPlugin` — глобальный обработчик ошибок
4. `repositoriesPlugin`
5. `servicesPlugin`
6. `controllersPlugin`

---

## 9. Entry Point — `index.ts`

```ts
import { createApp } from './app';
import { tracer } from '@shared/monitoring/src/tracing';

const app = await tracer.startActiveSpan('blog.init.main', async (span) => {
  const appInstance = await createApp(
    Number(process.env.PORT),
    String(process.env.MONGODB_URI) + '/' + String(process.env.MONGODB_DBNAME),
  );

  span.end();
  return appInstance;
});

const shutdown = async () => {
  try {
    await app.stop();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export type App = typeof app;
```

**Правила:**
- `process.env` — **только в `index.ts`**. Ни в сервисах, ни в репозиториях, ни в контроллерах.
- Конфиги передаются аргументами в `createApp(...)`.
- SIGTERM/SIGINT: `app.stop()` → `process.exit(0|1)`.
- Весь bootstrap обёрнут в `tracer.startActiveSpan('<svc>.init.main', ...)`.

---

## 10. Enum / Ограниченные типы — `models/shared/enums.model.ts`

```ts
// ❌ Никогда не используй TypeScript `enum`
// ✅ Всегда as const + Elysia union

export const BusinessTypeList = ['growth', 'startup', 'franchise'] as const;
export const BusinessTypeSchema = t.Union([
  t.Literal('growth'),
  t.Literal('startup'),
  t.Literal('franchise'),
]);
```

Использование в entity:
```ts
import { BusinessTypeList } from '../shared/enums.model';

businessType: {
  type: String,
  enum: BusinessTypeList,
  trim: true,
},
```

---

## 11. Обработка ошибок

```ts
import { AppError, NotFoundError, NotAllowedError, ValidationError } from '@shared/errors/app-errors';

// В репозитории — DocumentNotFound → AppError
throw new AppError({ message: `Blog ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

// В сервисе — бизнес-ошибки
throw new NotAllowedError('Cannot edit while task is pending');
throw new ValidationError('Invalid pool parameters');

// Доступные классы: AppError, NotFoundError (404), NotAllowedError (403), ValidationError (400), InvalidTokenError (401)
```

Глобальный обработчик:
```ts
.onError(ErrorHandlerPlugin)  // в app.ts, из @shared/errors/error-handler.plugin
```

---

## 12. Сводка — 10 конвенций, которые нельзя нарушать

| # | Конвенция | Как в живых сервисах | Нарушители |
|---|-----------|---------------------|------------|
| 1 | **Все endpoint'ы — POST** | `.post("/camelCase", ...)` — нигде нет GET/PUT/DELETE | — |
| 2 | **`@TracingDecorator()` на классе** | Class-level, из `@shared/monitoring/src/tracingDecorator` | — |
| 3 | **Логгер из `src/logger`** | `import { logger } from "@shared/monitoring/src/logger"` | — |
| 4 | **`logger.info()` в контроллере перед вызовом сервиса** | `logger.info("POST /path - ...")` | auth (пропущено) |
| 5 | **`logger.debug()` в сервисе на входе** | `logger.debug("Action", { data })` | — |
| 6 | **Приватный mapper** | `private mapBlog(blog: IBlogEntity)` | blog, auth, documents, faq, gallery, questions, files, ai-assistant, blockchain-scanner, dao, loyalty, testnet-faucet, signer, signers-manager (15/20 — всё ещё inline) |
| 7 | **mapper parameter строго типизирован, НЕ `any`** | `mapCompany(company: any)` — нарушение | company, rwa/pool |
| 8 | **`as const` + Unix seconds timestamps** | `as const` на схеме, `Number` для createdAt/updatedAt | — |
| 9 | **`process.env` ТОЛЬКО в index.ts** | Передаётся аргументами в createApp() | — |
| 10 | **Нет `: Promise<...>`** | TS выводит типы | charts: `recordPriceData` |

---

## 13. Complete Worked Example

> **Новый сервис:** `services/products` — простой CRUD с сущностью `Product`.
>
> **Файлы для создания:**
> - `services/products/src/models/entity/product.entity.ts`
> - `services/products/src/models/validation/product.validation.ts`
> - `services/products/src/repositories/product.repository.ts`
> - `services/products/src/services/product.service.ts`
> - `services/products/src/controllers/products/createProduct.controller.ts`
> - `services/products/src/controllers/products/getProduct.controller.ts`
> - `services/products/src/controllers/products/getProducts.controller.ts`
> - `services/products/src/controllers/products/updateProduct.controller.ts`
> - `services/products/src/controllers/products/deleteProduct.controller.ts`
> - `services/products/src/plugins/repositories.plugin.ts`
> - `services/products/src/plugins/services.plugin.ts`
> - `services/products/src/plugins/controllers.plugin.ts`
> - `services/products/src/app.ts`
> - `services/products/src/index.ts`
>
> Каждый файл — по шаблонам из секций 2–9.  
> Замени `<Name>` на `Product`, `<name>` на `product`.
