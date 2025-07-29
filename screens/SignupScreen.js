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
} from 'react-native';
import { API_CONFIG } from '../config';
import BiometricAuth from '../utils/BiometricAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignupScreen({ onSignup, onBackToSignin }) {
  const [step, setStep] = useState('email'); // email, verify, password
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

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
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.signupButtonText}>Send Verification Code</Text>
        )}
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
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.signupButtonText}>Verify Code</Text>
        )}
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
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.signupButtonText}>Create Account</Text>
        )}
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
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header with logo */}
          <View style={styles.header}>
            <Image
              source={require('../assets/mireva-logo.png')}
              style={styles.logo}
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
            <Text style={styles.footerText}>Version 31.0</Text>
            <Text style={styles.footerSubtext}>Powered by Mireva AI</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 30,
    paddingTop: 20,
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
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 10,
    fontWeight: '600',
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