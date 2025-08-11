#!/usr/bin/env python3
"""
Script to fetch Food.com recipes from Kaggle dataset and prepare for deployment
"""

import os
import json
import pandas as pd
import subprocess
import sys
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RecipeFetcher:
    def __init__(self, dataset_name="shuyangli94/food-com-recipes-and-user-interactions"):
        self.dataset_name = dataset_name
        self.data_dir = Path("./kaggle_data")
        self.output_dir = Path("./processed_recipes")
        
    def setup_directories(self):
        """Create necessary directories"""
        self.data_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)
        logger.info(f"Created directories: {self.data_dir}, {self.output_dir}")
    
    def check_kaggle_setup(self):
        """Check if Kaggle API is properly configured"""
        try:
            result = subprocess.run(['kaggle', '--version'], 
                                   capture_output=True, text=True, check=True)
            logger.info(f"Kaggle CLI available: {result.stdout.strip()}")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.error("Kaggle CLI not found. Please install with: pip install kaggle")
            logger.error("Also ensure ~/.kaggle/kaggle.json contains your API credentials")
            return False
    
    def download_dataset(self):
        """Download the Kaggle dataset"""
        if not self.check_kaggle_setup():
            return False
            
        try:
            logger.info(f"Downloading dataset: {self.dataset_name}")
            subprocess.run([
                'kaggle', 'datasets', 'download',
                '-d', self.dataset_name,
                '-p', str(self.data_dir),
                '--unzip'
            ], check=True)
            logger.info("Dataset downloaded successfully")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to download dataset: {e}")
            return False
    
    def process_recipes(self):
        """Process the raw recipe data into structured format"""
        try:
            # Look for the raw recipes file (with actual text, not tokens)
            recipe_file = self.data_dir / "RAW_recipes.csv"
            if not recipe_file.exists():
                logger.error(f"Recipe file not found: {recipe_file}")
                return False
            
            logger.info("Loading recipe data...")
            recipes_df = pd.read_csv(recipe_file)
            logger.info(f"Loaded {len(recipes_df)} recipes")
            
            # Process recipes into our desired format
            processed_recipes = []
            
            for idx, row in recipes_df.iterrows():
                try:
                    recipe = self.extract_recipe_data(row)
                    if recipe:
                        processed_recipes.append(recipe)
                        
                    if (idx + 1) % 10000 == 0:
                        logger.info(f"Processed {idx + 1} recipes...")
                        
                except Exception as e:
                    logger.warning(f"Error processing recipe {idx}: {e}")
                    continue
            
            logger.info(f"Successfully processed {len(processed_recipes)} recipes")
            
            # Save processed recipes
            output_file = self.output_dir / "recipes.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(processed_recipes, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved processed recipes to {output_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing recipes: {e}")
            return False
    
    def extract_recipe_data(self, row):
        """Extract and structure recipe data from a row"""
        try:
            # Extract data from RAW CSV format
            recipe = {
                'id': str(row.get('id', '')),
                'name': str(row.get('name', '')).strip(),
                'ingredients': self.parse_ingredients(row.get('ingredients', '')),
                'steps': self.parse_steps(row.get('steps', '')),
                'description': str(row.get('description', '')).strip(),
                'minutes': int(row.get('minutes', 0)) if pd.notna(row.get('minutes')) else 0,
                'n_steps': int(row.get('n_steps', 0)) if pd.notna(row.get('n_steps')) else 0,
                'n_ingredients': int(row.get('n_ingredients', 0)) if pd.notna(row.get('n_ingredients')) else 0,
                'nutrition': self.parse_nutrition(row.get('nutrition', '')),
                'tags': self.parse_tags(row.get('tags', ''))
            }
            
            # Only return recipes with essential data
            if recipe['name'] and recipe['ingredients'] and recipe['steps']:
                return recipe
            return None
            
        except Exception as e:
            logger.warning(f"Error extracting recipe data: {e}")
            return None
    
    def decode_tokens(self, tokenized_text):
        """Decode tokenized text back to readable format"""
        if pd.isna(tokenized_text) or not tokenized_text:
            return ""
        
        # Basic cleanup for tokenized text
        text = str(tokenized_text).strip()
        if text.startswith('[') and text.endswith(']'):
            try:
                # Try to parse as list of tokens
                tokens = eval(text)
                if isinstance(tokens, list):
                    return ' '.join([str(token) for token in tokens])
            except:
                pass
        
        return text
    
    def parse_ingredients(self, ingredients_text):
        """Parse ingredients from raw format"""
        if pd.isna(ingredients_text) or not ingredients_text:
            return []
        
        try:
            # Parse list format from CSV
            text = str(ingredients_text).strip()
            if text.startswith('[') and text.endswith(']'):
                ingredients = eval(text)
                if isinstance(ingredients, list):
                    return [str(ing).strip() for ing in ingredients if str(ing).strip()]
            
            # Fallback: split by common delimiters
            return [ing.strip() for ing in str(ingredients_text).split(',') if ing.strip()]
            
        except Exception as e:
            logger.warning(f"Error parsing ingredients: {e}")
            return []
    
    def parse_steps(self, steps_text):
        """Parse cooking steps from raw format"""
        if pd.isna(steps_text) or not steps_text:
            return []
        
        try:
            text = str(steps_text).strip()
            if text.startswith('[') and text.endswith(']'):
                steps = eval(text)
                if isinstance(steps, list):
                    return [str(step).strip() for step in steps if str(step).strip()]
            
            # Fallback: treat as single step
            return [str(steps_text).strip()]
            
        except Exception as e:
            logger.warning(f"Error parsing steps: {e}")
            return []
    
    def parse_nutrition(self, nutrition_text):
        """Parse nutrition information"""
        if pd.isna(nutrition_text) or not nutrition_text:
            return {}
        
        try:
            text = str(nutrition_text).strip()
            if text.startswith('[') and text.endswith(']'):
                nutrition_list = eval(text)
                if isinstance(nutrition_list, list) and len(nutrition_list) >= 7:
                    return {
                        'calories': float(nutrition_list[0]) if nutrition_list[0] else 0,
                        'total_fat': float(nutrition_list[1]) if nutrition_list[1] else 0,
                        'sugar': float(nutrition_list[2]) if nutrition_list[2] else 0,
                        'sodium': float(nutrition_list[3]) if nutrition_list[3] else 0,
                        'protein': float(nutrition_list[4]) if nutrition_list[4] else 0,
                        'saturated_fat': float(nutrition_list[5]) if nutrition_list[5] else 0,
                        'carbohydrates': float(nutrition_list[6]) if nutrition_list[6] else 0
                    }
        except:
            pass
        
        return {}
    
    def parse_tags(self, tags_text):
        """Parse recipe tags"""
        if pd.isna(tags_text) or not tags_text:
            return []
        
        try:
            text = str(tags_text).strip()
            if text.startswith('[') and text.endswith(']'):
                tags = eval(text)
                if isinstance(tags, list):
                    return [str(tag).strip().replace("'", "").replace('"', '') for tag in tags if str(tag).strip()]
            
            return [tag.strip() for tag in str(tags_text).split(',') if tag.strip()]
            
        except Exception as e:
            logger.warning(f"Error parsing tags: {e}")
            return []
    
    def generate_sample(self, sample_size=1000):
        """Generate a smaller sample for testing"""
        input_file = self.output_dir / "recipes.json"
        if not input_file.exists():
            logger.error("No processed recipes found. Run full processing first.")
            return False
        
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                all_recipes = json.load(f)
            
            # Take a random sample
            import random
            sample_recipes = random.sample(all_recipes, min(sample_size, len(all_recipes)))
            
            sample_file = self.output_dir / f"recipes_sample_{sample_size}.json"
            with open(sample_file, 'w', encoding='utf-8') as f:
                json.dump(sample_recipes, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Generated sample of {len(sample_recipes)} recipes: {sample_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error generating sample: {e}")
            return False

def main():
    """Main execution function"""
    fetcher = RecipeFetcher()
    
    print("🍳 Food.com Recipe Fetcher")
    print("=" * 40)
    
    # Setup
    fetcher.setup_directories()
    
    # Download dataset
    print("\n📥 Downloading dataset...")
    if not fetcher.download_dataset():
        print("❌ Failed to download dataset")
        sys.exit(1)
    
    # Process recipes
    print("\n🔄 Processing recipes...")
    if not fetcher.process_recipes():
        print("❌ Failed to process recipes")
        sys.exit(1)
    
    # Generate sample
    print("\n📝 Generating sample...")
    fetcher.generate_sample(1000)
    
    print("\n✅ Recipe fetching completed!")
    print(f"📁 Processed recipes saved to: {fetcher.output_dir}")
    print("\nNext steps:")
    print("1. Review the processed recipes")
    print("2. Run the deployment script to upload to EC2")

if __name__ == "__main__":
    main()