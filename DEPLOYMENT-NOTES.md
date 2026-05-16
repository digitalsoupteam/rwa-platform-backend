## 💻 Local Development Setup

Before starting the stack locally, you need to map the local domains to your loopback address.

**Action:** Add the following lines to your `hosts` file:
- **Windows:** `C:\Windows\System32\drivers\etc\hosts` (Run Notepad as Administrator)
- **Linux/macOS:** `/etc/hosts` (Use `sudo`)

```text
127.0.0.1 rwa.local
127.0.0.1 auth.rwa.local
127.0.0.1 lldap.rwa.local
127.0.0.1 admin.rwa.local
127.0.0.1 grafana.rwa.local
127.0.0.1 prometheus.rwa.local
127.0.0.1 alloy.rwa.local
127.0.0.1 rabbitmq.rwa.local
127.0.0.1 mongo.rwa.local
127.0.0.1 redis.rwa.local
127.0.0.1 portainer.rwa.local
127.0.0.1 uptime.rwa.local
127.0.0.1 graphiql.rwa.local
```

---

## 🚀 Server Deployment Guide (Full Setup)

Follow these steps in order to initialize and start the production-ready stack.

## Step 1: Initialize Authelia File Secrets
Authelia requires physical secret files to be present for mounting.
```bash
chmod +x deployments/scripts/*.sh
./deployments/scripts/init-authelia-secrets.sh
```
*This creates files in `./infrastructure/docker/authelia/secrets/`.*

## Step 2: Generate Values for .env
Generate secure random strings for your environment configuration.
```bash
./deployments/scripts/generate-env-values.sh
```
**Action:** Copy the output from the terminal.

## Step 3: Configure Environment (.env)
Edit `infrastructure/docker/.env` and update the following mandatory fields:

1.  **Paste generated secrets** from Step 2 into their respective fields:
    - `APP_JWT_SECRET`
    - `RABBITMQ_PASSWORD`
    - `GRAFANA_PASSWORD`
    - `RWA_LLDAP_ADMIN_PASSWORD`
2.  **Set your domain:**
    - `BASE_DOMAIN=yourdomain.com`
    - `LLDAP_BASE_DN=dc=yourdomain,dc=com`
3.  **Check Blockchain Keys** (if deploying to production/mainnet):
    - Update `SIGNER_X_PRIVATE_KEY` and `TESTNET_FAUCET_WALLET_PRIVATE_KEY`.


## Step 5: Start the Infrastructure
```bash
npm run app:up
```

---

## 🛠 Maintenance Commands

### Nginx Domain/SSL Update
If you change `BASE_DOMAIN` or update certificates:
```bash
npm run nginx:reload
```

### Full Backup
Creates an archive of databases, configs, and SSL:
```bash
./deployments/scripts/backup.sh
```