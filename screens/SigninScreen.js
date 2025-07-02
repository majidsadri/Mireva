import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { API_CONFIG } from '../config';
import BiometricAuth from '../utils/BiometricAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SigninScreen({ onSignin, onGoToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState('');

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    const { isSupported, biometryType } = await BiometricAuth.checkSupport();
    setBiometricSupported(isSupported);
    setBiometricType(BiometricAuth.getBiometryTypeString());
  };

  const handleSignin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SIGNIN}`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store user email for API calls
        await AsyncStorage.setItem('userEmail', email.trim().toLowerCase());
        await AsyncStorage.setItem('userData', JSON.stringify(data));
        // Store credentials for biometric auth (encrypted in production)
        await AsyncStorage.setItem('biometricUserData', JSON.stringify({
          email: email.trim().toLowerCase(),
          name: data.name,
          created_at: data.created_at
        }));
        Alert.alert('Success', `Welcome back, ${data.name}!`);
        onSignin(data);
      } else {
        Alert.alert('Error', data.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Signin error:', error);
      Alert.alert('Connection Error', 'Unable to sign in right now. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricSignin = async () => {
    try {
      setLoading(true);
      
      const authResult = await BiometricAuth.authenticate('Sign in to Mireva');
      
      if (authResult.success) {
        // Use stored user credentials after successful biometric authentication
        try {
          const storedBiometricData = await AsyncStorage.getItem('biometricUserData');
          
          if (storedBiometricData) {
            // Use the stored user data from previous successful login
            const userData = JSON.parse(storedBiometricData);
            await AsyncStorage.setItem('userEmail', userData.email);
            await AsyncStorage.setItem('userData', JSON.stringify(userData));
            Alert.alert('Success', `Welcome back, ${userData.name}!`);
            onSignin(userData);
          } else {
            // No stored biometric data, prompt user to sign in normally first
            Alert.alert(
              'Setup Required', 
              'Please sign in with your email and password first to enable biometric authentication.',
              [{ text: 'OK' }]
            );
          }
        } catch (error) {
          console.error('Error loading stored biometric data:', error);
          Alert.alert(
            'Setup Required', 
            'Please sign in with your email and password first to enable biometric authentication.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert('Authentication Failed', authResult.error || 'Biometric authentication failed');
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      Alert.alert('Error', 'Biometric authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with logo */}
      <View style={styles.header}>
        <Image
          source={require('../assets/mireva-logo.png')}
          style={styles.logo}
        />
        <Text style={styles.title}>Welcome to Mireva</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>
      </View>

      {/* Sign in form */}
      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.signinButton, loading && styles.signinButtonDisabled]} 
          onPress={handleSignin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signinButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Biometric Authentication Button */}
        {biometricSupported && (
          <TouchableOpacity 
            style={[styles.biometricButton, loading && styles.signinButtonDisabled]} 
            onPress={handleBiometricSignin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#2D6A4F" />
            ) : (
              <View style={styles.biometricButtonContent}>
                <Text style={styles.biometricIcon}>👤</Text>
                <Text style={styles.biometricButtonText}>Sign in with {biometricType}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Sign up link */}
        <View style={styles.signupLinkContainer}>
          <Text style={styles.signupLinkText}>Don't have an account? </Text>
          <TouchableOpacity onPress={onGoToSignup}>
            <Text style={styles.signupLinkButton}>Create Account</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Version 31.0</Text>
        <Text style={styles.footerSubtext}>Powered by Mireva AI</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#81C784',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  inputContainer: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 16,
    color: '#2D3748',
  },
  signinButton: {
    backgroundColor: '#2D6A4F',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#2D6A4F',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signinButtonDisabled: {
    opacity: 0.6,
  },
  signinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  signupLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  signupLinkText: {
    fontSize: 16,
    color: '#718096',
  },
  signupLinkButton: {
    fontSize: 16,
    color: '#2D6A4F',
    fontWeight: '600',
  },
  biometricButton: {
    backgroundColor: '#F0FDF4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
    borderWidth: 2,
    borderColor: '#81C784',
  },
  biometricButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  biometricIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  biometricButtonText: {
    color: '#2D6A4F',
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 12,
    color: '#E53E3E',
    marginBottom: 10,
    fontWeight: '500',
  },
  instructionText: {
    fontSize: 12,
    color: '#2D6A4F',
    marginBottom: 5,
    fontWeight: '600',
  },
  commandText: {
    fontSize: 10,
    color: '#718096',
    marginBottom: 15,
    fontFamily: 'Courier',
    backgroundColor: '#F7FAFC',
    padding: 8,
    borderRadius: 4,
    lineHeight: 14,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 14,
    color: '#A0AEC0',
    marginBottom: 5,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#CBD5E0',
  },
});