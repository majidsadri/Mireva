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
import { images } from '../assets';
import BiometricAuth from '../utils/BiometricAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function SignupScreen({ onSignup, onBackToSignin }) {
  const [step, setStep] = useState('email'); // email, verify, password
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Configure Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '677358849010-v7rm0ps4cq0me3el7r1c5upgj2ceido1.apps.googleusercontent.com',
      iosClientId: '677358849010-1d5fb5u1unmish4oahjqir6i6ja5f95i.apps.googleusercontent.com',
      offlineAccess: false,
      forceCodeForRefreshToken: true,
      scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
      accountName: '',
      loginHint: '',
      hostedDomain: '',
      // Force account selection
      prompt: 'select_account',
    });
  }, []);

  // Timer for resend code
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleGoogleSignUp = async () => {
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
      console.log('Checking Google Play Services...');
      await GoogleSignin.hasPlayServices();
      console.log('Google Play Services available');
      
      // Sign in with Google and get tokens
      console.log('Attempting Google Sign-In...');
      
      // Add timeout to prevent hanging on passkey screen
      const signInPromise = GoogleSignin.signIn();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Google Sign-In timeout - please try again')), 30000)
      );
      
      const userInfo = await Promise.race([signInPromise, timeoutPromise]);
      console.log('Google Sign-In successful, got userInfo');
      
      // Get the ID token separately if not included
      let idToken = userInfo.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }
      
      // Debug: Log what we got from Google
      console.log('🔍 FULL Google Response:', JSON.stringify(userInfo, null, 2));
      console.log('🔍 Top-level properties:', Object.keys(userInfo));
      console.log('🔍 ID Token present:', !!idToken);
      
      // Log the response structure
      console.log('🔍 Response structure - user object exists:', !!userInfo.user);
      
      // Check for email anywhere in the response
      function findEmailInObject(obj, path = '') {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          if (key.toLowerCase().includes('email') || (typeof value === 'string' && value.includes('@'))) {
            console.log(`🔍 Found potential email at ${currentPath}:`, value);
          }
          if (typeof value === 'object' && value !== null) {
            findEmailInObject(value, currentPath);
          }
        }
      }
      
      console.log('🔍 Searching for email in entire response:');
      findEmailInObject(userInfo);
      
      // Extract user data from JWT token since Google isn't returning user object
      let userData, userId, userName, userEmail, userPhoto;
      
      // Function to decode JWT token (simple base64 decode for payload)
      function decodeJWT(token) {
        try {
          const parts = token.split('.');
          if (parts.length !== 3) return null;
          
          const payload = parts[1];
          // Add padding if necessary
          const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
          const decoded = atob(paddedPayload);
          return JSON.parse(decoded);
        } catch (error) {
          console.error('JWT decode error:', error);
          return null;
        }
      }
      
      // Try to get user data from JWT token
      if (idToken) {
        console.log('🔍 Decoding JWT token for user data...');
        const jwtPayload = decodeJWT(idToken);
        console.log('🔍 JWT Payload:', JSON.stringify(jwtPayload, null, 2));
        
        if (jwtPayload) {
          userData = jwtPayload;
          userId = userData.sub || userData.user_id || userData.uid;
          userName = userData.name || userData.given_name + ' ' + userData.family_name;
          userEmail = userData.email;
          userPhoto = userData.picture || userData.photo;
        }
      }
      
      // Fallback: Try different data structures that Google might return
      if (!userData && userInfo.user) {
        userData = userInfo.user;
        userId = userData.id || userData.uid || userData.sub;
        userName = userData.name || userData.displayName || (userData.given_name && userData.family_name ? userData.given_name + ' ' + userData.family_name : userData.given_name);
        userEmail = userData.email;
        userPhoto = userData.photo || userData.photoURL || userData.picture;
      } else if (!userData && userInfo.data) {
        userData = userInfo.data;
        userId = userData.id || userData.uid || userData.sub;
        userName = userData.name || userData.displayName || (userData.given_name && userData.family_name ? userData.given_name + ' ' + userData.family_name : userData.given_name);
        userEmail = userData.email;
        userPhoto = userData.photo || userData.photoURL || userData.picture;
      }
      
      console.log('Extracted data:', { userId, userName, userEmail, userPhoto });
      console.log('Google token:', idToken);
      console.log('Full userData object:', JSON.stringify(userData, null, 2));
      
      if (!idToken) {
        Alert.alert('Error', 'Google authentication failed - no token received');
        return;
      }
      
      if (!userEmail) {
        console.error('No email found in Google response');
        console.error('Available properties:', Object.keys(userData || {}));
        Alert.alert('Error', `Google authentication failed - no email received.\n\nPlease ensure your Google account has a public email address.\n\nDebug info: ${JSON.stringify(Object.keys(userData || {}))}`);
        return;
      }
      
      const requestData = {
        googleToken: idToken,
        user: {
          id: userId,
          name: userName,
          email: userEmail,
          photo: userPhoto,
        }
      };
      
      console.log('Sending to backend:', JSON.stringify(requestData, null, 2));
      
      // Send Google user info to your backend
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

        Alert.alert('Success!', 'Welcome to Mireva!', [
          { text: 'Continue', onPress: () => onSignup({ id: userId, name: userName, email: userEmail, photo: userPhoto }) }
        ]);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to sign up with Google');
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      console.error('Error Code:', error.code);
      console.error('Error Message:', error.message);
      
      if (error.code === 'SIGN_IN_CANCELLED') {
        // User cancelled the sign-in
        return;
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        Alert.alert('Error', 'Google Play Services not available');
      } else if (error.code === 'SIGN_IN_REQUIRED') {
        Alert.alert('Error', 'Google Sign-In is required but not configured properly');
      } else if (error.code === 'IN_PROGRESS') {
        Alert.alert('Error', 'Google Sign-In already in progress');
      } else {
        Alert.alert('Google Sign-In Error', `Failed to sign in with Google.\n\nError: ${error.message || error.code || 'Unknown error'}\n\nPlease check your Google configuration and try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerificationCode = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Error', 'Please enter your name and email');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/send-verification-code`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep('verify');
        setResendTimer(60); // 60 second cooldown
        
        // Check if we're in test mode with the code provided
        if (data.test_code && data.test_mode) {
          Alert.alert(
            'Development Mode', 
            `Email service not configured.\n\nYour verification code is: ${data.test_code}\n\nCopy this code and paste it in the next step.`,
            [{ text: 'Got it', style: 'default' }]
          );
        } else {
          // Real email was sent successfully
          Alert.alert(
            'Email Sent!', 
            `We've sent a verification code to ${email}.\n\nPlease check your inbox and enter the 6-digit code in the next step.`,
            [{ text: 'Continue', style: 'default' }]
          );
        }
      } else {
        Alert.alert('Error', data.error || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Send verification error:', error);
      Alert.alert('Error', 'Unable to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Verification code must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/verify-code`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: verificationCode.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep('password');
      } else {
        Alert.alert('Error', data.error || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Verify code error:', error);
      Alert.alert('Error', 'Unable to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please enter and confirm your password');
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
      const response = await fetch(`${API_CONFIG.BASE_URL}/signup-verified`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update name if provided
        data.name = name.trim() || data.name;
        
        // Store user data
        await AsyncStorage.setItem('userEmail', email.trim().toLowerCase());
        await AsyncStorage.setItem('userData', JSON.stringify(data));
        await AsyncStorage.setItem('biometricUserData', JSON.stringify({
          email: email.trim().toLowerCase(),
          name: data.name,
          created_at: data.created_at
        }));
        
        // Check biometric support
        const { isSupported } = await BiometricAuth.checkSupport();
        
        if (isSupported) {
          Alert.alert(
            'Success!', 
            'Account created successfully! Would you like to enable biometric authentication for quick sign-in?',
            [
              {
                text: 'Not Now',
                onPress: () => onSignup(data)
              },
              {
                text: 'Enable',
                onPress: async () => {
                  const biometricResult = await BiometricAuth.authenticate('Enable biometric authentication for Mireva');
                  if (biometricResult.success) {
                    Alert.alert('Great!', 'Biometric authentication enabled.');
                  }
                  onSignup(data);
                }
              }
            ]
          );
        } else {
          Alert.alert('Success', 'Account created successfully!');
          onSignup(data);
        }
      } else {
        Alert.alert('Error', data.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    if (resendTimer === 0) {
      handleSendVerificationCode();
    }
  };

  const handleBackStep = () => {
    if (step === 'verify') {
      setStep('email');
      setVerificationCode('');
    } else if (step === 'password') {
      setStep('verify');
      setPassword('');
      setConfirmPassword('');
    }
  };

  const renderEmailStep = () => (
    <View style={styles.formContainer}>
      {/* Authentication Options */}
      <View style={styles.authOptionsContainer}>
        {/* Google Sign Up Circle */}
        <View style={styles.authOption}>
          <TouchableOpacity 
            style={[styles.googleCircle, loading && styles.googleCircleDisabled]} 
            onPress={handleGoogleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#4285F4" size="large" />
            ) : (
              <View style={styles.googleIconContainer}>
                <Image 
                  source={images.googleLogo}
                  style={styles.googleLogoImage}
                  resizeMode="contain"
                  onError={(error) => console.log('Signup Google logo error:', error)}
                  onLoad={() => console.log('Signup Google logo loaded')}
                  fadeDuration={0}
                />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.googleLabel}>Sign up with Google</Text>
        </View>
      </View>

      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <View style={styles.dividerCircle}>
          <Text style={styles.dividerText}>OR</Text>
        </View>
        <View style={styles.dividerLine} />
      </View>

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

      <TouchableOpacity 
        style={[styles.signupButton, loading && styles.signupButtonDisabled]} 
        onPress={handleSendVerificationCode}
        disabled={loading}
      >
        <View style={styles.gradientButton}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signupButtonText}>Send Verification Code</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderVerifyStep = () => (
    <View style={styles.formContainer}>
      <TouchableOpacity style={styles.backButton} onPress={handleBackStep}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.verifyTitle}>Enter Verification Code</Text>
      <Text style={styles.verifySubtitle}>
        We sent a 6-digit code to {email}
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="000000"
          placeholderTextColor="#999"
          value={verificationCode}
          onChangeText={(text) => {
            // Only allow numbers and max 6 digits
            const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
            setVerificationCode(cleaned);
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />
      </View>

      <TouchableOpacity 
        style={[styles.signupButton, loading && styles.signupButtonDisabled]} 
        onPress={handleVerifyCode}
        disabled={loading}
      >
        <View style={styles.gradientButton}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signupButtonText}>Verify Code</Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.resendButton} 
        onPress={handleResendCode}
        disabled={resendTimer > 0}
      >
        <Text style={[styles.resendButtonText, resendTimer > 0 && styles.resendButtonDisabled]}>
          {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPasswordStep = () => (
    <View style={styles.formContainer}>
      <TouchableOpacity style={styles.backButton} onPress={handleBackStep}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.verifyTitle}>Create Your Password</Text>
      <Text style={styles.verifySubtitle}>
        Almost done! Set a secure password for your account
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Create a password (min. 6 characters)"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
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
        onPress={handleCompleteSignup}
        disabled={loading}
      >
        <View style={styles.gradientButton}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signupButtonText}>Create Account</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  const getStepIndicator = () => {
    const steps = ['email', 'verify', 'password'];
    const currentIndex = steps.indexOf(step);
    
    return (
      <View style={styles.stepIndicatorContainer}>
        {steps.map((s, index) => (
          <View key={s} style={styles.stepWrapper}>
            <View style={[
              styles.stepDot,
              index <= currentIndex && styles.stepDotActive
            ]} />
            {index < steps.length - 1 && (
              <View style={[
                styles.stepLine,
                index < currentIndex && styles.stepLineActive
              ]} />
            )}
          </View>
        ))}
      </View>
    );
  };

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
                source={images.headerLogo}
                style={styles.logo}
                resizeMode="contain"
                onError={(error) => console.log('Signup header logo error:', error)}
                onLoad={() => console.log('Signup header logo loaded')}
                fadeDuration={0}
              />
              <Text style={styles.title}>Join Mireva</Text>
              <Text style={styles.subtitle}>
                {step === 'email' && 'Create your account to get started'}
                {step === 'verify' && 'Verify your email address'}
                {step === 'password' && 'Set up your password'}
              </Text>
            </View>

          {/* Step Indicator */}
          {getStepIndicator()}

          {/* Render current step */}
          {step === 'email' && renderEmailStep()}
          {step === 'verify' && renderVerifyStep()}
          {step === 'password' && renderPasswordStep()}

          {/* Back to signin - only on first step */}
          {step === 'email' && (
            <View style={styles.signinLinkContainer}>
              <Text style={styles.signinLinkText}>Already have an account? </Text>
              <TouchableOpacity onPress={onBackToSignin}>
                <Text style={styles.signinLinkButton}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Terms and Privacy - only on first step */}
          {step === 'email' && (
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By creating an account, you agree to our{'\n'}
                <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          )}

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
    paddingBottom: 20,
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
  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 60,
    marginBottom: 30,
  },
  stepWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  stepDotActive: {
    backgroundColor: '#2D6A4F',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 5,
  },
  stepLineActive: {
    backgroundColor: '#2D6A4F',
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
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2D6A4F',
    fontWeight: '600',
  },
  verifyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 10,
    textAlign: 'center',
  },
  verifySubtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
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
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 10,
    fontWeight: '600',
  },
  signupButton: {
    backgroundColor: '#2D6A4F',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 30,
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
  signupButtonDisabled: {
    opacity: 0.6,
    transform: [{ scale: 0.98 }],
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  gradientButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
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
  authOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 15,
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
    marginBottom: 8,
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
  googleLabel: {
    fontSize: 14,
    color: '#2D6A4F',
    fontWeight: '600',
    textAlign: 'center',
  },
  resendButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 16,
    color: '#2D6A4F',
    fontWeight: '600',
  },
  resendButtonDisabled: {
    color: '#A0AEC0',
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
});