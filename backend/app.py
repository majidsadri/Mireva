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
from datetime import datetime
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import requests
from math import radians, sin, cos, sqrt, atan2
import ast
import re
import time
from flask import send_file



client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.INFO)

# File paths - use parent directory for db.json and profile.json
DB_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'db.json'))
PROFILE_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'profile.json'))
USERS_FILE = os.path.join(os.path.dirname(__file__), '..', 'users.json')

# Store data file
STORES_FILE = os.path.join(os.path.dirname(__file__), '..', 'stores.json')
SHOPPING_LIST_FILE = os.path.join(os.path.dirname(__file__), '..', 'shopping_list.json')

logging.info(f"Current working directory: {os.getcwd()}")
logging.info(f"DB_FILE_PATH: {DB_FILE_PATH}")
logging.info(f"PROFILE_FILE_PATH: {PROFILE_FILE_PATH}")

def init_db():
    try:
        # Create db.json if it doesn't exist
        if not os.path.exists(DB_FILE_PATH):
            logging.info(f"Creating new db.json at {DB_FILE_PATH}")
            with open(DB_FILE_PATH, 'w') as f:
                json.dump({"pantry": []}, f, indent=2)

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

@app.route('/users.json', methods=['GET', 'PUT'])
def serve_users_json():
    if request.method == 'GET':
        return send_file(USERS_FILE, mimetype='application/json')  # ✅ use variable

    elif request.method == 'PUT':
        data = request.get_json()
        with open(USERS_FILE, 'w') as f:  # ✅ use variable
            json.dump(data, f, indent=2)
        return jsonify({'status': 'updated'})


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
        with open(DB_FILE_PATH, 'r') as f:
            data = json.load(f)
            pantry_items = data.get('pantry', [])
            logging.info(f"Read {len(pantry_items)} items from db.json")
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
    user_email = (request.headers.get('X-User-Email') or '').lower().strip()
    if not user_email:
        return jsonify({"error": "User email is required in headers"}), 400

    try:
        with open(DB_FILE_PATH, 'r+') as file:
            data = json.load(file)
            data.setdefault("pantry", {}).setdefault(user_email, [])

            if request.method == 'GET':
                return jsonify(data["pantry"][user_email])

            elif request.method == 'POST':
                new_item = request.json
                data["pantry"][user_email].append(new_item)
                file.seek(0)
                file.truncate()
                json.dump(data, file, indent=2)
                return jsonify({"message": "Item added successfully"}), 201

    except Exception as e:
        logging.exception("Error handling pantry")
        return jsonify({"error": str(e)}), 500

