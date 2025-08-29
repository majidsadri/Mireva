#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server details
SERVER_USER="ubuntu"
SERVER_IP="18.215.164.114"
SERVER_RECIPE_PATH="/mnt/recipes/data/recipes.json"
SERVER_BACKUP_DIR="/mnt/recipes/backups"
SSH_KEY="$HOME/.ssh/id_rsa"

# Get the recipe file to deploy
if [ $# -eq 0 ]; then
    # Find the most recent new_recipes or processed file
    RECIPE_FILE=$(ls -t new_recipes_*.json processed_recipes/*.json 2>/dev/null | head -1)
    if [ -z "$RECIPE_FILE" ]; then
        echo -e "${RED}❌ No recipe files found to deploy${NC}"
        exit 1
    fi
    echo -e "${BLUE}📦 Auto-selected most recent file: $RECIPE_FILE${NC}"
else
    RECIPE_FILE="$1"
fi

# Check if file exists
if [ ! -f "$RECIPE_FILE" ]; then
    echo -e "${RED}❌ File not found: $RECIPE_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Starting recipe deployment...${NC}"
echo -e "${BLUE}📄 Deploying: $RECIPE_FILE${NC}"

# Step 1: Download current recipes from server
echo -e "\n${YELLOW}1️⃣ Downloading current recipes from server...${NC}"
scp -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP:$SERVER_RECIPE_PATH" current_recipes.json
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to download current recipes${NC}"
    exit 1
fi

# Get current count
CURRENT_COUNT=$(python3 -c "import json; print(len(json.load(open('current_recipes.json'))))" 2>/dev/null || echo 0)
echo -e "${GREEN}✅ Downloaded $CURRENT_COUNT existing recipes${NC}"

# Step 2: Merge recipes
echo -e "\n${YELLOW}2️⃣ Merging new recipes...${NC}"
python3 - <<EOF
import json
from datetime import datetime

# Load current recipes
with open('current_recipes.json', 'r') as f:
    current_recipes = json.load(f)

# Load new recipes
with open('$RECIPE_FILE', 'r') as f:
    new_recipes = json.load(f)

# Create ID sets for duplicate detection
current_ids = {r.get('id') for r in current_recipes}
current_spoonacular_ids = {r.get('spoonacular_id') for r in current_recipes if r.get('spoonacular_id')}

# Add new recipes (skip duplicates)
added = 0
skipped = 0
for recipe in new_recipes:
    recipe_id = recipe.get('id')
    spoonacular_id = recipe.get('spoonacular_id')
    
    if recipe_id in current_ids:
        skipped += 1
        continue
    if spoonacular_id and spoonacular_id in current_spoonacular_ids:
        skipped += 1
        continue
    
    current_recipes.append(recipe)
    added += 1

# Save merged recipes
with open('merged_recipes.json', 'w') as f:
    json.dump(current_recipes, f, indent=2)

print(f"✅ Added {added} new recipes")
print(f"⚠️  Skipped {skipped} duplicates")
print(f"📊 Total recipes: {len(current_recipes)}")

# Update cache
try:
    with open('recipe_cache.json', 'w') as f:
        cache_data = {
            'last_updated': datetime.now().isoformat(),
            'total_recipes': len(current_recipes),
            'recipe_ids': list({r.get('id') for r in current_recipes}),
            'spoonacular_ids': list({r.get('spoonacular_id') for r in current_recipes if r.get('spoonacular_id')})
        }
        json.dump(cache_data, f, indent=2)
    print("📝 Updated local cache")
except:
    pass
EOF

if [ ! -f "merged_recipes.json" ]; then
    echo -e "${RED}❌ Failed to merge recipes${NC}"
    exit 1
fi

# Step 3: Create backup on server
echo -e "\n${YELLOW}3️⃣ Creating backup on server...${NC}"
BACKUP_NAME="recipes_backup_$(date +%Y%m%d_%H%M%S).json"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "cp $SERVER_RECIPE_PATH $SERVER_BACKUP_DIR/$BACKUP_NAME"
echo -e "${GREEN}✅ Backup created: $BACKUP_NAME${NC}"

# Step 4: Upload merged recipes
echo -e "\n${YELLOW}4️⃣ Uploading merged recipes...${NC}"
scp -i "$SSH_KEY" merged_recipes.json "$SERVER_USER@$SERVER_IP:$SERVER_RECIPE_PATH"
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to upload recipes${NC}"
    echo -e "${YELLOW}⚠️  Restoring from backup...${NC}"
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "cp $SERVER_BACKUP_DIR/$BACKUP_NAME $SERVER_RECIPE_PATH"
    exit 1
fi

# Step 5: Restart API server
echo -e "\n${YELLOW}5️⃣ Restarting API server...${NC}"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "sudo systemctl restart mireva-api"
sleep 2

# Step 6: Verify deployment
echo -e "\n${YELLOW}6️⃣ Verifying deployment...${NC}"
RESPONSE=$(curl -s https://mireva.life/api/recipes/stats)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API is responding${NC}"
    echo -e "${BLUE}📊 Stats: $RESPONSE${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify API (might still be starting)${NC}"
fi

# Cleanup
rm -f merged_recipes.json

echo -e "\n${GREEN}🎉 Deployment complete!${NC}"
echo -e "${BLUE}🌐 View recipes at: https://www.mireva.life/recipes.html${NC}"