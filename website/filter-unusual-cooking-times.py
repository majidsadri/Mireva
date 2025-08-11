#!/usr/bin/env python3
"""
Filter out recipes with unusual cooking times (over 3 hours)
"""

import json
import os
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def filter_recipes():
    """Filter out recipes with cooking times over 3 hours (180 minutes)"""
    
    # File paths
    input_file = Path("./processed_recipes/recipes_with_persian.json")
    output_file = Path("./processed_recipes/recipes_filtered.json")
    metadata_file = Path("./processed_recipes/recipes_filtered_metadata.json")
    removed_file = Path("./processed_recipes/removed_recipes.json")
    
    if not input_file.exists():
        logger.error(f"Input file not found: {input_file}")
        return False
    
    logger.info(f"Loading recipes from {input_file}")
    
    # Load existing recipes
    with open(input_file, 'r', encoding='utf-8') as f:
        recipes = json.load(f)
    
    original_count = len(recipes)
    logger.info(f"Found {original_count} recipes to filter")
    
    # Filter recipes - keep only those with cooking time <= 180 minutes (3 hours)
    filtered_recipes = []
    removed_recipes = []
    
    for recipe in recipes:
        cooking_minutes = recipe.get('minutes', 0)
        
        # Convert to int if it's a string or float
        try:
            cooking_minutes = int(float(cooking_minutes)) if cooking_minutes else 0
        except (ValueError, TypeError):
            cooking_minutes = 0
        
        if cooking_minutes > 180:  # Over 3 hours
            removed_recipes.append({
                'name': recipe.get('name', 'Unknown'),
                'minutes': cooking_minutes,
                'id': recipe.get('id', ''),
                'source': recipe.get('source', ''),
                'cuisine': recipe.get('cuisine', '')
            })
            logger.info(f"Removing recipe: '{recipe.get('name')}' ({cooking_minutes} minutes)")
        else:
            filtered_recipes.append(recipe)
    
    filtered_count = len(filtered_recipes)
    removed_count = len(removed_recipes)
    
    logger.info(f"Filtered recipes: {filtered_count}")
    logger.info(f"Removed recipes: {removed_count}")
    
    # Save filtered recipes
    logger.info(f"Saving filtered recipes to {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(filtered_recipes, f, indent=2, ensure_ascii=False)
    
    # Save removed recipes for reference
    logger.info(f"Saving removed recipes to {removed_file}")
    with open(removed_file, 'w', encoding='utf-8') as f:
        json.dump(removed_recipes, f, indent=2, ensure_ascii=False)
    
    # Generate new metadata
    metadata = {
        'total_recipes': filtered_count,
        'original_count': original_count,
        'removed_count': removed_count,
        'filter_criteria': 'cooking_time <= 180 minutes (3 hours)',
        'sources': {},
        'cuisines': {},
        'categories': {}
    }
    
    # Count by source, cuisine, category
    for recipe in filtered_recipes:
        source = recipe.get('source', 'unknown')
        metadata['sources'][source] = metadata['sources'].get(source, 0) + 1
        
        cuisine = recipe.get('cuisine', 'unknown') 
        metadata['cuisines'][cuisine] = metadata['cuisines'].get(cuisine, 0) + 1
        
        category = recipe.get('category', 'unknown')
        metadata['categories'][category] = metadata['categories'].get(category, 0) + 1
    
    # Save metadata
    logger.info(f"Saving metadata to {metadata_file}")
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "="*60)
    print("🕒 RECIPE COOKING TIME FILTER RESULTS")
    print("="*60)
    print(f"Original recipes: {original_count:,}")
    print(f"Filtered recipes: {filtered_count:,}")
    print(f"Removed recipes: {removed_count:,}")
    print(f"Filter criteria: Cooking time > 180 minutes (3 hours)")
    print("\nRemoved recipes:")
    for i, recipe in enumerate(removed_recipes, 1):
        hours = recipe['minutes'] / 60
        print(f"  {i:2d}. {recipe['name']} - {recipe['minutes']} min ({hours:.1f} hours)")
    
    print(f"\nOutput files:")
    print(f"  - Filtered recipes: {output_file}")
    print(f"  - Removed recipes: {removed_file}")
    print(f"  - Metadata: {metadata_file}")
    
    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  - File size: {file_size_mb:.1f} MB")
    
    return True

def main():
    """Main execution"""
    success = filter_recipes()
    
    if success:
        print("\n✅ Recipe filtering completed successfully!")
        print("📝 Next step: Deploy the filtered collection using deploy script")
    else:
        print("\n❌ Recipe filtering failed!")

if __name__ == "__main__":
    main()