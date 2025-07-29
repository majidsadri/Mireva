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
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import requests
from math import radians, sin, cos, sqrt, atan2
import ast

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

#client = "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"

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.INFO)

# File paths - use EC2 absolute paths for production
DB_FILE_PATH = '/mnt/data/MirevaApp/db.json'
PROFILE_FILE_PATH = '/mnt/data/MirevaApp/profile.json'
USERS_FILE = '/mnt/data/MirevaApp/users.json'

# Store data file
STORES_FILE = '/mnt/data/MirevaApp/stores.json'
SHOPPING_LIST_FILE = '/mnt/data/MirevaApp/shopping_lists.json'
PANTRY_REQUESTS_FILE = '/mnt/data/MirevaApp/pantry_requests.json'
PANTRY_OWNERS_FILE = '/mnt/data/MirevaApp/pantry_owners.json'

def log_user_activity(user_email, activity_type, activity_data=None, pantry_name=None):
    """Log user activity with deduplication to prevent duplicate entries"""
    try:
        # Ensure the logs directory exists
        logs_dir = "/mnt/data/MirevaApp/activity_logs"
        os.makedirs(logs_dir, exist_ok=True)
        
        # Determine log file based on activity type
        if activity_type.startswith('shopping'):
            log_file = os.path.join(logs_dir, f"{pantry_name}_shopping_activity.json")
        else:
            log_file = os.path.join(logs_dir, f"{pantry_name}_pantry_activity.json")
            
        # Get user info
        user_name = user_email.split('@')[0]
        try:
            with open(USERS_FILE, 'r') as f:
                users = json.load(f)
            user_data = users.get(user_email, {})
            user_name = user_data.get('name', user_name)
        except Exception:
            pass
        
        # Create activity record
        activity = {
            "timestamp": datetime.now().isoformat(),
            "user_email": user_email,
            "user_name": user_name,
            "activity_type": activity_type,
            "activity_data": activity_data or {},
            "description": f"{user_name} performed {activity_type}"
        }
        
        # Read existing activities
        activities = []
        if os.path.exists(log_file):
            try:
                with open(log_file, 'r') as f:
                    data = json.load(f)
                activities = data.get('activities', [])
            except Exception as e:
                logging.error(f"Error reading activity log: {e}")
        
        # Deduplication logic: check for very similar recent activities
        current_time = datetime.now()
        duplicate_found = False
        
        for existing_activity in activities[-10:]:  # Check last 10 activities
            try:
                existing_time = datetime.fromisoformat(existing_activity.get('timestamp', ''))
                time_diff = (current_time - existing_time).total_seconds()
                
                # Check if this is a duplicate (same user, type, and item within 10 seconds)
                if (time_diff < 10 and  # Within 10 seconds
                    existing_activity.get('user_email') == user_email and
                    existing_activity.get('activity_type') == activity_type):
                    
                    # For shopping/pantry items, check item name
                    existing_item = existing_activity.get('activity_data', {}).get('item_name') or existing_activity.get('activity_data', {}).get('item_added', {}).get('name')
                    current_item = activity_data.get('item_name') if activity_data else None
                    if not current_item:
                        current_item = activity_data.get('item_added', {}).get('name') if activity_data else None
                    
                    if existing_item and current_item and existing_item.lower() == current_item.lower():
                        duplicate_found = True
                        logging.info(f"Duplicate activity detected and skipped: {activity_type} for {current_item}")
                        break
                        
            except Exception as e:
                logging.error(f"Error checking for duplicates: {e}")
                continue
        
        # Only add if not a duplicate
        if not duplicate_found:
            activities.append(activity)
            
            # Keep only last 100 activities
            if len(activities) > 100:
                activities = activities[-100:]
            
            # Write back to file with file locking
            import fcntl
            try:
                with open(log_file, 'w') as f:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                    json.dump({
                        "activities": activities,
                        "last_updated": datetime.now().isoformat()
                    }, f, indent=2)
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                
                logging.info(f"Activity logged: {activity_type} for {user_email}")
            except Exception as e:
                logging.error(f"Error writing activity log: {e}")
        else:
            logging.info(f"Skipped duplicate activity: {activity_type} for {user_email}")
            
    except Exception as e:
        logging.error(f"Error in log_user_activity: {e}")

