import TouchID from 'react-native-touch-id';
import { Alert } from 'react-native';

class BiometricAuth {
  constructor() {
    this.isSupported = false;
    this.biometryType = null;
    this.init();
  }

  async init() {
    try {
      const isSupported = await TouchID.isSupported();
      this.isSupported = !!isSupported;
      this.biometryType = isSupported;
    } catch (error) {
      console.log('Biometric authentication not supported:', error);
      this.isSupported = false;
    }
  }

  async checkSupport() {
    try {
      const isSupported = await TouchID.isSupported();
      return { 
        isSupported: !!isSupported, 
        biometryType: isSupported 
      };
    } catch (error) {
      return { 
        isSupported: false, 
        biometryType: null 
      };
    }
  }

  async authenticate(reason = 'Authenticate with Face ID') {
    try {
      const optionalConfigObject = {
        title: 'Authentication Required',
        subtitle: 'Mireva needs to verify your identity',
        description: reason,
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        passcodeFallback: true,
        showErrorAlert: true,
        errorAlertMessage: 'Authentication failed',
        unifiedErrors: false,
      };

      const success = await TouchID.authenticate(reason, optionalConfigObject);
      return { success: true, data: success };
    } catch (error) {
      console.log('Biometric authentication failed:', error);
      
      // Handle different error types
      switch (error.name) {
        case 'LAErrorUserCancel':
          return { success: false, error: 'User cancelled authentication' };
        case 'LAErrorUserFallback':
          return { success: false, error: 'User chose to use passcode' };
        case 'LAErrorSystemCancel':
          return { success: false, error: 'Authentication was cancelled by system' };
        case 'LAErrorPasscodeNotSet':
          return { success: false, error: 'Passcode is not set on device' };
        case 'LAErrorBiometryNotAvailable':
          return { success: false, error: 'Biometry is not available' };
        case 'LAErrorBiometryNotEnrolled':
          return { success: false, error: 'Biometry is not enrolled' };
        case 'LAErrorBiometryLockout':
          return { success: false, error: 'Biometry is locked out' };
        default:
          return { success: false, error: error.message || 'Authentication failed' };
      }
    }
  }

  getBiometryTypeString() {
    if (!this.biometryType) return 'Not Available';
    
    switch (this.biometryType) {
      case 'FaceID':
        return 'Face ID';
      case 'TouchID':
        return 'Touch ID';
      case 'Biometrics':
        return 'Biometric Authentication';
      default:
        return 'Biometric Authentication';
    }
  }

  async promptForBiometricSetup() {
    const { isSupported, biometryType } = await this.checkSupport();
    
    if (!isSupported) {
      Alert.alert(
        'Biometric Authentication Not Available',
        'This device does not support biometric authentication.',
        [{ text: 'OK' }]
      );
      return false;
    }

    const biometryName = this.getBiometryTypeString();
    
    Alert.alert(
      `Enable ${biometryName}?`,
      `You can use ${biometryName} for quick and secure authentication in Mireva.`,
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Enable', onPress: () => this.enableBiometric() }
      ]
    );
    
    return true;
  }

  async enableBiometric() {
    const result = await this.authenticate('Enable biometric authentication for Mireva');
    if (result.success) {
      // Store that biometric is enabled for this user
      return true;
    }
    return false;
  }
}

export default new BiometricAuth();