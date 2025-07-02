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

  useEffect(() => {
    loadPantryAndRecommendations();
    loadSavedRecipes();
  }, []);

  const loadSavedRecipes = async () => {
    try {
      const saved = await AsyncStorage.getItem('savedRecipes');
      if (saved) {
        setSavedRecipes(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved recipes:', error);
    }
  };

  const loadPantryAndRecommendations = async () => {
    try {
      setLoading(true);
      
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
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({ ingredients }),
      });
      
      const recommendData = await recommendResponse.json();
      if (recommendData.recipes) {
        setRecipes(recommendData.recipes);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
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
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({ ingredients }),
      });
      
      const recommendData = await recommendResponse.json();
      if (recommendData.recipes) {
        // Append new recipes to existing ones, avoiding duplicates
        const newRecipes = recommendData.recipes.filter(newRecipe => 
          !recipes.some(existingRecipe => existingRecipe.name === newRecipe.name)
        );
        setRecipes(prevRecipes => [...prevRecipes, ...newRecipes]);
      }
    } catch (error) {
      console.error('Error loading more recipes:', error);
    } finally {
      setLoadingMore(false);
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
      await AsyncStorage.setItem('savedRecipes', JSON.stringify(updatedSaved));
      
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

  const currentRecipe = recipes[currentRecipeIndex];

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
          <Text style={styles.title}>Recipe Recommendations</Text>
          <Text style={styles.subtitle}>
            Recipe {currentRecipeIndex + 1} of {recipes.length}
            {pantryItems.length > 0 ? ' • Based on your pantry' : ' • Popular recipes'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Recipe Card */}
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
            
            {/* Load More Recipes Button */}
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
                    Alert.alert(
                      'Recipe Saved! 🎉',
                      `${currentRecipe.name} has been saved to your recipe collection. You can now view the full instructions anytime!`,
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
});