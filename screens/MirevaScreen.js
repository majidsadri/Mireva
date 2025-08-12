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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { API_CONFIG } from '../config';
import { images } from '../assets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera } from 'react-native-image-picker';
import axios from 'axios';
import foodCategories from '../food-categories.json';
import { getFoodIcon, getCategoryIcon } from '../utils/foodIcons';
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
  const [logoImageError, setLogoImageError] = useState(false);
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

  // Load ownership and pending requests when pantry name changes
  useEffect(() => {
    if (pantryName) {
      loadPantryOwnership();
      loadPendingRequests();
    } else {
      setIsOwner(false);
      setPendingRequests([]);
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
          const newPantryName = data.pantryName || '';
          console.log('🏠 Setting pantry name to:', newPantryName);
          setPantryName(newPantryName);
        } else {
          console.error('❌ Failed to get pantry name, status:', response.status);
          setPantryName('');
        }
      }
    } catch (error) {
      console.error('Error loading pantry name:', error);
      setPantryName('');
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
      console.warn('Error parsing expiry date:', expiryDate);
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
      const email = await AsyncStorage.getItem('userEmail');
      
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
    try {
      // Remove from local state immediately
      setPantryItems(currentItems => 
        currentItems.filter(item => item.id !== itemId)
      );
      
      // Try backend delete but don't fail if it doesn't work
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
      // Only show error if the local delete failed
      setPantryItems(currentItems => [...currentItems, { id: itemId }]); // Re-add item
      Alert.alert('Error', 'Failed to delete item. Please try again.');
    }
  };

  const loadPantryUsers = async () => {
    console.log('DEBUG: loadPantryUsers called, pantryName =', pantryName);
    if (!pantryName) {
      console.log('DEBUG: No pantryName, returning early');
      return;
    }
    
    try {
      setLoadingPantryUsers(true);
      
      // Get all users from backend
      const response = await fetch(`${API_CONFIG.BASE_URL}/get-users`, {
        method: 'GET',
        headers: API_CONFIG.getHeaders(),
      });
      
      console.log('DEBUG: response.ok =', response.ok, 'status =', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('DEBUG: response data =', data);
        const allUsers = data.users || {};
        
        // Filter users who are in the same pantry
        const usersInPantry = [];
        console.log('DEBUG: pantryName =', pantryName);
        console.log('DEBUG: allUsers =', Object.keys(allUsers));
        for (const [email, userData] of Object.entries(allUsers)) {
          const userPantryName = (userData.pantryName || '').trim();
          const currentPantryName = (pantryName || '').trim();
          console.log(`DEBUG: Checking ${email}, pantryName: "${userPantryName}", pantryName: "${currentPantryName}", match: ${userPantryName === currentPantryName}`);
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
              console.error(`Error loading image for ${email}:`, err);
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
        
        console.log('DEBUG: Final usersInPantry =', usersInPantry);
        setPantryUsers(usersInPantry);
      }
    } catch (error) {
      console.error('Error loading pantry users:', error);
      Alert.alert('Error', 'Failed to load pantry users');
    } finally {
      setLoadingPantryUsers(false);
    }
  };

  const showPantryUsersHandler = () => {
    console.log('DEBUG: showPantryUsersHandler called, pantryName =', pantryName);
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
      const userEmail = await AsyncStorage.getItem('userEmail');
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
      console.error('Error responding to request:', error);
      Alert.alert('Error', 'Failed to respond to request');
    }
  };

  const loadAvailablePantries = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      
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
        console.error('Failed to load available pantries');
      }
    } catch (error) {
      console.error('Error loading available pantries:', error);
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
      const userEmail = await AsyncStorage.getItem('userEmail');
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
      console.error('Error joining pantry:', error);
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
              const userEmail = await AsyncStorage.getItem('userEmail');
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
              console.error('Error leaving pantry:', error);
              Alert.alert('Error', 'Failed to leave pantry');
            }
          }
        }
      ]
    );
  };

  const loadPendingRequests = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
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
      console.error('Error loading pending requests:', error);
    }
  };

  const loadPantryOwnership = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
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
      console.error('Error loading pantry ownership:', error);
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
                <Text style={styles.modernOwnerBadge}>Owner</Text>
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
                      onError={(error) => console.log('Tutorial image error:', error)}
                      onLoad={() => console.log('Tutorial image loaded')}
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
  // Modern Pantry Card Styles
  pantryHeaderSection: {
    backgroundColor: '#0F3B2F',
    background: 'linear-gradient(135deg, #064E3B 0%, #052E22 50%, #041F17 100%)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
  },
  pantryBackgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 0,
  },
  pantryBackgroundCircle1: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    top: '10%',
    right: -30,
    opacity: 0.6,
  },
  pantryBackgroundCircle2: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    bottom: '15%',
    left: -15,
    opacity: 0.5,
  },
  pantryBackgroundCircle3: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    top: '60%',
    right: '20%',
    opacity: 0.7,
  },
  pantryHeaderCard: {
    backgroundColor: '#052E22',
    borderRadius: 16,
    padding: 16,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
    position: 'relative',
    marginHorizontal: 8,
  },
  welcomeHeaderSection: {
    backgroundColor: '#0F3B2F',
    paddingHorizontal: 0,
    paddingTop: 40,
    paddingBottom: 50,
    position: 'relative',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  gradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 0,
  },
  gradientOverlay2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 0,
  },
  gradientOverlay3: {
    position: 'absolute',
    top: '20%',
    right: -50,
    width: 150,
    height: 150,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 75,
  },
  welcomeHeaderContent: {
    alignItems: 'center',
    zIndex: 10,
    position: 'relative',
  },
  welcomeHeaderTitle: {
    fontSize: 34,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: 'System',
    textAlign: 'center',
    lineHeight: 44,
    opacity: 1,
    textTransform: 'capitalize',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  welcomeContainer: {
    backgroundColor: '#F1F5F9',
    flex: 1,
    paddingTop: 60,
    paddingBottom: 60,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundDecor1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E0F2FE',
    top: -50,
    right: -50,
    opacity: 0.6,
  },
  backgroundDecor2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#ECFDF5',
    bottom: -30,
    left: -40,
    opacity: 0.5,
  },
  backgroundDecor3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF3F2',
    top: '40%',
    right: -30,
    opacity: 0.4,
  },
  backgroundDecor4: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EDE9FE',
    top: '20%',
    left: -20,
    opacity: 0.5,
  },
  backgroundDecor5: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEF7FF',
    bottom: '20%',
    right: -40,
    opacity: 0.3,
  },
  backgroundDecor6: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F9FF',
    top: '60%',
    left: -10,
    opacity: 0.6,
  },
  backgroundDecor7: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFFBEB',
    top: '10%',
    left: '30%',
    opacity: 0.4,
  },
  backgroundDecor8: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F3E8FF',
    bottom: '30%',
    left: '80%',
    opacity: 0.5,
  },
  backgroundDecor9: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#ECFCCB',
    top: '70%',
    right: '70%',
    opacity: 0.3,
  },
  backgroundDecor10: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FEE2E2',
    top: '25%',
    right: '15%',
    opacity: 0.6,
  },
  backgroundDecor11: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#F0F9FF',
    bottom: '10%',
    left: '50%',
    opacity: 0.2,
  },
  modernPantryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pantryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  pantryMainInfo: {
    flex: 1,
    alignItems: 'flex-start',
    paddingVertical: 0,
    paddingRight: 16,
  },
  pantryActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginTop: 4,
  },
  modernPantryName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.8,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    lineHeight: 38,
  },
  modernOwnerBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#064E3B',
    backgroundColor: 'rgba(167, 243, 208, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'flex-start',
    backdropFilter: 'blur(10px)',
  },
  modernMemberCount: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'left',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    lineHeight: 20,
  },
  modernManageButton: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modernManageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  modernManageIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  modernManageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  modernNotificationDot: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EA580C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  modernNotificationCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  circularLeaveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  circularManageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(15px)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  circularButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  whiteBellIcon: {
    fontSize: 18,
    color: '#A7F3D0',
    fontWeight: 'bold',
  },
  modernLeaveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(248, 113, 113, 0.9)',
    backdropFilter: 'blur(10px)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: 'rgba(248, 113, 113, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  modernLeaveIcon: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '300',
    lineHeight: 20,
  },
  welcomeScreen: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 32,
    minHeight: 520,
    justifyContent: 'center',
    zIndex: 1,
  },
  welcomeIconContainer: {
    marginBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  welcomeIcon: {
    width: 140,
    height: 140,
    backgroundColor: '#F0FDF4',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#E6FFFA',
  },
  welcomeIconText: {
    fontSize: 50,
    lineHeight: 50,
  },
  welcomeIconImage: {
    width: 90,
    height: 90,
    backgroundColor: 'transparent',
  },
  welcomeIconFallback: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#10B981',
  },
  leafIcon: {
    width: 60,
    height: 60,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafPart1: {
    position: 'absolute',
    width: 25,
    height: 40,
    backgroundColor: '#064E3B',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderBottomLeftRadius: 25,
    transform: [{ rotate: '-20deg' }],
    left: 10,
    top: 5,
  },
  leafPart2: {
    position: 'absolute',
    width: 20,
    height: 30,
    backgroundColor: '#10B981',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    transform: [{ rotate: '30deg' }],
    right: 8,
    top: 10,
  },
  leafPart3: {
    position: 'absolute',
    width: 18,
    height: 25,
    backgroundColor: '#34D399',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    transform: [{ rotate: '60deg' }],
    right: 5,
    bottom: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 17,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 50,
    lineHeight: 24,
    fontWeight: '500',
  },
  welcomeActions: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
    marginTop: 20,
  },
  welcomeCreateButton: {
    backgroundColor: '#10B981',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 24,
    width: '85%',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    marginRight: 10,
    fontWeight: 'bold',
  },
  welcomeCreateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  welcomeSearchButton: {
    backgroundColor: '#064E3B',
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderRadius: 24,
    width: '85%',
    borderWidth: 0,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  searchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    marginRight: 8,
  },
  welcomeSearchText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  searchPantryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchPantryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pantryResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pantryResultInfo: {
    flex: 1,
  },
  pantryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  pantryResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  ownerBadge: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  ownedPantryItem: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  pantryResultSubtext: {
    fontSize: 13,
    color: '#6B7280',
  },
  joinArrow: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: 'bold',
  },
  ownerArrow: {
    color: '#059669',
  },
  emptySearchState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptySearchText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  requestsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  requestItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  requestInfo: {
    marginBottom: 12,
  },
  requestName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  requestEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#EA580C',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyRequestsState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyRequestsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalCloseButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    position: 'relative',
  },
  manageButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  requestNotificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF4444',
    borderRadius: 16,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  requestNotificationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  requestCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  requestCountText: {
    color: '#FF4444',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
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
  contentWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 20,
  },
  contentBackgroundCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    top: 50,
    right: -40,
    opacity: 0.8,
  },
  contentBackgroundCircle2: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    top: 200,
    left: -30,
    opacity: 0.7,
  },
  contentBackgroundCircle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    top: 350,
    right: -60,
    opacity: 0.6,
  },
  contentBackgroundCircle4: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    bottom: 100,
    left: -40,
    opacity: 0.7,
  },
  contentBackgroundCircle5: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    bottom: 250,
    right: 20,
    opacity: 0.6,
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
    paddingHorizontal: 1,
    paddingVertical: 4,
  },
  itemIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemIcon: {
    fontSize: 16,
  },
  expiryLabel: {
    fontSize: 7,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    textAlign: 'center',
    marginTop: 2,
    overflow: 'hidden',
  },
  itemTouchable: {
    width: '100%',
    height: '100%',
  },
  modernItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 4,
    width: 108,
    height: 90,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  itemHeader: {
    marginBottom: 6,
    alignItems: 'center',
    position: 'relative',
  },
  itemName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A202C',
    lineHeight: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  itemDetails: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  itemAmount: {
    fontSize: 9,
    color: '#A0AEC0',
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
  },
  statusCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    top: -2,
    right: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
  
  // Category Filter Tabs Styles
  categoryTabsContainer: {
    marginVertical: 15,
    paddingHorizontal: 16,
  },
  categoryTabsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryTab: {
    backgroundColor: '#F7FAFC',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '23%',
    minHeight: 40,
    position: 'relative',
  },
  categoryTabSelected: {
    backgroundColor: '#0A4B4C',
    borderColor: '#0A4B4C',
  },
  categoryTabText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4A5568',
    textAlign: 'center',
    flex: 1,
  },
  categoryTabTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  categoryTabBadge: {
    backgroundColor: '#EA580C',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    position: 'absolute',
    top: -4,
    right: -4,
  },
  categoryTabBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Grid Layout Styles
  itemsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    justifyContent: 'space-around',
  },
  gridItemCard: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    minHeight: 85,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 0,
  },
  gridItemTouchable: {
    flex: 1,
    position: 'relative',
  },
  gridItemImageContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  gridItemPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  gridItemIcon: {
    fontSize: 18,
  },
  gridItemInfo: {
    alignItems: 'center',
    marginBottom: 4,
    flex: 1,
    justifyContent: 'center',
  },
  gridItemName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A202C',
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 12,
  },
  gridItemAmount: {
    fontSize: 8,
    color: '#A0AEC0',
    fontWeight: '400',
    textAlign: 'center',
  },
  gridItemStatusCircle: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
    backgroundColor: '#EA580C',
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
  
  // Pantry Users Modal Styles
  closeButton: {
    position: 'absolute',
    top: 24,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#718096',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F4F8',
  },
  userAvatar: {
    marginRight: 16,
  },
  userAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6FFFA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#81E6D9',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D6A4F',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A202C',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#718096',
  },
  currentUserBadge: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '500',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
  },
  // Tutorial Modal Styles
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tutorialContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '90%',
    height: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  tutorialHeader: {
    backgroundColor: '#10B981',
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
  },
  tutorialCloseButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  tutorialSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
  },
  tutorialContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
  },
  tutorialStep: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  tutorialIconContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#F0FDF4',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#E6FFFA',
  },
  tutorialStepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  tutorialStepDescription: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  tutorialProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tutorialProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: '#E5E7EB',
  },
  tutorialProgressDotActive: {
    backgroundColor: '#10B981',
    width: 24,
  },
  tutorialNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  tutorialButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialButtonPrimary: {
    backgroundColor: '#10B981',
  },
  tutorialButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  tutorialButtonDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.6,
  },
  tutorialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  tutorialButtonTextSecondary: {
    color: '#6B7280',
  },
  tutorialGetStartedButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tutorialGetStartedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  tutorialCloseText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  tutorialStepIcon: {
    fontSize: 40,
    color: '#10B981',
    fontWeight: 'bold',
    textShadowColor: 'rgba(16, 185, 129, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tutorialLogoIcon: {
    width: 60,
    height: 60,
  },
  tutorialFeatures: {
    marginTop: 20,
    alignItems: 'flex-start',
    width: '100%',
  },
  tutorialFeature: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'left',
    paddingLeft: 8,
  },
  tutorialDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  tutorialDotActive: {
    backgroundColor: '#10B981',
    width: 16,
  },
  tutorialPrevButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialNextButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  tutorialPrevText: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  tutorialNextText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
