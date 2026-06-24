# Questions service — Observability Reference

Сервис **вопросов и обсуждений** (Q&A, топики, лайки). Реализует CRUD по
`Topic` (топик обсуждения), `Question` (вопрос с опциональным ответом) и
`QuestionLike` (лайк пользователя на вопрос). Каскадное удаление вопросов
при удалении топика. Подсчёт лайков — инкремент/декремент на `Question.likesCount`.

- **SERVICE_NAME:** `questions` (Prometheus/OTel prefix)
- **Stack:** Bun + Elysia.js 1.3.5 + Mongoose 8.16.4
- **Слои:** repositories → services → controllers (DI через Elysia-плагины)
- **Порт:** `${QUESTIONS_PORT}` (env)
- **MongoDB:** `${QUESTIONS_MONGODB_DBNAME}` (env)
- **В docker-compose:** да (`infrastructure/docker/docker-compose.yml`)
- **Клиенты (внешние интеграции):** нет
- **Daemons (фоновые процессы):** нет
- **RabbitMQ:** не используется (auto-instrumentation включена, но спаны не создаются)

---

## 1. Трейсы (Spans)

### 1.1. Init — startup sequence

| Span name | Где создаётся | Длительность | Дочерние | Зачем |
|-----------|---------------|-------------|----------|-------|
| `questions.init.main` | `src/index.ts` (root `tracer.startActiveSpan`) | всё время старта | всё ниже | Корневой init-span всего сервиса |
| `questions.init.repositories_plugin` | `src/app.ts` | MongoDB connect + создание 3 репозиториев | `questions.init.repositories.topic`, `questions.init.repositories.question`, `questions.init.repositories.questionLikes`, `questions.init.repositories_plugin.mongoose`, `questions.init.repositories.plugin` | Фаза DI для слоя репозиториев |
| `questions.init.services_plugin` | `src/app.ts` | инстанцирование `QuestionsService` | `questions.init.services.questions`, `questions.init.services.plugin` | Фаза DI для слоя сервисов |
| `questions.init.controllers_plugin` | `src/app.ts` | инстанцирование 13 контроллеров | 13 `questions.init.controllers.<op>` + `questions.init.controllers.plugin` | Фаза DI для слоя контроллеров |
| `questions.init.elysia` | `src/app.ts` | `new Elysia().use(...).listen(port)` | — | Сборка Elysia-приложения и поднятие HTTP-сервера |
| `questions.init.repositories.topic` | `src/plugins/repositories.plugin.ts` | `new TopicRepository()` | — | Конструирование TopicRepository |
| `questions.init.repositories.question` | `src/plugins/repositories.plugin.ts` | `new QuestionRepository()` | — | Конструирование QuestionRepository |
| `questions.init.repositories.questionLikes` | `src/plugins/repositories.plugin.ts` | `new QuestionLikesRepository()` | — | Конструирование QuestionLikesRepository |
| `questions.init.repositories_plugin.mongoose` | `src/plugins/repositories.plugin.ts` | `mongoose.connect(mongoUri)` | — | Подключение к MongoDB (resolve на `connected`) |
| `questions.init.repositories.plugin` | `src/plugins/repositories.plugin.ts` | `.decorate(...)` × 3 | — | Elysia-обёртка с `decorate(topicRepository/questionRepository/questionLikesRepository)` |
| `questions.init.services.questions` | `src/plugins/services.plugin.ts` | `new QuestionsService(...)` | — | Инстанцирование единственного сервиса |
| `questions.init.services.plugin` | `src/plugins/services.plugin.ts` | `.decorate("questionsService", ...)` | — | Elysia-обёртка с DI |
| `questions.init.controllers.create_topic` | `src/plugins/controllers.plugin.ts` | `createTopicController(...)` | — | Init-обёртка контроллера CreateTopicController |
| `questions.init.controllers.update_topic` | `src/plugins/controllers.plugin.ts` | `updateTopicController(...)` | — | Init-обёртка контроллера UpdateTopicController |
| `questions.init.controllers.delete_topic` | `src/plugins/controllers.plugin.ts` | `deleteTopicController(...)` | — | Init-обёртка контроллера DeleteTopicController |
| `questions.init.controllers.get_topic` | `src/plugins/controllers.plugin.ts` | `getTopicController(...)` | — | Init-обёртка контроллера GetTopicController |
| `questions.init.controllers.get_topics` | `src/plugins/controllers.plugin.ts` | `getTopicsController(...)` | — | Init-обёртка контроллера GetTopicsController |
| `questions.init.controllers.create_question` | `src/plugins/controllers.plugin.ts` | `createQuestionController(...)` | — | Init-обёртка контроллера CreateQuestionController |
| `questions.init.controllers.update_question_text` | `src/plugins/controllers.plugin.ts` | `updateQuestionTextController(...)` | — | Init-обёртка контроллера UpdateQuestionTextController |
| `questions.init.controllers.create_question_answer` | `src/plugins/controllers.plugin.ts` | `createQuestionAnswerController(...)` | — | Init-обёртка контроллера CreateQuestionAnswerController |
| `questions.init.controllers.update_question_answer` | `src/plugins/controllers.plugin.ts` | `updateQuestionAnswerController(...)` | — | Init-обёртка контроллера UpdateQuestionAnswerController |
| `questions.init.controllers.delete_question` | `src/plugins/controllers.plugin.ts` | `deleteQuestionController(...)` | — | Init-обёртка контроллера DeleteQuestionController |
| `questions.init.controllers.get_question` | `src/plugins/controllers.plugin.ts` | `getQuestionController(...)` | — | Init-обёртка контроллера GetQuestionController |
| `questions.init.controllers.get_questions` | `src/plugins/controllers.plugin.ts` | `getQuestionsController(...)` | — | Init-обёртка контроллера GetQuestionsController |
| `questions.init.controllers.toggle_question_like` | `src/plugins/controllers.plugin.ts` | `toggleQuestionLikeController(...)` | — | Init-обёртка контроллера ToggleQuestionLikeController |
| `questions.init.controllers.plugin` | `src/plugins/controllers.plugin.ts` | `.use(...)` × 13 | — | Elysia-обёртка, регистрирующая все роуты |

