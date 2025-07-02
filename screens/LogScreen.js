import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config';

export default function LogScreen() {
  const [pantryItems, setPantryItems] = useState([]);
  const [shoppingItems, setShoppingItems] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    loadActivityData();
  }, []);

  const loadActivityData = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const headers = {
        ...API_CONFIG.getHeaders(),
        ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() })
      };

      // Load pantry items
      const pantryResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'GET',
        headers,
      });
      const pantryData = await pantryResponse.json();
      setPantryItems(pantryData);

      // Load shopping list items
      const shoppingResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHOPPING_LIST}`, {
        method: 'GET',
        headers,
      });
      const shoppingData = await shoppingResponse.json();
      setShoppingItems(shoppingData.items || []);

      // Load saved recipes from AsyncStorage (for saved but not cooked recipes)
      const saved = await AsyncStorage.getItem('savedRecipes');
      const savedRecipes = saved ? JSON.parse(saved) : [];
      
      // Load logged recipes from backend (for cooked recipes)
      const loggedResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_RECIPE_LOGS}`, {
        method: 'GET',
        headers,
      });
      const loggedData = await loggedResponse.json();
      const loggedRecipes = loggedData.recipe_logs || [];
      
      // Combine both types of recipes
      const allRecipes = [...savedRecipes, ...loggedRecipes];
      setSavedRecipes(allRecipes);

      // Create activities array
      const activityList = [];

      // Add recipe activities (both saved and logged)
      allRecipes.forEach((recipe, index) => {
        let activityDate, title, description;
        
        if (recipe.timestamp) {
          // Logged recipe (cooked)
          activityDate = new Date(recipe.timestamp);
          title = 'recipe cooked';
          description = `Cooked recipe: ${recipe.recipe_name || recipe.name}`;
        } else if (recipe.savedAt) {
          // Saved recipe (not cooked yet)
          activityDate = new Date(recipe.savedAt);
          title = 'recipe saved';
          description = `Saved recipe: ${recipe.name}`;
        } else {
          // Fallback
          activityDate = new Date();
          title = 'recipe activity';
          description = `Recipe: ${recipe.recipe_name || recipe.name}`;
        }
        
        const daysAgo = Math.floor((Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        activityList.push({
          id: `recipe_${recipe.id || index}`,
          type: 'recipe',
          title: title,
          description: description,
          time: daysAgo === 0 ? 'Today' : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`,
          recipe: recipe,
          timestamp: activityDate.getTime()
        });
      });

      // Add pantry activity
      if (pantryData.length > 0) {
        activityList.push({
          id: 'pantry_scan',
          type: 'scan',
          title: 'items in pantry',
          description: `You have ${pantryData.length} item${pantryData.length > 1 ? 's' : ''} in your pantry`,
          time: 'Current',
          timestamp: Date.now()
        });
      }

      // Add shopping activity
      if (shoppingData.items && shoppingData.items.length > 0) {
        activityList.push({
          id: 'shopping_list',
          type: 'shopping',
          title: 'shopping list updated',
          description: `Shopping list has ${shoppingData.items.length} item${shoppingData.items.length > 1 ? 's' : ''}`,
          time: 'Current',
          timestamp: Date.now() - 1000 // Slightly earlier than pantry
        });
      }

      // Sort by timestamp (newest first)
      activityList.sort((a, b) => b.timestamp - a.timestamp);
      setActivities(activityList);

    } catch (error) {
      console.error('Error loading activity data:', error);
    }
  };

  const showRecipeInstructions = (recipe) => {
    Alert.alert(
      `${recipe.name} - Instructions`,
      recipe.instructions || 'No detailed instructions available for this recipe.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Cover Image */}
      <View style={styles.coverContainer}>
        <Image
          source={require('../assets/Mireva-top.png')}
          style={styles.coverImage}
        />
        <View style={styles.coverOverlay}>
          <Text style={styles.title}>Activity Log</Text>
          <Text style={styles.subtitle}>
            Track your food journey • {activities.length} activities
          </Text>
        </View>
      </View>

      {/* Compact Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{pantryItems.length}</Text>
          <Text style={styles.statLabel}>Pantry</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{savedRecipes.length}</Text>
          <Text style={styles.statLabel}>Recipes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{shoppingItems.length}</Text>
          <Text style={styles.statLabel}>Shopping</Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.activitySection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        
        <ScrollView style={styles.activityList}>
          {activities.map((activity) => (
            <TouchableOpacity 
              key={activity.id} 
              style={styles.activityItem}
              onPress={() => {
                if (activity.type === 'recipe' && activity.recipe) {
                  showRecipeInstructions(activity.recipe);
                }
              }}
              disabled={activity.type !== 'recipe'}
            >
              <View style={[styles.activityIcon, 
                activity.type === 'scan' ? styles.scanIcon : 
                activity.type === 'recipe' ? styles.recipeIcon : styles.shoppingIcon
              ]}>
                <View style={activity.type === 'scan' ? styles.scanDot : 
                           activity.type === 'recipe' ? styles.recipeDot : styles.shoppingDot} />
              </View>
              <View style={styles.activityContent}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
                <Text style={styles.activityDescription}>
                  {activity.description}
                </Text>
                {activity.type === 'recipe' && (
                  <Text style={styles.tapHint}>Tap for instructions</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  // Cover image styles
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
  // Compact stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 15,
  },
  // Activity section
  activitySection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 15,
  },
  activityList: {
    flex: 1,
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scanIcon: {
    backgroundColor: '#E8F5E8',
  },
  recipeIcon: {
    backgroundColor: '#FFF3E0',
  },
  shoppingIcon: {
    backgroundColor: '#E3F2FD',
  },
  scanDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  recipeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF9800',
  },
  shoppingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  activityTime: {
    fontSize: 11,
    color: '#A0AEC0',
  },
  activityDescription: {
    fontSize: 13,
    color: '#718096',
    lineHeight: 18,
    marginBottom: 2,
  },
  tapHint: {
    fontSize: 10,
    color: '#2D6A4F',
    fontStyle: 'italic',
  },
});