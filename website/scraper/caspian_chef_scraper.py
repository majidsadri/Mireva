#!/usr/bin/env python3
"""
The Caspian Chef Recipe Scraper
Fetches Persian recipes from thecaspianchef.com
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
from datetime import datetime
import hashlib

def get_recipe_urls():
    """Extract recipe URLs from the recipe index page"""
    print("📚 Fetching recipe URLs from The Caspian Chef...")
    
    urls = []
    base_url = "https://thecaspianchef.com/recipe-index/"
    
    try:
        response = requests.get(base_url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all recipe links - they typically contain the year pattern /20xx/
        recipe_links = soup.find_all('a', href=True)
        
        for link in recipe_links:
            href = link.get('href', '')
            # Filter for recipe URLs with year pattern
            if 'thecaspianchef.com/20' in href and href not in urls:
                urls.append(href)
        
        print(f"✅ Found {len(urls)} recipe URLs")
        return urls
        
    except Exception as e:
        print(f"❌ Error fetching recipe index: {e}")
        return []

def scrape_recipe(url):
    """Scrape a single recipe from The Caspian Chef"""
    try:
        print(f"  📖 Scraping: {url}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Get title - look for WPRM recipe name first
        recipe_name = "Unknown Recipe"
        wprm_name = soup.find('h2', class_='wprm-recipe-name')
        if wprm_name:
            recipe_name = wprm_name.text.strip()
        else:
            title = soup.find('h1', class_='entry-title')
            if not title:
                title = soup.find('h1')
            if title:
                recipe_name = title.text.strip()
        
        # Get description from meta or recipe summary
        description = ""
        wprm_summary = soup.find('div', class_='wprm-recipe-summary')
        if wprm_summary:
            description = wprm_summary.text.strip()
        if not description:
            meta_desc = soup.find('meta', {'name': 'description'})
            if meta_desc:
                description = meta_desc.get('content', '')
        if not description:
            # Try to get first paragraph after title
            content = soup.find('div', class_='entry-content')
            if content:
                first_p = content.find('p')
                if first_p:
                    description = first_p.text.strip()[:200]
        
        # Find ingredients - WPRM format
        ingredients = []
        
        # Method 1: WPRM ingredients container
        ingredients_container = soup.find('div', class_='wprm-recipe-ingredients-container')
        if not ingredients_container:
            ingredients_container = soup.find('ul', class_='wprm-recipe-ingredients')
        
        if ingredients_container:
            for li in ingredients_container.find_all('li', class_='wprm-recipe-ingredient'):
                ingredient_text = li.text.strip()
                if ingredient_text:
                    ingredients.append(ingredient_text)
        
        # Method 2: Fallback to generic search
        if not ingredients:
            for heading in soup.find_all(['h2', 'h3', 'h4']):
                if 'INGREDIENTS' in heading.text.upper():
                    next_elem = heading.find_next_sibling()
                    while next_elem and next_elem.name not in ['h2', 'h3', 'h4']:
                        if next_elem.name in ['ul', 'ol']:
                            for li in next_elem.find_all('li'):
                                ingredient_text = li.text.strip()
                                if ingredient_text:
                                    ingredients.append(ingredient_text)
                            break
                        next_elem = next_elem.find_next_sibling()
                    if ingredients:
                        break
        
        # Find instructions - WPRM format
        instructions = []
        
        # Method 1: WPRM instructions container
        instructions_container = soup.find('div', class_='wprm-recipe-instructions-container')
        if not instructions_container:
            instructions_container = soup.find('ul', class_='wprm-recipe-instructions')
        
        if instructions_container:
            for li in instructions_container.find_all('li', class_='wprm-recipe-instruction'):
                instruction_div = li.find('div', class_='wprm-recipe-instruction-text')
                if instruction_div:
                    step_text = instruction_div.text.strip()
                    if step_text:
                        instructions.append(step_text)
                else:
                    step_text = li.text.strip()
                    if step_text:
                        instructions.append(step_text)
        
        # Method 2: Fallback to generic search
        if not instructions:
            for heading in soup.find_all(['h2', 'h3', 'h4']):
                if 'INSTRUCTIONS' in heading.text.upper() or 'DIRECTIONS' in heading.text.upper():
                    next_elem = heading.find_next_sibling()
                    while next_elem and next_elem.name not in ['h2', 'h3', 'h4']:
                        if next_elem.name == 'ol':
                            for li in next_elem.find_all('li'):
                                step_text = li.text.strip()
                                if step_text:
                                    instructions.append(step_text)
                            break
                        next_elem = next_elem.find_next_sibling()
                    if instructions:
                        break
        
        # Parse cooking time
        cook_time = 60  # Default
        
        # Look for time in content
        content_text = soup.get_text()
        time_patterns = [
            r'(\d+)\s*hours?\s+(\d+)\s*minutes?',
            r'(\d+)\s*minutes?',
            r'(\d+)\s*hrs?\s+(\d+)\s*mins?',
            r'(\d+)\s*mins?'
        ]
        
        for pattern in time_patterns:
            match = re.search(pattern, content_text, re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:
                    hours = int(match.group(1))
                    minutes = int(match.group(2))
                    cook_time = hours * 60 + minutes
                else:
                    cook_time = int(match.group(1))
                break
        
        # Generate unique ID
        recipe_id = f"caspian_{hashlib.md5(recipe_name.encode()).hexdigest()[:8]}"
        
        # Determine cuisine
        cuisines = ["Persian", "Iranian", "Middle Eastern"]
        
        # Determine category
        category = "Main Course"
        name_lower = recipe_name.lower()
        if any(word in name_lower for word in ['stew', 'khoresh', 'ghormeh', 'gheymeh']):
            category = "Stew"
        elif any(word in name_lower for word in ['rice', 'polo', 'pilaf']):
            category = "Rice Dish"
        elif any(word in name_lower for word in ['soup', 'ash']):
            category = "Soup"
        elif any(word in name_lower for word in ['kebab', 'kabab', 'koobideh']):
            category = "Kebab"
        elif any(word in name_lower for word in ['dessert', 'sweet', 'halva', 'baklava']):
            category = "Dessert"
        elif any(word in name_lower for word in ['salad', 'shirazi']):
            category = "Salad"
        elif any(word in name_lower for word in ['appetizer', 'mast']):
            category = "Appetizer"
        
        # Create recipe object
        recipe = {
            "id": recipe_id,
            "name": recipe_name,
            "description": description or f"Authentic Persian recipe: {recipe_name}",
            "ingredients": ingredients,
            "steps": instructions,
            "minutes": cook_time,
            "nutrition": {
                "calories": 350,
                "protein": 25,
                "carbohydrates": 40,
                "fat": 15
            },
            "tags": ["Persian", "Traditional", "Authentic"],
            "cuisine": cuisines,
            "difficulty": "Medium",
            "primary_category": category,
            "health_score": 75,
            "source_url": url
        }
        
        return recipe
        
    except Exception as e:
        print(f"    ❌ Error scraping {url}: {e}")
        return None

def main():
    print("\n🍽️  The Caspian Chef Recipe Scraper")
    print("=" * 50)
    
    # Get all recipe URLs
    recipe_urls = get_recipe_urls()
    
    if not recipe_urls:
        print("❌ No recipe URLs found!")
        return
    
    print(f"\n📊 Found {len(recipe_urls)} recipes to scrape")
    
    # Limit to first 30 recipes for now
    recipe_urls = recipe_urls[:30]
    print(f"🔄 Scraping first {len(recipe_urls)} recipes...\n")
    
    recipes = []
    for i, url in enumerate(recipe_urls, 1):
        print(f"[{i}/{len(recipe_urls)}]", end=" ")
        recipe = scrape_recipe(url)
        if recipe and recipe['ingredients'] and recipe['steps']:
            recipes.append(recipe)
            print(f"    ✅ Success: {recipe['name']}")
        else:
            print(f"    ⚠️  Skipped (missing ingredients or instructions)")
        
        # Rate limiting
        time.sleep(0.5)
    
    # Save to file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"processed_recipes/caspian_chef_recipes_{timestamp}.json"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(recipes, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "=" * 50)
    print(f"✨ Scraping Complete!")
    print(f"📊 Successfully scraped: {len(recipes)} recipes")
    print(f"💾 Saved to: {output_file}")
    
    # Show cuisine distribution
    cuisine_count = {}
    for recipe in recipes:
        cat = recipe.get('primary_category', 'Unknown')
        cuisine_count[cat] = cuisine_count.get(cat, 0) + 1
    
    print(f"\n📈 Recipe Categories:")
    for cat, count in sorted(cuisine_count.items(), key=lambda x: x[1], reverse=True):
        print(f"   - {cat}: {count}")
    
    print(f"\n✨ Ready for deployment!")
    print(f"📌 Next step: ./deploy-add-recipes.sh {output_file}")

if __name__ == "__main__":
    main()