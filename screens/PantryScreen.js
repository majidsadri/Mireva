// screens/PantryScreen.js
import React, { useState } from 'react';
import styles, { COLORS } from './PantryScreen.styles';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';



import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
  Image,
  KeyboardAvoidingView,
  Button,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { API_CONFIG } from '../config';


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
  { label: '2 Weeks', days: 14 },
  { label: '3 Weeks', days: 21 },
  { label: '1 Month', days: 30 },
  { label: '2 Months', days: 60 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: '1 Year', days: 365 },
  { label: '2 Years', days: 730 },
];




const addToPantryFromScan = (itemText) => {
  const item = {
    id: Date.now().toString(),
    name: itemText.trim().split('\n')[0] || 'Unknown item',
    amount: '',
    measurement: 'unit',
    expiryDate: new Date().toISOString(),
  };

  fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
    method: 'POST',
    headers: API_CONFIG.getHeaders(),
    body: JSON.stringify(item),
  })
    .then(() => fetchPantryItems())
    .catch((err) => console.error('Error adding scanned item:', err));
};

const PantryScreen = () => {
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newItem, setNewItem] = useState({
    name: '',
    amount: '',
    measurement: 'unit',
    expiryPeriod: '1 Month', // Default to 1 month
  });
  const [error, setError] = useState(null);
  const [imageUri, setImageUri] = useState(null);

  const getFilteredItems = () => {
    return pantryItems.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const categorizedItems = () => {
    const fresh = [], pulses = [], expiringSoon = [], expired = [];
    const now = new Date();
    pantryItems.forEach(item => {
      const expiry = new Date(item.expiryDate);
      const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);

      if (expiry < now) {
        expired.push(item);
      } else if (diffDays < 7) {
        expiringSoon.push(item);
      } else if (/beans|lentils|seeds|pulses|rice|pasta|flour|sugar|salt|spice/i.test(item.name)) {
        pulses.push(item);
      } else {
        fresh.push(item);
      }
    });

    return { fresh, pulses, expiringSoon, expired };
  };


  const fetchPantryItems = async () => {
    try {
      const rawEmail = await AsyncStorage.getItem('userEmail');
      if (!rawEmail) throw new Error("No user email found");
  
      const email = rawEmail.trim().toLowerCase(); // Normalize it
  
      console.log("📨 Fetching pantry for:", email);
  
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'GET',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': email,
        },
      });
  
      const text = await response.text(); // Read full raw body for debug
      console.log("📥 Raw pantry response:", text);
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = JSON.parse(text);
  
      if (!Array.isArray(data)) {
        console.error("❌ Unexpected pantry format:", data);
        throw new Error("Pantry response is not a valid array");
      }
  
      setPantryItems(data);
      console.log("✅ Pantry items set:", data);
    } catch (err) {
      setError('Failed to load pantry items');
      console.error('🔥 Error fetching pantry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  

  useFocusEffect(
    React.useCallback(() => {
      fetchPantryItems();
    }, [])
  );
  

  const takePictureAndScan = async () => {
    try {
      const options = {
        mediaType: 'photo',
        quality: 1,
        includeBase64: false,
        saveToPhotos: true,
      };
  
      const result = await launchCamera(options);
  
      if (
        result.didCancel ||
        result.errorCode ||
        !result.assets ||
        !result.assets[0]?.uri
      ) {
        console.warn('Camera cancelled or failed:', result.errorMessage || 'No URI');
        return;
      }
  
      const uri = result.assets[0].uri;
      const data = new FormData();
      data.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'food-photo.jpg',
      });
  
      const email = await AsyncStorage.getItem('userEmail');

      const response = await axios.post(`${API_CONFIG.BASE_URL}/scan-and-add`, data, {
        headers: { 'Content-Type': 'multipart/form-data' ,
        'X-User-Email': email,
        }
      });
  
      const food = response.data.item || 'Unknown food';
      console.log('🍎 Recognized Food:', food);
  
      Alert.alert('Item Added', `${food} was added to your pantry.`);
      fetchPantryItems();
      setError(null);
    } catch (err) {
      console.error('❌ Error recognizing food:', err);
      setError('Something went wrong while recognizing the food.');
    }
  };
  

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchPantryItems();
  }, []);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const addItem = async () => {
    if (!newItem.name.trim()) {
      setError('Please enter an item name');
      return;
    }
  
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error('No user email found');
  
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'POST',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': email, // ✅ this is required by the backend
        },
        body: JSON.stringify({
          id: Date.now().toString(),
          name: newItem.name,
          amount: newItem.amount,
          measurement: newItem.measurement,
          expiryDate: calculateExpiryDate(newItem.expiryPeriod).toISOString(),
        }),
      });
  
      if (!response.ok) throw new Error('Failed to add item');
  
      setNewItem({
        name: '',
        amount: '',
        measurement: 'unit',
        expiryPeriod: '1 Month',
      });
      fetchPantryItems();
      setError(null);
    } catch (err) {
      setError('Failed to add item');
      console.error('Error:', err);
    }
  };
  
  const deleteItem = async (itemId) => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error("No user email found");
  
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}/${itemId}`, {
        method: 'DELETE',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': email.trim().toLowerCase(), // ✅ include email header
        },
      });
  
      if (!response.ok) throw new Error('Failed to delete item');
      
      fetchPantryItems();
      setError(null);
    } catch (err) {
      setError('Failed to delete item');
      console.error('Error:', err);
    }
  };
  

  const calculateExpiryDate = (period) => {
    const selectedPeriod = EXPIRY_PERIODS.find(p => p.label === period);
    const days = selectedPeriod ? selectedPeriod.days : 30; // Default to 30 days
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return expiryDate;
  };

  const pickImage = () => {
    const options = {
      mediaType: 'photo',
      quality: 1,
    };

    launchImageLibrary(options, response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else {
        const source = { uri: response.assets[0].uri };
        setImageUri(source.uri);
      }
    });
  };

  const uploadAndScanImage = async (uri) => {
    if (!uri) {
      console.warn('No image selected.');
      return;
    }
  
    const formData = new FormData();
    formData.append('file', {
      uri: uri,
      type: 'image/jpeg',
      name: 'pantry-photo.jpg',
    });
  
    try {
      const rawEmail = await AsyncStorage.getItem('userEmail');
      const email = rawEmail.trim().toLowerCase();
  
      const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SCAN_AND_ADD}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-User-Email': email, // ✅ pass here
        },
      });
  
      console.log('✅ Item added:', response.data.item);
      Alert.alert('Item Added', `${response.data.item} was added to your pantry.`);
      fetchPantryItems();
    } catch (error) {
      console.error('❌ Error scanning and adding:', error);
      setError('Could not scan and add the item.');
    }
  };
  
  
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <Image
            source={require('../assets/mireva-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Refresh Button */}
        <View style={styles.refreshContainer}>
          <TouchableOpacity 
            style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
            onPress={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.refreshButtonText}>🔄 Refresh Pantry</Text>
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.addItemContainer}>
          <Text style={[styles.sectionTitle, {fontSize: 24, backgroundColor: '#FFFF00', padding: 10, borderRadius: 8}]}>🟢 MANUAL ADD ITEMS HERE 🟢</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="Item name"
              placeholderTextColor={COLORS.textSecondary}
              value={newItem.name}
              onChangeText={(text) => setNewItem({ ...newItem, name: text })}
            />
          </View>
         
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.amountInput]}
              placeholder="Amount"
              placeholderTextColor={COLORS.textSecondary}
              value={newItem.amount}
              onChangeText={(text) => setNewItem({ ...newItem, amount: text })}
              keyboardType="numeric"
            />
            
            <View style={styles.measurementPicker}>
              <Picker
                selectedValue={newItem.measurement}
                onValueChange={(value) => setNewItem({ ...newItem, measurement: value })}
                style={styles.picker}
              >
                {MEASUREMENTS.map((measure) => (
                  <Picker.Item 
                    key={measure} 
                    label={measure} 
                    value={measure}
                    color={COLORS.text}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.measurementPicker, { flex: 1 }]}>
              <Text style={styles.pickerLabel}>Expires in:</Text>
              <Picker
                selectedValue={newItem.expiryPeriod}
                onValueChange={(value) => setNewItem({ ...newItem, expiryPeriod: value })}
                style={styles.picker}
              >
                {EXPIRY_PERIODS.map((period) => (
                  <Picker.Item 
                    key={period.label} 
                    label={period.label} 
                    value={period.label}
                    color={COLORS.text}
                  />
                ))}
              </Picker>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={addItem}>
              <Text style={styles.addButtonText}>➕ Add to Pantry</Text>
            </TouchableOpacity>
          
          </View>
          <TouchableOpacity style={styles.scanButton} onPress={takePictureAndScan}>
              <Icon name="photo-camera" size={24} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.scanButtonText}>Scan Pantry Item</Text>
          </TouchableOpacity>
        </View>
        


        <View style={styles.pantryListContainer}>
          <Text style={styles.sectionTitle}>Your Pantry Items (Updated)</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Pantry"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          {['fresh', 'expiringSoon', 'expired', 'pulses'].map(category => {
            const items = categorizedItems()[category].filter(item => 
              item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            
            if (items.length === 0) return null;
            
            const categoryTitles = {
              fresh: 'Fresh Items',
              expiringSoon: 'Use Soon',
              expired: 'Expired',
              pulses: 'Pantry Staples'
            };
            
            const categoryColors = {
              fresh: COLORS.success,
              expiringSoon: COLORS.warning,
              expired: COLORS.error,
              pulses: COLORS.primary
            };
            
            return (
              <View key={category} style={styles.categorySection}>
                <View style={[styles.categoryHeader, { backgroundColor: categoryColors[category] }]}>
                  <Text style={styles.categoryTitle}>{categoryTitles[category]}</Text>
                  <Text style={styles.categoryCount}>{items.length}</Text>
                </View>
                
                {items.map((item) => {
                  const isExpired = new Date(item.expiryDate) < new Date();
                  const isExpiringSoon = !isExpired && (new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24) < 7;
                  
                  return (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemMainContent}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <Text style={styles.itemAmount}>
                            {item.amount} {item.measurement}
                          </Text>
                        </View>
                        
                        <View style={styles.itemRight}>
                          <Text style={[
                            styles.expiryDate,
                            isExpired && styles.expiredText,
                            isExpiringSoon && styles.expiringSoonText
                          ]}>
                            {formatDate(item.expiryDate)}
                          </Text>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => deleteItem(item.id)}
                          >
                            <Text style={styles.deleteButtonText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          
          {getFilteredItems().length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No pantry items found</Text>
              <Text style={styles.emptyStateSubtext}>Add some items to get started!</Text>
            </View>
          )}
        </View>

        <Button title="Pick an Image" onPress={pickImage} />
        {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
        <Button 
          title="Upload and Scan" 
          onPress={() => uploadAndScanImage(imageUri)} 
          disabled={!imageUri}
        />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PantryScreen;