_Итого init-span-ов (literal `withTrace*` + `startActiveSpan`): 27._

### 1.2. Shutdown

| Span name | Где создаётся | Когда | Зачем |
|-----------|---------------|-------|-------|
| `questions.stop.repositories_plugin` | `src/plugins/repositories.plugin.ts` (внутри `.onStop(async () => ...)`) | `SIGTERM`/`SIGINT` → `app.stop()` → `onStop` хук плагина репозиториев | `await mongoose.disconnect()` |

_Shutdown оборачивает только `mongoose.disconnect()`. Контроллеры, сервис и
прочие плагины — без явного shutdown-span'а (Elysia-плагины для них его не
объявляют). См. §5 «Краткий чек-лист при дебаге» — пункт про SIGTERM._

### 1.3. Runtime — бизнес-методы

#### `QuestionsService` — span prefix: questions_service

| Span name | Атрибуты span | HTTP endpoint / откуда вызывается | Запросы к БД/сети | Ошибки |
|-----------|--------------|----------------------------------|-------------------|--------|
| `questions_service.toggle_like` | _не заданы явно_ | `POST /toggleQuestionLike` (`toggleQuestionLikeController`) | `questionLikesRepository.exists`, `questionLikesRepository.delete`, `questionRepository.decrement_likes` или `questionLikesRepository.create` + `questionRepository.increment_likes` | `NotFoundError` (если лайк для удаления не найден) |
| `questions_service.create_topic` | _не заданы явно_ | `POST /createTopic` (`createTopicController`) | `topicRepository.create` | (нет бизнес-ошибок; NotFoundError только в update/delete/findById) |
| `questions_service.update_topic` | _не заданы явно_ | `POST /updateTopic` (`updateTopicController`) | `topicRepository.update` | `NotFoundError("Topic", id)` |
| `questions_service.delete_topic` | _не заданы явно_ | `POST /deleteTopic` (`deleteTopicController`) | `questionRepository.find_all({topicIds:[id]})`, цикл `questionRepository.delete(qid)`, `topicRepository.delete(id)` | `NotFoundError` от каждого `delete` |
| `questions_service.get_topic` | _не заданы явно_ | `POST /getTopic` (`getTopicController`) | `topicRepository.find_by_id` | `NotFoundError("Topic", id)` |
| `questions_service.get_topics` | _не заданы явно_ | `POST /getTopics` (`getTopicsController`) | `topicRepository.find_all(filter, sort, limit, offset)` | — |
| `questions_service.create_question` | _не заданы явно_ | `POST /createQuestion` (`createQuestionController`) | `questionRepository.create` | — |
| `questions_service.update_question_text` | _не заданы явно_ | `POST /updateQuestionText` (`updateQuestionTextController`) | `questionRepository.update_text` | `NotFoundError("Question", id)` |
| `questions_service.update_answer` | _не заданы явно_ | `POST /updateQuestionAnswer` (`updateQuestionAnswerController`) | `questionRepository.update_answer_text` | `NotFoundError("Question", id)` |
| `questions_service.create_answer` | _не заданы явно_ | `POST /createQuestionAnswer` (`createQuestionAnswerController`) | `questionRepository.create_answer` | `NotFoundError("Question", id)` |
| `questions_service.delete_question` | _не заданы явно_ | `POST /deleteQuestion` (`deleteQuestionController`) | `questionRepository.delete` | `NotFoundError("Question", id)` |
| `questions_service.get_question` | _не заданы явно_ | `POST /getQuestion` (`getQuestionController`) | `questionRepository.find_by_id` | `NotFoundError("Question", id)` |
| `questions_service.get_questions` | _не заданы явно_ | `POST /getQuestions` (`getQuestionsController`) | `questionRepository.find_all(filter, sort, limit, offset)` | — |

