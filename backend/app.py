from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import base64
import os
import json
import logging
import openai
import uuid
import pytesseract
from PIL import Image, ImageOps, ImageFilter
import cv2
import numpy as np
from datetime import datetime, timezone, timedelta
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import requests
import ast
from math import radians, sin, cos, sqrt, atan2

try:
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY") or "dummy-key-for-local-testing")
except Exception as e:
    print(f"OpenAI client initialization failed: {e}")
    client = None

# OpenAI client initialized above using environment variable

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.INFO)

# File paths - use local paths for development, server paths for production
import os
if os.path.exists('/mnt/data/MirevaApp/'):
    # Production paths
    DB_FILE_PATH = '/mnt/data/MirevaApp/db.json'
    PROFILE_FILE_PATH = '/mnt/data/MirevaApp/profile.json'
    USERS_FILE = '/mnt/data/MirevaApp/users.json'
    STORES_FILE = '/mnt/data/MirevaApp/stores.json'
    SHOPPING_LIST_FILE = '/mnt/data/MirevaApp/shopping_list.json'
else:
    # Development paths
    DB_FILE_PATH = './db.json'
    PROFILE_FILE_PATH = './profile.json'
    USERS_FILE = './users.json'
    STORES_FILE = './stores.json'
    SHOPPING_LIST_FILE = './shopping_list.json'

logging.info(f"Current working directory: {os.getcwd()}")
logging.info(f"DB_FILE_PATH: {DB_FILE_PATH}")
logging.info(f"PROFILE_FILE_PATH: {PROFILE_FILE_PATH}")

def get_smart_expiry_date(item_name, purchase_date=None):
    """
    Calculate smart expiry date based on food category and type.
    Returns the number of days the item should last from purchase date.
    """
    if not purchase_date:
        purchase_date = datetime.now()
    elif isinstance(purchase_date, str):
        purchase_date = datetime.fromisoformat(purchase_date.replace('Z', '+00:00'))
    
    item_lower = item_name.lower().strip()
    category = getCategoryForScannedItem(item_name)
    
    # FRUITS & VEGETABLES - Fresh produce shelf life
    if category == 'Fruits & Vegetables':
        # Very short shelf life (2-4 days)
        very_short = ['lettuce', 'spinach', 'arugula', 'watercress', 'herbs', 'basil', 
                     'cilantro', 'parsley', 'mint', 'strawberry', 'raspberry', 'blackberry',
                     'cherry', 'grape', 'banana', 'avocado', 'mushroom']
        
        # Short shelf life (5-7 days)  
        short = ['broccoli', 'cauliflower', 'asparagus', 'green beans', 'peas',
                'tomato', 'cucumber', 'zucchini', 'bell pepper', 'eggplant',
                'peach', 'plum', 'apricot', 'kiwi', 'mango', 'pineapple']
        
        # Medium shelf life (7-14 days)
        medium = ['carrot', 'celery', 'cabbage', 'kale', 'brussels sprouts',
                 'apple', 'orange', 'lemon', 'lime', 'grapefruit', 'pear']
        
        # Long shelf life (14-30 days)
        long = ['potato', 'sweet potato', 'onion', 'garlic', 'ginger',
               'squash', 'pumpkin', 'beet', 'turnip', 'radish']
        
        for item in very_short:
            if item in item_lower:
                return purchase_date + timedelta(days=3)
        for item in short:
            if item in item_lower:
                return purchase_date + timedelta(days=6)
        for item in medium:
            if item in item_lower:
                return purchase_date + timedelta(days=10)
        for item in long:
            if item in item_lower:
                return purchase_date + timedelta(days=21)
        
        # Default for fruits & vegetables
        return purchase_date + timedelta(days=7)
    
    # PROTEINS - Meat, seafood, eggs
    elif category == 'Proteins':
        # Very short (1-2 days) - Fresh seafood
        if any(x in item_lower for x in ['fish', 'salmon', 'tuna', 'shrimp', 'lobster', 'crab', 'scallops', 'oysters', 'mussels']):
            return purchase_date + timedelta(days=2)
        
        # Short (2-4 days) - Fresh meat
        if any(x in item_lower for x in ['ground beef', 'ground turkey', 'chicken breast', 'pork chops']):
            return purchase_date + timedelta(days=3)
        
        # Medium (4-7 days) - Whole cuts, processed meats
        if any(x in item_lower for x in ['steak', 'roast', 'whole chicken', 'bacon', 'ham', 'sausage']):
            return purchase_date + timedelta(days=5)
        
        # Long (7-14 days) - Eggs, cured meats
        if any(x in item_lower for x in ['eggs', 'egg', 'salami', 'pepperoni', 'prosciutto']):
            return purchase_date + timedelta(days=10)
        
        # Very long (30+ days) - Dry legumes, nuts
        if any(x in item_lower for x in ['beans', 'lentils', 'chickpeas', 'nuts', 'almonds', 'cashews']):
            return purchase_date + timedelta(days=180)
        
        # Default for proteins
        return purchase_date + timedelta(days=4)
    
    # DAIRY - Milk products
    elif category == 'Dairy':
        # Short (3-5 days) - Fresh milk, cream
        if any(x in item_lower for x in ['milk', 'cream', 'heavy cream', 'half and half']):
            return purchase_date + timedelta(days=4)
        
        # Medium (5-14 days) - Yogurt, soft cheese
        if any(x in item_lower for x in ['yogurt', 'cottage cheese', 'ricotta', 'mozzarella', 'cream cheese']):
            return purchase_date + timedelta(days=10)
        
        # Long (14-30 days) - Hard cheese, butter
        if any(x in item_lower for x in ['cheddar', 'swiss', 'parmesan', 'gouda', 'butter', 'margarine']):
            return purchase_date + timedelta(days=21)
        
        # Very long (30+ days) - Processed cheese
        if any(x in item_lower for x in ['american cheese', 'cheese singles', 'processed']):
            return purchase_date + timedelta(days=35)
        
        # Default for dairy
        return purchase_date + timedelta(days=7)
    
    # GRAINS & PANTRY - Shelf-stable items
    elif category == 'Grains & Pantry':
        # No expiry - Wine, spirits, vinegar, honey
        if any(x in item_lower for x in ['wine', 'beer', 'whiskey', 'vodka', 'rum', 'gin', 
                                       'vinegar', 'honey', 'maple syrup', 'vanilla extract']):
            return None  # No expiry
        
        # Very short (1-3 days) - Fresh bread
        if any(x in item_lower for x in ['fresh bread', 'bakery bread', 'baguette']):
            return purchase_date + timedelta(days=3)
        
        # Short (5-7 days) - Packaged bread, fresh pasta
        if any(x in item_lower for x in ['bread', 'bagel', 'muffin', 'tortilla', 'fresh pasta']):
            return purchase_date + timedelta(days=7)
        
        # Medium (30-90 days) - Oils, condiments, sauces
        if any(x in item_lower for x in ['oil', 'olive oil', 'ketchup', 'mustard', 'mayo', 
                                       'sauce', 'salsa', 'jam', 'jelly']):
            return purchase_date + timedelta(days=60)
        
        # Long (6 months - 2 years) - Dry goods, canned items
        if any(x in item_lower for x in ['rice', 'pasta', 'flour', 'sugar', 'salt', 
                                       'beans', 'cereal', 'oats', 'quinoa', 'canned']):
            return purchase_date + timedelta(days=365)
        
        # Very long (2+ years) - Spices, dried herbs
        if any(x in item_lower for x in ['spice', 'pepper', 'cinnamon', 'paprika', 'oregano',
                                       'basil', 'thyme', 'dried']):
            return purchase_date + timedelta(days=730)
        
        # Default for pantry items
        return purchase_date + timedelta(days=90)
    
    # Default fallback
    return purchase_date + timedelta(days=30)

def is_item_expired(expiry_date_str):
    """
    Helper function to safely check if an item is expired.
    Handles both timezone-aware and timezone-naive datetime strings.
    """
    try:
        if not expiry_date_str:
            return False
        
        # Parse the expiry date
        expiry_date = datetime.fromisoformat(expiry_date_str.replace('Z', '+00:00'))
        
        # Get current datetime - make it timezone-aware if expiry_date is timezone-aware
        current_time = datetime.now()
        if expiry_date.tzinfo is not None:
            current_time = datetime.now(timezone.utc)
        
        return expiry_date < current_time
    except Exception as e:
        logging.warning(f"Error parsing expiry date '{expiry_date_str}': {e}")
        return False

def init_db():
    try:
        # Create db.json if it doesn't exist
        if not os.path.exists(DB_FILE_PATH):
            logging.info(f"Creating new db.json at {DB_FILE_PATH}")
            with open(DB_FILE_PATH, 'w') as f:
                # Initialize with multi-pantry structure
                json.dump({"pantry": {"default": []}}, f, indent=2)

        # Create profile.json if it doesn't exist
        if not os.path.exists(PROFILE_FILE_PATH):
            logging.info(f"Creating new profile.json at {PROFILE_FILE_PATH}")
            with open(PROFILE_FILE_PATH, 'w') as f:
                json.dump({"name": "", "diets": [], "cuisines": []}, f, indent=2)

        # Create users.json if it doesn't exist
        if not os.path.exists(USERS_FILE):
            logging.info(f"Creating new users.json at {USERS_FILE}")
            with open(USERS_FILE, 'w') as f:
                json.dump({}, f, indent=2)

        # Migrate shopping lists from user-based to pantry-based storage
        migrate_shopping_lists()

        # Read and log contents of db.json
        with open(DB_FILE_PATH, 'r') as f:
            db_data = json.load(f)
            logging.info(f"Current db.json contents: {json.dumps(db_data, indent=2)}")

        return True
    except Exception as e:
        logging.error(f"Error initializing database: {e}")
        logging.error("Exception traceback:", exc_info=True)
        return False

def migrate_shopping_lists():
    """Migrate shopping lists from user-based storage to pantry-based storage"""
    try:
        shopping_lists_file = '/mnt/data/MirevaApp/shopping_lists.json'
        
        # Skip if shopping_lists.json already exists (migration already done)
        if os.path.exists(shopping_lists_file):
            return
            
        logging.info("Migrating shopping lists from user-based to pantry-based storage...")
        
        # Load users data
        if not os.path.exists(USERS_FILE):
            return
            
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        # Initialize shopping lists structure
        shopping_lists = {}
        
        # Migrate each user's shopping list to their pantry
        for user_email, user_data in users.items():
            if 'shoppingList' in user_data and user_data['shoppingList']:
                pantry_name = user_data.get('pantryName', 'default')
                if not pantry_name:
                    pantry_name = 'default'
                
                # If this pantry doesn't have a shopping list yet, use this user's list
                if pantry_name not in shopping_lists:
                    shopping_lists[pantry_name] = user_data['shoppingList']
                    logging.info(f"Migrated shopping list for pantry '{pantry_name}' from user {user_email}")
                else:
                    # Merge shopping lists if multiple users have items for the same pantry
                    existing_items = {item['id']: item for item in shopping_lists[pantry_name]}
                    for item in user_data['shoppingList']:
                        if item['id'] not in existing_items:
                            shopping_lists[pantry_name].append(item)
                    logging.info(f"Merged shopping list items for pantry '{pantry_name}' from user {user_email}")
        
        # Save the migrated shopping lists
        with open(shopping_lists_file, 'w') as f:
            json.dump(shopping_lists, f, indent=2)
        
        # Clean up: remove shopping lists from users.json
        users_updated = False
        for user_email, user_data in users.items():
            if 'shoppingList' in user_data:
                del user_data['shoppingList']
                users_updated = True
        
        if users_updated:
            with open(USERS_FILE, 'w') as f:
                json.dump(users, f, indent=2)
            logging.info("Removed shopping lists from users.json after migration")
        
        logging.info("Shopping list migration completed successfully")
        
    except Exception as e:
        logging.error(f"Error migrating shopping lists: {e}")
        # Don't raise the error to avoid breaking the app initialization

# Initialize database when app starts
if init_db():
    logging.info("Database initialized successfully")
else:
    logging.error("Failed to initialize database")

#UPLOAD_FOLDER = 'uploads'  # Define the folder where receipts will be stored
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Ensure the folder exists

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Load OpenAI API key from environment variables
if not openai.api_key:
    logging.error("OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.")
else:
    logging.info("OpenAI API key loaded successfully.")

logging.info(f"PROFILE_FILE_PATH: {PROFILE_FILE_PATH}")

