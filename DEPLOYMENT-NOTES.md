# Server Deployment Workflow

## Step 1: Prepare environment
Run this BEFORE starting docker:
```bash
chmod +x deployments/scripts/*.sh
./deployments/scripts/pre-deploy.sh
```

## Step 2: Start the stack
```bash
docker-compose up -d
```

## Step 3: Initialize services
Run this AFTER docker containers are up:
```bash
./deployments/scripts/post-deploy.sh
```

## Maintenance: Backups
To create a full backup of databases, secrets, and certificates:
```bash
./deployments/scripts/backup.sh
```
It's recommended to run this daily via CRON:
`0 3 * * * /path/to/project/deployments/scripts/backup.sh`
