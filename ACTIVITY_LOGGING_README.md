# Mireva Activity Logging System

## Overview
The Mireva app's activity logging system tracks and displays user actions across pantry management, shopping lists, and recipe activities. This system provides real-time activity feeds showing what users have done, when they did it, and which items were involved.

## Architecture

### Components
1. **LogScreen.js** - Frontend React Native component that displays activities
2. **Backend API Endpoints** - Flask routes that serve activity data
3. **Activity Log Files** - JSON files that store raw activity data
4. **log_user_activity()** - Backend function that records activities

## Data Flow

```
User Action (Add/Remove Item) 
    ↓
Backend Operation (POST/DELETE) 
    ↓
log_user_activity() called 
    ↓
Activity saved to JSON file 
    ↓
API endpoint reads from file 
    ↓
LogScreen.js displays activity
```

## Backend Implementation

### Core Logging Function
**Location**: `/mnt/data/MirevaApp/backend/app.py:41`

```python
def log_user_activity(user_email, activity_type, activity_data=None, pantry_name=None):
    """Log user activity with deduplication to prevent duplicate entries"""
    # Creates/updates activity log files in /mnt/data/MirevaApp/activity_logs/
```

### Activity Log Storage
**Location**: `/mnt/data/MirevaApp/activity_logs/`

Files are organized by pantry:
- `{pantry_name}_pantry_activity.json` - Pantry add/remove activities
- `{pantry_name}_shopping_activity.json` - Shopping list activities

**Example**: `Sadri-FAM Pantry_pantry_activity.json`

### Log File Structure
```json
{
  "activities": [
    {
      "timestamp": "2025-07-13T19:53:53.431299",
      "user_email": "sizarta@gmail.com", 
      "user_name": "Majid",
      "activity_type": "shopping_list_add_item",
      "activity_data": {
        "item_name": "Garlic powder",
        "item_id": "1752436433430"
      },
      "description": "Majid performed shopping_list_add_item"
    }
  ],
  "last_updated": "2025-07-13T19:53:53.431738"
}
```

## API Endpoints

### 1. Pantry Activity Logs
**Endpoint**: `GET /pantry-activity-logs`
**Headers**: `X-User-Email: user@example.com`

**Purpose**: Returns pantry-related activities (add/remove items)

**Response Format**:
```json
{
  "activities": [
    {
      "timestamp": "2025-07-13T19:52:36.943044",
      "user_name": "Majid",
      "activity_type": "pantry_add_item", 
      "activity_data": {
        "item_name": "TEST PANTRY ACTIVITY LOG",
        "item_id": "Unknown"
      },
      "description": "Majid performed pantry_add_item"
    }
  ]
}
```

**Implementation**: 
- Reads from `{user_pantry}_pantry_activity.json`
- Returns last 30 activities
- Filters out view-only activities

### 2. Shopping Activity Logs  
**Endpoint**: `GET /shopping-activity-logs`
**Headers**: `X-User-Email: user@example.com`

**Purpose**: Returns shopping list activities (add/remove items)

**Response Format**: Same structure as pantry logs but with `shopping_list_add_item` activity types

**Implementation**:
- Reads from `{user_pantry}_shopping_activity.json` 
- Returns last 30 activities
- Includes all shopping operations

## Activity Logging Integration

### Pantry Operations

#### Adding Items
**Location**: `app.py:490` (after pantry POST success)
```python
# Log pantry activity
log_user_activity(user_email, "pantry_add_item", 
                 {"item_name": new_item.get("name", "Unknown"), 
                  "item_id": new_item.get("id", "Unknown")}, 
                 pantry_name)
```

#### Removing Items  
**Location**: `app.py:572` (in delete_pantry_item function)
```python
# Log pantry activity if item was found
if item_found:
    log_user_activity(user_email, "pantry_remove_item", 
                     {"item_id": item_id}, pantry_name)
```

### Shopping List Operations

#### Adding Items
**Location**: `app.py:1399` (after shopping list POST success)
```python
# Log shopping activity
log_user_activity(user_email, "shopping_list_add_item", 
                 {"item_name": item["name"], "item_id": item["id"]}, 
                 user_pantry_name)
```

#### Removing Items
**Location**: `app.py:1423` (after shopping list DELETE success)  
```python
# Log shopping activity
log_user_activity(user_email, "shopping_list_remove_item", 
                 {"item_id": item_id}, user_pantry_name)
```

## Frontend Implementation (LogScreen.js)

### Data Fetching
**Location**: `screens/LogScreen.js:96-112`

The LogScreen fetches data from multiple sources:
1. **Pantry Activity Logs**: `/pantry-activity-logs`
2. **Shopping Activity Logs**: `/shopping-activity-logs`  
3. **Recipe Logs**: `/get-recipe-logs`
4. **Saved Recipes**: AsyncStorage

### Activity Processing
**Location**: `screens/LogScreen.js:164-224`

The frontend processes activities through several steps:

1. **Deduplication**: Removes duplicate activities based on timestamp and type
2. **Filtering**: Excludes view-only activities  
3. **Formatting**: Converts to display format with descriptions
4. **Sorting**: Orders by timestamp (newest first)

### Activity Types Handled

#### Pantry Activities
- `pantry_add_item` → "Majid added {item} to pantry"
- `pantry_remove_item` → "Majid removed {item} from pantry"  
- `pantry_scan_add` → "Majid scanned and added items"

#### Shopping Activities  
- `shopping_list_add_item` → "Majid added {item} to shopping list"
- `shopping_list_remove_item` → "Majid removed {item} from shopping list"

### Display Format
Each activity is displayed with:
- **User name**: From `activity.user_name`
- **Action description**: Generated based on `activity_type`
- **Item name**: From `activity_data.item_name`
- **Time**: Relative time ("Today", "2 days ago")

## Activity Types Reference

| Activity Type | Triggered By | Data Logged | Display Text |
|---------------|--------------|-------------|--------------|
| `pantry_add_item` | POST /pantry | item_name, item_id | "User added {item} to pantry" |
| `pantry_remove_item` | DELETE /pantry/{id} | item_id | "User removed {item} from pantry" |
| `shopping_list_add_item` | POST /shopping/list | item_name, item_id | "User added {item} to shopping list" |
| `shopping_list_remove_item` | DELETE /shopping/list | item_id | "User removed {item} from shopping list" |
| `pantry_view` | GET /pantry | items_count, item_names | Filtered out from display |
| `shopping_list_view` | GET /shopping/list | items_count | Filtered out from display |

## Configuration

### File Paths
- **Backend**: `/mnt/data/MirevaApp/backend/app.py`
- **Activity Logs**: `/mnt/data/MirevaApp/activity_logs/`
- **Users File**: `/mnt/data/MirevaApp/users.json`
- **Frontend**: `/Users/sizarta/Mireva/screens/LogScreen.js`

### User-Pantry Mapping
Users are mapped to pantries via `users.json`:
```json
{
  "sizarta@gmail.com": {
    "pantryName": "Sadri-FAM Pantry",
    "name": "Majid"
  }
}
```

### Activity Log File Naming
Format: `{pantryName}_{type}_activity.json`
- Example: `Sadri-FAM Pantry_pantry_activity.json`
- Example: `Sadri-FAM Pantry_shopping_activity.json`

## Debugging

### Backend Logs
Monitor activity logging:
```bash
# View backend logs
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114
tmux attach -t mireva

# Check for activity logging messages
grep "Activity logged" /mnt/data/MirevaApp/backend/app.log
```

### Activity Log Files
Check raw activity data:
```bash
# View recent activities
tail -20 "/mnt/data/MirevaApp/activity_logs/Sadri-FAM Pantry_shopping_activity.json"

# Count activities
jq '.activities | length' "/mnt/data/MirevaApp/activity_logs/Sadri-FAM Pantry_pantry_activity.json"
```

### API Testing
Test endpoints directly:
```bash
# Test pantry activities
curl -s https://mireva.life/pantry-activity-logs \
  -H "X-User-Email: sizarta@gmail.com" | jq '.activities[0:3]'

# Test shopping activities  
curl -s https://mireva.life/shopping-activity-logs \
  -H "X-User-Email: sizarta@gmail.com" | jq '.activities[0:3]'
```

### Frontend Debugging
Enable console logging in LogScreen.js:
- Line 118: `console.log('📊 Activity Logs Debug...')`
- Line 123: `console.log('Sample pantry activity:', ...)`

## Performance Considerations

### File Size Management
- Each activity log file stores all activities for a pantry
- Files grow over time but are relatively small (JSON text)
- No automatic cleanup currently implemented

### API Response Limits
- Endpoints return last 30 activities to limit response size
- Frontend processes and deduplicates data client-side

### Caching
- No server-side caching implemented
- Files are read fresh on each API request
- Consider implementing caching for high-traffic scenarios

## Security

### Authentication
- All endpoints require `X-User-Email` header
- User email is validated against users.json
- Activities are filtered by user's pantry access

### Data Privacy
- Activities include user emails and names
- Log files are stored on server filesystem
- No encryption at rest currently implemented

## Future Enhancements

### Potential Improvements
1. **Activity Pagination**: Support for loading older activities
2. **Real-time Updates**: WebSocket integration for live activity feeds
3. **Activity Search**: Filter activities by date, user, or item
4. **Activity Analytics**: Statistics and trends
5. **Data Retention**: Automatic cleanup of old activities
6. **Activity Categories**: Group similar activities together
7. **Batch Operations**: Log multiple items added at once
8. **Activity Undo**: Allow users to undo recent actions

### Scalability Considerations
1. **Database Migration**: Move from JSON files to proper database
2. **Activity Indexing**: Add search indexes for better performance
3. **Log Rotation**: Implement automatic log file rotation
4. **Caching Layer**: Add Redis/Memcached for frequently accessed data