# Enable logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Function to save profile data to the JSON file
def save_profile_data(profile_name, profile_data):
    try:
        logging.info(f"Saving profile data for {profile_name}: {profile_data}")
        if os.path.exists(PROFILE_FILE_PATH):
            with open(PROFILE_FILE_PATH, 'r') as file:
                data = json.load(file)
        else:
            data = {}

        # Update or add the profile data
        data[profile_name] = profile_data

        with open(PROFILE_FILE_PATH, 'w') as file:
            json.dump(data, file, indent=4)
        return True
    except Exception as e:
        logging.error(f"Error saving profile data: {e}")
        return False

# Function to load profile data from the JSON file
def load_profile_data(profile_name=None):
    try:
        if os.path.exists(PROFILE_FILE_PATH):
            with open(PROFILE_FILE_PATH, 'r') as file:
                all_profiles = json.load(file)
            if profile_name:
                return all_profiles.get(profile_name, {})
            return all_profiles
        else:
            return {}
    except Exception as e:
        logging.error(f"Error loading profile data: {e}")
        return {}

@app.route('/load_profile/<profile_name>', methods=['GET'])
def load_profile(profile_name):
    try:
        if os.path.exists(PROFILE_FILE_PATH):
            with open(PROFILE_FILE_PATH, 'r') as file:
                all_profiles = json.load(file)
                profile_data = all_profiles.get(profile_name)

                if not profile_data:
                    return jsonify({"error": f"Profile '{profile_name}' not found."}), 404

                return jsonify(profile_data), 200
        else:
            return jsonify({"error": "No profiles found."}), 404
    except Exception as e:
        logging.error(f"Error loading profile '{profile_name}': {e}")
        return jsonify({"error": "Failed to load profile."}), 500

@app.route('/get_profiles', methods=['GET'])
def get_profiles():
    try:
        if os.path.exists(PROFILE_FILE_PATH):
            with open(PROFILE_FILE_PATH, 'r') as file:
                all_profiles = json.load(file)
                profile_names = list(all_profiles.keys())
        else:
            profile_names = []

        return jsonify(profile_names), 200
    except Exception as e:
        logging.error(f"Error fetching profile names: {e}")
        return jsonify({"error": "Failed to fetch profile names."}), 500

# Endpoint to save the profile information
@app.route('/save_profile', methods=['POST'])
def save_profile():
    try:
        profile_data = request.json
        profile_name = profile_data.get("name")

        if not profile_name:
            return jsonify({"error": "Profile name is required."}), 400

        # Load existing profiles from profile_data.json
        if os.path.exists(PROFILE_FILE_PATH):
            with open(PROFILE_FILE_PATH, 'r') as file:
                all_profiles = json.load(file)
        else:
            all_profiles = {}

        # Update or add the profile
        all_profiles[profile_name] = profile_data

        # Save back to profile_data.json
        with open(PROFILE_FILE_PATH, 'w') as file:
            json.dump(all_profiles, file, indent=4)

        logging.info(f"Profile '{profile_name}' saved successfully.")
        return jsonify({"message": f"Profile '{profile_name}' saved successfully."}), 200
    except Exception as e:
        logging.error(f"Error saving profile: {e}")
        return jsonify({"error": "Failed to save profile."}), 500

@app.route('/set_active_profile', methods=['POST'])
def set_active_profile():
    try:
        data = request.json
        active_profile = data.get('activeProfile')

        if not active_profile:
            return jsonify({"error": "Active profile name is required"}), 400

        # Save the active profile name in a separate file or database
        with open("active_profile.json", "w") as file:
            json.dump({"activeProfile": active_profile}, file)

        return jsonify({"message": f"Active profile set to '{active_profile}'"}), 200
    except Exception as e:
        logging.error(f"Error setting active profile: {e}")
        return jsonify({"error": "Failed to set active profile"}), 500

@app.route('/get_tip', methods=['GET'])
def get_tip():
    try:
        # Call OpenAI's GPT-3.5 to get a cooking tip
        client = openai.OpenAI()
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides cooking tips."},
                {"role": "user", "content": "Please provide a short and practical cooking tip."}
            ]
        )

        # Extract the tip from the API response
        tip = response.choices[0].message.content.strip()

        # Log the tip for debugging
        logging.info(f"Generated cooking tip: {tip}")

        return jsonify({"tip": tip}), 200

    except Exception as e:
        logging.error(f"Error generating cooking tip: {e}")
        return jsonify({"tip": "Error generating a cooking tip."}), 500

