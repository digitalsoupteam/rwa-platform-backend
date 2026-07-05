# Архитектурные паттерны RWA Backend

**Проект:** RWA Platform (Bun/TypeScript/Elysia монорепо)
**Дата:** 2026-07-05
**Назначение:** Чеклист для code review — ревьюер может точечно проверить каждый паттерн.

---

## Паттерн 1. Plugin-Based Dependency Injection

### Описание
Внедрение зависимостей строится через цепочку Elysia-плагинов. Каждый плагин регистрирует свои экземпляры через `.decorate()`, следующий плагин получает их через `plugin.decorator.*`. Никакого глобального контейнера или `new` вручную — зависимости проводятся строго сверху вниз.

Порядок инициализации фиксирован:
```
index.ts → app.ts → repositories.plugin → services.plugin → controllers.plugin
```

**Почему это важно:** Плагины изолированы, легко тестируются (каждый плагин можно заменить моком), порядок инициализации гарантирован TypeScript типизацией декораторов.

### ✅ Хорошо — цепочка через `.decorate()`
```ts
// repositories.plugin.ts
export const repositoriesPlugin = new Elysia({ name: "RepositoriesPlugin" })
  .decorate("blogRepository", new BlogRepository(mongoose.model("Blog", blogSchema)))
  .decorate("postRepository", new PostRepository(mongoose.model("Post", postSchema)));

// services.plugin.ts — получает репозитории через .use()
export const servicesPlugin = new Elysia({ name: "ServicesPlugin" })
  .use(repositoriesPlugin)
  .decorate("blogService", new BlogService(
    repositoriesPlugin.decorator.blogRepository,
    repositoriesPlugin.decorator.postRepository
  ));

// controllers.plugin.ts — получает сервисы
export const controllersPlugin = new Elysia({ name: "ControllersPlugin" })
  .use(servicesPlugin)
  .use(createBlogController(servicesPlugin))
  .use(getBlogController(servicesPlugin));
```

### ❌ Плохо — ручное конструирование и синглтоны
```ts
// ❌ Антипаттерн: глобальные синглтоны и ручное конструирование
const blogRepository = new BlogRepository();  // где connection?
const blogService = new BlogService();         // blogService.blogRepository = null
const app = new Elysia()
  .decorate("blogService", blogService)        // нет гарантии порядка
  .post("/getBlog", ({ body }) => blogService.getBlog(body));
```
**Чем плохо:** Нет гарантии, что зависимости проинициализированы. Репозиторий создаётся без mongoose-connection. Синглтоны живут в модульном скоупе, не поддаются мокированию в тестах. При перезапуске плагина в тесте состояние синглтона «протекает» между тестами.

**Как исправить:** Заменить на цепочку `.use()` → `.decorate()`. Если нужен мок — замокать целый плагин через `.use(mockPlugin)`.

---

## Паттерн 2. Слоистая архитектура (Layered Architecture)

### Описание
Каждый сервис состоит из строго 4–5 слоёв, которые НЕ прыгают через уровень:

```
┌─────────────────────────────────────┐
│  index.ts / app.ts  (Bootstrap)     │  ← process.env, createApp(), listen()
├─────────────────────────────────────┤
│  Controllers (Route Handlers)       │  ← только логирование + вызов сервиса
├─────────────────────────────────────┤
│  Services (Business Logic)          │  ← валидация, маппинг, вызовы репозиториев
├─────────────────────────────────────┤
│  Repositories (Data Access)         │  ← Mongoose CRUD, NotFoundError
├─────────────────────────────────────┤
│  Models / Entities (Schema)         │  ← as-const схемы, Elysia t.* валидация
└─────────────────────────────────────┘
```

**Ключевое правило:** Services не импортирует модели напрямую. Controllers не вызывает репозитории. Bootstrap слой не содержит бизнес-логики.

**Почему это важно:** Каждый слой можно тестировать изолированно. Замена БД (Mongoose → Prisma) затрагивает только репозитории. Контроллеры остаются плоскими — это делает код предсказуемым.

