#!/usr/bin/env python3
"""
Prepare New Recipe Collection for Deployment
Cleans old recipes and prepares new Spoonacular collection
"""

import json
import shutil
from pathlib import Path
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def prepare_for_deployment():
    """Prepare new recipe collection for deployment"""
    output_dir = Path("./processed_recipes")
    
    logger.info("Preparing new recipe collection for deployment...")
    
    # Check if we have Spoonacular recipes
    spoon_file = output_dir / "spoonacular_recipes.json"
    
    if spoon_file.exists():
        logger.info("Found Spoonacular recipes file!")
        
        # Load Spoonacular recipes
        with open(spoon_file, 'r', encoding='utf-8') as f:
            recipes = json.load(f)
        
        logger.info(f"Loaded {len(recipes)} Spoonacular recipes")
        
        # Copy as main recipe collection
        main_file = output_dir / "recipes.json"
        shutil.copy(spoon_file, main_file)
        
        # Create deployment-ready metadata
        metadata = {
            "source": "Spoonacular API",
            "total_recipes": len(recipes),
            "generation_date": datetime.now().isoformat(),
            "deployed_date": datetime.now().isoformat(),
            "version": "2.0",
            "features": ["nutrition", "images", "comprehensive_tags", "difficulty_ratings"]
        }
        
        metadata_file = output_dir / "metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Prepared {len(recipes)} recipes for deployment")
        logger.info(f"Main file: {main_file}")
        logger.info(f"Metadata: {metadata_file}")
        
        return True
    
    else:
        logger.warning("No Spoonacular recipes found. Creating backup collection...")
        
        # Create a sample collection from high-quality recipes
        sample_recipes = create_sample_collection()
        
        main_file = output_dir / "recipes.json"
        with open(main_file, 'w', encoding='utf-8') as f:
            json.dump(sample_recipes, f, indent=2, ensure_ascii=False)
        
        metadata = {
            "source": "Curated Sample Collection",
            "total_recipes": len(sample_recipes),
            "generation_date": datetime.now().isoformat(),
            "deployed_date": datetime.now().isoformat(),
            "version": "1.0",
            "features": ["curated", "diverse_cuisines"]
        }
        
        metadata_file = output_dir / "metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Created sample collection with {len(sample_recipes)} recipes")
        
        return True

