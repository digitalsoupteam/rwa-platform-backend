# Enterprise Service

The Enterprise Service manages RWA (Real World Asset) enterprises and their associated pools. It handles the lifecycle of enterprise creation, from initial application to blockchain deployment.

## Features

- Create and manage RWA enterprises
- Handle file uploads (images and PDFs)
- Integrate with AI service for document analysis
- Manage signature collection for blockchain deployment
- Create and manage pools for approved enterprises

## API Endpoints

### Enterprises

#### Create Enterprise
```http
POST /enterprise
```
Body (multipart/form-data):
- name: Enterprise name
- productOwner: Address of the product owner
- image: Enterprise image file
- investmentPresentation: PDF file of investment presentation
- projectSummary: PDF file of project summary

#### List Enterprises
```http
GET /enterprise
```
Returns all enterprises with their associated pools.

#### Get Enterprise
```http
GET /enterprise/:id
```
Returns detailed information about a specific enterprise.

#### Request Signatures
```http
POST /enterprise/:id/sign
```
Initiates the signature collection process for blockchain deployment.

### Pools

#### Create Pool
```http
POST /enterprise/:id/pool
```
Body:
```json
{
  "name": "Pool name",
  "metadata": {
    "key": "value"
  }
}
```

#### List Enterprise Pools
```http
GET /enterprise/:id/pools
```
Returns all pools associated with a specific enterprise.

## Workflow

1. Enterprise Creation
   - Product owner submits enterprise details and documents
   - Files are stored and PDFs are parsed
   - Documents are sent to AI service for analysis
   - AI service returns analysis and risk score

2. Signature Collection
   - After AI analysis, signatures can be requested
   - Unsigned message is sent to signer service
   - Signer service collects required signatures
   - Signatures are stored with enterprise

3. Blockchain Deployment
   - Product owner can deploy to blockchain with collected signatures
   - Blockchain scanner detects deployment
   - Enterprise status is updated to APPROVED
   - Metadata file is generated

4. Pool Management
   - Approved enterprises can create pools
   - Each pool is associated with the parent enterprise
   - Pool metadata can be customized

## Environment Variables

- `MONGODB_URI`: MongoDB connection string (default: mongodb://localhost:27017/rwa-platform)
- `RABBITMQ_URL`: RabbitMQ connection string (default: amqp://localhost:5672)

## Message Queues

- `enterprise.ai.analysis`: Send documents for AI analysis
- `enterprise.ai.result`: Receive AI analysis results
- `signer.unsigned`: Send unsigned messages for signature collection
- `signer.signed`: Receive collected signatures
- `blockchain.events`: Receive blockchain deployment events