### ✅ Хорошо — строгое разделение
```ts
// Controller — только вызов сервиса
.post("/getBlog", async ({ body, blogService }) => {
  logger.info("POST /getBlog");
  return await blogService.getBlog(body);
});

// Service — бизнес-логика + маппинг
async getBlog(body: GetBlogRequest): Promise<GetBlogResponse> {
  const blog = await this.blogRepository.findById(body.id);
  return this.mapBlog(blog);
}

// Repository — только CRUD
async findById(id: string): Promise<IBlogEntity> {
  const doc = await this.model.findById(id).lean();
  if (!doc) throw new NotFoundError("Blog", id);
  return doc;
}
```

### ❌ Плохо — прыжки через слой
```ts
// ❌ Антипаттерн: Controller лезет в Repository напрямую
.post("/getBlog", async ({ body }) => {
  const blog = await BlogModel.findById(body.id).lean(); // ← controller знает про ORM
  return { id: blog._id.toString(), name: blog.name };
});
```
**Чем плохо:** Смена ORM (Mongoose → Drizzle) ломает все контроллеры. Логика маппинга дублируется в каждом контроллере. Невозможно замокать слой данных в тестах, не запуская БД.

**Как исправить:** Вынести обращение к БД в репозиторий, маппинг — в сервис. Контроллер получает готовый ответ от сервиса.

---

## Паттерн 3. Controller Factory + POST-Only Endpoints

### Описание
Каждый контроллер — фабричная функция, принимающая `servicesPlugin` и возвращающая `new Elysia({ name })` со ровно одним `.post()` роутом.

```ts
export const getBlogController = (servicesPlugin: ServicesPlugin) =>
  new Elysia({ name: "GetBlogController" })
    .use(servicesPlugin)
    .post("/getBlog", async ({ body, blogService }) => {
      logger.info("POST /getBlog");
      return await blogService.getBlog(body);
    }, { body: GetBlogRequest, response: GetBlogResponse });
```

**Почему это важно:** Один файл = один роут = легко найти, легко замокать. POST-only исключает REST-неоднозначность (GET с телом, PUT идемпотентность и т.д.). Каждый файл контроллера проверяется изолированно — ревьюер видит роут, валидацию и хендлер в 10 строках.

### ✅ Хорошо — atom-контроллеры
Структура директорий: `controllers/entity/createEntity.controller.ts`, `getEntity.controller.ts`, `getEntities.controller.ts`, `updateEntity.controller.ts`, `deleteEntity.controller.ts`. Каждый файл содержит ровно одну фабрику.

### ❌ Плохо — монолитный контроллер
```ts
// ❌ Антипаттерн: все роуты в одном файле
export const blogController = (servicesPlugin: ServicesPlugin) =>
  new Elysia({ name: "BlogController" })
    .use(servicesPlugin)
    .post("/createBlog", async ({ body, blogService }) => { ... })
    .post("/getBlog", async ({ body, blogService }) => { ... })
    .post("/getBlogs", async ({ body, blogService }) => { ... })
    .post("/updateBlog", async ({ body, blogService }) => { ... })
    .post("/deleteBlog", async ({ body, blogService }) => { ... });
```
**Чем плохо:** Файл растёт до 100+ строк. Конфликты merge — два разработчика правят `blogController` одновременно. Невозможно заменить один роут моком в тесте, не поднимая весь контроллер. git blame показывает один и тот же файл для всех роутов.

**Как исправить:** Разбить на отдельные файлы: `createBlog.controller.ts`, `getBlog.controller.ts` и т.д. Каждый импортируется в `controllers.plugin.ts` через `.use(...)`.

---

## Паттерн 4. Repository CRUD Contract + NotFoundError

### Описание
Каждый репозиторий реализует единый контракт из 5 методов. Единообразие гарантирует, что любой сервис может положиться на сигнатуру.