def create_sample_collection():
    """Create high-quality sample collection"""
    return [
        {
            "id": "margherita-pizza",
            "name": "Classic Margherita Pizza",
            "description": "Traditional Italian pizza with fresh mozzarella, tomatoes, and basil",
            "ingredients": [
                "1 lb pizza dough",
                "1/2 cup tomato sauce",
                "8 oz fresh mozzarella, torn",
                "Fresh basil leaves",
                "2 tbsp olive oil",
                "Salt and pepper to taste"
            ],
            "steps": [
                "Preheat oven to 475°F (245°C)",
                "Roll out pizza dough on floured surface",
                "Spread tomato sauce evenly, leaving 1-inch border",
                "Add torn mozzarella pieces",
                "Drizzle with olive oil, season with salt and pepper",
                "Bake for 12-15 minutes until crust is golden",
                "Top with fresh basil leaves before serving"
            ],
            "minutes": 25,
            "n_ingredients": 6,
            "n_steps": 7,
            "nutrition": {
                "calories": 285,
                "protein": 12,
                "carbohydrates": 34,
                "fat": 10
            },
            "tags": ["Italian", "Vegetarian", "Popular", "Quick"],
            "cuisine": ["Italian"],
            "difficulty": "Easy",
            "primary_category": "Main Course"
        },
        {
            "id": "chicken-tikka-masala",
            "name": "Chicken Tikka Masala",
            "description": "Creamy British-Indian curry with marinated chicken in tomato-based sauce",
            "ingredients": [
                "2 lbs chicken breast, cubed",
                "1 cup plain yogurt",
                "2 tbsp garam masala",
                "1 can (14 oz) tomato puree",
                "1 cup heavy cream",
                "1 large onion, diced",
                "4 cloves garlic, minced",
                "1 inch ginger, minced",
                "2 tbsp butter"
            ],
            "steps": [
                "Marinate chicken in yogurt and 1 tbsp garam masala for 2 hours",
                "Grill or broil chicken until cooked through",
                "Sauté onions in butter until golden",
                "Add garlic and ginger, cook 1 minute",
                "Add tomato puree and remaining spices, simmer 10 minutes",
                "Stir in cream and cooked chicken",
                "Simmer 10 minutes until thickened",
                "Serve with basmati rice or naan bread"
            ],
            "minutes": 45,
            "n_ingredients": 9,
            "n_steps": 8,
            "nutrition": {
                "calories": 420,
                "protein": 35,
                "carbohydrates": 15,
                "fat": 24
            },
            "tags": ["Indian", "Spicy", "Popular", "Comfort Food"],
            "cuisine": ["Indian"],
            "difficulty": "Medium",
            "primary_category": "Main Course"
        },
        {
            "id": "beef-tacos",
            "name": "Street-Style Beef Tacos",
            "description": "Authentic Mexican street tacos with seasoned ground beef",
            "ingredients": [
                "1 lb ground beef",
                "1 packet taco seasoning",
                "8 corn tortillas",
                "1/2 cup white onion, diced",
                "1/2 cup cilantro, chopped",
                "2 limes, cut into wedges",
                "Salsa verde",
                "Hot sauce (optional)"
            ],
            "steps": [
                "Cook ground beef in large skillet over medium-high heat",
                "Add taco seasoning and water according to package directions",
                "Simmer until liquid reduces and beef is well-coated",
                "Warm tortillas in dry skillet or over gas flame",
                "Fill each tortilla with seasoned beef",
                "Top with diced onions and cilantro",
                "Serve with lime wedges and salsa verde"
            ],
            "minutes": 20,
            "n_ingredients": 8,
            "n_steps": 7,
            "nutrition": {
                "calories": 320,
                "protein": 22,
                "carbohydrates": 25,
                "fat": 15
            },
            "tags": ["Mexican", "Quick", "Street Food", "Spicy"],
            "cuisine": ["Mexican"],
            "difficulty": "Easy",
            "primary_category": "Main Course"
        },
        {
            "id": "pad-thai",
            "name": "Authentic Pad Thai",
            "description": "Classic Thai stir-fried rice noodles with shrimp, tofu, and vegetables",
            "ingredients": [
                "8 oz rice stick noodles",
                "1/2 lb shrimp, peeled",
                "4 oz firm tofu, cubed",
                "3 eggs, beaten",
                "1 cup bean sprouts",
                "3 tbsp tamarind paste",
                "3 tbsp fish sauce",
                "2 tbsp palm sugar",
                "1/4 cup crushed peanuts",
                "2 green onions, sliced",
                "Lime wedges for serving"
            ],
            "steps": [
                "Soak rice noodles in warm water until soft, drain",
                "Mix tamarind paste, fish sauce, and palm sugar for sauce",
                "Heat wok over high heat with oil",
                "Stir-fry shrimp until pink, remove",
                "Scramble eggs in wok, push to one side",
                "Add noodles and sauce, toss to combine",
                "Add tofu, bean sprouts, and cooked shrimp",
                "Garnish with peanuts, green onions, and lime"
            ],
            "minutes": 25,
            "n_ingredients": 11,
            "n_steps": 8,
            "nutrition": {
                "calories": 380,
                "protein": 25,
                "carbohydrates": 48,
                "fat": 12
            },
            "tags": ["Thai", "Seafood", "Stir-fry", "Traditional"],
            "cuisine": ["Thai"],
            "difficulty": "Medium",
            "primary_category": "Main Course"
        },
        {
            "id": "chocolate-chip-cookies",
            "name": "Perfect Chocolate Chip Cookies",
            "description": "Classic American cookies that are crispy outside and chewy inside",
            "ingredients": [
                "2 1/4 cups all-purpose flour",
                "1 cup butter, softened",
                "3/4 cup granulated sugar",
                "3/4 cup brown sugar, packed",
                "2 large eggs",
                "2 tsp vanilla extract",
                "1 tsp baking soda",
                "1 tsp salt",
                "2 cups chocolate chips"
            ],
            "steps": [
                "Preheat oven to 375°F (190°C)",
                "Cream butter and both sugars until fluffy",
                "Beat in eggs one at a time, then vanilla",
                "Whisk together flour, baking soda, and salt",
                "Gradually mix flour mixture into butter mixture",
                "Stir in chocolate chips",
                "Drop rounded tablespoons onto ungreased baking sheet",
                "Bake 9-11 minutes until golden brown",
                "Cool on baking sheet 2 minutes before removing"
            ],
            "minutes": 25,
            "n_ingredients": 9,
            "n_steps": 9,
            "nutrition": {
                "calories": 180,
                "protein": 2,
                "carbohydrates": 24,
                "fat": 9
            },
            "tags": ["American", "Dessert", "Baked", "Popular", "Sweet"],
            "cuisine": ["American"],
            "difficulty": "Easy",
            "primary_category": "Dessert"
        }
    ]

def main():
    """Main execution"""
    print("🧹 Preparing Recipe Collection for Deployment")
    print("=" * 50)
    
    success = prepare_for_deployment()
    
    if success:
        print("\n✅ Recipe collection prepared for deployment!")
        print("\n📋 Files ready:")
        print("  • processed_recipes/recipes.json - Main recipe collection")
        print("  • processed_recipes/metadata.json - Collection metadata")
        
        print("\n🚀 Next steps:")
        print("  1. Deploy using: ./deploy-recipes.sh")
        print("  2. This will replace ALL existing recipes on mireva.life")
        print("  3. The new collection will be live on /recipes.html")
        
    else:
        print("\n❌ Failed to prepare recipe collection")

if __name__ == "__main__":
    main()