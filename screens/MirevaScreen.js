import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
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
  Animated,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { API_CONFIG } from '../config';
import { images } from '../assets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera } from 'react-native-image-picker';
import axios from 'axios';
import foodCategories from '../food-categories.json';
import { getFoodIcon, getCategoryIcon } from '../utils/foodIcons';
import styles, { COLORS } from './MirevaScreen.styles';

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

// Utility function to get user email
const getUserEmail = () => AsyncStorage.getItem('userEmail');

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

// Category color function (moved outside component to prevent recreation)
const getCategoryColor = (category) => {
  const colors = {
    'Fruits & Vegetables': '#48BB78',
    'Proteins': '#E53E3E',
    'Dairy': '#4299E1',
    'Grains & Pantry': '#ED8936',
    'Condiments': '#9F7AEA',
    'Beverages': '#38B2AC',
    'Snacks': '#F6AD55',
    'Frozen Foods': '#81C784'
  };
  return colors[category] || '#A0AEC0';
};

// Shelf background colors for categories
const shelfColors = {
  'Fruits & Vegetables': '#E6FFFA',
  'Proteins': '#FFF5E6',
  'Grains & Pantry': '#F0FFF4',
  'Dairy': '#E8F5E8',
  'Beverages': '#E6F3FF',
  'Frozen': '#F0E6FF',
  'Condiments': '#FFE6E6',
  'Expired': '#FFEBEE'
};

