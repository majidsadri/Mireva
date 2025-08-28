# Spoonacular Recipe Scraper & Deployment Guide

## Overview
This optimized scraper fetches high-quality recipes from Spoonacular API and deploys them to mireva.life. It uses an efficient two-phase strategy to maximize recipe collection while staying within API limits.

## Current Status
- ✅ **828 recipes successfully scraped** (August 27, 2025)
- ✅ **Saved locally** in deployment-ready format
- ⏳ **Pending deployment** to EC2 server (requires SSH access)

## File Locations

### Scraped Recipes (Ready for Deployment)
- **Main collection**: `processed_recipes/recipes.json` (828 recipes, 3.0MB)
- **Metadata**: `processed_recipes/metadata.json` (deployment info)

### Scraper Scripts
- **Main scraper**: `spoonacular-comprehensive-scraper.py` (optimized version)
- **Deployment script**: `deploy-new-recipes.sh` (auto-deploy to mireva.life)

## How the New Scraper Works

### API Efficiency Strategy
The scraper uses a **two-phase approach** to maximize recipes within the 400 daily call limit:

#### Phase 1: Collect Recipe IDs (Cheap Calls - ~1-5 points each)
- Searches by popular cuisines (Italian, American, Mexican, Chinese, Indian, etc.)
- Searches by meal types (dinner, lunch, breakfast, dessert)
- Searches by diets (vegetarian, gluten-free)
- **Result**: Collects ~900+ unique recipe IDs using only ~15 API calls

#### Phase 2: Bulk Hydrate Details (Efficient - ~25 points per 50 recipes)
- Uses `/recipes/informationBulk` endpoint to get full details
- Processes 50 recipes per call (highly efficient)
- Includes nutrition, ingredients, instructions, images

### API Usage Tracking
- **Real-time quota monitoring** using response headers
- **Rate limiting**: 0.3 seconds between requests (under 5 req/s limit)
- **Safety buffer**: Stops before hitting daily limits

### Last Run Results (Aug 27, 2025)
```
✅ 828 recipes collected
📊 33 API calls used (out of 400 daily limit)
💰 682.87 points used, 817.13 remaining
⏱️ Total runtime: ~2 minutes
```

## Recipe Data Format

Each recipe includes:
```json
{
  "id": "spoon_715415_38cb4daa",
  "spoonacular_id": 715415,
  "name": "Red Lentil Soup with Chicken and Turnips",
  "description": "Recipe description...",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "steps": ["step 1", "step 2"],
  "minutes": 45,
  "n_ingredients": 8,
  "n_steps": 6,
  "nutrition": {
    "calories": 250,
    "protein": 20,
    "carbohydrates": 30,
    "fat": 8
  },
  "tags": ["Healthy", "Comfort Food"],
  "cuisine": ["American"],
  "difficulty": "Medium",
  "primary_category": "Main Course"
}
```

## Deployment Instructions

### From This Computer (Local)
```bash
# Make sure recipes exist
ls -la processed_recipes/recipes.json

# Deploy to mireva.life (requires SSH key access)
bash deploy-new-recipes.sh
```

### From Another Computer

#### 1. Copy Required Files
Transfer these files to the deployment computer:
```
processed_recipes/recipes.json      # Main recipe collection (828 recipes)
processed_recipes/metadata.json     # Deployment metadata
deploy-new-recipes.sh               # Deployment script
```

#### 2. Set Up SSH Access
The deployment requires SSH access to EC2 server `18.215.164.114`:
- User: `ubuntu`
- Required SSH key with access to the server
- Add server to known_hosts: `ssh-keyscan -H 18.215.164.114 >> ~/.ssh/known_hosts`

#### 3. Run Deployment
```bash
# Set correct permissions
chmod 600 ~/.ssh/your-ec2-key.pem
chmod +x deploy-new-recipes.sh

# Update deploy script with your key path
# Edit line 11 in deploy-new-recipes.sh:
SSH_KEY="~/.ssh/your-ec2-key.pem"

# Deploy
bash deploy-new-recipes.sh
```

## Technical Details

### API Configuration Used
- **Base URL**: https://api.spoonacular.com
- **API Key**: f6df370ddf8d4bc2a5ed9fb60f2f0be5 (masked in logs as f6df...be5)
- **Daily Limit**: 400 API calls / 1500 points
- **Rate Limit**: 5 requests/second, 5 concurrent requests

### Search Strategy
1. **8 cuisine searches** (Italian, American, Mexican, Chinese, Indian, French, Thai, Mediterranean)
2. **4 meal type searches** (dinner, lunch, breakfast, dessert)  
3. **2 diet searches** (vegetarian, gluten-free)
4. **Bulk detail retrieval** for all collected IDs

### Deployment Target
- **Website**: https://www.mireva.life/recipes.html
- **API Endpoints**: 
  - `/api/recipes/stats`
  - `/api/recipes/search?q=pasta`
  - `/api/recipes/random`

## Troubleshooting

### If Scraper Fails
- Check API quota: Look for "Points left:" in logs
- Check internet connection
- Verify API key is valid

### If Deployment Fails
- Verify SSH key has access to EC2 server
- Check SSH key permissions: `chmod 600 ~/.ssh/key.pem`
- Test SSH connection: `ssh -i ~/.ssh/key.pem ubuntu@18.215.164.114`

### Re-running Scraper
```bash
# Run with fresh API quota (resets daily)
python3 spoonacular-comprehensive-scraper.py

# Will automatically:
# 1. Fetch new recipes
# 2. Save to processed_recipes/
# 3. Attempt auto-deployment
```

## Notes
- The scraper is designed to run once daily to respect API limits
- Each run replaces ALL existing recipes on the website
- Backup of old recipes is created automatically before deployment
- The current 828 recipes represent a comprehensive, high-quality collection covering diverse cuisines and dietary needs