def get_pantry():
    try:
        # Get user's email from header
        user_email = request.headers.get('X-User-Email')
        pantry_name = 'default'
        
        # If user email is provided, get their pantryName from users.json
        if user_email:
            try:
                with open(USERS_FILE, 'r') as f:
                    users = json.load(f)
                    if user_email in users:
                        user_pantry_name = users[user_email].get('pantryName', '')
                        if user_pantry_name:
                            pantry_name = user_pantry_name
                            logging.info(f"Using user's pantry '{pantry_name}' for email {user_email}")
                        else:
                            logging.info(f"User {user_email} has no pantryName set, will check available pantries")
                    else:
                        logging.info(f"User {user_email} not found in users.json, will check available pantries")
            except Exception as e:
                logging.error(f"Error reading user pantry info: {e}")
        
        with open(DB_FILE_PATH, 'r') as f:
            data = json.load(f)
            pantry_data = data.get('pantry', [])
            
            # Check if pantry is in new multi-pantry format (dict) or old flat format (list)
            if isinstance(pantry_data, dict):
                # Multi-pantry format
                if pantry_name in pantry_data:
                    pantry_items = pantry_data[pantry_name]
                    logging.info(f"Found pantry '{pantry_name}' with {len(pantry_items)} items")
                else:
                    # Create new pantry if it doesn't exist
                    pantry_items = []
                    pantry_data[pantry_name] = pantry_items
                    
                    # Save the updated data back to db.json
                    data['pantry'] = pantry_data
                    with open(DB_FILE_PATH, 'w') as write_f:
                        json.dump(data, write_f, indent=2)
                    
                    logging.info(f"Created new pantry '{pantry_name}' in db.json")
            else:
                # Legacy flat format - return all items if requesting default, else empty
                if pantry_name == 'default':
                    pantry_items = pantry_data
                else:
                    pantry_items = []
                    
            logging.info(f"Read {len(pantry_items)} items from pantry '{pantry_name}'")
            logging.info(f"Pantry items: {pantry_items}")
            
            # Log user activity
            log_user_activity(
                user_email=user_email,
                activity_type="pantry_view",
                activity_data={
                    "pantry_name": pantry_name,
                    "items_count": len(pantry_items),
                    "item_names": [item.get('name', 'Unknown') for item in pantry_items],
                    "expired_items": [item.get('name', 'Unknown') for item in pantry_items 
                                    if item.get('expiryDate') and 
                                    is_item_expired(item.get('expiryDate'))]
                },
                pantry_name=pantry_name
            )
            
            return jsonify(pantry_items)
    except FileNotFoundError:
        logging.error(f"db.json not found at {DB_FILE_PATH}")
        return jsonify([])
    except json.JSONDecodeError as e:
        logging.error(f"Error decoding db.json: {e}")
        return jsonify({"error": "Invalid database format"}), 500
    except Exception as e:
        logging.error(f"Error reading pantry: {e}")
        logging.error("Exception traceback:", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/pantry', methods=['GET', 'POST'])
def handle_pantry():
    logging.info(f"Received {request.method} request to /pantry endpoint")
    logging.info(f"Request headers: {dict(request.headers)}")

    if request.method == 'GET':
        return get_pantry()
    elif request.method == 'POST':
        try:
            # Add a new item to the pantry
            new_item = request.json
            # FIXED: Use user email to get pantry name
            # Get user's email from header
            user_email = request.headers.get('X-User-Email')
            pantry_name = 'default'
            
            # If user email is provided, get their pantryName from users.json
            if user_email:
                try:
                    with open(USERS_FILE, 'r') as f:
                        users = json.load(f)
                        if user_email in users:
                            user_pantry_name = users[user_email].get('pantryName', '')
                            if user_pantry_name:
                                pantry_name = user_pantry_name
                                logging.info(f"Using user's pantry '{pantry_name}' for adding item for email {user_email}")
                except Exception as e:
                    logging.error(f"Error reading user pantry info: {e}")
            
            logging.info(f"Adding new pantry item to '{pantry_name}': {new_item}")
            
            # Add category if not provided (using same system as scanned items)
            if 'category' not in new_item:
                new_item['category'] = getCategoryForScannedItem(new_item.get('name', ''))
                
            # Always apply smart expiry logic to override frontend defaults
            purchase_date = new_item.get('purchaseDate')
            if purchase_date:
                # Parse purchase date if it's a string
                if isinstance(purchase_date, str):
                    purchase_date = datetime.fromisoformat(purchase_date.replace('Z', '+00:00'))
            else:
                purchase_date = datetime.now()
            
            smart_expiry = get_smart_expiry_date(new_item.get('name', ''), purchase_date)
            new_item['expiryDate'] = smart_expiry.isoformat() if smart_expiry else None

            with open(DB_FILE_PATH, 'r+') as file:
                data = json.load(file)
                pantry_data = data.get('pantry', [])
                
                # Handle both old flat format and new multi-pantry format
                if isinstance(pantry_data, dict):
                    # Multi-pantry format
                    if pantry_name not in pantry_data:
                        pantry_data[pantry_name] = []
                    pantry_data[pantry_name].append(new_item)
                else:
                    # Legacy flat format - convert to multi-pantry format
                    if pantry_name == 'default':
                        # Add to existing flat structure
                        pantry_data.append(new_item)
                    else:
                        # Convert to multi-pantry format
                        new_pantry_data = {
                            'default': pantry_data,  # Keep existing items in default pantry
                            pantry_name: [new_item]  # Add new item to specified pantry
                        }
                        data['pantry'] = new_pantry_data
                        pantry_data = new_pantry_data

                # Clear the file content and write the updated data
                file.seek(0)
                file.truncate()
                json.dump(data, file, indent=2)

                logging.info(f"Updated pantry data: {json.dumps(pantry_data, indent=2)}")
                
                # Log user activity
                log_user_activity(
                    user_email=user_email,
                    activity_type="pantry_add_item",
                    activity_data={
                        "pantry_name": pantry_name,
                        "item_name": new_item.get('name', 'Unknown Item'),
                        "item_added": new_item,
                        "method": "manual_entry"
                    },
                    pantry_name=pantry_name
                )
                
            return jsonify({"message": "Item added successfully"}), 201
        except Exception as e:
            logging.error(f"Error adding item to pantry: {e}")
            logging.error("Exception traceback:", exc_info=True)
            return jsonify({"error": str(e)}), 500

@app.route('/pantry/<item_id>', methods=['DELETE'])
def delete_pantry_item(item_id):
    try:
        # Get user's email from header
        user_email = request.headers.get('X-User-Email')
        # FIXED: Use user email to get pantry name
        # Get user's email from header
        user_email = request.headers.get('X-User-Email')
        pantry_name = 'default'
        
        # If user email is provided, get their pantryName from users.json
        if user_email:
            try:
                with open(USERS_FILE, 'r') as f:
                    users = json.load(f)
                    if user_email in users:
                        user_pantry_name = users[user_email].get('pantryName', '')
                        if user_pantry_name:
                            pantry_name = user_pantry_name
                            logging.info(f"Using user's pantry '{pantry_name}' for adding item for email {user_email}")
            except Exception as e:
                logging.error(f"Error reading user pantry info: {e}")
        
        # If user email is provided, get their pantryName from users.json
        if user_email:
            try:
                with open(USERS_FILE, 'r') as f:
                    users = json.load(f)
                    if user_email in users:
                        user_pantry_name = users[user_email].get('pantryName', '')
                        if user_pantry_name:
                            pantry_name = user_pantry_name
                            logging.info(f"Using user's pantry '{pantry_name}' for delete operation for email {user_email}")
                        else:
                            logging.info(f"User {user_email} has no pantryName set, using default for delete")
                    else:
                        logging.info(f"User {user_email} not found in users.json for delete")
            except Exception as e:
                logging.error(f"Error reading user pantry info for delete: {e}")
        
        # Load the current pantry data
        with open(DB_FILE_PATH, 'r') as file:
            data = json.load(file)

        pantry_data = data.get('pantry', [])
        item_found = False
        deleted_item = None
        
        # Handle both old flat format and new multi-pantry format
        if isinstance(pantry_data, dict):
            # Multi-pantry format
            if pantry_name in pantry_data:
                # Find the item to be deleted for logging
                for item in pantry_data[pantry_name]:
                    if item.get('id') == item_id:
                        deleted_item = item
                        break
                
                original_count = len(pantry_data[pantry_name])
                pantry_data[pantry_name] = [item for item in pantry_data[pantry_name] if item.get('id') != item_id]
                item_found = len(pantry_data[pantry_name]) < original_count
            else:
                # Search all pantries if specific pantry not found
                for pname, pitems in pantry_data.items():
                    # Find the item to be deleted for logging
                    for item in pitems:
                        if item.get('id') == item_id:
                            deleted_item = item
                            pantry_name = pname  # Update pantry_name to actual location
                            break
                    
                    original_count = len(pitems)
                    pantry_data[pname] = [item for item in pitems if item.get('id') != item_id]
                    if len(pantry_data[pname]) < original_count:
                        item_found = True
                        break
        else:
            # Legacy flat format
            # Find the item to be deleted for logging
            for item in pantry_data:
                if item.get('id') == item_id:
                    deleted_item = item
                    break
            
            original_count = len(pantry_data)
            updated_pantry = [item for item in pantry_data if item.get('id') != item_id]
            item_found = len(updated_pantry) < original_count
            data['pantry'] = updated_pantry

        # Save the updated pantry data back to db.json
        with open(DB_FILE_PATH, 'w') as file:
            json.dump(data, file, indent=4)

        if item_found:
            # Log user activity
            log_user_activity(
                user_email=user_email,
                activity_type="pantry_remove_item",
                activity_data={
                    "pantry_name": pantry_name,
                    "item_deleted": deleted_item,
                    "item_id": item_id
                },
                pantry_name=pantry_name
            )
            return jsonify({"message": "Item deleted successfully"}), 200
        else:
            return jsonify({"error": "Item not found"}), 404
            
    except Exception as e:
        logging.error(f"Error deleting item: {e}")
        return jsonify({"error": "Failed to delete item"}), 500

# New endpoints for managing multiple pantries
@app.route('/pantries', methods=['GET'])
def list_pantries():
    """List all available pantries"""
    try:
        with open(DB_FILE_PATH, 'r') as f:
            data = json.load(f)
            pantry_data = data.get('pantry', [])
            
            if isinstance(pantry_data, dict):
                # Multi-pantry format - return pantry names with item counts
                pantries = []
                for name, items in pantry_data.items():
                    pantries.append({
                        'name': name,
                        'itemCount': len(items)
                    })
                return jsonify({'pantries': pantries})
            else:
                # Legacy flat format - return default pantry
                return jsonify({'pantries': [{
                    'name': 'default',
                    'itemCount': len(pantry_data)
                }]})
                
    except Exception as e:
        logging.error(f"Error listing pantries: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/pantries/<pantry_name>', methods=['POST', 'DELETE'])
def manage_pantry(pantry_name):
    """Create or delete a specific pantry"""
    try:
        with open(DB_FILE_PATH, 'r+') as file:
            data = json.load(file)
            pantry_data = data.get('pantry', [])
            
            if request.method == 'POST':
                # Create new pantry
                if isinstance(pantry_data, list):
                    # Convert flat format to multi-pantry format
                    new_pantry_data = {
                        'default': pantry_data,
                        pantry_name: []
                    }
                    data['pantry'] = new_pantry_data
                else:
                    # Multi-pantry format
                    if pantry_name not in pantry_data:
                        pantry_data[pantry_name] = []
                    else:
                        return jsonify({"error": "Pantry already exists"}), 400
                
                file.seek(0)
                file.truncate()
                json.dump(data, file, indent=2)
                
                return jsonify({"message": f"Pantry '{pantry_name}' created successfully"}), 201
                
            elif request.method == 'DELETE':
                # Delete pantry
                if isinstance(pantry_data, dict):
                    if pantry_name in pantry_data:
                        if pantry_name == 'default':
                            return jsonify({"error": "Cannot delete default pantry"}), 400
                        del pantry_data[pantry_name]
                        
                        file.seek(0)
                        file.truncate()
                        json.dump(data, file, indent=2)
                        
                        return jsonify({"message": f"Pantry '{pantry_name}' deleted successfully"}), 200
                    else:
                        return jsonify({"error": "Pantry not found"}), 404
                else:
                    return jsonify({"error": "Cannot delete pantry in legacy format"}), 400
                    
    except Exception as e:
        logging.error(f"Error managing pantry '{pantry_name}': {e}")
        return jsonify({"error": str(e)}), 500

# Function to preprocess and extract text from an image
def preprocess_and_extract_text(image_path):
    try:
        # Load the image and convert to grayscale
        image = Image.open(image_path).convert("L")

        # Perform OCR to extract raw text
        ocr_text = pytesseract.image_to_string(image)
        return ocr_text
    except Exception as e:
        logging.error(f"Error during OCR: {e}")
        return ""

# Function to analyze text with ChatGPT to identify grocery items
def analyze_text_with_chatgpt(text):
    # Prompt to extract only grocery items
    prompt = (
        "From the following receipt text, extract only grocery food items. "
        "Remove prices, quantities, totals, or non-food items like 'toilet paper' or 'baby wipes'. "
        "Output only the food-related grocery items as a JSON array, such as: [\"item1\", \"item2\", \"item3\"]. "
        "Only include items directly related to food or cooking ingredients.\n\n"
        f"Receipt Text:\n{text}\n\n"
    )
    try:
        # Log the prompt being sent to ChatGPT
        logging.info(f"Sending prompt to ChatGPT:\n{prompt}")

        client = openai.OpenAI()
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts grocery food items from receipts."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0
        )

        # Log the raw response from ChatGPT
        raw_response = response.choices[0].message.content

        # Parse the response content as JSON
        items = json.loads(raw_response)
        logging.info(f"Extracted Grocery Items:\n{items}")

        return items
    except json.JSONDecodeError as e:
        logging.error(f"Error parsing ChatGPT response: {e}")
        return []
    except Exception as e:
        logging.error(f"Error during ChatGPT analysis: {e}")
        return []

@app.route('/process-receipt', methods=['POST'])
def process_receipt():
    try:
        logging.info("Received POST request at /process-receipt")

        # Validate uploaded file
        if 'receipt' not in request.files:
            logging.error("No file uploaded in request")
            return jsonify({"error": "No file uploaded"}), 400

        receipt_file = request.files['receipt']
        filename = secure_filename(receipt_file.filename)

        if not filename.lower().endswith(('png', 'jpg', 'jpeg')):
            logging.error("Invalid file type")
            return jsonify({"error": "Invalid file type. Please upload a PNG or JPG image."}), 400

        logging.info(f"Uploaded file: {filename}")

        # Save the file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        receipt_file.save(file_path)
        logging.info(f"File saved at: {file_path}")

        # Preprocess the image and perform OCR
        ocr_text = preprocess_and_extract_text(file_path)

        if not ocr_text.strip():
            logging.warning("OCR returned no text")
            return jsonify({"error": "No text found in the uploaded image."}), 400

        # Analyze OCR text with ChatGPT
        extracted_items = analyze_text_with_chatgpt(ocr_text)

        # Ensure extracted_items is a list
        if not isinstance(extracted_items, list):
            logging.error(f"Unexpected ChatGPT response format: {extracted_items}")
            return jsonify({"error": "Failed to process receipt items."}), 500

        logging.info(f"Extracted Grocery Items: {extracted_items}")

        # Add extracted items to the pantry
        try:
            # FIXED: Use user email to get pantry name
            # Get user's email from header
            user_email = request.headers.get('X-User-Email')
            pantry_name = 'default'
            
            # If user email is provided, get their pantryName from users.json
            if user_email:
                try:
                    with open(USERS_FILE, 'r') as f:
                        users = json.load(f)
                        if user_email in users:
                            user_pantry_name = users[user_email].get('pantryName', '')
                            if user_pantry_name:
                                pantry_name = user_pantry_name
                                logging.info(f"Using user's pantry '{pantry_name}' for adding item for email {user_email}")
                except Exception as e:
                    logging.error(f"Error reading user pantry info: {e}")
            
            with open(DB_FILE_PATH, 'r+') as file:
                data = json.load(file)
                pantry_data = data.get('pantry', [])
                
                # Handle both old flat format and new multi-pantry format
                if isinstance(pantry_data, dict):
                    # Multi-pantry format
                    if pantry_name not in pantry_data:
                        pantry_data[pantry_name] = []
                    target_pantry = pantry_data[pantry_name]
                else:
                    # Legacy flat format
                    if pantry_name == 'default':
                        target_pantry = pantry_data
                    else:
                        # Convert to multi-pantry format
                        new_pantry_data = {
                            'default': pantry_data,
                            pantry_name: []
                        }
                        data['pantry'] = new_pantry_data
                        target_pantry = new_pantry_data[pantry_name]
                
                for item in extracted_items:
                    # Add each grocery item as a new entry
                    target_pantry.append({
                        "id": str(uuid.uuid4()),
                        "name": item,
                        "amount": "1",
                        "measurement": "unit",
                        "purchaseDate": "",
                        "expired": "no"
                    })
                file.seek(0)
                json.dump(data, file, indent=4)
            logging.info(f"Added items to pantry '{pantry_name}': {extracted_items}")
        except Exception as e:
            logging.error(f"Error adding items to pantry: {e}")
            return jsonify({"error": "Failed to add items to pantry."}), 500

        # Return the extracted grocery items
        return jsonify({"items": extracted_items}), 200

    except Exception as e:
        logging.exception("Unexpected error occurred in process_receipt")
        return jsonify({"error": "An unexpected error occurred. Please try again."}), 500

@app.route('/list_routes', methods=['GET'])
def list_routes():
    import urllib
    output = []
    for rule in app.url_map.iter_rules():
        methods = ','.join(rule.methods)
        url = urllib.parse.unquote(f"{rule.rule}")
        output.append(f"{url} -> {methods}")
    return jsonify(output)

# Function to translate the instructions to Persian using GPT
def translate_to_persian(text):
    translation_prompt = f"Please translate the following text into Persian:\n{text}"
    logging.info(f"Translation Prompt: {translation_prompt}")

    try:
        translation_response = client.chat.completions.create(model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a translator."},
            {"role": "user", "content": translation_prompt}
        ])
        persian_translation = translation_response.choices[0].message.content.strip()
        logging.info(f"Persian Translation: {persian_translation}")
        return persian_translation
    except Exception as e:
        logging.error(f"Error translating to Persian: {e}")
        return "Error in translation."

