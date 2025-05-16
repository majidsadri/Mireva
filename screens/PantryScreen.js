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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

const API_URL = "https://c8f8-18-215-164-114.ngrok-free.app";


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





const addToPantryFromScan = (itemText) => {
  const item = {
    id: Date.now().toString(),
    name: itemText.trim().split('\n')[0] || 'Unknown item',
    amount: '',
    measurement: 'unit',
    expiryDate: new Date().toISOString(),
  };

  fetch(`${API_URL}/pantry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const [selectedDuration, setSelectedDuration] = useState('2w');

  const [newItem, setNewItem] = useState({
    name: '',
    amount: '',
    measurement: 'unit',
    expiryDate: new Date(),
  });
  const [error, setError] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
      } else if (/beans|lentils|seeds|pulses/i.test(item.name)) {
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
  
      const response = await fetch(`${API_URL}/pantry`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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

      const response = await axios.post(`${API_URL}/scan-and-add`, data, {
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
  
      const response = await fetch(`${API_URL}/pantry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': email, // ✅ this is required by the backend
        },
        body: JSON.stringify({
          id: Date.now().toString(),
          ...newItem,
          expiryDate: newItem.expiryDate.toISOString(),
        }),
      });
  
      if (!response.ok) throw new Error('Failed to add item');
  
      setNewItem({
        name: '',
        amount: '',
        measurement: 'unit',
        expiryDate: new Date(),
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
  
      const response = await fetch(`${API_URL}/pantry/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': email.trim().toLowerCase(),
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
  
  const getExpiryDateFromDuration = (duration) => {
    const now = new Date();
    switch (duration) {
      case '2w': return new Date(now.setDate(now.getDate() + 14));
      case '1m': return new Date(now.setMonth(now.getMonth() + 1));
      case '6m': return new Date(now.setMonth(now.getMonth() + 6));
      case '1y': return new Date(now.setFullYear(now.getFullYear() + 1));
      case 'custom': return newItem.expiryDate;
      default: return new Date();
    }
  };
  
  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setNewItem({ ...newItem, expiryDate: selectedDate });
    }
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
  
      const response = await axios.post(`${API_URL}/scan-and-add`, formData, {
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

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.addItemContainer}>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.nameInputFlex]}
              placeholder="Item name"
              value={newItem.name}
              onChangeText={(text) => setNewItem({ ...newItem, name: text })}
            />
            <TextInput
              style={[styles.input, styles.amountInputFlex]}
              placeholder="Amount"
              value={newItem.amount}
              onChangeText={(text) => setNewItem({ ...newItem, amount: text })}
              keyboardType="numeric"
            />
          </View>
        
        {/* Expiry Date Picker */}
        <View style={styles.rowJustified}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              Expiry: {formatDate(newItem.expiryDate)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton} onPress={addItem}>
            <Text style={styles.addButtonText}>Add to Pantry</Text>
          </TouchableOpacity>
        </View>

        </View>

        {showDatePicker && (
          <DateTimePicker
            value={newItem.expiryDate}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}

        <View style={styles.scanContainer}>
          <TouchableOpacity style={styles.cameraButton} onPress={takePictureAndScan}>
            
            <Text>Edit</Text>
            <Text style={styles.cameraButtonText}>Scan Pantry Item</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pantryListContainer}>
          <Text style={styles.sectionTitle}>Your Pantry Items</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Pantry"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {['fresh', 'pulses', 'expiringSoon', 'expired'].map(category => (
            categorizedItems()[category].length > 0 && (
              <View key={category}>
                <Text style={styles.categoryHeader}>
                  {category.replace(/([A-Z])/g, ' $1').toUpperCase()}
                </Text>
                {categorizedItems()[category]
                  .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(item => (
                    <View key={item.id} style={styles.itemContainer}>
                      <View style={styles.itemDetails}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.amount ? (
                          <Text style={styles.itemAmount}>
                            {item.amount} {item.measurement}
                          </Text>
                        ) : null}
                        <Text
                          style={[
                            styles.expiryDate,
                            new Date(item.expiryDate) < new Date() && styles.expired,
                          ]}
                        >
                          Expires: {formatDate(item.expiryDate)}
                        </Text>
                      </View>
                      <View style={styles.iconButtonGroup}>
                      <TouchableOpacity
                        style={[styles.iconCircle, { backgroundColor: '#D0E8FF', alignItems: 'center', justifyContent: 'center' }]}
                        onPress={() => editItem(item)}
                      >
                        <Text style={{ color: '#007AFF', fontWeight: 'bold', fontSize: 12 }}>EDIT</Text>
                      </TouchableOpacity>


                        <TouchableOpacity
                          style={[styles.iconCircle, { backgroundColor: '#FFE5E5', alignItems: 'center', justifyContent: 'center' }]}
                          onPress={() => deleteItem(item.id)}
                        >
                          <Text style={{ color: '#FF3B30', fontWeight: 'bold', fontSize: 12 }}>DEL</Text>
                        </TouchableOpacity>

                      </View>
                    </View>
                  ))}
              </View>
            )
          ))}
        </View>

        {/* <Button title="Pick an Image" onPress={pickImage} />
        {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
        <Button 
          title="Upload and Scan" 
          onPress={() => uploadAndScanImage(imageUri)} 
          disabled={!imageUri}
        /> */}
      </ScrollView>
      
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PantryScreen;
