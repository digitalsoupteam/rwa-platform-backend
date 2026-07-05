# CODING PATTERNS — RWA Backend

Практические паттерны кодирования для TypeScript-микросервисов (Bun + Elysia + Mongoose).
Каждый паттерн: ✅ правильно, ❌ нарушение с пояснением «Почему это плохо».

---

## 1. Именование: переменные, функции, пакеты

### Переменные — camelCase, осмысленно, без сокращений

```typescript
// ✅ CORRECT — camelCase, читаемое имя
const blogPost = await this.blogRepository.findById(id);
const userWalletAddress = body.walletAddress;

// ❌ WRONG — snake_case, бессмысленные сокращения
const blog_post = await this.blogRepository.findById(id);
const uwa = body.walletAddress;
// Почему это плохо: snake_case нарушает стиль всего проекта (везде camelCase).
// Сокращения (uwa) заставляют читателя каждый раз декодировать имя.
```

### Функции — глагол + существительное

```typescript
// ✅ CORRECT — глагол + контекст
async function createBlog(data: CreateBlogInput) { ... }
async function findUserByEmail(email: string) { ... }

// ❌ WRONG — глагол без контекста или существительное без глагола
async function handle(data: CreateBlogInput) { ... }
async function blog(data: CreateBlogInput) { ... }
// Почему это плохо: handle() — «функция-пустышка», не говорит что делает.
// blog() — существительное, не понятно: создать? получить? удалить?
```

### Пакеты/директории — kebab-case

```typescript
// ✅ CORRECT — kebab-case для директорий
services/ai-assistant/
services/blockchain-scanner/
services/testnet-faucet/

// ❌ WRONG — snake_case или camelCase для директорий
services/ai_assistant/
services/blockchainScanner/
// Почему это плохо: npm-пакеты и git-репозитории стандартно используют kebab-case.
// camelCase в именах директорий ломает case-sensitive системы при кроссплатформенной работе.
```

### Файлы — kebab-case (кроме контроллеров)

```typescript
// ✅ CORRECT
services/blog/src/models/entity/blog.entity.ts
services/blog/src/repositories/post.repository.ts
services/blog/src/services/blogs.service.ts

// Контроллеры — camelCase с именем entity (исключение, так исторически сложилось)
services/blog/src/controllers/blogs/createBlog.controller.ts

// ❌ WRONG — mix-case или PascalCase
services/blog/src/Services/BlogsService.ts
services/Blog/src/controllers/blogs/create_blog.controller.ts
// Почему это плохо: нарушает единый поисковый паттерн.
// Ctrl+P (VS Code) ищет по kebab-case, а PascalCase-файлы не находятся.
```

---

## 2. Обработка ошибок: проверка, обёртывание, логирование

### Проверки — guard clause, не if-else пирамида

```typescript
// ✅ CORRECT — guard clause: ранний выход
async getBlog(id: string) {
  const doc = await this.blogRepository.findById(id);
  if (!doc) {
    throw new AppError({ message: `Blog ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
  }
  return doc;
}

