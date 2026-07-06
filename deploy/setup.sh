#!/bin/bash
# DigitalOcean Ubuntu 22.04 — Elysian Admin Server Setup
# Run as root: bash setup.sh YOUR_GITHUB_REPO_URL

set -e

REPO_URL=${1:-""}
APP_DIR="/var/www/dubai-portal"

echo ""
echo "============================================"
echo "  Elysian Admin Server Setup"
echo "============================================"
echo ""

# ── 1. System update ─────────────────────────────────────────────────────────
echo "[1/8] Updating system packages..."
apt update -y && apt upgrade -y
apt install -y git curl wget ufw

# ── 2. Python 3.11 ───────────────────────────────────────────────────────────
echo "[2/8] Installing Python 3.11..."
apt install -y python3.11 python3.11-venv python3-pip

# ── 3. nginx + certbot ───────────────────────────────────────────────────────
echo "[3/8] Installing nginx and certbot..."
apt install -y nginx certbot python3-certbot-nginx

# ── 4. Playwright system dependencies ────────────────────────────────────────
echo "[4/8] Installing Playwright (Chromium) system dependencies..."
apt install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libfontconfig1 \
    fonts-liberation \
    xvfb

# ── 5. Clone repo ─────────────────────────────────────────────────────────────
echo "[5/8] Cloning repository..."
mkdir -p $APP_DIR
if [ -n "$REPO_URL" ]; then
    git clone "$REPO_URL" "$APP_DIR"
else
    echo "  ⚠  No repo URL provided. Clone manually:"
    echo "  git clone https://github.com/YOUR_USERNAME/dubai-portal.git $APP_DIR"
fi

# ── 6. Python venv + dependencies ─────────────────────────────────────────────
echo "[6/8] Setting up Python environment..."
cd "$APP_DIR/extractor"
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
playwright install chromium
playwright install-deps chromium
deactivate

# ── 7. Firewall ───────────────────────────────────────────────────────────────
echo "[7/8] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 8. Systemd service ────────────────────────────────────────────────────────
echo "[8/8] Installing Flask admin service..."
cp "$APP_DIR/deploy/flask-admin.service" /etc/systemd/system/flask-admin.service
systemd-cat -t flask-admin echo "Service file installed"
systemctl daemon-reload
systemctl enable flask-admin

echo ""
echo "============================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Copy your .env file to $APP_DIR/extractor/.env"
echo "  2. Run: systemctl start flask-admin"
echo "  3. Run: bash $APP_DIR/deploy/ssl.sh admin.elysian.ae"
echo "============================================"
echo ""
