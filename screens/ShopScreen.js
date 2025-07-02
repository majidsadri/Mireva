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
  
  const textInputRef = useRef(null);

  // Debug function for text input changes
  const handleTextChange = (text) => {
    console.log('🔸 Text input changed:', JSON.stringify(text));
    setNewItemText(text);
  };

  useEffect(() => {
    loadShoppingList();
    loadSuggestions();
  }, []);

  const getUserHeaders = async () => {
    const userEmail = await AsyncStorage.getItem('userEmail');
    console.log('User email for shopping list:', userEmail);
    const headers = {
      ...API_CONFIG.getHeaders(),
      ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() })
    };
    console.log('Headers for shopping list request:', headers);
    return headers;
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
        console.log('Shopping list loaded successfully:', data);
        setShoppingItems(data.items || []);
      } else {
        console.warn('Failed to load shopping list from backend, status:', response.status);
        const errorText = await response.text();
        console.warn('Error response:', errorText);
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
      const headers = await getUserHeaders();
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHOPPING_SUGGESTIONS}`, {
        method: 'GET',
        headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } else {
        console.warn('Failed to load suggestions from backend');
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };


  const getCategoryForItem = (itemName) => {
    const categories = {
      'milk': 'Dairy', 'cheese': 'Dairy', 'yogurt': 'Dairy',
      'bread': 'Grains', 'rice': 'Grains', 'pasta': 'Grains',
      'chicken': 'Proteins', 'beef': 'Proteins', 'eggs': 'Proteins',
      'apple': 'Fruits', 'banana': 'Fruits', 'orange': 'Fruits'
    };
    const lowercaseName = itemName.toLowerCase();
    return Object.keys(categories).find(key => lowercaseName.includes(key)) ? 
           categories[Object.keys(categories).find(key => lowercaseName.includes(key))] : 'Other';
  };

  const addItem = async (itemData = null) => {
    // Get text directly from the TextInput ref
    const inputText = textInputRef.current?._lastNativeText || newItemText;
    const itemName = itemData ? itemData.name : inputText.trim();
    
    console.log('🔹 Input text from ref:', inputText);
    console.log('🔹 State text:', newItemText);
    console.log('🔹 Final item name:', itemName);
    
    if (!itemName) {
      Alert.alert('Error', `Please enter an item name. Input: "${inputText}", State: "${newItemText}"`);
      return;
    }

    try {
      setAddingItem(true);
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      const testItem = {
        name: itemName,
        category: itemData ? itemData.category : getCategoryForItem(itemName),
        completed: false,
        reason: itemData ? itemData.reason : 'Manually added',
        priority: itemData ? itemData.priority : 'medium'
      };
      
      const requestBody = JSON.stringify({ item: testItem });
      
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://37c2-18-215-164-114.ngrok-free.app/shopping/list');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
      xhr.setRequestHeader('X-User-Email', userEmail);
      
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          setAddingItem(false);
          if (xhr.status === 200) {
            if (!itemData) setNewItemText('');
            loadShoppingList();
            Alert.alert('Success', 'Item added to shopping list!');
          } else {
            Alert.alert('Error', `Failed to add item: ${xhr.status} - ${xhr.responseText}`);
          }
        }
      };
      
      xhr.send(requestBody);
      
    } catch (error) {
      setAddingItem(false);
      Alert.alert('Error', error.message);
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
    // Check if item already exists in shopping list
    const existingItem = shoppingItems.find(item => 
      item.name.toLowerCase() === suggestion.name.toLowerCase()
    );
    
    if (existingItem) {
      Alert.alert('Already Added', `${suggestion.name} is already in your shopping list.`);
      return;
    }

    await addItem(suggestion);
    
    // Remove from suggestions after adding
    setSuggestions(suggestions.filter(s => s.id !== suggestion.id));
  };

  const removeSuggestion = (suggestionId) => {
    Alert.alert(
      'Remove Suggestion',
      'Remove this suggestion? You can refresh to get new suggestions.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSuggestions(suggestions.filter(s => s.id !== suggestionId));
          },
        },
      ]
    );
  };

  const toggleCompleted = (itemId) => {
    setShoppingItems(shoppingItems.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    ));
  };

  const clearCompleted = () => {
    const completedItems = shoppingItems.filter(item => item.completed);
    completedItems.forEach(item => deleteItem(item.id));
  };

  const shareShoppingList = async () => {
    if (shoppingItems.length === 0) {
      Alert.alert('Empty List', 'Your shopping list is empty. Add some items first!');
      return;
    }

    // Separate completed and pending items
    const pendingItems = shoppingItems.filter(item => !item.completed);
    const completedItems = shoppingItems.filter(item => item.completed);

    // Create formatted text
    let message = '🛒 My Shopping List\n\n';
    
    if (pendingItems.length > 0) {
      message += `📝 To Buy (${pendingItems.length} items):\n`;
      pendingItems.forEach((item, index) => {
        message += `${index + 1}. ${item.name}\n`;
      });
      message += '\n';
    }

    if (completedItems.length > 0) {
      message += `✅ Completed (${completedItems.length} items):\n`;
      completedItems.forEach((item, index) => {
        message += `${index + 1}. ${item.name}\n`;
      });
    }

    message += '\n📱 Created with Mireva';

    try {
      // Try to share via system share sheet
      const result = await Share.share({
        message: message,
        title: 'My Shopping List',
      });

      if (result.action === Share.dismissedAction) {
        // User cancelled sharing
        return;
      }
    } catch (error) {
      // Fallback to SMS if sharing fails
      Alert.alert(
        'Share Shopping List',
        'Would you like to send this list via text message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send SMS',
            onPress: () => {
              const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
              Linking.openURL(smsUrl);
            },
          },
        ]
      );
    }
  };

  const completedCount = shoppingItems.filter(item => item.completed).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Cover Image */}
      <View style={styles.coverContainer}>
        <Image
          source={require('../assets/Mireva-top.png')}
          style={styles.coverImage}
        />
        <View style={styles.coverOverlay}>
          <Text style={styles.title}>Shopping List</Text>
          <Text style={styles.subtitle}>
            {shoppingItems.length} item{shoppingItems.length !== 1 ? 's' : ''} to buy • {completedCount} completed
          </Text>
        </View>
      </View>


      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={shareShoppingList}>
          <View style={styles.actionIcon}>
            <Text style={styles.iconText}>Share</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={loadSuggestions}>
          <View style={styles.actionIcon}>
            <Text style={styles.iconText}>Ideas</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => {
          Alert.prompt(
            'Add Item',
            'Enter item name:',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Add', 
                onPress: (text) => {
                  if (text && text.trim()) {
                    addItem({ name: text.trim() });
                  }
                }
              }
            ]
          );
        }}>
          <View style={styles.addActionIcon}>
            <Text style={styles.iconText}>Add</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={clearCompleted}>
          <View style={styles.actionIcon}>
            <Text style={styles.iconText}>Clear</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Smart Suggestions Section */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>Smart Suggestions</Text>
            {suggestionsLoading && <ActivityIndicator size="small" color="#2D6A4F" />}
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsScroll}
            contentContainerStyle={styles.suggestionsContent}
          >
            {suggestions.map((suggestion) => (
              <View 
                key={suggestion.id} 
                style={[
                  styles.suggestionCard,
                  suggestion.priority === 'high' && styles.highPrioritySuggestion
                ]}
              >
                <View style={styles.suggestionHeader}>
                  <Text style={styles.suggestionName}>{suggestion.name}</Text>
                  <TouchableOpacity 
                    style={styles.dismissButton}
                    onPress={() => removeSuggestion(suggestion.id)}
                  >
                    <Text style={styles.dismissText}>×</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
                
                
                <TouchableOpacity 
                  style={styles.addSuggestionButton}
                  onPress={() => addSuggestionToList(suggestion)}
                >
                  <Text style={styles.addSuggestionText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Items Section */}
      <View style={styles.itemsSection}>
        <View style={styles.itemsHeader}>
          <Text style={styles.itemsTitle}>📋 Items</Text>
          <Text style={styles.itemsCount}>{shoppingItems.length} total</Text>
        </View>

        <ScrollView style={styles.itemsList}>
          {shoppingItems.map((item) => (
            <View key={item.id} style={[styles.itemRow, item.completed && styles.completedItem]}>
              <View style={styles.itemLeft}>
                <TouchableOpacity 
                  style={[styles.checkbox, item.completed && styles.checkedBox]} 
                  onPress={() => toggleCompleted(item.id)}
                >
                  {item.completed && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, item.completed && styles.completedText]}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{item.category}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id)}>
                <Text style={styles.deleteButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
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
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#CBD5E0',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 25,
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    backgroundColor: '#2D6A4F',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  addActionIcon: {
    backgroundColor: '#FF6B35', // Orange color from Mireva spectrum
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  itemsSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  itemsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  itemsCount: {
    fontSize: 14,
    color: '#718096',
  },
  itemsList: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginRight: 15,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  itemCategory: {
    fontSize: 14,
    color: '#718096',
  },
  deleteButton: {
    padding: 5,
  },
  deleteButtonText: {
    fontSize: 18,
    color: '#E53E3E',
  },
  completedItem: {
    opacity: 0.6,
  },
  checkedBox: {
    backgroundColor: '#2D6A4F',
    borderColor: '#2D6A4F',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#718096',
  },
  // Suggestions Section Styles
  suggestionsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  suggestionsScroll: {
    flexGrow: 0,
  },
  suggestionsContent: {
    paddingRight: 20,
  },
  suggestionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    width: 120,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    paddingBottom: 35, // Extra space for the add button
  },
  highPrioritySuggestion: {
    borderColor: '#F56565',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  suggestionName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3748',
    flex: 1,
    marginRight: 4,
  },
  suggestionReason: {
    fontSize: 10,
    color: '#718096',
    marginBottom: 6,
    fontStyle: 'italic',
    lineHeight: 12,
  },
  suggestionCategory: {
    fontSize: 9,
    color: '#4A5568',
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  priorityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F56565',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: {
    fontSize: 10,
  },
  // Suggestion Action Buttons
  dismissButton: {
    padding: 2,
  },
  dismissText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addSuggestionButton: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: '#2D6A4F',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  addSuggestionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});