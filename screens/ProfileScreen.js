import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

const DIET_OPTIONS = [
  'None',
  'Vegetarian',
  'Vegan',
  'Keto',
  'Paleo',
  'Mediterranean',
  'Low-Carb',
  'Gluten-Free',
  'Dairy-Free',
];

const CUISINE_OPTIONS = [
  'Italian',
  'Persian',
  'Indian',
  'Chinese',
  'Japanese',
  'Mexican',
  'Mediterranean',
  'American',
  'Thai',
  'French',
];

export default function ProfileScreen({ navigation, route }) {
  const [name, setName] = useState('');
  const [selectedDiets, setSelectedDiets] = useState([]);
  const [favoriteCuisines, setFavoriteCuisines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const profilePath = `${RNFS.DocumentDirectoryPath}/../users.json`;

  const loadProfile = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) throw new Error('No user email found');
  
      const response = await fetch('https://37c2-18-215-164-114.ngrok-free.app/users.json');
      const users = await response.json();
  
      const userProfile = users[userEmail] || {
        name: userEmail.split('@')[0],
        diets: [],
        cuisines: [],
      };
  
      setName(userProfile.name || '');
      setSelectedDiets(userProfile.diets || []);
      setFavoriteCuisines(userProfile.cuisines || []);
    } catch (error) {
      console.error('Error loading profile:', error);
      if (route.params?.userData) {
        setName(route.params.userData.name || '');
        setSelectedDiets(route.params.userData.diets || []);
        setFavoriteCuisines(route.params.userData.cuisines || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) throw new Error('No user email found');
  
      const response = await fetch('https://37c2-18-215-164-114.ngrok-free.app/users.json');
      const users = await response.json();
  
      users[userEmail] = {
        ...users[userEmail],
        name,
        diets: selectedDiets.filter((diet) => diet !== 'None'),
        cuisines: favoriteCuisines,
      };
  
      await fetch('https://37c2-18-215-164-114.ngrok-free.app/users.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(users),
      });
  
      alert('Profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert(`Error saving profile: ${error.message}`);
    }
  };
  
  const toggleDiet = (diet) => {
    setSelectedDiets((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const toggleCuisine = (cuisine) => {
    setFavoriteCuisines((prev) =>
      prev.includes(cuisine) ? prev.filter((c) => c !== cuisine) : [...prev, cuisine]
    );
  };

  const handleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('userEmail');
    } catch (error) {
      console.error('Error during sign out:', error);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Signin' }] });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.contentContainer}>
            <Text style={styles.userName}>Welcome, {name}!</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dietary Preferences</Text>
              <View style={styles.optionsGrid}>
                {DIET_OPTIONS.map((diet) => (
                  <TouchableOpacity
                    key={diet}
                    style={[
                      styles.optionButton,
                      selectedDiets.includes(diet) && styles.selectedOption,
                    ]}
                    onPress={() => toggleDiet(diet)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedDiets.includes(diet) && styles.selectedOptionText,
                      ]}
                    >
                      {diet}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Favorite Cuisines</Text>
              <View style={styles.optionsGrid}>
                {CUISINE_OPTIONS.map((cuisine) => (
                  <TouchableOpacity
                    key={cuisine}
                    style={[
                      styles.optionButton,
                      favoriteCuisines.includes(cuisine) && styles.selectedOption,
                    ]}
                    onPress={() => toggleCuisine(cuisine)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        favoriteCuisines.includes(cuisine) && styles.selectedOptionText,
                      ]}
                    >
                      {cuisine}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
              <Text style={styles.saveButtonText}>Save Preferences</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  keyboardAvoidingView: { flex: 1 },
  scrollView: { flex: 1, width: '100%' },
  scrollViewContent: { flexGrow: 1, paddingBottom: 120 },
  contentContainer: { padding: 20 },
  userName: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  optionButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    margin: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#007AFF',
  },
  optionText: {
    color: '#333',
    fontSize: 14,
  },
  selectedOptionText: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 20,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOutButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
  },
  signOutButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
