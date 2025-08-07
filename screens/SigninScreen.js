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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { API_CONFIG } from '../config';
import BiometricAuth from '../utils/BiometricAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function SigninScreen({ onSignin, onGoToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
    configureGoogleSignIn();
  }, []);

  const configureGoogleSignIn = () => {
    GoogleSignin.configure({
      webClientId: '677358849010-v7rm0ps4cq0me3el7r1c5upgj2ceido1.apps.googleusercontent.com',
      iosClientId: '677358849010-1d5fb5u1unmish4oahjqir6i6ja5f95i.apps.googleusercontent.com',
      offlineAccess: false,
      forceCodeForRefreshToken: true,
      scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
      prompt: 'select_account',
    });
  };

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

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      console.log('Starting Google Sign-In process...');
      
      // Sign out any existing session first to force account selection
      try {
        await GoogleSignin.signOut();
        console.log('Signed out existing Google session to force account selection');
      } catch (signOutError) {
        console.log('No existing session to sign out');
      }
      
      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();
      
      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();
      
      // Get the ID token
      let idToken = userInfo.data?.idToken || userInfo.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }
      
      // Decode JWT token to get user data
      function decodeJWT(token) {
        try {
          const parts = token.split('.');
          if (parts.length !== 3) return null;
          const payload = parts[1];
          const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
          const decoded = atob(paddedPayload);
          return JSON.parse(decoded);
        } catch (error) {
          console.error('JWT decode error:', error);
          return null;
        }
      }
      
      if (idToken) {
        const jwtPayload = decodeJWT(idToken);
        if (jwtPayload) {
          const userData = jwtPayload;
          const userId = userData.sub || userData.user_id || userData.uid;
          const userName = userData.name || userData.given_name + ' ' + userData.family_name;
          const userEmail = userData.email;
          const userPhoto = userData.picture || userData.photo;
          
          if (!userEmail) {
            Alert.alert('Error', 'Google authentication failed - no email received');
            return;
          }
          
          // Send to backend
          const requestData = {
            googleToken: idToken,
            user: {
              id: userId,
              name: userName,
              email: userEmail,
              photo: userPhoto,
            }
          };
          
          const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GOOGLE_AUTH}`, {
            method: 'POST',
            headers: API_CONFIG.getHeaders(),
            body: JSON.stringify(requestData),
          });

          if (response.ok) {
            const data = await response.json();
            
            // Store user data
            await AsyncStorage.setItem('userEmail', userEmail);
            await AsyncStorage.setItem('userData', JSON.stringify({
              name: userName,
              email: userEmail,
              photo: userPhoto,
              google_user: true,
            }));

            Alert.alert('Success!', 'Welcome back to Mireva!', [
              { text: 'Continue', onPress: () => onSignin(data) }
            ]);
          } else {
            const errorData = await response.json();
            Alert.alert('Error', errorData.error || 'Failed to sign in with Google');
          }
        }
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      if (error.code === 'SIGN_IN_CANCELLED') {
        return;
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        Alert.alert('Error', 'Google Play Services not available');
      } else {
        Alert.alert('Google Sign-In Error', `Failed to sign in with Google.\n\nError: ${error.message || error.code || 'Unknown error'}\n\nPlease try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const { width, height } = Dimensions.get('window');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gradientBackground}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          {/* Header with logo */}
          <View style={styles.header}>
            <Image
              source={require('../assets/IMG_4544.png')}
              style={styles.logo}
            />
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>Access your account to continue</Text>
          </View>

          {/* Sign in form */}
          <View style={styles.formContainer}>
        {/* Authentication Options */}
        <View style={styles.authOptionsContainer}>
          {/* Google Sign In Circle */}
          <View style={styles.authOption}>
            <TouchableOpacity 
              style={[styles.googleCircle, loading && styles.googleCircleDisabled]} 
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#4285F4" size="large" />
              ) : (
                <View style={styles.googleIconContainer}>
                  <Image 
                    source={require('../assets/google-logo.jpg')}
                    style={styles.googleLogoImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.googleLabel}>Sign in with Google</Text>
          </View>

          {/* Biometric Authentication Circle */}
          {biometricSupported && (
            <View style={styles.authOption}>
              <TouchableOpacity 
                style={[styles.biometricCircle, loading && styles.biometricCircleDisabled]} 
                onPress={handleBiometricSignin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#2D6A4F" size="large" />
                ) : (
                  <View style={styles.biometricIconContainer}>
                    <Image 
                      source={require('../assets/face-id-logo.png.png')}
                      style={styles.faceIdImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.biometricLabel}>Use {biometricType}</Text>
            </View>
          )}
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerCircle}>
            <Text style={styles.dividerText}>OR</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your username or email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setShowPasswordField(text.trim().length > 0);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {showPasswordField && (
          <View style={[styles.inputContainer, styles.fadeIn]}>
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
        )}

        {showPasswordField && (
          <TouchableOpacity 
            style={[styles.signinButton, loading && styles.signinButtonDisabled]} 
            onPress={handleSignin}
            disabled={loading}
          >
            <View style={styles.gradientButton}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signinButtonText}>Sign In</Text>
              )}
            </View>
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
            <Text style={styles.footerText}>Version 1.3</Text>
            <Text style={styles.footerSubtext}>Powered by Mireva Life Group</Text>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1f0d',
  },
  gradientBackground: {
    flex: 1,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 50,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 40,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 15,
    },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 22,
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 16,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    backdropFilter: 'blur(10px)',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 10,
    marginLeft: 6,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.2)',
    fontSize: 16,
    color: '#2D3748',
    shadowColor: 'rgba(102, 126, 234, 0.3)',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 56,
  },
  signinButton: {
    backgroundColor: '#2D6A4F',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    shadowColor: '#2D6A4F',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    transform: [{ scale: 1 }],
    minHeight: 56,
    overflow: 'hidden',
  },
  signinButtonDisabled: {
    opacity: 0.6,
    transform: [{ scale: 0.98 }],
  },
  signinButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  signupLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 15,
    marginHorizontal: -24,
  },
  signupLinkText: {
    fontSize: 16,
    color: 'rgba(45, 106, 79, 0.8)',
    fontWeight: '500',
  },
  signupLinkButton: {
    fontSize: 16,
    color: '#2D6A4F',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  biometricCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D6A4F',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 12,
  },
  biometricCircleDisabled: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
  biometricIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceIdImage: {
    width: 40,
    height: 40,
  },
  biometricLabel: {
    fontSize: 14,
    color: '#2D6A4F',
    fontWeight: '600',
    textAlign: 'center',
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
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
    paddingHorizontal: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
  },
  dividerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dividerText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  fadeIn: {
    opacity: 1,
  },
  authOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  authOption: {
    alignItems: 'center',
    marginHorizontal: 15,
  },
  googleCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D6A4F',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 12,
  },
  googleCircleDisabled: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
  googleIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
  },
  googleLogoImage: {
    width: 70,
    height: 70,
  },
  googleIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4285F4',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'Roboto',
  },
  googleLabel: {
    fontSize: 14,
    color: '#2D6A4F',
    fontWeight: '600',
    textAlign: 'center',
  },
});