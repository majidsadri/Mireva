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
        setShoppingItems(data.items || []);
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
      const [savedRecipesData, userPreferencesData, pantryData] = await Promise.all([
        AsyncStorage.getItem('savedRecipes'),
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

      // Filter out existing shopping items
      const existingItemNames = Array.isArray(shoppingItems) ? shoppingItems.map(item => item.name?.toLowerCase() || '') : [];
      
      const prioritizedIngredients = Array.from(ingredientScores.values())
        .filter(item => {
          const itemName = item.name.toLowerCase();
          return !existingItemNames.some(existing => 
            existing === itemName || existing.includes(itemName) || itemName.includes(existing)
          );
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
      const items = shoppingItems.map(item => `• ${item.name}`).join('\n');
      const message = `My Shopping List:\n\n${items}`;
      
      await Share.share({
        message,
        title: 'Shopping List',
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
          <View style={[styles.circularButton, styles.addButton]}>
            <Text style={styles.circularButtonText}>Add</Text>
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
                <TouchableOpacity
                  key={suggestion.id}
                  style={[
                    styles.suggestionCard,
                    suggestion.priority === 'high' ? styles.suggestionCardHigh :
                    suggestion.priority === 'medium' ? styles.suggestionCardMedium :
                    styles.suggestionCardLow
                  ]}
                  onPress={() => addSuggestionToList(suggestion)}
                >
                  <View style={styles.suggestionHeader}>
                    <View style={[
                      styles.priorityIndicator,
                      suggestion.priority === 'high' ? styles.priorityIndicatorHigh :
                      suggestion.priority === 'medium' ? styles.priorityIndicatorMedium :
                      styles.priorityIndicatorLow
                    ]} />
                  </View>
                  
                  <Text style={styles.suggestionName}>{suggestion.name}</Text>
                  
                  <View style={styles.suggestionMeta}>
                    <Text style={styles.suggestionReason}>
                      {suggestion.reason}
                    </Text>
                    {suggestion.recipeCount > 1 && (
                      <Text style={styles.recipeCount}>
                        {suggestion.recipeCount} recipes
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.addButton}>
                    <Text style={styles.addButtonText}>+ Add</Text>
                  </View>
                </TouchableOpacity>
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
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{item.category}</Text>
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
  addButton: {
    backgroundColor: '#FF6B35',
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
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    position: 'relative',
  },
  suggestionCardHigh: {
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: '#FC8181',
  },
  suggestionCardMedium: {
    backgroundColor: '#FFFAF0',
    borderWidth: 2,
    borderColor: '#F6AD55',
  },
  suggestionCardLow: {
    backgroundColor: '#F0FFF4',
    borderWidth: 2,
    borderColor: '#68D391',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    marginBottom: 8,
    height: 12,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityIndicatorHigh: {
    backgroundColor: '#E53E3E',
  },
  priorityIndicatorMedium: {
    backgroundColor: '#FF8C00',
  },
  priorityIndicatorLow: {
    backgroundColor: '#38A169',
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 6,
    lineHeight: 18,
  },
  suggestionMeta: {
    marginBottom: 10,
  },
  suggestionReason: {
    fontSize: 10,
    color: '#718096',
    fontWeight: '500',
    marginBottom: 2,
    lineHeight: 12,
  },
  recipeCount: {
    fontSize: 9,
    color: '#A0AEC0',
    fontWeight: '600',
  },
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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