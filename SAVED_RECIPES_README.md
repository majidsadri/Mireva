# Saved Recipes System in Mireva App

## Overview
The Mireva app's saved recipes system allows users to save recipes they find interesting and view them later. The saved recipes are displayed in the LogScreen and can be accessed through a dedicated SavedRecipesScreen.

## Architecture

### Components
1. **CookScreen.js** - Where users save recipes by pressing "⭐ Save Recipe" button
2. **LogScreen.js** - Shows count of saved recipes and recent recipe activities  
3. **SavedRecipesScreen.js** - Displays all saved and cooked recipes
4. **Backend API** - Stores recipe data in users.json file

## Data Flow

```
User finds recipe in CookScreen
    ↓
Presses "⭐ Save Recipe" button
    ↓
saveRecipe() function called
    ↓
Recipe saved to AsyncStorage (local)
    ↓
Recipe sent to backend /log-recipe (if available)
    ↓
LogScreen shows updated count
    ↓
SavedRecipesScreen displays saved recipes
```

## Local Storage (AsyncStorage)

### Storage Key Format
**Key**: `savedRecipes_{userEmail}`
**Example**: `savedRecipes_sizarta@gmail.com`

### Recipe Data Structure
```javascript
{
  ...originalRecipe,           // All original recipe fields
  savedAt: "2025-07-13T19:53:53.431Z",
  savedBy: "sizarta@gmail.com",
  id: "saved_1752436433430_abc123def"
}
```

### Migration Logic
- **Legacy Support**: Old recipes stored under global `savedRecipes` key
- **User-Specific**: New recipes stored under `savedRecipes_{email}` for privacy
- **Automatic Migration**: Only for original user (sizarta@gmail.com) to prevent data leakage

## Frontend Implementation

### CookScreen.js - Saving Recipes

#### Save Recipe Function
**Location**: `screens/CookScreen.js:461`

```javascript
const saveRecipe = async (recipe) => {
  // Add metadata
  const recipeWithTimestamp = {
    ...recipe,
    savedAt: new Date().toISOString(),
    savedBy: userEmail,
    id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  // Save to local AsyncStorage
  const userSpecificKey = `savedRecipes_${userEmail}`;
  await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedSaved));
  
  // Try to log to backend (non-critical)
  await fetch(`${API_CONFIG.BASE_URL}/log-recipe`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      recipe: recipeWithTimestamp,
      action: 'saved'
    }),
  });
};
```

#### Save Button Behavior
- **Not Saved**: Shows "⭐ Save Recipe" - saves recipe when pressed
- **Already Saved**: Shows "📋 View Instructions" - displays full instructions

#### Smart Suggestions Integration
When a recipe is saved:
1. Recipe ingredients are added as shopping suggestions
2. User gets feedback: "Recipe saved! 🛒 X ingredients added as smart suggestions"

### LogScreen.js - Recipe Count Display

#### Recipes Button
**Location**: `screens/LogScreen.js:321`

```javascript
<TouchableOpacity onPress={showAllSavedRecipes}>
  <View style={styles.recipesButton}>
    <Text>{savedRecipes.length}</Text>  {/* Count of saved recipes */}
  </View>
  <Text>Recipes</Text>
</TouchableOpacity>
```

#### Data Loading
**Location**: `screens/LogScreen.js:53`

```javascript
// Load saved recipes from AsyncStorage
const userSpecificKey = `savedRecipes_${userEmail}`;
let saved = await AsyncStorage.getItem(userSpecificKey);
let localSavedRecipes = saved ? JSON.parse(saved) : [];

// Load logged recipes from backend  
const loggedResponse = await fetch('/get-recipe-logs');
const loggedRecipes = loggedData.recipe_logs || [];

// Combine both types
const allRecipes = [...localSavedRecipes, ...loggedRecipes];
setSavedRecipes(allRecipes);
```

#### Activity Display
Recipes appear in activity feed as:
- **Saved recipes**: "Saved recipe: {recipe.name}"
- **Cooked recipes**: "Cooked recipe: {recipe.name}"

### SavedRecipesScreen.js - Recipe Management

#### Loading Recipes
**Location**: `screens/SavedRecipesScreen.js:23`

```javascript
const loadSavedRecipes = async () => {
  // Load from AsyncStorage (saved recipes)
  const userSpecificKey = `savedRecipes_${userEmail}`;
  let localSavedRecipes = await AsyncStorage.getItem(userSpecificKey);
  
  // Load from backend (cooked recipes)
  const loggedResponse = await fetch('/get-recipe-logs');
  const loggedRecipes = loggedData.recipe_logs || [];
  
  // Combine and sort by date (newest first)
  const allRecipes = [...localSavedRecipes, ...loggedRecipes].sort((a, b) => {
    const dateA = new Date(a.savedAt || a.timestamp || 0);
    const dateB = new Date(b.savedAt || b.timestamp || 0);
    return dateB.getTime() - dateA.getTime();
  });
};
```

