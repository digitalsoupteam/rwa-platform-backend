```markdown
# RWA Platform Microservices

Микросервисная RWA платформа с поддержкой криптовалют, KYC и AI-интеграцией.

## Установка проекта

### 1. Клонирование репозитория
```bash
git clone <repository-url>
cd rwa-platform
```

### 2. Установка зависимостей
```bash
bun install
```

### 3. Настройка окружения
```bash
cp .env.example .env
# Отредактируйте .env файл под свои нужды
```

## Запуск проекта

### 1. Запуск инфраструктурных сервисов
```bash
docker-compose up -d mongodb redis rabbitmq prometheus grafana
```

### 2. Сборка сервисов
```bash
bun run build
```

### 3. Запуск всех сервисов
```bash
# Режим разработки
bun run dev

# Или production режим
bun run start
```

### 4. Запуск отдельных сервисов
```bash
# Разработка
bun run dev:gateway
bun run dev:auth
# и т.д.

# Production
bun run start:gateway
bun run start:auth
# и т.д.
```

## Доступные endpoints

| Сервис | URL | Порт |
|--------|-----|------|
| Gateway GraphQL | http://localhost:3000/graphql | 3000 |
| Auth Service | http://localhost:3001 | 3001 |
| Notification Service | http://localhost:3002 | 3002 |
| Trading Service | http://localhost:3003 | 3003 |
| Market Data Service | http://localhost:3004 | 3004 |
| Blockchain Scanner | http://localhost:3005 | 3005 |
| Worker Service | http://localhost:3006 | 3006 |
| KYC Service | http://localhost:3007 | 3007 |
| AI Service | http://localhost:3008 | 3008 |
| Risk Management | http://localhost:3009 | 3009 |

### Инфраструктурные сервисы
| Сервис | URL | Порт |
|--------|-----|------|
| MongoDB | mongodb://localhost:27017 | 27017 |
| Redis | redis://localhost:6379 | 6379 |
| RabbitMQ | http://localhost:15672 | 15672 |
| Prometheus | http://localhost:9090 | 9090 |
| Grafana | http://localhost:3010 | 3010 |
| Swagger | http://localhost:3000/swagger | 3000 |

## Команды для разработки

### Основные команды
```bash
# Сборка всех сервисов
bun run build

# Запуск в режиме разработки
bun run dev

# Запуск в production режиме
bun run start

# Линтинг кода
bun run lint

# Форматирование кода
bun run format
```

### Docker команды
```bash
# Сборка контейнеров
bun run docker:build

# Запуск всех сервисов в Docker
bun run docker:up

# Остановка сервисов
bun run docker:down
```

### Очистка
```bash
# Очистка сборок и node_modules
bun run clean
```

## Мониторинг и логирование

### Prometheus
- URL: http://localhost:9090
- Метрики доступны по endpoint /metrics для каждого сервиса

### Grafana
- URL: http://localhost:3010
- Default credentials: admin/admin
- Предустановленные дашборды доступны после первого входа

### Логи
```bash
# Просмотр логов всех сервисов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f service-name
```

## Структура проекта
```
/backend
├── services/
│   ├── gateway-service/        # API Gateway (GraphQL + REST)
│   ├── auth-service/          # Аутентификация
│   ├── notification-service/   # Уведомления
│   ├── trading-service/       # Торговые операции
│   ├── market-data-service/   # Рыночные данные
│   ├── blockchain-scanner/    # Сканер блокчейна
│   ├── worker-service/        # Фоновые задачи
│   ├── kyc-service/          # KYC верификация
│   ├── ai-service/           # AI интеграции
│   └── risk-management/      # Управление рисками
├── shared/                    # Общий код
├── docker/                    # Docker конфигурация
└── package.json
```

## Устранение неполадок

### Проблемы с установкой
```bash
# Очистка и переустановка
bun run clean
bun install
```

### Проблемы с Docker
```bash
# Полная перезагрузка Docker
docker-compose down -v
docker system prune
bun run docker:build
bun run docker:up
```

### Проблемы с сервисами
1. Проверьте логи:
```bash
docker-compose logs -f service-name
```
2. Проверьте статус сервисов:
```bash
docker-compose ps
```
3. Проверьте подключение к базам данных:
```bash
# MongoDB
mongosh mongodb://localhost:27017

# Redis
redis-cli
```

## Безопасность

- Все внешние API защищены JWT
- Реализован rate limiting
- Настроены CORS
- Используется HTTPS в production
- Регулярное обновление зависимостей

## Разработка

### Добавление нового сервиса
1. Создайте новую директорию в services/
2. Скопируйте базовую структуру из существующего сервиса
3. Обновите package.json и конфигурационные файлы
4. Добавьте сервис в docker-compose.yml
5. Обновите конфигурацию мониторинга

### Обновление зависимостей
```bash
bun update
```