// ❌ WRONG — вложенный if-else
async getBlog(id: string) {
  const doc = await this.blogRepository.findById(id);
  if (doc) {
    return doc;
  } else {
    throw new AppError({ message: `Blog ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
  }
}
// Почему это плохо: else не нужен, когда if делает return/throw.
// Вложенность усложняет чтение — глаз скачет по скобкам.
```

### Ошибки — AppError / предопределённые классы, не raw Error

```typescript
// ✅ CORRECT — доменные классы ошибок
import { AppError, NotFoundError, ValidationError } from '@shared/errors/app-errors';

throw new NotFoundError(`Blog ${id} not found`);
throw new ValidationError('Invalid pool parameters');

// ❌ WRONG — raw Error без статус-кода
throw new Error('Blog not found');
// Почему это плохо: ErrorHandlerPlugin не может маппить raw Error в HTTP-ответ.
// Клиент получит 500 Internal Server Error вместо 404.
```

### Обёртывание — не теряй оригинальную ошибку, но не дублируй

```typescript
// ✅ CORRECT — проброс с контекстом (AppError сам хранит cause)
try {
  await this.externalApi.call(data);
} catch (error) {
  throw new AppError({
    message: 'External API call failed',
    statusCode: 502,
    code: 'EXTERNAL_API_ERROR',
    cause: error,          // ← оригинал не потерян
  });
}

// ❌ WRONG — глухое проглатывание
try {
  await this.externalApi.call(data);
} catch {
  throw new AppError({ message: 'Failed', statusCode: 502, code: 'ERR' });
}
// Почему это плохо: без cause и конкретного сообщения невозможно понять,
// какая именно API упала и с какой ошибкой.
```

### Логирование — логируй на входе в сервис, не дублируй на всех уровнях

```typescript
// ✅ CORRECT — один logger.debug() в сервисе, один logger.info() в контроллере
// Контроллер:
logger.info('POST /createBlog - name: ' + body.name);
const result = await blogsService.createBlog(body);

// Сервис:
async createBlog(data: CreateBlogInput) {
  logger.debug('Creating new blog', { name: data.name });
  return this.mapBlog(await this.blogRepository.create(data));
}

// ❌ WRONG — то же самое логирование в репозитории (не нужно)
async create(data: CreateBlogInput) {
  logger.debug('Creating blog in DB', { name: data.name });  // ← дубль
  return (await this.model.create(data)).toObject();
}
// Почему это плохо: логи на 3 уровнях — шум. Репозиторий отвечает за CRUD,
// логирование — забота сервиса. Репозиторий не должен знать про бизнес-контекст.
```

---

## 3. Форматирование и стиль

### Инструмент — `bun run format`

```bash
# ✅ CORRECT — проект форматируется одной командой
$ bun run format     # prettier + сортировка импортов

# ❌ WRONG — ручное форматирование
# «У меня свой стиль: фигурные скобки на новой строке»
# Почему это плохо: git diff показывает hundred строк «форматирующего мусора»
# при каждом коммите. Строка на ревью бессмысленно меняет цвет.
```

### Импорты — фиксированный порядок

```typescript
// ✅ CORRECT — стандартный импорт → type-import → relative
import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';
import type { FilterQuery, SortOrder } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';
import { BlogEntity } from '../models/entity/blog.entity';
import type { IBlogEntity } from '../models/entity/blog.entity';
import { TracingDecorator } from '@shared/monitoring/src/tracingDecorator';

// ❌ WRONG — хаотичный порядок
import { BlogEntity } from '../models/entity/blog.entity';
import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';
// Почему это плохо: глаз тратит время на поиск конкретного импорта.
// Предсказуемый порядок (third-party → shared → relative) — как алфавитный указатель.
```

### Фигурные скобки — `{ name }` деконструкция параметров

```typescript
// ✅ CORRECT — деконструкция в сигнатуре
async updateBlog({ id, updateData }: { id: string; updateData: Partial<IBlog> }) { ... }

// ❌ WRONG — параметром и деконструкция внутри
async updateBlog(params: { id: string; updateData: Partial<IBlog> }) {
  const { id, updateData } = params;
  // ...
}
// Почему это плохо: лишняя переменная params, лишняя строка деструктуризации.
// Nothing gained, one more line to read.
```

### Пустые строки — разделители между секциями

```typescript
// ✅ CORRECT — пустая строка между импортами, типом, классом
import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';

export type Options = { ... };

export class BlogService { ... }

// ❌ WRONG — всё слиплось
import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';
export type Options = { ... };
export class BlogService { ... }
// Почему это плохо: нет визуальных якорей. Глаз не цепляется за границы секций.
// Как текст без абзацев — читать тяжело.
```

---

## 4. Работа со строками и путями — защитное программирование

### Угловые скобки `<>` в именах — реальная проблема Windows/bash

```typescript
// 🚨 ПРОБЛЕМА: угловые скобки в именах каталогов/файлов
//
// На Windows через git-bash (MSYS) угловые скобки интерпретируются
// shell'ом как перенаправление ввода-вывода.
//
// Пример бага:
//   mkdir "my<project>"     # → создаёт каталог "my" и файл "project>"
//   ls my<project>          # → ls my project>  — ошибка
//
// В самом TypeScript-коде угловые скобки — операторы сравнения/дженерики:
//   const x = arr[0] < 5 ? a : b;   // OK — сравнение
//   const x = arr<number>;           // TS error — оно думает это JSX

// ✅ CORRECT — имена путей только из безопасных символов [a-zA-Z0-9._-]
const SERVICE_NAME = 'ai-assistant';     // безопасно
const DIR_NAME = 'services/ai-assistant'; // безопасно

// ❌ WRONG — угловые скобки в именах
const DIR_NAME = 'services/<project>';    // → shell видит перенаправление
// Почему это плохо: mkdir / rm / ls / git add — все команды ломаются.
// shell пытается открыть файл `project>` на запись вместо создания каталога.
// На Windows через git-bash это гарантированный баг.
```

### Пробелы в путях — всегда кавычки

```typescript
// 🚨 ПРОБЛЕМА: пробелы в именах — разделитель аргументов shell
//
//   mkdir My Project          # → создаёт два каталога: My и Project
//   ls /c/Users/My Project/   # → ls: cannot access '/c/Users/My': No such file or directory

// ✅ CORRECT — избегай пробелов в именах, но если пришло извне — обрамляй кавычками
const path = '/c/Users/My Project/file.txt';
const cmd = `ls "${path}"`;         // ← кавычки обязательны

// ❌ WRONG — путь с пробелом без кавычек
const cmd = `ls ${path}`;           // → ls /c/Users/My Project/file.txt — ломается
// Почему это плохо: shell интерпретирует пробел как разделитель аргументов.
// Результат: команда падает с «No such file or directory» на части пути.
```

### Спецсимволы в shell-командах — экранирование

```typescript
// ✅ CORRECT — экранирование shell-спецсимволов
// $, `, ", ', \, !, (), [], {}, *, ?, &, |, ;, #, ~
import { quote } from 'shell-quote';  // или shlex.quote() в Python

const safePath = quote([userInput]);  // ← экранирует всё опасное
terminal(`ls ${safePath}`);

// ❌ WRONG — интерполяция пользовательского ввода напрямую
terminal(`ls ${userInput}`);
// Почему это плохо: userInput с содержимым `; rm -rf /` удалит проект.
// Даже без злого умысла: имя файла с `$HOME` раскроется в переменную окружения.
```

### Конкатенация путей — path.join / URL, не строки

```typescript
// ✅ CORRECT — path.join / new URL()
import path from 'path';
const fullPath = path.join('/base', 'sub', 'file.txt');
// → /base/sub/file.txt  (правильный разделитель для OS)

const url = new URL('/api/v1/blogs', 'https://example.com').toString();
// → https://example.com/api/v1/blogs

// ❌ WRONG — ручная конкатенация
const fullPath = '/base/' + 'sub' + '/' + 'file.txt';
const url = 'https://example.com' + '/api/v1' + '/blogs';
// Почему это плохо: на Windows разделитель `\`, ручная склейка выдаёт `\` + `/`.
// С URL: двойные слеши, забытые слеши — трудноуловимые баги.
```

### Строки в шаблонных литералах — всегда шаблон, не конкатенация

```typescript
// ✅ CORRECT — шаблонные литералы
const msg = `Blog ${id} not found`;
const logMsg = `POST /${path} - userId: ${body.userId}`;

// ❌ WRONG — конкатенация через +
const msg = 'Blog ' + id + ' not found';
const logMsg = 'POST /' + path + ' - userId: ' + body.userId;
// Почему это плохо: + легко забыть или поставить не туда.
// Шаблонные литералы читаются как единое целое и поддерживают многострочность.
```

---

## 5. Комментирование и документация кода

### JSDoc — только для публичного API, не для внутренностей

```typescript
// ✅ CORRECT — JSDoc на экспортируемых функциях/классах

/**
 * Создаёт новый блог для пользователя.
 * Валидирует ownerType и проверяет лимит блогов на пользователя.
 *
 * @param data - входные данные блога (name, ownerId, ownerType, ...)
 * @returns созданный блог в формате ответа
 * @throws {ValidationError} если ownerType недопустим
 */
async createBlog(data: CreateBlogInput) { ... }

// ❌ WRONG — JSDoc на тривиальных внутренних методах

/** Returns the sum of a and b. Who could have guessed. */
private add(a: number, b: number) { return a + b; }
// Почему это плохо: комментарий не несёт информации сверх сигнатуры.
// Поддерживать такой комментарий — лишняя работа; он устаревает и вводит в заблуждение.
```

### Комментарии — «почему», не «что»

```typescript
// ✅ CORRECT — пояснение причины нетривиального решения

// Используем Math.floor(Date.now() / 1000), а не Date, потому что
// все смарт-контракты в экосистеме работают в Unix seconds.
createdAt: { type: Number, default: Math.floor(Date.now() / 1000) },

// ✅ CORRECT — предупреждение о хрупком коде

// ⚠️ Поле не nullable в БД, но после .populate() может быть null.
// См. mongoose#12345 — обрабатываем через ?? undefined.
ownerType: body.ownerType ?? undefined,

// ❌ WRONG — комментарий пересказывает код

// Increment counter by 1
counter += 1;
// Почему это плохо: код говорит «counter += 1» на том же языке.
// Комментарий полезен, когда объясняет ПОЧЕМУ, а не ЧТО.
```

### TODO/FIXME — с issue-ссылкой или именем

```typescript
// ✅ CORRECT — todo с трекером и контекстом

// TODO(#452): переписать на batch-insert после миграции MongoDB 7
// FIXME(@alex): ownerId приходит как Number из chain-listener, баг на стыке

// ❌ WRONG — глухой TODO без контекста

// TODO: fix this later
// TODO: refactor
// Почему это плохо: «fix this later» никогда не фиксится.
// Конкретный тикет или имя — обязательство. «Refactor» без причины — шум.
```

### Избыточные блоки — лишние `return` в однострочных стрелках

```typescript
// ✅ CORRECT — неявный return в однострочных стрелках
const names = blogs.map((b) => b.name);
const ids = blogs.map((b) => b._id.toString());

// ❌ WRONG — явный return и фигурные скобки на одну строку
const names = blogs.map((b) => { return b.name; });
// Почему это плохо: лишний return + {} не добавляют ясности,
// только увеличивают файл на 40% символов.
```

---

## 6. Сводная таблица

| # | Паттерн | Правильно | Нарушение | Почему плохо |
|---|---------|-----------|-----------|--------------|
| 1 | Имена переменных | `camelCase` | `snake_case` / сокращения | Ломает единый стиль и читаемость |
| 2 | Имена директорий | `kebab-case` | `camelCase` / `snake_case` | Проблемы case-sensitive и npm |
| 3 | Guard clause | if + throw/return | if-else вложенный | Лишняя вложенность |
| 4 | Тип ошибки | `AppError` / `NotFoundError` | `new Error(...)` | HTTP код 500 вместо 404 |
| 5 | Пути с `<>` | избегать в именах | `<project>` в mkdir | Shell redirection — баг |
| 6 | Пробелы в путях | кавычки всегда | голая интерполяция | Shell разделяет аргументы |
| 7 | User input в shell | `shell-quote` | прямая интерполяция | RCE / потеря данных |
| 8 | Конкатенация путей | `path.join()` | `+` склейка | Разделители OS |
| 9 | TODO | с тикетом (#452) | без контекста | Никогда не фиксится |
| 10 | Шаблонные строки | `` `...${var}` `` | `'...' + var + '...'` | Легко ошибиться с + |

---

*Последнее обновление: 2026-07-05*
*Основано на живом коде 20 микросервисов RWA Backend и реальных багах в CI/CD.*
