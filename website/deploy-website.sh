#!/bin/bash

# Script to deploy Mireva website to EC2
echo "🌐 Deploying Mireva website to EC2..."

# Create website directory on EC2
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 "sudo mkdir -p /var/www/mireva.life"

# Copy website files to EC2
scp -i ~/.ssh/id_rsa *.html *.xml *.txt *.png ubuntu@18.215.164.114:~/website/
scp -i ~/.ssh/id_rsa mireva-shop.png ubuntu@18.215.164.114:~/website/
scp -i ~/.ssh/id_rsa -r blog ubuntu@18.215.164.114:~/website/
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 "sudo cp ~/website/* /var/www/mireva.life/ 2>/dev/null || true"
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 "sudo cp -r ~/website/blog /var/www/mireva.life/"

# Create nginx configuration for the website
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 "sudo tee /etc/nginx/sites-available/mireva-website << 'EOF'
# Website configuration (port 80 - will redirect to HTTPS)
server {
    listen 80;
    server_name www.mireva.life;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS website configuration
server {
    listen 443 ssl http2;
    server_name www.mireva.life;

    ssl_certificate /etc/letsencrypt/live/mireva.life/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mireva.life/privkey.pem;

    root /var/www/mireva.life;
    index index.html;

    # Serve static files
    location / {
        try_files \$uri \$uri/ =404;
    }

    # Recipe API routes on www subdomain  
    location /api/recipes {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Accept, Origin, ngrok-skip-browser-warning' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }
}

# API configuration (existing)
server {
    listen 80;
    server_name mireva.life api.mireva.life;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mireva.life api.mireva.life;

    ssl_certificate /etc/letsencrypt/live/mireva.life/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mireva.life/privkey.pem;

    # Recipe API routes
    location /api/recipes {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Accept, Origin, ngrok-skip-browser-warning' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Pantry API routes (if any - keeping for backward compatibility)
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Accept, Origin, ngrok-skip-browser-warning' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }

    client_max_body_size 10M;
}
EOF"

# Enable the new configuration
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 "sudo rm -f /etc/nginx/sites-enabled/mireva && sudo ln -sf /etc/nginx/sites-available/mireva-website /etc/nginx/sites-enabled/mireva-website"

# Test and reload nginx
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 "sudo nginx -t && sudo systemctl reload nginx"

# Get SSL certificate for www subdomain if needed
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 "sudo certbot --nginx -d www.mireva.life --non-interactive --agree-tos --email admin@mireva.life || echo 'SSL certificate already exists or failed'"

echo "✅ Website deployed successfully!"
echo "📱 Website: https://www.mireva.life"
echo "🔌 API: https://mireva.life"
echo ""
echo "Test the deployment:"
echo "curl https://www.mireva.life"
echo "curl https://mireva.life/pantry"