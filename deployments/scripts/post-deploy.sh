#!/bin/bash

echo "--------------------------------------------------"
echo "🚀 Phase 2: Post-deployment Initialization"
echo "--------------------------------------------------"

# 1. Wait for LLDAP to be ready
echo "Waiting for LLDAP container to be healthy..."
sleep 5

# 2. Set LLDAP admin password
echo "Setting up LLDAP admin password..."
read -s -p "Enter new password for LLDAP admin: " lldap_pass
echo
docker exec -it lldap /app/lldap_set_password -u admin -p "$lldap_pass"

# 3. Verify Nginx
echo "Verifying Nginx configuration..."
docker exec -it nginx nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx config is valid. Reloading..."
    docker exec -it nginx nginx -s reload
else
    echo "❌ Nginx config error! Please check logs."
fi

echo "--------------------------------------------------"
echo "🎉 Deployment process finished!"
echo "Check your services at:"
echo "- https://rwa.local"
echo "- https://auth.rwa.local"
echo "- https://admin.rwa.local"