# Endpoint to generate recipe suggestions based on the user's pantry and preferences
@app.route('/recommend', methods=['POST'])
def recommend_recipes():
    try:
        logging.info("Received request to /recommend endpoint")
        logging.info(f"Request headers: {dict(request.headers)}")

        if not request.is_json:
            logging.error("Request does not contain JSON data")
            return jsonify({"error": "Request must be JSON"}), 400

        data = request.json
        logging.info(f"Request data: {json.dumps(data, indent=2)}")

        ingredients = data.get('ingredients', [])
        logging.info(f"Extracted ingredients: {ingredients}")

        if not ingredients:
            logging.warning("No ingredients provided.")
            return jsonify({"error": "No ingredients provided"}), 400

        # Load user preferences
        try:
            with open(PROFILE_FILE_PATH, 'r') as file:
                profile_data = json.load(file).get('default', {})
                dietary_preferences = profile_data.get('diets', [])
                favorite_cuisines = profile_data.get('cuisines', [])
                logging.info(f"Loaded dietary preferences: {dietary_preferences}")
                logging.info(f"Loaded favorite cuisines: {favorite_cuisines}")
        except Exception as e:
            logging.warning(f"Could not load profile preferences: {e}")
            dietary_preferences = []
            favorite_cuisines = []

        # Create a prompt for OpenAI that includes dietary preferences and cuisines
        ingredients_list = ", ".join(ingredients)
        diets_list = ", ".join(dietary_preferences) if dietary_preferences else "no specific dietary restrictions"
        cuisines_list = ", ".join(favorite_cuisines) if favorite_cuisines else "any cuisine"

        prompt = f"""Given these ingredients: {ingredients_list}, suggest 3 recipes that match the following criteria:
        - Dietary preferences: {diets_list}
        - Preferred cuisines: {cuisines_list}
        
        For each recipe, include:
        - A catchy name
        - Brief description
        - Estimated cooking time in minutes
        - Approximate calories per serving
        - List of main ingredients (including the ones provided)
        - Detailed step-by-step instructions
        
        Make sure the recipes strictly follow any dietary restrictions mentioned.
        If specific cuisines are preferred, prioritize those styles of cooking.
        
        Format the response as JSON with this structure:
        {{
            "recipes": [
                {{
                    "name": "Recipe Name",
                    "description": "Brief description",
                    "cookingTime": "30 minutes",
                    "calories": "400 calories per serving",
                    "cuisine": "Type of cuisine",
                    "dietaryInfo": ["Vegan", "Gluten-Free", etc.],
                    "ingredients": ["ingredient1", "ingredient2"],
                    "instructions": "Step by step instructions"
                }}
            ]
        }}"""

        logging.info(f"OpenAI prompt: {prompt}")

        # Call OpenAI API
        logging.info("Calling OpenAI API...")
        client = openai.OpenAI()
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a helpful cooking assistant that provides detailed recipe suggestions based on available ingredients and dietary preferences. Always respond with properly formatted JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )

        # Extract and parse the response
        recipe_suggestions = response.choices[0].message.content
        logging.info(f"Raw OpenAI response: {recipe_suggestions}")

        try:
            # Try to parse the response as JSON
            recipes_json = json.loads(recipe_suggestions)
            logging.info(f"Successfully parsed recipes: {json.dumps(recipes_json, indent=2)}")
            return jsonify(recipes_json), 200
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse OpenAI response as JSON: {e}")
            logging.error(f"Raw response: {recipe_suggestions}")
            return jsonify({"error": "Failed to generate recipe suggestions"}), 500

    except Exception as e:
        logging.error(f"Error generating recipe suggestions: {e}")
        logging.error("Exception traceback:", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/list_profiles', methods=['GET'])
def list_profiles():
    try:
        if os.path.exists(PROFILE_FILE_PATH):
            with open(PROFILE_FILE_PATH, 'r') as file:
                data = json.load(file)
                profiles = list(data.keys())
                return jsonify({"profiles": profiles}), 200
        else:
            return jsonify({"profiles": []}), 200
    except Exception as e:
        logging.error(f"Error listing profiles: {e}")
        return jsonify({"error": "Failed to list profiles"}), 500

@app.route('/profile', methods=['GET', 'POST'])
def handle_profile():
    try:
        if request.method == 'POST':
            logging.info("Received POST request to /profile endpoint")
            if not request.is_json:
                return jsonify({"error": "Request must be JSON"}), 400

            data = request.json
            logging.info(f"Received profile data: {json.dumps(data, indent=2)}")

            # Create profile.json if it doesn't exist
            if not os.path.exists(PROFILE_FILE_PATH):
                with open(PROFILE_FILE_PATH, 'w') as f:
                    json.dump({}, f)

            # Read existing profiles
            with open(PROFILE_FILE_PATH, 'r') as f:
                profiles = json.load(f)

            # Update or create default profile
            profiles['default'] = {
                'diets': data.get('diets', []),
                'cuisines': data.get('cuisines', [])
            }

            # Save updated profiles
            with open(PROFILE_FILE_PATH, 'w') as f:
                json.dump(profiles, f, indent=2)

            logging.info("Profile preferences saved successfully")
            return jsonify({"message": "Profile preferences saved successfully"}), 200

        else:  # GET request
            logging.info("Received GET request to /profile endpoint")
            try:
                with open(PROFILE_FILE_PATH, 'r') as f:
                    profiles = json.load(f)
                return jsonify(profiles.get('default', {'diets': [], 'cuisines': []})), 200
            except FileNotFoundError:
                return jsonify({'diets': [], 'cuisines': []}), 200

    except Exception as e:
        logging.error(f"Error handling profile request: {e}")
        logging.error("Exception traceback:", exc_info=True)
        return jsonify({"error": str(e)}), 500

def validate_email(email):
    # Basic email validation
    return '@' in email and '.' in email.split('@')[1]

@app.route('/signup', methods=['POST'])
def signup2():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400

    if not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
    except:
        users = {}

    if email in users:
        return jsonify({"error": "Email already registered"}), 409

    # Hash the password before storing
    hashed_password = generate_password_hash(password)

    users[email] = {
        "email": email,
        "password": hashed_password,
        "name": name.strip(),
        "created_at": datetime.now().isoformat()
    }

    with open(USERS_FILE, 'w') as f:
        json.dump(users, f)

    # Return user data without password
    user_data = users[email].copy()
    del user_data['password']
    return jsonify(user_data), 201

@app.route('/get-profile-image', methods=['POST'])
def get_profile_image():
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    try:
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        if email in users and 'profileImage' in users[email]:
            return jsonify({"profileImage": users[email]['profileImage']}), 200
        else:
            return jsonify({"profileImage": None}), 200
    except:
        return jsonify({"error": "Failed to load profile image"}), 500

@app.route('/upload-profile-image', methods=['POST'])
def upload_profile_image():
    data = request.json
    email = data.get('email')
    profile_image = data.get('profileImage')
    
    if not email or not profile_image:
        return jsonify({"error": "Email and profile image are required"}), 400
    
    try:
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        if email not in users:
            return jsonify({"error": "User not found"}), 404
        
        # Update user profile with image
        users[email]['profileImage'] = profile_image
        users[email]['updated_at'] = datetime.now().isoformat()
        
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f)
        
        return jsonify({"profileImage": profile_image, "message": "Profile image updated successfully"}), 200
    except Exception as e:
        logging.error(f"Error updating profile image: {e}")
        return jsonify({"error": "Failed to update profile image"}), 500

@app.route('/search-recipes', methods=['POST'])
def search_recipes():
    try:
        data = request.json
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({"error": "Search query is required"}), 400
        
        if not client:
            return jsonify({"error": "OpenAI client not available"}), 500
        
        # Generate recipe search results using OpenAI
        prompt = f"""
        Search for recipes that match: "{query}"
        
        Return 5-8 recipes in this exact JSON format:
        {{
            "recipes": [
                {{
                    "name": "Recipe Name",
                    "description": "Brief description of the recipe",
                    "ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
                    "instructions": "Step-by-step cooking instructions",
                    "cookingTime": "30 minutes",
                    "calories": "250 calories"
                }}
            ]
        }}
        
        Focus on recipes that closely match the search query. Make sure ingredients are realistic and instructions are practical.
        """
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.7
        )
        
        # Parse the response
        recipe_data = response.choices[0].message.content.strip()
        
        # Clean up the response to ensure it's valid JSON
        if recipe_data.startswith('```json'):
            recipe_data = recipe_data[7:]
        if recipe_data.endswith('```'):
            recipe_data = recipe_data[:-3]
        
        try:
            recipes = json.loads(recipe_data)
            return jsonify(recipes), 200
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse recipe JSON: {e}")
            return jsonify({"error": "Failed to parse recipe data"}), 500
            
    except Exception as e:
        logging.error(f"Error searching recipes: {e}")
        return jsonify({"error": "Failed to search recipes"}), 500

@app.route('/signin', methods=['POST'])
def signin():
    try:
        data = request.json
        email = (data.get('email') or '').strip().lower()
        password = data.get('password')

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        # Ensure users file exists
        if not os.path.exists(USERS_FILE):
            logging.error(f"Users file {USERS_FILE} does not exist")
            return jsonify({"error": "System error"}), 500

        # Load users from file
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if not isinstance(users, dict):
            logging.error("users.json is corrupted or not a dictionary.")
            return jsonify({"error": "Invalid credentials"}), 401

        # Case-insensitive email lookup
        matched_user = next((v for k, v in users.items() if k.lower() == email), None)

        if not matched_user or not matched_user.get('password'):
            logging.warning(f"Login failed for {email}: User not found or missing password")
            return jsonify({"error": "Invalid credentials"}), 401

        if not check_password_hash(matched_user['password'], password):
            logging.warning(f"Login failed for {email}: Invalid password")
            return jsonify({"error": "Invalid credentials"}), 401

        # Strip password from response
        user_data = matched_user.copy()
        user_data.pop('password', None)

        logging.info(f"✅ Successful login for {email}")
        return jsonify(user_data), 200

    except json.JSONDecodeError as e:
        logging.error(f"Failed to decode users.json: {e}")
        return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        logging.exception("🔥 Unexpected error during sign-in")
        return jsonify({"error": "An error occurred during sign in"}), 500


# Initialize store data file
def init_json_file(file_path, default_data):
    if not os.path.exists(file_path):
        logging.info(f"Creating new {file_path}")
        with open(file_path, 'w') as f:
            json.dump(default_data, f, indent=2)

# Initialize store data file
init_json_file(STORES_FILE, {"stores": [], "favorite": None})
init_json_file(SHOPPING_LIST_FILE, {"items": []})

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth's radius in kilometers

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = R * c

    return round(distance, 2)

@app.route('/stores/nearby', methods=['POST'])
def get_nearby_stores():
    data = request.json
    user_lat = data.get('latitude')
    user_lon = data.get('longitude')

    if not user_lat or not user_lon:
        return jsonify({"error": "Location data required"}), 400

    try:
        # In a real app, you would query a database or external API
        # For demo, we'll use some hardcoded stores
        sample_stores = [
            {
                "id": "1",
                "name": "Whole Foods Market",
                "address": "123 Main St",
                "latitude": user_lat + 0.01,
                "longitude": user_lon + 0.01,
            },
            {
                "id": "2",
                "name": "Trader Joe's",
                "address": "456 Oak Ave",
                "latitude": user_lat - 0.01,
                "longitude": user_lon - 0.01,
            },
            {
                "id": "3",
                "name": "Safeway",
                "address": "789 Pine St",
                "latitude": user_lat + 0.02,
                "longitude": user_lon - 0.02,
            }
        ]

        # Calculate distances
        for store in sample_stores:
            store['distance'] = calculate_distance(
                user_lat, user_lon,
                store['latitude'], store['longitude']
            )

        # Sort by distance
        sample_stores.sort(key=lambda x: x['distance'])

        return jsonify({"stores": sample_stores})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/stores/favorite', methods=['GET', 'POST'])
def handle_favorite_store():
    try:
        with open(STORES_FILE, 'r') as f:
            data = json.load(f)
    except:
        data = {"stores": [], "favorite": None}

    if request.method == 'GET':
        return jsonify({"store": data.get("favorite")})

    if request.method == 'POST':
        store = request.json
        data["favorite"] = store
        with open(STORES_FILE, 'w') as f:
            json.dump(data, f)
        return jsonify({"message": "Favorite store updated"})