```
findById(id)    → T throws NotFoundError если нет
findAll(filter) → T[] defaults: {}, {createdAt:"asc"}, 100, 0
create(data)    → T (возвращает toObject())
update(id,data) → T throws NotFoundError, new:true + lean()
delete(id)      → T throws NotFoundError, возвращает удалённый документ
```

**Почему это важно:** Сервис не проверяет `if (!doc)` — это делает репозиторий. Все ошибки «не найдено» унифицированы и обрабатываются глобальным `.onError(ErrorHandlerPlugin)`. Если появляется новый метод (findByAddress, updateByAddress), он наследует ту же стратегию — бросает `NotFoundError` при отсутствии.

### ✅ Хорошо — единый контракт
```ts
async findById(id: string): Promise<IBlogEntity> {
  const doc = await this.model.findById(id).lean();
  if (!doc) throw new NotFoundError("Blog", id);
  return doc;
}

async findAll(filter: FilterQuery<IBlogEntity> = {},
              sort: SortOrder = { createdAt: "asc" },
              limit = 100, offset = 0): Promise<IBlogEntity[]> {
  return this.model.find(filter).sort(sort).limit(limit).skip(offset).lean();
}
```

### ❌ Плохо — разный стиль в каждом репозитории
```ts
// ❌ Антипаттерн: каждый репозиторий обрабатывает отсутствие по-своему
async findById(id: string) {
  const doc = await this.model.findById(id);
  if (!doc) return null;                  // ← возвращает null, не кидает ошибку
}

async getById(id: string) {
  return this.model.findById(id);         // ← другое имя метода
}

async delete(id: string) {
  const result = await this.model.findByIdAndDelete(id);
  return result !== null;                 // ← возвращает boolean
}
```
**Чем плохо:** Сервис вынужден писать `const blog = await repo.findById(id); if (!blog) throw ...` в каждом методе. Ошибка «не найдено» может быть не обработана вовсе — приходит 500 вместо 404. Разные имена методов (`findById` vs `getById`) заставляют заглядывать в каждый репозиторий.

**Как исправить:** Привести к единому контракту: `findById` бросает `NotFoundError`, `findAll` возвращает массив (возможно пустой), `create/update/delete` следуют same-signature.

---

## Паттерн 5. Safe Path & Filename Escaping

### Описание
Любой код, работающий с пользовательскими именами файлов, директорий или slug-значениями, ДОЛЖЕН явно экранировать или валидировать ввод через утверждённый список разрешённых символов.

**Почему это важно:** В проекте встречаются имена с угловыми скобками, спецсимволами и пробелами. Прямая подстановка в `fs.*`, shell-команды или URL приводит к path traversal, command injection или поломке файловой системы на Windows (где `<`, `>`, `"`, `|`, `?`, `*` запрещены в именах файлов).

### ✅ Хорошо — санитайзинг через allowlist
```ts
const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]+$/;

function safeFilename(input: string): string {
  const sanitized = input.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  // Дополнительно: обрезаем до лимита ФС и убираем точки в начале (скрытые файлы)
  return sanitized.replace(/^\.+/, '').slice(0, 255) || 'unnamed';
}
```

### ❌ Плохо — прямая подстановка в пути
```ts
// ❌ Антипаттерн: имя подставлено как есть
const filePath = `/uploads/${req.body.name}`;     // name = "../../etc/passwd"
const filePath = `uploads/${category}/${filename}`; // filename = "foo<bar>.txt"
const cmd = `convert ${input} ${output}`;           // input = "file; rm -rf /"
```
**Чем плохо:** Path traversal — пользователь может прочитать/перезаписать любой файл на сервере. Спецсимволы в имени (`<`, `>`, `"`) ломают на Windows. Команды с пробелами в имени файла ломают shell — возможна command injection при вызове `exec()`.

**Как исправить:**
1. Завести функцию `safeFilename(input)` с allowlist-регуляркой (разрешены только `[a-zA-Z0-9._-]`).
2. Никогда не подставлять пользовательский ввод в shell-команды — использовать `spawn()` с аргументами-массивами.
3. Для URL-путей — дополнительно `encodeURIComponent(name)`.
4. Всегда проверять, что итоговый резолвнутый путь начинается с разрешённой базовой директории (`path.resolve(base, safe)`.startsWith(base)).

