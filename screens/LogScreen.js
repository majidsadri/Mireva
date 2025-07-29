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

export default function LogScreen({ navigation }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [shoppingItems, setShoppingItems] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    loadActivityData();
  }, []);

  const loadActivityData = async () => {
    console.log('Loading activity data...');
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const headers = {
        ...API_CONFIG.getHeaders(),
        ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() }),
      };

      console.log(`🔍 Loading activities for user: ${userEmail}`);
      console.log('Request headers:', headers);

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

      // Load saved recipes from AsyncStorage (for saved but not cooked recipes) - user-specific
      const userSpecificKey = `savedRecipes_${userEmail}`;
      let saved = await AsyncStorage.getItem(userSpecificKey);
      let localSavedRecipes = saved ? JSON.parse(saved) : [];

      // One-time cleanup: Remove incorrectly migrated data for non-sizarta users
      if (userEmail !== 'sizarta@gmail.com' && localSavedRecipes.length > 0) {
        // Check if this looks like incorrectly migrated sizarta data
        const hasIncorrectData = localSavedRecipes.some(recipe => 
          recipe.savedBy === 'sizarta@gmail.com' || 
          !recipe.savedBy || 
          recipe.savedBy !== userEmail
        );
        
        if (hasIncorrectData) {
          await AsyncStorage.removeItem(userSpecificKey);
          localSavedRecipes = [];
          console.log(`Cleaned up incorrectly migrated data for user ${userEmail}`);
        }
      }

      // Migration: Only migrate for sizarta (the original user) to prevent data leakage
      if (localSavedRecipes.length === 0 && userEmail === 'sizarta@gmail.com') {
        const oldSaved = await AsyncStorage.getItem('savedRecipes');
        if (oldSaved) {
          const oldRecipes = JSON.parse(oldSaved);
          // Migrate old recipes to user-specific storage
          await AsyncStorage.setItem(userSpecificKey, oldSaved);
          localSavedRecipes = oldRecipes;
          // Clear global storage after migration to prevent future leaks
          await AsyncStorage.removeItem('savedRecipes');
          console.log(`Migrated ${oldRecipes.length} recipes for user ${userEmail} and cleared global storage`);
        }
      }

      // Load logged recipes from backend (for cooked recipes)
      const loggedResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_RECIPE_LOGS}`, {
        method: 'GET',
        headers,
      });
      const loggedData = await loggedResponse.json();
      const loggedRecipes = loggedData.recipe_logs || [];

      // Load pantry activity logs from backend
      const pantryActivityResponse = await fetch(`${API_CONFIG.BASE_URL}/pantry-activity-logs`, {
        method: 'GET',
        headers,
      });
      console.log('Pantry activity response status:', pantryActivityResponse.status);
      const pantryActivityData = await pantryActivityResponse.json();
      console.log('Pantry activity data:', pantryActivityData);
      const pantryActivities = pantryActivityData.activities || [];

      // Load shopping list activity logs from backend
      const shoppingActivityResponse = await fetch(`${API_CONFIG.BASE_URL}/shopping-activity-logs`, {
        method: 'GET',
        headers,
      });
      const shoppingActivityData = await shoppingActivityResponse.json();
      const shoppingActivities = shoppingActivityData.activities || [];

      // Combine all activities
      const allBackendActivities = [...pantryActivities, ...shoppingActivities];

      // Debug logging for activities
      console.log(`📊 Activity Logs Debug for user ${userEmail}:`);
      console.log(`  - Pantry activities: ${pantryActivities.length}`);
      console.log(`  - Shopping activities: ${shoppingActivities.length}`);
      console.log(`  - Total backend activities: ${allBackendActivities.length}`);

      if (pantryActivities.length > 0) {
        console.log('  - Sample pantry activity:', JSON.stringify(pantryActivities[0], null, 2));
      }
      if (shoppingActivities.length > 0) {
        console.log('  - Sample shopping activity:', JSON.stringify(shoppingActivities[0], null, 2));
      }

      // Combine both types of recipes
      const allRecipes = [...localSavedRecipes, ...loggedRecipes];
      setSavedRecipes(allRecipes);

      // Create activities array
      const activityList = [];

      // Filter out view activities before processing
      const meaningfulActivities = allBackendActivities.filter(activity => 
        activity.activity_type !== 'pantry_view' && 
        activity.activity_type !== 'shopping_list_view'
      );

      // Remove duplicates based on timestamp, activity type, and user
      const deduplicatedActivities = [];
      const seen = new Set();
      
      meaningfulActivities.forEach(activity => {
        // Create a unique identifier for each activity
        const activityKey = `${activity.timestamp}_${activity.activity_type}_${activity.user_email}_${activity.activity_data?.item_name || activity.activity_data?.item_added?.name || 'unknown'}`;
        
        if (!seen.has(activityKey)) {
          seen.add(activityKey);
          deduplicatedActivities.push(activity);
        } else {
          console.log('DEBUG: Removed duplicate activity:', activityKey);
        }
      });

      // Debug deduplication results
      console.log(`  - After filtering views: ${meaningfulActivities.length}`);
      console.log(`  - After deduplication: ${deduplicatedActivities.length}`);
      console.log(`  - Duplicates removed: ${meaningfulActivities.length - deduplicatedActivities.length}`);

      // Add all meaningful backend activities (pantry and shopping) with guaranteed unique keys
      deduplicatedActivities.forEach((activity, index) => {
        const activityDate = new Date(activity.timestamp);
        const now = new Date();
        const daysAgo = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));

        // Generate absolutely unique key
        const uniqueKey = `activity_${index}_${activityDate.getTime()}_${Math.floor(Math.random() * 1000000)}`;

        // Determine activity type and icon
        let type = 'pantry';
        let title = activity.description;
        let description = activity.description;

        // Customize based on activity type
        const userName = activity.user_name || 'Someone';

        if (activity.activity_type === 'pantry_add_item') {
          type = 'add';
          title = `${userName} added item`;
          const itemName = activity.activity_data?.item_name || 'item';
          description = `${userName} added ${itemName} to pantry`;
        } else if (activity.activity_type === 'pantry_scan_add') {
          type = 'scan';
          title = `${userName} scanned items`;
          description = activity.description || `${userName} scanned and added items`;
        } else if (activity.activity_type === 'pantry_remove_item') {
          type = 'remove';
          title = `${userName} removed item`;
          const itemName = activity.activity_data?.item_deleted?.name || activity.activity_data?.item_name || 'item';
          description = activity.description || `${userName} removed ${itemName} from pantry`;
        } else if (activity.activity_type === 'pantry_view') {
          type = 'view';
          title = `${userName} viewed pantry`;
          description = activity.description || `${userName} viewed the pantry`;
        } else if (activity.activity_type === 'shopping_list_add_item') {
          type = 'shopping_add';
          title = `${userName} added to shopping`;
          const itemName = activity.activity_data?.item_name || activity.activity_data?.item_added?.name || 'item';
          description = `${userName} added ${itemName} to shopping list`;
        } else if (activity.activity_type === 'shopping_list_remove_item') {
          type = 'shopping_remove';
          title = `${userName} removed from shopping`;
          const itemName = activity.activity_data?.item_name || 'item';
          description = `${userName} removed ${itemName} from shopping list`;
        } else if (activity.activity_type === 'shopping_list_view') {
          type = 'shopping_view';
          title = `${userName} viewed shopping list`;
          description = activity.description || `${userName} viewed shopping list`;
        }

        activityList.push({
          id: uniqueKey,
          type: type,
          title: title,
          description: description,
          time: daysAgo === 0 ? 'Today' : daysAgo < 0 ? 'Today' : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`,
          timestamp: activityDate.getTime(),
          user: activity.user_name,
        });
      });

      // Add recipe activities (both saved and logged) with guaranteed unique keys
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

        // Generate absolutely unique key for recipes
        const uniqueRecipeKey = `recipe_${index}_${activityDate.getTime()}_${Math.floor(Math.random() * 1000000)}`;

        const recipeNow = new Date();
        const recipeDaysAgo = Math.floor((recipeNow.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        activityList.push({
          id: uniqueRecipeKey,
          type: 'recipe',
          title: title,
          description: description,
          time: recipeDaysAgo === 0 ? 'Today' : recipeDaysAgo < 0 ? 'Today' : `${recipeDaysAgo} day${recipeDaysAgo > 1 ? 's' : ''} ago`,
          recipe: recipe,
          timestamp: activityDate.getTime(),
        });
      });

      // Removed pantry and shopping summary items since they're already shown in stats bar

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

  const showAllSavedRecipes = () => {
    navigation.navigate('SavedRecipes');
  };

  const navigateToPantry = () => {
    // Navigate to the parent tab navigator, then to Mireva tab
    navigation.getParent()?.navigate('Mireva');
  };

  const navigateToShopping = () => {
    // Navigate to the parent tab navigator, then to Shop tab
    navigation.getParent()?.navigate('Shop');
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

      {/* Circular Action Buttons */}
      <View style={styles.circularButtonsContainer}>
        <TouchableOpacity style={styles.circularButtonWrapper} onPress={navigateToPantry}>
          <View style={[styles.circularButton, styles.pantryButton]}>
            <Text style={styles.circularButtonNumber}>{pantryItems.length}</Text>
          </View>
          <Text style={styles.circularButtonLabel}>Pantry</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.circularButtonWrapper} onPress={showAllSavedRecipes}>
          <View style={[styles.circularButton, styles.recipesButton]}>
            <Text style={styles.circularButtonNumber}>{savedRecipes.length}</Text>
          </View>
          <Text style={styles.circularButtonLabel}>Recipes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.circularButtonWrapper} onPress={navigateToShopping}>
          <View style={[styles.circularButton, styles.shoppingButton]}>
            <Text style={styles.circularButtonNumber}>{shoppingItems.length}</Text>
          </View>
          <Text style={styles.circularButtonLabel}>Shopping</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <View style={styles.activitySection}>
        <View style={styles.activityHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadActivityData}
          >
            <Text style={styles.refreshButtonText}>↻</Text>
          </TouchableOpacity>
        </View>

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
                activity.type === 'recipe' ? styles.recipeIcon :
                activity.type === 'add' ? styles.addIcon :
                activity.type === 'remove' ? styles.removeIcon :
                activity.type === 'view' ? styles.viewIcon :
                activity.type === 'pantry' ? styles.pantryIcon :
                activity.type === 'shopping_add' ? styles.shoppingAddIcon :
                activity.type === 'shopping_remove' ? styles.shoppingRemoveIcon :
                activity.type === 'shopping_view' ? styles.shoppingViewIcon : styles.shoppingIcon,
              ]}>
                <View style={activity.type === 'scan' ? styles.scanDot :
                           activity.type === 'recipe' ? styles.recipeDot :
                           activity.type === 'add' ? styles.addDot :
                           activity.type === 'remove' ? styles.removeDot :
                           activity.type === 'view' ? styles.viewDot :
                           activity.type === 'pantry' ? styles.pantryDot :
                           activity.type === 'shopping_add' ? styles.shoppingAddDot :
                           activity.type === 'shopping_remove' ? styles.shoppingRemoveDot :
                           activity.type === 'shopping_view' ? styles.shoppingViewDot : styles.shoppingDot} />
              </View>
              <View style={styles.activityContent}>
                <View style={styles.activityItemHeader}>
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
  // Circular buttons similar to shop page
  circularButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 25,
    gap: 40,
  },
  circularButtonWrapper: {
    alignItems: 'center',
  },
  circularButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    marginBottom: 8,
  },
  pantryButton: {
    backgroundColor: '#2D6A4F',
  },
  recipesButton: {
    backgroundColor: '#FF6B35',
  },
  shoppingButton: {
    backgroundColor: '#9FD5CD',
  },
  circularButtonNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  circularButtonLabel: {
    fontSize: 12,
    color: '#2D3748',
    fontWeight: '600',
    textAlign: 'center',
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
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  refreshButton: {
    backgroundColor: '#2D6A4F',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
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
  addIcon: {
    backgroundColor: '#E8F5E8',
  },
  removeIcon: {
    backgroundColor: '#FFEBEE',
  },
  viewIcon: {
    backgroundColor: '#F3E5F5',
  },
  pantryIcon: {
    backgroundColor: '#FFF8E1',
  },
  shoppingAddIcon: {
    backgroundColor: '#E8F5E8',
  },
  shoppingRemoveIcon: {
    backgroundColor: '#FFEBEE',
  },
  shoppingViewIcon: {
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
  addDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  removeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F44336',
  },
  viewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#9C27B0',
  },
  pantryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFC107',
  },
  shoppingAddDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  shoppingRemoveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F44336',
  },
  shoppingViewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  activityContent: {
    flex: 1,
  },
  activityItemHeader: {
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
