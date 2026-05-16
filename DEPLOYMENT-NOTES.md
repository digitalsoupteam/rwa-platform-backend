## 💻 Local Development Setup

Before starting the stack locally, you need to map the local domains to your loopback address and generate self-signed SSL certificates.

### Step 1: Update Hosts File
Add the following lines to your `hosts` file:
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

### Step 2: Generate Self-Signed Certificates
For local development, generate SSL certificates for `*.rwa.local`:

```bash
mkdir -p infrastructure/docker/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infrastructure/docker/nginx/ssl/privkey.pem \
  -out infrastructure/docker/nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=Dev/L=Dev/O=RWA/OU=Dev/CN=*.rwa.local"
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
    - `LLDAP_ADMIN_PASSWORD`
2.  **Set your domain:**
    - `BASE_DOMAIN=yourdomain.com`
    - `LLDAP_BASE_DN=dc=yourdomain,dc=com`
3.  **Check Blockchain Keys** (if deploying to production/mainnet):
    - Update `SIGNER_X_PRIVATE_KEY` and `TESTNET_FAUCET_WALLET_PRIVATE_KEY`.
4.  **SSL Configuration:**
    - **Production (Certbot):**
      - `NGINX_SSL_PATH=/etc/letsencrypt/live/${BASE_DOMAIN}`
      - `NGINX_CHALLENGE_PATH=/var/www/certbot`
    - **Development (Self-signed):**
      - `NGINX_SSL_PATH=./nginx/ssl`
      - `NGINX_CHALLENGE_PATH=./nginx/challenge`

## Step 4: Setup SSL (Production Only - Host Machine Certbot)
If you are deploying to production and want to use Certbot on the host machine:

1.  **Install Certbot:**
    ```bash
    sudo apt update
    sudo apt install certbot
    ```

2.  **Obtain Certificates:**
    ```bash
    sudo certbot certonly --standalone -d yourdomain.com -d "*.yourdomain.com" --email admin@yourdomain.com --agree-tos
    ```

3.  **Auto-renewal Hook:**
    Ensure Nginx reloads after renewal by adding a deploy hook:
    ```bash
    # Create /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
    #!/bin/bash
    cd /path/to/project && bun run nginx:reload
    ```

## Step 5: Start the Infrastructure
```bash
bun run app:up
```

## Step 6: Import Uptime Kuma Configuration
Upon first run, you must manually import the monitoring configuration:
1.  Open **Uptime Kuma** in your browser: `http://uptime.rwa.local` (local) or `https://uptime.yourdomain.com` (server).
2.  Create your admin account.
3.  Go to **Settings** > **Backup** > **Import Backup**.
4.  Select and upload the file: `infrastructure/docker/uptime-kuma/uptime-kuma-import.json`.

---

## 🛠 Maintenance Commands

### Nginx Domain/SSL Update
If you change `BASE_DOMAIN` or update certificates:
```bash
bun run nginx:reload
```

### Full Backup
Creates an archive of databases, configs, and SSL:
```bash
./deployments/scripts/backup.sh
```