import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config';

const { width } = Dimensions.get('window');

export default function ChartsScreen({ navigation }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nutritionData, setNutritionData] = useState({
    protein: 0,
    fiber: 0,
    carbs: 0,
    alcohol: 0
  });

  useEffect(() => {
    loadPantryItems();
  }, []);

  const loadPantryItems = async () => {
    try {
      setLoading(true);
      const userEmail = await AsyncStorage.getItem('userEmail');
      const headers = {
        ...API_CONFIG.getHeaders(),
        ...(userEmail && { 'X-User-Email': userEmail.trim().toLowerCase() })
      };

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PANTRY}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const items = await response.json();
        setPantryItems(items);
        calculateNutrition(items);
      }
    } catch (error) {
      console.error('Error loading pantry items:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateNutrition = (items) => {
    // Simple nutrition mapping for common food items
    const nutritionMap = {
      // Proteins
      'beef': { protein: 8, fiber: 0, carbs: 0, alcohol: 0 },
      'chicken': { protein: 7, fiber: 0, carbs: 0, alcohol: 0 },
      'fish': { protein: 6, fiber: 0, carbs: 0, alcohol: 0 },
      'eggs': { protein: 5, fiber: 0, carbs: 1, alcohol: 0 },
      'beans': { protein: 4, fiber: 6, carbs: 3, alcohol: 0 },
      'lentils': { protein: 4, fiber: 5, carbs: 3, alcohol: 0 },
      
      // Carbs & Fiber
      'rice': { protein: 1, fiber: 1, carbs: 8, alcohol: 0 },
      'bread': { protein: 2, fiber: 2, carbs: 7, alcohol: 0 },
      'pasta': { protein: 2, fiber: 1, carbs: 8, alcohol: 0 },
      'oats': { protein: 2, fiber: 4, carbs: 6, alcohol: 0 },
      'quinoa': { protein: 3, fiber: 3, carbs: 6, alcohol: 0 },
      
      // Vegetables (fiber)
      'carrots': { protein: 0, fiber: 3, carbs: 2, alcohol: 0 },
      'broccoli': { protein: 1, fiber: 3, carbs: 1, alcohol: 0 },
      'spinach': { protein: 1, fiber: 2, carbs: 1, alcohol: 0 },
      'tomato': { protein: 0, fiber: 1, carbs: 1, alcohol: 0 },
      'onion': { protein: 0, fiber: 2, carbs: 2, alcohol: 0 },
      
      // Fruits (carbs & fiber)
      'apple': { protein: 0, fiber: 2, carbs: 3, alcohol: 0 },
      'banana': { protein: 0, fiber: 1, carbs: 4, alcohol: 0 },
      'orange': { protein: 0, fiber: 2, carbs: 3, alcohol: 0 },
      
      // Alcohol
      'wine': { protein: 0, fiber: 0, carbs: 1, alcohol: 10 },
      'beer': { protein: 0, fiber: 0, carbs: 2, alcohol: 8 },
      'vodka': { protein: 0, fiber: 0, carbs: 0, alcohol: 15 },
    };

    let totals = { protein: 0, fiber: 0, carbs: 0, alcohol: 0 };

    items.forEach(item => {
      const itemName = item.name.toLowerCase();
      let nutrition = null;
      
      // Find nutrition data by exact match or partial match
      for (const [food, data] of Object.entries(nutritionMap)) {
        if (itemName.includes(food) || food.includes(itemName)) {
          nutrition = data;
          break;
        }
      }
      
      if (nutrition) {
        const amount = parseInt(item.amount) || 1;
        totals.protein += nutrition.protein * amount;
        totals.fiber += nutrition.fiber * amount;
        totals.carbs += nutrition.carbs * amount;
        totals.alcohol += nutrition.alcohol * amount;
      }
    });

    setNutritionData(totals);
  };

  const renderChart = (label, value, color, maxValue, unit = 'g') => {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    const barWidth = (percentage / 100) * (width - 80);

    return (
      <View style={styles.chartItem}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartLabel}>{label}</Text>
          <Text style={[styles.chartValue, { color }]}>{value}{unit}</Text>
        </View>
        <View style={styles.chartBarContainer}>
          <View 
            style={[
              styles.chartBar, 
              { width: barWidth, backgroundColor: color }
            ]} 
          />
        </View>
        <Text style={styles.chartPercentage}>{percentage.toFixed(1)}%</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text style={styles.loadingText}>Analyzing your pantry...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxValue = Math.max(
    nutritionData.protein,
    nutritionData.fiber,
    nutritionData.carbs,
    nutritionData.alcohol || 1
  );

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
        <Text style={styles.title}>Pantry Nutrition Charts</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{pantryItems.length}</Text>
            <Text style={styles.summaryLabel}>Total Items</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {(nutritionData.protein + nutritionData.fiber + nutritionData.carbs).toFixed(0)}
            </Text>
            <Text style={styles.summaryLabel}>Total Nutrients (g)</Text>
          </View>
        </View>

        {/* Charts */}
        <View style={styles.chartsContainer}>
          <Text style={styles.sectionTitle}>Nutritional Breakdown</Text>
          
          {renderChart('Protein', nutritionData.protein, '#E53E3E', maxValue)}
          {renderChart('Fiber', nutritionData.fiber, '#38A169', maxValue)}
          {renderChart('Carbs', nutritionData.carbs, '#3182CE', maxValue)}
          {renderChart('Alcohol', nutritionData.alcohol, '#805AD5', maxValue, 'ml')}
        </View>

        {/* Items List */}
        <View style={styles.itemsContainer}>
          <Text style={styles.sectionTitle}>Analyzed Items ({pantryItems.length})</Text>
          {pantryItems.map((item, index) => (
            <View key={item.id || index} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemAmount}>
                {item.amount} {item.measurement || 'unit'}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2D6A4F',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
  },
  placeholder: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#718096',
    marginTop: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  chartsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 16,
  },
  chartItem: {
    marginBottom: 20,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  chartValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  chartBarContainer: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    marginBottom: 4,
  },
  chartBar: {
    height: 8,
    borderRadius: 4,
  },
  chartPercentage: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'right',
  },
  itemsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F7FAFC',
  },
  itemName: {
    fontSize: 14,
    color: '#2D3748',
    flex: 1,
  },
  itemAmount: {
    fontSize: 14,
    color: '#718096',
  },
});