#!/bin/bash

# Configuration paths
NGINX_DIR="./infrastructure/docker/nginx"
AUTHELIA_SECRETS="./infrastructure/docker/authelia/secrets"

echo "--------------------------------------------------"
echo "🏗️  Phase 1: Pre-deployment Setup"
echo "--------------------------------------------------"

# 1. Create directories
mkdir -p "$AUTHELIA_SECRETS"
mkdir -p "$NGINX_DIR/ssl"
mkdir -p "$NGINX_DIR/conf.d"
mkdir -p "$NGINX_DIR/snippets"

# 2. Generate Secrets
generate_secret() {
    local file=$1
    if [ ! -f "$file" ]; then
        echo "Generating secret for $(basename $file)..."
        openssl rand -base64 48 > "$file"
        chmod 600 "$file"
    else
        echo "✅ Secret $(basename $file) already exists."
    fi
}

generate_secret "$AUTHELIA_SECRETS/JWT_SECRET"
generate_secret "$AUTHELIA_SECRETS/LLDAP_JWT_SECRET"
generate_secret "$AUTHELIA_SECRETS/SESSION_SECRET"
generate_secret "$AUTHELIA_SECRETS/STORAGE_ENCRYPTION_KEY"

# 3. Nginx .htpasswd
if [ ! -f "$NGINX_DIR/.htpasswd" ]; then
    echo "Setting up Nginx Basic Auth..."
    read -p "Enter username for Nginx: " ht_user
    read -s -p "Enter password for $ht_user: " ht_pass
    echo
    echo "${ht_user}:$(openssl passwd -apr1 "$ht_pass")" > "$NGINX_DIR/.htpasswd"
    echo "✅ .htpasswd created."
else
    echo "✅ .htpasswd already exists."
fi

echo "--------------------------------------------------"
echo "✅ Pre-deployment complete!"
echo "Next step: Run 'docker-compose up -d' and then './deployments/scripts/post-deploy.sh'"
