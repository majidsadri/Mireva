# Mireva Backend API Documentation

## Overview
The Mireva backend is a Flask-based Python API that manages pantry items, user authentication, shopping lists, and recipe recommendations for the Mireva mobile application.

## Server Information
- **Production URL**: https://mireva.life
- **Server Location**: AWS EC2 Instance (IP: 18.215.164.114)
- **Backend Path**: `/mnt/data/MirevaApp/backend/app.py`
- **Port**: 5001
- **Service**: Running as systemd service `mireva-backend.service`

## Directory Structure
```
/mnt/data/MirevaApp/
├── backend/
│   ├── app.py              # Main Flask application
│   └── run.sh              # Script to run the backend
├── users.json              # User database
├── db.json                 # Main database (pantry items, etc.)
├── pantry_owners.json      # Pantry ownership records
├── pantry_requests.json    # Pantry join requests
├── activity_logs/          # User activity logs directory
│   ├── {pantry_name}_pantry_activity.json
│   └── {pantry_name}_shopping_activity.json
└── pantry_suggestions/     # Pantry suggestions directory
```

## Running the Backend

### Via SSH
```bash
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114
cd /mnt/data/MirevaApp/backend
./run.sh
```

### Service Management
```bash
# Check service status
sudo systemctl status mireva-backend.service

# Restart service
sudo systemctl restart mireva-backend.service

# View logs
sudo journalctl -u mireva-backend.service -f
```

## API Endpoints

### Authentication

#### Sign Up
- **POST** `/signup`
- **Body**: 
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "name": "User Name"
  }
  ```

#### Sign In
- **POST** `/signin`
- **Body**: 
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

### Pantry Management

#### Get Pantry Items
- **GET** `/pantry`
- **Headers**: `X-User-Email: user@example.com`
- **Response**: Array of pantry items for user's pantry

#### Add Pantry Item
- **POST** `/pantry`
- **Headers**: `X-User-Email: user@example.com`
- **Body**:
  ```json
  {
    "name": "Tomatoes",
    "amount": "5",
    "measurement": "unit",
    "expiryDate": "2025-08-01T00:00:00.000Z"
  }
  ```

#### Delete Pantry Item
- **DELETE** `/pantry/{item_id}`
- **Headers**: `X-User-Email: user@example.com`

#### List Available Pantries
- **GET** `/pantries`
- **Response**: List of all pantries with item counts

#### Create/Delete Pantry
- **POST/DELETE** `/pantries/{pantry_name}`
- **Creates new pantry or deletes existing one (cannot delete default pantry)**

### User Profile & Pantry Association

#### Get User's Pantry
- **POST** `/get-user-pantry`
- **Body**: 
  ```json
  {
    "email": "user@example.com"
  }
  ```

#### Update User's Pantry
- **POST** `/update-user-pantry`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "pantryName": "Family Pantry"
  }
  ```

#### Get Available Pantries
- **GET** `/get-available-pantries`
- **Returns list of pantries user can join**

### Pantry Requests

#### Request to Join Pantry
- **POST** `/request-pantry-join`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "pantryName": "Family Pantry",
    "name": "User Name"
  }
  ```

#### Get Pantry Requests
- **GET** `/get-pantry-requests`
- **Headers**: `X-User-Email: user@example.com`
- **Returns pending requests for user's pantries**

#### Respond to Pantry Request
- **POST** `/respond-pantry-request`
- **Body**:
  ```json
  {
    "requestId": "request-id",
    "action": "approve",  // or "reject"
    "email": "responder@example.com"
  }
  ```

### Shopping List

#### Get/Update Shopping List
- **GET/POST** `/shopping/list`
- **Headers**: `X-User-Email: user@example.com`
- **GET Response**: Current shopping list
- **POST Body**: Array of shopping items

#### Get Shopping Suggestions
- **GET** `/shopping/suggestions`
- **Headers**: `X-User-Email: user@example.com`
- **Returns AI-generated shopping suggestions**

### Recipe Features

#### Get Recipe Recommendations
- **POST** `/recommend`
- **Headers**: `X-User-Email: user@example.com`
- **Body**:
  ```json
  {
    "recipeType": "dinner",
    "complexity": "simple",
    "includeIngredients": ["chicken"],
    "excludeIngredients": ["nuts"]
  }
  ```

#### Search Recipes
- **POST** `/search-recipes`
- **Body**:
  ```json
  {
    "query": "pasta recipes"
  }
  ```

#### Log Recipe
- **POST** `/log-recipe`
- **Headers**: `X-User-Email: user@example.com`
- **Body**: Recipe object to log

#### Get Recipe Logs
- **GET** `/get-recipe-logs`
- **Headers**: `X-User-Email: user@example.com`

### Image Recognition

#### Scan Food Item
- **POST** `/scan-food`
- **Form Data**: Image file
- **Returns recognized food item**

#### Scan and Add Items
- **POST** `/scan-and-add`
- **Headers**: `X-User-Email: user@example.com`
- **Form Data**: Image file
- **Automatically adds recognized items to pantry**

### Activity Logs

#### Get Pantry Activity Logs
- **GET** `/pantry-activity-logs`
- **Headers**: `X-User-Email: user@example.com`
- **Note**: Currently returns mock data**

#### Get Shopping Activity Logs
- **GET** `/shopping-activity-logs`
- **Headers**: `X-User-Email: user@example.com`
- **Note**: Currently returns mock data**

### User Account Management

#### Update Account
- **POST** `/update-account`
- **Body**: Updated user information

#### Suspend Account
- **POST** `/suspend-account`
- **Body**: `{ "email": "user@example.com" }`

#### Delete Account
- **POST** `/delete-account`
- **Body**: `{ "email": "user@example.com" }`

### Utility Endpoints

#### Get Cooking Tip
- **GET** `/get_tip`
- **Returns AI-generated cooking tip**

#### Process Receipt
- **POST** `/process-receipt`
- **Headers**: `X-User-Email: user@example.com`
- **Form Data**: Receipt image
- **Extracts items from receipt**

#### List All Routes
- **GET** `/list_routes`
- **Returns all available API endpoints**

## Request Headers
All authenticated endpoints require:
```
Content-Type: application/json
X-User-Email: user@example.com
```

## Data Models

### Pantry Item
```json
{
  "id": "unique-id",
  "name": "Item Name",
  "amount": "5",
  "measurement": "unit|g|kg|ml|L|cup|tbsp|tsp|oz|lb",
  "expiryDate": "2025-08-01T00:00:00.000Z",
  "category": "Category Name",  // optional
  "purchaseDate": "2025-07-01T00:00:00.000Z"  // optional
}
```

### User
```json
{
  "email": "user@example.com",
  "password": "hashed-password",
  "name": "User Name",
  "pantryName": "Pantry Name",
  "preferences": {},
  "created": "timestamp"
}
```

## Notes
- The backend uses file-based storage (JSON files) instead of a traditional database
- Activity logging functionality is implemented but not actively called in the current version
- Multi-pantry support allows users to join and manage different pantries
- CORS is enabled for all origins
- The backend includes AI integration for recipe recommendations and food recognition