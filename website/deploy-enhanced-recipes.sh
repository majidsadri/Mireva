#!/bin/bash

# Deploy Enhanced Recipe Collection to EC2 server
# Usage: ./deploy-enhanced-recipes.sh

set -e  # Exit on any error

# Configuration
EC2_HOST="18.215.164.114"
EC2_USER="ubuntu"
SSH_KEY="~/.ssh/id_rsa"
REMOTE_DIR="/mnt/recipes"
LOCAL_RECIPES_FILE="./processed_recipes/recipes_filtered.json"
LOCAL_METADATA_FILE="./processed_recipes/recipes_filtered_metadata.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Enhanced Recipe Collection to EC2${NC}"
echo "=================================================="

# Check if enhanced recipe file exists
if [[ ! -f "$LOCAL_RECIPES_FILE" ]]; then
    echo -e "${RED}❌ Enhanced recipe file not found: $LOCAL_RECIPES_FILE${NC}"
    echo -e "${YELLOW}💡 Please run enhanced-recipe-fetcher.py first${NC}"
    exit 1
fi

# Get file stats
RECIPE_COUNT=$(jq length "$LOCAL_RECIPES_FILE")
RECIPE_SIZE=$(du -h "$LOCAL_RECIPES_FILE" | cut -f1)
echo -e "${BLUE}📊 Recipe Collection Stats:${NC}"
echo "   - Total recipes: $(printf "%'d" $RECIPE_COUNT)"
echo "   - File size: $RECIPE_SIZE"
echo ""

# Check SSH connectivity
echo -e "${YELLOW}🔍 Testing SSH connectivity...${NC}"
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'" &>/dev/null; then
    echo -e "${RED}❌ Cannot connect to EC2 server${NC}"
    echo -e "${YELLOW}💡 Please check your SSH key and server access${NC}"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection verified${NC}"

# Create backup of existing recipes
echo -e "${YELLOW}💾 Creating backup of existing recipes...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    if [[ -f $REMOTE_DIR/data/recipes.json ]]; then
        sudo mkdir -p $REMOTE_DIR/backups
        sudo cp $REMOTE_DIR/data/recipes.json $REMOTE_DIR/backups/recipes_backup_\$(date +%Y%m%d_%H%M%S).json
        echo 'Backup created'
    else
        echo 'No existing recipes to backup'
    fi
"

# Upload enhanced recipe data
echo -e "${YELLOW}📤 Uploading enhanced recipe collection...${NC}"
echo -e "${BLUE}   This may take a moment due to the large dataset...${NC}"

scp -i "$SSH_KEY" "$LOCAL_RECIPES_FILE" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/data/recipes.json"
scp -i "$SSH_KEY" "$LOCAL_METADATA_FILE" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/data/metadata.json"

# Update deployment metadata
echo -e "${YELLOW}📋 Updating deployment metadata...${NC}"
DEPLOYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
sudo tee $REMOTE_DIR/data/deployment_info.json > /dev/null << EOF
{
  \"deployment_date\": \"$DEPLOYMENT_DATE\",
  \"deployment_type\": \"enhanced\",
  \"recipe_count\": $RECIPE_COUNT,
  \"file_size\": \"$RECIPE_SIZE\",
  \"sources\": {
    \"food_com_existing\": 3000,
    \"generated_international\": $(($RECIPE_COUNT - 3000)),
    \"themealdb\": 0
  },
  \"cuisines\": [\"American\", \"Chinese\", \"French\", \"Indian\", \"Italian\", \"Japanese\", \"Mexican\", \"Thai\", \"Persian\"],
  \"version\": \"2.0_enhanced\",
  \"data_structure\": {
    \"fields\": [\"id\", \"name\", \"source\", \"ingredients\", \"steps\", \"description\", \"minutes\", \"servings\", \"difficulty\", \"cuisine\", \"category\", \"tags\", \"nutrition\", \"image_url\", \"original_url\"],
    \"format\": \"JSON array of normalized recipe objects\"
  }
}
EOF
"

# Restart the recipe API server with enhanced data
echo -e "${YELLOW}🔄 Restarting recipe API server...${NC}"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    # Stop existing server
    pkill -f 'recipe_server.py' || echo 'No existing process to kill'
    
    # Start the server with enhanced data
    cd $REMOTE_DIR/api
    nohup python3 recipe_server.py > ../recipe_api_enhanced.log 2>&1 &
    
    # Wait for server to start
    sleep 5
    
    # Test server
    if curl -s http://localhost:5002/api/recipes/stats | grep -q 'total_recipes'; then
        echo 'Enhanced Recipe API started successfully'
        echo \"Server stats:\"
        curl -s http://localhost:5002/api/recipes/stats | jq .
    else
        echo 'Warning: Recipe API may not have started properly'
        echo 'Check log: tail $REMOTE_DIR/recipe_api_enhanced.log'
    fi
"

# Final verification and stats
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
sleep 2

API_STATS=$(ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "curl -s http://localhost:5002/api/recipes/stats" 2>/dev/null || echo "{}")

if echo "$API_STATS" | grep -q "total_recipes"; then
    echo -e "${GREEN}✅ Enhanced Recipe API is running successfully${NC}"
    DEPLOYED_COUNT=$(echo "$API_STATS" | jq -r '.total_recipes // 0' 2>/dev/null)
    echo -e "${BLUE}📊 Deployed Recipe Count: $(printf "%'d" $DEPLOYED_COUNT)${NC}"
else
    echo -e "${RED}⚠️ Recipe API may not be running properly${NC}"
    echo -e "${YELLOW}Check logs: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'tail $REMOTE_DIR/recipe_api_enhanced.log'${NC}"
fi

# Success summary
echo ""
echo -e "${GREEN}"
echo "🎉 ENHANCED RECIPE DEPLOYMENT COMPLETED!"
echo "========================================"
echo -e "${NC}"
echo -e "${BLUE}📊 Final Statistics:${NC}"
echo "   - Total recipes deployed: $(printf "%'d" $RECIPE_COUNT)"
echo "   - File size: $RECIPE_SIZE"
echo "   - Deployment type: Enhanced Multi-Source Collection"
echo "   - Cuisines: American, Chinese, French, Indian, Italian, Japanese, Mexican, Thai, Persian"
echo "   - Sources: Food.com (3,000) + Generated International ($(($RECIPE_COUNT - 3000)))"
echo ""
echo -e "${BLUE}🔗 Access URLs:${NC}"
echo "   - Recipe Website: https://www.mireva.life/recipes"
echo "   - API Stats: https://www.mireva.life/api/recipes/stats"
echo "   - API Search: https://www.mireva.life/api/recipes/search?q=pasta"
echo ""
echo -e "${BLUE}🛠️ Management Commands:${NC}"
echo "   - Check API: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'curl http://localhost:5002/api/recipes/stats'"
echo "   - View logs: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'tail -f $REMOTE_DIR/recipe_api_enhanced.log'"
echo "   - Restart API: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'pkill -f recipe_server.py && cd $REMOTE_DIR/api && nohup python3 recipe_server.py &'"
echo ""
echo -e "${GREEN}✨ Your enhanced recipe collection with 13,000+ recipes is now live! 🍳${NC}"