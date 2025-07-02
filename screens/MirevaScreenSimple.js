import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';

export default function MirevaScreenSimple() {
  return (
    <View style={styles.container}>
      {/* Header with logo */}
      <View style={styles.header}>
        <Image
          source={require('../assets/mireva-logo.png')}
          style={styles.logo}
        />
        <Text style={styles.welcomeText}>
          Welcome, <Text style={styles.userName}>User!</Text>
        </Text>
      </View>

      {/* Scan Section */}
      <View style={styles.scanSection}>
        <TouchableOpacity style={styles.scanButton}>
          <Text style={styles.scanIcon}>📱</Text>
          <Text style={styles.scanButtonText}>Scan Pantry Items</Text>
        </TouchableOpacity>
      </View>

      {/* Test Content */}
      <ScrollView style={styles.content}>
        <View style={styles.testCard}>
          <Text style={styles.testTitle}>Test Screen</Text>
          <Text style={styles.testText}>If you can see this, the basic component is working!</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: 50,
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
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
    textAlign: 'center',
  },
  userName: {
    color: '#2D6A4F',
  },
  scanSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#2D6A4F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  scanIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  testCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  testTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 10,
  },
  testText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
  },
});