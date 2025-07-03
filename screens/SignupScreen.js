import React, { useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { API_CONFIG } from '../config';
import BiometricAuth from '../utils/BiometricAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignupScreen({ onSignup, onBackToSignin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSignup = async () => {
    // Validation
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SIGNUP}`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          name: name.trim(),
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
        
        // Check if biometric is supported and offer to enable it
        const { isSupported } = await BiometricAuth.checkSupport();
        
        if (isSupported) {
          Alert.alert(
            'Success!', 
            'Account created successfully! Would you like to enable biometric authentication for quick sign-in?',
            [
              {
                text: 'Not Now',
                onPress: () => {
                  onSignup(data);
                }
              },
              {
                text: 'Enable',
                onPress: async () => {
                  const biometricResult = await BiometricAuth.authenticate('Enable biometric authentication for Mireva');
                  if (biometricResult.success) {
                    Alert.alert('Great!', 'Biometric authentication enabled. You can now use it to sign in quickly.');
                  }
                  onSignup(data);
                }
              }
            ]
          );
        } else {
          Alert.alert(
            'Success', 
            'Account created successfully! You can now sign in.',
            [
              {
                text: 'OK',
                onPress: () => {
                  onSignup(data);
                }
              }
            ]
          );
        }
      } else {
        Alert.alert('Error', data.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      // Clean, user-friendly error messages
      if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
        Alert.alert(
          'Connection Error', 
          'Unable to create your account right now. Please check your internet connection and try again.',
          [
            { text: 'Try Again' },
            { 
              text: 'Continue Offline', 
              onPress: async () => {
                // Create demo account for testing
                const demoUser = {
                  name: name.trim() || email.split('@')[0],
                  email: email.trim().toLowerCase(),
                  created_at: new Date().toISOString()
                };
                
                await AsyncStorage.setItem('userEmail', email.trim().toLowerCase());
                await AsyncStorage.setItem('userData', JSON.stringify(demoUser));
                Alert.alert('Offline Account Created', 'Your account has been created locally. Sign in online later to sync your data.');
                onSignup(demoUser);
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with logo */}
        <View style={styles.header}>
          <Image
            source={require('../assets/mireva-logo.png')}
            style={styles.logo}
          />
          <Text style={styles.title}>Join Mireva</Text>
          <Text style={styles.subtitle}>Create your account to get started</Text>
        </View>

        {/* Sign up form */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
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
              placeholder="Create a password (min. 6 characters)"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={[styles.signupButton, loading && styles.signupButtonDisabled]} 
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Back to signin */}
          <View style={styles.signinLinkContainer}>
            <Text style={styles.signinLinkText}>Already have an account? </Text>
            <TouchableOpacity onPress={onBackToSignin}>
              <Text style={styles.signinLinkButton}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Terms and Privacy */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By creating an account, you agree to our{'\n'}
            <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Version 31.0</Text>
          <Text style={styles.footerSubtext}>Powered by Mireva AI</Text>
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
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  logo: {
    width: 80,
    height: 80,
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
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  inputContainer: {
    marginBottom: 20,
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
  signupButton: {
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
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  signinLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  signinLinkText: {
    fontSize: 16,
    color: '#718096',
  },
  signinLinkButton: {
    fontSize: 16,
    color: '#2D6A4F',
    fontWeight: '600',
  },
  termsContainer: {
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  termsText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#2D6A4F',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
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