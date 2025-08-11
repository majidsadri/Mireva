#!/bin/bash

# Simple script to deploy Food.com recipes to EC2 server
# Usage: ./deploy-recipes-simple.sh [sample|full]

set -e  # Exit on any error

# Configuration
EC2_HOST="18.215.164.114"
EC2_USER="ubuntu"
SSH_KEY="~/.ssh/id_rsa"
REMOTE_DIR="/mnt/recipes"
LOCAL_RECIPES_DIR="./processed_recipes"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🍳 Deploying Food.com Recipes to EC2${NC}"
echo "=========================================="

# Check if we're deploying sample or full dataset
DEPLOY_TYPE=${1:-"sample"}
if [[ "$DEPLOY_TYPE" == "sample" ]]; then
    RECIPE_FILE="recipes_sample_1000.json"
    echo -e "${YELLOW}📝 Deploying sample dataset (1000 recipes)${NC}"
elif [[ "$DEPLOY_TYPE" == "full" ]]; then
    RECIPE_FILE="recipes.json"
    echo -e "${YELLOW}📚 Deploying full dataset${NC}"
else
    echo -e "${RED}❌ Invalid deployment type. Use 'sample' or 'full'${NC}"
    exit 1
fi

# Check if recipe file exists
if [[ ! -f "$LOCAL_RECIPES_DIR/$RECIPE_FILE" ]]; then
    echo -e "${RED}❌ Recipe file not found: $LOCAL_RECIPES_DIR/$RECIPE_FILE${NC}"
    echo -e "${YELLOW}💡 Please run fetch-recipes.py first${NC}"
    exit 1
fi

# Check SSH connectivity
echo -e "${YELLOW}🔍 Testing SSH connectivity...${NC}"
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'" &>/dev/null; then
    echo -e "${RED}❌ Cannot connect to EC2 server${NC}"
    echo -e "${YELLOW}💡 Please check your SSH key and server access${NC}"
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
        cp $REMOTE_DIR/data/recipes.json $REMOTE_DIR/backups/recipes_backup_\$(date +%Y%m%d_%H%M%S).json
        echo 'Backup created'
    else
        echo 'No existing recipes to backup'
    fi
"

# Upload recipe data
echo -e "${YELLOW}📤 Uploading recipe data...${NC}"
RECIPE_SIZE=$(du -h "$LOCAL_RECIPES_DIR/$RECIPE_FILE" | cut -f1)
echo -e "${YELLOW}📊 File size: $RECIPE_SIZE${NC}"

scp -i "$SSH_KEY" "$LOCAL_RECIPES_DIR/$RECIPE_FILE" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/data/recipes.json"

# Create recipe metadata
echo -e "${YELLOW}📋 Creating recipe metadata...${NC}"
RECIPE_COUNT=$(jq length "$LOCAL_RECIPES_DIR/$RECIPE_FILE")
DEPLOYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
cat > $REMOTE_DIR/data/metadata.json << EOF
{
  \"dataset_source\": \"Food.com via Kaggle\",
  \"dataset_url\": \"https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions\",
  \"deployment_date\": \"$DEPLOYMENT_DATE\",
  \"deployment_type\": \"$DEPLOY_TYPE\",
  \"recipe_count\": $RECIPE_COUNT,
  \"file_size\": \"$RECIPE_SIZE\",
  \"data_structure\": {
    \"fields\": [\"id\", \"name\", \"ingredients\", \"steps\", \"description\", \"minutes\", \"n_steps\", \"n_ingredients\", \"nutrition\", \"tags\"],
    \"format\": \"JSON array of recipe objects\"
  }
}
EOF
"

# Create simple recipe API server
echo -e "${YELLOW}🔌 Creating recipe API server...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
cat > $REMOTE_DIR/api/recipe_server.py << 'EOF'
#!/usr/bin/env python3
\"\"\"
Simple Flask API server for Food.com recipes
\"\"\"

import json
import os
try:
    from flask import Flask, jsonify, request
    from flask_cors import CORS
except ImportError:
    print('Flask not installed. Installing...')
    os.system('pip3 install flask flask-cors --break-system-packages')
    from flask import Flask, jsonify, request
    from flask_cors import CORS

import random

app = Flask(__name__)
CORS(app)

# Load recipes
RECIPES_FILE = '/mnt/recipes/data/recipes.json'
recipes = []
metadata = {}

def load_data():
    global recipes, metadata
    try:
        with open(RECIPES_FILE, 'r', encoding='utf-8') as f:
            recipes = json.load(f)
        
        with open('/mnt/recipes/data/metadata.json', 'r') as f:
            metadata = json.load(f)
            
        print(f'Loaded {len(recipes)} recipes')
    except Exception as e:
        print(f'Error loading recipes: {e}')

