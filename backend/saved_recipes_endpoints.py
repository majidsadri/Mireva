@app.route('/saved-recipes', methods=['GET'])
def get_saved_recipes():
    """Get all saved recipes for a user"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if user_email not in users:
            return jsonify({"recipes": []}), 200

        # Get saved recipes from user data
        saved_recipes = users[user_email].get('savedRecipes', [])
        
        logging.info(f"Returning {len(saved_recipes)} saved recipes for user {user_email}")
        return jsonify({"recipes": saved_recipes}), 200

    except Exception as e:
        logging.error(f"Error getting saved recipes: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/saved-recipes', methods=['POST'])
def save_recipe():
    """Save a new recipe for a user"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        data = request.get_json()
        if not data:
            return jsonify({"error": "Recipe data required"}), 400

        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if user_email not in users:
            return jsonify({"error": "User not found"}), 404

        # Add metadata to recipe
        recipe = {
            **data,
            'id': data.get('id', f"saved_{int(time.time())}_{uuid.uuid4().hex[:8]}"),
            'savedAt': data.get('savedAt', datetime.now().isoformat()),
            'savedBy': user_email
        }

        # Check if recipe already exists (by name)
        existing_recipes = users[user_email].get('savedRecipes', [])
        if any(r.get('name') == recipe.get('name') for r in existing_recipes):
            return jsonify({"error": "Recipe already saved"}), 409

        # Add recipe to user's saved recipes
        users[user_email].setdefault('savedRecipes', []).append(recipe)
        users[user_email]['updated_at'] = datetime.now().isoformat()

        # Save back to file
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)

        logging.info(f"Saved recipe '{recipe.get('name')}' for user {user_email}")
        return jsonify({"message": "Recipe saved successfully", "recipe": recipe}), 201

    except Exception as e:
        logging.error(f"Error saving recipe: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/saved-recipes/<recipe_id>', methods=['DELETE'])
def delete_saved_recipe(recipe_id):
    """Delete a saved recipe for a user"""
    try:
        user_email = request.headers.get('X-User-Email')
        if not user_email:
            return jsonify({"error": "User email required in X-User-Email header"}), 400

        # Load users data
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        if user_email not in users:
            return jsonify({"error": "User not found"}), 404

        # Find and remove recipe
        saved_recipes = users[user_email].get('savedRecipes', [])
        initial_count = len(saved_recipes)
        
        # Remove recipe by ID or name (for backward compatibility)
        users[user_email]['savedRecipes'] = [
            r for r in saved_recipes 
            if r.get('id') != recipe_id and r.get('name') != recipe_id
        ]
        
        final_count = len(users[user_email]['savedRecipes'])
        
        if initial_count == final_count:
            return jsonify({"error": "Recipe not found"}), 404

        users[user_email]['updated_at'] = datetime.now().isoformat()

        # Save back to file
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)

        logging.info(f"Deleted recipe '{recipe_id}' for user {user_email}")
        return jsonify({"message": "Recipe deleted successfully"}), 200

    except Exception as e:
        logging.error(f"Error deleting recipe: {e}")
        return jsonify({"error": str(e)}), 500