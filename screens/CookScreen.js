import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config';

export default function CookScreen() {
  const [recipes, setRecipes] = useState([]);
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pantryItems, setPantryItems] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [mode, setMode] = useState('recommend'); // 'recommend' or 'search'
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [cachedRecommendations, setCachedRecommendations] = useState([]);
  const [lastRecommendationTime, setLastRecommendationTime] = useState(null);
  const [cachedSearchResults, setCachedSearchResults] = useState([]);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [backendError, setBackendError] = useState(false);

  useEffect(() => {
    loadInitialData();
    loadSavedRecipes();
  }, []);

  const loadInitialData = async () => {
    // Check if we have cached search results for the current search mode
    if (mode === 'search' && cachedSearchResults.length > 0 && lastSearchQuery === searchQuery) {
      console.log('Restoring cached search results');
      setRecipes(cachedSearchResults);
      setCurrentRecipeIndex(0);
    } else if (mode === 'recommend') {
      // Load recommendations as usual
      loadCachedOrFreshRecommendations();
    } else {
      // Default load
      loadPantryAndRecommendations();
    }
  };

  const loadSavedRecipes = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userSpecificKey = `savedRecipes_${userEmail}`;
      let saved = await AsyncStorage.getItem(userSpecificKey);
      let savedRecipesData = saved ? JSON.parse(saved) : [];

      // Migration: Only migrate for sizarta (the original user) to prevent data leakage
      if (savedRecipesData.length === 0 && userEmail === 'sizarta@gmail.com') {
        const oldSaved = await AsyncStorage.getItem('savedRecipes');
        if (oldSaved) {
          const oldRecipes = JSON.parse(oldSaved);
          // Migrate old recipes to user-specific storage
          await AsyncStorage.setItem(userSpecificKey, oldSaved);
          savedRecipesData = oldRecipes;
          console.log(`Migrated ${oldRecipes.length} recipes for user ${userEmail} in CookScreen`);
        }
      }

      if (savedRecipesData.length > 0) {
        setSavedRecipes(savedRecipesData);
      }
      
      // Load cached search results
      const cachedSearch = await AsyncStorage.getItem('cachedSearchResults');
      const cachedQuery = await AsyncStorage.getItem('lastSearchQuery');
      if (cachedSearch && cachedQuery) {
        setCachedSearchResults(JSON.parse(cachedSearch));
        setLastSearchQuery(cachedQuery);
      }
    } catch (error) {
      console.error('Error loading saved recipes:', error);
    }
  };

  const searchRecipes = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Please enter a recipe name to search');
      return;
    }

    try {
      setSearching(true);
      setCurrentRecipeIndex(0);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH_RECIPES}`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({ query: searchQuery }),
      });
      
      const data = await response.json();
      if (data.recipes && data.recipes.length > 0) {
        setRecipes(data.recipes);
        // Cache search results
        setCachedSearchResults(data.recipes);
        setLastSearchQuery(searchQuery);
        
        // Persist to AsyncStorage
        await AsyncStorage.setItem('cachedSearchResults', JSON.stringify(data.recipes));
        await AsyncStorage.setItem('lastSearchQuery', searchQuery);
      } else {
        Alert.alert('No recipes found', 'Try searching for something else');
      }
    } catch (error) {
      console.error('Error searching recipes:', error);
      Alert.alert('Error', 'Failed to search recipes. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const loadCachedOrFreshRecommendations = async () => {
    // Check if we have cached recommendations from the last 30 minutes
    const now = Date.now();
    const cacheValidTime = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    if (cachedRecommendations.length > 0 && 
        lastRecommendationTime && 
        (now - lastRecommendationTime) < cacheValidTime) {
      // Use cached recommendations
      console.log('Using cached recommendations');
      setRecipes(cachedRecommendations);
      setCurrentRecipeIndex(0);
      return;
    }
    
    // Fetch fresh recommendations
    console.log('Fetching fresh recommendations');
    await loadPantryAndRecommendations();
  };

  const loadPantryAndRecommendations = async () => {
    try {
      setLoading(true);
      setBackendError(false); // Reset error state
      
      // Get user email for pantry request
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      // Load pantry items with user email header
      const pantryHeaders = {
        ...API_CONFIG.getHeaders(),
        ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() })
      };
      
      const pantryResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'GET',
        headers: pantryHeaders,
      });
      
      if (!pantryResponse.ok) {
        throw new Error(`Pantry request failed: ${pantryResponse.status}`);
      }
      
      const pantryData = await pantryResponse.json();
      setPantryItems(pantryData);
      
      // Get recipe recommendations 
      let ingredients = [];
      if (pantryData.length > 0) {
        // Use pantry items as ingredients
        ingredients = pantryData.map(item => item.name);
      } else {
        // Fallback to popular ingredients for general recommendations
        ingredients = ['chicken', 'rice', 'vegetables', 'onion', 'garlic'];
      }
      
      const recommendResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RECOMMEND}`, {
        method: 'POST',
        headers: pantryHeaders,
        body: JSON.stringify({ ingredients }),
      });
      
      if (!recommendResponse.ok) {
        throw new Error(`Recommendations request failed: ${recommendResponse.status}`);
      }
      
      const recommendData = await recommendResponse.json();
      console.log('Received data from backend:', recommendData);
      if (recommendData.recipes && recommendData.recipes.length > 0) {
        console.log('Setting recipes:', recommendData.recipes.length, 'recipes');
        setRecipes(recommendData.recipes);
        // Cache the recommendations
        setCachedRecommendations(recommendData.recipes);
        setLastRecommendationTime(Date.now());
      } else {
        console.log('No recipes in response data');
        throw new Error('No recipes received from backend');
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      console.error('Error details:', error.message);
      setBackendError(true);
      setRecipes([]); // Clear any existing recipes
    } finally {
      setLoading(false);
    }
  };

  const loadMoreRecipes = async () => {
    try {
      setLoadingMore(true);
      
      // Get user email for pantry request
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      // Load pantry items with user email header
      const pantryHeaders = {
        ...API_CONFIG.getHeaders(),
        ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() })
      };
      
      const pantryResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'GET',
        headers: pantryHeaders,
      });
      const pantryData = await pantryResponse.json();
      
      // Get more recipe recommendations 
      let ingredients = [];
      if (pantryData.length > 0) {
        // Use pantry items as ingredients
        ingredients = pantryData.map(item => item.name);
      } else {
        // Fallback to popular ingredients for general recommendations
        ingredients = ['pasta', 'tomato', 'cheese', 'beef', 'potato', 'salmon'];
      }
      
      const recommendResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RECOMMEND}`, {
        method: 'POST',
        headers: pantryHeaders,
        body: JSON.stringify({ ingredients }),
      });
      
      const recommendData = await recommendResponse.json();
      if (recommendData.recipes) {
        // Append new recipes to existing ones, avoiding duplicates
        const newRecipes = recommendData.recipes.filter(newRecipe => 
          !recipes.some(existingRecipe => existingRecipe.name === newRecipe.name)
        );
        const updatedRecipes = [...recipes, ...newRecipes];
        setRecipes(updatedRecipes);
        // Update cache with the expanded list
        setCachedRecommendations(updatedRecipes);
        setLastRecommendationTime(Date.now());
      }
    } catch (error) {
      console.error('Error loading more recipes:', error);
      Alert.alert('Error', 'Failed to load more recipes. Please check your internet connection and try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const cleanIngredientName = (ingredient) => {
    // Extract clean ingredient name from string with quantities
    let cleaned = String(ingredient).trim();
    
    // Remove quantities including fractions (e.g., "1/2", "2 1/4", "1.5")
    cleaned = cleaned.replace(/^\d+(\.\d+)?\s*/, ''); // Remove decimal numbers at start
    cleaned = cleaned.replace(/^\d*\/\d+\s*/, ''); // Remove fractions at start like "1/2"
    cleaned = cleaned.replace(/^\d+\s+\d+\/\d+\s*/, ''); // Remove mixed numbers like "2 1/4"
    
    // Remove common measurements
    const measurements = [
      'cups?', 'cup', 'tbsp', 'tablespoons?', 'tsp', 'teaspoons?',
      'oz', 'ounces?', 'lbs?', 'pounds?', 'kg', 'grams?', 'g',
      'ml', 'liters?', 'l', 'pints?', 'quarts?', 'gallons?',
      'cloves?', 'slices?', 'pieces?', 'cans?', 'bottles?'
    ];
    
    measurements.forEach(measurement => {
      const regex = new RegExp(`\\b${measurement}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Remove extra words
    const removeWords = [
      'of', 'fresh', 'chopped', 'diced', 'sliced', 'minced',
      'large', 'small', 'medium', 'whole', 'ground', 'grated'
    ];
    
    removeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Clean up extra spaces, punctuation, and leftover fraction symbols
    cleaned = cleaned.replace(/[,\(\)\/]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove any remaining isolated numbers or short fragments
    if (cleaned.length <= 2 || /^\d+$/.test(cleaned)) {
      return ingredient; // Return original if too short or just numbers
    }
    
    return cleaned;
  };

  const addIngredientsToShoppingSuggestions = async (ingredients, recipeName) => {
    try {
      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return 0;
      }

      console.log(`🔸 Adding ingredients from ${recipeName} and regenerating intelligent suggestions`);
      
      // Instead of just adding ingredients, trigger intelligent suggestions regeneration
      // This ensures the new recipe is factored into the smart prioritization
      
      // First, let the recipe be saved to AsyncStorage (this happens in saveRecipe)
      // Then trigger a refresh of intelligent suggestions
      setTimeout(async () => {
        try {
          // Get user preferences for intelligent processing
          const userPreferencesData = await AsyncStorage.getItem('userProfile');
          const userEmail = await AsyncStorage.getItem('userEmail');
          const userSpecificKey = `savedRecipes_${userEmail}`;
          const savedRecipesData = await AsyncStorage.getItem(userSpecificKey);
          
          if (!savedRecipesData) return 0;
          
          const savedRecipes = JSON.parse(savedRecipesData);
          const userPreferences = userPreferencesData ? JSON.parse(userPreferencesData) : {};
          const favoriteCuisines = userPreferences.cuisines || [];
          const dietaryPreferences = userPreferences.diets || [];
          
          // Filter recipes from last 3 days and prioritize
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          
          const ingredientScores = new Map();
          
          for (const recipe of savedRecipes) {
            if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) continue;
            
            const recipeDate = new Date(recipe.savedAt || recipe.timestamp || 0);
            const isRecent = recipeDate >= threeDaysAgo;
            const cuisineMatch = favoriteCuisines.some(cuisine => 
              recipe.name?.toLowerCase().includes(cuisine.toLowerCase()) ||
              recipe.description?.toLowerCase().includes(cuisine.toLowerCase())
            );
            const dietMatch = dietaryPreferences.some(diet => 
              recipe.name?.toLowerCase().includes(diet.toLowerCase()) ||
              recipe.description?.toLowerCase().includes(diet.toLowerCase())
            );
            
            // Calculate recipe priority score
            let recipeScore = 1;
            if (isRecent) recipeScore += 3; // Recent recipes get +3 points
            if (cuisineMatch) recipeScore += 2; // Favorite cuisine gets +2 points
            if (dietMatch) recipeScore += 2; // Dietary preference gets +2 points
            
            recipe.ingredients.forEach(ingredient => {
              const cleanedName = cleanIngredientName(ingredient);
              
              if (cleanedName && cleanedName.length > 2) {
                const key = cleanedName.toLowerCase();
                
                if (ingredientScores.has(key)) {
                  const existing = ingredientScores.get(key);
                  existing.score += recipeScore;
                  existing.recipeCount++;
                  existing.sources.add(recipe.name);
                } else {
                  ingredientScores.set(key, {
                    name: cleanedName,
                    score: recipeScore,
                    recipeCount: 1,
                    category: getCategoryForIngredient(cleanedName),
                    sources: new Set([recipe.name]),
                    isRecent,
                    cuisineMatch,
                    dietMatch
                  });
                }
              }
            });
          }
          
          // Sort and limit to top 15
          const prioritizedIngredients = Array.from(ingredientScores.values())
            .sort((a, b) => {
              if (b.score !== a.score) return b.score - a.score;
              if (b.recipeCount !== a.recipeCount) return b.recipeCount - a.recipeCount;
              return a.name.localeCompare(b.name);
            })
            .slice(0, 15);
          
          // Create intelligent suggestions
          const intelligentSuggestions = prioritizedIngredients.map((item, index) => {
            const priority = index < 5 ? 'high' : index < 10 ? 'medium' : 'low';
            const sourceList = Array.from(item.sources).slice(0, 2);
            const sourceText = sourceList.length > 1 
              ? `${sourceList.length} recipes (${sourceList[0]}, ${sourceList[1]}...)`
              : `Recipe: ${sourceList[0]}`;
            
            return {
              id: `intelligent_${Date.now()}_${index}`,
              name: item.name,
              source: sourceText,
              reason: item.isRecent ? 'From recent recipes' : 
                     item.cuisineMatch ? 'Matches your cuisine preference' :
                     item.dietMatch ? 'Matches your dietary preference' :
                     'From your saved recipes',
              type: 'intelligent_suggestion',
              priority,
              score: item.score,
              recipeCount: item.recipeCount,
              addedAt: new Date().toISOString(),
              category: item.category
            };
          });
          
          if (intelligentSuggestions.length > 0) {
            await AsyncStorage.setItem('shopping_suggestions', JSON.stringify(intelligentSuggestions));
            console.log(`🎉 Generated ${intelligentSuggestions.length} intelligent suggestions after saving ${recipeName}`);
          }
          
        } catch (error) {
          console.log('Error generating intelligent suggestions:', error);
        }
      }, 100); // Small delay to ensure recipe is saved first
      
      return ingredients.length; // Return count for user feedback
    } catch (error) {
      console.log('Failed to add ingredient suggestions:', error);
      return 0;
    }
  };

  const getCategoryForIngredient = (ingredient) => {
    const name = ingredient.toLowerCase();
    
    if (['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'].some(item => name.includes(item))) {
      return 'Dairy';
    } else if (['chicken', 'beef', 'pork', 'fish', 'salmon', 'bacon'].some(item => name.includes(item))) {
      return 'Meat';
    } else if (['apple', 'banana', 'tomato', 'onion', 'garlic', 'carrot', 'lettuce'].some(item => name.includes(item))) {
      return 'Produce';
    } else if (['bread', 'rice', 'pasta', 'flour', 'oats'].some(item => name.includes(item))) {
      return 'Grains';
    } else {
      return 'Other';
    }
  };

  const saveRecipe = async (recipe) => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const recipeWithTimestamp = {
        ...recipe,
        savedAt: new Date().toISOString(),
        savedBy: userEmail,
        id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      const updatedSaved = [...savedRecipes, recipeWithTimestamp];
      setSavedRecipes(updatedSaved);
      const userSpecificKey = `savedRecipes_${userEmail}`;
      await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedSaved));

      // Note: Suggestions are added in the UI callback to get count for user feedback
      
      // Also save to backend log
      try {
        const headers = {
          ...API_CONFIG.getHeaders(),
          ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() })
        };
        
        await fetch(`${API_CONFIG.BASE_URL}/log-recipe`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            recipe: recipeWithTimestamp,
            action: 'saved'
          }),
        });
      } catch (backendError) {
        console.log('Backend logging failed (non-critical):', backendError);
      }
      
      return true;
    } catch (error) {
      console.error('Error saving recipe:', error);
      return false;
    }
  };

  const isRecipeSaved = (recipe) => {
    return savedRecipes.some(saved => saved.name === recipe.name);
  };

  const currentRecipe = recipes[currentRecipeIndex] || {};

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text style={styles.loadingText}>Finding recipes for you...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentRecipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.noRecipesText}>Unable to load recipes at the moment. Please try again!</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadPantryAndRecommendations}>
            <Text style={styles.refreshButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Cover Image */}
      <View style={styles.coverContainer}>
        <Image
          source={require('../assets/Mireva-top.png')}
          style={styles.coverImage}
        />
        <View style={styles.coverOverlay}>
          <Text style={styles.title}>
            {mode === 'recommend' ? 'Recipe Recommendations' : 'Search Recipes'}
          </Text>
          {recipes.length > 0 && (
            <Text style={styles.subtitle}>
              Recipe {currentRecipeIndex + 1} of {recipes.length}
              {mode === 'recommend' && (pantryItems.length > 0 ? ' • Based on your pantry' : ' • Popular recipes')}
            </Text>
          )}
        </View>
      </View>

      {/* Mode Toggle and Search Bar */}
      <View style={styles.controlsContainer}>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'recommend' && styles.modeButtonActive]}
            onPress={() => {
              setMode('recommend');
              loadCachedOrFreshRecommendations();
            }}
          >
            <Text style={[styles.modeButtonText, mode === 'recommend' && styles.modeButtonTextActive]}>
              Recommend
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'search' && styles.modeButtonActive]}
            onPress={() => {
              setMode('search');
              // Restore cached search results if available
              if (cachedSearchResults.length > 0 && lastSearchQuery) {
                console.log('Restoring cached search results for:', lastSearchQuery);
                setRecipes(cachedSearchResults);
                setSearchQuery(lastSearchQuery);
                setCurrentRecipeIndex(0);
              } else {
                setRecipes([]); // Clear recipes when no cached results
                setCurrentRecipeIndex(0);
              }
            }}
          >
            <Text style={[styles.modeButtonText, mode === 'search' && styles.modeButtonTextActive]}>
              Search
            </Text>
          </TouchableOpacity>
        </View>
        
        {mode === 'recommend' && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={async () => {
              // Clear ALL cache and force fresh recommendations
              setCachedRecommendations([]);
              setLastRecommendationTime(null);
              
              // Clear AsyncStorage cache
              try {
                await AsyncStorage.removeItem('cachedRecommendations');
                await AsyncStorage.removeItem('lastRecommendationTime');
                await AsyncStorage.removeItem('cachedSearchResults');
                await AsyncStorage.removeItem('lastSearchQuery');
                console.log('Cleared all recipe cache from storage');
              } catch (error) {
                console.log('Error clearing cache:', error);
              }
              
              // Force fresh recommendations
              loadPantryAndRecommendations();
            }}
          >
            <Text style={styles.refreshButtonText}>Get Fresh Recipes</Text>
          </TouchableOpacity>
        )}

        {mode === 'search' && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a recipe name..."
              placeholderTextColor="#A0AEC0"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchRecipes}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchRecipes}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.searchIcon}>
                  <View style={styles.searchCircle} />
                  <View style={styles.searchHandle} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        {recipes.length === 0 && mode === 'search' ? (
          /* Search Placeholder */
          <View style={styles.searchPlaceholder}>
            <Text style={styles.searchPlaceholderIcon}>🔍</Text>
            <Text style={styles.searchPlaceholderTitle}>Search for Recipes</Text>
            <Text style={styles.searchPlaceholderText}>
              Enter a recipe name above to find delicious recipes!
            </Text>
            <View style={styles.searchExamples}>
              <Text style={styles.searchExamplesTitle}>Try searching for:</Text>
              <Text style={styles.searchExample}>• "Italian pasta"</Text>
              <Text style={styles.searchExample}>• "Quick chicken recipes"</Text>
              <Text style={styles.searchExample}>• "Vegan desserts"</Text>
              <Text style={styles.searchExample}>• "30 minute meals"</Text>
            </View>
          </View>
        ) : recipes.length === 0 && mode === 'recommend' && backendError ? (
          /* Backend Error Message */
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>🌐</Text>
            <Text style={styles.errorTitle}>Connection Issue</Text>
            <Text style={styles.errorMessage}>
              We're having trouble connecting to our recipe service right now. 
              Please check your internet connection and try again.
            </Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => loadPantryAndRecommendations()}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <View style={styles.offlineTips}>
              <Text style={styles.offlineTipsTitle}>In the meantime:</Text>
              <Text style={styles.offlineTip}>• Check your saved recipes in the Log page</Text>
              <Text style={styles.offlineTip}>• Try using the Search feature instead</Text>
              <Text style={styles.offlineTip}>• Make sure you're connected to the internet</Text>
            </View>
          </View>
        ) : recipes.length === 0 ? (
          /* No recipes available */
          <View style={styles.searchPlaceholder}>
            <Text style={styles.searchPlaceholderIcon}>🍽️</Text>
            <Text style={styles.searchPlaceholderTitle}>No Recipes Available</Text>
            <Text style={styles.searchPlaceholderText}>
              Please try again or check your connection.
            </Text>
          </View>
        ) : currentRecipe.name ? (
          /* Recipe Card */
          <View style={styles.recipeCard}>
          <View style={styles.recipeHeader}>
            <Text style={styles.recipeTitle}>
              {currentRecipe.name}
            </Text>
            <View style={styles.chefsBadge}>
              <Text style={styles.chefsBadgeText}>⭐ Chef's Choice</Text>
            </View>
          </View>

          <Text style={styles.recipeDescription}>
            {currentRecipe.description}
          </Text>

          {/* Recipe Stats */}
          <View style={styles.recipeStats}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>🕐</Text>
              <Text style={styles.statText}>{currentRecipe.cookingTime || '30 minutes'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>⚪</Text>
              <Text style={styles.statText}>{currentRecipe.calories || '250 calories'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>🍴</Text>
              <Text style={styles.statText}>Easy</Text>
            </View>
          </View>

          {/* Ingredients Section */}
          <View style={styles.ingredientsSection}>
            <Text style={styles.sectionTitle}>🥘 Ingredients</Text>
            <View style={styles.ingredientsList}>
              {currentRecipe.ingredients && currentRecipe.ingredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredient}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.ingredientText}>{ingredient}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Navigation and Instructions */}
          <View style={styles.navigationSection}>
            <View style={styles.navigationButtons}>
              <TouchableOpacity 
                style={[styles.navButton, currentRecipeIndex === 0 && styles.navButtonDisabled]}
                onPress={() => setCurrentRecipeIndex(Math.max(0, currentRecipeIndex - 1))}
                disabled={currentRecipeIndex === 0}
              >
                <Text style={styles.navButtonText}>← Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.navButton, currentRecipeIndex === recipes.length - 1 && styles.navButtonDisabled]}
                onPress={() => setCurrentRecipeIndex(Math.min(recipes.length - 1, currentRecipeIndex + 1))}
                disabled={currentRecipeIndex === recipes.length - 1}
              >
                <Text style={styles.navButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
            
            {/* Load More Recipes Button - Only in recommend mode */}
            {mode === 'recommend' && (
              <TouchableOpacity 
                style={styles.loadMoreButton}
                onPress={loadMoreRecipes}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.loadMoreButtonText}>Load More Recipes</Text>
                )}
              </TouchableOpacity>
            )}
            
            {/* Save Recipe Button */}
            <TouchableOpacity 
              style={[
                styles.saveRecipeButton,
                isRecipeSaved(currentRecipe) && styles.savedRecipeButton
              ]}
              onPress={async () => {
                if (isRecipeSaved(currentRecipe)) {
                  // Show instructions for saved recipe in a nicer format
                  const instructions = currentRecipe.instructions || 'No detailed instructions available for this recipe.';
                  
                  // Format instructions with better spacing and numbering
                  const formattedInstructions = instructions
                    .split(/\d+\./)
                    .filter(step => step.trim())
                    .map((step, index) => `${index + 1}. ${step.trim()}`)
                    .join('\n\n');
                  
                  Alert.alert(
                    `📋 ${currentRecipe.name}`,
                    `🥘 Instructions:\n\n${formattedInstructions}`,
                    [{ text: 'Got it!' }]
                  );
                } else {
                  // Save the recipe
                  const success = await saveRecipe(currentRecipe);
                  if (success) {
                    // Add ingredients as suggestions for both recommend and search modes
                    const suggestionsCount = currentRecipe.ingredients 
                      ? await addIngredientsToShoppingSuggestions(currentRecipe.ingredients, currentRecipe.name)
                      : 0;
                    
                    const alertMessage = suggestionsCount > 0
                      ? `${currentRecipe.name} has been saved! 🛒 ${suggestionsCount} ingredients have been added as smart suggestions on your Shop page.`
                      : `${currentRecipe.name} has been saved to your recipe collection. You can now view the full instructions anytime!`;
                    
                    Alert.alert(
                      'Recipe Saved! 🎉',
                      alertMessage,
                      [
                        {
                          text: 'View Instructions',
                          onPress: () => {
                            const instructions = currentRecipe.instructions || 'No detailed instructions available for this recipe.';
                            
                            // Format instructions with better spacing and numbering
                            const formattedInstructions = instructions
                              .split(/\d+\./)
                              .filter(step => step.trim())
                              .map((step, index) => `${index + 1}. ${step.trim()}`)
                              .join('\n\n');
                            
                            Alert.alert(
                              `📋 ${currentRecipe.name}`,
                              `🥘 Instructions:\n\n${formattedInstructions}`,
                              [{ text: 'Got it!' }]
                            );
                          }
                        },
                        { text: 'OK' }
                      ]
                    );
                  } else {
                    Alert.alert('Error', 'Failed to save recipe. Please try again.');
                  }
                }
              }}
            >
              <Text style={[
                styles.saveRecipeButtonText,
                isRecipeSaved(currentRecipe) && styles.savedRecipeButtonText
              ]}>
                {isRecipeSaved(currentRecipe) ? '📋 View Instructions' : '⭐ Save Recipe'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        ) : (
          /* No recipes in recommend mode */
          <View style={styles.searchPlaceholder}>
            <Text style={styles.searchPlaceholderIcon}>🍽️</Text>
            <Text style={styles.searchPlaceholderTitle}>No Recipes Available</Text>
            <Text style={styles.searchPlaceholderText}>
              Try refreshing to get new recommendations.
            </Text>
          </View>
        )}
      </ScrollView>
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
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  logo: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D6A4F',
    flex: 1,
    marginRight: 10,
  },
  chefsBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  chefsBadgeText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '600',
  },
  recipeDescription: {
    fontSize: 16,
    color: '#718096',
    fontStyle: 'italic',
    marginBottom: 20,
    lineHeight: 22,
  },
  recipeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D6A4F',
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 12,
    color: '#2D6A4F',
    textAlign: 'center',
  },
  ingredientsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 15,
  },
  ingredientsList: {
    paddingLeft: 10,
  },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#81C784',
    marginRight: 10,
    fontWeight: 'bold',
  },
  ingredientText: {
    fontSize: 16,
    color: '#4A5568',
  },
  ratingSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 20,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    textAlign: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#2D6A4F',
  },
  noRecipesText: {
    fontSize: 18,
    color: '#718096',
    textAlign: 'center',
    marginHorizontal: 40,
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navigationSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 20,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsSection: {
    marginTop: 10,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
  },
  loadMoreButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  loadMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveRecipeButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  savedRecipeButton: {
    backgroundColor: '#81C784',
  },
  saveRecipeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  savedRecipeButtonText: {
    color: '#FFFFFF',
  },
  
  // New styles for search functionality
  controlsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#48BB78',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#718096',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchButton: {
    backgroundColor: '#48BB78',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  searchIcon: {
    position: 'relative',
    width: 18,
    height: 18,
  },
  searchCircle: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    top: 0,
    left: 0,
  },
  searchHandle: {
    position: 'absolute',
    width: 6,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    bottom: 0,
    right: 0,
    transform: [{ rotate: '45deg' }],
  },
  
  // Error container styles
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  offlineTips: {
    alignItems: 'flex-start',
    width: '100%',
  },
  offlineTipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  offlineTip: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 8,
    lineHeight: 20,
  },
  
  // Search placeholder styles
  searchPlaceholder: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  searchPlaceholderIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  searchPlaceholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  searchPlaceholderText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  searchExamples: {
    alignItems: 'flex-start',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  searchExamplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  searchExample: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 6,
  },
  
  // Refresh button styles
  refreshButton: {
    backgroundColor: '#E6FFFA',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#81E6D9',
  },
  refreshButtonText: {
    color: '#2D6A4F',
    fontSize: 14,
    fontWeight: '500',
  },
});