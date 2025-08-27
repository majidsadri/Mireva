import foodIconsData from '../assets/food-icons.json';

/**
 * Get the appropriate emoji icon for a food item
 * @param {string} itemName - The name of the food item
 * @returns {string} - The emoji icon for the item
 */
export const getFoodIcon = (itemName) => {
  if (!itemName) return '🍽️'; // Default food icon
  
  let normalizedName = itemName.toLowerCase().trim();
  
  // Remove common prefixes that don't affect the food type
  const prefixesToRemove = ['bunch of', 'bundle of', 'pack of', 'bag of', 'box of', 'can of', 'bottle of', 'jar of'];
  for (const prefix of prefixesToRemove) {
    if (normalizedName.startsWith(prefix + ' ')) {
      normalizedName = normalizedName.substring(prefix.length + 1).trim();
    }
  }
  
  // Create a priority list of matches (most specific first)
  const matches = [];
  
  // Search through all categories for matches
  for (const category of Object.values(foodIconsData)) {
    for (const [foodName, icon] of Object.entries(category)) {
      const normalizedFoodName = foodName.toLowerCase();
      
      // Exact match (highest priority)
      if (normalizedName === normalizedFoodName) {
        matches.push({ priority: 1, icon, foodName });
      }
      // Item name starts with food name (high priority)
      else if (normalizedName.startsWith(normalizedFoodName + ' ') || normalizedName.startsWith(normalizedFoodName + 's')) {
        matches.push({ priority: 2, icon, foodName });
      }
      // Food name starts with item name (medium priority) 
      else if (normalizedFoodName.startsWith(normalizedName + ' ') || normalizedFoodName.startsWith(normalizedName + 's')) {
        matches.push({ priority: 3, icon, foodName });
      }
      // Item contains food name as whole word (lower priority)
      else if (normalizedName.includes(' ' + normalizedFoodName + ' ') || 
               normalizedName.includes(' ' + normalizedFoodName) ||
               normalizedName.includes(normalizedFoodName + ' ')) {
        matches.push({ priority: 4, icon, foodName });
      }
    }
  }
  
  // Sort by priority and return the best match
  if (matches.length > 0) {
    matches.sort((a, b) => a.priority - b.priority);
    return matches[0].icon;
  }
  
  // Category-based fallback icons
  const categoryIcons = {
    'Fruits & Vegetables': '🥬',
    'Proteins': '🥩', 
    'Dairy': '🥛',
    'Grains & Pantry': '🌾',
    'Beverages': '🥤',
    'Frozen': '🧊',
    'Condiments': '🧂'
  };
  
  // Try to determine category and return appropriate icon
  for (const [category, icon] of Object.entries(categoryIcons)) {
    if (normalizedName.includes(category.toLowerCase())) {
      return icon;
    }
  }
  
  // Ultimate fallback
  return '🍽️';
};

/**
 * Get category icon for category tabs
 * @param {string} categoryName - The name of the category
 * @returns {string} - The emoji icon for the category
 */
export const getCategoryIcon = (categoryName) => {
  const categoryIcons = {
    'All': '🍽️',
    'Fruits & Vegetables': '🥬',
    'Proteins': '🥩',
    'Dairy': '🥛',
    'Grains & Pantry': '🌾',
    'Beverages': '🥤',
    'Frozen': '🧊',
    'Condiments': '🧂'
  };
  
  return categoryIcons[categoryName] || '📦';
};

export default { getFoodIcon, getCategoryIcon };