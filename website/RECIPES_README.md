# 🍳 Mireva Recipe Deployment System

This system fetches recipes from the Kaggle Food.com dataset and deploys them to your EC2 server with a full API and web interface.

## 📋 Prerequisites

1. **Kaggle API Setup**:
   ```bash
   pip install kaggle pandas
   ```
   
2. **Kaggle Credentials**:
   - Create account at kaggle.com
   - Go to Account → API → Create New API Token
   - Save `kaggle.json` to `~/.kaggle/kaggle.json`
   - Set permissions: `chmod 600 ~/.kaggle/kaggle.json`

3. **SSH Access**:
   - Ensure SSH key access to EC2 server (18.215.164.114)
   - Key should be at `~/.ssh/id_rsa`

## 🚀 Usage

### Step 1: Fetch and Process Recipes
```bash
cd website/
python3 fetch-recipes.py
```

This will:
- Download the 280MB Kaggle dataset (180,000+ recipes)
- Process and clean the data
- Generate structured JSON with ingredients, steps, nutrition, etc.
- Create a 1000-recipe sample for testing

### Step 2: Deploy to EC2

For testing (1000 recipes):
```bash
./deploy-recipes.sh sample
```

For full deployment (180,000+ recipes):
```bash
./deploy-recipes.sh full
```

This will:
- Upload recipes to `/mnt/recipes/` on EC2
- Create a Flask API server on port 5002
- Set up systemd service for auto-restart
- Configure nginx to proxy API requests
- Create a web interface for browsing recipes

## 🔗 Access Points

After deployment, you can access:

- **Recipe Browser**: https://www.mireva.life/recipes.html
- **API Stats**: https://mireva.life/api/recipes/stats
- **Random Recipes**: https://mireva.life/api/recipes/random
- **Search**: https://mireva.life/api/recipes/search?q=chicken
- **By Tag**: https://mireva.life/api/recipes/by-tag/dessert

## 📊 API Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `/api/recipes/stats` | Database statistics | Get total count, metadata |
| `/api/recipes/random?count=10` | Random recipes | Get 10 random recipes |
| `/api/recipes/search?q=chicken&limit=20` | Search recipes | Search by name/ingredients/tags |
| `/api/recipes/{id}` | Specific recipe | Get recipe by ID |
| `/api/recipes/by-tag/{tag}` | Recipes by tag | Get recipes with specific tag |

## 📁 Data Structure

Each recipe contains:
```json
{
  "id": "recipe_id",
  "name": "Recipe Name",
  "ingredients": ["ingredient1", "ingredient2"],
  "steps": ["step1", "step2"],
  "description": "Recipe description",
  "minutes": 30,
  "n_steps": 5,
  "n_ingredients": 8,
  "nutrition": {
    "calories": 250,
    "protein": 15,
    "fat": 10
  },
  "tags": ["easy", "quick", "healthy"]
}
```

## 🛠️ Management Commands

```bash
# Check API status
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 'sudo systemctl status mireva-recipes'

# View API logs
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 'sudo journalctl -u mireva-recipes -f'

# Restart API
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 'sudo systemctl restart mireva-recipes'

# Check recipe count
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 'jq length /mnt/recipes/data/recipes.json'
```

## 📂 Server Directory Structure

```
/mnt/recipes/
├── data/
│   ├── recipes.json          # Main recipe database
│   └── metadata.json         # Deployment metadata
├── api/
│   └── recipe_server.py      # Flask API server
└── backups/
    └── recipes_backup_*.json # Automatic backups
```

## 🔧 Troubleshooting

### Dataset Download Issues
- Verify Kaggle credentials in `~/.kaggle/kaggle.json`
- Check internet connection
- Ensure sufficient disk space (300MB+ needed)

### Deployment Issues
- Verify SSH key access to EC2
- Check EC2 server has sufficient storage
- Ensure ports 5002 is available
- Check nginx configuration with `sudo nginx -t`

### API Issues
- Check service status: `sudo systemctl status mireva-recipes`
- View logs: `sudo journalctl -u mireva-recipes -f`
- Verify Python dependencies are installed

## 📈 Performance Notes

- **Sample deployment**: ~1000 recipes, ~2MB, fast responses
- **Full deployment**: ~180,000 recipes, ~200MB+, may need optimization for large searches
- **API caching**: Consider adding Redis for better performance with full dataset
- **Database**: For production, consider migrating from JSON to PostgreSQL/MongoDB

## 🔐 Security Notes

- API currently allows unrestricted access (CORS: *)
- Consider adding authentication for production use
- Recipe data is from Food.com dataset (check licensing for commercial use)
- Backup strategy included for data safety

---

**Dataset Source**: [Food.com Recipes and User Interactions](https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions)  
**License**: Check Kaggle dataset license for usage restrictions