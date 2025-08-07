import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  PanResponder,
  Animated,
  Vibration,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { API_CONFIG } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera } from 'react-native-image-picker';
import axios from 'axios';
import foodCategories from '../food-categories.json';
// Fallback icon component for cross-platform compatibility
const Icon = ({ name, size, color, style }) => {
  const iconMap = {
    'photo-camera': '📸',
    'inventory': '📦',
    'close': '✕',
  };
  
  return (
    <Text style={[{ fontSize: size, color }, style]}>
      {iconMap[name] || '•'}
    </Text>
  );
};

const { width } = Dimensions.get('window');

const MEASUREMENTS = [
  'unit',
  'g',
  'kg',
  'ml',
  'L',
  'cup',
  'tbsp',
  'tsp',
  'oz',
  'lb',
];

const EXPIRY_PERIODS = [
  { label: '1 Week', days: 7 },
  { label: '3 Weeks', days: 21 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '1 Year', days: 365 },
];

const ESSENTIAL_PANTRY_ITEMS = [
  'Rice', 'Pasta', 'Bread', 'Eggs', 'Milk', 'Butter',
  'Olive Oil', 'Salt', 'Pepper', 'Garlic', 'Onions', 'Tomatoes',
  'Chicken', 'Ground Beef', 'Fish', 'Cheese', 'Yogurt', 'Flour',
  'Sugar', 'Honey', 'Potatoes', 'Carrots', 'Bell Peppers', 'Spinach'
];

// Simple Item Component
const ItemCard = ({ 
  item, 
  expiry, 
  onItemClick, 
  formatItemAmount
}) => {
  
  return (
    <View style={styles.modernItemCard}>
      <TouchableOpacity
        style={styles.itemTouchable}
        onPress={onItemClick}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={2}>
              {(item.name || 'Unknown').trim()}
            </Text>
          </View>
          
          <View style={styles.itemDetails}>
            <Text style={styles.itemAmount}>{formatItemAmount(item)}</Text>
            <View style={[styles.statusCircle, { 
              backgroundColor: expiry.color,
            }]} />
          </View>
        </View>
      </TouchableOpacity>
      
    </View>
  );
};

// Function to categorize items using the JSON data
const categorizeItem = (itemName) => {
  const normalizedName = itemName.toLowerCase().trim();
  
  // Check each category in the JSON file
  for (const [category, keywords] of Object.entries(foodCategories)) {
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword)) {
        return category;
      }
    }
  }
  
  // Default to Grains & Pantry if no match found
  return 'Grains & Pantry';
};

