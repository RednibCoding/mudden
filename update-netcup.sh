#!/bin/bash
# Easy update script for Netcup deployment

# Configuration - CHANGE THESE TO YOUR VALUES
SERVER_IP="YOUR_SERVER_IP"          # e.g., 123.45.67.89
SERVER_USER="root"
SERVER_PATH="/opt/mudden"

echo "🚀 Updating Mudden on Netcup..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Build locally
echo "📦 Building locally..."
npm run build || { echo "❌ Build failed!"; exit 1; }

# Step 2: Upload to server
echo "📤 Uploading to server..."
echo "   (Excluding node_modules and .git)"

rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'client/node_modules' \
  ./ ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/

# Step 3: Install dependencies and restart on server
echo "🔧 Installing dependencies on server..."
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /opt/mudden
npm install --production
pm2 restart mudden
echo ""
echo "📊 Server status:"
pm2 status mudden
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Update complete!"
echo ""
echo "📝 View logs:   ssh ${SERVER_USER}@${SERVER_IP} 'pm2 logs mudden'"
echo "🌐 Connect at:  http://${SERVER_IP}:3000"
echo ""