_Примечание: span name = `camelToSnakeCase(ClassName) + '.' + camelToSnakeCase(method)`._
_`setSpanAttributes()` **отсутствует** на всех 13 методах сервиса — см. §6 «Critical gaps»._

#### TopicRepository — span prefix: topic_repository

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `topic_repository.create` | `questions_service.create_topic` | `TopicEntity.create(data)` | insert |
| `topic_repository.update` | `questions_service.update_topic` | `TopicEntity.findByIdAndUpdate(id, data, {new: true}).lean()` | бросает `NotFoundError` если `null` |
| `topic_repository.delete` | `questions_service.delete_topic` | `TopicEntity.findByIdAndDelete(id).lean()` | бросает `NotFoundError` если `null` |
| `topic_repository.find_by_id` | `questions_service.get_topic` | `TopicEntity.findById(id).lean()` | бросает `NotFoundError` если `null` |
| `topic_repository.find_all` | `questions_service.get_topics`, `delete_topic` (через `questionRepository.findAll` нет — `delete_topic` использует именно `questionRepository.findAll`) | `TopicEntity.find(filter).sort().skip().limit().lean()` | default limit=100, offset=0, sort={createdAt:asc} |

#### QuestionRepository — span prefix: question_repository

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `question_repository.create` | `questions_service.create_question` | `QuestionEntity.create(data)` | insert |
| `question_repository.update_text` | `questions_service.update_question_text` | `QuestionEntity.findByIdAndUpdate(id, {text}, {new:true}).lean()` | бросает `NotFoundError` если `null` |
| `question_repository.update_answer_text` | `questions_service.update_answer` | `QuestionEntity.findByIdAndUpdate(id, {'answer.text': text, 'answer.updatedAt': now, answered: true}, {new:true}).lean()` | бросает `NotFoundError` если `null` |
| `question_repository.create_answer` | `questions_service.create_answer` | `QuestionEntity.findByIdAndUpdate(id, {answer:{...}, answered: true}, {new:true}).lean()` | бросает `NotFoundError` если `null` |
| `question_repository.delete` | `questions_service.delete_question`, `delete_topic` (цикл) | `QuestionEntity.findByIdAndDelete(id).lean()` | бросает `NotFoundError` если `null` |
| `question_repository.find_by_id` | `questions_service.get_question` | `QuestionEntity.findById(id).lean()` | бросает `NotFoundError` если `null` |
| `question_repository.find_all` | `questions_service.get_questions`, `delete_topic` (перед каскадным удалением) | `QuestionEntity.find(filter).sort().skip().limit().lean()` | default limit=100, offset=0 |
| `question_repository.increment_likes` | `questions_service.toggle_like` (ветка «нет лайка → ставим») | `QuestionEntity.findByIdAndUpdate(id, {$inc:{likesCount:1}}, {new:true}).lean()` | бросает `NotFoundError` если `null` |
| `question_repository.decrement_likes` | `questions_service.toggle_like` (ветка «лайк есть → снимаем») | `QuestionEntity.findByIdAndUpdate(id, {$inc:{likesCount:-1}}, {new:true}).lean()` | бросает `NotFoundError` если `null` |