@app.route('/shopping/suggestions', methods=['GET'])
def get_shopping_suggestions():
    try:
        # Get user email from header
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Load user data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        if user_email not in users:
            return jsonify({"error": "User not found"}), 404
            
        user_data = users[user_email]
        user_pantry_name = user_data.get('pantryName', '')
        user_diets = user_data.get('diets', [])
        user_cuisines = user_data.get('cuisines', [])

        # Load current shopping list to avoid duplicate suggestions
        current_shopping_items = []
        if user_pantry_name:
            try:
                shopping_lists_file = '/mnt/data/MirevaApp/shopping_lists.json'
                with open(shopping_lists_file, 'r') as f:
                    shopping_data = json.load(f)
                    if user_pantry_name in shopping_data:
                        current_shopping_items = [item.get('name', '').lower() for item in shopping_data[user_pantry_name]]
                        logging.info(f"Found {len(current_shopping_items)} items in shopping list for {user_pantry_name}")
            except Exception as e:
                logging.warning(f"Could not load shopping list: {e}")

        suggestions = []
        
        # 1. EXPIRED ITEMS - Get replacements for expired pantry items
        if user_pantry_name:
            try:
                with open(DB_FILE_PATH, 'r') as f:
                    data = json.load(f)
                    pantry_data = data.get('pantry', {})
                    
                if isinstance(pantry_data, dict) and user_pantry_name in pantry_data:
                    user_pantry_items = pantry_data[user_pantry_name]
                    now = datetime.now()
                    
                    for item in user_pantry_items:
                        try:
                            expiry_date = datetime.fromisoformat(item.get('expiryDate', ''))
                            if expiry_date < now:  # Expired
                                item_name = item['name'].lower()
                                # Only suggest if not already in shopping list
                                if item_name not in current_shopping_items:
                                    suggestions.append({
                                        "id": f"exp_{len(suggestions)+1}",
                                        "name": item['name'],
                                        "category": getCategoryForItem(item['name']),
                                        "reason": "Replace expired item",
                                        "priority": "high"
                                    })
                        except:
                            pass  # Skip items with invalid dates
            except:
                pass  # Skip if pantry data unavailable

        # 2. DIET-SPECIFIC SUGGESTIONS
        diet_suggestions = {
            "Vegetarian": ["Tofu", "Tempeh", "Greek Yogurt", "Quinoa", "Lentils"],
            "Vegan": ["Nutritional Yeast", "Almond Milk", "Chickpeas", "Hemp Seeds", "Coconut Oil"],
            "Keto": ["Avocados", "MCT Oil", "Grass-fed Butter", "Almonds", "Cauliflower"],
            "Paleo": ["Sweet Potatoes", "Coconut Flour", "Grass-fed Beef", "Wild Salmon", "Organic Eggs"],
            "Mediterranean": ["Olive Oil", "Feta Cheese", "Olives", "Hummus", "Pine Nuts"],
            "Gluten-Free": ["Rice Flour", "Quinoa Pasta", "Almond Flour", "Coconut Flour"],
            "Dairy-Free": ["Coconut Milk", "Cashew Cheese", "Nutritional Yeast", "Oat Milk"],
            "Low-Carb": ["Zucchini", "Cauliflower Rice", "Shirataki Noodles", "Broccoli"]
        }

        for diet in user_diets:
            if diet in diet_suggestions:
                for item in diet_suggestions[diet][:3]:  # Limit per diet
                    item_name_lower = item.lower()
                    # Check if not already in suggestions and not in shopping list
                    if (not any(s['name'].lower() == item_name_lower for s in suggestions) and 
                        item_name_lower not in current_shopping_items):
                        suggestions.append({
                            "id": f"diet_{len(suggestions)+1}",
                            "name": item,
                            "category": getCategoryForItem(item),
                            "reason": f"Great for {diet} diet",
                            "priority": "medium"
                        })

        # 3. CUISINE-SPECIFIC SUGGESTIONS
        cuisine_suggestions = {
            "Italian": ["San Marzano Tomatoes", "Parmigiano-Reggiano", "Fresh Basil", "Pancetta", "Arborio Rice"],
            "Mediterranean": ["Kalamata Olives", "Sun-dried Tomatoes", "Tahini", "Harissa", "Sumac"],
            "Asian": ["Soy Sauce", "Sesame Oil", "Rice Vinegar", "Miso Paste", "Nori Sheets"],
            "Mexican": ["Lime", "Cilantro", "Jalapeños", "Cumin", "Black Beans"],
            "Indian": ["Garam Masala", "Turmeric", "Basmati Rice", "Ghee", "Coriander"],
            "French": ["Gruyère Cheese", "Dijon Mustard", "Herbs de Provence", "Crème Fraîche"],
            "Middle Eastern": ["Pomegranate Molasses", "Za'atar", "Dates", "Rose Water", "Pistachios"]
        }

        for cuisine in user_cuisines:
            if cuisine in cuisine_suggestions:
                for item in cuisine_suggestions[cuisine][:2]:  # Limit per cuisine
                    item_name_lower = item.lower()
                    # Check if not already in suggestions and not in shopping list
                    if (not any(s['name'].lower() == item_name_lower for s in suggestions) and 
                        item_name_lower not in current_shopping_items):
                        suggestions.append({
                            "id": f"cuisine_{len(suggestions)+1}",
                            "name": item,
                            "category": getCategoryForItem(item),
                            "reason": f"Perfect for {cuisine} cooking",
                            "priority": "medium"
                        })

        # 4. GENERAL STAPLES (if not many suggestions yet)
        if len(suggestions) < 8:
            staples = ["Onions", "Garlic", "Lemons", "Olive Oil", "Salt", "Black Pepper", "Eggs", "Milk"]
            for item in staples:
                item_name_lower = item.lower()
                # Check if not already in suggestions and not in shopping list
                if (not any(s['name'].lower() == item_name_lower for s in suggestions) and 
                    item_name_lower not in current_shopping_items):
                    suggestions.append({
                        "id": f"staple_{len(suggestions)+1}",
                        "name": item,
                        "category": getCategoryForItem(item),
                        "reason": "Kitchen staple",
                        "priority": "low"
                    })
                    if len(suggestions) >= 10:
                        break

        # Sort by priority: high, medium, low
        priority_order = {"high": 0, "medium": 1, "low": 2}
        suggestions.sort(key=lambda x: priority_order.get(x.get('priority', 'low'), 2))

        # Log user activity
        log_user_activity(
            user_email=user_email,
            activity_type="shopping_suggestions_view",
            activity_data={
                "pantry_name": user_pantry_name,
                "suggestions_count": len(suggestions[:12]),
                "suggestion_types": {
                    "expired_items": len([s for s in suggestions if s.get('reason') == 'Replace expired item']),
                    "diet_suggestions": len([s for s in suggestions if 'diet' in s.get('reason', '').lower()]),
                    "cuisine_suggestions": len([s for s in suggestions if 'cooking' in s.get('reason', '').lower()]),
                    "staples": len([s for s in suggestions if s.get('reason') == 'Kitchen staple'])
                },
                "user_diets": user_diets,
                "user_cuisines": user_cuisines
            },
            pantry_name=user_pantry_name
        )

        return jsonify({"suggestions": suggestions[:12]})  # Return top 12 suggestions
    except Exception as e:
        logging.error(f"Error generating shopping suggestions: {e}")
        return jsonify({"error": str(e)}), 500

def getCategoryForScannedItem(item_name):
    """
    Categorize food items for frontend display to match MirevaScreen categories:
    - Fruits & Vegetables
    - Proteins  
    - Grains & Pantry
    - Dairy
    - Expired (handled by frontend based on expiry date)
    """
    item_lower = item_name.lower().strip()
    
    # FRUITS & VEGETABLES
    fruits_vegetables = [
        # Common Fruits
        'apple', 'apples', 'banana', 'bananas', 'orange', 'oranges', 'lemon', 'lemons', 
        'lime', 'limes', 'strawberry', 'strawberries', 'blueberry', 'blueberries',
        'raspberry', 'raspberries', 'blackberry', 'blackberries', 'grape', 'grapes',
        'cherry', 'cherries', 'peach', 'peaches', 'pear', 'pears', 'plum', 'plums',
        'mango', 'mangoes', 'pineapple', 'avocado', 'avocados', 'kiwi', 'melon',
        'watermelon', 'cantaloupe', 'honeydew', 'papaya', 'coconut', 'pomegranate',
        'fig', 'figs', 'date', 'dates', 'cranberry', 'cranberries', 'grapefruit',
        # Common Vegetables  
        'tomato', 'tomatoes', 'potato', 'potatoes', 'onion', 'onions', 'garlic',
        'carrot', 'carrots', 'celery', 'broccoli', 'cauliflower', 'spinach', 'lettuce',
        'cucumber', 'cucumbers', 'pepper', 'peppers', 'bell pepper', 'chili', 'jalapeño',
        'mushroom', 'mushrooms', 'corn', 'sweet corn', 'peas', 'green peas', 'beans',
        'green beans', 'asparagus', 'zucchini', 'squash', 'pumpkin', 'eggplant',
        'cabbage', 'kale', 'brussels sprouts', 'radish', 'beet', 'beets', 'turnip',
        'sweet potato', 'yam', 'artichoke', 'okra', 'leek', 'scallion', 'shallot',
        # Herbs & Leafy Greens
        'basil', 'cilantro', 'parsley', 'mint', 'rosemary', 'thyme', 'oregano',
        'sage', 'dill', 'chives', 'arugula', 'watercress', 'chard',
        # Generic terms
        'fruit', 'fruits', 'vegetable', 'vegetables', 'produce', 'fresh', 'organic'
    ]
    
    # PROTEINS
    proteins = [
        # Meat
        'beef', 'chicken', 'pork', 'lamb', 'turkey', 'duck', 'veal', 'venison',
        'bacon', 'ham', 'sausage', 'hot dog', 'pepperoni', 'salami', 'prosciutto',
        'ground beef', 'ground turkey', 'ground chicken', 'steak', 'roast', 'chops',
        'ribs', 'brisket', 'tenderloin', 'wing', 'wings', 'thigh', 'breast',
        # Seafood
        'fish', 'salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'trout', 'catfish',
        'bass', 'flounder', 'sole', 'snapper', 'mahi', 'swordfish', 'sardines',
        'anchovies', 'mackerel', 'herring', 'shrimp', 'lobster', 'crab', 'scallops',
        'oysters', 'mussels', 'clams', 'crabmeat', 'lobster tail',
        # Eggs & Plant Proteins
        'eggs', 'egg', 'tofu', 'tempeh', 'seitan', 'protein',
        # Legumes
        'beans', 'lentils', 'chickpeas', 'black beans', 'kidney beans', 'pinto beans',
        'navy beans', 'lima beans', 'garbanzo', 'split peas', 'edamame',
        # Nuts (protein source)
        'almonds', 'cashews', 'peanuts', 'walnuts', 'pecans', 'pistachios',
        'macadamia', 'hazelnuts', 'pine nuts', 'brazil nuts'
    ]
    
    # DAIRY
    dairy = [
        'milk', 'whole milk', 'skim milk', '2% milk', 'almond milk', 'soy milk', 'oat milk',
        'coconut milk', 'lactose free milk', 'cheese', 'cheddar', 'mozzarella', 'swiss',
        'parmesan', 'feta', 'goat cheese', 'cream cheese', 'cottage cheese', 'ricotta',
        'brie', 'camembert', 'blue cheese', 'gouda', 'provolone', 'monterey jack',
        'yogurt', 'greek yogurt', 'plain yogurt', 'flavored yogurt', 'butter',
        'margarine', 'cream', 'heavy cream', 'whipping cream', 'sour cream',
        'half and half', 'condensed milk', 'evaporated milk', 'ice cream', 'frozen yogurt',
        'dairy', 'lactose'
    ]
    
    # GRAINS & PANTRY (everything else including actual grains, pantry staples, processed foods)
    grains_pantry = [
        # Grains & Bread
        'bread', 'white bread', 'wheat bread', 'whole grain', 'sourdough', 'rye bread',
        'bagel', 'muffin', 'roll', 'bun', 'pita', 'naan', 'tortilla', 'wrap',
        'rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati', 'wild rice',
        'pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'macaroni', 'noodles',
        'cereal', 'oats', 'oatmeal', 'granola', 'muesli', 'quinoa', 'barley', 'bulgur',
        'couscous', 'farro', 'millet', 'buckwheat', 'flour', 'wheat flour', 'cornmeal',
        # Pantry Staples
        'oil', 'olive oil', 'vegetable oil', 'coconut oil', 'canola oil', 'sesame oil',
        'vinegar', 'balsamic', 'apple cider vinegar', 'white vinegar', 'rice vinegar',
        'salt', 'pepper', 'sugar', 'brown sugar', 'honey', 'maple syrup', 'molasses',
        'vanilla', 'extract', 'spices', 'herbs', 'seasoning', 'sauce', 'condiment',
        # Canned/Packaged Goods  
        'soup', 'broth', 'stock', 'tomato sauce', 'pasta sauce', 'salsa', 'ketchup',
        'mustard', 'mayonnaise', 'relish', 'pickles', 'olives', 'capers',
        'canned', 'jarred', 'bottled', 'packaged', 'frozen meal', 'instant',
        # Snacks & Processed
        'chips', 'crackers', 'cookies', 'candy', 'chocolate', 'snack', 'bar',
        'granola bar', 'energy bar', 'popcorn', 'pretzels', 'nuts', 'trail mix',
        # Beverages
        'juice', 'soda', 'water', 'coffee', 'tea', 'wine', 'beer', 'liquor'
    ]
    
    # Check categories in priority order
    for keyword in fruits_vegetables:
        if keyword in item_lower:
            return 'Fruits & Vegetables'
    
    for keyword in proteins:
        if keyword in item_lower:
            return 'Proteins'
    
    for keyword in dairy:
        if keyword in item_lower:
            return 'Dairy'
    
    for keyword in grains_pantry:
        if keyword in item_lower:
            return 'Grains & Pantry'
    
    # Default fallback
    return 'Grains & Pantry'

