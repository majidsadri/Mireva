#!/bin/bash

# Script to deploy new recipe collection to Mireva.life
# Usage: ./deploy-new-recipes.sh

set -e  # Exit on any error

# Configuration
EC2_HOST="18.215.164.114"
EC2_USER="ubuntu"
SSH_KEY="~/.ssh/id_rsa"
REMOTE_DIR="/mnt/recipes"
LOCAL_RECIPES_DIR="./processed_recipes"
RECIPE_FILE="recipes.json"
METADATA_FILE="metadata.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🍽️  Deploying New Recipe Collection to Mireva.life${NC}"
echo "=" * 60

# Check if recipe file exists
if [[ ! -f "$LOCAL_RECIPES_DIR/$RECIPE_FILE" ]]; then
    echo -e "${RED}❌ Recipe file not found: $LOCAL_RECIPES_DIR/$RECIPE_FILE${NC}"
    echo -e "${YELLOW}💡 Please prepare recipes first${NC}"
    exit 1
fi

# Check if metadata file exists
if [[ ! -f "$LOCAL_RECIPES_DIR/$METADATA_FILE" ]]; then
    echo -e "${RED}❌ Metadata file not found: $LOCAL_RECIPES_DIR/$METADATA_FILE${NC}"
    echo -e "${YELLOW}💡 Please prepare metadata first${NC}"
    exit 1
fi

# Show what we're deploying
RECIPE_COUNT=$(jq length "$LOCAL_RECIPES_DIR/$RECIPE_FILE")
RECIPE_SIZE=$(du -h "$LOCAL_RECIPES_DIR/$RECIPE_FILE" | cut -f1)
echo -e "${BLUE}📊 Deployment Info:${NC}"
echo -e "${BLUE}  • Recipe file: $RECIPE_FILE${NC}"
echo -e "${BLUE}  • Total recipes: $RECIPE_COUNT${NC}"
echo -e "${BLUE}  • File size: $RECIPE_SIZE${NC}"
echo -e "${BLUE}  • Target: https://www.mireva.life/recipes.html${NC}"

# Ask for confirmation
echo ""
read -p "🚀 Deploy to Mireva.life and replace ALL existing recipes? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📋 Deployment cancelled${NC}"
    exit 0
fi

# Check SSH connectivity
echo -e "${YELLOW}🔍 Testing SSH connectivity...${NC}"
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'" &>/dev/null; then
    echo -e "${RED}❌ Cannot connect to EC2 server${NC}"
    echo -e "${YELLOW}💡 Please check your SSH key and server access${NC}"
    echo -e "${YELLOW}💡 Try: chmod 600 ~/.ssh/id_rsa${NC}"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection verified${NC}"

# Create remote directory structure
echo -e "${YELLOW}📁 Setting up remote directory structure...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    sudo mkdir -p $REMOTE_DIR/{data,api,backups}
    sudo chown -R $EC2_USER:$EC2_USER $REMOTE_DIR
    sudo chmod -R 755 $REMOTE_DIR
"

# Backup existing recipes if they exist
echo -e "${YELLOW}💾 Creating backup of existing recipes...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    if [[ -f $REMOTE_DIR/data/recipes.json ]]; then
        sudo cp $REMOTE_DIR/data/recipes.json $REMOTE_DIR/backups/recipes_backup_\$(date +%Y%m%d_%H%M%S).json
        echo '✅ Backup created successfully'
    else
        echo '📝 No existing recipes to backup'
    fi
"

# Upload new recipe data
echo -e "${YELLOW}📤 Uploading new recipe collection...${NC}"
scp -i "$SSH_KEY" "$LOCAL_RECIPES_DIR/$RECIPE_FILE" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/data/recipes.json"

# Upload metadata
echo -e "${YELLOW}📋 Uploading metadata...${NC}"
scp -i "$SSH_KEY" "$LOCAL_RECIPES_DIR/$METADATA_FILE" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/data/metadata.json"

# Create deployment info
echo -e "${YELLOW}📊 Creating deployment information...${NC}"
DEPLOYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
cat > $REMOTE_DIR/data/deployment.json << EOF
{
  \"deployment_date\": \"$DEPLOYMENT_DATE\",
  \"recipe_count\": $RECIPE_COUNT,
  \"file_size\": \"$RECIPE_SIZE\",
  \"deployment_type\": \"new_collection\",
  \"source\": \"Spoonacular API + Curated Collection\",
  \"target_url\": \"https://www.mireva.life/recipes.html\",
  \"api_endpoints\": [
    \"/api/recipes/stats\",
    \"/api/recipes/search\",
    \"/api/recipes/random\"
  ]
}
EOF
"

# Set up or restart recipe API server
echo -e "${YELLOW}🚀 Setting up recipe API server...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    # Check if API server exists
    if [[ ! -f $REMOTE_DIR/api/recipe_server.py ]]; then
        echo '📝 Creating recipe API server...'
        
        # Create a simple Python API server
        cat > $REMOTE_DIR/api/recipe_server.py << 'EOF'
