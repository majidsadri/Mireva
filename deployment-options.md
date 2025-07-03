# Backend Deployment Options

## 1. Cloud VPS with Static IP (Best for Production)

### DigitalOcean Droplet
- Cost: $4-6/month for basic droplet
- Get static IP address
- Install your Flask app with gunicorn + nginx
- Set up SSL certificate with Let's Encrypt (free)
- Your app runs at: https://your-domain.com or https://your-static-ip

```bash
# Example setup on Ubuntu droplet:
sudo apt update
sudo apt install nginx python3-pip
pip3 install gunicorn
# Deploy your Flask app
# Configure nginx reverse proxy
# Set up SSL with certbot
```

### Benefits:
- Permanent IP/domain
- Professional setup
- SSL certificates
- Always online
- Better performance than ngrok

## 2. Railway.app (Easiest)
- Free tier available
- Automatic HTTPS
- Git-based deployment
- Your app gets: https://your-app.railway.app

```bash
# Deploy to Railway:
npm install -g @railway/cli
railway login
railway init
railway up
```

## 3. Heroku (Popular)
- Free tier discontinued, but $7/month
- Automatic HTTPS
- Easy deployment
- Your app gets: https://your-app.herokuapp.com

## 4. AWS EC2 with Elastic IP
- More complex but powerful
- Free tier for 1 year
- Static Elastic IP address
- Professional grade

## 5. Your Current AWS Setup + Domain
Since you're already on AWS EC2, you can:

1. **Get an Elastic IP** (Static IP)
   - Go to AWS Console → EC2 → Elastic IPs
   - Allocate new address
   - Associate with your instance
   - Cost: Free if attached to running instance

2. **Buy a domain** ($10-15/year)
   - Use AWS Route 53 or any domain registrar
   - Point domain to your Elastic IP

3. **Set up SSL**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

4. **Configure nginx reverse proxy**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       return 301 https://$server_name$request_uri;
   }
   
   server {
       listen 443 ssl;
       server_name yourdomain.com;
       
       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
       
       location / {
           proxy_pass http://127.0.0.1:5001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## Current vs Better Setup

### Current (ngrok):
```javascript
BASE_URL: 'https://51e3-18-215-164-114.ngrok-free.app'
```

### Better (with domain):
```javascript
BASE_URL: 'https://mireva-api.yourdomain.com'
// or
BASE_URL: 'https://api.mireva.app'
```

## Quick Fix for Your Current Setup

If you want to keep AWS but get a static setup:

1. **Get Elastic IP** (5 minutes)
2. **Use IP directly with HTTPS**:
   ```javascript
   BASE_URL: 'https://YOUR-ELASTIC-IP:5001'
   ```
3. **Set up self-signed certificate** for development:
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   # Then run Flask with SSL:
   app.run(host='0.0.0.0', port=5001, ssl_context=('cert.pem', 'key.pem'))
   ```

## Recommendation

For production: **DigitalOcean droplet + domain + Let's Encrypt SSL**
- $6/month for hosting
- $12/year for domain
- Free SSL certificate
- Professional setup

For development: **Railway.app**
- Free tier
- Instant deployment
- Automatic HTTPS
- No server management

Would you like me to help you set up any of these options?