@app.route('/pantry/<item_id>', methods=['DELETE'])
def delete_pantry_item(item_id):
    user_email = (request.headers.get('X-User-Email') or '').lower().strip()
    if not user_email:
        return jsonify({"error": "User email is required in headers"}), 400

    try:
        with open(DB_FILE_PATH, 'r+') as file:
            data = json.load(file)
            pantry = data.get("pantry", {}).get(user_email, [])
            updated = [item for item in pantry if item.get("id") != item_id]

            data["pantry"][user_email] = updated
            file.seek(0)
            file.truncate()
            json.dump(data, file, indent=2)

        return jsonify({"message": "Item deleted"}), 200
    except Exception as e:
        logging.exception("Error deleting item")
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
            with open(DB_FILE_PATH, 'r+') as file:
                data = json.load(file)
                pantry = data.get('pantry', [])
                for item in extracted_items:
                    expiry_date = get_expiry_date(item["name"])
                    pantry.append({
                        "id": str(uuid.uuid4()),
                        "name": item["name"],
                        "amount": item.get("amount", ""),
                        "measurement": item.get("measurement", "unit"),
                        "expiryDate": expiry_date.isoformat()
                    })
                file.seek(0)
                json.dump(data, file, indent=4)
            logging.info(f"Added items to pantry: {extracted_items}")
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
# Endpoint to generate recipe suggestions based on the user's pantry and preferences
@app.route('/recommend', methods=['POST'])
def recommend_recipes():
    try:
        logging.info("Received request to /recommend endpoint")

        if not request.is_json:
            logging.error("Request does not contain JSON data")
            return jsonify({"error": "Request must be JSON"}), 400

        data = request.json
        ingredients = data.get('ingredients', [])

        if not ingredients:
            logging.warning("No ingredients provided.")
            return jsonify({"error": "No ingredients provided"}), 400
        
        user_email = request.headers.get("X-User-Email", "").strip().lower()
        if not user_email:
            return jsonify({"error": "Missing X-User-Email header"}), 400

        # Load user preferences
        dietary_preferences, favorite_cuisines = [], []
        try:
            with open(USERS_FILE, 'r') as f:
                users_data = json.load(f)
                user_profile = users_data.get(user_email, {})
                dietary_preferences = user_profile.get('diets', [])
                favorite_cuisines = user_profile.get('cuisines', [])
        except Exception as e:
            logging.warning(f"Could not load user preferences from USERS_FILE: {e}")
         
        ingredients_list = ", ".join(ingredients)
        diets_list = ", ".join(dietary_preferences) if dietary_preferences else "no specific dietary restrictions"
        cuisines_list = ", ".join(favorite_cuisines) if favorite_cuisines else "any cuisine"

        if any(c.lower() == "persian" for c in favorite_cuisines):
            prompt = f"""
            Given these ingredients: {ingredients_list}, recommend exactly 3 authentic Persian recipes. 
            Each recipe must be a well-known Persian dish, realistically cookable using the provided ingredients as key ingredients. 

            ONLY use widely recognized Persian dishes (e.g., Ghormeh Sabzi, Gheymeh, Zereshk Polo, Kuku Sabzi, Ash Reshteh, Mirza Ghasemi, Salad Shirazi, Fesenjan, Sholeh Zard, Tahchin, etc.).

            If provided ingredients don't exactly match a known Persian dish, suggest realistic substitutions clearly.

            Provide exactly this JSON format without additional text:

            {{
                "recipes": [
                    {{
                        "name": "Persian Dish Name (in English)",
                        "persianName": "Original Persian name in Farsi script",
                        "description": "Brief authentic description of this Persian dish",
                        "cookingTime": "X minutes",
                        "calories": "X calories per serving",
                        "cuisine": "Persian",
                        "dietaryInfo": ["Example: Vegetarian"],
                        "ingredients": ["ingredient1", "ingredient2"],
                        "instructions": "Step-by-step authentic preparation method"
                    }}
                ]
            }}
            """
        else:
            # Use your generic non-Persian prompt here
            prompt = f"""
            Given these ingredients: {ingredients_list}, suggest exactly 3 recipes matching:
            - Dietary preferences: {diets_list}
            - Preferred cuisines: {cuisines_list}

            Provide exactly this JSON format without additional text:

            {{
                "recipes": [
                    {{
                        "name": "Recipe Name",
                        "description": "Brief description",
                        "cookingTime": "X minutes",
                        "calories": "X calories per serving",
                        "cuisine": "Type of cuisine",
                        "dietaryInfo": ["Vegan", "Gluten-Free"],
                        "ingredients": ["ingredient1", "ingredient2"],
                        "instructions": "Step-by-step instructions"
                    }}
                ]
            }}
            """

        client = openai.OpenAI()
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You provide detailed recipes based on ingredients and preferences strictly in JSON format."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )

        recipe_suggestions = response.choices[0].message.content

        # Parse the response
        recipes_json = json.loads(recipe_suggestions)

        # Translate recipe fields into Persian if needed
        if any(c.lower() == "persian" for c in favorite_cuisines):
            for recipe in recipes_json.get("recipes", []):
                recipe["name"] = translate_to_persian(recipe["name"])
                recipe["description"] = translate_to_persian(recipe["description"])
                recipe["instructions"] = translate_to_persian(recipe["instructions"])
                recipe["ingredients"] = [translate_to_persian(ing) for ing in recipe["ingredients"]]
                recipe["dietaryInfo"] = [translate_to_persian(info) for info in recipe["dietaryInfo"]]
                recipe["cuisine"] = translate_to_persian(recipe["cuisine"])

        return jsonify(recipes_json), 200

    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse OpenAI response as JSON: {e}")
        return jsonify({"error": "Failed to generate recipe suggestions"}), 500
    except Exception as e:
        logging.error(f"Error generating recipe suggestions: {e}")
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
            with open(USERS_FILE, 'w') as f:
                json.dump({}, f)

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
        # Load pantry items
        with open(DB_FILE_PATH, 'r') as f:
            pantry_data = json.load(f)

        # Load profile preferences
        with open(PROFILE_FILE_PATH, 'r') as f:
            profile_data = json.load(f)

        # Generate suggestions based on:
        # 1. Low quantity items in pantry
        # 2. Items about to expire
        # 3. Common items for user's diet preferences
        # 4. Regular purchases (would come from purchase history in a real app)

        suggestions = []

        # Check low quantity items
        for item in pantry_data:
            if float(item.get('amount', 0)) < 2:  # Example threshold
                suggestions.append({
                    "id": f"sugg_{len(suggestions)+1}",
                    "name": item['name'],
                    "reason": "Running low"
                })

        # Add diet-specific suggestions
        diet_suggestions = {
            "Vegetarian": ["Tofu", "Tempeh", "Seitan"],
            "Vegan": ["Nutritional Yeast", "Plant-based Milk", "Chickpeas"],
            "Keto": ["Avocados", "Eggs", "Cheese"],
            "Paleo": ["Sweet Potatoes", "Nuts", "Grass-fed Meat"],
        }

        for diet in profile_data.get('diets', []):
            if diet in diet_suggestions:
                for item in diet_suggestions[diet]:
                    if not any(s['name'] == item for s in suggestions):
                        suggestions.append({
                            "id": f"sugg_{len(suggestions)+1}",
                            "name": item,
                            "reason": f"Recommended for {diet} diet"
                        })

        return jsonify({"suggestions": suggestions[:10]})  # Limit to 10 suggestions
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/shopping/list', methods=['GET', 'POST', 'DELETE'])
def handle_shopping_list():
    try:
        with open(SHOPPING_LIST_FILE, 'r') as f:
            data = json.load(f)
    except:
        data = {"items": []}

    if request.method == 'GET':
        return jsonify({"items": data["items"]})

    if request.method == 'POST':
        item = request.json.get('item')
        if not item:
            return jsonify({"error": "Item data required"}), 400

        # Add ID if not present
        if 'id' not in item:
            item['id'] = str(len(data["items"]) + 1)

        data["items"].append(item)

        with open(SHOPPING_LIST_FILE, 'w') as f:
            json.dump(data, f)
        return jsonify({"message": "Item added to shopping list"})

    if request.method == 'DELETE':
        item_id = request.args.get('id')
        if not item_id:
            return jsonify({"error": "Item ID required"}), 400

        data["items"] = [item for item in data["items"] if item['id'] != item_id]

        with open(SHOPPING_LIST_FILE, 'w') as f:
            json.dump(data, f)
        return jsonify({"message": "Item removed from shopping list"})