#### QuestionLikesRepository — span prefix: question_likes_repository

| Span name | Вызывается из | MongoDB операция | Примечание |
|-----------|---------------|-------------------|------------|
| `question_likes_repository.create` | `questions_service.toggle_like` | `QuestionLikesEntity.create(data)` | insert |
| `question_likes_repository.delete` | `questions_service.toggle_like` | `QuestionLikesEntity.findOneAndDelete({questionId, userId}).lean()` | бросает `NotFoundError` если `null` |
| `question_likes_repository.exists` | `questions_service.toggle_like` | `QuestionLikesEntity.findOne({questionId, userId}).lean()` | boolean, без throw |
| `question_likes_repository.find_by_question_id` | _внутренний/зарезервирован_ (нет вызывающего в сервисном слое) | `QuestionLikesEntity.find({questionId}).sort().skip().limit().lean()` | доступен через DI, не вызывается из QuestionsService |
| `question_likes_repository.find_by_question_ids` | _внутренний/зарезервирован_ (нет вызывающего в сервисном слое) | `QuestionLikesEntity.find({questionId: {$in: [...]}}).sort().skip().limit().lean()` | доступен через DI, не вызывается из QuestionsService |
| `question_likes_repository.find_by_user_id` | _внутренний/зарезервирован_ (нет вызывающего в сервисном слое) | `QuestionLikesEntity.find({userId}).sort().skip().limit().lean()` | доступен через DI, не вызывается из QuestionsService |
| `question_likes_repository.count_by_question_id` | _внутренний/зарезервирован_ (нет вызывающего в сервисном слое) | `QuestionLikesEntity.countDocuments({questionId})` | доступен через DI, не вызывается из QuestionsService |

_Замечание: методы `find_by_question_id` / `find_by_question_ids` / `find_by_user_id` / `count_by_question_id` присутствуют в репозитории и трейсятся, но в текущем `QuestionsService` не вызываются. На них нет ни контроллеров, ни сервисных методов. Возможно, зарезервированы под будущие ручки._

### 1.4. Auto-instrumentation