export default function MirevaScreen() {
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('User');
  const [scanning, setScanning] = useState(false);
  const [pantryName, setPantryName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    amount: '',
    measurement: 'unit',
    expiryPeriod: '1 Month',
  });
  const [showCustomExpiry, setShowCustomExpiry] = useState(false);
  const [customWeeks, setCustomWeeks] = useState('');
  const [showCreatePantryModal, setShowCreatePantryModal] = useState(false);
  const [newPantryName, setNewPantryName] = useState('');
  const [creatingPantry, setCreatingPantry] = useState(false);
  const [selectedEssentialItems, setSelectedEssentialItems] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editedItem, setEditedItem] = useState({
    name: '',
    amount: '',
    measurement: 'unit',
    expiryDate: new Date(),
  });
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showMeasurementPicker, setShowMeasurementPicker] = useState(false);

  useEffect(() => {
    // Clear any cached pantry name and force reload
    setPantryName('');
    loadPantryItems();
    loadUserInfo();
    loadUserPantryName();
  }, []);

  // Refresh pantry name and items when screen comes into focus (e.g., after joining a new pantry)
  useFocusEffect(
    React.useCallback(() => {
      loadUserInfo();
      loadUserPantryName();
      loadPantryItems();
    }, [])
  );

  const loadUserInfo = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (userEmail) {
        // First try to load from saved user data
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsedData = JSON.parse(userData);
          if (parsedData.name) {
            setUserName(parsedData.name);
            return;
          }
        }
        
        // Fallback to email-based name
        const name = userEmail.split('@')[0];
        setUserName(name.charAt(0).toUpperCase() + name.slice(1));
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadUserPantryName = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      console.log('🔍 Loading pantry name for user:', userEmail);
      
      if (userEmail) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/get-user-pantry`, {
          method: 'POST',
          headers: {
            ...API_CONFIG.getHeaders(),
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({ email: userEmail.trim().toLowerCase() }),
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Received pantry data:', data);
          const newPantryName = data.pantryName || 'My Pantry';
          console.log('🏠 Setting pantry name to:', newPantryName);
          setPantryName(newPantryName);
        } else {
          console.error('❌ Failed to get pantry name, status:', response.status);
          setPantryName('My Pantry');
        }
      }
    } catch (error) {
      console.error('Error loading pantry name:', error);
      setPantryName('My Pantry');
    }
  };

  const loadPantryItems = async () => {
    try {
      setLoading(true);
      
      const email = await AsyncStorage.getItem('userEmail');
      
      console.log(`Loading pantry items for user: ${email}`);
      
      if (!email) {
        console.log('No user email, showing empty state');
        setPantryItems([]);
        setLoading(false);
        return;
      }

      // Try backend with timeout and error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        // No longer need pantry parameter - backend will use user's pantryName from users.json
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`;
        
        console.log(`Trying backend: ${url}`);
        console.log(`Using email header: ${email.trim().toLowerCase()}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            ...API_CONFIG.getHeaders(),
            'X-User-Email': email.trim().toLowerCase(),
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        console.log(`Backend response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Backend response data:', data);
          setPantryItems(Array.isArray(data) ? data : []);
          console.log(`Backend loaded ${Array.isArray(data) ? data.length : 0} items`);
        } else {
          const errorText = await response.text();
          console.log(`Backend failed with status ${response.status}, error: ${errorText}`);
          setPantryItems([]); // Show empty state rather than crash
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.log('Backend request failed:', fetchError.message);
        setPantryItems([]); // Show empty state rather than crash
      }
    } catch (error) {
      console.error('Error in loadPantryItems:', error);
      setPantryItems([]); // Always set some state to prevent crashes
    } finally {
      setLoading(false);
    }
  };

  const takePictureAndScan = async () => {
    try {
      setScanning(true);
      
      // Check camera permissions first
      const options = {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
        saveToPhotos: false,
        cameraType: 'back',
        presentationStyle: 'fullScreen',
      };

      console.log('📸 Launching camera with options:', options);
      const result = await launchCamera(options);
      
      console.log('📸 Camera result:', result);

      if (result.didCancel) {
        console.log('📸 User cancelled camera');
        return;
      }
      
      if (result.errorCode) {
        console.error('📸 Camera error:', result.errorMessage);
        Alert.alert('Camera Error', result.errorMessage || 'Failed to open camera');
        return;
      }
      
      if (!result.assets || !result.assets[0]?.uri) {
        console.error('📸 No image captured');
        Alert.alert('Error', 'No image was captured');
        return;
      }

      const uri = result.assets[0].uri;
      console.log('📸 Image captured:', uri);
      
      const data = new FormData();
      data.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'pantry-photo.jpg',
      });

      const email = await AsyncStorage.getItem('userEmail');
      console.log('📧 Using email:', email);
      
      if (!email) {
        Alert.alert('Error', 'Please sign in to scan items');
        return;
      }

      console.log('🚀 Sending image to backend...');
      const response = await axios.post(`${API_CONFIG.BASE_URL}/scan-and-add`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-User-Email': email.trim().toLowerCase(),
        },
        timeout: 30000, // 30 second timeout
      });

      console.log('✅ Backend response:', response.data);
      const food = response.data.item || 'Unknown food';
      
      // Refresh pantry items immediately after adding
      loadPantryItems();
      
    } catch (err) {
      console.error('❌ Error in scan process:', err);
      
      let errorMessage = 'Something went wrong while scanning the item.';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (err.response) {
        // Check for image quality errors
        if (err.response.status === 400 && err.response.data?.error) {
          errorMessage = err.response.data.message;
        } else {
          errorMessage = `Server error: ${err.response.status}`;
        }
      } else if (err.request) {
        errorMessage = 'Network error. Check your connection.';
      }
      
      Alert.alert('Scan Error', errorMessage);
    } finally {
      setScanning(false);
    }
  };

  const addManualItem = async () => {
    if (!newItem.name.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
  
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        Alert.alert('Error', 'Please sign in to add items');
        return;
      }
  
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'POST',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': email.trim().toLowerCase(),
        },
        body: JSON.stringify({
          id: Date.now().toString(),
          name: newItem.name,
          amount: newItem.amount,
          measurement: newItem.measurement,
          expiryDate: calculateExpiryDate(newItem.expiryPeriod).toISOString(),
        }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to add item');
      }
  
      // Reset form
      setNewItem({
        name: '',
        amount: '',
        measurement: 'unit',
        expiryPeriod: '1 Month',
      });
      
      setShowAddModal(false);
      
      // Refresh pantry items immediately after adding
      loadPantryItems();
      
    } catch (err) {
      console.error('Error adding manual item:', err);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  };

  const toggleEssentialItem = (item) => {
    setSelectedEssentialItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  const createNewPantry = async () => {
    if (!newPantryName.trim()) {
      Alert.alert('Error', 'Please enter a pantry name');
      return;
    }

    setCreatingPantry(true);
    
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        Alert.alert('Error', 'Please sign in to create a pantry');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/update-user-pantry`, {
        method: 'POST',
        headers: {
          ...API_CONFIG.getHeaders(),
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          pantryName: newPantryName.trim(),
          essentialItems: selectedEssentialItems,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create pantry');
      }

      const result = await response.json();
      
      // Update local storage with new pantry name
      await AsyncStorage.setItem('currentPantryName', newPantryName.trim());
      
      // Save user's essential items preferences for future smart suggestions
      if (selectedEssentialItems.length > 0) {
        await AsyncStorage.setItem('userEssentialItems', JSON.stringify(selectedEssentialItems));
      }
      
      // Add selected essential items to the new pantry
      if (selectedEssentialItems.length > 0) {
        for (const itemName of selectedEssentialItems) {
          try {
            await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
              method: 'POST',
              headers: {
                ...API_CONFIG.getHeaders(),
                'X-User-Email': email.trim().toLowerCase(),
              },
              body: JSON.stringify({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: itemName,
                amount: '1',
                measurement: 'unit',
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
              }),
            });
          } catch (err) {
            console.error(`Error adding ${itemName}:`, err);
          }
        }
      }
      
      // Reset form and close modal
      setNewPantryName('');
      setSelectedEssentialItems([]);
      setShowCreatePantryModal(false);
      
      // Refresh pantry data
      loadUserPantryName();
      loadPantryItems();
      
      const itemsText = selectedEssentialItems.length > 0 
        ? ` with ${selectedEssentialItems.length} essential items` 
        : '';
      
      Alert.alert(
        'Pantry Created!', 
        `Welcome to your new pantry "${newPantryName.trim()}"${itemsText}!`,
        [{ text: 'OK' }]
      );
      
    } catch (err) {
      console.error('Error creating pantry:', err);
      Alert.alert('Error', 'Failed to create pantry. Please try again.');
    } finally {
      setCreatingPantry(false);
    }
  };

  const calculateExpiryDate = (period) => {
    let days = 30; // default
    
    if (period === 'Custom' && customWeeks) {
      days = parseInt(customWeeks) * 7;
    } else {
      const selectedPeriod = EXPIRY_PERIODS.find(p => p.label === period);
      days = selectedPeriod ? selectedPeriod.days : 30;
    }
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return expiryDate;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const categorizeItems = (items) => {
    const categories = {
      'Fruits & Vegetables': [],
      'Proteins': [],
      'Grains & Pantry': [],
      'Dairy': [],
      'Beverages': [],
      'Frozen': [],
      'Condiments': [],
      'Expired': []
    };

    const now = new Date();
    
    items.forEach(item => {
      // Use backend-assigned category if available, otherwise use frontend fallback
      let targetCategory = item.category || 'Grains & Pantry';
      
      // Check if expired first (handle null expiry dates properly)
      if (item.expiryDate && item.expiryDate !== null) {
        try {
          const expiryDate = new Date(item.expiryDate);
          if (!isNaN(expiryDate.getTime()) && expiryDate < now) {
            categories['Expired'].push(item);
            return;
          }
        } catch (error) {
          console.warn('Invalid expiry date format:', item.expiryDate);
        }
      }
      // If no expiry date (null), item doesn't expire - use normal category
      
      // Use backend category if it exists and is valid
      if (targetCategory && categories.hasOwnProperty(targetCategory)) {
        categories[targetCategory].push(item);
      } else {
        // Fallback to frontend categorization for legacy items without backend category
        const detectedCategory = categorizeItem(item.name || '');
        // Safety check: ensure the detected category exists in our categories object
        if (categories.hasOwnProperty(detectedCategory)) {
          categories[detectedCategory].push(item);
        } else {
          // If detected category doesn't exist, default to 'Grains & Pantry'
          categories['Grains & Pantry'].push(item);
        }
      }
    });
    
    return categories;
  };


  const formatItemAmount = (item) => {
    // Handle new format: amount + measurement
    if (item.amount && item.measurement) {
      return `${item.amount} ${item.measurement}`;
    } 
    // Handle old format: quantity field
    else if (item.quantity) {
      return item.quantity;
    }
    // Default fallback
    return '1 unit';
  };

  const getExpiryStatus = (expiryDate) => {
    // Handle null expiry dates (items that don't expire)
    if (!expiryDate || expiryDate === null) {
      return { status: 'no-expiry', color: '#68D391', text: 'No expiry', label: 'No exp' };
    }
    
    try {
      const now = new Date();
      const expiry = new Date(expiryDate);
      
      // Check for invalid date
      if (isNaN(expiry.getTime())) {
        return { status: 'unknown', color: '#A0AEC0', text: 'Unknown', label: 'Unknown' };
      }
      
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return { status: 'expired', color: '#E53E3E', text: 'Expired', label: 'Expired' };
      if (diffDays <= 3) return { status: 'warning', color: '#FFA500', text: `${diffDays}d left`, label: `${diffDays}d` };
      if (diffDays <= 7) return { status: 'soon', color: '#FFD700', text: `${diffDays}d left`, label: `${diffDays}d` };
      return { status: 'fresh', color: '#68D391', text: `${diffDays}d left`, label: `${diffDays}d` };
    } catch (error) {
      console.warn('Error parsing expiry date:', expiryDate);
      return { status: 'unknown', color: '#A0AEC0', text: 'Unknown' };
    }
  };

  const handleItemClick = (item) => {
    setEditingItem(item);
    setEditedItem({
      name: item.name || '',
      amount: item.amount || '1',
      measurement: item.measurement || 'unit',
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : new Date(),
    });
    setShowEditModal(true);
  };

  const handleUpdateItem = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      
      const updatedItem = {
        ...editingItem,
        ...editedItem,
        expiryDate: editedItem.expiryDate.toISOString(),
      };
      
      // Update locally first
      setPantryItems(currentItems =>
        currentItems.map(item =>
          item.id === editingItem.id ? updatedItem : item
        )
      );
      
      setShowEditModal(false);
      
      // Try to update backend
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/pantry/${editingItem.id}`, {
          method: 'PUT',
          headers: {
            ...API_CONFIG.getHeaders(),
            'X-User-Email': email?.trim().toLowerCase() || '',
          },
          body: JSON.stringify(updatedItem),
        });
        
        if (response.ok) {
          Alert.alert('Success', 'Item updated successfully');
        } else {
          console.log('Backend update failed, but local update succeeded');
        }
      } catch (backendError) {
        console.log('Backend update error (non-critical):', backendError.message);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Failed to update item. Please try again.');
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to remove "${itemName}" from your pantry?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // For now, just remove from local state and show success
              // Backend delete can be added later when backend is stable
              setPantryItems(currentItems => 
                currentItems.filter(item => item.id !== itemId)
              );
              Alert.alert('Success', `${itemName} has been removed from your pantry`);
              
              // Optional: Try backend delete but don't fail if it doesn't work
              try {
                const email = await AsyncStorage.getItem('userEmail');
                
                const response = await fetch(`${API_CONFIG.BASE_URL}/pantry/${itemId}`, {
                  method: 'DELETE',
                  headers: {
                    ...API_CONFIG.getHeaders(),
                    'X-User-Email': email?.trim().toLowerCase() || '',
                  },
                });
                
                if (response.ok) {
                  console.log('Item deleted from backend successfully');
                } else {
                  console.log('Backend delete failed, but local delete succeeded');
                }
              } catch (backendError) {
                console.log('Backend delete error (non-critical):', backendError.message);
              }
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item. Please try again.');
            }
          },
        },
      ]
    );
  };


  const renderCategorySection = (categoryName, items, categoryColor) => {
    if (items.length === 0) return null;
    
    return (
      <View key={categoryName} style={[styles.categoryCard, { backgroundColor: categoryColor }]}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryTitleContainer}>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>{categoryName}</Text>
              <Text style={styles.categorySubtitle}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>
        
        <View style={[styles.itemsScrollView, { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 }]}>
          {items.map((item, index) => {
            const expiry = getExpiryStatus(item.expiryDate);
            
            return (
              <ItemCard
                key={item.id || index}
                item={item}
                expiry={expiry}
                formatItemAmount={formatItemAmount}
                onItemClick={() => handleItemClick(item)}
              />
            );
          })}
        </View>
      </View>
    );
  };
  
  const getCategoryIcon = (categoryName) => {
    const icons = {
      'Fruits & Vegetables': '🥬',
      'Proteins': '🥩',
      'Grains & Pantry': '🌾',
      'Dairy': '🥛',
      'Expired': '⚠️'
    };
    return icons[categoryName] || '📦';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text style={styles.loadingText}>Loading your pantry...</Text>
        </View>
      </View>
    );
  }

  const categorizedItems = categorizeItems(pantryItems);
  const shelfColors = {
    'Fruits & Vegetables': '#E6FFFA', // Light teal from Mireva palette
    'Proteins': '#FFF5E6', // Light orange from Mireva palette
    'Grains & Pantry': '#F0FFF4', // Light green from Mireva palette
    'Dairy': '#E8F5E8', // Light sage green from Mireva palette
    'Beverages': '#E6F3FF', // Light blue
    'Frozen': '#F0E6FF', // Light purple
    'Condiments': '#FFE6E6', // Light pink
    'Expired': '#FFEBEE' // Light red for expired items
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A4B4C" />
      
      {/* Top Cover Image */}
      <View style={styles.coverContainer}>
        <Image
          source={require('../assets/Mireva-top.png')}
          style={styles.coverImage}
        />
        <View style={styles.coverOverlay}>
          <Text style={styles.title}>{pantryName || 'My Pantry'}</Text>
          <Text style={styles.subtitle}>
            Welcome back, {userName}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.scanButton} 
          onPress={takePictureAndScan}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator size="small" color="#0A4B4C" />
          ) : (
            <View style={styles.cameraIcon}>
              <View style={styles.cameraBody} />
              <View style={styles.cameraLens} />
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={() => {
            console.log('🔄 Manual refresh triggered');
            loadUserPantryName();
            loadPantryItems();
          }}
        >
          <View style={styles.refreshIcon}>
            <View style={styles.refreshArrow} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{pantryItems.length}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{categorizedItems['Expired']?.length || 0}</Text>
          <Text style={styles.statLabel}>Expired</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{Object.keys(categorizedItems).filter(cat => categorizedItems[cat].length > 0).length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
      </View>

      {/* Content Area */}
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {pantryItems.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeIconContainer}>
                <View style={styles.welcomeIconShape} />
              </View>
              
              <Text style={styles.welcomeTitle}>Welcome to Mireva!</Text>
              <Text style={styles.welcomeSubtitle}>
                Smart pantry management made simple
              </Text>
              
              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={() => setShowCreatePantryModal(true)}
              >
                <Text style={styles.primaryButtonText}>CREATE YOUR PANTRY</Text>
              </TouchableOpacity>
              
              <View style={styles.welcomeFeatures}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconContainer, { backgroundColor: '#EFF6FF' }]}>
                    <View style={styles.featureDot} />
                  </View>
                  <Text style={styles.featureText}>Track expiry dates</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconContainer, { backgroundColor: '#F0FDF4' }]}>
                    <View style={styles.featureDot} />
                  </View>
                  <Text style={styles.featureText}>Smart shopping lists</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconContainer, { backgroundColor: '#FEF3F2' }]}>
                    <View style={styles.featureDot} />
                  </View>
                  <Text style={styles.featureText}>Share with family</Text>
                </View>
              </View>
              
              <Text style={styles.helpText}>
                Already have a pantry? Join one from your Profile page.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.categoriesContainer}>
            {Object.entries(categorizedItems).map(([categoryName, items]) => 
              renderCategorySection(categoryName, items, shelfColors[categoryName])
            )}
          </View>
        )}
        
        <View style={styles.bottomPadding} />
      </ScrollView>
      
      {/* Manual Add Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.compactModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContentContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Item Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter item name"
                value={newItem.name}
                onChangeText={(text) => setNewItem({ ...newItem, name: text })}
                autoFocus
              />
            </View>
            
            <View style={styles.inputRow}>
              <View style={styles.amountContainer}>
                <Text style={styles.inputLabel}>Amount</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="1"
                  value={newItem.amount}
                  onChangeText={(text) => setNewItem({ ...newItem, amount: text })}
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Expires in</Text>
              <View style={styles.expiryButtonContainer}>
                {EXPIRY_PERIODS.map((period) => (
                  <TouchableOpacity
                    key={period.label}
                    style={[
                      styles.expiryButton,
                      newItem.expiryPeriod === period.label && styles.expiryButtonSelected
                    ]}
                    onPress={() => {
                      setNewItem({ ...newItem, expiryPeriod: period.label });
                      setShowCustomExpiry(false);
                    }}
                  >
                    <Text style={[
                      styles.expiryButtonText,
                      newItem.expiryPeriod === period.label && styles.expiryButtonTextSelected
                    ]}>
                      {period.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.expiryButton,
                    styles.customExpiryButton,
                    showCustomExpiry && styles.expiryButtonSelected
                  ]}
                  onPress={() => {
                    setShowCustomExpiry(true);
                    setNewItem({ ...newItem, expiryPeriod: 'Custom' });
                  }}
                >
                  <Text style={[
                    styles.expiryButtonText,
                    showCustomExpiry && styles.expiryButtonTextSelected
                  ]}>
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>
              
              {showCustomExpiry && (
                <View style={styles.customExpiryContainer}>
                  <TextInput
                    style={styles.customExpiryInput}
                    placeholder="Enter weeks (e.g., 2)"
                    value={customWeeks}
                    onChangeText={setCustomWeeks}
                    keyboardType="numeric"
                  />
                  <Text style={styles.customExpiryLabel}>weeks</Text>
                </View>
              )}
            </View>
            
          </ScrollView>
          
          {/* Action Buttons - Outside ScrollView to stay visible */}
          <View style={styles.addModalButtonContainer}>
            <TouchableOpacity 
              style={styles.addModalCircularButton}
              onPress={() => setShowAddModal(false)}
            >
              <View style={[styles.circularButton, styles.cancelCircularButton]}>
                <Text style={styles.circularButtonText}>Cancel</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.addModalCircularButton}
              onPress={addManualItem}
            >
              <View style={[styles.circularButton, styles.saveCircularButton]}>
                <Text style={styles.circularButtonText}>Save</Text>
              </View>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Item Modal - Professional Design */}
      <Modal
        visible={showEditModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <TouchableOpacity 
          style={styles.editModalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowEditModal(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.editModalContainer}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header with Item Name */}
            <View style={styles.editModalHeader}>
              <View style={styles.editModalItemPreview}>
                <Text style={styles.editModalItemName} numberOfLines={1}>
                  {editingItem?.name || 'Item'}
                </Text>
                <Text style={styles.editModalItemSubtitle}>
                  {editingItem?.amount || '1'} {editingItem?.measurement || 'unit'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editModalCloseButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.editModalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Edit Form */}
            <View style={styles.editModalBody}>
              {/* Item Name Input */}
              <View style={styles.editModalField}>
                <Text style={styles.editModalLabel}>Name</Text>
                <TextInput
                  style={styles.editModalInput}
                  placeholder="Item name"
                  placeholderTextColor="#A0AEC0"
                  value={editedItem.name}
                  onChangeText={(text) => setEditedItem({ ...editedItem, name: text })}
                />
              </View>

              {/* Amount and Measurement Row */}
              <View style={styles.editModalRow}>
                <View style={[styles.editModalField, { flex: 1, marginRight: 12 }]}>
                  <Text style={styles.editModalLabel}>Amount</Text>
                  <TextInput
                    style={styles.editModalInput}
                    placeholder="1"
                    placeholderTextColor="#A0AEC0"
                    value={editedItem.amount}
                    onChangeText={(text) => setEditedItem({ ...editedItem, amount: text })}
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={[styles.editModalField, { flex: 1.5 }]}>
                  <Text style={styles.editModalLabel}>Unit</Text>
                  <TouchableOpacity
                    style={styles.editModalSelect}
                    onPress={() => setShowMeasurementPicker(true)}
                  >
                    <Text style={styles.editModalSelectText}>
                      {editedItem.measurement}
                    </Text>
                    <Text style={styles.editModalSelectArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Expiry Date */}
              <View style={styles.editModalField}>
                <Text style={styles.editModalLabel}>Expiry Date</Text>
                <TouchableOpacity
                  style={styles.editModalDateButton}
                  onPress={() => setShowEditDatePicker(true)}
                >
                  <Text style={styles.editModalDateIcon}>📅</Text>
                  <Text style={styles.editModalDateText}>
                    {editedItem.expiryDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.editModalDeleteButton]}
                onPress={() => {
                  setShowEditModal(false);
                  handleDeleteItem(editingItem.id, editingItem.name);
                }}
              >
                <Text style={styles.editModalDeleteText}>Delete Item</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.editModalButton, styles.editModalSaveButton]}
                onPress={handleUpdateItem}
              >
                <Text style={styles.editModalSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>

            {/* Date Picker */}
            {showEditDatePicker && Platform.OS === 'ios' && (
              <View style={styles.editModalDatePicker}>
                <DateTimePicker
                  value={editedItem.expiryDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setEditedItem({ ...editedItem, expiryDate: selectedDate });
                    }
                  }}
                  minimumDate={new Date()}
                />
                <TouchableOpacity
                  style={styles.editModalDateDone}
                  onPress={() => setShowEditDatePicker(false)}
                >
                  <Text style={styles.editModalDateDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {showEditDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={editedItem.expiryDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEditDatePicker(false);
                  if (selectedDate) {
                    setEditedItem({ ...editedItem, expiryDate: selectedDate });
                  }
                }}
                minimumDate={new Date()}
              />
            )}

            {/* Measurement Picker Modal */}
            {showMeasurementPicker && (
              <View style={styles.editModalMeasurementPicker}>
                <View style={styles.editModalPickerHeader}>
                  <TouchableOpacity onPress={() => setShowMeasurementPicker(false)}>
                    <Text style={styles.editModalPickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.editModalPickerTitle}>Select Unit</Text>
                  <TouchableOpacity onPress={() => setShowMeasurementPicker(false)}>
                    <Text style={styles.editModalPickerDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.editModalPickerList}>
                  {MEASUREMENTS.map((measurement) => (
                    <TouchableOpacity
                      key={measurement}
                      style={styles.editModalPickerItem}
                      onPress={() => {
                        setEditedItem({ ...editedItem, measurement });
                        setShowMeasurementPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.editModalPickerItemText,
                        editedItem.measurement === measurement && styles.editModalPickerItemSelected
                      ]}>
                        {measurement}
                      </Text>
                      {editedItem.measurement === measurement && (
                        <Text style={styles.editModalPickerCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Create New Pantry Modal */}
      <Modal
        visible={showCreatePantryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreatePantryModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.compactModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContentContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Pantry</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Pantry Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter pantry name (e.g., Family Kitchen)"
                value={newPantryName}
                onChangeText={setNewPantryName}
                autoFocus
              />
            </View>

            <View style={styles.essentialsContainer}>
              <Text style={styles.essentialsTitle}>Add Essential Items (Optional)</Text>
              
              <View style={styles.essentialsGrid}>
                {ESSENTIAL_PANTRY_ITEMS.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.essentialButton,
                      selectedEssentialItems.includes(item) && styles.essentialButtonSelected
                    ]}
                    onPress={() => toggleEssentialItem(item)}
                  >
                    <Text style={[
                      styles.essentialButtonText,
                      selectedEssentialItems.includes(item) && styles.essentialButtonTextSelected
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {selectedEssentialItems.length > 0 && (
                <Text style={styles.selectedItemsCount}>
                  {selectedEssentialItems.length} items selected
                </Text>
              )}
            </View>
          </ScrollView>
          
          {/* Action Buttons - Outside ScrollView to stay visible */}
          <View style={styles.addModalButtonContainer}>
            <TouchableOpacity 
              style={styles.addModalCircularButton}
              onPress={() => setShowCreatePantryModal(false)}
            >
              <View style={[styles.circularButton, styles.cancelCircularButton]}>
                <Text style={styles.circularButtonText}>Cancel</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.addModalCircularButton}
              onPress={createNewPantry}
              disabled={creatingPantry}
            >
              <View style={[styles.circularButton, styles.saveCircularButton, creatingPantry && { opacity: 0.6 }]}>
                <Text style={styles.circularButtonText}>
                  {creatingPantry ? 'Creating...' : 'Create'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 25,
    gap: 25,
  },
  addButton: {
    backgroundColor: '#0A4B4C',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0A4B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scanButton: {
    backgroundColor: '#9FD5CD',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9FD5CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  refreshButton: {
    backgroundColor: '#22C55E',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  cameraIcon: {
    position: 'relative',
    width: 28,
    height: 28,
  },
  cameraBody: {
    position: 'absolute',
    width: 28,
    height: 20,
    backgroundColor: '#0A4B4C',
    borderRadius: 4,
    top: 4,
  },
  cameraLens: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: '#F7F9FC',
    borderRadius: 6,
    top: 8,
    left: 8,
    borderWidth: 2,
    borderColor: '#0A4B4C',
  },
  refreshIcon: {
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderTopColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  refreshArrow: {
    position: 'absolute',
    top: -2,
    right: -1,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
    paddingTop: 20,
  },
  categoriesContainer: {
    paddingHorizontal: 12,
  },
  categoryCard: {
    marginHorizontal: 4,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  categoryHeader: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  categoryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  categoryIconText: {
    fontSize: 20,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 2,
  },
  categorySubtitle: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  itemsScrollView: {
    paddingHorizontal: 12,
  },
  itemsScrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  modernItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    margin: 4,
    width: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemContent: {
    padding: 8,
  },
  itemHeader: {
    marginBottom: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D3748',
    lineHeight: 16,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemAmount: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '500',
  },
  statusCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    minHeight: 500,
  },
  welcomeContent: {
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  welcomeIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  welcomeIconShape: {
    width: 40,
    height: 40,
    backgroundColor: '#22C55E',
    borderRadius: 12,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  welcomeFeatures: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureDot: {
    width: 8,
    height: 8,
    backgroundColor: '#22C55E',
    borderRadius: 4,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 20,
    minWidth: 200,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  essentialsContainer: {
    marginTop: 24,
  },
  essentialsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  essentialsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  essentialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  essentialButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    margin: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  essentialButtonSelected: {
    backgroundColor: '#0A4B4C',
    borderColor: '#0A4B4C',
  },
  essentialButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  essentialButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedItemsCount: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#2D6A4F',
  },
  bottomPadding: {
    height: 120,
  },
  deleteButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E53E3E',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 60,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 15,
    },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
  },
  compactModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 120,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalContentContainer: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  amountContainer: {
    flex: 1,
  },
  measurementContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    fontSize: 16,
    color: '#2D3748',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  picker: {
    height: 50,
  },
  dateButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#2D3748',
  },
  deleteItemButton: {
    backgroundColor: '#E53E3E',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  deleteItemButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Professional Edit Modal Styles
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  editModalItemPreview: {
    flex: 1,
  },
  editModalItemName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 4,
  },
  editModalItemSubtitle: {
    fontSize: 14,
    color: '#718096',
  },
  editModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  editModalCloseIcon: {
    fontSize: 18,
    color: '#718096',
  },
  editModalBody: {
    padding: 24,
  },
  editModalField: {
    marginBottom: 20,
  },
  editModalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#718096',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editModalInput: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A202C',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editModalRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  editModalSelect: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editModalSelectText: {
    fontSize: 16,
    color: '#1A202C',
  },
  editModalSelectArrow: {
    fontSize: 12,
    color: '#718096',
  },
  editModalDateButton: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  editModalDateIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  editModalDateText: {
    fontSize: 16,
    color: '#1A202C',
    flex: 1,
  },
  editModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  editModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editModalDeleteButton: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FEB2B2',
  },
  editModalDeleteText: {
    color: '#E53E3E',
    fontSize: 16,
    fontWeight: '600',
  },
  editModalSaveButton: {
    backgroundColor: '#48BB78',
  },
  editModalSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editModalDatePicker: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F7FAFC',
  },
  editModalDateDone: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  editModalDateDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#48BB78',
  },
  
  // Measurement Picker Styles
  editModalMeasurementPicker: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  editModalPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  editModalPickerCancel: {
    fontSize: 16,
    color: '#E53E3E',
  },
  editModalPickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A202C',
  },
  editModalPickerDone: {
    fontSize: 16,
    color: '#48BB78',
    fontWeight: '600',
  },
  editModalPickerList: {
    paddingVertical: 8,
  },
  editModalPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F4F8',
  },
  editModalPickerItemText: {
    fontSize: 17,
    color: '#2D3748',
  },
  editModalPickerItemSelected: {
    color: '#48BB78',
    fontWeight: '600',
  },
  editModalPickerCheck: {
    fontSize: 18,
    color: '#48BB78',
    fontWeight: '600',
  },
  
  itemTouchable: {
    flex: 1,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  picker: {
    height: 50,
    color: '#000000',
  },
  pickerItem: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  expiryButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
  expiryButton: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  expiryButtonSelected: {
    backgroundColor: '#0A4B4C',
    borderColor: '#0A4B4C',
  },
  expiryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A5568',
    textAlign: 'center',
  },
  expiryButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  customExpiryButton: {
    backgroundColor: '#F7FAFC',
    borderColor: '#CBD5E0',
    borderStyle: 'dashed',
  },
  customExpiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customExpiryInput: {
    borderWidth: 2,
    borderColor: '#90EE90',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    width: 100,
    textAlign: 'center',
    fontWeight: '600',
    color: '#2D3748',
    shadowColor: '#90EE90',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  customExpiryLabel: {
    fontSize: 16,
    color: '#4A5568',
    fontWeight: '600',
  },
  addModalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  addModalCircularButton: {
    alignItems: 'center',
  },
  circularButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelCircularButton: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveCircularButton: {
    backgroundColor: '#2D6A4F',
    shadowColor: '#2D6A4F',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
