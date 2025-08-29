#!/usr/bin/env python3
"""
Unicorns in the Kitchen Persian Recipe Scraper
Scrapes Persian recipes from unicornsinthekitchen.com
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

class UnicornsKitchenScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.base_url = "https://www.unicornsinthekitchen.com"
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
        text = text.replace('\u00a0', ' ')
        return text.strip()
    
    def generate_recipe_id(self, title):
        """Generate unique ID for recipe"""
        unique_string = f"unicorns_{title}_{datetime.now().isoformat()}"
        return f"uk_{hashlib.md5(unique_string.encode()).hexdigest()[:8]}"
    
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
    
    def get_persian_recipe_urls(self):
        """Get Persian recipe URLs from the collection page"""
        recipe_urls = []
        collection_url = "https://www.unicornsinthekitchen.com/best-persian-recipes-to-try/"
        
        print(f"📍 Fetching recipes from collection page...")
        try:
            response = self.session.get(collection_url)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find all recipe links in the article
            # Look for links within the content that point to recipes
            content_area = soup.find('div', class_='entry-content') or soup.find('article')
            
            if content_area:
                # Find all links that look like recipe URLs
                for link in content_area.find_all('a', href=True):
                    href = link['href']
                    # Filter for unicornsinthekitchen recipe URLs
                    if 'unicornsinthekitchen.com' in href and href != collection_url:
                        # Avoid social media links, category pages, etc.
                        if not any(skip in href for skip in ['category', 'tag', '#', 'about', 'contact', 'privacy']):
                            if href not in recipe_urls:
                                recipe_urls.append(href)
                
                # Also look for recipe cards if they exist
                recipe_cards = content_area.find_all(['div', 'article'], class_=re.compile('recipe'))
                for card in recipe_cards:
                    link = card.find('a', href=True)
                    if link and link['href'] not in recipe_urls:
                        recipe_urls.append(link['href'])
            
            # Add some known Persian recipe URLs from the site
            known_persian_recipes = [
                "https://www.unicornsinthekitchen.com/persian-potato-tahdig/",
                "https://www.unicornsinthekitchen.com/persian-saffron-rice-recipe/",
                "https://www.unicornsinthekitchen.com/zereshk-polo-persian-barberry-rice/",
                "https://www.unicornsinthekitchen.com/persian-herb-rice-sabzi-polo/",
                "https://www.unicornsinthekitchen.com/adas-polo-persian-lentil-rice/",
                "https://www.unicornsinthekitchen.com/persian-jeweled-rice/",
                "https://www.unicornsinthekitchen.com/persian-dill-rice-shevid-polo/",
                "https://www.unicornsinthekitchen.com/persian-stuffed-grape-leaves-dolmeh/",
                "https://www.unicornsinthekitchen.com/persian-eggplant-stew-khoresh-bademjan/",
                "https://www.unicornsinthekitchen.com/ghormeh-sabzi-persian-herb-stew/",
                "https://www.unicornsinthekitchen.com/fesenjan-persian-pomegranate-walnut-stew/",
                "https://www.unicornsinthekitchen.com/persian-meatballs-koofteh/",
                "https://www.unicornsinthekitchen.com/joojeh-kabab-persian-chicken-kebab/",
                "https://www.unicornsinthekitchen.com/koobideh-kabab/",
                "https://www.unicornsinthekitchen.com/persian-shirazi-salad/",
                "https://www.unicornsinthekitchen.com/mast-o-khiar-persian-cucumber-yogurt/",
                "https://www.unicornsinthekitchen.com/persian-saffron-ice-cream-bastani/",
                "https://www.unicornsinthekitchen.com/persian-love-cake/",
                "https://www.unicornsinthekitchen.com/persian-halva/",
                "https://www.unicornsinthekitchen.com/persian-tea/"
            ]
            
            for url in known_persian_recipes:
                if url not in recipe_urls:
                    recipe_urls.append(url)
                    
        except Exception as e:
            print(f"Error fetching collection page: {e}")
        
        return recipe_urls
    
    def scrape_recipe(self, url):
        """Scrape a single recipe from Unicorns in the Kitchen"""
        try:
            print(f"  Scraping: {url.split('/')[-2][:40]}...")
            response = self.session.get(url)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            recipe = {
                'source': 'UnicornsInTheKitchen',
                'url': url,
                'scraped_at': datetime.now().isoformat()
            }
            
            # Extract title - try multiple methods
            title = None
            
            # Method 1: Look for recipe card title
            title_elem = soup.find('h2', class_='wprm-recipe-name')
            if not title_elem:
                title_elem = soup.find('h1', class_='entry-title')
            if not title_elem:
                title_elem = soup.find('h1')
            
            if title_elem:
                title = self.clean_text(title_elem.text)
            
            recipe['title'] = title or "Unknown Recipe"
            
            # Extract description
            description = ""
            desc_elem = soup.find('div', class_='wprm-recipe-summary')
            if desc_elem:
                description = self.clean_text(desc_elem.text)
            else:
                # Try to get from meta description
                meta_desc = soup.find('meta', {'name': 'description'})
                if meta_desc:
                    description = meta_desc.get('content', '')
            
            recipe['description'] = description[:500] if description else ""
            
            # Extract ingredients - WPRM plugin format
            ingredients = []
            
            # Method 1: WPRM recipe card
            ingredient_groups = soup.find_all('div', class_='wprm-recipe-ingredient-group')
            if ingredient_groups:
                for group in ingredient_groups:
                    # Group name (if exists)
                    group_name = group.find('h4', class_='wprm-recipe-ingredient-group-name')
                    
                    # Ingredients in this group
                    ing_items = group.find_all('li', class_='wprm-recipe-ingredient')
                    for item in ing_items:
                        # Extract amount, unit, name
                        amount = item.find('span', class_='wprm-recipe-ingredient-amount')
                        unit = item.find('span', class_='wprm-recipe-ingredient-unit')
                        name = item.find('span', class_='wprm-recipe-ingredient-name')
                        
                        # Combine into single ingredient string
                        ing_text = ""
                        if amount:
                            ing_text += amount.text.strip() + " "
                        if unit:
                            ing_text += unit.text.strip() + " "
                        if name:
                            ing_text += name.text.strip()
                        
                        if not ing_text and item.text:
                            ing_text = self.clean_text(item.text)
                        
                        if ing_text:
                            ingredients.append(ing_text)
            
            # Method 2: Try regular lists if WPRM not found
            if not ingredients:
                # Look for ingredients section
                ing_container = soup.find('div', class_='wprm-recipe-ingredients-container')
                if ing_container:
                    for li in ing_container.find_all('li'):
                        text = self.clean_text(li.text)
                        if text:
                            ingredients.append(text)
            
            # Method 3: Look for heading-based ingredients
            if not ingredients:
                headings = soup.find_all(['h2', 'h3', 'h4'], string=re.compile('ingredient', re.I))
                for heading in headings:
                    next_elem = heading.find_next_sibling()
                    while next_elem and next_elem.name in ['ul', 'ol']:
                        for li in next_elem.find_all('li'):
                            text = self.clean_text(li.text)
                            if text:
                                ingredients.append(text)
                        next_elem = next_elem.find_next_sibling()
            
            recipe['ingredients'] = ingredients
            
            # Extract instructions - WPRM format
            instructions = []
            
            # Method 1: WPRM recipe instructions
            instruction_groups = soup.find_all('div', class_='wprm-recipe-instruction-group')
            if instruction_groups:
                for group in instruction_groups:
                    inst_items = group.find_all('li', class_='wprm-recipe-instruction')
                    for item in inst_items:
                        text_elem = item.find('div', class_='wprm-recipe-instruction-text')
                        if text_elem:
                            text = self.clean_text(text_elem.text)
                        else:
                            text = self.clean_text(item.text)
                        
                        if text and len(text) > 10:
                            # Remove step numbers
                            text = re.sub(r'^\d+\.\s*', '', text)
                            instructions.append(text)
            
            # Method 2: Try regular lists if WPRM not found
            if not instructions:
                inst_container = soup.find('div', class_='wprm-recipe-instructions-container')
                if inst_container:
                    for li in inst_container.find_all('li'):
                        text = self.clean_text(li.text)
                        if text and len(text) > 10:
                            instructions.append(text)
            
            # Method 3: Look for heading-based instructions
            if not instructions:
                headings = soup.find_all(['h2', 'h3', 'h4'], string=re.compile('instruction|method|direction', re.I))
                for heading in headings:
                    next_elem = heading.find_next_sibling()
                    while next_elem and next_elem.name in ['ul', 'ol', 'p']:
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
            
            recipe['instructions'] = instructions
            
            # Extract additional metadata
            # Prep time, cook time, servings from WPRM
            prep_time = soup.find('span', class_='wprm-recipe-prep_time-minutes')
            cook_time = soup.find('span', class_='wprm-recipe-cook_time-minutes')
            total_time = soup.find('span', class_='wprm-recipe-total_time-minutes')
            servings = soup.find('span', class_='wprm-recipe-servings')
            
            # Parse time - handle both plain numbers and text with "minutes"
            if total_time:
                time_text = total_time.text.strip()
                # Extract just the number
                time_match = re.search(r'(\d+)', time_text)
                recipe['minutes'] = int(time_match.group(1)) if time_match else 60
            elif cook_time:
                time_text = cook_time.text.strip()
                time_match = re.search(r'(\d+)', time_text)
                recipe['minutes'] = int(time_match.group(1)) if time_match else 60
            else:
                # Try to find time in recipe metadata
                time_elem = soup.find('span', class_='wprm-recipe-time')
                if time_elem:
                    recipe['minutes'] = self.extract_minutes(time_elem.text)
                else:
                    recipe['minutes'] = 60  # Default
            
            if servings:
                servings_text = servings.text.strip()
                servings_match = re.search(r'(\d+)', servings_text)
                recipe['servings'] = int(servings_match.group(1)) if servings_match else 4
            else:
                recipe['servings'] = 4
            
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
            "tags": ["Persian", "Iranian", "Middle Eastern", "UnicornsInTheKitchen"],
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
            "source_name": "UnicornsInTheKitchen",
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
        if any(word in title_lower for word in ['tea', 'drink', 'smoothie']):
            formatted['primary_category'] = 'Beverage'
            formatted['meal_type'] = ["Beverage"]
        elif any(word in title_lower for word in ['soup', 'ash']):
            formatted['primary_category'] = 'Soup'
        elif any(word in title_lower for word in ['salad', 'shirazi']):
            formatted['primary_category'] = 'Salad'
        elif any(word in title_lower for word in ['dessert', 'cake', 'ice cream', 'bastani', 'halva']):
            formatted['primary_category'] = 'Dessert'
            formatted['meal_type'] = ["Dessert"]
        elif any(word in title_lower for word in ['rice', 'polo', 'tahdig', 'jeweled']):
            formatted['primary_category'] = 'Rice Dish'
        elif any(word in title_lower for word in ['stew', 'khoresh', 'fesenjan', 'ghormeh']):
            formatted['primary_category'] = 'Stew'
        elif any(word in title_lower for word in ['kabab', 'kebab', 'kabob', 'koobideh', 'joojeh']):
            formatted['primary_category'] = 'Kebab'
        elif any(word in title_lower for word in ['mast', 'yogurt', 'dip']):
            formatted['primary_category'] = 'Appetizer'
            formatted['meal_type'] = ["Appetizer"]
        elif any(word in title_lower for word in ['dolmeh', 'stuffed']):
            formatted['primary_category'] = 'Stuffed Dish'
        
        return formatted
    
    def run(self, max_recipes=50):
        """Run the scraper"""
        print("🚀 Starting Unicorns in the Kitchen Persian Recipe Scraper")
        print("=" * 50)
        
        # Get recipe URLs
        print("\n📍 Finding Persian recipe URLs...")
        recipe_urls = self.get_persian_recipe_urls()
        print(f"Found {len(recipe_urls)} potential Persian recipe URLs")
        
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
            filename = f"processed_recipes/unicorns_recipes_{timestamp}.json"
            
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
    scraper = UnicornsKitchenScraper()
    
    # Test with the sample recipe first
    print("\n🧪 Testing with sample recipe...")
    test_url = "https://www.unicornsinthekitchen.com/persian-potato-tahdig/"
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