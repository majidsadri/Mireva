import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage'; // ← this line
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { Alert as RNAlert } from 'react-native';


import Button from './Button';
import Card from './Card';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_CONFIG } from '../config';

const ToBuyScreen = () => {
  const [zipCode, setZipCode] = useState('');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStores = async () => {
    if (!zipCode.trim()) {
      setError('Please enter a valid zip code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/get-stores`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({ zip_code: zipCode }),
      });

      const data = await response.json();

      if (data.stores && data.stores.length > 0) {
        setStores(data.stores);
      } else {
        setError('No stores found. Try another zip code.');
        setStores([]);
      }
    } catch (error) {
      setError('Failed to fetch stores. Check your connection.');
      console.error('Error fetching stores:', error);
    }

    setLoading(false);
  };

  const fetchBestStoreUsingAI = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error("Email not found");
  
      const pantryResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'GET',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': email.trim().toLowerCase(),
        },
      });
  
      const pantryItems = await pantryResponse.json();
      const ingredientNames = pantryItems.map((item) => item.name);
  
      const response = await fetch(`${API_CONFIG.BASE_URL}/recommend-store-ai`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          zip_code: zipCode,
          pantry_items: ingredientNames,
        }),
      });
  
      const data = await response.json();
  
      if (data.store) {
        Alert.alert(
          "🥕 Recommended Store",
          `${data.store.name}\n${data.store.address}\n\n${data.store.reason}`
        );
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      console.error("❌ Error using AI recommendation:", err);
      Alert.alert("Error", "Could not fetch smart store recommendation.");
    }
  };
  
  
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.title}>Find Grocery Stores</Text>

        <TextInput
          value={zipCode}
          onChangeText={setZipCode}
          placeholder="Enter Zip Code"
          keyboardType="numeric"
          style={styles.input}
        />

        <Button onPress={fetchStores} title="Find Stores" />
        <Button onPress={fetchBestStoreUsingAI} title="Smart Recommend Store (AI)" />


        {loading && <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />}

        {error && (
          <View style={styles.errorContainer}>
            <Icon name="error-outline" color="red" size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FlatList
          data={stores}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardContent}>
                <Icon name="storefront" size={24} color="#007AFF" />
                <View style={styles.storeInfo}>
                  <Text style={styles.storeName}>{item.name}</Text>
                  {item.address && <Text style={styles.storeAddress}>{item.address}</Text>}
                </View>
              </View>
            </Card>
          )}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  loader: { marginTop: 15 },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  errorText: { color: 'red', marginLeft: 5, fontSize: 14 },
  card: { padding: 15, marginVertical: 8, borderRadius: 10, backgroundColor: '#f9f9f9' },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  storeInfo: { marginLeft: 10, flex: 1 },
  storeName: { fontSize: 16, fontWeight: 'bold' },
  storeAddress: { fontSize: 14, color: '#555', marginTop: 3 },
});

export default ToBuyScreen;
