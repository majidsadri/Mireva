#!/usr/bin/env python3
"""
Script to consolidate existing duplicate items in the pantry database
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

def consolidate_pantry_items(items):
    """Consolidate duplicate items in a pantry"""
    consolidated = {}
    duplicates_found = []
    
    for item in items:
        name = normalize_item_name(item['name'])
        measurement = item.get('measurement', 'unit')
        key = f"{name}_{measurement}"
        
        if key in consolidated:
            # Found duplicate - consolidate
            existing = consolidated[key]
            existing_amount = parse_amount(existing.get('amount', '1'))
            new_amount = parse_amount(item.get('amount', '1'))
            total_amount = existing_amount + new_amount
            
            # Update amount
            old_amount = existing['amount']
            existing['amount'] = format_amount(total_amount)
            
            # Use the later expiry date
            if item.get('expiryDate') and item['expiryDate'] != '':
                try:
                    new_expiry = datetime.fromisoformat(item['expiryDate'].replace('Z', '+00:00'))
                    existing_expiry = datetime.fromisoformat(existing.get('expiryDate', '1900-01-01T00:00:00+00:00').replace('Z', '+00:00'))
                    if new_expiry > existing_expiry:
                        existing['expiryDate'] = item['expiryDate']
                except:
                    existing['expiryDate'] = item['expiryDate']
            
            duplicates_found.append(f"Consolidated {existing['name']}: {old_amount} + {format_amount(new_amount)} = {existing['amount']} {measurement}")
        else:
            # First occurrence
            consolidated[key] = item.copy()
    
    return list(consolidated.values()), duplicates_found

def main():
    """Consolidate existing duplicates in the database"""
    
    # Connect to server and get the database
    import subprocess
    
    # Download current db.json
    print("Downloading current database...")
    result = subprocess.run([
        'scp', '-i', '~/.ssh/id_rsa', 
        'ubuntu@18.215.164.114:/mnt/data/MirevaApp/db.json', 
        'current_db.json'
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error downloading database: {result.stderr}")
        return
    
    # Load and process database
    with open('current_db.json', 'r') as f:
        data = json.load(f)
    
    pantry_data = data.get('pantry', {})
    total_items_before = 0
    total_items_after = 0
    all_duplicates = []
    
    print("\nConsolidating duplicates in all pantries...")
    
    for pantry_name, items in pantry_data.items():
        if isinstance(items, list):
            print(f"\n📦 Processing pantry: {pantry_name}")
            print(f"   Items before: {len(items)}")
            
            consolidated_items, duplicates = consolidate_pantry_items(items)
            
            print(f"   Items after:  {len(consolidated_items)}")
            
            if duplicates:
                print("   Consolidations:")
                for dup in duplicates:
                    print(f"     ✅ {dup}")
                all_duplicates.extend(duplicates)
            else:
                print("   No duplicates found")
            
            # Update the pantry
            pantry_data[pantry_name] = consolidated_items
            total_items_before += len(items)
            total_items_after += len(consolidated_items)
    
    # Save updated database
    with open('consolidated_db.json', 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\n📊 Summary:")
    print(f"   Total items before: {total_items_before}")
    print(f"   Total items after:  {total_items_after}")
    print(f"   Items consolidated: {total_items_before - total_items_after}")
    print(f"   Consolidation operations: {len(all_duplicates)}")
    
    if all_duplicates:
        print("\n🔄 Upload consolidated database? (y/n): ", end="")
        response = input().strip().lower()
        
        if response == 'y':
            # Upload back to server
            result = subprocess.run([
                'scp', '-i', '~/.ssh/id_rsa',
                'consolidated_db.json',
                'ubuntu@18.215.164.114:/mnt/data/MirevaApp/db.json'
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print("✅ Database updated successfully!")
            else:
                print(f"❌ Error uploading database: {result.stderr}")
        else:
            print("Database not updated.")
    else:
        print("No duplicates found, database unchanged.")

if __name__ == "__main__":
    main()