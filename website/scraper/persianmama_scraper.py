#!/usr/bin/env python3
"""
PersianMama Recipe Scraper
Scrapes complete Persian recipes from PersianMama.com
Outputs in Mireva deployment format
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import hashlib
from datetime import datetime
import os
from urllib.parse import urljoin, urlparse

class PersianMamaScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.base_url = "https://persianmama.com"
        self.all_recipes = []
        self.delay = 1.5  # Respectful delay between requests
        
    def clean_text(self, text):
        """Clean and normalize text"""
        if not text:
            return ""
        # Remove extra whitespace and newlines
        text = re.sub(r'\s+', ' ', text)
        # Remove HTML entities
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('\xa0', ' ')
        return text.strip()
    
    def generate_recipe_id(self, title):
        """Generate unique ID for recipe"""
        unique_string = f"persianmama_{title}_{datetime.now().isoformat()}"
        return f"pm_{hashlib.md5(unique_string.encode()).hexdigest()[:8]}"
    
    def extract_minutes(self, text):
        """Extract cooking time in minutes from text"""
        if not text:
            return 60  # Default
        
        total_minutes = 0
        
        # Look for patterns like "1 hour", "30 minutes", "1.5 hours"
        hours_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:hour|hr)', text.lower())
        minutes_match = re.search(r'(\d+)\s*(?:minute|min)', text.lower())
        
        if hours_match:
            total_minutes += float(hours_match.group(1)) * 60
        if minutes_match:
            total_minutes += int(minutes_match.group(1))
        
        return int(total_minutes) if total_minutes > 0 else 60
    
    def get_recipe_urls(self):
        """Get all recipe URLs from PersianMama"""
        recipe_urls = []
        
        # Try multiple approaches to find recipes
        
        # 1. Try the recipe index page
        try:
            response = self.session.get(f"{self.base_url}/recipe-index")
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find all links that look like recipes
            for link in soup.find_all('a', href=True):
                href = link['href']
                # PersianMama recipe URLs typically have this pattern
                if self.base_url in href or href.startswith('/'):
                    full_url = urljoin(self.base_url, href)
                    # Filter for recipe-like URLs (avoid category pages, etc.)
                    if (full_url.startswith(self.base_url) and 
                        full_url != self.base_url and
                        not any(skip in full_url for skip in ['category', 'tag', 'author', 'page', '#', 'recipe-index'])):
                        if full_url not in recipe_urls:
                            recipe_urls.append(full_url)
        except Exception as e:
            print(f"Error fetching recipe index: {e}")
        
        # 2. Try common Persian recipe URLs (known recipes)
        known_recipes = [
            "aab-talebi-cantaloupe-smoothie",
            "abdoogh-khiar-cold-yogurt-soup",
            "advieh-persian-spice-mix",
            "aloo-esfenaj-persian-spinach-and-prune-stew",
            "ash-e-reshteh-persian-noodle-soup",
            "baghali-polo-lima-bean-rice",
            "bamieh-persian-doughnut",
            "barbari-bread",
            "bastani-persian-ice-cream",
            "chelo-persian-steamed-rice",
            "dolmeh-barg-stuffed-grape-leaves",
            "faloodeh-persian-frozen-dessert",
            "fesenjan-pomegranate-walnut-stew",
            "ghormeh-sabzi-persian-herb-stew",
            "halva-persian-sweet-dessert",
            "joojeh-kabab-persian-chicken-kebab",
            "kashk-e-bademjan-eggplant-dip",
            "khoresh-e-bademjan-eggplant-stew",
            "khoresh-e-gheimeh-yellow-split-pea-stew",
            "kuku-sabzi-persian-herb-frittata",
            "mast-o-khiar-yogurt-cucumber-dip",
            "mirza-ghasemi-smoked-eggplant",
            "naan-bread",
            "noon-khamei-cream-puffs",
            "persian-rice-tahdig",
            "persian-tea",
            "sabzi-khordan-fresh-herb-platter",
            "salad-olivieh-persian-chicken-salad",
            "sholeh-zard-saffron-rice-pudding",
            "tahchin-baked-saffron-rice",
            "torshi-persian-pickles",
            "zereshk-polo-barberry-rice"
        ]
        
        for recipe_slug in known_recipes:
            url = f"{self.base_url}/{recipe_slug}/"
            if url not in recipe_urls:
                recipe_urls.append(url)
        
        # 3. Try sitemap or categories
        try:
            # Try common category pages
            categories = ['appetizers', 'main-dishes', 'desserts', 'beverages', 'rice-dishes', 'stews']
            for category in categories:
                try:
                    response = self.session.get(f"{self.base_url}/category/{category}")
                    soup = BeautifulSoup(response.content, 'html.parser')
                    
                    # Look for recipe links in category pages
                    for article in soup.find_all(['article', 'div'], class_=re.compile('post|recipe|entry')):
                        link = article.find('a', href=True)
                        if link:
                            full_url = urljoin(self.base_url, link['href'])
                            if full_url not in recipe_urls and self.base_url in full_url:
                                recipe_urls.append(full_url)
                except:
                    pass
        except:
            pass
        
        return recipe_urls
    
    def scrape_recipe(self, url):
        """Scrape a single recipe from PersianMama"""
        try:
            print(f"  Scraping: {url}")
            response = self.session.get(url)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            recipe = {
                'source': 'PersianMama',
                'url': url,
                'scraped_at': datetime.now().isoformat()
            }
            
            # Extract title
            title = None
            # Try multiple selectors for title (including EasyRecipe)
            title_selectors = [
                '.ERSName',  # EasyRecipe format
                'div[itemprop="name"]',  # Schema.org format
                'h1.entry-title',
                'h1.recipe-name',
                'h1',
                'h2.recipe-title',
                '.recipe-header h1'
            ]
            
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem:
                    title = self.clean_text(title_elem.text)
                    break
            
            if not title:
                # Try to extract from page title
                page_title = soup.find('title')
                if page_title:
                    title = self.clean_text(page_title.text.split('|')[0].split('-')[0])
            
            recipe['title'] = title or "Unknown Recipe"
            
            # Extract description
            description = ""
            # Try to find recipe description
            desc_selectors = [
                '.recipe-summary',
                '.recipe-description',
                '.entry-content > p:first-of-type',
                'meta[name="description"]'
            ]
            
            for selector in desc_selectors:
                if selector.startswith('meta'):
                    desc_elem = soup.select_one(selector)
                    if desc_elem:
                        description = desc_elem.get('content', '')
                        break
                else:
                    desc_elem = soup.select_one(selector)
                    if desc_elem:
                        description = self.clean_text(desc_elem.text)
                        break
            
            recipe['description'] = description[:500] if description else ""
            
            # Extract ingredients
            ingredients = []
            
            # Method 1: Look for ingredients list (including EasyRecipe format)
            ingredient_selectors = [
                'li.ingredient',  # EasyRecipe format
                '.ERSIngredients li',  # EasyRecipe alternative
                '.recipe-ingredients li',
                '.ingredients li',
                '.wprm-recipe-ingredient',
                '.recipe-ingredient',
                'ul.ingredients li'
            ]
            
            for selector in ingredient_selectors:
                ing_elements = soup.select(selector)
                if ing_elements:
                    for ing in ing_elements:
                        text = self.clean_text(ing.text)
                        if text and len(text) > 2:
                            ingredients.append(text)
                    break
            
            # Method 2: Look for ingredients section by heading
            if not ingredients:
                headings = soup.find_all(['h2', 'h3', 'h4'], string=re.compile('ingredient', re.I))
                for heading in headings:
                    next_elem = heading.find_next_sibling()
                    while next_elem and next_elem.name in ['ul', 'ol', 'p']:
                        if next_elem.name in ['ul', 'ol']:
                            for li in next_elem.find_all('li'):
                                text = self.clean_text(li.text)
                                if text:
                                    ingredients.append(text)
                        next_elem = next_elem.find_next_sibling()
                        if next_elem and any(word in str(next_elem).lower() for word in ['instruction', 'method', 'direction']):
                            break
            
            recipe['ingredients'] = ingredients
            
            # Extract instructions
            instructions = []
            
            # Method 1: Look for instructions list (including EasyRecipe format)
            instruction_selectors = [
                'li.instruction',  # EasyRecipe format
                '.ERSInstructions li',  # EasyRecipe alternative
                '.recipe-instructions li',
                '.instructions li',
                '.wprm-recipe-instruction',
                '.recipe-instruction',
                '.directions li',
                'ol.instructions li'
            ]
            
            for selector in instruction_selectors:
                inst_elements = soup.select(selector)
                if inst_elements:
                    for inst in inst_elements:
                        text = self.clean_text(inst.text)
                        if text and len(text) > 10:
                            # Remove step numbers if present
                            text = re.sub(r'^\d+\.\s*', '', text)
                            instructions.append(text)
                    break
            
            # Method 2: Look for instructions section by heading
            if not instructions:
                headings = soup.find_all(['h2', 'h3', 'h4'], string=re.compile('instruction|method|direction', re.I))
                for heading in headings:
                    next_elem = heading.find_next_sibling()
                    while next_elem and next_elem.name in ['ul', 'ol', 'p', 'div']:
                        if next_elem.name in ['ul', 'ol']:
                            for li in next_elem.find_all('li'):
                                text = self.clean_text(li.text)
                                if text and len(text) > 10:
                                    instructions.append(text)
                        elif next_elem.name == 'p':
                            text = self.clean_text(next_elem.text)
                            if text and len(text) > 10:
                                instructions.append(text)
                        next_elem = next_elem.find_next_sibling()
                        if next_elem and any(word in str(next_elem).lower() for word in ['note', 'tip', 'variation']):
                            break
            
            recipe['instructions'] = instructions
            
            # Extract additional metadata
            # Servings
            servings_match = re.search(r'(?:serves?|yield[s]?)[:\s]+(\d+)', str(soup).lower())
            recipe['servings'] = int(servings_match.group(1)) if servings_match else 4
            
            # Cooking time
            time_elem = soup.find(string=re.compile(r'\d+\s*(?:hour|minute)', re.I))
            recipe['minutes'] = self.extract_minutes(str(time_elem)) if time_elem else 60
            
            # Only return if we have both ingredients and instructions
            if ingredients and instructions:
                return recipe
            else:
                print(f"    Skipping - missing ingredients or instructions")
                return None
                
        except Exception as e:
            print(f"    Error scraping {url}: {e}")
            return None
    
    def format_recipe_for_mireva(self, raw_recipe):
        """Format recipe to match Mireva deployment schema"""
        
        # Determine difficulty based on ingredients and steps
        n_ingredients = len(raw_recipe.get('ingredients', []))
        n_steps = len(raw_recipe.get('instructions', []))
        
        if n_ingredients <= 8 and n_steps <= 5:
            difficulty = "Easy"
        elif n_ingredients > 15 or n_steps > 10:
            difficulty = "Hard"
        else:
            difficulty = "Medium"
        
        formatted = {
            "id": self.generate_recipe_id(raw_recipe.get('title', 'Unknown')),
            "name": raw_recipe.get('title', 'Unknown Recipe'),
            "description": raw_recipe.get('description', ''),
            "ingredients": raw_recipe.get('ingredients', []),
            "steps": raw_recipe.get('instructions', []),
            "minutes": raw_recipe.get('minutes', 60),
            "n_ingredients": n_ingredients,
            "n_steps": n_steps,
            "servings": raw_recipe.get('servings', 4),
            "difficulty": difficulty,
            "cuisine": ["Persian", "Iranian", "Middle Eastern"],
            "tags": ["Persian", "Iranian", "Middle Eastern", "PersianMama"],
            "primary_category": "Main Course",
            "meal_type": ["Dinner", "Lunch"],
            
            # Nutrition placeholders
            "nutrition": {
                "calories": None,
                "protein": None,
                "carbohydrates": None,
                "fat": None,
                "fiber": None,
                "sugar": None,
                "sodium": None,
                "cholesterol": None,
                "saturated_fat": None
            },
            
            # Additional fields
            "prep_minutes": 20,
            "cook_minutes": raw_recipe.get('minutes', 60) - 20,
            "api_source": "Scraped",
            "source_name": "PersianMama",
            "source_url": raw_recipe.get('url', ''),
            "scraped_at": raw_recipe.get('scraped_at', datetime.now().isoformat()),
            "popularity": 100,
            "health_score": None,
            "price_per_serving": None,
            "image": None,
            "spoonacular_id": None,
            "spoonacular_score": None,
            "spoonacular_url": None,
            "diet": [],
            "health_category": [],
            "occasion": [],
            "cooking_method": []
        }
        
        # Categorize based on title
        title_lower = raw_recipe.get('title', '').lower()
        if any(word in title_lower for word in ['smoothie', 'drink', 'tea', 'doogh']):
            formatted['primary_category'] = 'Beverage'
            formatted['meal_type'] = ["Beverage"]
        elif any(word in title_lower for word in ['soup', 'ash']):
            formatted['primary_category'] = 'Soup'
        elif any(word in title_lower for word in ['salad']):
            formatted['primary_category'] = 'Salad'
        elif any(word in title_lower for word in ['dessert', 'halva', 'bamieh', 'sholeh', 'bastani', 'faloodeh']):
            formatted['primary_category'] = 'Dessert'
            formatted['meal_type'] = ["Dessert"]
        elif any(word in title_lower for word in ['rice', 'polo', 'tahdig', 'tahchin']):
            formatted['primary_category'] = 'Rice Dish'
        elif any(word in title_lower for word in ['stew', 'khoresh', 'fesenjan', 'ghormeh']):
            formatted['primary_category'] = 'Stew'
        elif any(word in title_lower for word in ['kabab', 'kebab', 'kabob']):
            formatted['primary_category'] = 'Kebab'
        elif any(word in title_lower for word in ['bread', 'naan', 'barbari']):
            formatted['primary_category'] = 'Bread'
        elif any(word in title_lower for word in ['dip', 'mast', 'kashk', 'borani']):
            formatted['primary_category'] = 'Appetizer'
            formatted['meal_type'] = ["Appetizer"]
        
        return formatted
    
    def run(self, max_recipes=50):
        """Run the scraper"""
        print("🚀 Starting PersianMama Recipe Scraper")
        print("=" * 50)
        
        # Get recipe URLs
        print("\n📍 Finding recipe URLs...")
        recipe_urls = self.get_recipe_urls()
        print(f"Found {len(recipe_urls)} potential recipe URLs")
        
        # Scrape recipes
        print(f"\n📥 Scraping recipes (max {max_recipes})...")
        scraped_count = 0
        
        for i, url in enumerate(recipe_urls[:max_recipes], 1):
            if scraped_count >= max_recipes:
                break
                
            recipe = self.scrape_recipe(url)
            if recipe:
                formatted = self.format_recipe_for_mireva(recipe)
                self.all_recipes.append(formatted)
                scraped_count += 1
                print(f"    ✓ Got recipe #{scraped_count}: {recipe['title'][:50]}")
            
            time.sleep(self.delay)
        
        # Save recipes
        if self.all_recipes:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"processed_recipes/persianmama_recipes_{timestamp}.json"
            
            # Ensure directory exists
            os.makedirs("processed_recipes", exist_ok=True)
            
            print(f"\n💾 Saving {len(self.all_recipes)} recipes to {filename}")
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.all_recipes, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Successfully saved {len(self.all_recipes)} recipes")
            
            # Show summary
            print("\n📊 Summary:")
            print(f"  Total recipes: {len(self.all_recipes)}")
            print(f"  With ingredients: {len([r for r in self.all_recipes if r['ingredients']])}")
            print(f"  With instructions: {len([r for r in self.all_recipes if r['steps']])}")
            
            # Show sample
            if self.all_recipes:
                sample = self.all_recipes[0]
                print(f"\n📝 Sample recipe:")
                print(f"  Name: {sample['name']}")
                print(f"  Ingredients: {sample['n_ingredients']} items")
                print(f"  Steps: {sample['n_steps']} steps")
                print(f"  Category: {sample['primary_category']}")
            
            print(f"\n✨ Ready for deployment!")
            print(f"📌 Next step: ./deploy-add-recipes.sh {filename}")
            
            return filename
        else:
            print("\n❌ No recipes scraped")
            return None

def main():
    scraper = PersianMamaScraper()
    
    # Test with the sample recipe first
    print("\n🧪 Testing with sample recipe...")
    test_url = "https://persianmama.com/aab-talebi-cantaloupe-smoothie/"
    test_recipe = scraper.scrape_recipe(test_url)
    
    if test_recipe:
        print(f"✅ Test successful!")
        print(f"  Title: {test_recipe['title']}")
        print(f"  Ingredients: {len(test_recipe['ingredients'])} items")
        print(f"  Instructions: {len(test_recipe['instructions'])} steps")
        
        # Run full scraping
        print("\n" + "=" * 50)
        scraper.run(max_recipes=30)
    else:
        print("❌ Test failed - please check the scraper")

if __name__ == "__main__":
    main()