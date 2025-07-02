#!/bin/bash

# Backend Fix Script for Mireva Pantry Issue
# This script fixes the POST /pantry endpoint to use correct user pantry mapping

echo "🔧 Starting Mireva Backend Fix..."

# SSH into the server and execute the fix
ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114 << 'EOF'

echo "📂 Navigating to backend directory..."
cd /mnt/data/MirevaApp/backend

echo "💾 Creating backup..."
cp app.py app.py.backup.$(date +%Y%m%d_%H%M%S)

echo "🔍 Checking current problematic line..."
grep -n "pantry_name = request.args.get" app.py

echo "🛠️ Applying fix..."

# Create the replacement text
cat > /tmp/pantry_fix.txt << 'PYTHON_CODE'
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
PYTHON_CODE

# Use sed to replace the problematic line
sed -i 's/        pantry_name = request\.args\.get('\''pantry'\'', '\''default'\'')/# FIXED: Use user email to get pantry name/' app.py

# Insert the new code after the comment
sed -i '/# FIXED: Use user email to get pantry name/r /tmp/pantry_fix.txt' app.py

echo "✅ Fix applied! Checking the change..."
grep -A 15 "FIXED: Use user email" app.py

echo "🔄 Restarting backend..."
pkill -f "python.*app.py"
sleep 2
nohup ./run.sh > backend.log 2>&1 &

echo "⏱️ Waiting for backend to start..."
sleep 5

echo "🔍 Checking if backend is running..."
ps aux | grep "python.*app.py" | grep -v grep

echo "📋 Checking backend logs..."
tail -10 backend.log

echo "🎉 Backend fix completed!"
echo "📝 Backup saved as: app.py.backup.$(date +%Y%m%d_%H%M%S)"

# Clean up temp file
rm -f /tmp/pantry_fix.txt

EOF

echo "✅ Script execution completed!"
echo ""
echo "🧪 Test the fix by:"
echo "1. Adding a new item in the Mireva app"
echo "2. Check if it appears in 'Sadri-FAM Pantry' instead of 'default'"
echo ""
echo "📱 The app should now work correctly!"