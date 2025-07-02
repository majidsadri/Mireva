import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context'; // or from 'react-native'
import { API_CONFIG } from '../config';

export default function RecipeScreen() {
  const [recipes, setRecipes] = useState([]);
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error('No user email found');
  
      console.log('Fetching pantry items from:', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`);
      const pantryResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'GET',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': email,
          'Cache-Control': 'no-cache'
        }
      });
  
      if (!pantryResponse.ok) {
        const errorText = await pantryResponse.text();
        console.error('Pantry error response:', errorText);
        throw new Error(`Failed to fetch pantry items: ${pantryResponse.status}`);
      }
  
      const pantryData = await pantryResponse.json();
      if (!Array.isArray(pantryData)) throw new Error('Invalid pantry data format');
  
      const ingredients = pantryData.map(item => item?.name).filter(name => name);
      if (!ingredients || ingredients.length === 0) {
        throw new Error('No ingredients found in pantry');
      }
  
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RECOMMEND}`, {
        method: 'POST',
        headers: {
          ...API_CONFIG.getHeaders(),
          'Accept': 'application/json',
          'X-User-Email': email,
        },
        body: JSON.stringify({ ingredients }),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch recipes: ${response.status}`);
      }
  
      const data = await response.json();
      if (!data.recipes || !Array.isArray(data.recipes)) {
        throw new Error('Invalid recipe data format');
      }
  
      setRecipes(data.recipes);
      setCurrentRecipeIndex(0);
      setShowInstructions(false);
      setError(null);
    } catch (err) {
      console.error('Error in fetchRecipes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  

  const handleLike = () => {
    setShowInstructions(true);
  };

  const handleDislike = () => {
    if (currentRecipeIndex < recipes.length - 1) {
      setCurrentRecipeIndex(prev => prev + 1);
      setShowInstructions(false);
    } else {
      // If we've gone through all recipes, fetch new ones
      fetchRecipes();
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Finding recipes for you...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRecipes}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!recipes.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No recipes found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRecipes}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentRecipe = recipes[currentRecipeIndex];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
    <ScrollView style={styles.container}>
      <View style={styles.recipeCard}>
        <Text style={styles.recipeName}>{currentRecipe.name}</Text>
        <Text style={styles.recipeDescription}>{currentRecipe.description}</Text>
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>🕒 {currentRecipe.cookingTime}</Text>
          <Text style={styles.infoText}>🔥 {currentRecipe.calories}</Text>
        </View>

        <Text style={styles.sectionTitle}>Ingredients:</Text>
        {currentRecipe.ingredients.map((ingredient, index) => (
          <Text key={index} style={styles.ingredient}>• {ingredient}</Text>
        ))}

        {showInstructions ? (
          <>
            <Text style={styles.sectionTitle}>Instructions:</Text>
            <Text style={styles.instructions}>{currentRecipe.instructions}</Text>
            <TouchableOpacity style={styles.nextButton} onPress={handleDislike}>
              <Text style={styles.buttonText}>Next Recipe</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.dislikeButton]} onPress={handleDislike}>
              <Text style={styles.buttonText}>👎 Dislike</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.likeButton]} onPress={handleLike}>
              <Text style={styles.buttonText}>👍 Like</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    margin: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recipeName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  recipeDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    lineHeight: 22,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#eee',
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 16,
    color: '#444',
    marginHorizontal: 5,
  },  
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',  // more bold
    marginTop: 15,
    marginBottom: 10,
    color: '#333',
  },  
  ingredient: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
    marginBottom: 5,
  },
  instructions: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  likeButton: {
    backgroundColor: '#4CAF50',
  },
  dislikeButton: {
    backgroundColor: '#f44336',
  },
  nextButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
