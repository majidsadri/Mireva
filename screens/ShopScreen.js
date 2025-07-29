import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Share,
  Linking,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config';

export default function ShopScreen() {
  const [shoppingItems, setShoppingItems] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const textInputRef = useRef(null);

  useEffect(() => {
    loadShoppingList();
    loadSuggestions();
  }, []);

  const getUserHeaders = async () => {
    const userEmail = await AsyncStorage.getItem('userEmail');
    return {
      ...API_CONFIG.getHeaders(),
      ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() })
    };
  };

  const loadShoppingList = async () => {
    try {
      setLoading(true);
      const headers = await getUserHeaders();
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHOPPING_LIST}`, {
        method: 'GET',
        headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        // Map backend 'completed' field to frontend 'purchased' field
        const mappedItems = (data.items || []).map(item => ({
          ...item,
          purchased: item.completed || item.purchased || false
        }));
        setShoppingItems(mappedItems);
      } else {
        setShoppingItems([]);
      }
    } catch (error) {
      console.error('Error loading shopping list:', error);
      setShoppingItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      
      // Try to load suggestions from backend first (pantry-based)
      const headers = await getUserHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/pantry-suggestions`, {
        method: 'GET',
        headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        const pantrySuggestions = data.suggestions || [];
        setSuggestions(pantrySuggestions);
        
        // Cache in AsyncStorage for faster loading
        await AsyncStorage.setItem('shopping_suggestions', JSON.stringify(pantrySuggestions));
      } else {
        // Fallback to local suggestions if backend fails
        const localSuggestions = await AsyncStorage.getItem('shopping_suggestions');
        if (localSuggestions) {
          const parsedSuggestions = JSON.parse(localSuggestions);
          setSuggestions(parsedSuggestions);
        } else {
          // Generate new suggestions if none exist
          await refreshSuggestions();
        }
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
      // Fallback to local suggestions
      try {
        const localSuggestions = await AsyncStorage.getItem('shopping_suggestions');
        if (localSuggestions) {
          const parsedSuggestions = JSON.parse(localSuggestions);
          setSuggestions(parsedSuggestions);
        } else {
          setSuggestions([]);
        }
      } catch (fallbackError) {
        setSuggestions([]);
      }
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const loadPantryData = async () => {
    try {
      const headers = await getUserHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'GET',
        headers,
      });
      
      if (response.ok) {
        const pantryData = await response.json();
        return pantryData;
      }
      return [];
    } catch (error) {
      console.log('Error loading pantry data:', error);
      return [];
    }
  };

  const refreshSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      
      // Get all saved recipes, user preferences, and pantry data
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userSpecificKey = `savedRecipes_${userEmail}`;
      
      // Load user-specific saved recipes with migration
      let savedRecipesData = await AsyncStorage.getItem(userSpecificKey);
      
      // Migration: Only migrate for sizarta (the original user) to prevent data leakage
      if (!savedRecipesData && userEmail === 'sizarta@gmail.com') {
        const oldSaved = await AsyncStorage.getItem('savedRecipes');
        if (oldSaved) {
          const oldRecipes = JSON.parse(oldSaved);
          // Migrate old recipes to user-specific storage
          await AsyncStorage.setItem(userSpecificKey, oldSaved);
          savedRecipesData = oldSaved;
          console.log(`Migrated ${oldRecipes.length} recipes for user ${userEmail} in ShopScreen`);
        }
      }
      
      const [userPreferencesData, pantryData] = await Promise.all([
        AsyncStorage.getItem('userProfile'),
        loadPantryData()
      ]);
      
      if (!savedRecipesData) {
        setSuggestions([]);
        return;
      }
      
      const savedRecipes = JSON.parse(savedRecipesData);
      const userPreferences = userPreferencesData ? JSON.parse(userPreferencesData) : {};
      const favoriteCuisines = userPreferences.cuisines || [];
      const dietaryPreferences = userPreferences.diets || [];
      
      // Filter recipes from last 7 days and prioritize
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const allSuggestions = [];
      const ingredientScores = new Map();
      
      // Essential pantry staples
      const essentialStaples = [
        { name: 'salt', category: 'Condiments', priority: 'high' },
        { name: 'black pepper', category: 'Condiments', priority: 'high' },
        { name: 'olive oil', category: 'Condiments', priority: 'high' },
        { name: 'onions', category: 'Produce', priority: 'medium' },
        { name: 'garlic', category: 'Produce', priority: 'medium' },
        { name: 'eggs', category: 'Proteins', priority: 'medium' }
      ];
      
      // Check for missing essentials
      const pantryItemNames = Array.isArray(pantryData) ? pantryData.map(item => item.name?.toLowerCase() || '') : [];
      const missingStaples = essentialStaples.filter(staple => {
        const stapleName = staple.name.toLowerCase();
        return !pantryItemNames.some(pantryItem => pantryItem.includes(stapleName));
      });
      
      // Add missing staples
      missingStaples.forEach(staple => {
        const key = staple.name.toLowerCase();
        let stapleScore = staple.priority === 'high' ? 8 : 6;
        
        ingredientScores.set(key, {
          name: staple.name,
          score: stapleScore,
          category: staple.category,
          sources: new Set(['Kitchen essential']),
          priority: staple.priority,
          isEssential: true
        });
      });

      // Add expired/expiring items
      if (Array.isArray(pantryData)) {
        const expiredItems = pantryData.filter(item => {
          const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
          const isExpired = expiryDate && expiryDate < new Date();
          const isExpiringSoon = expiryDate && expiryDate <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          return isExpired || isExpiringSoon;
        });
        
        expiredItems.forEach(item => {
          const cleanedName = item.name?.trim();
          if (cleanedName && cleanedName.length > 2) {
            const key = cleanedName.toLowerCase();
            const isExpired = new Date(item.expiryDate) < new Date();
            
            ingredientScores.set(key, {
              name: cleanedName,
              score: isExpired ? 10 : 9,
              category: item.category || 'Other',
              sources: new Set([isExpired ? 'Expired in pantry' : 'Expiring soon']),
              priority: 'high',
              isExpired: true
            });
          }
        });
      }

      // Process recent recipes
      savedRecipes.forEach(recipe => {
        const recipeDate = recipe.savedAt ? new Date(recipe.savedAt) : new Date();
        const isRecent = recipeDate >= sevenDaysAgo;
        
        const ingredients = recipe.ingredients || [];
        
        ingredients.forEach(ingredient => {
          const parsedIngredients = parseIngredientList(ingredient);
          
          parsedIngredients.forEach(cleanedName => {
            if (cleanedName && cleanedName.length > 2) {
              const key = cleanedName.toLowerCase();
              
              if (!ingredientScores.has(key)) {
                ingredientScores.set(key, {
                  name: cleanedName,
                  score: 0,
                  recipeCount: 0,
                  category: getCategoryForIngredient(cleanedName),
                  sources: new Set(),
                  isRecent: false,
                  priority: 'medium'
                });
              }
              
              const item = ingredientScores.get(key);
              item.recipeCount += 1;
              item.sources.add(recipe.name);
              
              if (isRecent) {
                item.isRecent = true;
                item.score += 3;
              }
              
              // Check cuisine match
              const recipeCuisines = recipe.cuisines || [];
              const cuisineMatch = favoriteCuisines.some(cuisine => 
                recipeCuisines.some(rc => rc.toLowerCase().includes(cuisine.toLowerCase()))
              );
              if (cuisineMatch) {
                item.score += 2;
              }
              
              // Base score
              item.score += 1;
            }
          });
        });
      });

      // Filter out existing shopping items and pantry items
      const existingItemNames = Array.isArray(shoppingItems) ? shoppingItems.map(item => item.name?.toLowerCase() || '') : [];
      const pantryItemNamesLower = Array.isArray(pantryData) ? pantryData.map(item => item.name?.toLowerCase().trim() || '') : [];
      
      const prioritizedIngredients = Array.from(ingredientScores.values())
        .filter(item => {
          const itemName = item.name.toLowerCase().trim();
          // Skip if already in shopping list
          const inShoppingList = existingItemNames.some(existing => 
            existing === itemName || existing.includes(itemName) || itemName.includes(existing)
          );
          // Skip if already in pantry (unless it's expired)
          const inPantry = !item.isExpired && pantryItemNamesLower.some(pantryItem => 
            pantryItem === itemName || pantryItem.includes(itemName) || itemName.includes(pantryItem)
          );
          return !inShoppingList && !inPantry;
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.recipeCount !== a.recipeCount) return b.recipeCount - a.recipeCount;
          return a.name.localeCompare(b.name);
        });

      // Create organized suggestions with specific breakdown
      const organizedSuggestions = [];
      
      // 1. Get 7 suggestions based on expired items and main ingredients from recent recipes
      const expiredAndRecentItems = prioritizedIngredients.filter(item => 
        item.isExpired || item.isRecent || item.isEssential
      ).slice(0, 7);
      organizedSuggestions.push(...expiredAndRecentItems);
      
      // 2. Get remaining 8 suggestions based on dietary preferences
      const remainingItems = prioritizedIngredients.filter(item => 
        !organizedSuggestions.includes(item)
      );
      
      // Prioritize items that match user's dietary preferences
      const dietaryItems = remainingItems.filter(item => {
        const itemName = item.name.toLowerCase();
        const itemCategory = item.category.toLowerCase();
        
        // Check if item matches dietary preferences
        return dietaryPreferences.some(diet => {
          const dietLower = diet.toLowerCase();
          if (dietLower.includes('keto')) {
            return ['proteins', 'dairy', 'condiments'].includes(itemCategory) ||
                   ['avocado', 'cheese', 'butter', 'oil', 'eggs'].some(keyword => itemName.includes(keyword));
          }
          if (dietLower.includes('vegan')) {
            return ['fruits & vegetables', 'grains & pantry', 'produce'].includes(itemCategory) &&
                   !['dairy', 'proteins'].includes(itemCategory);
          }
          if (dietLower.includes('mediterranean')) {
            return ['olive oil', 'tomato', 'garlic', 'lemon', 'herbs', 'fish'].some(keyword => itemName.includes(keyword));
          }
          if (dietLower.includes('vegetarian')) {
            return !['proteins'].includes(itemCategory) || 
                   ['eggs', 'cheese', 'milk'].some(keyword => itemName.includes(keyword));
          }
          return false;
        });
      });
      
      // Add dietary preference items (up to 8)
      const dietarySelection = dietaryItems.slice(0, 8);
      organizedSuggestions.push(...dietarySelection);
      
      // If we don't have enough dietary items, fill with highest scored remaining items
      if (organizedSuggestions.length < 15) {
        const fillItems = remainingItems
          .filter(item => !organizedSuggestions.includes(item))
          .slice(0, 15 - organizedSuggestions.length);
        organizedSuggestions.push(...fillItems);
      }
      
      const finalSuggestions = organizedSuggestions.slice(0, 15);
      
      // Debug log the suggestion breakdown
      console.log(`📋 Smart Suggestions Breakdown:`);
      console.log(`  - Expired/Recent/Essential: ${expiredAndRecentItems.length}`);
      console.log(`  - Dietary Preferences: ${dietarySelection.length}`);
      console.log(`  - Total Final: ${finalSuggestions.length}`);
      console.log(`  - User Dietary Preferences: ${dietaryPreferences.join(', ')}`);

      // Create suggestion objects with priority colors
      const intelligentSuggestions = finalSuggestions.map((item, index) => {
        let priority = 'medium';
        let reason = 'From your recipes';
        
        if (item.isExpired) {
          priority = 'high';
          reason = item.sources.has('Expired in pantry') ? 'Replace expired item' : 'Replace expiring item';
        } else if (item.isEssential) {
          priority = item.priority;
          reason = item.priority === 'high' ? 'Essential kitchen staple' : 'Important pantry item';
        } else if (item.isRecent && item.recipeCount > 1) {
          priority = 'high';
          reason = `Used in ${item.recipeCount} recent recipes`;
        } else if (item.isRecent) {
          priority = 'medium';
          reason = 'From recent recipes';
        } else if (item.recipeCount > 2) {
          priority = 'medium';
          reason = `Used in ${item.recipeCount} of your recipes`;
        }

        return {
          id: `intelligent_${Date.now()}_${index}`,
          name: item.name,
          reason: reason,
          priority,
          category: item.category,
          score: item.score,
          recipeCount: item.recipeCount || 1,
          isExpired: item.isExpired || false,
          isEssential: item.isEssential || false
        };
      });
      
      if (intelligentSuggestions.length > 0) {
        // Save to backend for pantry-wide sharing
        try {
          const headers = await getUserHeaders();
          const response = await fetch(`${API_CONFIG.BASE_URL}/pantry-suggestions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ suggestions: intelligentSuggestions }),
          });
          
          if (response.ok) {
            console.log('Suggestions saved to backend for pantry sharing');
          } else {
            console.warn('Failed to save suggestions to backend, using local storage');
          }
        } catch (error) {
          console.error('Error saving suggestions to backend:', error);
        }
        
        // Always cache locally and update state
        await AsyncStorage.setItem('shopping_suggestions', JSON.stringify(intelligentSuggestions));
        setSuggestions(intelligentSuggestions);
      } else {
        setSuggestions([]);
      }
      
    } catch (error) {
      console.error('Error generating intelligent suggestions:', error);
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const cleanIngredientName = (ingredient) => {
    let cleaned = String(ingredient).trim();
    
    // Remove quantities and measurements
    cleaned = cleaned.replace(/^\d+(\.\d+)?\s*/, '');
    cleaned = cleaned.replace(/^\d*\/\d+\s*/, '');
    cleaned = cleaned.replace(/^\d+\s+\d+\/\d+\s*/, '');
    
    const measurements = [
      'cups?', 'tbsp', 'tsp', 'oz', 'lbs?', 'kg', 'g', 'ml', 'l',
      'cloves?', 'slices?', 'pieces?', 'cans?', 'bottles?'
    ];
    
    measurements.forEach(measurement => {
      const regex = new RegExp(`\\b${measurement}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Remove common phrases
    cleaned = cleaned.replace(/\s*to taste\s*$/gi, '');
    cleaned = cleaned.replace(/\s*as needed\s*$/gi, '');
    cleaned = cleaned.replace(/\s*for seasoning\s*$/gi, '');
    
    return cleaned.trim();
  };

  const parseIngredientList = (ingredient) => {
    let cleaned = cleanIngredientName(ingredient);
    
    // Handle compound ingredients that should be split
    const compoundPatterns = [
      /salt\s+and\s+pepper/gi,
      /salt\s*&\s*pepper/gi,
      /salt\s*,\s*pepper/gi
    ];
    
    // Check if this is a compound ingredient that should be split
    for (const pattern of compoundPatterns) {
      if (pattern.test(cleaned)) {
        // Return multiple ingredients
        if (pattern.source.includes('salt') && pattern.source.includes('pepper')) {
          return ['salt', 'black pepper'];
        }
      }
    }
    
    // Handle other common compound ingredients
    if (cleaned.toLowerCase().includes('oil and vinegar')) {
      return ['olive oil', 'vinegar'];
    }
    
    if (cleaned.toLowerCase().includes('flour and water')) {
      return ['flour', 'water'];
    }
    
    // Return single ingredient if no compound pattern matched
    return [cleaned];
  };

  const getCategoryForIngredient = (ingredient) => {
    const lowercaseName = ingredient.toLowerCase();
    const categories = {
      'meat': 'Proteins', 'chicken': 'Proteins', 'beef': 'Proteins', 'fish': 'Proteins',
      'milk': 'Dairy', 'cheese': 'Dairy', 'yogurt': 'Dairy',
      'apple': 'Fruits & Vegetables', 'banana': 'Fruits & Vegetables', 'tomato': 'Fruits & Vegetables',
      'onion': 'Fruits & Vegetables', 'garlic': 'Fruits & Vegetables',
      'bread': 'Grains & Pantry', 'rice': 'Grains & Pantry', 'pasta': 'Grains & Pantry',
      'salt': 'Condiments', 'pepper': 'Condiments', 'oil': 'Condiments'
    };
    
    return Object.keys(categories).find(key => lowercaseName.includes(key))
           ? categories[Object.keys(categories).find(key => lowercaseName.includes(key))]
           : 'Other';
  };


  const getCategoryForItem = (itemName) => {
    const lowercaseName = itemName.toLowerCase();
    const categories = {
      'meat': 'Proteins',
      'chicken': 'Proteins',
      'beef': 'Proteins',
      'fish': 'Proteins',
      'milk': 'Dairy',
      'cheese': 'Dairy',
      'yogurt': 'Dairy',
      'apple': 'Fruits & Vegetables',
      'banana': 'Fruits & Vegetables',
      'tomato': 'Fruits & Vegetables',
      'onion': 'Fruits & Vegetables',
      'bread': 'Grains & Pantry',
      'rice': 'Grains & Pantry',
      'pasta': 'Grains & Pantry'
    };
    
    return Object.keys(categories).find(key => lowercaseName.includes(key))
           ? categories[Object.keys(categories).find(key => lowercaseName.includes(key))]
           : 'Other';
  };

  const addItem = async (itemData = null) => {
    const itemName = itemData ? itemData.name : newItemText.trim();
    
    if (!itemName) {
      Alert.alert('Error', 'Please enter an item name.');
      return;
    }

    try {
      setAddingItem(true);
      const headers = await getUserHeaders();
      
      const newItem = {
        name: itemName,
        category: itemData ? itemData.category : getCategoryForItem(itemName),
        completed: false,
        reason: itemData ? itemData.reason : 'Manually added',
        priority: itemData ? itemData.priority : 'medium'
      };
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHOPPING_LIST}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ item: newItem }),
      });
      
      if (response.ok) {
        if (!itemData) {
          setNewItemText('');
          setShowAddModal(false);
        }
        await loadShoppingList();
        Alert.alert('Success', 'Item added to shopping list!');
      } else {
        Alert.alert('Error', 'Failed to add item');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setAddingItem(false);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      const headers = await getUserHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHOPPING_LIST}?id=${itemId}`, {
        method: 'DELETE',
        headers,
      });
      
      if (response.ok) {
        setShoppingItems(shoppingItems.filter(item => item.id !== itemId));
      } else {
        throw new Error('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Error', 'Failed to remove item from shopping list');
    }
  };

  const togglePurchased = async (itemId) => {
    try {
      // Find the current item to get its current purchased state
      const currentItem = shoppingItems.find(item => item.id === itemId);
      const newPurchasedState = !currentItem?.purchased;
      
      // Update local state immediately for better UX
      setShoppingItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId 
            ? { ...item, purchased: newPurchasedState, completed: newPurchasedState }
            : item
        )
      );
      
      // Update backend
      const headers = await getUserHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/shopping/list/${itemId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          purchased: newPurchasedState,
          completed: newPurchasedState
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update item on server');
      }
      
      console.log(`Item ${itemId} marked as ${newPurchasedState ? 'purchased' : 'not purchased'}`);
      
    } catch (error) {
      console.error('Error toggling purchased state:', error);
      // Revert the change if there's an error
      setShoppingItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId 
            ? { ...item, purchased: !item.purchased, completed: !item.completed }
            : item
        )
      );
    }
  };

  const removeSuggestion = async (suggestionId) => {
    try {
      // Filter out the suggestion from the list
      const updatedSuggestions = suggestions.filter(s => s.id !== suggestionId);
      setSuggestions(updatedSuggestions);
      
      // Update AsyncStorage cache
      await AsyncStorage.setItem('shopping_suggestions', JSON.stringify(updatedSuggestions));
    } catch (error) {
      console.error('Error removing suggestion:', error);
    }
  };

  const addSuggestionToList = async (suggestion) => {
    const existingItem = shoppingItems.find(item => 
      item.name.toLowerCase() === suggestion.name.toLowerCase()
    );
    
    if (existingItem) {
      Alert.alert('Already Added', `${suggestion.name} is already in your shopping list.`);
      return;
    }

    await addItem(suggestion);
    
    // Remove from suggestions after adding
    const updatedSuggestions = suggestions.filter(s => s.id !== suggestion.id);
    setSuggestions(updatedSuggestions);
    
    // Update backend to remove suggestion for all pantry users
    try {
      const headers = await getUserHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/pantry-suggestions`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ suggestionId: suggestion.id }),
      });
      
      if (response.ok) {
        console.log('Suggestion removed from backend for all pantry users');
      } else {
        console.warn('Failed to remove suggestion from backend');
      }
    } catch (error) {
      console.error('Error removing suggestion from backend:', error);
    }
    
    // Update local cache
    try {
      await AsyncStorage.setItem('shopping_suggestions', JSON.stringify(updatedSuggestions));
    } catch (error) {
      console.error('Error updating suggestions in AsyncStorage:', error);
    }
  };

  const clearAllSuggestions = async () => {
    try {
      // Clear from backend for all pantry users
      const headers = await getUserHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/pantry-suggestions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ suggestions: [] }),
      });
      
      if (response.ok) {
        console.log('Suggestions cleared from backend for all pantry users');
      } else {
        console.warn('Failed to clear suggestions from backend');
      }
    } catch (error) {
      console.error('Error clearing suggestions from backend:', error);
    }
    
    // Clear local state and cache
    setSuggestions([]);
    await AsyncStorage.removeItem('shopping_suggestions');
  };

  const shareShoppingList = async () => {
    try {
      let message = `Mireva Shopping List\n`;
      message += `${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

      shoppingItems.forEach(item => {
        message += `• ${item.name}\n`;
      });

      message += `\nTotal items: ${shoppingItems.length}\n\n`;
      message += `Shared from Mireva Smart Pantry`;
      
      await Share.share({
        message,
        title: 'Mireva Shopping List',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };




  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.coverContainer}>
        <Image
          source={require('../assets/Mireva-top.png')}
          style={styles.coverImage}
        />
        <View style={styles.coverOverlay}>
          <Text style={styles.title}>Shopping List</Text>
          <Text style={styles.subtitle}>
            Smart shopping • {shoppingItems.length} items
          </Text>
        </View>
      </View>

      <View style={styles.circularButtonsContainer}>
        <TouchableOpacity style={styles.circularButtonWrapper} onPress={shareShoppingList}>
          <View style={[styles.circularButton, styles.shareButton]}>
            <Text style={styles.circularButtonText}>Share</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.circularButtonWrapper} onPress={() => setShowAddModal(true)}>
          <View style={[styles.squareButton, styles.addSquareButton]}>
            <Text style={styles.squareButtonText}>Add</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.circularButtonWrapper} onPress={refreshSuggestions}>
          <View style={[styles.circularButton, styles.refreshButton]}>
            <Text style={styles.circularButtonText}>Refresh</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.circularButtonWrapper} onPress={clearAllSuggestions}>
          <View style={[styles.circularButton, styles.clearButton]}>
            <Text style={styles.circularButtonText}>Clear</Text>
          </View>
        </TouchableOpacity>
      </View>


      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Smart Suggestions</Text>
          {suggestionsLoading ? (
            <ActivityIndicator size="small" color="#2D6A4F" />
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.suggestionsScroll}
              contentContainerStyle={styles.suggestionsScrollContent}
            >
              {suggestions.slice(0, 15).map((suggestion, index) => (
                <View
                  key={suggestion.id}
                  style={[
                    styles.suggestionCard,
                    suggestion.priority === 'high' ? styles.suggestionCardHigh :
                    suggestion.priority === 'medium' ? styles.suggestionCardMedium :
                    styles.suggestionCardLow
                  ]}
                >
                  <View style={styles.suggestionContent}>
                    <View style={styles.suggestionInfo}>
                      <Text style={styles.suggestionName} numberOfLines={2}>
                        {suggestion.name}
                      </Text>
                      
                      <Text style={styles.suggestionReason} numberOfLines={2}>
                        {suggestion.reason}
                      </Text>
                    </View>
                    
                    <View style={styles.suggestionButtonsContainer}>
                      <TouchableOpacity 
                        style={styles.suggestionAddButton}
                        onPress={() => addSuggestionToList(suggestion)}
                      >
                        <Text style={styles.suggestionButtonText}>+</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.suggestionRemoveButton}
                        onPress={() => removeSuggestion(suggestion.id)}
                      >
                        <Text style={styles.suggestionButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Your List ({shoppingItems.length})</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#2D6A4F" style={styles.loader} />
        ) : (
          <ScrollView style={styles.itemsList}>
            {shoppingItems.map((item) => (
              <View key={item.id} style={[
                styles.itemCard,
                item.purchased && styles.purchasedItemCard
              ]}>
                <TouchableOpacity
                  style={styles.purchaseCheckbox}
                  onPress={() => togglePurchased(item.id)}
                >
                  <View style={[
                    styles.checkbox,
                    item.purchased && styles.checkedBox
                  ]}>
                    {item.purchased && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
                
                <View style={styles.itemInfo}>
                  <Text style={[
                    styles.itemName,
                    item.purchased && styles.purchasedText
                  ]}>
                    {item.name}
                  </Text>
                  <Text style={[
                    styles.itemCategory,
                    item.purchased && styles.purchasedText
                  ]}>
                    {item.category}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteItem(item.id)}
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {shoppingItems.length === 0 && (
              <Text style={styles.emptyText}>Your shopping list is empty</Text>
            )}
          </ScrollView>
        )}
      </View>

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add New Item</Text>
            
            <TextInput
              ref={textInputRef}
              style={styles.modalInput}
              placeholder="Enter item name..."
              value={newItemText}
              onChangeText={setNewItemText}
              onSubmitEditing={() => {
                addItem();
                setShowAddModal(false);
              }}
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setNewItemText('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalAddButton, addingItem && styles.modalAddButtonDisabled]}
                onPress={() => {
                  addItem();
                  setShowAddModal(false);
                }}
                disabled={addingItem}
              >
                {addingItem ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalAddText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  coverContainer: {
    position: 'relative',
    height: 120,
    backgroundColor: '#2D6A4F',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  circularButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 25,
    gap: 25,
  },
  circularButtonWrapper: {
    alignItems: 'center',
  },
  circularButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 8,
  },
  shareButton: {
    backgroundColor: '#2D6A4F',
  },
  addCircularButton: {
    backgroundColor: '#FF6B35',
  },
  squareButton: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 8,
  },
  addSquareButton: {
    backgroundColor: '#FF6B35',
  },
  squareButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#2D6A4F',
  },
  clearButton: {
    backgroundColor: '#2D6A4F',
  },
  circularButtonText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  suggestionsContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A202C',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  suggestionsScroll: {
    marginHorizontal: -20,
  },
  suggestionsScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  suggestionCard: {
    width: 140,
    minHeight: 160,
    padding: 0,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  suggestionCardHigh: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FC8181',
  },
  suggestionCardMedium: {
    backgroundColor: '#FFFAF0',
    borderWidth: 1.5,
    borderColor: '#F6AD55',
  },
  suggestionCardLow: {
    backgroundColor: '#FFF5F0',
    borderWidth: 1.5,
    borderColor: '#FFB088',
  },
  suggestionContent: {
    flex: 1,
    padding: 12,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 8,
    lineHeight: 20,
  },
  suggestionReason: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 14,
  },
  suggestionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginTop: 10,
  },
  suggestionAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  suggestionRemoveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  suggestionButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  listContainer: {
    flex: 1,
    marginHorizontal: 20,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 15,
  },
  loader: {
    marginTop: 50,
  },
  itemsList: {
    flex: 1,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFE4D6',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  purchasedItemCard: {
    backgroundColor: '#F8F9FA',
    opacity: 0.7,
    borderColor: '#E5E7EB',
  },
  purchaseCheckbox: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  purchasedText: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  itemCategory: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  deleteButton: {
    backgroundColor: '#F7FAFC',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteButtonText: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#718096',
    fontSize: 16,
    marginTop: 50,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F7FAFC',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#718096',
    fontSize: 16,
    fontWeight: '600',
  },
  modalAddButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
  },
  modalAddButtonDisabled: {
    backgroundColor: '#A0AEC0',
  },
  modalAddText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});