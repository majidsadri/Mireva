import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config';

export default function SavedRecipesScreen({ navigation }) {
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedRecipes();
  }, []);

  const loadSavedRecipes = async () => {
    try {
      setLoading(true);
      
      // Load saved recipes from AsyncStorage
      const saved = await AsyncStorage.getItem('savedRecipes');
      const localSavedRecipes = saved ? JSON.parse(saved) : [];
      
      // Load logged recipes from backend
      const userEmail = await AsyncStorage.getItem('userEmail');
      const headers = {
        ...API_CONFIG.getHeaders(),
        ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() })
      };
      
      const loggedResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_RECIPE_LOGS}`, {
        method: 'GET',
        headers,
      });
      const loggedData = await loggedResponse.json();
      const loggedRecipes = loggedData.recipe_logs || [];
      
      // Combine and sort by date (newest first)
      const allRecipes = [...localSavedRecipes, ...loggedRecipes].sort((a, b) => {
        const dateA = new Date(a.savedAt || a.timestamp || 0);
        const dateB = new Date(b.savedAt || b.timestamp || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setSavedRecipes(allRecipes);
    } catch (error) {
      console.error('Error loading saved recipes:', error);
      Alert.alert('Error', 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const showRecipeInstructions = (recipe) => {
    Alert.alert(
      `${recipe.name || recipe.recipe_name} - Instructions`,
      recipe.instructions || 'No detailed instructions available for this recipe.',
      [{ text: 'OK' }]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRecipeType = (recipe) => {
    if (recipe.savedAt) return 'Saved';
    if (recipe.timestamp) return 'Cooked';
    return 'Recipe';
  };

  const getRecipeTypeColor = (recipe) => {
    if (recipe.savedAt) return '#2D6A4F'; // Green for saved
    if (recipe.timestamp) return '#FF6B35'; // Orange for cooked
    return '#718096'; // Gray for unknown
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Recipes</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading recipes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (savedRecipes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Recipes</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>No Recipes Yet</Text>
          <Text style={styles.emptyMessage}>
            Start saving recipes from the Cook page to see them here!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Recipes</Text>
        <Text style={styles.recipeCount}>{savedRecipes.length}</Text>
      </View>

      {/* Recipes List */}
      <ScrollView style={styles.recipesList} showsVerticalScrollIndicator={false}>
        {savedRecipes.map((recipe, index) => {
          const recipeName = recipe.name || recipe.recipe_name || 'Unknown Recipe';
          const recipeDate = recipe.savedAt || recipe.timestamp;
          const recipeType = getRecipeType(recipe);
          const typeColor = getRecipeTypeColor(recipe);
          
          return (
            <TouchableOpacity 
              key={`${recipeName}_${index}`}
              style={styles.recipeCard}
              onPress={() => showRecipeInstructions(recipe)}
            >
              <View style={styles.recipeHeader}>
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeName}>{recipeName}</Text>
                  <View style={styles.recipeMetadata}>
                    <View style={[styles.typeTag, { backgroundColor: typeColor }]}>
                      <Text style={styles.typeText}>{recipeType}</Text>
                    </View>
                    <Text style={styles.recipeDate}>{formatDate(recipeDate)}</Text>
                  </View>
                </View>
                <View style={styles.chevron}>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </View>
              
              {/* Recipe Description */}
              {recipe.description && (
                <Text style={styles.recipeDescription} numberOfLines={2}>
                  {recipe.description}
                </Text>
              )}
              
              {/* Ingredients Count */}
              {recipe.ingredients && Array.isArray(recipe.ingredients) && (
                <View style={styles.ingredientsInfo}>
                  <Text style={styles.ingredientsText}>
                    📋 {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              
              {/* Cooking Time if available */}
              {recipe.cookingTime && (
                <View style={styles.cookingTimeInfo}>
                  <Text style={styles.cookingTimeText}>
                    ⏱️ {recipe.cookingTime}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        
        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backButtonText: {
    fontSize: 16,
    color: '#2D6A4F',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  recipeCount: {
    fontSize: 16,
    color: '#718096',
    fontWeight: '600',
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  placeholder: {
    width: 60, // Same width as back button for centering
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#718096',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
  },
  recipesList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 6,
    lineHeight: 24,
  },
  recipeMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  recipeDate: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 10,
  },
  chevronText: {
    fontSize: 24,
    color: '#CBD5E0',
    fontWeight: '300',
  },
  recipeDescription: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  ingredientsInfo: {
    marginBottom: 6,
  },
  ingredientsText: {
    fontSize: 13,
    color: '#2D6A4F',
    fontWeight: '500',
  },
  cookingTimeInfo: {
    marginBottom: 6,
  },
  cookingTimeText: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 20,
  },
});