logging.info(f"Current working directory: {os.getcwd()}")
logging.info(f"DB_FILE_PATH: {DB_FILE_PATH}")
logging.info(f"PROFILE_FILE_PATH: {PROFILE_FILE_PATH}")

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

        # Create pantry_requests.json if it doesn't exist
        if not os.path.exists(PANTRY_REQUESTS_FILE):
            logging.info(f"Creating new pantry_requests.json at {PANTRY_REQUESTS_FILE}")
            with open(PANTRY_REQUESTS_FILE, 'w') as f:
                json.dump({"requests": []}, f, indent=2)
        
        # Create pantry_owners.json if it doesn't exist
        if not os.path.exists(PANTRY_OWNERS_FILE):
            logging.info(f"Creating new pantry_owners.json at {PANTRY_OWNERS_FILE}")
            with open(PANTRY_OWNERS_FILE, 'w') as f:
                json.dump({"owners": {}}, f, indent=2)

        # Read and log contents of db.json
        with open(DB_FILE_PATH, 'r') as f:
            db_data = json.load(f)
            logging.info(f"Current db.json contents: {json.dumps(db_data, indent=2)}")

        return True
    except Exception as e:
        logging.error(f"Error initializing database: {e}")
        logging.error("Exception traceback:", exc_info=True)
        return False

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
                            logging.info(f"Using user's pantry '{pantry_name}' for email {user_email}")
                        else:
                            logging.info(f"User {user_email} has no pantryName set, returning empty pantry")
                            return jsonify([])
                    else:
                        logging.info(f"User {user_email} not found in users.json")
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
                else:
                    pantry_items = []
                    logging.info(f"Pantry '{pantry_name}' not found, returning empty list")
            else:
                # Legacy flat format - return all items if requesting default, else empty
                if pantry_name == 'default':
                    pantry_items = pantry_data
                else:
                    pantry_items = []
                    
            logging.info(f"Read {len(pantry_items)} items from pantry '{pantry_name}'")
            logging.info(f"Pantry items: {pantry_items}")
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
        
        # Handle both old flat format and new multi-pantry format
        if isinstance(pantry_data, dict):
            # Multi-pantry format
            if pantry_name in pantry_data:
                original_count = len(pantry_data[pantry_name])
                pantry_data[pantry_name] = [item for item in pantry_data[pantry_name] if item.get('id') != item_id]
                item_found = len(pantry_data[pantry_name]) < original_count
            else:
                # Search all pantries if specific pantry not found
                for pname, pitems in pantry_data.items():
                    original_count = len(pitems)
                    pantry_data[pname] = [item for item in pitems if item.get('id') != item_id]
                    if len(pantry_data[pname]) < original_count:
                        item_found = True
                        break
        else:
            # Legacy flat format
            original_count = len(pantry_data)
            updated_pantry = [item for item in pantry_data if item.get('id') != item_id]
            item_found = len(updated_pantry) < original_count
            data['pantry'] = updated_pantry

        # Save the updated pantry data back to db.json
        with open(DB_FILE_PATH, 'w') as file:
            json.dump(data, file, indent=4)

        if item_found:
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
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

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
        "name": email.split('@')[0],
        "created_at": datetime.now().isoformat()
    }

    with open(USERS_FILE, 'w') as f:
        json.dump(users, f)

    # Return user data without password
    user_data = users[email].copy()
    del user_data['password']
    return jsonify(user_data), 201

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
                    if not any(s['name'].lower() == item.lower() for s in suggestions):
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
                    if not any(s['name'].lower() == item.lower() for s in suggestions):
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
                if not any(s['name'].lower() == item.lower() for s in suggestions):
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

        return jsonify({"suggestions": suggestions[:12]})  # Return top 12 suggestions
    except Exception as e:
        logging.error(f"Error generating shopping suggestions: {e}")
        return jsonify({"error": str(e)}), 500

def getCategoryForItem(item_name):
    """Helper function to categorize items"""
    categories = {
        'produce': ['tomatoes', 'onions', 'garlic', 'basil', 'cilantro', 'lime', 'lemons', 'avocados', 'sweet potatoes', 'broccoli', 'cauliflower', 'zucchini'],
        'dairy': ['milk', 'cheese', 'yogurt', 'butter', 'eggs', 'feta', 'parmigiano', 'gruyère', 'crème fraîche'],
        'proteins': ['tofu', 'tempeh', 'chickpeas', 'lentils', 'beef', 'salmon', 'pancetta', 'black beans'],
        'pantry': ['quinoa', 'rice', 'flour', 'oil', 'vinegar', 'soy sauce', 'spices', 'salt', 'pepper', 'cumin', 'turmeric'],
        'nuts_seeds': ['almonds', 'hemp seeds', 'pine nuts', 'pistachios'],
    }
    
    item_lower = item_name.lower()
    for category, items in categories.items():
        if any(ingredient in item_lower for ingredient in items):
            return category.replace('_', ' & ').title()
    
    return 'Other'

