#!/bin/bash

# Usage: ./deploy-backend.sh <EC2_PUBLIC_IP> <PATH_TO_PEM_KEY>

IP=$1
KEY=$2

if [ -z "$IP" ] || [ -z "$KEY" ]; then
  echo "Usage: ./deploy-backend.sh <EC2_PUBLIC_IP> <PATH_TO_PEM_KEY>"
  exit 1
fi

echo "=========================================="
echo "🚀 Starting Backend Deployment to $IP"
echo "=========================================="

# 1. Fix Key Permissions
chmod 400 "$KEY"

# 2. Create directory on server
echo "📂 Creating directory on server..."
ssh -i "$KEY" -o StrictHostKeyChecking=no ubuntu@$IP "mkdir -p ~/app"

# 3. Sync Files (Rsync)
# We exclude frontend/admin folders since we only need backend
echo "📤 Uploading files..."
rsync -avz -e "ssh -i $KEY" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next' \
  --exclude '.cache' \
  --exclude 'dist' \
  --exclude 'tmp' \
  --exclude 'ecommerce-aayeu-frontend-main' \
  --exclude 'ecommerce-aayeu-admin-main' \
  ./ ubuntu@$IP:~/app/

echo "✅ Upload complete."

# 4. Run Docker Compose on Server
echo "🐳 Starting Docker containers on server..."
ssh -i "$KEY" ubuntu@$IP << EOF
  cd ~/app
  
  # Install Docker if needed
  if ! command -v docker &> /dev/null; then
      echo "Installing Docker..."
      sudo apt-get update
      sudo apt-get install -y ca-certificates curl gnupg
      sudo install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      sudo chmod a+r /etc/apt/keyrings/docker.gpg
      echo \
        "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        \$(. /etc/os-release && echo "\$VERSION_CODENAME") stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  # Stop old containers (including frontend/admin if they were running)
  sudo docker compose -f docker-compose.test.yml down || true
  sudo docker compose -f docker-compose.backend.yml down || true

  # Clean up old frontend/admin directories to save space
  echo "🧹 Cleaning up old frontend and admin files..."
  rm -rf ecommerce-aayeu-frontend-main ecommerce-aayeu-admin-main

  # Start Backend Services
  sudo docker compose -f docker-compose.backend.yml up -d --build

  # Update Caddy Configuration
  echo "🔄 Updating Caddy configuration..."
  sudo mkdir -p /var/www/aayeu
  sudo cp ~/app/maintenance.html /var/www/aayeu/index.html
  sudo cp ~/app/maintenance.html /var/www/aayeu/maintenance.html
  sudo chown -R caddy:caddy /var/www/aayeu
  sudo cp ~/app/Caddyfile /etc/caddy/Caddyfile
  sudo systemctl reload caddy
  echo "✅ Caddy reloaded."

  # Prune unused images to save space
  sudo docker image prune -f
EOF

echo "=========================================="
echo "🎉 Backend Deployment Complete!"
echo "Backend API: https://api.aayeu.com (via Caddy) or http://$IP:5000"
echo "=========================================="
