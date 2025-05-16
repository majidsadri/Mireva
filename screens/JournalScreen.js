// --- PantryScreen.js (Final Corrected Version) ---

import React, { useState } from 'react';
import { SafeAreaView, View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles, { COLORS } from './JournalScreen.styles';

const API_URL = "https://c8f8-18-215-164-114.ngrok-free.app";

const categories = [
  { name: 'Protein', emoji: '🍗' },
  { name: 'Fruits', emoji: '🍓' },
  { name: 'Vegetables', emoji: '🥦' },
  { name: 'Dairy', emoji: '🧀' },
];

const categoryItems = {
  Protein: [
    { name: 'Beef', emoji: '🥩' },
    { name: 'Fish', emoji: '🐟' },
    { name: 'Salmon', emoji: '🐟' },
    { name: 'Chicken', emoji: '🍗' },
    { name: 'Turkey', emoji: '🦃' },
    { name: 'Tuna', emoji: '🐟' },
    { name: 'Cod', emoji: '🐟' },
    { name: 'Shrimp', emoji: '🦐' },
    { name: 'Crab', emoji: '🦀' },
    { name: 'Lamb', emoji: '🐑' },
  ],
  Fruits: [
    { name: 'Apple', emoji: '🍎' },
    { name: 'Banana', emoji: '🍌' },
    { name: 'Strawberry', emoji: '🍓' },
    { name: 'Watermelon', emoji: '🍉' },
    { name: 'Pineapple', emoji: '🍍' },
  ],
  Vegetables: [
    { name: 'Broccoli', emoji: '🥦' },
    { name: 'Carrot', emoji: '🥕' },
    { name: 'Spinach', emoji: '🥬' },
    { name: 'Tomato', emoji: '🍅' },
    { name: 'Corn', emoji: '🌽' },
  ],
  Dairy: [
    { name: 'Milk', emoji: '🥛' },
    { name: 'Cheese', emoji: '🧀' },
    { name: 'Butter', emoji: '🧈' },
    { name: 'Yogurt', emoji: '🥛' },
    { name: 'Cream', emoji: '🥛' },
  ],
};


const PantryScreen = () => {
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchPantryItems = async () => {
    try {
      const email = (await AsyncStorage.getItem('userEmail'))?.trim().toLowerCase();
      if (!email) throw new Error("No user email found");
      const response = await fetch(`${API_URL}/pantry`, {
        headers: { 'Content-Type': 'application/json', 'X-User-Email': email },
      });
      const data = await response.json();
      setPantryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching pantry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getEmojiForItem = (itemName) => {
    const name = itemName.toLowerCase();
    if (name.includes('salmon') || name.includes('fish') || name.includes('tuna')) return '🐟';
    if (name.includes('chickpea') || name.includes('lentil') || name.includes('bean')) return '🫘';
    if (name.includes('beef') || name.includes('steak')) return '🥩';
    if (name.includes('spinach') || name.includes('leaf') || name.includes('greens')) return '🥬';
    return '🥫'; // Default fallback (canned food)
  };
  
  const addItemToPantry = async (itemName) => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      const newItem = {
        id: Date.now().toString(),
        name: itemName,
        amount: '1',
        measurement: 'unit',
        expiryDate: new Date().toISOString(),
      };
      await fetch(`${API_URL}/pantry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Email': email },
        body: JSON.stringify(newItem),
      });
      fetchPantryItems();
    } catch (error) {
      console.error('Failed to add item', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchPantryItems();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPantryItems();
  };

  const displayedItems = selectedCategory === 'All'
    ? pantryItems
    : categoryItems[selectedCategory] || [];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.headerContainer}>
        <Text style={styles.logoText}>Mireva Pantry</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <TouchableOpacity
          style={[styles.categoryButton, selectedCategory === 'All' && styles.selectedCategoryButton]}
          onPress={() => setSelectedCategory('All')}
        >
          <Text style={selectedCategory === 'All' ? styles.selectedCategoryText : styles.categoryText}>All</Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.name}
            style={[styles.categoryButton, selectedCategory === cat.name && styles.selectedCategoryButton]}
            onPress={() => setSelectedCategory(cat.name)}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={selectedCategory === cat.name ? styles.selectedCategoryText : styles.categoryText}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} style={styles.itemsList}>
        {displayedItems.map(item => (
          <View key={item.id || item.name} style={styles.itemCard}>
            
            <View style={styles.itemImagePlaceholder}>
              <Text style={styles.itemImageEmoji}>{item.emoji || getEmojiForItem(item.name)}</Text>
            </View>


            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.amount ? (
                <Text style={styles.itemAmount}>{item.amount} {item.measurement}</Text>
              ) : null}
            </View>

            <TouchableOpacity style={styles.addButton} onPress={() => addItemToPantry(item.name)}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>

          </View>
        ))}
      </ScrollView>


    </SafeAreaView>
  );
};

export default PantryScreen;