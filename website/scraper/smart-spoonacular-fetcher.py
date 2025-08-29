#!/usr/bin/env python3
"""
Smart Spoonacular Recipe Fetcher
- Avoids fetching duplicate recipes
- Gets variety of cuisines, diets, and meal types
- Respects API limits
- Tracks what's already on server
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

# Diverse search parameters for variety
CUISINES = [
    "Italian", "Mexican", "Chinese", "Indian", "Thai", "Japanese", 
    "Greek", "French", "Spanish", "Korean", "Vietnamese", "Mediterranean",
    "Middle Eastern", "African", "Caribbean", "German", "British"
]

MEAL_TYPES = [
    "main course", "dessert", "appetizer", "salad", "breakfast",
    "soup", "beverage", "sauce", "snack", "drink", "bread", "side dish"
]

DIETS = [
    "vegetarian", "vegan", "gluten free", "ketogenic", "paleo",
    "whole30", "pescetarian", "primal", "low fodmap"
]

INTOLERANCES = [
    "dairy", "egg", "gluten", "grain", "peanut", "seafood",
    "sesame", "shellfish", "soy", "tree nut", "wheat"
]

SPECIAL_QUERIES = [
    "healthy", "quick easy", "budget friendly", "comfort food",
    "summer", "winter", "holiday", "party", "kids", "romantic",
    "protein rich", "low calorie", "high fiber", "superfood"
]

class SmartRecipeFetcher:
    def __init__(self):
        self.existing_ids = set()
        self.existing_spoon_ids = set()
        self.api_calls_used = 0
        self.points_used = 0
        self.points_left = 1500  # Daily limit
        
        # API Limits and Safety
        self.daily_call_limit = 380  # Stay under 400 with buffer
        self.daily_points_limit = 1450  # Stay under 1500 with buffer
        self.search_page_size = 100  # Max for complexSearch
        self.bulk_batch = 50  # Optimal for informationBulk
        self.min_interval = 0.35  # ~3 req/s (under 5 req/s limit)
        self.points_safety_buffer = 50  # Stop if fewer points remain
        
    def load_existing_recipes(self):
        """Download and analyze existing recipes from server"""
        print("📥 Loading existing recipes from server...")
        
        cmd = f'ssh -i {SSH_KEY} {EC2_USER}@{EC2_HOST} "cat /mnt/recipes/data/recipes.json"'
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        
        if result.returncode != 0:
            print(f"⚠️  Could not load server recipes, will check local cache")
            # Try to load from local cache
            if os.path.exists("recipe_cache.json"):
                with open("recipe_cache.json", 'r') as f:
                    recipes = json.load(f)
            else:
                print("📝 No cache found, starting fresh")
                return
        else:
            recipes = json.loads(result.stdout)
            # Save to local cache
            with open("recipe_cache.json", 'w') as f:
                json.dump(recipes, f)
        
        # Extract all existing IDs
        for recipe in recipes:
            self.existing_ids.add(recipe.get('id', ''))
            if 'spoonacular_id' in recipe:
                self.existing_spoon_ids.add(recipe['spoonacular_id'])
        
        print(f"✅ Loaded {len(recipes)} existing recipes")
        print(f"   • Unique IDs tracked: {len(self.existing_spoon_ids)}")
        
    def check_api_quota(self):
        """Check remaining API quota"""
        url = f"{BASE_URL}/recipes/complexSearch"
        params = {"apiKey": API_KEY, "number": 1}
        
        response = requests.get(url, params=params)
        
        if 'x-api-quota-left' in response.headers:
            self.points_left = float(response.headers['x-api-quota-left'])
            print(f"📊 API Status: {self.points_left:.1f} points remaining today")
            
        # Check both call limit and points limit
        if self.api_calls_used >= self.daily_call_limit:
            print(f"⚠️  Approaching daily call limit ({self.api_calls_used}/{self.daily_call_limit})")
            return False
            
        return self.points_left > self.points_safety_buffer
        
    def search_recipes(self, query="", cuisine=None, diet=None, meal_type=None, 
                      intolerance=None, max_results=20, offset=0):
        """Search for recipe IDs with specific parameters"""
        
        # Limit max results to API maximum
        max_results = min(max_results, self.search_page_size)
        
        params = {
            "apiKey": API_KEY,
            "number": max_results,
            "offset": offset,
            "addRecipeInformation": False,
            "sort": "popularity"
        }
        
        # Build search query
        if query:
            params["query"] = query
        if cuisine:
            params["cuisine"] = cuisine
        if diet:
            params["diet"] = diet
        if meal_type:
            params["type"] = meal_type
        if intolerance:
            params["intolerances"] = intolerance
            
        # Make request
        url = f"{BASE_URL}/recipes/complexSearch"
        response = requests.get(url, params=params)
        
        self.api_calls_used += 1
        
        # Track API usage
        if 'x-api-quota-used' in response.headers:
            self.points_used = float(response.headers['x-api-quota-used'])
        if 'x-api-quota-left' in response.headers:
            self.points_left = float(response.headers['x-api-quota-left'])
            
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            
            # Filter out existing recipes
            new_ids = []
            for r in results:
                if r['id'] not in self.existing_spoon_ids:
                    new_ids.append(r['id'])
                    
            return new_ids
        else:
            print(f"⚠️  Search failed: {response.status_code}")
            return []
            
    def get_recipes_bulk(self, recipe_ids):
        """Get detailed info for multiple recipes"""
        if not recipe_ids:
            return []
            
        url = f"{BASE_URL}/recipes/informationBulk"
        params = {
            "apiKey": API_KEY,
            "ids": ",".join(map(str, recipe_ids)),
            "includeNutrition": True
        }
        
        response = requests.get(url, params=params)
        self.api_calls_used += 1
        
        # Track API usage
        if 'x-api-quota-used' in response.headers:
            self.points_used = float(response.headers['x-api-quota-used'])
        if 'x-api-quota-left' in response.headers:
            self.points_left = float(response.headers['x-api-quota-left'])
            
        if response.status_code == 200:
            return response.json()
        else:
            print(f"⚠️  Bulk fetch failed: {response.status_code}")
            return []
            
    def format_recipe(self, recipe):
        """Format a Spoonacular recipe to match schema"""
        
        # Generate unique ID
        recipe_id = f"spoon_{recipe['id']}_{hashlib.md5(recipe['title'].encode()).hexdigest()[:8]}"
        
        # Extract ingredients
        ingredients = []
        if 'extendedIngredients' in recipe:
            for ing in recipe['extendedIngredients']:
                ingredients.append(ing.get('original', ing.get('name', '')))
        
        # Extract steps
        steps = []
        if 'analyzedInstructions' in recipe and recipe['analyzedInstructions']:
            for instruction in recipe['analyzedInstructions']:
                for step in instruction.get('steps', []):
                    steps.append(step.get('step', ''))
        
        # Extract nutrition
        nutrition = {}
        if 'nutrition' in recipe and 'nutrients' in recipe['nutrition']:
            for nutrient in recipe['nutrition']['nutrients']:
                if nutrient['name'] == 'Calories':
                    nutrition['calories'] = round(nutrient['amount'])
                elif nutrient['name'] == 'Protein':
                    nutrition['protein'] = round(nutrient['amount'])
                elif nutrient['name'] == 'Carbohydrates':
                    nutrition['carbohydrates'] = round(nutrient['amount'])
                elif nutrient['name'] == 'Fat':
                    nutrition['fat'] = round(nutrient['amount'])
        
        # Determine difficulty
        ready_in = recipe.get('readyInMinutes', 45)
        n_ingredients = len(ingredients)
        
        if ready_in <= 30 and n_ingredients <= 8:
            difficulty = "Easy"
        elif ready_in > 60 or n_ingredients > 15:
            difficulty = "Hard"  
        else:
            difficulty = "Medium"
        
        # Extract tags
        tags = []
        if recipe.get('vegetarian'):
            tags.append('Vegetarian')
        if recipe.get('vegan'):
            tags.append('Vegan')
        if recipe.get('glutenFree'):
            tags.append('Gluten-Free')
        if recipe.get('dairyFree'):
            tags.append('Dairy-Free')
        if recipe.get('veryHealthy'):
            tags.append('Healthy')
        if recipe.get('cheap'):
            tags.append('Budget-Friendly')
        if ready_in <= 30:
            tags.append('Quick & Easy')
        
        # Primary category
        dish_types = recipe.get('dishTypes', [])
        if dish_types:
            primary_category = dish_types[0].title()
        else:
            primary_category = "Main Course"
        
        return {
            "id": recipe_id,
            "spoonacular_id": recipe['id'],
            "name": recipe['title'],
            "description": recipe.get('summary', '').replace('<b>', '').replace('</b>', ''),
            "ingredients": ingredients,
            "steps": steps,
            "minutes": ready_in,
            "n_ingredients": n_ingredients,
            "n_steps": len(steps),
            "nutrition": nutrition,
            "tags": tags,
            "cuisine": recipe.get('cuisines', []),
            "difficulty": difficulty,
            "primary_category": primary_category,
            "image": recipe.get('image', ''),
            "source_url": recipe.get('sourceUrl', ''),
            "servings": recipe.get('servings', 4),
            "health_score": recipe.get('healthScore', 0)
        }
        
    def fetch_diverse_recipes(self, target_count=100):
        """Fetch diverse recipes using various search strategies"""
        
        all_recipe_ids = []
        searches_done = []
        
        print(f"\n🎯 Target: {target_count} new unique recipes")
        print("=" * 50)
        
        # Strategy 1: Search by cuisines
        print("\n🌍 Searching by cuisines...")
        cuisines_to_try = random.sample(CUISINES, min(8, len(CUISINES)))
        for cuisine in cuisines_to_try:
            # Check limits before each search
            if (len(all_recipe_ids) >= target_count or 
                self.points_left < self.points_safety_buffer or
                self.api_calls_used >= self.daily_call_limit):
                break
                
            print(f"  • {cuisine}...", end="")
            new_ids = self.search_recipes(cuisine=cuisine, max_results=15)
            filtered = [id for id in new_ids if id not in all_recipe_ids]
            all_recipe_ids.extend(filtered)
            print(f" found {len(filtered)} new")
            searches_done.append(f"cuisine:{cuisine}")
            time.sleep(self.min_interval)  # Use configured interval
            
        # Strategy 2: Search by meal types
        print("\n🍽️  Searching by meal types...")
        meal_types_to_try = random.sample(MEAL_TYPES, min(6, len(MEAL_TYPES)))
        for meal_type in meal_types_to_try:
            if (len(all_recipe_ids) >= target_count or 
                self.points_left < self.points_safety_buffer or
                self.api_calls_used >= self.daily_call_limit):
                break
                
            print(f"  • {meal_type}...", end="")
            new_ids = self.search_recipes(meal_type=meal_type, max_results=10)
            filtered = [id for id in new_ids if id not in all_recipe_ids]
            all_recipe_ids.extend(filtered)
            print(f" found {len(filtered)} new")
            searches_done.append(f"type:{meal_type}")
            time.sleep(self.min_interval)
            
        # Strategy 3: Search by diets
        print("\n🥗 Searching by diets...")
        diets_to_try = random.sample(DIETS, min(4, len(DIETS)))
        for diet in diets_to_try:
            if (len(all_recipe_ids) >= target_count or 
                self.points_left < self.points_safety_buffer or
                self.api_calls_used >= self.daily_call_limit):
                break
                
            print(f"  • {diet}...", end="")
            new_ids = self.search_recipes(diet=diet, max_results=10)
            filtered = [id for id in new_ids if id not in all_recipe_ids]
            all_recipe_ids.extend(filtered)
            print(f" found {len(filtered)} new")
            searches_done.append(f"diet:{diet}")
            time.sleep(self.min_interval)
            
        # Strategy 4: Special queries
        print("\n✨ Searching special categories...")
        special_to_try = random.sample(SPECIAL_QUERIES, min(5, len(SPECIAL_QUERIES)))
        for query in special_to_try:
            if (len(all_recipe_ids) >= target_count or 
                self.points_left < self.points_safety_buffer or
                self.api_calls_used >= self.daily_call_limit):
                break
                
            print(f"  • {query}...", end="")
            new_ids = self.search_recipes(query=query, max_results=10)
            filtered = [id for id in new_ids if id not in all_recipe_ids]
            all_recipe_ids.extend(filtered)
            print(f" found {len(filtered)} new")
            searches_done.append(f"query:{query}")
            time.sleep(self.min_interval)
            
        # Trim to target count
        all_recipe_ids = all_recipe_ids[:target_count]
        
        print(f"\n📊 Collected {len(all_recipe_ids)} unique recipe IDs")
        print(f"   • Searches performed: {len(searches_done)}")
        print(f"   • API calls used: {self.api_calls_used}")
        print(f"   • Points remaining: {self.points_left:.1f}")
        
        return all_recipe_ids, searches_done
        
    def fetch_and_save(self, target_count=100):
        """Main method to fetch and save recipes"""
        
        print("🔥 Smart Spoonacular Recipe Fetcher")
        print("=" * 50)
        
        # Check API quota first
        if not self.check_api_quota():
            print("❌ Insufficient API quota for today")
            return False
            
        # Load existing recipes
        self.load_existing_recipes()
        
        # Fetch diverse recipe IDs
        recipe_ids, searches = self.fetch_diverse_recipes(target_count)
        
        if not recipe_ids:
            print("❌ No new recipes found")
            return False
            
        # Fetch full details in batches
        print(f"\n📦 Fetching full details for {len(recipe_ids)} recipes...")
        all_recipes = []
        
        # Estimate points needed for bulk fetches
        batches_needed = (len(recipe_ids) + self.bulk_batch - 1) // self.bulk_batch
        estimated_points = batches_needed * 25  # ~25 points per bulk call
        
        if self.points_left < estimated_points + self.points_safety_buffer:
            print(f"⚠️  Insufficient points for {batches_needed} bulk fetches")
            print(f"   Need ~{estimated_points} points, have {self.points_left:.1f}")
            # Reduce recipe count to what we can handle
            max_recipes = int((self.points_left - self.points_safety_buffer) / 25) * self.bulk_batch
            recipe_ids = recipe_ids[:max_recipes]
            print(f"   Reducing to {len(recipe_ids)} recipes")
        
        # Process in batches using configured batch size
        for i in range(0, len(recipe_ids), self.bulk_batch):
            batch = recipe_ids[i:i+self.bulk_batch]
            print(f"  • Batch {i//self.bulk_batch + 1}: {len(batch)} recipes...", end="")
            
            raw_recipes = self.get_recipes_bulk(batch)
            
            # Format each recipe
            for recipe in raw_recipes:
                try:
                    formatted = self.format_recipe(recipe)
                    all_recipes.append(formatted)
                    # Track as existing to avoid future duplicates
                    self.existing_spoon_ids.add(recipe['id'])
                except Exception as e:
                    print(f"\n    ⚠️  Error: {e}")
                    
            print(f" ✅")
            time.sleep(self.min_interval)
            
        # Save recipes
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"new_recipes_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(all_recipes, f, indent=2)
            
        print(f"\n💾 Saved {len(all_recipes)} recipes to {filename}")
        
        # Update cache
        if os.path.exists("recipe_cache.json"):
            with open("recipe_cache.json", 'r') as f:
                cache = json.load(f)
            cache.extend(all_recipes)
            with open("recipe_cache.json", 'w') as f:
                json.dump(cache, f)
                
        # Create metadata
        metadata = {
            "source": "Spoonacular API - Smart Diverse Fetch",
            "total_recipes": len(all_recipes),
            "generation_date": datetime.now().isoformat(),
            "api_calls_used": self.api_calls_used,
            "points_used": self.points_used,
            "points_remaining": self.points_left,
            "searches_performed": searches,
            "cuisines": list(set([c for r in all_recipes for c in r.get('cuisine', [])])),
            "categories": list(set([r.get('primary_category', '') for r in all_recipes])),
            "diets": list(set([t for r in all_recipes for t in r.get('tags', []) if 'Free' in t or 'Vegan' in t or 'Vegetarian' in t]))
        }
        
        metadata_file = f"metadata_{timestamp}.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
            
        print(f"📊 Saved metadata to {metadata_file}")
        
        # Show summary
        print("\n" + "=" * 50)
        print("📈 Fetch Summary:")
        print(f"  • Recipes fetched: {len(all_recipes)}")
        print(f"  • API calls: {self.api_calls_used}")
        print(f"  • Points used: {self.points_used:.1f}")
        print(f"  • Points remaining: {self.points_left:.1f}")
        print(f"  • Cuisines covered: {len(metadata['cuisines'])}")
        print(f"  • Categories: {len(metadata['categories'])}")
        
        # Sample recipes
        if all_recipes:
            print(f"\n📝 Sample recipes:")
            for recipe in all_recipes[:5]:
                cuisine = recipe['cuisine'][0] if recipe['cuisine'] else 'International'
                print(f"  • {recipe['name']} ({cuisine}, {recipe['difficulty']})")
                
        return filename, metadata_file

def main():
    fetcher = SmartRecipeFetcher()
    
    # Check if target count is provided
    import sys
    target = 100
    if len(sys.argv) > 1:
        try:
            target = int(sys.argv[1])
        except:
            print(f"Invalid target count, using default: {target}")
            
    result = fetcher.fetch_and_save(target)
    
    if result:
        recipes_file, metadata_file = result
        print(f"\n✅ Success! New recipes saved to {recipes_file}")
        print(f"💡 To deploy: ./deploy-add-recipes.sh {recipes_file}")

if __name__ == "__main__":
    main()