def getCategoryForItem(item_name):
    """Helper function to categorize items"""
    categories = {
        'produce': [
            # Vegetables
            'tomato', 'onion', 'garlic', 'potato', 'carrot', 'celery', 'cucumber', 'lettuce',
            'spinach', 'kale', 'broccoli', 'cauliflower', 'zucchini', 'squash', 'pumpkin',
            'pepper', 'chili', 'jalapeno', 'mushroom', 'corn', 'peas', 'green bean', 'asparagus',
            'cabbage', 'brussels', 'radish', 'beet', 'turnip', 'parsnip', 'eggplant', 'okra',
            # Fruits
            'apple', 'banana', 'orange', 'lemon', 'lime', 'grapefruit', 'berry', 'strawberry',
            'blueberry', 'raspberry', 'blackberry', 'grape', 'melon', 'watermelon', 'cantaloupe',
            'peach', 'plum', 'apricot', 'cherry', 'pear', 'mango', 'pineapple', 'avocado',
            'kiwi', 'pomegranate', 'fig', 'date', 'coconut', 'papaya', 'guava',
            # Herbs
            'basil', 'cilantro', 'parsley', 'mint', 'rosemary', 'thyme', 'oregano', 'sage',
            'dill', 'chive', 'tarragon', 'bay leaf'
        ],
        'dairy': [
            'milk', 'cheese', 'yogurt', 'butter', 'cream', 'sour cream', 'ice cream',
            'cottage cheese', 'cream cheese', 'mozzarella', 'cheddar', 'swiss', 'parmesan',
            'feta', 'ricotta', 'goat cheese', 'brie', 'camembert', 'blue cheese',
            'half and half', 'whipping cream', 'heavy cream', 'condensed milk', 'evaporated milk'
        ],
        'proteins': [
            # Meat
            'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'veal', 'bacon', 'ham',
            'sausage', 'ground beef', 'ground turkey', 'steak', 'roast', 'chops', 'ribs',
            # Seafood
            'fish', 'salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'trout', 'catfish',
            'shrimp', 'lobster', 'crab', 'scallops', 'oysters', 'mussels', 'clams',
            # Eggs & Plant-based
            'egg', 'tofu', 'tempeh', 'seitan',
            # Legumes
            'beans', 'lentils', 'chickpeas', 'black beans', 'kidney beans', 'pinto beans',
            'navy beans', 'lima beans', 'soybeans', 'split peas'
        ],
        'grains': [
            'bread', 'rice', 'pasta', 'noodles', 'cereal', 'oats', 'quinoa', 'barley',
            'wheat', 'flour', 'tortilla', 'bagel', 'muffin', 'croissant', 'roll',
            'crackers', 'couscous', 'bulgur', 'farro', 'millet', 'buckwheat', 'cornmeal',
            'pizza', 'pita', 'naan', 'baguette', 'sourdough'
        ],
        'pantry': [
            # Oils & Condiments
            'oil', 'olive oil', 'vegetable oil', 'coconut oil', 'vinegar', 'soy sauce',
            'ketchup', 'mustard', 'mayonnaise', 'hot sauce', 'worcestershire', 'bbq sauce',
            # Spices & Seasonings
            'salt', 'pepper', 'sugar', 'honey', 'maple syrup', 'vanilla', 'cinnamon',
            'cumin', 'paprika', 'garlic powder', 'onion powder', 'chili powder', 'curry',
            # Canned goods
            'soup', 'broth', 'stock', 'tomato sauce', 'tomato paste', 'salsa',
            # Baking
            'baking soda', 'baking powder', 'yeast', 'cocoa', 'chocolate'
        ],
        'snacks': [
            'chips', 'popcorn', 'pretzels', 'nuts', 'almonds', 'cashews', 'peanuts',
            'walnuts', 'pecans', 'pistachios', 'seeds', 'sunflower seeds', 'pumpkin seeds',
            'trail mix', 'granola', 'energy bar', 'protein bar', 'cookies', 'crackers'
        ],
        'beverages': [
            'water', 'juice', 'soda', 'coffee', 'tea', 'beer', 'wine', 'liquor',
            'sports drink', 'energy drink', 'kombucha', 'coconut water', 'almond milk',
            'soy milk', 'oat milk', 'smoothie'
        ],
        'frozen': [
            'frozen vegetables', 'frozen fruit', 'frozen pizza', 'frozen meals',
            'ice cream', 'frozen yogurt', 'popsicles', 'frozen fries', 'frozen chicken',
            'frozen fish', 'frozen berries'
        ]
    }
    
    item_lower = item_name.lower()
    
    # Check each category
    for category, keywords in categories.items():
        for keyword in keywords:
            if keyword in item_lower:
                # Format category name nicely
                if category == 'produce':
                    return 'Produce'
                elif category == 'dairy':
                    return 'Dairy'
                elif category == 'proteins':
                    return 'Proteins'
                elif category == 'grains':
                    return 'Grains'
                elif category == 'pantry':
                    return 'Pantry'
                elif category == 'snacks':
                    return 'Snacks'
                elif category == 'beverages':
                    return 'Beverages'
                elif category == 'frozen':
                    return 'Frozen'
    
    # Default category if no match found
    return 'Other'

@app.route('/shopping/list', methods=['GET', 'POST', 'DELETE'])
def handle_shopping_list():
    try:
        # Get user email from header
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Load user data to get their pantry name
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        if user_email not in users:
            return jsonify({"error": "User not found"}), 404

        # Get user's pantry name
        user_pantry = users[user_email].get('pantryName', 'default')
        if not user_pantry:
            user_pantry = 'default'
        
        logging.info(f"User {user_email} accessing shopping list for pantry '{user_pantry}'")

        # Load shopping lists data (stored per pantry)
        shopping_lists_file = '/mnt/data/MirevaApp/shopping_lists.json'
        if not os.path.exists(shopping_lists_file):
            # Initialize shopping lists file
            with open(shopping_lists_file, 'w') as f:
                json.dump({}, f, indent=2)
            shopping_lists = {}
        else:
            with open(shopping_lists_file, 'r') as f:
                shopping_lists = json.load(f)

        # Initialize shopping list for this pantry if not exists
        if user_pantry not in shopping_lists:
            shopping_lists[user_pantry] = []

        if request.method == 'GET':
            # Log user activity
            log_user_activity(
                user_email=user_email,
                activity_type="shopping_list_view",
                activity_data={
                    "pantry_name": user_pantry,
                    "items_count": len(shopping_lists[user_pantry]),
                    "item_names": [item.get('name', 'Unknown') for item in shopping_lists[user_pantry]]
                },
                pantry_name=user_pantry
            )
            return jsonify({"items": shopping_lists[user_pantry]})

        if request.method == 'POST':
            item = request.json.get('item')
            logging.info(f"Received item data: {item}")
            
            if not item:
                return jsonify({"error": "Item data required"}), 400

            # Check if item has required fields
            if 'name' not in item:
                logging.error(f"Item missing 'name' field. Item: {item}")
                return jsonify({"error": "Item must have a 'name' field"}), 400

            # Add metadata to item
            if 'id' not in item:
                item['id'] = str(int(datetime.now().timestamp() * 1000))  # Unique timestamp ID
            
            item['addedAt'] = datetime.now().isoformat()
            if 'completed' not in item:
                item['completed'] = False
            if 'priority' not in item:
                item['priority'] = 'medium'

            # Add item to pantry's shopping list
            shopping_lists[user_pantry].append(item)
            
            # Save updated shopping lists data
            with open(shopping_lists_file, 'w') as f:
                json.dump(shopping_lists, f, indent=2)
                
            logging.info(f"Added item '{item['name']}' to shopping list for pantry '{user_pantry}' by user {user_email}")
            
            # Log user activity
            log_user_activity(
                user_email=user_email,
                activity_type="shopping_list_add_item",
                activity_data={
                    "pantry_name": user_pantry,
                    "item_added": item
                },
                pantry_name=user_pantry
            )
            
            return jsonify({"message": "Item added to shopping list"})

        if request.method == 'DELETE':
            item_id = request.args.get('id')
            if not item_id:
                return jsonify({"error": "Item ID required"}), 400

            # Remove item from pantry's shopping list
            original_count = len(shopping_lists[user_pantry])
            shopping_lists[user_pantry] = [
                item for item in shopping_lists[user_pantry]
                if item['id'] != item_id
            ]
            
            if len(shopping_lists[user_pantry]) == original_count:
                return jsonify({"error": "Item not found"}), 404

            # Save updated shopping lists data
            with open(shopping_lists_file, 'w') as f:
                json.dump(shopping_lists, f, indent=2)
                
            logging.info(f"Removed item {item_id} from shopping list for pantry '{user_pantry}' by user {user_email}")
            
            # Log user activity
            log_user_activity(
                user_email=user_email,
                activity_type="shopping_list_remove_item",
                activity_data={
                    "pantry_name": user_pantry,
                    "item_id": item_id
                },
                pantry_name=user_pantry
            )
            
            return jsonify({"message": "Item removed from shopping list"})

    except Exception as e:
        logging.error(f"Error handling shopping list request: {e}")
        return jsonify({"error": str(e)}), 500

# Mock function to simulate fetching grocery stores
# OpenAI client is already initialized at the top of the file

