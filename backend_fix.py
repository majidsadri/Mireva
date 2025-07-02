# Replace the POST method in your app.py (around lines 336-365) with this corrected version:

elif request.method == 'POST':
    try:
        # Get user's email from header (same logic as GET method)
        user_email = request.headers.get('X-User-Email')
        pantry_name = 'default'  # fallback
        
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
                        else:
                            logging.info(f"User {user_email} has no pantryName set, using default")
                    else:
                        logging.info(f"User {user_email} not found in users.json")
            except Exception as e:
                logging.error(f"Error reading user pantry info for POST: {e}")
        
        # Add a new item to the pantry
        new_item = request.json
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

            logging.info(f"Successfully added item to pantry '{pantry_name}'")
        return jsonify({"message": "Item added successfully"}), 201
    except Exception as e:
        logging.error(f"Error adding item to pantry: {e}")
        logging.error("Exception traceback:", exc_info=True)
        return jsonify({"error": str(e)}), 500