#!/usr/bin/env python3
import json
import random
from flask import Flask, jsonify, request
from flask_cors import CORS
from pathlib import Path
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)  # Enable CORS for all domains

# Data directory
DATA_DIR = Path('/mnt/recipes/data')

def load_recipes():
    try:
        with open(DATA_DIR / 'recipes.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f'Error loading recipes: {e}')
        return []

def load_metadata():
    try:
        with open(DATA_DIR / 'metadata.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f'Error loading metadata: {e}')
        return {}

@app.route('/api/recipes/stats')
def get_stats():
    recipes = load_recipes()
    metadata = load_metadata()
    
    return jsonify({
        'total_recipes': len(recipes),
        'metadata': metadata
    })

@app.route('/api/recipes/search')
def search_recipes():
    recipes = load_recipes()
    query = request.args.get('q', '').lower()
    limit = int(request.args.get('limit', 24))
    
    if query:
        # Simple search in name, ingredients, and tags
        filtered = []
        for recipe in recipes:
            if (query in recipe.get('name', '').lower() or
                any(query in ing.lower() for ing in recipe.get('ingredients', [])) or
                any(query in tag.lower() for tag in recipe.get('tags', []))):
                filtered.append(recipe)
        
        return jsonify(filtered[:limit])
    else:
        # Return random selection
        return jsonify(random.sample(recipes, min(limit, len(recipes))))

@app.route('/api/recipes/random')
def random_recipes():
    recipes = load_recipes()
    count = int(request.args.get('count', 10))
    
    if len(recipes) == 0:
        return jsonify([])
    
    return jsonify(random.sample(recipes, min(count, len(recipes))))

@app.route('/api/recipes/<recipe_id>')
def get_recipe(recipe_id):
    recipes = load_recipes()
    
    for recipe in recipes:
        if recipe.get('id') == recipe_id:
            return jsonify(recipe)
    
    return jsonify({'error': 'Recipe not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=False)
EOF

        chmod +x $REMOTE_DIR/api/recipe_server.py
    fi
    
    # Install required Python packages
    sudo apt-get update -qq
    sudo apt-get install -y python3-pip
    pip3 install flask flask-cors --user
    
    # Create systemd service
    sudo tee /etc/systemd/system/mireva-recipes.service > /dev/null << EOF
[Unit]
Description=Mireva Recipe API Server
After=network.target

[Service]
Type=simple
User=$EC2_USER
WorkingDirectory=$REMOTE_DIR/api
ExecStart=/usr/bin/python3 recipe_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Start and enable the service
    sudo systemctl daemon-reload
    sudo systemctl stop mireva-recipes 2>/dev/null || true
    sudo systemctl start mireva-recipes
    sudo systemctl enable mireva-recipes
    
    echo '✅ Recipe API server started on port 5002'
"

# Configure nginx to proxy API requests
echo -e "${YELLOW}🌐 Configuring nginx for recipe API...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    # Create nginx configuration for recipe API
    sudo tee /etc/nginx/sites-available/recipes-api > /dev/null << 'EOF'
location /api/recipes/ {
    proxy_pass http://localhost:5002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
}
EOF

    # Include in main nginx config
    if ! grep -q 'include /etc/nginx/sites-available/recipes-api' /etc/nginx/sites-available/default; then
        sudo sed -i '/server {/a\\    include /etc/nginx/sites-available/recipes-api;' /etc/nginx/sites-available/default
    fi
    
    # Test and reload nginx
    sudo nginx -t && sudo systemctl reload nginx
    
    echo '✅ Nginx configured for recipe API'
"

# Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    echo '📊 Recipe API Status:'
    sudo systemctl status mireva-recipes --no-pager -l
    
    echo -e '\\n📈 API Test:'
    curl -s http://localhost:5002/api/recipes/stats | jq . || echo 'API test failed'
"

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}🌐 Your new recipe collection is now live at:${NC}"
echo -e "${BLUE}  • Website: https://www.mireva.life/recipes.html${NC}"
echo -e "${BLUE}  • API Stats: https://mireva.life/api/recipes/stats${NC}"
echo -e "${BLUE}  • API Search: https://mireva.life/api/recipes/search?q=pasta${NC}"
echo -e "${BLUE}  • Random Recipes: https://mireva.life/api/recipes/random${NC}"
echo ""
echo -e "${GREEN}🎉 All old recipes have been replaced with your new collection!${NC}"

# Show final statistics
echo -e "${YELLOW}📋 Final Statistics:${NC}"
echo -e "${YELLOW}  • Recipes deployed: $RECIPE_COUNT${NC}"
echo -e "${YELLOW}  • File size: $RECIPE_SIZE${NC}"
echo -e "${YELLOW}  • Deployment time: $(date)${NC}"