// Simple Item Component
const ItemCard = ({ 
  item, 
  expiry, 
  onItemClick, 
  formatItemAmount
}) => {
  const itemCategory = categorizeItem(item.name || 'Unknown');
  const categoryColor = getCategoryColor(itemCategory);
  
  return (
    <View style={[styles.modernItemCard, {
      borderTopWidth: 3,
      borderTopColor: categoryColor,
    }]}>
      <TouchableOpacity
        style={styles.itemTouchable}
        onPress={onItemClick}
        activeOpacity={0.85}
      >
        <View style={styles.itemContent}>
          {/* Food Icon Placeholder */}
          <View style={[styles.itemIconContainer, { backgroundColor: categoryColor + '20' }]}>
            <Text style={styles.itemIcon}>{getFoodIcon(item.name || 'Unknown')}</Text>
          </View>
          
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={2}>
              {(item.name || 'Unknown').trim()}
            </Text>
            <View style={[styles.statusCircle, { 
              backgroundColor: expiry.color,
              shadowColor: expiry.shadowColor,
            }]} />
          </View>
          
          <View style={styles.itemDetails}>
            <Text style={styles.itemAmount}>{formatItemAmount(item)}</Text>
            {expiry.status !== 'fresh' && expiry.status !== 'no-expiry' && (
              <Text style={[styles.expiryLabel, {
                color: expiry.color,
                backgroundColor: expiry.color + '15'
              }]}>
                {expiry.label}
              </Text>
            )}
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
  const navigation = useNavigation();
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
    expiryPeriod: '1 Month',
  });
  const [editCustomWeeks, setEditCustomWeeks] = useState('');
  const [showEditCustomExpiry, setShowEditCustomExpiry] = useState(false);
  const [showMeasurementPicker, setShowMeasurementPicker] = useState(false);
  
  // Pantry management states
  const [joinedPantry, setJoinedPantry] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pantryUsers, setPantryUsers] = useState([]);
  const [loadingPantryUsers, setLoadingPantryUsers] = useState(false);
  const [showPantryUsersModal, setShowPantryUsersModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availablePantries, setAvailablePantries] = useState([]);
  const [filteredPantries, setFilteredPantries] = useState([]);
  const [ownedPantries, setOwnedPantries] = useState([]);
  
  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Define categories for filter tabs
  const categories = [
    'All',
    'Fruits & Vegetables', 
    'Proteins',
    'Dairy',
    'Grains & Pantry',
    'Beverages',
    'Frozen',
    'Condiments'
  ];

  // Animated values for background circles
  const animatedValue1 = useRef(new Animated.Value(0)).current;
  const animatedValue2 = useRef(new Animated.Value(0)).current;
  const animatedValue3 = useRef(new Animated.Value(0)).current;
  const animatedValue4 = useRef(new Animated.Value(0)).current;
  const animatedValue5 = useRef(new Animated.Value(0)).current;
  const animatedValue6 = useRef(new Animated.Value(0)).current;
  const animatedValue7 = useRef(new Animated.Value(0)).current;

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

  // Load ownership, users, and pending requests when pantry name changes
  useEffect(() => {
    if (pantryName) {
      loadPantryOwnership();
      loadPendingRequests();
      loadPantryUsers();
    } else {
      setIsOwner(false);
      setPendingRequests([]);
      setPantryUsers([]);
    }
  }, [pantryName]);

  // Start background circle animations
  useEffect(() => {
    const createAnimation = (animatedValue, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 8000 + delay,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 8000 + delay,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start animations with different delays for variety
    createAnimation(animatedValue1, 0).start();
    createAnimation(animatedValue2, 1000).start();
    createAnimation(animatedValue3, 2000).start();
    createAnimation(animatedValue4, 3000).start();
    createAnimation(animatedValue5, 1500).start();
    createAnimation(animatedValue6, 2500).start();
    createAnimation(animatedValue7, 500).start();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userEmail = await getUserEmail();
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
    }
  };

  const loadUserPantryName = async () => {
    try {
      const userEmail = await getUserEmail();
      
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
          const newPantryName = data.pantryName || '';
          setPantryName(newPantryName);
        } else {
          setPantryName('');
        }
      }
    } catch (error) {
      setPantryName('');
    }
  };

  const loadPantryItems = async () => {
    try {
      setLoading(true);
      
      const email = await getUserEmail();
      
      
      if (!email) {
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
        
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            ...API_CONFIG.getHeaders(),
            'X-User-Email': email.trim().toLowerCase(),
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        
        if (response.ok) {
          const data = await response.json();
          setPantryItems(Array.isArray(data) ? data : []);
        } else {
          const errorText = await response.text();
          setPantryItems([]); // Show empty state rather than crash
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        setPantryItems([]); // Show empty state rather than crash
      }
    } catch (error) {
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

      const result = await launchCamera(options);
      

      if (result.didCancel) {
        return;
      }
      
      if (result.errorCode) {
        Alert.alert('Camera Error', result.errorMessage || 'Failed to open camera');
        return;
      }
      
      if (!result.assets || !result.assets[0]?.uri) {
        Alert.alert('Error', 'No image was captured');
        return;
      }

      const uri = result.assets[0].uri;
      
      const data = new FormData();
      data.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'pantry-photo.jpg',
      });

      const email = await getUserEmail();
      
      if (!email) {
        Alert.alert('Error', 'Please sign in to scan items');
        return;
      }

      const response = await axios.post(`${API_CONFIG.BASE_URL}/scan-and-add`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-User-Email': email.trim().toLowerCase(),
        },
        timeout: 30000, // 30 second timeout
      });

      const food = response.data.item || 'Unknown food';
      
      // Refresh pantry items immediately after adding
      loadPantryItems();
      
    } catch (err) {
      
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
      const email = await getUserEmail();
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
      const email = await getUserEmail();
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
      return { 
        status: 'no-expiry', 
        color: '#38A169', 
        text: 'No expiry', 
        label: 'Fresh',
        shadowColor: '#38A169'
      };
    }
    
    try {
      const now = new Date();
      const expiry = new Date(expiryDate);
      
      // Check for invalid date
      if (isNaN(expiry.getTime())) {
        return { 
          status: 'unknown', 
          color: '#A0AEC0', 
          text: 'Unknown', 
          label: 'Unknown',
          shadowColor: '#A0AEC0'
        };
      }
      
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return { 
          status: 'expired', 
          color: '#E53E3E', 
          text: 'Expired', 
          label: 'Expired',
          shadowColor: '#E53E3E'
        };
      }
      if (diffDays <= 2) {
        return { 
          status: 'critical', 
          color: '#FF6B35', 
          text: `${diffDays} day${diffDays === 1 ? '' : 's'} left`, 
          label: `${diffDays}d left`,
          shadowColor: '#FF6B35'
        };
      }
      if (diffDays <= 7) {
        return { 
          status: 'warning', 
          color: '#F6AD55', 
          text: `${diffDays} days left`, 
          label: `${diffDays}d left`,
          shadowColor: '#F6AD55'
        };
      }
      if (diffDays <= 14) {
        return { 
          status: 'caution', 
          color: '#ECC94B', 
          text: `${diffDays} days left`, 
          label: `${diffDays}d`,
          shadowColor: '#ECC94B'
        };
      }
      return { 
        status: 'fresh', 
        color: '#38A169', 
        text: `${diffDays} days left`, 
        label: 'Fresh',
        shadowColor: '#38A169'
      };
    } catch (error) {
      return { 
        status: 'unknown', 
        color: '#A0AEC0', 
        text: 'Unknown',
        shadowColor: '#A0AEC0'
      };
    }
  };

  const handleItemClick = (item) => {
    setEditingItem(item);
    
    // Calculate which expiry period this item currently has
    let expiryPeriod = '1 Month'; // default
    if (item.expiryDate) {
      const now = new Date();
      const expiry = new Date(item.expiryDate);
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      
      // Find the closest matching period
      if (diffDays <= 7) expiryPeriod = '1 Week';
      else if (diffDays <= 21) expiryPeriod = '3 Weeks';
      else if (diffDays <= 30) expiryPeriod = '1 Month';
      else if (diffDays <= 90) expiryPeriod = '3 Months';
      else expiryPeriod = '1 Year';
    }
    
    setEditedItem({
      name: item.name || '',
      amount: item.amount || '1',
      measurement: item.measurement || 'unit',
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : new Date(),
      expiryPeriod: expiryPeriod,
    });
    setShowEditModal(true);
    setShowEditCustomExpiry(false);
    setEditCustomWeeks('');
  };

  const handleUpdateItem = async () => {
    try {
      const email = await getUserEmail();
      
      // Calculate expiry date based on selected period
      let expiryDate;
      if (showEditCustomExpiry && editCustomWeeks) {
        const days = parseInt(editCustomWeeks) * 7;
        expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
      } else {
        const selectedPeriod = EXPIRY_PERIODS.find(p => p.label === editedItem.expiryPeriod);
        const days = selectedPeriod ? selectedPeriod.days : 30;
        expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
      }
      
      const updatedItem = {
        ...editingItem,
        ...editedItem,
        expiryDate: expiryDate.toISOString(),
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
        }
      } catch (backendError) {
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update item. Please try again.');
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    try {
      // Remove from local state immediately
      setPantryItems(currentItems => 
        currentItems.filter(item => item.id !== itemId)
      );
      
      // Try backend delete but don't fail if it doesn't work
      try {
        const email = await getUserEmail();
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/pantry/${itemId}`, {
          method: 'DELETE',
          headers: {
            ...API_CONFIG.getHeaders(),
            'X-User-Email': email?.trim().toLowerCase() || '',
          },
        });
        
        if (response.ok) {
        } else {
        }
      } catch (backendError) {
      }
    } catch (error) {
      // Only show error if the local delete failed
      setPantryItems(currentItems => [...currentItems, { id: itemId }]); // Re-add item
      Alert.alert('Error', 'Failed to delete item. Please try again.');
    }
  };

  const loadPantryUsers = async () => {
    if (!pantryName) {
      return;
    }
    
    try {
      setLoadingPantryUsers(true);
      
      // Get all users from backend
      const response = await fetch(`${API_CONFIG.BASE_URL}/get-users`, {
        method: 'GET',
        headers: API_CONFIG.getHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        const allUsers = data.users || {};
        
        // Filter users who are in the same pantry
        const usersInPantry = [];
        for (const [email, userData] of Object.entries(allUsers)) {
          const userPantryName = (userData.pantryName || '').trim();
          const currentPantryName = (pantryName || '').trim();
          if (userPantryName === currentPantryName && userPantryName !== '') {
            // Get profile image for each user
            try {
              const imageResponse = await fetch(`${API_CONFIG.BASE_URL}/get-profile-image`, {
                method: 'POST',
                headers: API_CONFIG.getHeaders(),
                body: JSON.stringify({ email }),
              });
              
              let profileImage = null;
              if (imageResponse.ok) {
                const imageData = await imageResponse.json();
                profileImage = imageData.profileImage;
              }
              
              usersInPantry.push({
                email,
                name: userData.name || email.split('@')[0],
                profileImage,
                isCurrentUser: email === (await AsyncStorage.getItem('userEmail')),
              });
            } catch (err) {
              usersInPantry.push({
                email,
                name: userData.name || email.split('@')[0],
                profileImage: null,
                isCurrentUser: email === (await AsyncStorage.getItem('userEmail')),
              });
            }
          }
        }
        
        // Sort to put current user first
        usersInPantry.sort((a, b) => {
          if (a.isCurrentUser) return -1;
          if (b.isCurrentUser) return 1;
          return a.name.localeCompare(b.name);
        });
        
        setPantryUsers(usersInPantry);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load pantry users');
    } finally {
      setLoadingPantryUsers(false);
    }
  };

  const showPantryUsersHandler = () => {
    if (!pantryName || pantryName.trim() === '') {
      Alert.alert('Please wait', 'Loading pantry information...');
      return;
    }
    setShowPantryUsersModal(true);
    loadPantryUsers();
  };

  const showRequestsHandler = () => {
    setShowRequestsModal(true);
  };

  const handleRequestResponse = async (requestId, action) => {
    try {
      const userEmail = await getUserEmail();
      if (!userEmail) {
        Alert.alert('Error', 'User email not found');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RESPOND_PANTRY_REQUEST}`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: userEmail,
          requestId: requestId,
          action: action
        }),
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert('Success', result.message);
        // Reload pending requests to update the list
        loadPendingRequests();
        // If request was finalized, close modal
        if (result.finalized) {
          setShowRequestsModal(false);
        }
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to respond to request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to respond to request');
    }
  };

  const loadAvailablePantries = async () => {
    try {
      const userEmail = await getUserEmail();
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_AVAILABLE_PANTRIES}`, {
        method: 'GET',
        headers: API_CONFIG.getHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setAvailablePantries(data.pantries || []);
        setFilteredPantries(data.pantries || []);
        
        // Check which pantries the user owns
        if (userEmail) {
          const ownershipResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_PANTRY_OWNERSHIP}`, {
            method: 'GET',
            headers: {
              ...API_CONFIG.getHeaders(),
              'X-User-Email': userEmail,
            },
          });
          
          if (ownershipResponse.ok) {
            const ownershipData = await ownershipResponse.json();
            setOwnedPantries(ownershipData.ownedPantries || []);
          }
        }
      } else {
      }
    } catch (error) {
    }
  };

  const handleSearchPantries = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredPantries(availablePantries);
    } else {
      const filtered = availablePantries.filter(pantry => 
        pantry.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredPantries(filtered);
    }
  };

  const joinPantryHandler = async (pantryName) => {
    try {
      const userEmail = await getUserEmail();
      if (!userEmail) {
        Alert.alert('Error', 'User email not found');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REQUEST_PANTRY_JOIN}`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: userEmail,
          pantryName: pantryName
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        setShowSearchModal(false);
        
        if (responseData.isOwner) {
          // User is the owner, they joined immediately
          await AsyncStorage.setItem('pantryName', pantryName);
          setPantryName(pantryName);
          setIsOwner(true);
          Alert.alert('Welcome Back!', `You have rejoined your pantry "${pantryName}" as the owner.`);
          // Reload pantry data using existing functions
          loadPantryItems();
          loadPantryUsers();
          loadPendingRequests();
        } else {
          // Join request was sent for approval
          Alert.alert('Request Sent', `Your join request has been sent to the owner of "${pantryName}". You'll be notified once it's approved.`);
        }
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to send join request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send join request');
    }
  };

  const openSearchModal = () => {
    setShowSearchModal(true);
    loadAvailablePantries();
  };

  const leavePantryHandler = () => {
    Alert.alert(
      'Leave Pantry',
      'Are you sure you want to leave this pantry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave', 
          style: 'destructive',
          onPress: async () => {
            try {
              const userEmail = await getUserEmail();
              if (!userEmail) {
                Alert.alert('Error', 'User email not found');
                return;
              }

              // Call backend to leave pantry
              const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_USER_PANTRY}`, {
                method: 'POST',
                headers: API_CONFIG.getHeaders(),
                body: JSON.stringify({
                  email: userEmail,
                  pantryName: '', // Empty string to leave pantry
                  essentialItems: []
                }),
              });

              if (response.ok) {
                // Update local state and clear all pantry-related data
                await AsyncStorage.removeItem('pantryName');
                setPantryName('');
                setPantryItems([]);
                setPantryUsers([]);
                setPendingRequests([]);
                setIsOwner(false);
              } else {
                const errorData = await response.json();
                Alert.alert('Error', errorData.error || 'Failed to leave pantry');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to leave pantry');
            }
          }
        }
      ]
    );
  };

  const loadPendingRequests = async () => {
    try {
      const userEmail = await getUserEmail();
      if (!userEmail || !pantryName) return;

      const response = await fetch(`${API_CONFIG.BASE_URL}/get-pantry-requests`, {
        method: 'GET',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': userEmail,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.requests || []);
      }
    } catch (error) {
    }
  };

  const loadPantryOwnership = async () => {
    try {
      const userEmail = await getUserEmail();
      if (!userEmail || !pantryName) return;

      const response = await fetch(`${API_CONFIG.BASE_URL}/get-pantry-ownership`, {
        method: 'GET',
        headers: API_CONFIG.getHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        const pantryOwner = data.owners && data.owners[pantryName];
        setIsOwner(pantryOwner && pantryOwner.email === userEmail);
      }
    } catch (error) {
      setIsOwner(false);
    }
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
  
  // Using getCategoryIcon from utils/foodIcons instead of local duplicate

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A4B4C" />
      
      {/* Pantry Header Section */}
      {pantryName ? (
        <View style={styles.pantryHeaderSection}>
          {/* Single background overlay */}
          <View style={styles.pantryBackgroundOverlay} />
          
          {/* Animated Background Circles */}
          <Animated.View style={[
            styles.pantryBackgroundCircle1,
            {
              transform: [
                {
                  translateY: animatedValue1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15],
                  }),
                },
                {
                  scale: animatedValue1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.1],
                  }),
                },
              ],
            },
          ]} />
          <Animated.View style={[
            styles.pantryBackgroundCircle2,
            {
              transform: [
                {
                  translateX: animatedValue2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 12],
                  }),
                },
              ],
            },
          ]} />
          <Animated.View style={[
            styles.pantryBackgroundCircle3,
            {
              transform: [
                {
                  translateY: animatedValue3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 8],
                  }),
                },
                {
                  rotate: animatedValue3.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '120deg'],
                  }),
                },
              ],
            },
          ]} />
          
          <View style={styles.pantryHeaderCard}>
            <View style={styles.pantryHeader}>
              <TouchableOpacity style={styles.pantryMainInfo} onPress={showPantryUsersHandler}>
                <Text style={styles.modernPantryName}>{pantryName}</Text>
                {isOwner && <Text style={styles.modernOwnerBadge}>Owner</Text>}
                <Text style={styles.modernMemberCount}>{pantryUsers.length > 0 ? pantryUsers.length : 1} members</Text>
              </TouchableOpacity>
              
              <View style={styles.pantryActions}>
                {isOwner && pendingRequests.length > 0 && (
                  <TouchableOpacity style={styles.circularManageButton} onPress={showRequestsHandler}>
                    <Text style={styles.whiteBellIcon}>🔔</Text>
                    <View style={styles.modernNotificationDot}>
                      <Text style={styles.modernNotificationCount}>{pendingRequests.length}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.modernLeaveButton} onPress={leavePantryHandler}>
                  <Text style={styles.modernLeaveIcon}>×</Text>
                </TouchableOpacity>
                
                {/* Log Button */}
                <TouchableOpacity 
                  style={styles.modernLogButton} 
                  onPress={() => navigation?.navigate('Log')}
                >
                  <Text style={styles.modernLogIcon}>📋</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <>
          {/* Welcome Header */}
          <View style={styles.welcomeHeaderSection}>
            {/* Gradient-like overlay elements */}
            <View style={styles.gradientOverlay1} />
            <View style={styles.gradientOverlay2} />
            <View style={styles.gradientOverlay3} />
            
            <View style={styles.welcomeHeaderContent}>
              <Text style={styles.welcomeHeaderTitle}>Welcome to Mireva</Text>
            </View>
          </View>
          
          {/* Welcome Content */}
          <View style={styles.welcomeContainer}>
            {/* Background Decorations */}
            <Animated.View style={[
              styles.backgroundDecor1,
              {
                transform: [
                  {
                    translateY: animatedValue1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -20],
                    }),
                  },
                  {
                    scale: animatedValue1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.1],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor2,
              {
                transform: [
                  {
                    translateX: animatedValue2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 15],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor3,
              {
                transform: [
                  {
                    translateY: animatedValue3.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 10],
                    }),
                  },
                  {
                    rotate: animatedValue3.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor4,
              {
                transform: [
                  {
                    translateX: animatedValue4.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -10],
                    }),
                  },
                  {
                    scale: animatedValue4.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.9],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor5,
              {
                transform: [
                  {
                    translateY: animatedValue5.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -15],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor6,
              {
                transform: [
                  {
                    translateX: animatedValue6.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 8],
                    }),
                  },
                  {
                    translateY: animatedValue6.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -5],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor7,
              {
                transform: [
                  {
                    scale: animatedValue7.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.2],
                    }),
                  },
                  {
                    translateX: animatedValue7.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -12],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor8,
              {
                transform: [
                  {
                    translateY: animatedValue1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 18],
                    }),
                  },
                  {
                    scale: animatedValue2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.8],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor9,
              {
                transform: [
                  {
                    translateX: animatedValue3.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -25],
                    }),
                  },
                  {
                    rotate: animatedValue4.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '90deg'],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor10,
              {
                transform: [
                  {
                    translateY: animatedValue5.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -22],
                    }),
                  },
                  {
                    translateX: animatedValue6.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 14],
                    }),
                  },
                ],
              },
            ]} />
            <Animated.View style={[
              styles.backgroundDecor11,
              {
                transform: [
                  {
                    scale: animatedValue7.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.3],
                    }),
                  },
                ],
              },
            ]} />
            
            <View style={styles.welcomeScreen}>
              <TouchableOpacity 
                style={styles.welcomeIconContainer}
                onPress={() => setShowTutorialModal(true)}
                activeOpacity={0.8}
              >
                <View style={styles.welcomeIcon}>
                  {/* Beautiful Mireva Logo */}
                  <View style={{
                    width: 90,
                    height: 90,
                    borderRadius: 22,
                    backgroundColor: '#10B981',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 8,
                  }}>
                    <Text style={{
                      fontSize: 42,
                      fontWeight: '900',
                      color: '#FFFFFF',
                      fontFamily: 'System',
                      letterSpacing: 0.5,
                    }}>
                      M
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              
              <View style={styles.welcomeActions}>
                <TouchableOpacity style={styles.welcomeCreateButton} onPress={() => setShowCreatePantryModal(true)}>
                  <View style={styles.createButtonContent}>
                    <Text style={styles.createButtonIcon}>+</Text>
                    <Text style={styles.welcomeCreateText}>CREATE YOUR PANTRY</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.welcomeSearchButton} onPress={openSearchModal}>
                  <View style={styles.searchButtonContent}>
                    <Text style={styles.searchButtonIcon}>⌕</Text>
                    <Text style={styles.welcomeSearchText}>SEARCH EXISTING PANTRY</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Action Buttons - Only show when user has a pantry */}
      {pantryName && (
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
              loadUserPantryName();
              loadPantryItems();
            }}
          >
            <View style={styles.refreshIcon}>
              <View style={styles.refreshArrow} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats Bar - Only show when user has a pantry */}
      {pantryName && (
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
      )}

      {/* Category Filter Tabs */}
      {pantryItems.length > 0 && (
        <View style={styles.categoryTabsContainer}>
          <View style={styles.categoryTabsGrid}>
            {categories.map((category) => {
              // Always get the actual count for each category, regardless of selection
              const count = category === 'All' 
                ? pantryItems.length
                : (categorizedItems[category] || []).length;
                
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryTab,
                    selectedCategory === category && styles.categoryTabSelected
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[
                    styles.categoryTabText,
                    selectedCategory === category && styles.categoryTabTextSelected
                  ]} numberOfLines={1}>
                    {category}
                  </Text>
                  {category !== 'All' && count > 0 && (
                    <View style={styles.categoryTabBadge}>
                      <Text style={styles.categoryTabBadgeText}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Content Area */}
      <View style={styles.contentWrapper}>
        {/* Animated Background Circles for Content */}
        <Animated.View style={[
          styles.contentBackgroundCircle1,
          {
            transform: [
              {
                translateY: animatedValue6.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -20],
                }),
              },
            ],
          },
        ]} />
        <Animated.View style={[
          styles.contentBackgroundCircle2,
          {
            transform: [
              {
                translateX: animatedValue7.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 15],
                }),
              },
            ],
          },
        ]} />
        <Animated.View style={[
          styles.contentBackgroundCircle3,
          {
            transform: [
              {
                scale: animatedValue1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.15],
                }),
              },
            ],
          },
        ]} />
        <Animated.View style={[
          styles.contentBackgroundCircle4,
          {
            transform: [
              {
                translateY: animatedValue2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 25],
                }),
              },
              {
                translateX: animatedValue3.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                }),
              },
            ],
          },
        ]} />
        <Animated.View style={[
          styles.contentBackgroundCircle5,
          {
            transform: [
              {
                rotate: animatedValue4.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          },
        ]} />
        
        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {pantryItems.length === 0 ? (
          <View />
        ) : (
          <View style={styles.itemsGridContainer}>
            {(() => {
              // Get items based on selected category
              let filteredItems = [];
              if (selectedCategory === 'All') {
                filteredItems = pantryItems;
              } else {
                filteredItems = categorizedItems[selectedCategory] || [];
              }
              
              return filteredItems.map((item, index) => {
                const expiry = getExpiryStatus(item.expiryDate);
                return (
                  <View key={item.id || index} style={styles.gridItemCard}>
                    <TouchableOpacity
                      style={styles.gridItemTouchable}
                      onPress={() => handleItemClick(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.gridItemImageContainer}>
                        <View style={styles.gridItemPlaceholder}>
                          <Text style={styles.gridItemIcon}>
                            {getFoodIcon(item.name)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.gridItemInfo}>
                        <Text style={styles.gridItemName} numberOfLines={2}>
                          {(item.name || 'Unknown').trim()}
                        </Text>
                        <Text style={styles.gridItemAmount}>
                          {formatItemAmount(item)}
                        </Text>
                      </View>
                      <View style={[styles.gridItemStatusCircle, { 
                        backgroundColor: expiry.color,
                      }]} />
                    </TouchableOpacity>
                  </View>
                );
              });
            })()} 
          </View>
        )}
        
          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
      
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

              {/* Expiry Period */}
              <View style={styles.editModalField}>
                <Text style={styles.editModalLabel}>Expires in</Text>
                <View style={styles.expiryButtonContainer}>
                  {EXPIRY_PERIODS.map((period) => (
                    <TouchableOpacity
                      key={period.label}
                      style={[
                        styles.expiryButton,
                        editedItem.expiryPeriod === period.label && styles.expiryButtonSelected
                      ]}
                      onPress={() => {
                        setEditedItem({ ...editedItem, expiryPeriod: period.label });
                        setShowEditCustomExpiry(false);
                      }}
                    >
                      <Text style={[
                        styles.expiryButtonText,
                        editedItem.expiryPeriod === period.label && styles.expiryButtonTextSelected
                      ]}>
                        {period.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.expiryButton,
                      showEditCustomExpiry && styles.expiryButtonSelected
                    ]}
                    onPress={() => setShowEditCustomExpiry(true)}
                  >
                    <Text style={[
                      styles.expiryButtonText,
                      showEditCustomExpiry && styles.expiryButtonTextSelected
                    ]}>
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>
                {showEditCustomExpiry && (
                  <View style={styles.customExpiryContainer}>
                    <TextInput
                      style={styles.customExpiryInput}
                      placeholder="Weeks"
                      value={editCustomWeeks}
                      onChangeText={setEditCustomWeeks}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                    <Text style={styles.customExpiryText}>weeks</Text>
                  </View>
                )}
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

      {/* Pantry Users Modal */}
      <Modal
        visible={showPantryUsersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPantryUsersModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pantry Members</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowPantryUsersModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            {loadingPantryUsers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2D6A4F" />
                <Text style={styles.loadingText}>Loading members...</Text>
              </View>
            ) : pantryUsers.length > 0 ? (
              pantryUsers.map((user, index) => (
                <View key={user.email} style={styles.userCard}>
                  <View style={styles.userAvatar}>
                    {user.profileImage ? (
                      <Image
                        source={{ uri: user.profileImage }}
                        style={styles.userAvatarImage}
                      />
                    ) : (
                      <View style={styles.userAvatarPlaceholder}>
                        <Text style={styles.userAvatarText}>
                          {user.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {user.name}
                      {user.isCurrentUser && (
                        <Text style={styles.currentUserBadge}> (You)</Text>
                      )}
                    </Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No members found in this pantry.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Manage Requests Modal */}
      <Modal
        visible={showRequestsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRequestsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Join Requests</Text>
            <TouchableOpacity 
              onPress={() => setShowRequestsModal(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.requestsContainer}>
            {pendingRequests.length > 0 ? (
              pendingRequests.map((request) => (
                <View key={request.id} style={styles.requestItem}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{request.requesterName}</Text>
                    <Text style={styles.requestEmail}>{request.requesterEmail}</Text>
                    <Text style={styles.requestDate}>
                      Requested {new Date(request.requestedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <View style={styles.requestActions}>
                    <TouchableOpacity 
                      style={styles.approveButton}
                      onPress={() => handleRequestResponse(request.id, 'approve')}
                    >
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.rejectButton}
                      onPress={() => handleRequestResponse(request.id, 'reject')}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyRequestsState}>
                <Text style={styles.emptyRequestsText}>No pending requests</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Search Pantries Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Pantries</Text>
            <TouchableOpacity 
              onPress={() => setShowSearchModal(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search pantries..."
              value={searchQuery}
              onChangeText={handleSearchPantries}
              autoFocus={true}
            />
          </View>

          <ScrollView style={styles.searchResultsContainer}>
            {filteredPantries.length > 0 ? (
              filteredPantries.map((pantryName, index) => {
                const isOwned = ownedPantries.includes(pantryName);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.pantryResultItem, isOwned && styles.ownedPantryItem]}
                    onPress={() => joinPantryHandler(pantryName)}
                  >
                    <View style={styles.pantryResultInfo}>
                      <View style={styles.pantryNameRow}>
                        <Text style={styles.pantryResultName}>{pantryName}</Text>
                        {isOwned && <Text style={styles.ownerBadge}>Owner</Text>}
                      </View>
                      <Text style={styles.pantryResultSubtext}>
                        {isOwned ? 'Tap to rejoin your pantry' : 'Tap to request join'}
                      </Text>
                    </View>
                    <Text style={[styles.joinArrow, isOwned && styles.ownerArrow]}>→</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptySearchState}>
                <Text style={styles.emptySearchText}>
                  {searchQuery ? 'No pantries found' : 'Loading pantries...'}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Tutorial Modal */}
      <Modal
        visible={showTutorialModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTutorialModal(false)}
      >
        <View style={styles.tutorialOverlay}>
          <View style={styles.tutorialContainer}>
            <View style={styles.tutorialHeader}>
              <Text style={styles.tutorialTitle}>Welcome to Mireva!</Text>
              <TouchableOpacity 
                onPress={() => setShowTutorialModal(false)}
                style={styles.tutorialCloseButton}
              >
                <Text style={styles.tutorialCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.tutorialContent} showsVerticalScrollIndicator={false}>
              {tutorialStep === 0 && (
                <View style={styles.tutorialStep}>
                  <View style={styles.tutorialIconContainer}>
                    <Image 
                      source={images.mirevaLogo}
                      style={styles.tutorialLogoIcon}
                      resizeMode="contain"
                      fadeDuration={0}
                      onError={() => {}}
                      onLoad={() => {}}
                    />
                  </View>
                  <Text style={styles.tutorialStepTitle}>Create or Join a Pantry</Text>
                  <Text style={styles.tutorialStepDescription}>
                    Start by creating your own pantry or joining an existing family pantry. 
                    Share ingredients with family members and keep everyone updated on what's available.
                  </Text>
                  <View style={styles.tutorialFeatures}>
                    <Text style={styles.tutorialFeature}>Share pantry with family members</Text>
                    <Text style={styles.tutorialFeature}>Real-time sync across devices</Text>
                    <Text style={styles.tutorialFeature}>Track expiration dates</Text>
                  </View>
                </View>
              )}

              {tutorialStep === 1 && (
                <View style={styles.tutorialStep}>
                  <View style={styles.tutorialIconContainer}>
                    <Text style={styles.tutorialStepIcon}>+</Text>
                  </View>
                  <Text style={styles.tutorialStepTitle}>Add Items Easily</Text>
                  <Text style={styles.tutorialStepDescription}>
                    Add ingredients to your pantry in multiple ways. Use our smart camera to scan items 
                    or add them manually with automatic categorization.
                  </Text>
                  <View style={styles.tutorialFeatures}>
                    <Text style={styles.tutorialFeature}>Smart camera scanning</Text>
                    <Text style={styles.tutorialFeature}>Manual entry with auto-complete</Text>
                    <Text style={styles.tutorialFeature}>Automatic categorization</Text>
                  </View>
                </View>
              )}

              {tutorialStep === 2 && (
                <View style={styles.tutorialStep}>
                  <View style={styles.tutorialIconContainer}>
                    <Text style={styles.tutorialStepIcon}>★</Text>
                  </View>
                  <Text style={styles.tutorialStepTitle}>Discover Recipes</Text>
                  <Text style={styles.tutorialStepDescription}>
                    Get personalized recipe recommendations based on what's in your pantry. 
                    Our AI suggests meals that match your dietary preferences and available ingredients.
                  </Text>
                  <View style={styles.tutorialFeatures}>
                    <Text style={styles.tutorialFeature}>AI-powered recommendations</Text>
                    <Text style={styles.tutorialFeature}>Dietary preference matching</Text>
                    <Text style={styles.tutorialFeature}>Cuisine-specific suggestions</Text>
                  </View>
                </View>
              )}

              {tutorialStep === 3 && (
                <View style={styles.tutorialStep}>
                  <View style={styles.tutorialIconContainer}>
                    <Text style={styles.tutorialStepIcon}>◉</Text>
                  </View>
                  <Text style={styles.tutorialStepTitle}>Smart Shopping Lists</Text>
                  <Text style={styles.tutorialStepDescription}>
                    Never forget what to buy! Get intelligent shopping suggestions based on your 
                    saved recipes, expired items, and dietary preferences.
                  </Text>
                  <View style={styles.tutorialFeatures}>
                    <Text style={styles.tutorialFeature}>Smart suggestions from recipes</Text>
                    <Text style={styles.tutorialFeature}>Expired item replacements</Text>
                    <Text style={styles.tutorialFeature}>Diet-specific recommendations</Text>
                  </View>
                </View>
              )}

              {tutorialStep === 4 && (
                <View style={styles.tutorialStep}>
                  <View style={styles.tutorialIconContainer}>
                    <Text style={styles.tutorialStepIcon}>✓</Text>
                  </View>
                  <Text style={styles.tutorialStepTitle}>Ready to Start!</Text>
                  <Text style={styles.tutorialStepDescription}>
                    You're all set to make the most of Mireva! Start by creating your first pantry 
                    and discover how easy it is to manage your ingredients and find amazing recipes.
                  </Text>
                  <TouchableOpacity 
                    style={styles.tutorialGetStartedButton}
                    onPress={() => {
                      setShowTutorialModal(false);
                      setShowCreatePantryModal(true);
                    }}
                  >
                    <Text style={styles.tutorialGetStartedText}>Create Your First Pantry</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={styles.tutorialProgress}>
              <View style={styles.tutorialDots}>
                {[0, 1, 2, 3, 4].map((step) => (
                  <View 
                    key={step}
                    style={[
                      styles.tutorialDot,
                      tutorialStep === step && styles.tutorialDotActive
                    ]}
                  />
                ))}
              </View>
            </View>
            
            <View style={styles.tutorialNavigation}>
              {tutorialStep > 0 ? (
                <TouchableOpacity 
                  style={styles.tutorialPrevButton}
                  onPress={() => setTutorialStep(tutorialStep - 1)}
                >
                  <Text style={styles.tutorialPrevText}>‹</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.tutorialButtonPlaceholder} />
              )}
              
              {tutorialStep < 4 && (
                <TouchableOpacity 
                  style={styles.tutorialNextButton}
                  onPress={() => setTutorialStep(tutorialStep + 1)}
                >
                  <Text style={styles.tutorialNextText}>›</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
