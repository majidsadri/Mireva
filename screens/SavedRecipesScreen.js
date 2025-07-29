import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
  TextInput,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config';

const { width: screenWidth } = Dimensions.get('window');

export default function SavedRecipesScreen({ navigation }) {
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'saved', 'cooked'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'name'
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState(null);
  const slideAnim = new Animated.Value(screenWidth);

  useEffect(() => {
    loadSavedRecipes();
  }, []);

  const loadSavedRecipes = async () => {
    try {
      setLoading(true);
      
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      // Load saved recipes from AsyncStorage - user-specific
      const userSpecificKey = `savedRecipes_${userEmail}`;
      let saved = await AsyncStorage.getItem(userSpecificKey);
      let localSavedRecipes = saved ? JSON.parse(saved) : [];

      // Migration: Only migrate for sizarta (the original user) to prevent data leakage
      if (localSavedRecipes.length === 0 && userEmail === 'sizarta@gmail.com') {
        const oldSaved = await AsyncStorage.getItem('savedRecipes');
        if (oldSaved) {
          const oldRecipes = JSON.parse(oldSaved);
          await AsyncStorage.setItem(userSpecificKey, oldSaved);
          localSavedRecipes = oldRecipes;
          console.log(`Migrated ${oldRecipes.length} recipes for user ${userEmail} in SavedRecipesScreen`);
        }
      }

      const headers = {
        ...API_CONFIG.getHeaders(),
        ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() })
      };
      
      // Load logged recipes from backend
      try {
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
      } catch (backendError) {
        console.log('Backend unavailable, showing local recipes only:', backendError);
        setSavedRecipes(localSavedRecipes);
      }
      
    } catch (error) {
      console.error('Error loading saved recipes:', error);
      Alert.alert('Error', 'Failed to load recipes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteRecipe = async (recipe) => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userSpecificKey = `savedRecipes_${userEmail}`;
      
      // Only delete from AsyncStorage (local saved recipes)
      if (recipe.savedAt && recipe.savedBy) {
        let saved = await AsyncStorage.getItem(userSpecificKey);
        let savedRecipes = saved ? JSON.parse(saved) : [];
        
        // Remove the recipe
        const updatedRecipes = savedRecipes.filter(r => r.id !== recipe.id);
        await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedRecipes));
        
        // Update local state
        setSavedRecipes(prev => prev.filter(r => r.id !== recipe.id));
        
        // No success message - silent delete
      } else {
        Alert.alert('Cannot Delete', 'Cooked recipes cannot be deleted. Only saved recipes can be removed.');
      }
    } catch (error) {
      console.error('Error deleting recipe:', error);
      Alert.alert('Error', 'Failed to delete recipe');
    }
  };

  const showRecipeInstructions = (recipe) => {
    console.log('showRecipeInstructions called with:', recipe?.name || recipe?.recipe_name);
    Alert.alert(
      recipe?.name || recipe?.recipe_name || 'Recipe',
      recipe?.instructions || 'No instructions available for this recipe.',
      [{ text: 'OK' }]
    );
  };

  const hideRecipeInstructions = () => {
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowInstructions(false);
      setSelectedRecipe(null);
    });
  };

  const confirmDelete = (recipe) => {
    setRecipeToDelete(recipe);
    setShowDeleteModal(true);
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

  const getFilteredAndSortedRecipes = () => {
    let filtered = savedRecipes;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(recipe => 
        (recipe.name || recipe.recipe_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (recipe.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(recipe => {
        if (selectedFilter === 'saved') return recipe.savedAt;
        if (selectedFilter === 'cooked') return recipe.timestamp;
        return true;
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'oldest':
          const dateA = new Date(a.savedAt || a.timestamp || 0);
          const dateB = new Date(b.savedAt || b.timestamp || 0);
          return dateA.getTime() - dateB.getTime();
        case 'name':
          const nameA = (a.name || a.recipe_name || '').toLowerCase();
          const nameB = (b.name || b.recipe_name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        default: // newest
          const newDateA = new Date(a.savedAt || a.timestamp || 0);
          const newDateB = new Date(b.savedAt || b.timestamp || 0);
          return newDateB.getTime() - newDateA.getTime();
      }
    });
  };

  const getFilterCount = (filter) => {
    if (filter === 'all') return savedRecipes.length;
    if (filter === 'saved') return savedRecipes.filter(r => r.savedAt).length;
    if (filter === 'cooked') return savedRecipes.filter(r => r.timestamp).length;
    return 0;
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSavedRecipes();
  };

  if (loading && !refreshing) {
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
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text style={styles.loadingText}>Loading your recipes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredRecipes = getFilteredAndSortedRecipes();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Recipes</Text>
        <View style={styles.recipeCount}>
          <Text style={styles.recipeCountText}>{savedRecipes.length}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          {[
            { key: 'all', label: 'All', count: getFilterCount('all') },
            { key: 'saved', label: 'Saved', count: getFilterCount('saved') },
            { key: 'cooked', label: 'Cooked', count: getFilterCount('cooked') }
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                selectedFilter === filter.key && styles.activeFilterTab
              ]}
              onPress={() => setSelectedFilter(filter.key)}
            >
              <Text style={[
                styles.filterTabText,
                selectedFilter === filter.key && styles.activeFilterTabText
              ]}>
                {filter.label} ({filter.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sort Dropdown */}
        <View style={styles.sortContainer}>
          <TouchableOpacity 
            style={styles.sortButton}
            onPress={() => {
              const orders = ['newest', 'oldest', 'name'];
              const currentIndex = orders.indexOf(sortOrder);
              const nextIndex = (currentIndex + 1) % orders.length;
              setSortOrder(orders[nextIndex]);
            }}
          >
            <Text style={styles.sortButtonText}>
              {sortOrder === 'newest' ? '📅↓' : sortOrder === 'oldest' ? '📅↑' : '🔤'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Empty State */}
      {filteredRecipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>
            {searchQuery ? '🔍' : selectedFilter === 'saved' ? '⭐' : selectedFilter === 'cooked' ? '🍳' : '📚'}
          </Text>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No Matching Recipes' : 
             selectedFilter === 'saved' ? 'No Saved Recipes Yet' :
             selectedFilter === 'cooked' ? 'No Cooked Recipes Yet' : 'No Recipes Yet'}
          </Text>
          <Text style={styles.emptyMessage}>
            {searchQuery ? `No recipes found for "${searchQuery}"` :
             selectedFilter === 'saved' ? 'Start saving recipes from the Cook page!' :
             selectedFilter === 'cooked' ? 'Recipes you\'ve cooked will appear here.' :
             'Start saving recipes from the Cook page to see them here!'}
          </Text>
          {searchQuery && (
            <TouchableOpacity 
              style={styles.clearSearchButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearSearchButtonText}>Clear Search</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* Recipes List */
        <ScrollView 
          style={styles.recipesList} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredRecipes.map((recipe, index) => {
            const recipeName = recipe.name || recipe.recipe_name || 'Unknown Recipe';
            const recipeDate = recipe.savedAt || recipe.timestamp;
            const recipeType = getRecipeType(recipe);
            const typeColor = getRecipeTypeColor(recipe);
            const canDelete = recipe.savedAt && recipe.savedBy; // Only saved recipes can be deleted
            
            return (
              <TouchableOpacity
                key={`${recipeName}_${index}`} 
                style={styles.recipeCard}
                onPress={() => {
                  console.log('Recipe card tapped:', recipe.name || recipe.recipe_name);
                  showRecipeInstructions(recipe);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.recipeContent}>
                  {/* Recipe Header */}
                  <View style={styles.recipeHeader}>
                    <View style={styles.recipeHeaderTop}>
                      <View style={[styles.typeTag, { backgroundColor: typeColor }]}>
                        <Text style={styles.typeText}>{recipeType}</Text>
                      </View>
                      {canDelete && (
                        <TouchableOpacity 
                          style={styles.deleteButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            confirmDelete(recipe);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.deleteButtonText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    <View style={styles.recipeMainInfo}>
                      <View style={styles.recipeInfo}>
                        <Text style={styles.recipeName} numberOfLines={2}>{recipeName}</Text>
                        <Text style={styles.recipeDate}>{formatDate(recipeDate)}</Text>
                      </View>
                      <View style={styles.chevron}>
                        <Text style={styles.chevronText}>›</Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Recipe Description */}
                  {recipe.description && (
                    <Text style={styles.recipeDescription} numberOfLines={2}>
                      {recipe.description}
                    </Text>
                  )}
                  
                  {/* Recipe Details */}
                  <View style={styles.recipeDetails}>
                    {recipe.ingredients && Array.isArray(recipe.ingredients) && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>📋</Text>
                        <Text style={styles.detailText}>
                          {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                    
                    {recipe.cookingTime && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>⏱️</Text>
                        <Text style={styles.detailText}>{recipe.cookingTime}</Text>
                      </View>
                    )}

                    {recipe.calories && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>🔥</Text>
                        <Text style={styles.detailText}>{recipe.calories}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          
          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}

      {/* Recipe Instructions Modal */}
      <Modal
        visible={showInstructions}
        transparent={true}
        animationType="none"
        onRequestClose={hideRecipeInstructions}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.instructionsModal,
              { transform: [{ translateX: slideAnim }] }
            ]}
          >
            <View style={styles.instructionsHeader}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={hideRecipeInstructions}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.instructionsTitle} numberOfLines={2}>
                {selectedRecipe?.name || selectedRecipe?.recipe_name || 'Recipe Instructions'}
              </Text>
              <View style={styles.placeholder} />
            </View>
            
            <ScrollView style={styles.instructionsContent} showsVerticalScrollIndicator={false}>
              {selectedRecipe?.instructions ? (
                <Text style={styles.instructionsText}>
                  {selectedRecipe.instructions
                    .split(/\d+\./)
                    .filter(step => step.trim())
                    .map((step, index) => `${index + 1}. ${step.trim()}`)
                    .join('\n\n')}
                </Text>
              ) : (
                <Text style={styles.noInstructionsText}>
                  No detailed instructions available for this recipe.
                </Text>
              )}
              
              {selectedRecipe?.ingredients && (
                <View style={styles.ingredientsSection}>
                  <Text style={styles.ingredientsSectionTitle}>Ingredients:</Text>
                  {selectedRecipe.ingredients.map((ingredient, index) => (
                    <Text key={index} style={styles.ingredientItem}>
                      • {ingredient}
                    </Text>
                  ))}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Delete Recipe?</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete "{recipeToDelete?.name || recipeToDelete?.recipe_name}"? 
              This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setRecipeToDelete(null);
                }}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteModalDeleteButton}
                onPress={() => {
                  deleteRecipe(recipeToDelete);
                  setShowDeleteModal(false);
                  setRecipeToDelete(null);
                }}
              >
                <Text style={styles.deleteModalDeleteText}>Delete</Text>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: '#1A202C',
  },
  recipeCount: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 32,
    alignItems: 'center',
  },
  recipeCountText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  placeholder: {
    width: 60,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
    color: '#9CA3AF',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A202C',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  filtersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterTabs: {
    flex: 1,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFilterTab: {
    backgroundColor: '#2D6A4F',
    borderColor: '#2D6A4F',
  },
  filterTabText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  activeFilterTabText: {
    color: '#FFFFFF',
  },
  sortContainer: {
    marginLeft: 10,
  },
  sortButton: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortButtonText: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 10,
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
    color: '#1A202C',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  clearSearchButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearSearchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  recipesList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  recipeContent: {
    padding: 16,
  },
  recipeHeader: {
    marginBottom: 12,
  },
  recipeHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipeMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 4,
    lineHeight: 24,
  },
  recipeDate: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  typeTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  chevron: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  chevronText: {
    fontSize: 20,
    color: '#CBD5E0',
    fontWeight: '300',
  },
  recipeDescription: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  recipeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#4A5568',
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 80,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  instructionsModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: 'bold',
  },
  instructionsTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A202C',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  instructionsContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  instructionsText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 20,
  },
  noInstructionsText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 40,
  },
  ingredientsSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  ingredientsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 12,
  },
  ingredientItem: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 6,
    lineHeight: 20,
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    maxWidth: 320,
    width: '100%',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A202C',
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteModalText: {
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  deleteModalDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteModalDeleteText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});