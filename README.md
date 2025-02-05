```markdown
# API Service

## Quick Start

```bash
# Start infrastructure
docker-compose up -d

# Install dependencies
bun install

# Start development server
bun dev

```

## Testing
```bash
# Run tests
npx jest
```

## API Documentation
- Swagger UI: http://localhost:3000/documentation
- API Version: Use `api-version` header (default: v1)

## Features
- Authentication (JWT)
- API Versioning
- WebSocket Support
- Rate Limiting
- Compression
- Request Validation
- File Upload
- Caching

## Monitoring
- Health Check: GET /health
- Metrics: GET /metrics
- RabbitMQ Dashboard: http://localhost:15672

## Environment
Required services:
- MongoDB (27017)
- Redis (6379)
- RabbitMQ (5672, 15672)
```