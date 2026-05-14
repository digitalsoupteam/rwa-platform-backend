#!/bin/bash

# Configuration paths
AUTHELIA_SECRETS="./infrastructure/docker/authelia/secrets"

echo "--------------------------------------------------"
echo "🏗️  Phase 1: Generating Secrets"
echo "--------------------------------------------------"

# Create secrets directory
mkdir -p "$AUTHELIA_SECRETS"

# Function to generate secrets
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

# Generate required secrets
generate_secret "$AUTHELIA_SECRETS/JWT_SECRET"
generate_secret "$AUTHELIA_SECRETS/LLDAP_JWT_SECRET"
generate_secret "$AUTHELIA_SECRETS/SESSION_SECRET"
generate_secret "$AUTHELIA_SECRETS/STORAGE_ENCRYPTION_KEY"

echo "--------------------------------------------------"
echo "✅ Secret generation complete!"