@app.route('/')
def home():
    return jsonify({'message': 'Mireva Recipe API', 'status': 'running'})

@app.route('/api/recipes/stats')
def get_stats():
    \"\"\"Get recipe database statistics\"\"\"
    return jsonify({
        'total_recipes': len(recipes),
        'metadata': metadata
    })

@app.route('/api/recipes/search')
def search_recipes():
    \"\"\"Search recipes by name, ingredients, or tags\"\"\"
    query = request.args.get('q', '').lower()
    limit = int(request.args.get('limit', 20))
    
    if not query:
        # Return random recipes if no query
        return jsonify(random.sample(recipes, min(limit, len(recipes))))
    
    results = []
    for recipe in recipes:
        if (query in recipe.get('name', '').lower() or
            any(query in ing.lower() for ing in recipe.get('ingredients', [])) or
            any(query in tag.lower() for tag in recipe.get('tags', []))):
            results.append(recipe)
            if len(results) >= limit:
                break
    
    return jsonify(results)

@app.route('/api/recipes/<recipe_id>')
def get_recipe(recipe_id):
    \"\"\"Get specific recipe by ID\"\"\"
    for recipe in recipes:
        if recipe.get('id') == recipe_id:
            return jsonify(recipe)
    
    return jsonify({'error': 'Recipe not found'}), 404

@app.route('/api/recipes/random')
def random_recipes():
    \"\"\"Get random recipes\"\"\"
    count = int(request.args.get('count', 10))
    return jsonify(random.sample(recipes, min(count, len(recipes))))

@app.route('/api/recipes/by-tag/<tag>')
def recipes_by_tag(tag):
    \"\"\"Get recipes by specific tag\"\"\"
    limit = int(request.args.get('limit', 20))
    
    results = []
    for recipe in recipes:
        if tag.lower() in [t.lower() for t in recipe.get('tags', [])]:
            results.append(recipe)
            if len(results) >= limit:
                break
    
    return jsonify(results)

if __name__ == '__main__':
    load_data()
    app.run(host='0.0.0.0', port=5002, debug=False)
EOF

# Make it executable
chmod +x $REMOTE_DIR/api/recipe_server.py
"

# Install dependencies and start the service manually
echo -e "${YELLOW}⚙️ Starting recipe API server...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    # Install Python dependencies
    pip3 install flask flask-cors --break-system-packages || echo 'Dependencies already installed'
    
    # Kill any existing process on port 5002
    pkill -f 'recipe_server.py' || echo 'No existing process'
    
    # Start the server in background
    cd $REMOTE_DIR/api
    nohup python3 recipe_server.py > ../recipe_api.log 2>&1 &
    
    # Wait a moment for server to start
    sleep 3
    
    # Test if server is running
    if curl -s http://localhost:5002/ | grep -q 'running'; then
        echo 'Recipe API started successfully'
    else
        echo 'Warning: Recipe API may not have started properly'
        echo 'Check log: tail $REMOTE_DIR/recipe_api.log'
    fi
"

