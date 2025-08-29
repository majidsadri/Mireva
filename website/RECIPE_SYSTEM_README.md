# Mireva Recipe System

## Overview
Smart recipe fetching and deployment system for mireva.life that:
- Fetches diverse recipes from Spoonacular API
- Automatically avoids duplicates
- Respects API rate limits (1500 points/day)
- Seamlessly adds new recipes to existing collection

## Current Status
- **Live recipes**: 874 recipes at https://www.mireva.life/recipes.html
- **API endpoints**: Working at https://mireva.life/api/recipes/*

## Files

### Main Scripts
- `smart-spoonacular-fetcher.py` - Intelligent recipe fetcher
- `deploy-add-recipes.sh` - Deploy new recipes to server
- `recipe_cache.json` - Local cache of existing recipes (auto-updated)

### Data Files
- `processed_recipes/` - Directory with deployed recipe collections
- `new_recipes_*.json` - New fetched recipes (timestamped)
- `metadata_*.json` - Metadata for each fetch

## Usage

### Fetch New Recipes

```bash
# Fetch 100 diverse recipes (default)
python3 smart-spoonacular-fetcher.py

# Fetch specific number of recipes
python3 smart-spoonacular-fetcher.py 50
```

Features:
- Automatically checks existing recipes to avoid duplicates
- Searches across 17 cuisines, 12 meal types, 9 diets
- Includes special categories (healthy, quick, budget-friendly, etc.)
- Tracks API usage and respects limits
- Saves to timestamped files

### Deploy to Server

```bash
# Deploy most recent fetch
./deploy-add-recipes.sh

# Deploy specific file
./deploy-add-recipes.sh new_recipes_20250827_174432.json
```

Process:
1. Downloads current recipes from server
2. Merges new recipes (removes duplicates)
3. Creates backup on server
4. Uploads merged collection
5. Restarts API server
6. Verifies deployment

## API Limits

Spoonacular API Plan:
- **Daily limit**: 400 calls / 1500 points
- **Rate limit**: 5 requests/second

Typical usage per fetch:
- Search calls: ~20-30 (1-5 points each)
- Bulk detail calls: 2-3 (25 points per 50 recipes)
- **Total for 100 recipes**: ~100-150 points

You can safely run the fetcher 10+ times per day.

## Recipe Diversity

The smart fetcher ensures variety by searching:

**Cuisines**: Italian, Mexican, Chinese, Indian, Thai, Japanese, Greek, French, Spanish, Korean, Vietnamese, Mediterranean, Middle Eastern, African, Caribbean, German, British

**Meal Types**: main course, dessert, appetizer, salad, breakfast, soup, beverage, sauce, snack, drink, bread, side dish

**Diets**: vegetarian, vegan, gluten free, ketogenic, paleo, whole30, pescetarian, primal, low fodmap

**Special**: healthy, quick easy, budget friendly, comfort food, summer, winter, holiday, party, kids, romantic, protein rich, low calorie, high fiber, superfood

## Recipe Schema

Each recipe includes:
```json
{
  "id": "unique_id",
  "spoonacular_id": 12345,
  "name": "Recipe Name",
  "description": "Description",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "steps": ["step 1", "step 2"],
  "minutes": 45,
  "nutrition": {
    "calories": 250,
    "protein": 20,
    "carbohydrates": 30,
    "fat": 8
  },
  "tags": ["Healthy", "Quick & Easy"],
  "cuisine": ["Italian"],
  "difficulty": "Medium",
  "primary_category": "Main Course",
  "health_score": 85
}
```

## Server Details

- **Host**: 18.215.164.114
- **User**: ubuntu
- **Recipe location**: /mnt/recipes/data/recipes.json
- **API server**: Port 5002 (proxied through nginx)
- **Backups**: /mnt/recipes/backups/

## Troubleshooting

### If fetch fails
- Check API quota: Script shows remaining points
- Check internet connection
- Verify API key in script

### If deployment fails
- Verify SSH key: `ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114`
- Check server is running
- Ensure recipe file exists

### To reset cache
```bash
# Force fresh start (will re-check all recipes)
rm recipe_cache.json
```

## Examples

### Fetch Italian and Mexican recipes
```bash
# Edit smart-spoonacular-fetcher.py
# Modify CUISINES list to prioritize Italian and Mexican
python3 smart-spoonacular-fetcher.py 50
```

### Check current recipe count
```bash
curl -s https://mireva.life/api/recipes/stats | jq
```

### Search recipes on live site
```bash
curl -s "https://mireva.life/api/recipes/search?q=pasta" | jq '.[0:3]'
```

## Best Practices

1. **Run fetcher daily**: Maximum variety, stays within limits
2. **Fetch 50-100 at a time**: Optimal API usage
3. **Deploy immediately**: Keeps server fresh
4. **Monitor duplicates**: Script reports skipped duplicates
5. **Check variety**: Metadata shows cuisine/category distribution

## Notes

- The system maintains a local cache to track all recipes
- Duplicates are detected by both recipe ID and Spoonacular ID
- Each fetch creates timestamped files for traceability
- Server backups are created before each deployment
- The API server auto-restarts after deployment