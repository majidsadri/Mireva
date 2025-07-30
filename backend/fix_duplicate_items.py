#!/usr/bin/env python3
"""
Fix for duplicate item creation in pantry
This script will modify the pantry add logic to consolidate duplicate items
"""

import json
import uuid
from datetime import datetime, timedelta

def normalize_item_name(name):
    """Normalize item names for comparison"""
    return name.lower().strip()

def parse_amount(amount_str):
    """Parse amount string to number"""
    if not amount_str or amount_str == '':
        return 1
    try:
        return float(amount_str)
    except:
        return 1

def format_amount(amount):
    """Format amount back to string"""
    if amount == int(amount):
        return str(int(amount))
    return str(amount)

def consolidate_pantry_item(pantry_items, new_item):
    """
    Add item to pantry, consolidating with existing items if they match
    Returns: (updated_pantry_items, was_consolidated)
    """
    new_name = normalize_item_name(new_item['name'])
    new_amount = parse_amount(new_item.get('amount', '1'))
    new_measurement = new_item.get('measurement', 'unit')
    
    # Look for existing item with same name and measurement
    for existing_item in pantry_items:
        existing_name = normalize_item_name(existing_item['name'])
        existing_measurement = existing_item.get('measurement', 'unit')
        
        if existing_name == new_name and existing_measurement == new_measurement:
            # Found a match - consolidate quantities
            existing_amount = parse_amount(existing_item.get('amount', '1'))
            total_amount = existing_amount + new_amount
            
            # Update the existing item
            existing_item['amount'] = format_amount(total_amount)
            
            # Use the newer expiry date if provided
            if new_item.get('expiryDate') and new_item['expiryDate'] != '':
                existing_item['expiryDate'] = new_item['expiryDate']
            
            # Update purchase date to most recent
            if new_item.get('purchaseDate'):
                existing_item['purchaseDate'] = new_item['purchaseDate']
            elif 'purchaseDate' not in existing_item:
                existing_item['purchaseDate'] = datetime.now().isoformat()
            
            # Update category if new item has one
            if new_item.get('category'):
                existing_item['category'] = new_item['category']
            
            return pantry_items, True
    
    # No match found - add as new item
    pantry_items.append(new_item)
    return pantry_items, False

def create_pantry_add_function():
    """Create the improved pantry add function"""
    return '''
def add_item_to_pantry(pantry_items, new_item):
    """
    Add item to pantry, consolidating with existing items if they match
    Returns: (updated_pantry_items, was_consolidated, consolidated_item_name)
    """
    import json
    from datetime import datetime
    
    def normalize_item_name(name):
        return name.lower().strip()
    
    def parse_amount(amount_str):
        if not amount_str or amount_str == '':
            return 1
        try:
            return float(amount_str)
        except:
            return 1
    
    def format_amount(amount):
        if amount == int(amount):
            return str(int(amount))
        return str(amount)
    
    new_name = normalize_item_name(new_item['name'])
    new_amount = parse_amount(new_item.get('amount', '1'))
    new_measurement = new_item.get('measurement', 'unit')
    
    # Look for existing item with same name and measurement
    for existing_item in pantry_items:
        existing_name = normalize_item_name(existing_item['name'])
        existing_measurement = existing_item.get('measurement', 'unit')
        
        if existing_name == new_name and existing_measurement == new_measurement:
            # Found a match - consolidate quantities
            existing_amount = parse_amount(existing_item.get('amount', '1'))
            total_amount = existing_amount + new_amount
            
            # Update the existing item
            old_amount = existing_item['amount']
            existing_item['amount'] = format_amount(total_amount)
            
            # Use the newer expiry date if provided
            if new_item.get('expiryDate') and new_item['expiryDate'] != '':
                existing_item['expiryDate'] = new_item['expiryDate']
            
            # Update purchase date to most recent
            if new_item.get('purchaseDate'):
                existing_item['purchaseDate'] = new_item['purchaseDate']
            elif 'purchaseDate' not in existing_item:
                existing_item['purchaseDate'] = datetime.now().isoformat()
            
            # Update category if new item has one
            if new_item.get('category'):
                existing_item['category'] = new_item['category']
            
            consolidated_name = f"{existing_item['name']} ({old_amount} + {format_amount(new_amount)} = {existing_item['amount']} {new_measurement})"
            return pantry_items, True, consolidated_name
    
    # No match found - add as new item
    pantry_items.append(new_item)
    return pantry_items, False, new_item['name']
'''

def main():
    """Generate the fixed backend code"""
    print("Creating fixed pantry consolidation logic...")
    
    with open('pantry_consolidation_fix.py', 'w') as f:
        f.write(create_pantry_add_function())
    
    print("✅ Generated pantry consolidation function")
    print("This needs to be integrated into the backend app.py file")
    
    # Test the consolidation logic
    test_pantry = [
        {
            "id": "existing1",
            "name": "Chicken breast",
            "amount": "2",
            "measurement": "unit",
            "expiryDate": "2025-08-01T00:00:00.000Z"
        }
    ]
    
    new_item = {
        "id": "new1",
        "name": "chicken breast",  # Different capitalization
        "amount": "3",
        "measurement": "unit",
        "expiryDate": "2025-08-15T00:00:00.000Z"
    }
    
    result, consolidated = consolidate_pantry_item(test_pantry, new_item)
    
    print(f"\n🧪 Test consolidation:")
    print(f"Before: 2 Chicken breast")
    print(f"Adding: 3 chicken breast")
    print(f"Result: {result[0]['amount']} {result[0]['name']}")
    print(f"Consolidated: {consolidated}")

if __name__ == "__main__":
    main()