# Mock function to simulate fetching grocery stores

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

        user_email = (request.headers.get('X-User-Email') or '').lower().strip()

        # Convert image to base64
        with open(file_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')

        logging.info("📷 Sending image to GPT-4 Vision...")


        response = client.chat.completions.create(
            model="gpt-4-vision-preview",  # If available; else fallback to gpt-4-turbo
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "You are a food recognition assistant.\n"
                                "Based on the image, extract **all pantry food items** — fruits, vegetables, spices, canned goods, snacks, and brand-name packages.\n\n"
                                "**For each item**, include:\n"
                                "- `name`: the general name (e.g. apple, granola bar)\n"
                                "- `brand`: the brand (if visible), else `null`\n"
                                "- `amount`: a count for whole items (like apples), or estimated weight (grams) for bulk (like nuts)\n"
                                "- `measurement`: 'unit' for countable items, or 'g' for weight\n\n"
                                "**Return JSON array only**. Example:\n"
                                "[\n"
                                "  {\"name\": \"banana\", \"brand\": null, \"amount\": 2, \"measurement\": \"unit\"},\n"
                                "  {\"name\": \"granola bar\", \"brand\": \"Nature Valley\", \"amount\": 1, \"measurement\": \"unit\"},\n"
                                "  {\"name\": \"almond\", \"brand\": null, \"amount\": 100, \"measurement\": \"g\"}\n"
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
            max_tokens=500  # Increased to support more items/brands
        )


        raw_output = response.choices[0].message.content.strip()
        logging.info(f"🧠 GPT Raw Output: {raw_output}")

        # Remove ```json and ``` markers
        if raw_output.startswith("```"):
            raw_output = raw_output.replace("```json", "").replace("```", "").strip()

        # Attempt to clean up common GPT JSON issues (like trailing commas or incomplete entries)
        raw_output = re.sub(r',\s*([\]}])', r'\1', raw_output)  # Remove trailing commas before lists/objects
        raw_output = raw_output.rstrip(',')  # Remove any trailing comma
        raw_output = re.sub(r'\{[^\}]*$', '', raw_output)  # Remove last incomplete item

        # Ensure array is closed
        if raw_output.count('[') > raw_output.count(']'):
            raw_output += ']'

        # Try JSON parsing first
        try:
            food_items = json.loads(raw_output)
        except json.JSONDecodeError as e:
            logging.warning(f"⚠️ JSON decode failed: {e}. Trying ast.literal_eval as fallback...")
            try:
                food_items = ast.literal_eval(raw_output)
            except Exception as e2:
                logging.error(f"❌ Failed to parse GPT output with ast: {e2}")
                raise ValueError("Unable to parse food items from GPT output")

        # Validate format
        if not isinstance(food_items, list):
            raise ValueError("Parsed food items should be a list")

        logging.info(f"✅ Parsed food items: {food_items}")


        now = datetime.now()
        with open(DB_FILE_PATH, 'r+') as file:
            data = json.load(file)

            if "pantry" not in data:
                data["pantry"] = {}

            if not user_email:
                raise ValueError("User email is required in headers")
            if user_email not in data["pantry"] or not isinstance(data["pantry"][user_email], list):
                data["pantry"][user_email] = []

            pantry = data["pantry"][user_email]

            for item in food_items:
                expiry_date = get_expiry_date(item["name"])
                pantry.append({
                    "id": str(uuid.uuid4()),
                    "name": item["name"],
                    "amount": item.get("amount", ""),
                    "measurement": item.get("measurement", "unit"),
                    "expiryDate": expiry_date.isoformat()
                })

            file.seek(0)
            file.truncate()
            json.dump(data, file, indent=2)

        return jsonify({"message": "Items added successfully"}), 201

    except Exception as e:
        logging.exception("🔥 Error in GPT-4 Vision scan-and-add")
        return jsonify({"error": str(e)}), 500

def get_expiry_date(item_name):
    name = item_name.lower()
    now = datetime.utcnow()

    if any(x in name for x in ['milk', 'cheese', 'yogurt', 'cream']):  # Dairy
        return now + timedelta(days=10)
    elif any(x in name for x in ['apple', 'banana', 'orange', 'grape', 'fruit']):  # Fruits
        return now + timedelta(weeks=2)
    elif any(x in name for x in ['dressing', 'sauce', 'ketchup', 'mustard', 'mayo']):  # Condiments
        return now + timedelta(weeks=8)
    elif any(x in name for x in ['flour', 'sugar', 'rice', 'pasta', 'grain']):  # Dry Goods
        return now + timedelta(weeks=52)
    else:  # Default fallback: 3 weeks
        return now + timedelta(weeks=3)

@app.route('/recommend-store-ai', methods=['POST'])
def recommend_store_ai():
    try:
        data = request.json
        zip_code = data.get("zip_code")
        pantry_items = data.get("pantry_items", [])
        user_lat = data.get("latitude")
        user_lon = data.get("longitude")

        if not zip_code or not pantry_items:
            return jsonify({"error": "zip_code and pantry_items are required"}), 400

        if user_lat is None or user_lon is None:
            return jsonify({"error": "User latitude and longitude are required"}), 400

        # Load sample stores
        with open(STORES_FILE, 'r') as f:
            store_data = json.load(f)

        stores = store_data.get("stores", [])
        nearby_stores = [
            {
                **store,
                "distance": calculate_distance(user_lat, user_lon, store["latitude"], store["longitude"])
            }
            for store in stores
        ]

        # Only keep stores within ~1.5 miles
        filtered_stores = [s for s in nearby_stores if s["distance"] <= 1.5]

        if not filtered_stores:
            return jsonify({"error": "No nearby stores found within 1.5 miles."}), 404

        store_list = "\n".join([
            f'- {s["name"]}, {s["address"]} (distance: {s["distance"]} mi)' for s in filtered_stores
        ])
        ingredient_list = ", ".join(pantry_items)

        prompt = (
            f"You are a grocery shopping assistant helping someone with these pantry items:\n"
            f"{ingredient_list}\n\n"
            f"These are nearby grocery stores within 1.5 miles:\n"
            f"{store_list}\n\n"
            f"Pick the best store that is most likely to carry these ingredients.\n"
            f"Respond in JSON format like this:\n"
            f'{{\n  "name": "Store Name",\n  "address": "Full address",\n  "reason": "Why this is a match"\n}}'
        )

        logging.info("🧠 Asking ChatGPT to recommend the best store...")
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful grocery recommendation assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )

        result = response.choices[0].message.content.strip()

        try:
            store_json = json.loads(result)
        except Exception as e:
            logging.warning("⚠️ Could not parse response from GPT. Returning fallback.")
            store_json = {
                "name": "Unknown Store",
                "address": "",
                "reason": "GPT response could not be parsed."
            }

        return jsonify({"store": store_json})

    except Exception as e:
        logging.exception("🔥 Error in recommend-store-ai")
        return jsonify({"error": str(e)}), 500


def parse_text_to_items(text):
    # Simple parsing logic to extract items from text
    # This should be customized based on expected text format
    return [line.strip() for line in text.splitlines() if line.strip()]

def add_items_to_pantry(items):
    # Logic to add items to the pantry
    with open(DB_FILE_PATH, 'r+') as file:
        data = json.load(file)
        pantry = data.get('pantry', [])
        for item in items:
            pantry.append({"id": str(uuid.uuid4()), "name": item})
        file.seek(0)
        file.truncate()
        json.dump(data, file, indent=2)

if __name__ == '__main__':
    logging.info("Registered Flask routes:")
    for rule in app.url_map.iter_rules():
        logging.info(f"Route: {rule} -> {rule.endpoint}")
    app.run(host='0.0.0.0', port=5001, debug=True)