@app.route('/shopping/list', methods=['GET', 'POST', 'DELETE'])
def handle_shopping_list():
    try:
        # Get user email from header
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Load user data to get their pantry
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        if user_email not in users:
            return jsonify({"error": "User not found"}), 404

        # Get user's pantry name
        user_pantry_name = users[user_email].get('pantryName', 'default')
        if not user_pantry_name:
            user_pantry_name = 'default'

        # Load shopping lists data
        shopping_lists = {}
        if os.path.exists(SHOPPING_LIST_FILE):
            with open(SHOPPING_LIST_FILE, 'r') as f:
                shopping_lists = json.load(f)

        # Initialize pantry shopping list if not exists
        if user_pantry_name not in shopping_lists:
            shopping_lists[user_pantry_name] = []

        if request.method == 'GET':
            return jsonify({"items": shopping_lists[user_pantry_name]})

        if request.method == 'POST':
            item = request.json.get('item')
            if not item:
                return jsonify({"error": "Item data required"}), 400

            # Add metadata to item
            if 'id' not in item:
                item['id'] = str(int(datetime.now().timestamp() * 1000))  # Unique timestamp ID
            
            item['addedAt'] = datetime.now().isoformat()
            if 'completed' not in item:
                item['completed'] = False
            if 'priority' not in item:
                item['priority'] = 'medium'

            shopping_lists[user_pantry_name].append(item)

            # Save updated shopping lists data
            with open(SHOPPING_LIST_FILE, 'w') as f:
                json.dump(shopping_lists, f, indent=2)
                
            logging.info(f"Added item '{item['name']}' to shopping list for pantry {user_pantry_name} by user {user_email}")
            return jsonify({"message": "Item added to shopping list"})

        if request.method == 'DELETE':
            item_id = request.args.get('id')
            if not item_id:
                return jsonify({"error": "Item ID required"}), 400

            # Remove item from pantry shopping list
            original_count = len(shopping_lists[user_pantry_name])
            shopping_lists[user_pantry_name] = [
                item for item in shopping_lists[user_pantry_name] 
                if item['id'] != item_id
            ]
            
            if len(shopping_lists[user_pantry_name]) == original_count:
                return jsonify({"error": "Item not found"}), 404

            # Save updated shopping lists data
            with open(SHOPPING_LIST_FILE, 'w') as f:
                json.dump(shopping_lists, f, indent=2)
                
            logging.info(f"Removed item {item_id} from shopping list for pantry {user_pantry_name} by user {user_email}")
            return jsonify({"message": "Item removed from shopping list"})

    except Exception as e:
        logging.error(f"Error handling shopping list request: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/shopping/list/<item_id>', methods=['PUT'])
def update_shopping_item(item_id):
    """Update a shopping list item (mark as completed/purchased and add to pantry)"""
    try:
        # Get user email from header
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Load user data to get their pantry
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        if user_email not in users:
            return jsonify({"error": "User not found"}), 404

        # Get user's pantry name
        user_pantry_name = users[user_email].get('pantryName', 'default')
        if not user_pantry_name:
            user_pantry_name = 'default'

        # Load shopping lists data
        shopping_lists = {}
        if os.path.exists(SHOPPING_LIST_FILE):
            with open(SHOPPING_LIST_FILE, 'r') as f:
                shopping_lists = json.load(f)

        # Initialize pantry shopping list if not exists
        if user_pantry_name not in shopping_lists:
            shopping_lists[user_pantry_name] = []

        # Find the item in shopping list
        item_found = False
        updated_item = None
        for i, item in enumerate(shopping_lists[user_pantry_name]):
            if item['id'] == item_id:
                # Update the item with new data from request
                update_data = request.json
                shopping_lists[user_pantry_name][i].update(update_data)
                updated_item = shopping_lists[user_pantry_name][i]
                item_found = True
                break

        if not item_found:
            return jsonify({"error": "Item not found"}), 404

        # Save updated shopping lists data
        with open(SHOPPING_LIST_FILE, 'w') as f:
            json.dump(shopping_lists, f, indent=2)

        # If item is marked as completed/purchased, add it to pantry
        if updated_item and updated_item.get('completed', False) and updated_item.get('purchased', False):
            try:
                # Prepare pantry item data
                pantry_item = {
                    'name': updated_item['name'],
                    'category': updated_item.get('category', 'Other'),
                    'quantity': updated_item.get('quantity', 1),
                    'unit': updated_item.get('unit', ''),
                    'addedDate': datetime.now().isoformat(),
                    'expiryDate': updated_item.get('expiryDate', ''),
                    'addedBy': user_email,
                    'source': 'shopping_list'
                }

                # Add to pantry using existing pantry logic
                with open(DB_FILE_PATH, 'r+') as file:
                    data = json.load(file)
                    pantry_data = data.get('pantry', [])
                    
                    # Handle both old flat format and new multi-pantry format
                    if isinstance(pantry_data, dict):
                        # Multi-pantry format
                        if user_pantry_name not in pantry_data:
                            pantry_data[user_pantry_name] = []
                        pantry_data[user_pantry_name].append(pantry_item)
                    else:
                        # Legacy flat format - convert to multi-pantry format
                        if user_pantry_name == 'default':
                            # Add to existing flat structure
                            pantry_data.append(pantry_item)
                        else:
                            # Convert to multi-pantry format
                            new_pantry_data = {
                                'default': pantry_data,  # Keep existing items in default pantry
                                user_pantry_name: [pantry_item]  # Add new item to specified pantry
                            }
                            data['pantry'] = new_pantry_data
                    
                    # Update the data
                    if isinstance(data.get('pantry'), dict):
                        data['pantry'] = pantry_data
                    else:
                        data['pantry'] = pantry_data
                    
                    file.seek(0)
                    json.dump(data, file, indent=2)
                    file.truncate()

                logging.info(f"Added item '{updated_item['name']}' to pantry '{user_pantry_name}' from shopping list by user {user_email}")
                
            except Exception as e:
                logging.error(f"Error adding item to pantry: {e}")
                # Still return success for shopping list update, but log the pantry error

        logging.info(f"Updated shopping list item {item_id} for pantry {user_pantry_name} by user {user_email}")
        return jsonify({"message": "Item updated successfully", "item": updated_item})

    except Exception as e:
        logging.error(f"Error updating shopping list item: {e}")
        return jsonify({"error": str(e)}), 500

# Mock function to simulate fetching grocery stores
import openai

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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

from datetime import datetime, timedelta  # ✅ Make sure this is imported

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
                                "Return the response as a JSON array where each element is an object with `name`, `amount`, and `measurement` (use 'unit' if unknown).\n\n"
                                "Example: [\n"
                                "  {\"name\": \"banana\", \"amount\": 2, \"measurement\": \"unit\"},\n"
                                "  {\"name\": \"apple\", \"amount\": 3, \"measurement\": \"unit\"}\n"
                                "]"
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

        try:
            food_items = ast.literal_eval(raw_output)
        except Exception:
            # Fallback to JSON decode
            food_items = json.loads(raw_output)

        if not isinstance(food_items, list):
            raise ValueError("Expected a JSON array of food items")

        food_items = json.loads(raw_output)
        if not isinstance(food_items, list):
            raise ValueError("Expected a JSON array of food item names")

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
                target_pantry.append({
                    "id": str(uuid.uuid4()),
                    "name": food["name"].strip().capitalize(),
                    "amount": str(food["amount"]),
                    "measurement": food.get("measurement", "unit"),
                    "purchaseDate": now.isoformat(),
                    "expiryDate": (now + timedelta(days=30)).isoformat(),
                    "expired": "no"
                })

            file.seek(0)
            file.truncate()
            json.dump(data, file, indent=2)

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

        # Check if this is a new pantry (user is creating it)
        is_new_pantry = False
        if pantry_name:  # Only check if pantry_name is not empty
            # Check if pantry already exists
            pantry_exists = any(user_data.get('pantryName') == pantry_name for user_data in users.values())
            if not pantry_exists:
                is_new_pantry = True
                
                # Set user as pantry owner
                with open(PANTRY_OWNERS_FILE, 'r') as f:
                    owners_data = json.load(f)
                
                owners_data['owners'][pantry_name] = {
                    'email': email,
                    'name': users[email].get('name', email.split('@')[0]),
                    'created_at': datetime.now().isoformat()
                }
                
                with open(PANTRY_OWNERS_FILE, 'w') as f:
                    json.dump(owners_data, f, indent=2)
                
                logging.info(f"User {email} created new pantry '{pantry_name}' and is now the owner")

        # Update user's pantry name
        users[email]['pantryName'] = pantry_name
        
        # Save updated users data
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)

        message = "User pantry updated successfully"
        if is_new_pantry:
            message = f"New pantry '{pantry_name}' created successfully. You are now the owner."
        
        logging.info(f"Updated pantry for user {email} to '{pantry_name}' (new: {is_new_pantry})")
        return jsonify({"message": message, "isOwner": is_new_pantry}), 200

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

        # If user had a pantry, clean up their pantry data
        if pantry_name:
            try:
                with open(DB_FILE_PATH, 'r') as f:
                    db_data = json.load(f)
                
                # Remove user's pantry data
                if 'pantry' in db_data and pantry_name in db_data['pantry']:
                    del db_data['pantry'][pantry_name]
                    
                    with open(DB_FILE_PATH, 'w') as f:
                        json.dump(db_data, f, indent=2)
                    
                    logging.info(f"Removed pantry data for {pantry_name}")
            except Exception as pantry_error:
                logging.error(f"Error cleaning up pantry data: {pantry_error}")

        logging.info(f"Account deleted for user {email}")
        return jsonify({"message": "Account deleted successfully"}), 200

    except Exception as e:
        logging.error(f"Error deleting account: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/get-available-pantries', methods=['GET'])
def get_available_pantries():
    """Get list of available pantry names from users.json"""
    try:
        logging.info("Fetching available pantries from users.json")
        
        # Read users.json file
        if not os.path.exists(USERS_FILE):
            logging.warning("users.json file not found")
            return jsonify({"pantries": ["Sadri-FAM Pantry", "Family Pantry", "Office Pantry"]}), 200
        
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        # Extract unique pantry names from users
        pantry_names = set()
        for email, user_data in users.items():
            pantry_name = user_data.get('pantryName', '')
            if pantry_name and pantry_name.strip():
                pantry_names.add(pantry_name.strip())
        
        # Convert to sorted list
        available_pantries = sorted(list(pantry_names))
        
        # Add default options if no pantries found
        if not available_pantries:
            available_pantries = ["Sadri-FAM Pantry", "Family Pantry", "Office Pantry"]
        
        logging.info(f"Found {len(available_pantries)} available pantries: {available_pantries}")
        return jsonify({"pantries": available_pantries}), 200
    
    except Exception as e:
        logging.error(f"Error fetching available pantries: {e}")
        return jsonify({"error": "Failed to fetch available pantries", "pantries": ["Sadri-FAM Pantry", "Family Pantry", "Office Pantry"]}), 500

@app.route('/request-pantry-join', methods=['POST'])
def request_pantry_join():
    """Submit a request to join an existing pantry"""
    try:
        data = request.json
        requester_email = data.get('email')
        pantry_name = data.get('pantryName')
        requester_name = data.get('name', '')

        if not requester_email or not pantry_name:
            return jsonify({"error": "Email and pantryName are required"}), 400

        # Check if user already has a pantry
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if requester_email not in users:
            return jsonify({"error": "User not found"}), 404

        # Check if user is the owner of this pantry FIRST (before checking if they're already in a pantry)
        try:
            with open(PANTRY_OWNERS_FILE, 'r') as f:
                owners_data = json.load(f)
            
            if pantry_name in owners_data.get('owners', {}):
                owner_email = owners_data['owners'][pantry_name]['email']
                if owner_email == requester_email:
                    # User is the owner, add them directly to the pantry (regardless of current pantry status)
                    users[requester_email]['pantryName'] = pantry_name
                    users[requester_email]['joinedPantryAt'] = datetime.now().isoformat()
                    
                    with open(USERS_FILE, 'w') as f:
                        json.dump(users, f, indent=2)
                    
                    return jsonify({
                        "message": f"Welcome back to your pantry '{pantry_name}'! You are the owner.",
                        "isOwner": True
                    }), 200
        except Exception as e:
            logging.error(f"Error checking pantry ownership: {e}")

        # Only check if user already has a pantry if they're NOT the owner of the requested pantry
        if users[requester_email].get('pantryName'):
            return jsonify({"error": "You are already in a pantry. Leave your current pantry first."}), 400

        # Check if pantry exists and get existing members
        pantry_members = []
        for email, user_data in users.items():
            if user_data.get('pantryName') == pantry_name:
                pantry_members.append({
                    'email': email,
                    'name': user_data.get('name', email.split('@')[0])
                })

        if not pantry_members:
            return jsonify({"error": "Pantry not found"}), 404

        # Load existing requests
        with open(PANTRY_REQUESTS_FILE, 'r') as f:
            requests_data = json.load(f)

        # Check if request already exists
        existing_request = next(
            (req for req in requests_data['requests'] 
             if req['requesterEmail'] == requester_email and req['pantryName'] == pantry_name and req['status'] == 'pending'),
            None
        )

        if existing_request:
            return jsonify({"error": "You already have a pending request for this pantry"}), 400

        # Create new request
        new_request = {
            "id": str(uuid.uuid4()),
            "requesterEmail": requester_email,
            "requesterName": requester_name,
            "pantryName": pantry_name,
            "pantryMembers": pantry_members,
            "status": "pending",
            "requestedAt": datetime.now().isoformat(),
            "approvals": [],
            "rejections": []
        }

        requests_data['requests'].append(new_request)

        # Save updated requests
        with open(PANTRY_REQUESTS_FILE, 'w') as f:
            json.dump(requests_data, f, indent=2)

        logging.info(f"Pantry join request created: {requester_email} -> {pantry_name}")
        return jsonify({
            "message": "Join request submitted successfully. Waiting for approval from pantry members.",
            "requestId": new_request["id"]
        }), 200

    except Exception as e:
        logging.error(f"Error creating pantry join request: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-pantry-requests', methods=['GET'])
def get_pantry_requests():
    """Get pending requests for pantries that the user is a member of"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Get user's pantry
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if user_email not in users:
            return jsonify({"error": "User not found"}), 404

        user_pantry = users[user_email].get('pantryName')
        if not user_pantry:
            return jsonify({"requests": []}), 200

        # Load requests
        with open(PANTRY_REQUESTS_FILE, 'r') as f:
            requests_data = json.load(f)

        # Load pantry ownership data
        with open(PANTRY_OWNERS_FILE, 'r') as f:
            owners_data = json.load(f)
        
        # Filter requests for pantries where the user is an owner and requests are still pending
        relevant_requests = []
        for req in requests_data['requests']:
            # Check if user is owner of the pantry being requested
            pantry_owner = owners_data.get('owners', {}).get(req['pantryName'], {})
            is_owner = pantry_owner.get('email') == user_email
            
            if (is_owner and 
                req['status'] == 'pending' and 
                req['requesterEmail'] != user_email):
                
                # Check if this user has already responded
                user_already_responded = (
                    any(approval['email'] == user_email for approval in req.get('approvals', [])) or
                    any(rejection['email'] == user_email for rejection in req.get('rejections', []))
                )
                
                if not user_already_responded:
                    relevant_requests.append(req)

        return jsonify({"requests": relevant_requests}), 200

    except Exception as e:
        logging.error(f"Error getting pantry requests: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/respond-pantry-request', methods=['POST'])
def respond_pantry_request():
    """Approve or reject a pantry join request"""
    try:
        data = request.json
        request_id = data.get('requestId')
        action = data.get('action')  # 'approve' or 'reject'
        responder_email = data.get('email')

        if not all([request_id, action, responder_email]):
            return jsonify({"error": "requestId, action, and email are required"}), 400

        if action not in ['approve', 'reject']:
            return jsonify({"error": "Action must be 'approve' or 'reject'"}), 400

        # Load requests
        with open(PANTRY_REQUESTS_FILE, 'r') as f:
            requests_data = json.load(f)

        # Find the request
        request_index = next(
            (i for i, req in enumerate(requests_data['requests']) if req['id'] == request_id),
            None
        )

        if request_index is None:
            return jsonify({"error": "Request not found"}), 404

        current_request = requests_data['requests'][request_index]

        if current_request['status'] != 'pending':
            return jsonify({"error": "Request is no longer pending"}), 400

        # Verify responder is a member of the pantry
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        responder_pantry = users.get(responder_email, {}).get('pantryName')
        if responder_pantry != current_request['pantryName']:
            return jsonify({"error": "You are not a member of this pantry"}), 403

        # Add response
        response_data = {
            "email": responder_email,
            "name": users[responder_email].get('name', responder_email.split('@')[0]),
            "respondedAt": datetime.now().isoformat()
        }

        # Ensure approvals and rejections arrays exist
        if 'approvals' not in current_request:
            current_request['approvals'] = []
        if 'rejections' not in current_request:
            current_request['rejections'] = []

        if action == 'approve':
            current_request['approvals'].append(response_data)
        else:
            current_request['rejections'].append(response_data)

        # Check if we have enough responses to make a decision
        total_members = len(current_request['pantryMembers'])
        approvals_count = len(current_request['approvals'])
        rejections_count = len(current_request['rejections'])

        # Check if the responder is the pantry owner (immediate approval)
        with open(PANTRY_OWNERS_FILE, 'r') as f:
            owners_data = json.load(f)
        
        pantry_owner = owners_data.get('owners', {}).get(current_request['pantryName'], {})
        is_owner_approval = pantry_owner.get('email') == responder_email

        # If majority approves, anyone rejects, or owner approves, finalize the request
        if rejections_count > 0:
            # Any rejection = final rejection
            current_request['status'] = 'rejected'
            current_request['finalizedAt'] = datetime.now().isoformat()
        elif is_owner_approval or approvals_count >= (total_members // 2 + 1):
            # Owner approval or majority approval = acceptance
            current_request['status'] = 'approved'
            current_request['finalizedAt'] = datetime.now().isoformat()
            
            # Add user to pantry
            requester_email = current_request['requesterEmail']
            if requester_email in users:
                users[requester_email]['pantryName'] = current_request['pantryName']
                users[requester_email]['joinedPantryAt'] = datetime.now().isoformat()
                
                # Save updated users
                with open(USERS_FILE, 'w') as f:
                    json.dump(users, f, indent=2)

        # Save updated requests
        with open(PANTRY_REQUESTS_FILE, 'w') as f:
            json.dump(requests_data, f, indent=2)

        result_message = f"Request {action}ed successfully"
        if current_request['status'] == 'approved':
            result_message += f". {current_request['requesterName']} has been added to the pantry!"
        elif current_request['status'] == 'rejected':
            result_message += f". Request has been rejected."

        logging.info(f"Pantry request response: {responder_email} {action}ed request {request_id}")
        return jsonify({
            "message": result_message,
            "status": current_request['status']
        }), 200

    except Exception as e:
        logging.error(f"Error responding to pantry request: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-user-requests', methods=['GET'])
def get_user_requests():
    """Get all requests made by the current user"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Load requests
        with open(PANTRY_REQUESTS_FILE, 'r') as f:
            requests_data = json.load(f)

        # Filter requests made by this user
        user_requests = [
            req for req in requests_data['requests'] 
            if req['requesterEmail'] == user_email
        ]

        return jsonify({"requests": user_requests}), 200

    except Exception as e:
        logging.error(f"Error getting user requests: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-pantry-ownership', methods=['GET'])
def get_pantry_ownership():
    """Get ownership information for all pantries"""
    try:
        with open(PANTRY_OWNERS_FILE, 'r') as f:
            owners_data = json.load(f)
        
        return jsonify(owners_data), 200
    except Exception as e:
        logging.error(f"Error getting pantry ownership: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/set-pantry-owner', methods=['POST'])
def set_pantry_owner():
    """Manually set or update pantry owner (for existing pantries)"""
    try:
        data = request.json
        pantry_name = data.get('pantryName')
        owner_email = data.get('ownerEmail')
        
        if not pantry_name or not owner_email:
            return jsonify({"error": "pantryName and ownerEmail are required"}), 400
        
        # Verify the owner exists and is in the pantry
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        if owner_email not in users:
            return jsonify({"error": "Owner user not found"}), 404
        
        if users[owner_email].get('pantryName') != pantry_name:
            return jsonify({"error": "User is not a member of this pantry"}), 400
        
        # Set ownership
        with open(PANTRY_OWNERS_FILE, 'r') as f:
            owners_data = json.load(f)
        
        owners_data['owners'][pantry_name] = {
            'email': owner_email,
            'name': users[owner_email].get('name', owner_email.split('@')[0]),
            'created_at': datetime.now().isoformat()
        }
        
        with open(PANTRY_OWNERS_FILE, 'w') as f:
            json.dump(owners_data, f, indent=2)
        
        logging.info(f"Set {owner_email} as owner of pantry '{pantry_name}'")
        return jsonify({"message": f"Successfully set {owner_email} as owner of '{pantry_name}'"}), 200
        
    except Exception as e:
        logging.error(f"Error setting pantry owner: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-recipe-logs', methods=['GET'])
def get_recipe_logs():
    """Get recipe logs for the user"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Load users data to get saved recipes
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if user_email not in users:
            return jsonify({"recipes": []}), 200

        # Get saved recipes from user data
        saved_recipes = users[user_email].get('savedRecipes', [])
        
        # Format as recipe logs
        recipe_logs = []
        for recipe in saved_recipes:
            recipe_logs.append({
                "id": recipe.get('id', str(uuid.uuid4())),
                "name": recipe.get('name', 'Unknown Recipe'),
                "loggedAt": recipe.get('savedAt', datetime.now().isoformat()),
                "ingredients": recipe.get('ingredients', []),
                "cookingTime": recipe.get('cookingTime', 'Unknown'),
                "calories": recipe.get('calories', 'Unknown')
            })

        logging.info(f"Returning {len(recipe_logs)} recipe logs for user {user_email}")
        return jsonify({"recipes": recipe_logs}), 200

    except Exception as e:
        logging.error(f"Error getting recipe logs: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/pantry-suggestions', methods=['GET', 'POST', 'DELETE'])
def manage_pantry_suggestions():
    """Manage pantry suggestions"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        if request.method == 'GET':
            # Return basic pantry suggestions in the format the frontend expects
            suggestions = []
            
            # Proteins
            protein_items = ["Chicken breast", "Salmon", "Eggs", "Greek yogurt"]
            for i, item in enumerate(protein_items):
                suggestions.append({
                    "id": f"protein_{i+1}",
                    "name": item,
                    "priority": "high" if i < 2 else "medium",
                    "reason": "Essential protein source",
                    "category": "Proteins"
                })
            
            # Vegetables  
            vegetable_items = ["Broccoli", "Spinach", "Bell peppers", "Onions"]
            for i, item in enumerate(vegetable_items):
                suggestions.append({
                    "id": f"vegetable_{i+1}",
                    "name": item,
                    "priority": "medium",
                    "reason": "Fresh vegetables",
                    "category": "Vegetables"
                })
            
            # Pantry Staples
            staple_items = ["Rice", "Pasta", "Olive oil", "Garlic"]
            for i, item in enumerate(staple_items):
                suggestions.append({
                    "id": f"staple_{i+1}",
                    "name": item,
                    "priority": "high" if item in ["Olive oil", "Garlic"] else "medium",
                    "reason": "Pantry essential",
                    "category": "Pantry Staples"
                })
            
            return jsonify({"suggestions": suggestions}), 200

        elif request.method == 'POST':
            # Handle different POST request types
            data = request.json or {}
            
            # Handle suggestions array (from ShopScreen)
            if 'suggestions' in data:
                suggestions = data.get('suggestions', [])
                logging.info(f"Received {len(suggestions)} suggestions to save/update")
                return jsonify({"message": "Suggestions saved successfully"}), 200
            
            # Handle action-based requests
            action = data.get('action')
            if action == 'add_suggestion':
                # Add suggested item to pantry
                item_name = data.get('itemName')
                if not item_name:
                    return jsonify({"error": "Item name required"}), 400

                # Get user's pantry name
                with open(USERS_FILE, 'r') as f:
                    users = json.load(f)
                
                user_pantry_name = users.get(user_email, {}).get('pantryName', 'default')
                
                # Add item to pantry
                new_item = {
                    "id": str(uuid.uuid4()),
                    "name": item_name,
                    "amount": "1",
                    "measurement": "unit",
                    "expiryDate": (datetime.now() + timedelta(days=30)).isoformat(),
                    "addedFrom": "suggestion"
                }

                with open(DB_FILE_PATH, 'r+') as file:
                    db_data = json.load(file)
                    pantry_data = db_data.get('pantry', {})
                    
                    if isinstance(pantry_data, dict):
                        if user_pantry_name not in pantry_data:
                            pantry_data[user_pantry_name] = []
                        pantry_data[user_pantry_name].append(new_item)
                    else:
                        # Legacy format
                        pantry_data.append(new_item)
                        db_data['pantry'] = pantry_data

                    file.seek(0)
                    file.truncate()
                    json.dump(db_data, file, indent=2)

                return jsonify({"message": f"Added {item_name} to pantry"}), 200
            
            # Default response for unrecognized POST data
            return jsonify({"message": "Request processed successfully"}), 200

        elif request.method == 'DELETE':
            # Handle suggestion deletion
            data = request.json or {}
            suggestion_id = data.get('suggestionId')
            logging.info(f"Received request to delete suggestion: {suggestion_id}")
            return jsonify({"message": "Suggestion removed successfully"}), 200

    except Exception as e:
        logging.error(f"Error managing pantry suggestions: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-users', methods=['GET'])
def get_users():
    """Get all users for pantry member display"""
    try:
        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        # Return full user data for pantry member display
        user_count = len(users)
        logging.info(f"Returning {user_count} users for pantry member display")
        
        return jsonify({"userCount": user_count, "users": users}), 200

    except Exception as e:
        logging.error(f"Error getting users: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-profile-image', methods=['POST'])
def get_profile_image():
    """Get user's profile image"""
    try:
        data = request.json
        email = data.get('email')
        
        if not email:
            return jsonify({"error": "Email required"}), 400
        
        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
        
        if email not in users:
            return jsonify({"error": "User not found"}), 404
        
        profile_image = users[email].get('profileImage')
        
        return jsonify({"profileImage": profile_image}), 200
        
    except Exception as e:
        logging.error(f"Error getting profile image: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/pantry-activity-logs', methods=['GET'])
def get_pantry_activity_logs():
    """Get pantry activity logs for the user"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Generate sample activity logs
        activities = [
            {
                "id": "1",
                "action": "added",
                "item": "Rice",
                "timestamp": datetime.now().isoformat(),
                "user": user_email.split('@')[0]
            },
            {
                "id": "2", 
                "action": "removed",
                "item": "Expired milk",
                "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
                "user": user_email.split('@')[0]
            }
        ]

        logging.info(f"Activity logged: pantry_view for {user_email}")
        return jsonify({"activities": activities}), 200

    except Exception as e:
        logging.error(f"Error getting pantry activity logs: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/shopping-activity-logs', methods=['GET'])
def get_shopping_activity_logs():
    """Get shopping activity logs for the user"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Generate sample shopping activity logs
        activities = [
            {
                "id": "1",
                "action": "added_to_list", 
                "item": "Chicken breast",
                "timestamp": datetime.now().isoformat(),
                "user": user_email.split('@')[0]
            },
            {
                "id": "2",
                "action": "purchased",
                "item": "Broccoli", 
                "timestamp": (datetime.now() - timedelta(hours=1)).isoformat(),
                "user": user_email.split('@')[0]
            }
        ]

        return jsonify({"activities": activities}), 200

    except Exception as e:
        logging.error(f"Error getting shopping activity logs: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logging.info("Registered Flask routes:")
    for rule in app.url_map.iter_rules():
        logging.info(f"Route: {rule} -> {rule.endpoint}")
    app.run(host='0.0.0.0', port=5001, debug=True)