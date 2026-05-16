#!/bin/bash

# Путь к секретам Authelia
AUTHELIA_SECRETS="./infrastructure/docker/authelia/secrets"

echo "--------------------------------------------------"
echo "🔐 Generating Authelia File Secrets"
echo "--------------------------------------------------"

mkdir -p "$AUTHELIA_SECRETS"

generate_file_secret() {
    local name=$1
    local path="$AUTHELIA_SECRETS/$name"
    if [ ! -f "$path" ]; then
        echo "Generating file: $name..."
        openssl rand -base64 48 > "$path"
        chmod 600 "$path"
    else
        echo "✅ Secret $name already exists."
    fi
}

generate_file_secret "JWT_SECRET"
generate_file_secret "LLDAP_JWT_SECRET"
generate_file_secret "SESSION_SECRET"
generate_file_secret "STORAGE_ENCRYPTION_KEY"

echo "--------------------------------------------------"
echo "✅ Authelia files ready in $AUTHELIA_SECRETS"
echo "--------------------------------------------------"
