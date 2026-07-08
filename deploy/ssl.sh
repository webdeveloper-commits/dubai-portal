#!/bin/bash
# Run after DNS is pointed to this server.
# Usage: bash ssl.sh admin.propsale.co

DOMAIN=${1:-"admin.propsale.co"}
APP_DIR="/var/www/dubai-portal"

echo "Setting up nginx + SSL for $DOMAIN..."

# Copy nginx config
cp "$APP_DIR/deploy/nginx-admin.conf" /etc/nginx/sites-available/admin
ln -sf /etc/nginx/sites-available/admin /etc/nginx/sites-enabled/admin
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

# Get SSL certificate
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m marketing@elysian.com

systemctl reload nginx

echo ""
echo "Done! Admin panel is live at https://$DOMAIN"
