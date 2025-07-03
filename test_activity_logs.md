# Test Activity Logs for Shared Pantry

## Test Steps:

1. **Login with User 1**
   - Email: user1@example.com
   - Pantry: Sadri-FAM

2. **Perform Actions as User 1:**
   - View pantry
   - Add an item (e.g., "Milk")
   - View shopping list
   - Add item to shopping list (e.g., "Bread")

3. **Login with User 2** 
   - Email: user2@example.com
   - Pantry: Sadri-FAM

4. **Check Log Screen as User 2:**
   - Should see User 1's activities
   - Tap "Refresh" button
   - Should see activities like:
     - "User1 added item"
     - "User1 added Milk to pantry"
     - "User1 viewed pantry"
     - "User1 added Bread to shopping list"

5. **Perform Actions as User 2:**
   - Add different item (e.g., "Eggs")
   - Remove an item

6. **Switch back to User 1 and check logs**
   - Should see User 2's activities

## Debug Info to Check:

In the console logs, you should see:
- `📊 Activity Logs Debug for user [email]`
- `Pantry activities: [number]`
- `Shopping activities: [number]`
- Sample activity data showing user_name field

## Common Issues:

1. **Pantry Name Mismatch**: Make sure both users have EXACTLY "Sadri-FAM" (case sensitive)
2. **Activity Not Logging**: Check if backend is receiving the pantry_name in the activity
3. **User Name Not Showing**: Check if user_name is being set in the activity data