def fetch_grocery_stores(zip_code):
    """
    Fetches grocery stores near the given zip code using OpenAI's GPT model.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant providing grocery store information."},
                {"role": "user", "content": f"List two grocery stores near the zip code {zip_code}."}
            ],
            max_tokens=100
        )

        stores_text = response.choices[0].message.content.strip()
        stores = []

        for line in stores_text.split("\n"):
            if line.strip():
                stores.append({"name": line.strip()})

        return stores
    except Exception as e:
        logging.error(f"Failed to fetch stores from OpenAI: {e}")
        return []

@app.route('/get-stores', methods=['POST'])
def get_stores():
    data = request.get_json()
    zip_code = data.get('zip_code')
    if not zip_code:
        return jsonify({"error": "Zip code is required"}), 400

    try:
        stores = fetch_grocery_stores(zip_code)
        if stores:
            return jsonify({"stores": stores})
        else:
            return jsonify({"error": "No stores found"}), 404
    except Exception as e:
        app.logger.error(f"Failed to fetch stores: {e}")
        return jsonify({"error": "Failed to fetch stores"}), 500

@app.route('/upload', methods=['POST'])
def upload_image():
    try:
        logging.info("📥 Received request to /upload")

        if 'file' not in request.files:
            logging.warning("⚠️ No file part in request.files")
            return jsonify({"error": "No file part"}), 400

        file = request.files['file']
        logging.info(f"📄 Filename: {file.filename}")

        if file.filename == '':
            logging.warning("⚠️ No selected file")
            return jsonify({"error": "No selected file"}), 400

        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        logging.info(f"💾 Saving file to {file_path}")
        file.save(file_path)

        return jsonify({"message": "File uploaded successfully", "path": file_path}), 200
    except Exception as e:
        logging.exception("❌ Error in /upload")
        return jsonify({"error": str(e)}), 500

@app.route('/scan-food', methods=['POST'])
def scan_food():
    file = request.files['file']
    image_bytes = file.read()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')

    response = openai.ChatCompletion.create(
        model="gpt-4-vision",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Identify the food item in the image."},
                    {"type": "image_url", 
                     "image_url": f"data:image/jpeg;base64,{base64_image}"}
                ]
            }
        ],
        max_tokens=50
    )

    food_item = response.choices[0].message.content.strip()

    return jsonify({"food": food_item})

@app.route('/scan-and-add', methods=['POST'])
def scan_and_add_items():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        # Convert image to base64
        with open(file_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')

        logging.info("📷 Sending image to GPT-4 Vision...")


        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "You are a food recognition assistant. Based on the image, identify all recognizable food items "
                                "such as fruits, vegetables, or packaged pantry items. For each item, count how many are visible in the image.\n\n"
                                "IMPORTANT: Return ONLY a complete, valid JSON array. Do not include any explanation or incomplete JSON.\n\n"
                                "Each element must have exactly these fields: `name`, `amount`, and `measurement` (use 'unit' if unknown).\n\n"
                                "Example format: [\n"
                                "  {\"name\": \"banana\", \"amount\": 2, \"measurement\": \"unit\"},\n"
                                "  {\"name\": \"apple\", \"amount\": 3, \"measurement\": \"unit\"}\n"
                                "]\n\n"
                                "If you cannot identify any food items, return: []"
                            )
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                        }
                    ]
                }
            ],
            max_tokens=100
            )


        raw_output = response.choices[0].message.content.strip()
        logging.info(f"🧠 GPT Raw Output: {raw_output}")

        # Clean raw output
        if raw_output.startswith("```"):
            raw_output = raw_output.replace("```json", "").replace("```", "").strip()

        # Try to fix incomplete JSON
        if raw_output.endswith(','):
            raw_output = raw_output.rstrip(',')
        if not raw_output.endswith(']'):
            # Try to close incomplete JSON array
            if raw_output.count('[') > raw_output.count(']'):
                # Count open braces vs closed braces
                open_braces = raw_output.count('{')
                closed_braces = raw_output.count('}')
                if open_braces > closed_braces:
                    # Add missing closing braces
                    raw_output += '}' * (open_braces - closed_braces)
                raw_output += ']'

        try:
            food_items = json.loads(raw_output)
        except json.JSONDecodeError as e:
            logging.error(f"JSON decode error: {e}")
            try:
                # Fallback to ast.literal_eval
                food_items = ast.literal_eval(raw_output)
            except Exception as e2:
                logging.error(f"AST literal_eval error: {e2}")
                # If all parsing fails, extract item names manually
                logging.info("Attempting manual extraction from malformed JSON")
                food_items = []
                import re
                # Extract item names using regex
                name_matches = re.findall(r'"name":\s*"([^"]+)"', raw_output)
                for name in name_matches:
                    food_items.append({
                        "name": name,
                        "amount": "1",
                        "measurement": "unit"
                    })
                if not food_items:
                    raise ValueError("Could not extract any food items from the response")

        if not isinstance(food_items, list):
            raise ValueError("Expected a JSON array of food items")

        now = datetime.now()
        # FIXED: Use user email to get pantry name
        # Get user's email from header
        user_email = request.headers.get('X-User-Email')
        pantry_name = 'default'
        
        # If user email is provided, get their pantryName from users.json
        if user_email:
            try:
                with open(USERS_FILE, 'r') as f:
                    users = json.load(f)
                    if user_email in users:
                        user_pantry_name = users[user_email].get('pantryName', '')
                        if user_pantry_name:
                            pantry_name = user_pantry_name
                            logging.info(f"Using user's pantry '{pantry_name}' for adding item for email {user_email}")
            except Exception as e:
                logging.error(f"Error reading user pantry info: {e}")
        
        with open(DB_FILE_PATH, 'r+') as file:
            data = json.load(file)
            pantry_data = data.get('pantry', [])
            
            # Handle both old flat format and new multi-pantry format
            if isinstance(pantry_data, dict):
                # Multi-pantry format
                if pantry_name not in pantry_data:
                    pantry_data[pantry_name] = []
                target_pantry = pantry_data[pantry_name]
            else:
                # Legacy flat format
                if pantry_name == 'default':
                    target_pantry = pantry_data
                else:
                    # Convert to multi-pantry format
                    new_pantry_data = {
                        'default': pantry_data,
                        pantry_name: []
                    }
                    data['pantry'] = new_pantry_data
                    target_pantry = new_pantry_data[pantry_name]

            for food in food_items:
                food_name = food["name"].strip().capitalize()
                category = getCategoryForScannedItem(food_name)
                
                # Calculate smart expiry date
                smart_expiry = get_smart_expiry_date(food_name, now)
                expiry_date = smart_expiry.isoformat() if smart_expiry else None
                
                target_pantry.append({
                    "id": str(uuid.uuid4()),
                    "name": food_name,
                    "amount": str(food["amount"]),
                    "measurement": food.get("measurement", "unit"),
                    "category": category,
                    "purchaseDate": now.isoformat(),
                    "expiryDate": expiry_date,
                    "expired": "no"
                })

            file.seek(0)
            file.truncate()
            json.dump(data, file, indent=2)

        # Log user activity
        log_user_activity(
            user_email=user_email,
            activity_type="pantry_scan_add",
            activity_data={
                "pantry_name": pantry_name,
                "scanned_items": [item.get('name', 'Unknown') for item in food_items],
                "items_added": food_items,
                "items_count": len(food_items),
                "method": "gpt4_vision_scan",
                "scan_successful": True
            },
            pantry_name=pantry_name
        )

        return jsonify({"message": "Items added successfully", "items": food_items}), 200

    except Exception as e:
        logging.exception("🔥 Error in GPT-4 Vision scan-and-add")
        return jsonify({"error": str(e)}), 500


def parse_text_to_items(text):
    # Simple parsing logic to extract items from text
    # This should be customized based on expected text format
    return [line.strip() for line in text.splitlines() if line.strip()]

def add_items_to_pantry(items, pantry_name='default'):
    # Logic to add items to the pantry
    with open(DB_FILE_PATH, 'r+') as file:
        data = json.load(file)
        pantry_data = data.get('pantry', [])
        
        # Handle both old flat format and new multi-pantry format
        if isinstance(pantry_data, dict):
            # Multi-pantry format
            if pantry_name not in pantry_data:
                pantry_data[pantry_name] = []
            target_pantry = pantry_data[pantry_name]
        else:
            # Legacy flat format
            if pantry_name == 'default':
                target_pantry = pantry_data
            else:
                # Convert to multi-pantry format
                new_pantry_data = {
                    'default': pantry_data,
                    pantry_name: []
                }
                data['pantry'] = new_pantry_data
                target_pantry = new_pantry_data[pantry_name]
        
        for item in items:
            target_pantry.append({"id": str(uuid.uuid4()), "name": item})
        file.seek(0)
        file.truncate()
        json.dump(data, file, indent=2)

@app.route('/update-user-pantry', methods=['POST'])
def update_user_pantry():
    try:
        data = request.json
        email = data.get('email')
        pantry_name = data.get('pantryName')

        if not email:
            return jsonify({"error": "Email is required"}), 400
        
        # pantryName can be empty string (for leaving pantry) or None, so we need to handle that
        if pantry_name is None:
            return jsonify({"error": "pantryName field is required (can be empty string to leave pantry)"}), 400

        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if email not in users:
            return jsonify({"error": "User not found"}), 404

        # Update user's pantry name
        users[email]['pantryName'] = pantry_name
        
        # Save updated users data
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)

        logging.info(f"Updated pantry for user {email} to '{pantry_name}'")
        return jsonify({"message": "User pantry updated successfully"}), 200

    except Exception as e:
        logging.error(f"Error updating user pantry: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-user-pantry', methods=['POST'])
def get_user_pantry():
    try:
        data = request.json
        email = data.get('email')

        if not email:
            return jsonify({"error": "Email is required"}), 400

        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if email not in users:
            return jsonify({"error": "User not found"}), 404

        user_data = users[email]
        pantry_name = user_data.get('pantryName', '')
        
        return jsonify({
            "email": email,
            "pantryName": pantry_name,
            "name": user_data.get('name', ''),
            "diets": user_data.get('diets', []),
            "cuisines": user_data.get('cuisines', []),
        }), 200

    except Exception as e:
        logging.error(f"Error getting user pantry: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/update-user-preferences', methods=['POST'])
def update_user_preferences():
    try:
        data = request.json
        email = data.get('email')
        diets = data.get('diets', [])
        cuisines = data.get('cuisines', [])

        if not email:
            return jsonify({"error": "Email is required"}), 400

        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if email not in users:
            return jsonify({"error": "User not found"}), 404

        # Update user's preferences
        users[email]['diets'] = diets
        users[email]['cuisines'] = cuisines
        
        # Save updated users data
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)

        logging.info(f"Updated preferences for user {email} - diets: {diets}, cuisines: {cuisines}")
        return jsonify({"message": "User preferences updated successfully"}), 200

    except Exception as e:
        logging.error(f"Error updating user preferences: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/suspend-account', methods=['POST'])
def suspend_account():
    try:
        data = request.json
        email = data.get('email')

        if not email:
            return jsonify({"error": "Email is required"}), 400

        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if email not in users:
            return jsonify({"error": "User not found"}), 404

        # Mark account as suspended
        users[email]['suspended'] = True
        users[email]['suspended_at'] = datetime.now().isoformat()
        
        # Save updated users data
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)

        logging.info(f"Account suspended for user {email}")
        return jsonify({"message": "Account suspended successfully"}), 200

    except Exception as e:
        logging.error(f"Error suspending account: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/delete-account', methods=['POST'])
def delete_account():
    try:
        data = request.json
        email = data.get('email')

        if not email:
            return jsonify({"error": "Email is required"}), 400

        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if email not in users:
            return jsonify({"error": "User not found"}), 404

        user_data = users[email]
        pantry_name = user_data.get('pantryName')

        # Remove user from users.json
        del users[email]
        
        # Save updated users data
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)

        # DO NOT delete shared pantry data - other users may be using it
        # Only log the account deletion for audit purposes
        if pantry_name:
            logging.info(f"User {email} was removed from pantry '{pantry_name}' - pantry data preserved for other users")

        logging.info(f"Account deleted for user {email}")
        return jsonify({"message": "Account deleted successfully"}), 200

    except Exception as e:
        logging.error(f"Error deleting account: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/get-available-pantries', methods=['GET'])
def get_available_pantries():
    """Get list of available pantry names from db.json"""
    try:
        logging.info("Fetching available pantries from db.json")
        
        # Read db.json file
        if not os.path.exists(DB_FILE_PATH):
            logging.warning("db.json file not found")
            return jsonify({"pantries": ["Sadri-FAM Pantry", "Family Pantry", "Office Pantry"]}), 200
        
        with open(DB_FILE_PATH, 'r') as f:
            data = json.load(f)
            pantry_data = data.get('pantry', {})
        
        # Extract pantry names from db.json
        pantry_names = []
        if isinstance(pantry_data, dict):
            # Multi-pantry format - get all pantry names
            pantry_names = list(pantry_data.keys())
        else:
            # Legacy flat format - default pantry only
            pantry_names = ["default"]
        
        # Convert to sorted list and filter out empty names
        available_pantries = sorted([name for name in pantry_names if name and name.strip()])
        
        # Add default options if no pantries found
        if not available_pantries:
            available_pantries = ["Sadri-FAM Pantry", "Family Pantry", "Office Pantry"]
        
        logging.info(f"Found {len(available_pantries)} available pantries: {available_pantries}")
        return jsonify({"pantries": available_pantries}), 200
    
    except Exception as e:
        logging.error(f"Error fetching available pantries: {e}")
        return jsonify({"error": "Failed to fetch available pantries", "pantries": ["Sadri-FAM Pantry", "Family Pantry", "Office Pantry"]}), 500

@app.route('/log-recipe', methods=['POST'])
def log_recipe():
    """Log a recipe that was saved by user"""
    try:
        data = request.json
        user_email = request.headers.get('X-User-Email')
        
        if not user_email:
            return jsonify({"error": "User email required"}), 400
            
        if not data:
            return jsonify({"error": "Recipe data required"}), 400
        
        # Check if this is a saved recipe (action: 'saved')
        action = data.get('action')
        if action == 'saved':
            recipe_data = data.get('recipe', {})
            
            # Load users data
            try:
                with open(USERS_FILE, 'r') as f:
                    users = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                users = {}
            
            # Initialize user if not exists
            if user_email not in users:
                users[user_email] = {}
            
            # Initialize savedRecipes array if not exists
            if 'savedRecipes' not in users[user_email]:
                users[user_email]['savedRecipes'] = []
            
            # Add the recipe to user's saved recipes
            users[user_email]['savedRecipes'].append(recipe_data)
            
            # Save updated users data
            with open(USERS_FILE, 'w') as f:
                json.dump(users, f, indent=2)
            
            # Log the recipe saving activity
            try:
                user_pantry = users[user_email].get('pantryName', '')
                log_user_activity(
                    user_email=user_email,
                    activity_type="recipe_saved",
                    activity_data={
                        "recipe_name": recipe_data.get('name', 'Unknown Recipe'),
                        "recipe_id": recipe_data.get('id', ''),
                        "ingredients_count": len(recipe_data.get('ingredients', [])),
                        "timestamp": datetime.now().isoformat()
                    },
                    pantry_name=user_pantry
                )
            except Exception as log_error:
                logging.warning(f"Could not log recipe save activity: {log_error}")
            
            logging.info(f"Recipe saved to users.json for user {user_email}: {recipe_data.get('name', 'Unknown Recipe')}")
            return jsonify({"message": "Recipe saved successfully to user profile"}), 200
        
        # For non-saved recipes, continue with original logging behavior
        # Get user's pantry name
        pantry_name = 'default'
        if user_email:
            try:
                with open(USERS_FILE, 'r') as f:
                    users = json.load(f)
                    if user_email in users:
                        user_pantry_name = users[user_email].get('pantryName', '')
                        if user_pantry_name:
                            pantry_name = user_pantry_name
            except Exception as e:
                logging.error(f"Error reading user pantry info: {e}")
        
        # Create recipe log entry
        recipe_log = {
            "id": str(uuid.uuid4()),
            "user_email": user_email,
            "pantry_name": pantry_name,
            "recipe_name": data.get('recipe_name', 'Unknown Recipe'),
            "ingredients": data.get('ingredients', []),
            "instructions": data.get('instructions', ''),
            "timestamp": datetime.now().isoformat(),
            "date_cooked": datetime.now().strftime('%Y-%m-%d')
        }
        
        # Load existing recipe logs
        recipe_logs_file = '/mnt/data/MirevaApp/recipe_logs.json'
        try:
            with open(recipe_logs_file, 'r') as f:
                logs = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            logs = {"recipe_logs": []}
            
        # Add new log entry
        if "recipe_logs" not in logs:
            logs["recipe_logs"] = []
            
        logs["recipe_logs"].append(recipe_log)
        
        # Save updated logs
        with open(recipe_logs_file, 'w') as f:
            json.dump(logs, f, indent=2)
        
        # Log the recipe cooking activity in user analytics
        try:
            log_user_activity(
                user_email=user_email,
                activity_type="recipe_cooked",
                activity_data={
                    "recipe_name": recipe_log['recipe_name'],
                    "recipe_id": recipe_log['id'],
                    "ingredients_count": len(recipe_log.get('ingredients', [])),
                    "timestamp": recipe_log['timestamp']
                },
                pantry_name=pantry_name
            )
        except Exception as log_error:
            logging.warning(f"Could not log recipe cook activity: {log_error}")
            
        logging.info(f"Recipe logged successfully for user {user_email}: {recipe_log['recipe_name']}")
        return jsonify({"message": "Recipe logged successfully", "log_id": recipe_log["id"]}), 200
        
    except Exception as e:
        logging.error(f"Error logging recipe: {e}")
        return jsonify({"error": str(e)}), 500


# Comprehensive User Activity Logging
ANALYTICS_FILE = '/mnt/data/MirevaApp/user_analytics.json'

def log_user_activity(user_email, activity_type, activity_data, pantry_name=None):
    """Log comprehensive user activity for analytics"""
    try:
        # Load existing analytics data
        try:
            with open(ANALYTICS_FILE, 'r') as f:
                analytics = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            analytics = {"activities": [], "summary": {}}
        
        # Create activity entry
        activity_entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "date": datetime.now().strftime('%Y-%m-%d'),
            "time": datetime.now().strftime('%H:%M:%S'),
            "user_email": user_email,
            "pantry_name": pantry_name,
            "activity_type": activity_type,
            "activity_data": activity_data,
            "session_info": {
                "user_agent": request.headers.get('User-Agent', ''),
                "ip_address": request.remote_addr
            }
        }
        
        # Add to activities list
        if "activities" not in analytics:
            analytics["activities"] = []
        analytics["activities"].append(activity_entry)
        
        # Update summary statistics
        if "summary" not in analytics:
            analytics["summary"] = {}
        
        # User-specific statistics
        if user_email not in analytics["summary"]:
            analytics["summary"][user_email] = {
                "total_activities": 0,
                "first_activity": activity_entry["timestamp"],
                "last_activity": activity_entry["timestamp"],
                "activity_counts": {},
                "pantry_usage": {},
                "daily_activity": {}
            }
        
        user_stats = analytics["summary"][user_email]
        user_stats["total_activities"] += 1
        user_stats["last_activity"] = activity_entry["timestamp"]
        
        # Activity type counts
        if activity_type not in user_stats["activity_counts"]:
            user_stats["activity_counts"][activity_type] = 0
        user_stats["activity_counts"][activity_type] += 1
        
        # Pantry usage tracking
        if pantry_name:
            if pantry_name not in user_stats["pantry_usage"]:
                user_stats["pantry_usage"][pantry_name] = 0
            user_stats["pantry_usage"][pantry_name] += 1
        
        # Daily activity tracking
        today = datetime.now().strftime('%Y-%m-%d')
        if today not in user_stats["daily_activity"]:
            user_stats["daily_activity"][today] = 0
        user_stats["daily_activity"][today] += 1
        
        # Keep only last 30 days of daily activity
        cutoff_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        user_stats["daily_activity"] = {
            date: count for date, count in user_stats["daily_activity"].items() 
            if date >= cutoff_date
        }
        
        # Global statistics
        if "global" not in analytics["summary"]:
            analytics["summary"]["global"] = {
                "total_users": 0,
                "total_activities": 0,
                "activity_types": {},
                "daily_totals": {}
            }
        
        global_stats = analytics["summary"]["global"]
        global_stats["total_users"] = len([k for k in analytics["summary"].keys() if k != "global"])
        global_stats["total_activities"] = len(analytics["activities"])
        
        # Global activity type counts
        if activity_type not in global_stats["activity_types"]:
            global_stats["activity_types"][activity_type] = 0
        global_stats["activity_types"][activity_type] += 1
        
        # Global daily totals
        if today not in global_stats["daily_totals"]:
            global_stats["daily_totals"][today] = 0
        global_stats["daily_totals"][today] += 1
        
        # Keep only last 30 days of global daily totals
        global_stats["daily_totals"] = {
            date: count for date, count in global_stats["daily_totals"].items() 
            if date >= cutoff_date
        }
        
        # Keep only last 1000 activities to prevent file from growing too large
        if len(analytics["activities"]) > 1000:
            analytics["activities"] = analytics["activities"][-1000:]
        
        # Save updated analytics
        with open(ANALYTICS_FILE, 'w') as f:
            json.dump(analytics, f, indent=2)
            
        logging.info(f"Activity logged for {user_email}: {activity_type}")
        
    except Exception as e:
        logging.error(f"Error logging user activity: {e}")

@app.route('/user-analytics', methods=['GET'])
def get_user_analytics():
    """Get user analytics data (admin endpoint)"""
    try:
        admin_key = request.headers.get('X-Admin-Key')
        if admin_key != 'mireva-admin-2024':  # Simple admin authentication
            return jsonify({"error": "Unauthorized"}), 401
        
        try:
            with open(ANALYTICS_FILE, 'r') as f:
                analytics = json.load(f)
            return jsonify(analytics), 200
        except (FileNotFoundError, json.JSONDecodeError):
            return jsonify({"activities": [], "summary": {}}), 200
            
    except Exception as e:
        logging.error(f"Error getting analytics: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-recipe-logs', methods=['GET'])
def get_recipe_logs():
    """Get recipe logs for current user - shows saved and cooked recipes with proper names"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"recipe_logs": []}), 200
        
        user_email = user_email.strip().lower()
        
        # Load user analytics to get recipe activities
        try:
            with open(ANALYTICS_FILE, 'r') as f:
                analytics = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return jsonify({"recipe_logs": []}), 200
        
        recipe_logs = []
        activities = analytics.get('activities', [])
        
        # Filter activities for this user and recipe-related activities
        for activity in activities:
            if activity.get('user_email') == user_email and activity.get('activity_type') in ['recipe_saved', 'recipe_cooked']:
                activity_data = activity.get('activity_data', {})
                recipe_logs.append({
                    'id': activity.get('id'),
                    'timestamp': activity.get('timestamp'),
                    'recipe_name': activity_data.get('recipe_name', 'Unknown Recipe'),
                    'activity_type': activity.get('activity_type'),
                    'user_email': user_email
                })
        
        return jsonify({"recipe_logs": recipe_logs}), 200
        
    except Exception as e:
        logging.error(f"Error getting recipe logs: {e}")
        return jsonify({"recipe_logs": []}), 500