| Тип | Инструмент | Какие спаны | Атрибуты |
|-----|-----------|-------------|----------|
| HTTP | instrumentation-http | `POST /createTopic`, `POST /updateTopic`, `POST /deleteTopic`, `POST /getTopic`, `POST /getTopics`, `POST /createQuestion`, `POST /updateQuestionText`, `POST /createQuestionAnswer`, `POST /updateQuestionAnswer`, `POST /deleteQuestion`, `POST /getQuestion`, `POST /getQuestions`, `POST /toggleQuestionLike`, `GET /health` | `http.method`, `http.target`, `http.status_code`, `http.service=SERVICE_NAME` |
| MongoDB | instrumentation-mongoose | (есть в `monitoring.plugin.ts:76`, но `suppressInternalInstrumentation: true` → **спаны подавлены**). Доступ к MongoDB виден только через `@TraceDecorator` на репозиториях. | — |
| DNS | instrumentation-dns | `dns.lookup` при `mongoose.connect` (SRV-запись если MONGODB_URI=mongodb+srv://) | — |
| FS | instrumentation-fs | `fs.*` при чтении tsconfig/ts-исходников, при загрузке `.env` Bun-runtime | — |
| Net | instrumentation-net | `net.*` (TCP connect к MongoDB) | — |
| Runtime | instrumentation-runtime-node | — (метрики, не спаны) | — |
| RabbitMQ | instrumentation-amqplib | — (включён в `monitoring.plugin.ts:111-116`, но в коде `questions` нет ни `publishHook`, ни `consume` — спаны не создаются) | — |

_Сервис НЕ использует Redis/ioredis → соответствующая auto-instrumentation неактивна по факту (только если shared-пакеты дёрнут Redis, чего questions не делает)._
_Сервис НЕ использует GraphQL → `instrumentation-graphql` отключён в `monitoring.plugin.ts:79-81`._

### 1.5. Дебаг: полная иерархия для ключевой операции

**Создание вопроса (`POST /createQuestion`):**

```
POST /createQuestion                       ← HTTP auto-instr
  └── questions_service.create_question     ← @TraceDecorator
        └── question_repository.create      ← @TraceDecorator
              └── mongoose Collection.op   ← instrumentation-mongoose ПОДАВЛЕН
```

**Toggle лайка (`POST /toggleQuestionLike`):**

```
POST /toggleQuestionLike                         ← HTTP auto-instr
  └── questions_service.toggle_like              ← @TraceDecorator
        ├── question_likes_repository.exists     ← @TraceDecorator
        ├── question_likes_repository.delete     ← @TraceDecorator (если exists=true)
        │   └── mongoose Collection.op           ← подавлен
        └── question_repository.decrement_likes  ← @TraceDecorator (если exists=true)
              └── mongoose Collection.op         ← подавлен
        ИЛИ
        ├── question_likes_repository.create     ← @TraceDecorator (если exists=false)
        │   └── mongoose Collection.op           ← подавлен
        └── question_repository.increment_likes  ← @TraceDecorator (если exists=false)
              └── mongoose Collection.op         ← подавлен
```

**Каскадное удаление топика (`POST /deleteTopic`):**

```
POST /deleteTopic                                 ← HTTP auto-instr
  └── questions_service.delete_topic              ← @TraceDecorator
        ├── question_repository.find_all          ← @TraceDecorator (findAll по topicIds)
        ├── question_repository.delete (×N)       ← @TraceDecorator × кол-во вопросов в топике
        └── topic_repository.delete               ← @TraceDecorator
```

---

## 2. Логи

### 2.1. Business-логи (через `@LogDecorator`)

Все 13 методов `QuestionsService` имеют `@LogDecorator({ args: [...] })`.
Реальное поведение — в `@shared/monitoring/src/logDecorator.ts`: при вызове
пишется `logger.debug('<class>.<method> — called', {arg})`, при успехе
`logger.debug('<class>.<method> — ok', {result})`, при AppError
`logger.warn('<class>.<method> — failed', {error})`, при plain Error
`logger.error('<class>.<method> — system_error', {error})`.

| Метод | `args` в логе | DEBUG при вызове | DEBUG при успехе | WARN/ERROR |
|-------|--------------|------------------|------------------|------------|
| `questions_service.toggle_like` | `['data']` | `toggleLike — called` `{data:{questionId, userId}}` | `toggleLike — ok` `{liked: bool}` | `NotFoundError` → WARN `— failed`; `Error` → ERROR `— system_error` |
| `questions_service.create_topic` | `['data']` | `createTopic — called` `{data:{name, ownerId, ownerType, creator, parentId, grandParentId}}` | `createTopic — ok` `{topic}` | (нет ожидаемых AppError) |
| `questions_service.update_topic` | `['params']` | `updateTopic — called` `{params:{id, updateData:{name}}}` | `updateTopic — ok` `{topic}` | `NotFoundError("Topic", id)` → WARN |
| `questions_service.delete_topic` | `['id']` | `deleteTopic — called` `{id}` | `deleteTopic — ok` `{id}` | `NotFoundError` от любого из дочерних `delete` → WARN |
| `questions_service.get_topic` | `['id']` | `getTopic — called` `{id}` | `getTopic — ok` `{topic}` | `NotFoundError("Topic", id)` → WARN |
| `questions_service.get_topics` | `['params']` | `getTopics — called` `{params:{filter, sort, limit, offset}}` | `getTopics — ok` `{topics: [...]}` | — |
| `questions_service.create_question` | `['data']` | `createQuestion — called` `{data:{topicId, text, ownerId, ownerType, creator, parentId, grandParentId}}` | `createQuestion — ok` `{question}` | — |
| `questions_service.update_question_text` | `['params']` | `updateQuestionText — called` `{params:{id, updateData:{text}}}` | `updateQuestionText — ok` `{question}` | `NotFoundError("Question", id)` → WARN |
| `questions_service.update_answer` | `['params']` | `updateAnswer — called` `{params:{id, updateData:{text}}}` | `updateAnswer — ok` `{question}` | `NotFoundError("Question", id)` → WARN |
| `questions_service.create_answer` | `['data']` | `createAnswer — called` `{data:{id, userId, text}}` | `createAnswer — ok` `{question}` | `NotFoundError("Question", id)` → WARN |
| `questions_service.delete_question` | `['id']` | `deleteQuestion — called` `{id}` | `deleteQuestion — ok` `{id}` | `NotFoundError("Question", id)` → WARN |
| `questions_service.get_question` | `['id']` | `getQuestion — called` `{id}` | `getQuestion — ok` `{question}` | `NotFoundError("Question", id)` → WARN |
| `questions_service.get_questions` | `['params']` | `getQuestions — called` `{params:{filter, sort, limit, offset}}` | `getQuestions — ok` `{questions: [...]}` | — |

_Примечание: на репозиторных методах `@LogDecorator` НЕ используется — только
`@TraceDecorator`. Лог-строки для репозиториев не создаются (только спаны и
Mongoose auto-instrumentation)._

### 2.2. ErrorHandlerPlugin

Подключён в `src/app.ts:35` через `.onError(ErrorHandlerPlugin)`. Реализация —
`@shared/errors/error-handler.plugin.ts`. Логирует **ВСЕ ошибки** через
`logger.error(...)` (см. §6 «Anti-patterns» в скиле `rwa-observability-docs`:
плагин логирует AppError и plain Error одинаково через `logger.error`).
Различие WARN/ERROR здесь обеспечивает только `@LogDecorator`.

| Условие | Уровень | Сообщение | Атрибуты |
|---------|---------|-----------|----------|
| Любая ошибка (AppError или plain Error) | ERROR | `error.message` | `{error, errorName, errorStack, path}` |

---

## 3. Метрики

### 3.1. Business метрики (через `@MetricsDecorator`)

`@MetricsDecorator()` стоит только на сервисном слое (13 методов
`QuestionsService`), и каждый генерирует пару `<service>_<class_snake>_<method_snake>_total`
+ `<service>_<class_snake>_<method_snake>_duration`. На репозиториях декоратора
нет.

_Prometheus имя считается как `SERVICE_NAME` + `_` + `camelToSnakeCase(className)` + `_` +
`camelToSnakeCase(methodName)` + `_total|_duration`. Удвоение `questions_`
(SERVICE_NAME = `questions` + snake_case className = questions_service →
итого имя метрики содержит `questions_questions_service_*`) — конвенция
платформы, оставлять как есть._

| Prometheus имя | Тип | Labels | Когда | Зачем |
|---------------|-----|--------|-------|-------|
| `questions_questions_service_toggle_like_total` | Counter | `result=success\|error` | Каждый вызов `toggleLike` | Счётчик toggle-like операций |
| `questions_questions_service_toggle_like_duration` | Histogram | — | Каждый вызов `toggleLike` | Латентность toggle-like |
| `questions_questions_service_create_topic_total` | Counter | `result=success\|error` | Каждый вызов `createTopic` | Счётчик созданий топика |
| `questions_questions_service_create_topic_duration` | Histogram | — | Каждый вызов `createTopic` | Латентность создания топика |
| `questions_questions_service_update_topic_total` | Counter | `result=success\|error` | Каждый вызов `updateTopic` | Счётчик обновлений топика |
| `questions_questions_service_update_topic_duration` | Histogram | — | Каждый вызов `updateTopic` | Латентность обновления топика |
| `questions_questions_service_delete_topic_total` | Counter | `result=success\|error` | Каждый вызов `deleteTopic` | Счётчик удалений топика (включая каскад) |
| `questions_questions_service_delete_topic_duration` | Histogram | — | Каждый вызов `deleteTopic` | Латентность каскадного удаления |
| `questions_questions_service_get_topic_total` | Counter | `result=success\|error` | Каждый вызов `getTopic` | Счётчик чтений топика |
| `questions_questions_service_get_topic_duration` | Histogram | — | Каждый вызов `getTopic` | Латентность чтения топика |
| `questions_questions_service_get_topics_total` | Counter | `result=success\|error` | Каждый вызов `getTopics` | Счётчик list-чтений топиков |
| `questions_questions_service_get_topics_duration` | Histogram | — | Каждый вызов `getTopics` | Латентность list-чтения топиков |
| `questions_questions_service_create_question_total` | Counter | `result=success\|error` | Каждый вызов `createQuestion` | Счётчик созданий вопроса |
| `questions_questions_service_create_question_duration` | Histogram | — | Каждый вызов `createQuestion` | Латентность создания вопроса |
| `questions_questions_service_update_question_text_total` | Counter | `result=success\|error` | Каждый вызов `updateQuestionText` | Счётчик обновлений текста вопроса |
| `questions_questions_service_update_question_text_duration` | Histogram | — | Каждый вызов `updateQuestionText` | Латентность обновления текста |
| `questions_questions_service_update_answer_total` | Counter | `result=success\|error` | Каждый вызов `updateAnswer` | Счётчик обновлений ответа |
| `questions_questions_service_update_answer_duration` | Histogram | — | Каждый вызов `updateAnswer` | Латентность обновления ответа |
| `questions_questions_service_create_answer_total` | Counter | `result=success\|error` | Каждый вызов `createAnswer` | Счётчик созданий ответа |
| `questions_questions_service_create_answer_duration` | Histogram | — | Каждый вызов `createAnswer` | Латентность создания ответа |
| `questions_questions_service_delete_question_total` | Counter | `result=success\|error` | Каждый вызов `deleteQuestion` | Счётчик удалений вопроса |
| `questions_questions_service_delete_question_duration` | Histogram | — | Каждый вызов `deleteQuestion` | Латентность удаления вопроса |
| `questions_questions_service_get_question_total` | Counter | `result=success\|error` | Каждый вызов `getQuestion` | Счётчик чтений вопроса |
| `questions_questions_service_get_question_duration` | Histogram | — | Каждый вызов `getQuestion` | Латентность чтения вопроса |
| `questions_questions_service_get_questions_total` | Counter | `result=success\|error` | Каждый вызов `getQuestions` | Счётчик list-чтений вопросов |
| `questions_questions_service_get_questions_duration` | Histogram | — | Каждый вызов `getQuestions` | Латентность list-чтения вопросов |

_Итого business-метрик: 13 методов × 2 (`_total` + `_duration`) = **26**._

### 3.2. Auto-instrumentation метрики

| Prometheus prefix | Откуда | Что измеряет |
|-------------------|--------|--------------|
| `process_runtime_node_*` | runtime-node | CPU, memory, event loop lag, GC |
| `http.server.*` | HTTP auto-instr | RPS, latency, status codes для всех 13 POST-роутов + `GET /health` |
| `db.client.*` | MongoDB auto-instr | _подавлено_ через `suppressInternalInstrumentation: true` (`monitoring.plugin.ts:77`) |
| `traces_spanmetrics_calls_total` | Tempo span-metrics | Количество спанов (включая все 60 спанов questions) |
| `traces_spanmetrics_latency` | Tempo span-metrics | Латентность спанов |

### 3.3. Примеры PromQL

```promql
# Ошибки создания вопросов за 5 минут
rate(questions_questions_service_create_question_total{result="error"}[5m])

# P99 латентность toggle-like
histogram_quantile(0.99, rate(questions_questions_service_toggle_like_duration_bucket[5m]))

# Количество операций toggle-like за последние 24 часа
increase(questions_questions_service_toggle_like_total[24h])

# Каскадные удаления топиков (сколько раз deleteTopic отработал успешно за час)
rate(questions_questions_service_delete_topic_total{result="success"}[1h])
```

---

## 4. Health-check

### `GET /health`

Подключён в `src/app.ts:34` через `.use(healthPlugin)` (из
`@shared/monitoring/src/health.plugin.ts`). Возвращает стандартный ответ
health-плагина. Не трейсится (`healthPlugin` — инфраструктурный, в список
спанов не входит).

---

## 5. Краткий чек-лист при дебаге

| Симптом | Что смотреть |
|---------|-------------|
| Сервис не стартует, висит на `MongoDB connect` | Спан `questions.init.repositories_plugin.mongoose` (не закрывается → нет `connected`-эвента). Проверить `MONGODB_URI`, DNS-resolve через `instrumentation-dns`, TCP через `instrumentation-net`. |
| `404 NotFoundError` на `POST /updateTopic`, `/updateQuestionText`, `/updateQuestionAnswer`, `/createQuestionAnswer`, `/deleteQuestion`, `/deleteTopic`, `/getTopic`, `/getQuestion` | Спан соответствующего `*_repository.update` / `delete` / `find_by_id` (он бросает `NotFoundError`). В Tempo: искать `questions_service.<method>` → дочерний `<repo>.<method>` с `error.message="<Entity> not found: <id>"`. В Loki: WARN `failed` от `@LogDecorator`. |
| Лайк «залип» — `likesCount` расходится с количеством записей в `QuestionLikes` | Спан `questions_service.toggle_like` → две дочерние ветки `question_likes_repository.{delete,create}` + `question_repository.{decrement_likes,increment_likes}`. Если одна из веток упала с `NotFoundError` — откат не предусмотрен (race condition между exists и create/delete). См. §6. |
| Каскадное удаление топика тормозит на больших топиках | Спан `questions_service.delete_topic` содержит N+1 запросов к `question_repository.delete` (по одному на каждый вопрос). Нет batch-удаления. См. §6. |
| Медленные list-чтения | Спан `*_service.get_topics` / `get_questions` → `*_repository.find_all` (default limit=100, offset=0). Если в `filter` пустой объект — `find_all` идёт без фильтра, возможен `db.client.connections` исчерпание при большом dataset. |
| Метрики Prometheus пустые | Проверить OTEL_EXPORTER_OTLP_ENDPOINT, доступность Tempo/Mimir. Все 26 метрик сервиса регистрируются автоматически через `@MetricsDecorator`. |
| HTTP 500 на любой ручке | Спан `ErrorHandlerPlugin` логирует через `logger.error`. В Loki искать `errorName`, `errorStack`. |
| При SIGTERM процесс не закрывается | Единственный shutdown-span — `questions.stop.repositories_plugin` (только `mongoose.disconnect`). Если висит — смотреть именно его. Контроллеры/сервис не имеют явного shutdown-span'а. |
| Спана в Tempo нет, хотя ручка дёрнута | Проверить `SERVICE_NAME` env (должно быть `questions`), `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`. HTTP auto-instr создаёт спаны только при прохождении через Elysia (health-check skip'нет — он plugin-only). |
