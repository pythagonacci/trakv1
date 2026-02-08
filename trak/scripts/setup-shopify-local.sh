#!/bin/bash

# Shopify Local Development Setup Script
# This script helps you set up environment variables for local Shopify testing

set -e

echo "🛍️  Shopify Local Development Setup"
echo "===================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ .env.local not found. Creating one..."
  touch .env.local
fi

# Generate encryption key if needed
if ! grep -q "SHOPIFY_TOKEN_ENCRYPTION_KEY" .env.local; then
  echo "🔐 Generating encryption key..."
  ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  echo "SHOPIFY_TOKEN_ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env.local
  echo "✅ Encryption key generated and added to .env.local"
else
  echo "✅ Encryption key already exists"
fi

# Generate CRON_SECRET if needed
if ! grep -q "CRON_SECRET" .env.local; then
  echo "🔐 Generating CRON_SECRET..."
  CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "CRON_SECRET=$CRON_SECRET" >> .env.local
  echo "✅ CRON_SECRET generated and added to .env.local"
else
  echo "✅ CRON_SECRET already exists"
fi

echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Choose a tunneling solution:"
echo "   Option A - ngrok (quick, new URL each restart):"
echo "      brew install ngrok"
echo "      ngrok http 3000"
echo ""
echo "   Option B - Cloudflare Tunnel (free, persistent):"
echo "      brew install cloudflare/cloudflare/cloudflared"
echo "      cloudflared tunnel --url http://localhost:3000"
echo ""
echo "2. Get your public URL from the tunnel output (e.g., https://abc123.ngrok-free.app)"
echo ""
echo "3. Add to .env.local:"
echo "   NEXT_PUBLIC_APP_URL=https://your-tunnel-url.com"
echo "   SHOPIFY_CLIENT_ID=<from-partner-dashboard>"
echo "   SHOPIFY_CLIENT_SECRET=<from-partner-dashboard>"
echo ""
echo "4. Configure Shopify Partner Dashboard:"
echo "   - Go to https://partners.shopify.com"
echo "   - Create a new Public App"
echo "   - Set App URL: https://your-tunnel-url.com/"
echo "   - Set Redirect URL: https://your-tunnel-url.com/api/shopify/callback"
echo "   - Scopes: read_products, read_inventory, read_orders"
echo ""
echo "5. Start dev server:"
echo "   npm run dev"
echo ""
echo "6. Test the integration:"
echo "   Navigate to http://localhost:3000/dashboard/settings/integrations"
echo ""
echo "✅ Setup script complete!"