@app.route('/pantry-activity-logs', methods=['GET'])
def get_pantry_activity_logs():
    """Get pantry activity logs for shared pantries - shows all users' activities"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"activities": []}), 200
        
        user_email = user_email.strip().lower()
        
        # Get user's pantry name
        try:
            with open(USERS_FILE, 'r') as f:
                users = json.load(f)
            user_pantry = users.get(user_email, {}).get('pantryName', '')
        except Exception:
            return jsonify({"activities": []}), 200
        
        if not user_pantry:
            return jsonify({"activities": []}), 200
        
        # Load analytics
        try:
            with open(ANALYTICS_FILE, 'r') as f:
                analytics = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return jsonify({"activities": []}), 200
        
        pantry_activities = []
        activities = analytics.get('activities', [])
        
        # Filter activities for this pantry
        for activity in activities:
            if activity.get('pantry_name') == user_pantry:
                activity_data = activity.get('activity_data', {})
                user_name = activity.get('user_email', '').split('@')[0] if activity.get('user_email') else 'Unknown'
                
                pantry_activities.append({
                    'id': activity.get('id'),
                    'timestamp': activity.get('timestamp'),
                    'date': activity.get('date'),
                    'activity_type': activity.get('activity_type'),
                    'user_name': user_name.capitalize(),
                    'user_email': activity.get('user_email'),
                    'description': format_activity_description(activity.get('activity_type'), activity_data, user_name),
                    'activity_data': activity_data
                })
        
        # Sort by timestamp (newest first)
        pantry_activities.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return jsonify({"activities": pantry_activities[:50]}), 200  # Limit to 50 recent activities
        
    except Exception as e:
        logging.error(f"Error getting pantry activity logs: {e}")
        return jsonify({"activities": []}), 500

@app.route('/shopping-activity-logs', methods=['GET'])
def get_shopping_activity_logs():
    """Get shopping list activity logs for shared pantries - shows all users' activities"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"activities": []}), 200
        
        user_email = user_email.strip().lower()
        
        # Get user's pantry name
        try:
            with open(USERS_FILE, 'r') as f:
                users = json.load(f)
            user_pantry = users.get(user_email, {}).get('pantryName', '')
        except Exception:
            return jsonify({"activities": []}), 200
        
        if not user_pantry:
            return jsonify({"activities": []}), 200
        
        # Load analytics
        try:
            with open(ANALYTICS_FILE, 'r') as f:
                analytics = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return jsonify({"activities": []}), 200
        
        shopping_activities = []
        activities = analytics.get('activities', [])
        
        # Shopping list activity types to filter for
        shopping_activity_types = ['shopping_list_add_item', 'shopping_list_remove_item', 'shopping_list_view']
        
        # Filter activities for this pantry and shopping list activities only
        for activity in activities:
            if (activity.get('pantry_name') == user_pantry and 
                activity.get('activity_type') in shopping_activity_types):
                activity_data = activity.get('activity_data', {})
                user_name = activity.get('user_email', '').split('@')[0] if activity.get('user_email') else 'Unknown'
                
                shopping_activities.append({
                    'id': activity.get('id'),
                    'timestamp': activity.get('timestamp'),
                    'date': activity.get('date'),
                    'activity_type': activity.get('activity_type'),
                    'user_name': user_name.capitalize(),
                    'user_email': activity.get('user_email'),
                    'description': format_activity_description(activity.get('activity_type'), activity_data, user_name),
                    'activity_data': activity_data
                })
        
        # Sort by timestamp (newest first)
        shopping_activities.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return jsonify({"activities": shopping_activities[:50]}), 200  # Limit to 50 recent activities
        
    except Exception as e:
        logging.error(f"Error getting shopping activity logs: {e}")
        return jsonify({"activities": []}), 500

def format_activity_description(activity_type, activity_data, user_name):
    """Format activity description for display"""
    if activity_type == 'pantry_scan_add':
        item_count = len(activity_data.get('scanned_items', []))
        return f"{user_name} scanned and added {item_count} item{'s' if item_count != 1 else ''}"
    elif activity_type == 'pantry_add_item':
        item_name = activity_data.get('item_name', 'item')
        return f"{user_name} manually added {item_name}"
    elif activity_type == 'pantry_view':
        return f"{user_name} viewed the pantry"
    elif activity_type == 'recipe_saved':
        recipe_name = activity_data.get('recipe_name', 'a recipe')
        return f"{user_name} saved recipe: {recipe_name}"
    elif activity_type == 'recipe_cooked':
        recipe_name = activity_data.get('recipe_name', 'a recipe')
        return f"{user_name} cooked recipe: {recipe_name}"
    elif activity_type == 'shopping_suggestion_add':
        item_name = activity_data.get('item_name', 'item')
        return f"{user_name} added {item_name} to shopping list"
    elif activity_type == 'shopping_list_add_item':
        item_added = activity_data.get('item_added', {})
        item_name = item_added.get('name', 'item') if isinstance(item_added, dict) else 'item'
        return f"{user_name} added {item_name} to shopping list"
    elif activity_type == 'shopping_list_remove_item':
        item_id = activity_data.get('item_id', 'item')
        return f"{user_name} removed item from shopping list"
    elif activity_type == 'shopping_list_view':
        items_count = activity_data.get('items_count', 0)
        return f"{user_name} viewed shopping list ({items_count} item{'s' if items_count != 1 else ''})"
    else:
        return f"{user_name} performed {activity_type.replace('_', ' ')}"

if __name__ == '__main__':
    logging.info("Registered Flask routes:")
    for rule in app.url_map.iter_rules():
        logging.info(f"Route: {rule} -> {rule.endpoint}")
    app.run(host='0.0.0.0', port=5001, debug=True)