#!/usr/bin/env python3
"""
French Recipe Fetcher - Based on Smart Spoonacular Fetcher
Fetches 100 French recipes from Spoonacular API
"""

import requests
import json
import time
import hashlib
import subprocess
from datetime import datetime
import random
import os

# API Configuration
API_KEY = "f6df370ddf8d4bc2a5ed9fb60f2f0be5"
BASE_URL = "https://api.spoonacular.com"

# Server Configuration
EC2_HOST = "18.215.164.114"
EC2_USER = "ubuntu"
SSH_KEY = "~/.ssh/id_rsa"

# French-specific search parameters
FRENCH_DISHES = [
    "coq au vin", "ratatouille", "bouillabaisse", "cassoulet", "quiche",
    "croissant", "baguette", "crepe", "souffle", "tarte", "mousse",
    "bisque", "confit", "gratin", "terrine", "pate", "brioche"
]

FRENCH_MEAL_TYPES = [
    "main course", "dessert", "appetizer", "salad", "breakfast",
    "soup", "sauce", "snack", "bread", "side dish"
]

class FrenchRecipeFetcher:
    def __init__(self):
        self.existing_ids = set()
        self.existing_spoon_ids = set()
        self.api_calls_used = 0
        self.points_used = 0
        self.points_left = 1500
        self.fetched_recipes = []
        
    def load_existing_recipes(self):
        """Load existing recipes to avoid duplicates"""
        print("📥 Loading existing recipes...")
        
        # Try to load from local cache first
        if os.path.exists("recipe_cache.json"):
            with open("recipe_cache.json", 'r') as f:
                recipes = json.load(f)
                for recipe in recipes:
                    self.existing_ids.add(recipe.get('id', ''))
                    if 'spoonacular_id' in recipe:
                        self.existing_spoon_ids.add(recipe['spoonacular_id'])
            print(f"✅ Loaded {len(recipes)} existing recipes from cache")
        
    def search_french_recipes(self, query="", offset=0, number=10):
        """Search specifically for French recipes"""
        params = {
            "apiKey": API_KEY,
            "number": number,
            "offset": offset,
            "cuisine": "French",
            "addRecipeInformation": False,
            "sort": "popularity"
        }
        
        if query:
            params["query"] = query
            
        url = f"{BASE_URL}/recipes/complexSearch"
        response = requests.get(url, params=params)
        
        self.api_calls_used += 1
        time.sleep(0.5)  # Rate limiting
        
        if response.status_code == 200:
            data = response.json()
            return data.get('results', [])
        return []
    
    def get_recipe_details_bulk(self, recipe_ids):
        """Get detailed information for multiple recipes"""
        if not recipe_ids:
            return []
            
        ids_str = ','.join(map(str, recipe_ids))
        url = f"{BASE_URL}/recipes/informationBulk"
        params = {
            "apiKey": API_KEY,
            "ids": ids_str,
            "includeNutrition": True
        }
        
        response = requests.get(url, params=params)
        self.api_calls_used += 1
        self.points_used += len(recipe_ids) * 0.5
        time.sleep(0.5)
        
        if response.status_code == 200:
            return response.json()
        return []
    
    def format_recipe(self, spoon_recipe):
        """Convert Spoonacular format to our format"""
        # Generate unique ID
        recipe_id = f"french_{hashlib.md5(str(spoon_recipe['id']).encode()).hexdigest()[:8]}"
        
        # Extract ingredients
        ingredients = []
        if 'extendedIngredients' in spoon_recipe:
            for ing in spoon_recipe['extendedIngredients']:
                ingredients.append(ing.get('original', ''))
        
        # Extract instructions
        steps = []
        if 'analyzedInstructions' in spoon_recipe and spoon_recipe['analyzedInstructions']:
            for instruction_set in spoon_recipe['analyzedInstructions']:
                for step in instruction_set.get('steps', []):
                    steps.append(step.get('step', ''))
        
        # Get nutrition info
        nutrition = {
            "calories": 350,
            "protein": 20,
            "carbohydrates": 40,
            "fat": 15
        }
        
        if 'nutrition' in spoon_recipe and 'nutrients' in spoon_recipe['nutrition']:
            for nutrient in spoon_recipe['nutrition']['nutrients']:
                if nutrient['name'] == 'Calories':
                    nutrition['calories'] = int(nutrient['amount'])
                elif nutrient['name'] == 'Protein':
                    nutrition['protein'] = int(nutrient['amount'])
                elif nutrient['name'] == 'Carbohydrates':
                    nutrition['carbohydrates'] = int(nutrient['amount'])
                elif nutrient['name'] == 'Fat':
                    nutrition['fat'] = int(nutrient['amount'])
        
        # Determine category
        category = "Main Course"
        if spoon_recipe.get('dishTypes'):
            dish_type = spoon_recipe['dishTypes'][0].lower()
            if 'dessert' in dish_type:
                category = "Dessert"
            elif 'appetizer' in dish_type or 'starter' in dish_type:
                category = "Appetizer"
            elif 'soup' in dish_type:
                category = "Soup"
            elif 'salad' in dish_type:
                category = "Salad"
            elif 'breakfast' in dish_type:
                category = "Breakfast"
            elif 'bread' in dish_type:
                category = "Bread"
            elif 'sauce' in dish_type:
                category = "Sauce"
        
        return {
            "id": recipe_id,
            "spoonacular_id": spoon_recipe['id'],
            "name": spoon_recipe.get('title', 'Unknown Recipe'),
            "description": spoon_recipe.get('summary', '')[:200].replace('<b>', '').replace('</b>', ''),
            "ingredients": ingredients,
            "steps": steps,
            "minutes": spoon_recipe.get('readyInMinutes', 45),
            "nutrition": nutrition,
            "tags": ["French", "European", "Classic"],
            "cuisine": ["French"],
            "difficulty": "Medium" if spoon_recipe.get('readyInMinutes', 45) > 60 else "Easy",
            "primary_category": category,
            "health_score": spoon_recipe.get('healthScore', 50)
        }
    
    def fetch_french_recipes(self, target_count=100):
        """Main function to fetch French recipes"""
        print("\n🇫🇷 French Recipe Fetcher")
        print("=" * 50)
        
        self.load_existing_recipes()
        
        recipes_needed = target_count
        all_recipe_ids = []
        
        # Search for French recipes with various queries
        print("\n🔍 Searching for French recipes...")
        
        # First, general French cuisine search
        results = self.search_french_recipes(offset=0, number=100)
        for r in results:
            if r['id'] not in self.existing_spoon_ids:
                all_recipe_ids.append(r['id'])
        
        # Then search for specific French dishes
        for dish in FRENCH_DISHES[:5]:  # Limit to avoid too many API calls
            if len(all_recipe_ids) >= recipes_needed:
                break
            print(f"   Searching for {dish}...")
            results = self.search_french_recipes(query=dish, number=20)
            for r in results:
                if r['id'] not in self.existing_spoon_ids and r['id'] not in all_recipe_ids:
                    all_recipe_ids.append(r['id'])
        
        # Limit to target count
        all_recipe_ids = all_recipe_ids[:recipes_needed]
        print(f"\n✅ Found {len(all_recipe_ids)} new French recipes to fetch")
        
        # Fetch details in batches
        print("\n📚 Fetching detailed recipe information...")
        for i in range(0, len(all_recipe_ids), 50):
            batch = all_recipe_ids[i:i+50]
            print(f"   Batch {i//50 + 1}: Fetching {len(batch)} recipes...")
            
            detailed_recipes = self.get_recipe_details_bulk(batch)
            
            for spoon_recipe in detailed_recipes:
                if spoon_recipe and 'id' in spoon_recipe:
                    formatted = self.format_recipe(spoon_recipe)
                    if formatted['ingredients'] and formatted['steps']:
                        self.fetched_recipes.append(formatted)
        
        print(f"\n✅ Successfully fetched {len(self.fetched_recipes)} French recipes")
        
        # Save to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"french_recipes_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.fetched_recipes, f, indent=2, ensure_ascii=False)
        
        # Save metadata
        metadata = {
            "timestamp": timestamp,
            "recipes_fetched": len(self.fetched_recipes),
            "api_calls": self.api_calls_used,
            "points_used": self.points_used,
            "cuisine": "French"
        }
        
        with open(f"metadata_{timestamp}.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n💾 Saved to {filename}")
        print(f"📊 Metadata saved to metadata_{timestamp}.json")
        print(f"\n📈 API Usage:")
        print(f"   • API calls: {self.api_calls_used}")
        print(f"   • Points used: {self.points_used:.1f}")
        
        return filename

if __name__ == "__main__":
    fetcher = FrenchRecipeFetcher()
    filename = fetcher.fetch_french_recipes(100)
    print(f"\n✨ Done! French recipes saved to {filename}")
    print(f"📌 Next step: Deploy with ./deploy-add-recipes.sh {filename}")