#### Recipe Display
- **Recipe Types**: 
  - "Saved" (green) - from AsyncStorage
  - "Cooked" (orange) - from backend logs
- **Recipe Cards**: Show name, date, type badge
- **Instructions**: Tap recipe to view full instructions

## Backend Implementation

### GET /get-recipe-logs Endpoint
**Location**: `/mnt/data/MirevaApp/backend/app.py` (around line with get-recipe-logs)

```python
@app.route('/get-recipe-logs', methods=['GET'])
def get_recipe_logs():
    # Get user's saved recipes from users.json
    saved_recipes = users[user_email].get('savedRecipes', [])
    
    # Format as recipe logs
    recipe_logs = []
    for recipe in saved_recipes:
        recipe_logs.append({
            "id": recipe.get('id'),
            "name": recipe.get('name', 'Unknown Recipe'),
            "loggedAt": recipe.get('savedAt'),
            "ingredients": recipe.get('ingredients', []),
            "cookingTime": recipe.get('cookingTime', 'Unknown'),
            "calories": recipe.get('calories', 'Unknown')
        })
    
    return jsonify({"recipes": recipe_logs})
```

### Data Storage
**File**: `/mnt/data/MirevaApp/users.json`

```json
{
  "sizarta@gmail.com": {
    "name": "Majid",
    "pantryName": "Sadri-FAM Pantry",
    "savedRecipes": [
      {
        "id": "saved_1752436433430_abc123def",
        "name": "Chicken Curry",
        "savedAt": "2025-07-13T19:53:53.431Z",
        "savedBy": "sizarta@gmail.com",
        "ingredients": ["chicken", "curry powder", "onions"],
        "instructions": "1. Heat oil...",
        "cookingTime": "30 minutes",
        "calories": "350"
      }
    ]
  }
}
```

### Missing Endpoint
**Note**: The `/log-recipe` POST endpoint referenced in CookScreen.js doesn't exist in the current backend. This is why backend logging fails non-critically.

## Recipe Types

### Saved Recipes (AsyncStorage)
- **Source**: User saves recipe in CookScreen
- **Storage**: Local AsyncStorage per user
- **Fields**: `savedAt`, `savedBy`, plus all original recipe data
- **Display**: Green "Saved" badge
- **Purpose**: Recipes user wants to cook later

### Cooked Recipes (Backend)
- **Source**: User marks recipe as cooked (logs to backend)
- **Storage**: Backend users.json file
- **Fields**: `loggedAt`, `timestamp`, recipe data
- **Display**: Orange "Cooked" badge  
- **Purpose**: Recipes user has already made

## User Experience Flow

### Saving a Recipe
1. User browses recipes in CookScreen
2. Finds interesting recipe
3. Presses "⭐ Save Recipe" button
4. Recipe saved locally with timestamp
5. Ingredients added as shopping suggestions
6. Success message shows ingredient count
7. Button changes to "📋 View Instructions"

### Viewing Saved Recipes
1. User opens LogScreen (Logs tab)
2. Sees recipe count on circular "Recipes" button
3. Taps button to navigate to SavedRecipesScreen
4. Views all saved and cooked recipes sorted by date
5. Taps any recipe to see full instructions

### Activity Tracking
1. Recipe saves appear in LogScreen activity feed
2. Shows "Saved recipe: {name}" with timestamp
3. Cooked recipes show "Cooked recipe: {name}"
4. Activities are mixed with pantry/shopping activities

## Data Privacy

### User Isolation
- Each user has separate AsyncStorage keys: `savedRecipes_{email}`
- Backend stores recipes per user in users.json
- Migration only happens for original user to prevent data leakage

### Data Cleanup
- Old global `savedRecipes` key is cleared after migration
- Incorrect data is detected and cleaned for non-sizarta users

## Performance Considerations

### Local Storage
- Recipes stored in AsyncStorage for fast access
- No network required to view saved recipes
- Combines with backend data for complete view

### Backend Sync
- Backend logging is optional (non-critical)
- Recipes work entirely offline if backend fails
- GET /get-recipe-logs provides server-side recipe data

## Future Enhancements

### Potential Improvements
1. **Recipe Sync**: Proper POST /log-recipe endpoint for backup
2. **Recipe Categories**: Organize recipes by meal type, cuisine
3. **Recipe Search**: Search through saved recipes
4. **Recipe Sharing**: Share recipes with other users
5. **Recipe Collections**: Create custom recipe collections
6. **Cooking Timer**: Built-in timer when viewing instructions
7. **Recipe Rating**: Rate saved recipes for future reference
8. **Ingredient Substitutions**: Suggest alternative ingredients
9. **Nutritional Information**: Enhanced calorie and nutrition tracking
10. **Recipe History**: Track when recipes were last viewed/made

### Technical Improvements
1. **Cloud Backup**: Sync recipes across devices
2. **Offline Support**: Better offline recipe management
3. **Image Caching**: Cache recipe images locally
4. **Recipe Import**: Import from external recipe sites
5. **Data Migration**: Robust migration between app versions