---

## Паттерн 6. Bootstrap — process.env Только в index.ts

### Описание
`process.env` читается строго в `src/index.ts`. Значения передаются в `createApp(port, mongoUri, jwtSecret, ...)`. Нигде в плагинах, сервисах, репозиториях или контроллерах `process.env` не встречается.

**Почему это важно:** Все переменные окружения видны в одном файле — никакой магии «а откуда берётся MONGO_URI». Тесты не зависят от реальных env-переменных. При добавлении новой переменной не нужно искать по всему проекту.

### ✅ Хорошо
```ts
// src/index.ts
const { SERVICE_NAME, PORT, MONGO_URI } = process.env;
const app = await createApp(Number(PORT), MONGO_URI);
app.listen();

// src/app.ts
export const createApp = (port: number, mongoUri: string) => { ... };
```

### ❌ Плохо
```ts
// ❌ Антипаттерн: process.env размазан по проекту
// services/example/src/services/example.service.ts
const apiKey = process.env.API_KEY;  // ← кто его передал? где документирован?
```
**Чем исправить:** Перенести `process.env.API_KEY` в `index.ts`, передать параметром в `createApp()`, прокинуть через плагин-декоратор до сервиса.

---

## Паттерн 7. Private Mapper Methods

### Описание
Сервисы, возвращающие DTO, должны иметь приватный метод-мэппер для преобразования entity → response, а не повторять inline-маппинг в каждом методе.

**Почему это важно:** Inline-маппинг нарушает DRY. При добавлении поля в сущность нужно править 3–5 методов в сервисе. Private mapper локализует изменения в одном месте.

### ✅ Хорошо
```ts
private mapBlog(blog: IBlogEntity): IBlogResponse {
  return {
    id: blog._id.toString(),
    name: blog.name,
    ownerId: blog.ownerId,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
  };
}

async getBlog(id: string): Promise<IBlogResponse> {
  return this.mapBlog(await this.blogRepository.findById(id));
}

async getBlogs(filter): Promise<IBlogResponse[]> {
  const blogs = await this.blogRepository.findAll(filter);
  return blogs.map(b => this.mapBlog(b));
}
```

### ❌ Плохо
```ts
// ❌ Антипаттерн: маппинг повторяется в каждом методе
async getBlog(id: string) {
  const blog = await this.blogRepository.findById(id);
  return { id: blog._id.toString(), name: blog.name, /* ... */ };
}

async getBlogs(filter) {
  const blogs = await this.blogRepository.findAll(filter);
  return blogs.map(b => ({ id: b._id.toString(), name: b.name, /* ... */ }));
  //                               тот же самый маппинг повторён
}
```
**Чем исправить:** Выделить `private mapBlog(blog)` — один метод, используемый во всех публичных методах.

---

## Приложение: Quick Reference для ревьюера

| # | Паттерн | Что проверять | Критичность |
|---|---------|---------------|-------------|
| 1 | Plugin DI | Есть ли `.use(prevPlugin).decorate(...)`? Нет ли `new X()` без плагина? | 🔴 |
| 2 | Layered | Controller не вызывает Repository? Service не импортирует Model? | 🔴 |
| 3 | Controller Factory | 1 файл = 1 роут? Имя `{verb}{Entity}.controller.ts`? | 🟡 |
| 4 | Repository CRUD | `findById` кидает `NotFoundError`? Сигнатуры совпадают? | 🔴 |
| 5 | Safe Filename | Пользовательский ввод в `fs.*` проходит санитайзинг? | 🔴 |
| 6 | process.env | Есть ли `process.env` вне `index.ts`? | 🟡 |
| 7 | Private Mapper | Inline-маппинг повторяется, а не вынесен в `private` метод? | 🟢 |