# Create simple recipe browser HTML page (skip nginx config for now)
echo -e "${YELLOW}🌐 Creating recipe browser page...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
cat > /var/www/mireva.life/recipes.html << 'EOF'
<!DOCTYPE html>
<html lang=\"en\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>Mireva Recipes - Food.com Collection</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .search-box { width: 100%; max-width: 500px; padding: 15px; font-size: 16px; border: 2px solid #ddd; border-radius: 25px; margin: 20px auto; display: block; }
        .stats { background: white; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
        .recipes { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .recipe { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .recipe h3 { margin: 0 0 10px 0; color: #333; }
        .recipe-meta { font-size: 14px; color: #666; margin-bottom: 10px; }
        .ingredients { margin: 10px 0; }
        .ingredient { background: #e8f4f8; padding: 3px 8px; margin: 2px; display: inline-block; border-radius: 15px; font-size: 12px; }
        .steps { margin-top: 10px; }
        .step { margin: 5px 0; padding: 5px; background: #f9f9f9; border-left: 3px solid #007acc; }
        .tags { margin-top: 10px; }
        .tag { background: #fff3cd; padding: 2px 6px; margin: 1px; display: inline-block; border-radius: 10px; font-size: 11px; }
        .loading { text-align: center; padding: 50px; color: #666; }
    </style>
</head>
<body>
    <div class=\"container\">
        <div class=\"header\">
            <h1>🍳 Mireva Recipes</h1>
            <p>Food.com Recipe Collection</p>
        </div>
        
        <div id=\"stats\" class=\"stats\">
            <div class=\"loading\">Loading recipe database...</div>
        </div>
        
        <input type=\"text\" id=\"searchBox\" class=\"search-box\" placeholder=\"Search recipes, ingredients, or tags...\">
        
        <div id=\"recipes\" class=\"recipes\">
            <div class=\"loading\">Loading recipes...</div>
        </div>
    </div>

    <script>
        const API_BASE = 'https://mireva.life:5002';
        let allRecipes = [];

        async function loadStats() {
            try {
                const response = await fetch(\`\${API_BASE}/api/recipes/stats\`);
                const data = await response.json();
                document.getElementById('stats').innerHTML = \`
                    <h3>📊 Recipe Database Stats</h3>
                    <p><strong>\${data.total_recipes.toLocaleString()}</strong> recipes from Food.com</p>
                    <p>Deployed: \${new Date(data.metadata.deployment_date).toLocaleDateString()}</p>
                \`;
            } catch (error) {
                console.error('Error loading stats:', error);
                document.getElementById('stats').innerHTML = '<p>Error loading stats</p>';
            }
        }

        async function loadRecipes(query = '') {
            try {
                const url = query ? \`\${API_BASE}/api/recipes/search?q=\${encodeURIComponent(query)}&limit=50\` : \`\${API_BASE}/api/recipes/random?count=20\`;
                const response = await fetch(url);
                const recipes = await response.json();
                displayRecipes(recipes);
            } catch (error) {
                console.error('Error loading recipes:', error);
                document.getElementById('recipes').innerHTML = '<div class=\"loading\">Error loading recipes. Check if API is running.</div>';
            }
        }

        function displayRecipes(recipes) {
            const container = document.getElementById('recipes');
            if (recipes.length === 0) {
                container.innerHTML = '<div class=\"loading\">No recipes found</div>';
                return;
            }

            container.innerHTML = recipes.map(recipe => \`
                <div class=\"recipe\">
                    <h3>\${recipe.name || 'Unnamed Recipe'}</h3>
                    <div class=\"recipe-meta\">
                        ⏱️ \${recipe.minutes || 0} min | 
                        🥄 \${recipe.n_steps || 0} steps | 
                        🛒 \${recipe.n_ingredients || 0} ingredients
                    </div>
                    <div class=\"ingredients\">
                        \${(recipe.ingredients || []).slice(0, 8).map(ing => 
                            \`<span class=\"ingredient\">\${ing}</span>\`
                        ).join('')}
                        \${recipe.ingredients && recipe.ingredients.length > 8 ? '<span class=\"ingredient\">...</span>' : ''}
                    </div>
                    <div class=\"steps\">
                        \${(recipe.steps || []).slice(0, 3).map((step, i) => 
                            \`<div class=\"step\">\${i + 1}. \${step.substring(0, 100)}...</div>\`
                        ).join('')}
                    </div>
                    \${recipe.tags && recipe.tags.length > 0 ? \`
                        <div class=\"tags\">
                            \${recipe.tags.slice(0, 5).map(tag => \`<span class=\"tag\">\${tag}</span>\`).join('')}
                        </div>
                    \` : ''}
                </div>
            \`).join('');
        }

        // Search functionality
        let searchTimeout;
        document.getElementById('searchBox').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadRecipes(e.target.value);
            }, 500);
        });

        // Initial load
        loadStats();
        loadRecipes();
    </script>
</body>
</html>
EOF

sudo chown www-data:www-data /var/www/mireva.life/recipes.html
"

# Final verification
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
sleep 3

# Check recipe API
echo -e "${YELLOW}Testing recipe API...${NC}"
if ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "curl -s http://localhost:5002/api/recipes/stats" | grep -q "total_recipes"; then
    echo -e "${GREEN}✅ Recipe API is running${NC}"
else
    echo -e "${RED}⚠️ Recipe API may not be running properly${NC}"
    echo -e "${YELLOW}Check logs: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'tail /mnt/recipes/recipe_api.log'${NC}"
fi

# Final summary
echo -e "${GREEN}"
echo "🎉 Recipe deployment completed!"
echo "============================="
echo -e "${NC}"
echo "📊 Recipe Stats:"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    echo '   - Recipe count: $RECIPE_COUNT'
    echo '   - File size: $RECIPE_SIZE'
    echo '   - Deployment type: $DEPLOY_TYPE'
    echo '   - API log: tail /mnt/recipes/recipe_api.log'
"

echo ""
echo "🔗 Access URLs:"
echo "   - Recipe Browser: https://www.mireva.life/recipes.html"
echo "   - Direct API: http://$EC2_HOST:5002/api/recipes/stats"

echo ""
echo "🛠️ Management Commands:"
echo "   - Check API: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'curl http://localhost:5002/'"
echo "   - View logs: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'tail -f /mnt/recipes/recipe_api.log'"
echo "   - Restart API: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'pkill -f recipe_server.py && cd /mnt/recipes/api && nohup python3 recipe_server.py &'"

echo -e "${GREEN}✨ Happy cooking! 🍳${NC}"