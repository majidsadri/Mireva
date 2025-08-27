#!/usr/bin/env python3
"""
Spoonacular Comprehensive Recipe Scraper
Maximizes 400 daily API calls to fetch diverse, well-organized recipes
"""

import json
import time
import random
from pathlib import Path
import logging
from datetime import datetime
from typing import Dict, List, Optional
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from urllib.parse import urlencode
import re
import hashlib

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SpoonacularComprehensiveScraper:
    def __init__(self, api_key: str = "f6df370ddf8d4bc2a5ed9fb60f2f0be5"):
        self.api_key = api_key
        self.base_url = "https://api.spoonacular.com"
        self.output_dir = Path("./processed_recipes")
        self.recipes = []
        self.api_calls_made = 0
        
        # API Limits Configuration - Optimized for your tier
        self.daily_target = 380               # Stay under 400 limit with safety buffer
        self.search_page_size = 100           # Max for complexSearch
        self.bulk_batch = 50                  # Good size for informationBulk
        self.min_interval = 0.30              # ~3 req/s to stay under 5 req/s limit
        self.points_safety_buffer = 20        # Stop if fewer points remain
        
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        
        # Track API usage
        self.points_used = 0
        self.points_left = 1500  # Will be updated from API headers
        
        # Comprehensive search strategy
        self.search_strategy = {
            'cuisines': ['Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 'French', 
                        'Greek', 'Spanish', 'American', 'Korean', 'Vietnamese', 'Lebanese', 'Turkish',
                        'Moroccan', 'German', 'British', 'Russian', 'Brazilian', 'Cajun'],
            'meal_types': ['breakfast', 'lunch', 'dinner', 'dessert', 'appetizer', 'snack', 'soup', 
                          'salad', 'side dish', 'main course', 'beverage'],
            'diets': ['vegetarian', 'vegan', 'gluten free', 'dairy free', 'ketogenic', 'paleo',
                     'whole30', 'pescetarian'],
            'occasions': ['christmas', 'thanksgiving', 'easter', 'valentine', 'new year', 'birthday',
                         'summer', 'winter', 'spring', 'fall'],
            'cooking_methods': ['baked', 'grilled', 'fried', 'roasted', 'steamed', 'slow cooker',
                               'instant pot', 'air fryer', 'one pot', 'no cook'],
            'health_tags': ['healthy', 'low calorie', 'high protein', 'low carb', 'high fiber',
                           'anti inflammatory', 'heart healthy', 'diabetic friendly']
        }
        
    def setup_directories(self):
        """Create necessary directories"""
        self.output_dir.mkdir(exist_ok=True)
        logger.info(f"Output directory ready: {self.output_dir}")
    
    def make_request(self, endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Make API request with proper quota tracking using headers"""
        # Check if we're approaching our daily target
        if self.api_calls_made >= self.daily_target:
            logger.warning(f"Reached daily target of {self.daily_target} calls")
            return None
            
        # Check if we have enough points left
        if self.points_left <= self.points_safety_buffer:
            logger.warning(f"Insufficient points remaining: {self.points_left}")
            return None
            
        params = params or {}
        params['apiKey'] = self.api_key
        
        query_string = urlencode(params)
        url = f"{self.base_url}{endpoint}?{query_string}"
        
        # Rate limiting - ensure we don't exceed 5 req/s
        time.sleep(self.min_interval)
        
        try:
            req = Request(url, headers=self.headers)
            with urlopen(req, timeout=30) as response:
                self.api_calls_made += 1
                
                # Track API usage from response headers
                headers = response.headers
                if 'X-API-Quota-Request' in headers:
                    try:
                        points_used_this_call = float(headers['X-API-Quota-Request'])
                    except (ValueError, TypeError):
                        points_used_this_call = 1
                else:
                    points_used_this_call = 1  # Default assumption
                    
                if 'X-API-Quota-Used' in headers:
                    try:
                        self.points_used = float(headers['X-API-Quota-Used'])
                    except (ValueError, TypeError):
                        pass
                    
                if 'X-API-Quota-Left' in headers:
                    try:
                        self.points_left = float(headers['X-API-Quota-Left'])
                    except (ValueError, TypeError):
                        pass
                
                data = response.read()
                logger.info(f"API call {self.api_calls_made}: {endpoint} | Points used: {points_used_this_call} | Points left: {self.points_left}")
                return json.loads(data.decode('utf-8', errors='ignore'))
                
        except HTTPError as e:
            self.api_calls_made += 1
            if e.code == 429:
                logger.warning("Rate limit exceeded, waiting 60 seconds...")
                time.sleep(60)
                return None
            elif e.code == 402:
                logger.error("API quota exceeded. Check your Spoonacular plan.")
                return None
            else:
                logger.error(f"HTTP Error {e.code} for {endpoint}: {e.reason}")
            return None
        except Exception as e:
            logger.error(f"Error fetching {endpoint}: {e}")
            return None
    
    def search_recipe_ids(self, **params) -> List[int]:
        """Search for recipe IDs only (cheap API call)"""
        search_params = {
            'number': params.get('number', self.search_page_size),
            'addRecipeInformation': 'false',  # Keep it cheap - just get IDs
            'sort': params.get('sort', 'popularity'),
            'instructionsRequired': 'true'
        }
        
        # Add search filters
        for key, value in params.items():
            if key != 'number' and value:
                search_params[key] = value
        
        data = self.make_request("/recipes/complexSearch", search_params)
        
        if data and 'results' in data:
            # Extract just the IDs for cheap bulk retrieval
            return [recipe['id'] for recipe in data['results']]
        return []
    
    def get_recipes_information_bulk(self, recipe_ids: List[int]) -> List[Dict]:
        """Get detailed information for multiple recipes efficiently"""
        if not recipe_ids:
            return []
            
        # Process in batches to respect bulk API limits
        all_recipes = []
        for i in range(0, len(recipe_ids), self.bulk_batch):
            batch_ids = recipe_ids[i:i+self.bulk_batch]
            ids_str = ','.join(map(str, batch_ids))
            
            params = {
                'ids': ids_str,
                'includeNutrition': 'true'
            }
            
            data = self.make_request("/recipes/informationBulk", params)
            if data and isinstance(data, list):
                all_recipes.extend(data)
                logger.info(f"Retrieved {len(data)} recipes in bulk batch")
            
            # Brief pause between bulk requests
            time.sleep(0.1)
            
        return all_recipes
    
    def get_random_recipes(self, number: int = 10, tags: str = "") -> List[Dict]:
        """Get random recipes"""
        params = {'number': min(number, 100)}
        if tags:
            params['tags'] = tags
        
        data = self.make_request("/recipes/random", params)
        
        if data and 'recipes' in data:
            return data['recipes']
        return []
    
    def clean_html(self, text: str) -> str:
        """Clean HTML tags from text"""
        if not text:
            return ""
        clean_text = re.sub('<[^<]+?>', '', text)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        return clean_text
    
    def generate_recipe_id(self, recipe: Dict) -> str:
        """Generate consistent recipe ID"""
        spoon_id = str(recipe.get('id', ''))
        title = recipe.get('title', 'unknown')
        
        # Create hash from title for consistency
        title_hash = hashlib.md5(title.encode()).hexdigest()[:8]
        
        return f"spoon_{spoon_id}_{title_hash}" if spoon_id else f"recipe_{title_hash}"
    
    def categorize_recipe(self, recipe: Dict) -> Dict:
        """Comprehensive recipe categorization"""
        tags = set()
        categories = {
            'cuisine': [],
            'meal_type': [],
            'diet': [],
            'difficulty': 'Medium',
            'occasion': [],
            'cooking_method': [],
            'health_category': [],
            'primary_category': 'Main Course'
        }
        
        # Extract from Spoonacular fields
        if 'cuisines' in recipe and recipe['cuisines']:
            categories['cuisine'].extend(recipe['cuisines'])
            tags.update(recipe['cuisines'])
        
        if 'dishTypes' in recipe and recipe['dishTypes']:
            for dish_type in recipe['dishTypes']:
                dish_type = dish_type.title()
                categories['meal_type'].append(dish_type)
                tags.add(dish_type)
                
                # Set primary category
                if dish_type.lower() in ['dessert', 'sweet']:
                    categories['primary_category'] = 'Dessert'
                elif dish_type.lower() in ['appetizer', 'starter', 'antipasti']:
                    categories['primary_category'] = 'Appetizer'
                elif dish_type.lower() in ['soup', 'broth']:
                    categories['primary_category'] = 'Soup'
                elif dish_type.lower() in ['salad']:
                    categories['primary_category'] = 'Salad'
                elif dish_type.lower() in ['breakfast', 'brunch']:
                    categories['primary_category'] = 'Breakfast'
                elif dish_type.lower() in ['beverage', 'drink']:
                    categories['primary_category'] = 'Beverage'
                elif dish_type.lower() in ['snack']:
                    categories['primary_category'] = 'Snack'
        
        if 'occasions' in recipe and recipe['occasions']:
            categories['occasion'].extend([occ.title() for occ in recipe['occasions']])
            tags.update([occ.title() for occ in recipe['occasions']])
        
        # Diet categorization
        diet_flags = {
            'vegetarian': 'Vegetarian',
            'vegan': 'Vegan',
            'glutenFree': 'Gluten-Free',
            'dairyFree': 'Dairy-Free',
            'ketogenic': 'Ketogenic',
            'whole30': 'Whole30',
            'lowFodmap': 'Low FODMAP'
        }
        
        for flag, diet_name in diet_flags.items():
            if recipe.get(flag):
                categories['diet'].append(diet_name)
                tags.add(diet_name)
        
        # Health categorization
        if recipe.get('veryHealthy'):
            categories['health_category'].append('Very Healthy')
            tags.add('Healthy')
        
        if recipe.get('healthScore', 0) > 70:
            categories['health_category'].append('High Health Score')
            tags.add('Nutritious')
        elif recipe.get('healthScore', 0) < 30:
            tags.add('Comfort Food')
        
        if recipe.get('cheap'):
            categories['health_category'].append('Budget-Friendly')
            tags.add('Budget-Friendly')
        
        if recipe.get('veryPopular'):
            tags.add('Popular')
        
        if recipe.get('sustainable'):
            categories['health_category'].append('Sustainable')
            tags.add('Eco-Friendly')
        
        # Difficulty based on time and steps
        ready_time = recipe.get('readyInMinutes', 0)
        
        # Count steps from instructions
        step_count = 0
        if 'analyzedInstructions' in recipe:
            for instruction_group in recipe['analyzedInstructions']:
                if 'steps' in instruction_group:
                    step_count += len(instruction_group['steps'])
        
        # Determine difficulty
        if ready_time <= 30 and step_count <= 5:
            categories['difficulty'] = 'Easy'
            tags.add('Quick & Easy')
        elif ready_time <= 60 and step_count <= 10:
            categories['difficulty'] = 'Medium'
        else:
            categories['difficulty'] = 'Hard'
            tags.add('Advanced')
        
        if ready_time <= 15:
            tags.add('Super Quick')
        elif ready_time <= 30:
            tags.add('Quick')
        elif ready_time >= 120:
            tags.add('Slow Cook')
        
        # Cooking method detection from title and instructions
        title_lower = recipe.get('title', '').lower()
        instructions_text = ""
        
        if 'analyzedInstructions' in recipe:
            for instruction_group in recipe['analyzedInstructions']:
                if 'steps' in instruction_group:
                    for step in instruction_group['steps']:
                        instructions_text += step.get('step', '').lower() + " "
        
        cooking_methods = {
            'baked': ['bake', 'baking', 'oven', 'roast'],
            'grilled': ['grill', 'barbecue', 'bbq'],
            'fried': ['fry', 'deep fry', 'pan fry'],
            'steamed': ['steam', 'steamer'],
            'slow cooked': ['slow cooker', 'crock pot', 'slow cook'],
            'pressure cooked': ['instant pot', 'pressure cook'],
            'air fried': ['air fryer', 'air fry'],
            'no cook': ['no bake', 'no cook', 'raw'],
            'one pot': ['one pot', 'one pan', 'single pot']
        }
        
        search_text = title_lower + " " + instructions_text
        
        for method, keywords in cooking_methods.items():
            if any(keyword in search_text for keyword in keywords):
                categories['cooking_method'].append(method.title())
                tags.add(method.title())
        
        # Nutritional categorization
        nutrition = recipe.get('nutrition', {})
        if nutrition and 'nutrients' in nutrition:
            nutrients = {n['name'].lower(): n['amount'] for n in nutrition['nutrients']}
            
            if nutrients.get('protein', 0) > 20:
                categories['health_category'].append('High Protein')
                tags.add('High Protein')
            
            if nutrients.get('fiber', 0) > 5:
                categories['health_category'].append('High Fiber')
                tags.add('High Fiber')
            
            if nutrients.get('calories', 0) < 300:
                categories['health_category'].append('Low Calorie')
                tags.add('Light')
            elif nutrients.get('calories', 0) > 600:
                tags.add('Hearty')
        
        return {
            'tags': sorted(list(tags)),
            'categories': categories
        }
    
    def convert_to_mireva_format(self, recipe: Dict) -> Dict:
        """Convert to comprehensive Mireva format"""
        
        # Extract ingredients
        ingredients = []
        if 'extendedIngredients' in recipe:
            for ing in recipe['extendedIngredients']:
                ingredients.append(ing.get('original', ''))
        
        # Extract steps
        steps = []
        if 'analyzedInstructions' in recipe and recipe['analyzedInstructions']:
            for instruction_group in recipe['analyzedInstructions']:
                if 'steps' in instruction_group:
                    for step in instruction_group['steps']:
                        step_text = step.get('step', '').strip()
                        if step_text:
                            steps.append(step_text)
        elif recipe.get('instructions'):
            # Fallback to instructions field
            instructions = self.clean_html(recipe['instructions'])
            if instructions:
                # Split into steps
                step_patterns = [
                    r'\d+\.\s*([^.]+(?:\.[^.]*)?)',  # Numbered steps
                    r'([A-Z][^.!?]*[.!?])',  # Sentence-based
                ]
                
                for pattern in step_patterns:
                    matches = re.findall(pattern, instructions)
                    if matches and len(matches) > 1:
                        steps = [s.strip() for s in matches if len(s.strip()) > 10]
                        break
                
                if not steps:
                    # Split by periods as last resort
                    steps = [s.strip() for s in instructions.split('.') if len(s.strip()) > 15]
        
        # Extract nutrition
        nutrition = {}
        if 'nutrition' in recipe and 'nutrients' in recipe['nutrition']:
            for nutrient in recipe['nutrition']['nutrients']:
                name = nutrient.get('name', '').lower()
                amount = nutrient.get('amount', 0)
                unit = nutrient.get('unit', '')
                
                if 'calories' in name:
                    nutrition['calories'] = round(amount, 1)
                elif 'protein' in name:
                    nutrition['protein'] = round(amount, 1)
                elif 'carbohydrate' in name:
                    nutrition['carbohydrates'] = round(amount, 1)
                elif 'fat' in name and 'saturated' not in name:
                    nutrition['fat'] = round(amount, 1)
                elif 'saturated fat' in name:
                    nutrition['saturated_fat'] = round(amount, 1)
                elif 'fiber' in name:
                    nutrition['fiber'] = round(amount, 1)
                elif 'sugar' in name:
                    nutrition['sugar'] = round(amount, 1)
                elif 'sodium' in name:
                    nutrition['sodium'] = round(amount, 1)
                elif 'cholesterol' in name:
                    nutrition['cholesterol'] = round(amount, 1)
        
        # Get categorization
        categorization = self.categorize_recipe(recipe)
        
        # Create description
        description = ""
        if recipe.get('summary'):
            description = self.clean_html(recipe['summary'])[:300] + "..."
        else:
            # Generate description from categories
            desc_parts = []
            if categorization['categories']['cuisine']:
                desc_parts.append(categorization['categories']['cuisine'][0])
            if categorization['categories']['primary_category']:
                desc_parts.append(categorization['categories']['primary_category'].lower())
            if categorization['categories']['diet']:
                desc_parts.append(categorization['categories']['diet'][0].lower())
            
            if desc_parts:
                description = f"A delicious {' '.join(desc_parts)} recipe"
        
        # Generate consistent ID
        recipe_id = self.generate_recipe_id(recipe)
        
        mireva_recipe = {
            # Basic info
            'id': recipe_id,
            'spoonacular_id': recipe.get('id'),
            'name': recipe.get('title', 'Unknown Recipe'),
            'description': description,
            
            # Recipe content
            'ingredients': ingredients,
            'steps': steps,
            
            # Timing and serving
            'minutes': recipe.get('readyInMinutes', 0),
            'prep_minutes': recipe.get('preparationMinutes', 0),
            'cook_minutes': recipe.get('cookingMinutes', 0),
            'servings': recipe.get('servings', 0),
            
            # Counts
            'n_ingredients': len(ingredients),
            'n_steps': len(steps),
            
            # Nutrition
            'nutrition': nutrition,
            
            # Comprehensive categorization
            'tags': categorization['tags'],
            'cuisine': categorization['categories']['cuisine'],
            'meal_type': categorization['categories']['meal_type'],
            'diet': categorization['categories']['diet'],
            'difficulty': categorization['categories']['difficulty'],
            'occasion': categorization['categories']['occasion'],
            'cooking_method': categorization['categories']['cooking_method'],
            'health_category': categorization['categories']['health_category'],
            'primary_category': categorization['categories']['primary_category'],
            
            # Spoonacular scores
            'health_score': recipe.get('healthScore', 0),
            'spoonacular_score': recipe.get('spoonacularScore', 0),
            'popularity': recipe.get('aggregateLikes', 0),
            'price_per_serving': recipe.get('pricePerServing', 0),
            
            # Media and sources
            'image': recipe.get('image', ''),
            'source_name': recipe.get('sourceName', ''),
            'source_url': recipe.get('sourceUrl', ''),
            'spoonacular_url': recipe.get('spoonacularSourceUrl', ''),
            
            # Metadata
            'scraped_at': datetime.now().isoformat(),
            'api_source': 'Spoonacular'
        }
        
        return mireva_recipe
    
    def execute_smart_fetch_strategy(self):
        """Efficient two-phase strategy: collect IDs cheaply, then bulk hydrate"""
        logger.info("Starting efficient two-phase fetch strategy...")
        logger.info(f"Daily target: {self.daily_target} calls | Points left: {self.points_left}")
        
        # Phase 1: Collect Recipe IDs (cheap calls - ~1 point each)
        all_recipe_ids = set()
        
        # Strategy for ID collection:
        # - 8 search calls for popular cuisines (8×1 = 8 points)  
        # - 4 search calls for meal types (4×1 = 4 points)
        # - 2 search calls for diets (2×1 = 2 points)
        # - 1 random call (1×1 = 1 point)
        # Total: ~15 points for ID collection
        
        # Phase 1A: Collect IDs from popular cuisines
        logger.info("Phase 1A: Collecting IDs from cuisines...")
        top_cuisines = ['Italian', 'American', 'Mexican', 'Chinese', 'Indian', 'French', 'Thai', 'Mediterranean']
        
        for cuisine in top_cuisines:
            if self.points_left <= self.points_safety_buffer:
                break
                
            recipe_ids = self.search_recipe_ids(
                cuisine=cuisine,
                number=self.search_page_size,
                sort='popularity'
            )
            all_recipe_ids.update(recipe_ids)
            logger.info(f"Collected {len(recipe_ids)} IDs from {cuisine} cuisine")
        
        # Phase 1B: Collect IDs from meal types
        logger.info("Phase 1B: Collecting IDs from meal types...")
        meal_types = ['dinner', 'lunch', 'breakfast', 'dessert']
        
        for meal_type in meal_types:
            if self.points_left <= self.points_safety_buffer:
                break
                
            recipe_ids = self.search_recipe_ids(
                query=meal_type,
                number=self.search_page_size,
                sort='healthiness'
            )
            all_recipe_ids.update(recipe_ids)
            logger.info(f"Collected {len(recipe_ids)} IDs from {meal_type}")
        
        # Phase 1C: Collect IDs from diet types
        logger.info("Phase 1C: Collecting IDs from diets...")
        diets = ['vegetarian', 'gluten free']
        
        for diet in diets:
            if self.points_left <= self.points_safety_buffer:
                break
                
            recipe_ids = self.search_recipe_ids(
                diet=diet,
                number=self.search_page_size,
                sort='popularity'
            )
            all_recipe_ids.update(recipe_ids)
            logger.info(f"Collected {len(recipe_ids)} IDs from {diet} diet")
        
        logger.info(f"Phase 1 complete: {len(all_recipe_ids)} unique recipe IDs collected")
        
        # Phase 2: Bulk hydrate recipes efficiently
        logger.info("Phase 2: Bulk hydrating recipe details...")
        recipe_ids_list = list(all_recipe_ids)
        
        # Calculate how many recipes we can afford to hydrate
        estimated_bulk_calls = len(recipe_ids_list) // self.bulk_batch + (1 if len(recipe_ids_list) % self.bulk_batch else 0)
        points_needed = estimated_bulk_calls * 2  # Assume ~2 points per bulk call
        
        if points_needed > (self.points_left - self.points_safety_buffer):
            # Trim the recipe list to fit our budget
            max_recipes = ((self.points_left - self.points_safety_buffer) // 2) * self.bulk_batch
            recipe_ids_list = recipe_ids_list[:max_recipes]
            logger.info(f"Trimmed recipe list to {len(recipe_ids_list)} to fit budget")
        
        detailed_recipes = self.get_recipes_information_bulk(recipe_ids_list)
        
        # Process and convert recipes
        for recipe in detailed_recipes:
            converted = self.convert_to_mireva_format(recipe)
            if self._is_valid_recipe(converted):
                if not any(r['id'] == converted['id'] for r in self.recipes):
                    self.recipes.append(converted)
                    logger.info(f"Added: {converted['name']} ({len(self.recipes)} total)")
        
        logger.info(f"Successfully collected {len(self.recipes)} recipes using {self.api_calls_made} API calls")
        logger.info(f"Points used: {self.points_used}, Points remaining: {self.points_left}")
    
    def auto_deploy_to_mireva(self):
        """Automatically deploy recipes to mireva.life"""
        import subprocess
        
        logger.info("Starting automatic deployment to mireva.life...")
        
        try:
            # Run the deployment script
            result = subprocess.run(
                ['bash', '/Users/majidsadri/Mireva/website/deploy-new-recipes.sh'],
                cwd='/Users/majidsadri/Mireva/website',
                capture_output=True,
                text=True,
                input='y\n',  # Auto-confirm deployment
                timeout=300
            )
            
            if result.returncode == 0:
                logger.info("✅ Successfully deployed to mireva.life!")
                logger.info("🌐 Recipes are now live at: https://www.mireva.life/recipes.html")
                return True
            else:
                logger.error(f"❌ Deployment failed: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("❌ Deployment timed out")
            return False
        except Exception as e:
            logger.error(f"❌ Deployment error: {e}")
            return False
    
    def _is_valid_recipe(self, recipe: Dict) -> bool:
        """Validate recipe quality"""
        return (
            recipe.get('name') and 
            len(recipe.get('ingredients', [])) >= 3 and
            len(recipe.get('steps', [])) >= 2 and
            recipe.get('name') != 'Unknown Recipe'
        )
    
    def save_recipes(self):
        """Save recipes in Mireva format and deploy"""
        if not self.recipes:
            logger.warning("No recipes to save!")
            return
            
        # Sort recipes by popularity and health score
        self.recipes.sort(key=lambda r: (r.get('spoonacular_score', 0) + r.get('health_score', 0)), reverse=True)
        
        # Save to deployment-ready format (same as recipes.json)
        recipes_file = self.output_dir / "recipes.json"
        with open(recipes_file, 'w', encoding='utf-8') as f:
            json.dump(self.recipes, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved {len(self.recipes)} recipes to {recipes_file}")
        
        # Save metadata for deployment
        metadata = {
            'source': 'Spoonacular API Comprehensive Collection',
            'total_recipes': len(self.recipes),
            'generation_date': datetime.now().isoformat(),
            'deployed_date': datetime.now().isoformat(),
            'version': '2.0',
            'api_calls_used': self.api_calls_made,
            'points_used': self.points_used,
            'points_remaining': self.points_left,
            'features': [
                'comprehensive_search',
                'bulk_retrieval', 
                'diverse_cuisines',
                'nutrition_data',
                'difficulty_ratings'
            ]
        }
        
        metadata_file = self.output_dir / "metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved metadata to {metadata_file}")
        
        # Auto-deploy to mireva.life
        logger.info("🚀 Starting automatic deployment...")
        if self.auto_deploy_to_mireva():
            logger.info("🎉 Recipe collection successfully deployed to mireva.life!")
        else:
            logger.warning("⚠️  Deployment failed. You can manually deploy using: ./deploy-new-recipes.sh")
    
    def _generate_statistics(self) -> Dict:
        """Generate comprehensive statistics"""
        stats = {
            'total_recipes': len(self.recipes),
            'by_cuisine': {},
            'by_meal_type': {},
            'by_diet': {},
            'by_difficulty': {},
            'by_primary_category': {},
            'by_cooking_method': {},
            'health_distribution': {},
            'averages': {}
        }
        
        # Calculate averages
        total_time = sum(r.get('minutes', 0) for r in self.recipes)
        total_ingredients = sum(r.get('n_ingredients', 0) for r in self.recipes)
        total_steps = sum(r.get('n_steps', 0) for r in self.recipes)
        total_health_score = sum(r.get('health_score', 0) for r in self.recipes)
        
        recipe_count = len(self.recipes)
        if recipe_count > 0:
            stats['averages'] = {
                'cook_time_minutes': round(total_time / recipe_count, 1),
                'ingredients_count': round(total_ingredients / recipe_count, 1),
                'steps_count': round(total_steps / recipe_count, 1),
                'health_score': round(total_health_score / recipe_count, 1)
            }
        
        # Count categories
        for recipe in self.recipes:
            # Cuisines
            for cuisine in recipe.get('cuisine', []):
                stats['by_cuisine'][cuisine] = stats['by_cuisine'].get(cuisine, 0) + 1
            
            # Meal types
            for meal_type in recipe.get('meal_type', []):
                stats['by_meal_type'][meal_type] = stats['by_meal_type'].get(meal_type, 0) + 1
            
            # Diets
            for diet in recipe.get('diet', []):
                stats['by_diet'][diet] = stats['by_diet'].get(diet, 0) + 1
            
            # Difficulty
            difficulty = recipe.get('difficulty', 'Unknown')
            stats['by_difficulty'][difficulty] = stats['by_difficulty'].get(difficulty, 0) + 1
            
            # Primary category
            primary = recipe.get('primary_category', 'Unknown')
            stats['by_primary_category'][primary] = stats['by_primary_category'].get(primary, 0) + 1
            
            # Cooking methods
            for method in recipe.get('cooking_method', []):
                stats['by_cooking_method'][method] = stats['by_cooking_method'].get(method, 0) + 1
            
            # Health score distribution
            health_score = recipe.get('health_score', 0)
            if health_score >= 80:
                category = 'Excellent (80+)'
            elif health_score >= 60:
                category = 'Good (60-79)'
            elif health_score >= 40:
                category = 'Fair (40-59)'
            else:
                category = 'Poor (<40)'
            
            stats['health_distribution'][category] = stats['health_distribution'].get(category, 0) + 1
        
        # Sort by frequency
        for category in ['by_cuisine', 'by_meal_type', 'by_diet', 'by_difficulty', 'by_primary_category', 'by_cooking_method']:
            stats[category] = dict(sorted(stats[category].items(), key=lambda x: x[1], reverse=True))
        
        return stats
    
    def _save_categorized_collections(self):
        """Save recipes organized by categories"""
        # Save by cuisine
        by_cuisine = {}
        for recipe in self.recipes:
            for cuisine in recipe.get('cuisine', []):
                if cuisine not in by_cuisine:
                    by_cuisine[cuisine] = []
                by_cuisine[cuisine].append(recipe)
        
        cuisine_file = self.output_dir / "recipes_by_cuisine.json"
        with open(cuisine_file, 'w', encoding='utf-8') as f:
            json.dump(by_cuisine, f, indent=2, ensure_ascii=False)
        
        # Save by meal type
        by_meal_type = {}
        for recipe in self.recipes:
            primary_category = recipe.get('primary_category', 'Main Course')
            if primary_category not in by_meal_type:
                by_meal_type[primary_category] = []
            by_meal_type[primary_category].append(recipe)
        
        meal_type_file = self.output_dir / "recipes_by_meal_type.json"
        with open(meal_type_file, 'w', encoding='utf-8') as f:
            json.dump(by_meal_type, f, indent=2, ensure_ascii=False)
        
        logger.info("Saved categorized collections")
    
    def run(self):
        """Main execution method"""
        logger.info("🥄 Starting Spoonacular Comprehensive Recipe Scraper")
        logger.info(f"📊 Daily target: {self.daily_target} API calls (staying under 400 limit)")
        logger.info(f"💰 Points available: {self.points_left}")
        
        # Setup
        self.setup_directories()
        
        # Execute efficient two-phase strategy
        self.execute_smart_fetch_strategy()
        
        # Save and deploy results
        if self.recipes:
            self.save_recipes()
            logger.info("✅ Recipe scraping and deployment completed successfully!")
            return len(self.recipes)
        else:
            logger.warning("❌ No recipes were collected")
            return 0

def main():
    """Main execution"""
    print("🥄 Spoonacular Optimized Recipe Scraper")
    print("=" * 50)
    print("API Key: f6df...be5")
    print("Daily Limit: Stay under 400 API calls")
    print("Strategy: Two-phase efficient bulk retrieval")
    
    print("\n🎯 This optimized scraper will:")
    print("  • Phase 1: Collect recipe IDs cheaply (~15 calls)")
    print("  • Phase 2: Bulk hydrate details efficiently")  
    print("  • Auto-save to processed_recipes/recipes.json")
    print("  • Auto-deploy to https://www.mireva.life/recipes.html")
    print("  • Include nutrition and difficulty ratings")
    print("  • Generate searchable collections")
    
    print("\n🚀 Starting automatic recipe fetch and deployment...")
    
    scraper = SpoonacularComprehensiveScraper()
    total_recipes = scraper.run()
    
    if total_recipes > 0:
        print(f"\n✅ Successfully scraped and deployed {total_recipes} recipes!")
        print(f"📊 Used {scraper.api_calls_made} API calls")
        print(f"💰 Points remaining: {scraper.points_left}")
        print("🌐 Recipes deployed to: https://www.mireva.life/recipes.html")
    else:
        print("\n❌ No recipes were collected. Check API limits or connectivity.")

if __name__ == "__main__":
    main()