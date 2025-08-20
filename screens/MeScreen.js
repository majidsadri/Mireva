import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { API_CONFIG } from '../config';
import ChartsScreen from './ChartsScreen';
import { images } from '../assets';

export default function MeScreen({ user, onSignout, onProfileImageUpdate }) {
  const animatedValue1 = useRef(new Animated.Value(0)).current;
  const animatedValue2 = useRef(new Animated.Value(0)).current;
  const animatedValue3 = useRef(new Animated.Value(0)).current;
  const animatedValue4 = useRef(new Animated.Value(0)).current;
  const animatedValue5 = useRef(new Animated.Value(0)).current;
  const animatedValue6 = useRef(new Animated.Value(0)).current;
  const animatedValue7 = useRef(new Animated.Value(0)).current;
  const animatedValue8 = useRef(new Animated.Value(0)).current;
  const animatedValue9 = useRef(new Animated.Value(0)).current;
  const animatedValue10 = useRef(new Animated.Value(0)).current;
  const animatedValue11 = useRef(new Animated.Value(0)).current;
  const animatedValue12 = useRef(new Animated.Value(0)).current;
  const animatedValue13 = useRef(new Animated.Value(0)).current;
  const animatedValue14 = useRef(new Animated.Value(0)).current;
  const animatedValue15 = useRef(new Animated.Value(0)).current;
  const animatedValue16 = useRef(new Animated.Value(0)).current;
  const animatedValue17 = useRef(new Animated.Value(0)).current;
  const animatedValue18 = useRef(new Animated.Value(0)).current;
  const animatedValue19 = useRef(new Animated.Value(0)).current;
  const animatedValue20 = useRef(new Animated.Value(0)).current;
  const animatedValue21 = useRef(new Animated.Value(0)).current;
  const animatedValue22 = useRef(new Animated.Value(0)).current;
  const animatedValue23 = useRef(new Animated.Value(0)).current;
  const animatedValue24 = useRef(new Animated.Value(0)).current;
  
  const [joinedPantry, setJoinedPantry] = useState(null);
  const [showJoinPantry, setShowJoinPantry] = useState(false);
  const [pantryName, setPantryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPantries, setLoadingPantries] = useState(false);
  const [availablePantries, setAvailablePantries] = useState([]);
  const [selectedDiets, setSelectedDiets] = useState([]);
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showChartsModal, setShowChartsModal] = useState(false);
  const [accountActionLoading, setAccountActionLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [updatingAccount, setUpdatingAccount] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPantryUsersModal, setShowPantryUsersModal] = useState(false);
  const [pantryUsers, setPantryUsers] = useState([]);
  const [loadingPantryUsers, setLoadingPantryUsers] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [pantryOwnership, setPantryOwnership] = useState({});
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    loadJoinedPantry();
    loadUserPreferences();
    loadProfileImage();
    loadPendingRequests();
    loadUserRequests();
    loadPantryOwnership();
    
    // Start background circle animations
    const startAnimations = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue1, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue1, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue2, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue2, {
            toValue: 0,
            duration: 4000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue3, {
            toValue: 1,
            duration: 5000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue3, {
            toValue: 0,
            duration: 5000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue4, {
            toValue: 1,
            duration: 3500,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue4, {
            toValue: 0,
            duration: 3500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue5, {
            toValue: 1,
            duration: 4500,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue5, {
            toValue: 0,
            duration: 4500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue6, {
            toValue: 1,
            duration: 2800,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue6, {
            toValue: 0,
            duration: 2800,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue7, {
            toValue: 1,
            duration: 3200,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue7, {
            toValue: 0,
            duration: 3200,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue8, {
            toValue: 1,
            duration: 2500,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue8, {
            toValue: 0,
            duration: 2500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue9, {
            toValue: 1,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue9, {
            toValue: 0,
            duration: 2200,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue10, {
            toValue: 1,
            duration: 3800,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue10, {
            toValue: 0,
            duration: 3800,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue11, {
            toValue: 1,
            duration: 2900,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue11, {
            toValue: 0,
            duration: 2900,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue12, {
            toValue: 1,
            duration: 3400,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue12, {
            toValue: 0,
            duration: 3400,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue13, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue13, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue14, {
            toValue: 1,
            duration: 2600,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue14, {
            toValue: 0,
            duration: 2600,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue15, {
            toValue: 1,
            duration: 4200,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue15, {
            toValue: 0,
            duration: 4200,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue16, {
            toValue: 1,
            duration: 1900,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue16, {
            toValue: 0,
            duration: 1900,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue17, {
            toValue: 1,
            duration: 3100,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue17, {
            toValue: 0,
            duration: 3100,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // EXTRA BUBBLE ANIMATIONS!
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue18, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue18, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue19, {
            toValue: 1,
            duration: 2100,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue19, {
            toValue: 0,
            duration: 2100,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue20, {
            toValue: 1,
            duration: 1700,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue20, {
            toValue: 0,
            duration: 1700,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue21, {
            toValue: 1,
            duration: 2400,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue21, {
            toValue: 0,
            duration: 2400,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue22, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue22, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue23, {
            toValue: 1,
            duration: 2700,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue23, {
            toValue: 0,
            duration: 2700,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue24, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue24, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    
    startAnimations();
  }, []);

  // Check ownership whenever joinedPantry changes
  useEffect(() => {
    if (joinedPantry && Object.keys(pantryOwnership).length > 0) {
      const checkOwnership = async () => {
        const userEmail = await AsyncStorage.getItem('userEmail');
        if (userEmail && pantryOwnership[joinedPantry]) {
          setIsOwner(pantryOwnership[joinedPantry].email === userEmail);
          // Also reload pending requests when we confirm ownership
          loadPendingRequests();
        } else {
          setIsOwner(false);
        }
      };
      checkOwnership();
    }
  }, [joinedPantry, pantryOwnership]);

  const loadProfileImage = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (userEmail) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/get-profile-image`, {
          method: 'POST',
          headers: API_CONFIG.getHeaders(),
          body: JSON.stringify({ email: userEmail }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.profileImage) {
            setProfileImage(data.profileImage);
          }
        }
      }
    } catch (error) {
      console.log('Error loading profile image:', error);
    }
  };

  const selectProfileImage = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: true,
      maxHeight: 500,
      maxWidth: 500,
      quality: 0.8,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        uploadProfileImage(response.assets[0]);
      }
    });
  };

  const uploadProfileImage = async (imageAsset) => {
    try {
      setUploadingImage(true);
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      if (!userEmail) {
        Alert.alert('Error', 'Please sign in again');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/upload-profile-image`, {
        method: 'POST',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': userEmail
        },
        body: JSON.stringify({
          profileImage: `data:${imageAsset.type};base64,${imageAsset.base64}`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfileImage(data.profileImage);
        // Update the profile image in the parent component (App.js)
        if (onProfileImageUpdate) {
          onProfileImageUpdate(data.profileImage);
        }
        Alert.alert('Success', 'Profile image updated successfully!');
      } else {
        const errorData = await response.text();
        console.error('Upload failed:', response.status, errorData);
        throw new Error(`Upload failed: ${response.status} - ${errorData || 'Server error'}`);
      }
    } catch (error) {
      console.error('Error uploading profile image:', error);
      Alert.alert('Error', 'Failed to update profile image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const loadJoinedPantry = async () => {
    try {
      // First check if user already has a pantry in the backend
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (userEmail) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/get-user-pantry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ email: userEmail }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.pantryName) {
            setJoinedPantry(data.pantryName);
            // Also update local storage to sync
            await AsyncStorage.setItem('joinedPantry', data.pantryName);
            loadPantryOwnership(); // Reload ownership info
            return;
          }
        }
      }
      
      // Fallback to local storage if backend doesn't have pantry info
      const pantry = await AsyncStorage.getItem('joinedPantry');
      if (pantry) {
        setJoinedPantry(pantry);
        loadPantryOwnership(); // Reload ownership info
      }
    } catch (error) {
      console.error('Error loading joined pantry:', error);
    }
  };

  const searchPantries = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setAvailablePantries([]);
      return;
    }
    
    setLoadingPantries(true);
    try {
      // Fetch available pantries from backend users.json
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_AVAILABLE_PANTRIES}`, {
        method: 'GET',
        headers: API_CONFIG.getHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Available pantries from backend:', data);
        
        if (data.pantries && Array.isArray(data.pantries)) {
          setAvailablePantries(data.pantries);
        } else {
          setAvailablePantries([]);
        }
      } else {
        console.warn('Failed to fetch pantries from backend');
        setAvailablePantries([]);
      }
    } catch (error) {
      console.log('Could not load pantries from backend:', error);
      setAvailablePantries([]);
    } finally {
      setLoadingPantries(false);
    }
  };

  const loadAvailablePantries = async () => {
    // This function is now only called on component mount for initial setup
    // Actual pantry search happens in searchPantries
  };

  const loadUserPreferences = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (userEmail) {
        // Load local user data to get google_user flag
        const localUserData = await AsyncStorage.getItem('userData');
        const localUser = localUserData ? JSON.parse(localUserData) : {};
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/get-user-pantry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ email: userEmail }),
        });
        
        if (response.ok) {
          const data = await response.json();
          // Merge local data (like google_user flag) with backend data
          setUserInfo({ ...data, google_user: localUser.google_user || false });
          setSelectedDiets(data.diets || []);
          setSelectedCuisines(data.cuisines || []);
        }
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const updateUserPreferences = async (diets, cuisines) => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (userEmail) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/update-user-preferences`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ 
            email: userEmail,
            diets: diets,
            cuisines: cuisines
          }),
        });
        
        if (response.ok) {
          console.log('Successfully updated user preferences');
        } else {
          console.warn('Failed to update user preferences in backend');
        }
      }
    } catch (error) {
      console.error('Error updating user preferences:', error);
    }
  };

  const toggleDiet = (diet) => {
    const newDiets = selectedDiets.includes(diet)
      ? selectedDiets.filter(d => d !== diet)
      : [...selectedDiets, diet];
    
    setSelectedDiets(newDiets);
    updateUserPreferences(newDiets, selectedCuisines);
  };

  const toggleCuisine = (cuisine) => {
    const newCuisines = selectedCuisines.includes(cuisine)
      ? selectedCuisines.filter(c => c !== cuisine)
      : [...selectedCuisines, cuisine];
    
    setSelectedCuisines(newCuisines);
    updateUserPreferences(selectedDiets, newCuisines);
  };

  const handleSuspendAccount = () => {
    Alert.alert(
      'Suspend Account',
      'Are you sure you want to suspend your account? You can reactivate it by signing in again.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setAccountActionLoading(true);
            try {
              const userEmail = await AsyncStorage.getItem('userEmail');
              const response = await fetch(`${API_CONFIG.BASE_URL}/suspend-account`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({ email: userEmail }),
              });
              
              if (response.ok) {
                Alert.alert('Account Suspended', 'Your account has been suspended. You can reactivate it by signing in again.', [
                  { text: 'OK', onPress: () => {
                    setShowAccountModal(false);
                    onSignout();
                  }}
                ]);
              } else {
                Alert.alert('Error', 'Failed to suspend account. Please try again.');
              }
            } catch (error) {
              console.error('Error suspending account:', error);
              Alert.alert('Error', 'Failed to suspend account. Please try again.');
            } finally {
              setAccountActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'This will permanently delete your account and ALL your data. Are you absolutely sure?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    setAccountActionLoading(true);
                    try {
                      const userEmail = await AsyncStorage.getItem('userEmail');
                      const response = await fetch(`${API_CONFIG.BASE_URL}/delete-account`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'ngrok-skip-browser-warning': 'true',
                        },
                        body: JSON.stringify({ email: userEmail }),
                      });
                      
                      if (response.ok) {
                        Alert.alert('Account Deleted', 'Your account has been permanently deleted.', [
                          { text: 'OK', onPress: () => {
                            setShowAccountModal(false);
                            onSignout();
                          }}
                        ]);
                      } else {
                        Alert.alert('Error', 'Failed to delete account. Please try again.');
                      }
                    } catch (error) {
                      console.error('Error deleting account:', error);
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                    } finally {
                      setAccountActionLoading(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleJoinPantry = async () => {
    if (!pantryName.trim()) {
      Alert.alert('Error', 'Please enter a pantry name');
      return;
    }

    setLoading(true);
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) {
        Alert.alert('Error', 'Please sign in again');
        return;
      }

      // Check if this pantry already exists (has members)
      const isExistingPantry = availablePantries.some(
        pantry => pantry.toLowerCase() === pantryName.trim().toLowerCase()
      );

      if (isExistingPantry) {
        // Submit join request for existing pantry
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REQUEST_PANTRY_JOIN}`, {
          method: 'POST',
          headers: API_CONFIG.getHeaders(),
          body: JSON.stringify({
            email: userEmail,
            pantryName: pantryName.trim(),
            name: user?.name || userEmail.split('@')[0]
          }),
        });

        if (response.ok) {
          const responseData = await response.json();
          setShowJoinPantry(false);
          setPantryName('');
          
          if (responseData.isOwner) {
            // User is the owner, they've been added directly
            await AsyncStorage.setItem('joinedPantry', pantryName.trim());
            setJoinedPantry(pantryName.trim());
            
            // Update the stored userData to include the pantry
            const storedUserData = await AsyncStorage.getItem('userData');
            if (storedUserData) {
              const userData = JSON.parse(storedUserData);
              userData.pantryName = pantryName.trim();
              await AsyncStorage.setItem('userData', JSON.stringify(userData));
            }
            
            Alert.alert('Welcome Back!', responseData.message || `You are now back in your pantry "${pantryName.trim()}"!`);
            loadPantryOwnership(); // Refresh ownership data
          } else {
            // Regular join request submitted
            Alert.alert(
              'Request Submitted', 
              'Your join request has been sent to the pantry members. You will be notified when they respond.',
              [{ text: 'OK', onPress: () => loadUserRequests() }]
            );
          }
        } else {
          const errorData = await response.json();
          Alert.alert('Error', errorData.error || 'Failed to submit join request');
        }
      } else {
        // Pantry doesn't exist - show error
        Alert.alert(
          'Pantry Not Found', 
          `The pantry "${pantryName.trim()}" doesn't exist. Please check the name or create a new pantry from the Pantry page.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error with pantry operation:', error);
      Alert.alert('Error', 'Failed to process request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeavePantry = () => {
    Alert.alert(
      'Leave Pantry',
      `Are you sure you want to leave "${joinedPantry}" pantry?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from local storage
              await AsyncStorage.removeItem('joinedPantry');
              
              // Update backend to clear pantry name
              const userEmail = await AsyncStorage.getItem('userEmail');
              if (userEmail) {
                try {
                  const response = await fetch(`${API_CONFIG.BASE_URL}/update-user-pantry`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'ngrok-skip-browser-warning': 'true',
                    },
                    body: JSON.stringify({
                      email: userEmail,
                      pantryName: '' // Clear the pantry name
                    }),
                  });
                  
                  if (response.ok) {
                    console.log('Successfully cleared pantry name in backend');
                  } else {
                    console.warn('Failed to clear pantry name in backend');
                  }
                } catch (backendError) {
                  console.warn('Backend update failed:', backendError);
                }
              }
              
              setJoinedPantry(null);
              Alert.alert('Success', 'You have left the pantry');
            } catch (error) {
              console.error('Error leaving pantry:', error);
              Alert.alert('Error', 'Failed to leave pantry');
            }
          },
        },
      ]
    );
  };

  const handleSignout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            onSignout();
          },
        },
      ],
      { cancelable: false }
    );
  };

  const handleEditAccount = () => {
    setEditName(user?.name || '');
    setShowEditAccountModal(true);
  };

  const updateAccountInfo = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      setUpdatingAccount(true);
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      // Update backend first
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_ACCOUNT}`, {
        method: 'POST',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': userEmail
        },
        body: JSON.stringify({ name: editName.trim() }),
      });
      
      if (response.ok) {
        // Update local storage
        const updatedUser = {
          email: userEmail,
          name: editName.trim()
        };
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
        
        // Update the current user state immediately
        if (typeof user === 'object') {
          user.name = editName.trim();
        }
        
        // Update the userInfo state to reflect changes immediately
        setUserInfo(prev => prev ? { ...prev, name: editName.trim() } : null);
        
        setShowEditAccountModal(false);
        Alert.alert('Success', 'Name updated successfully in backend!');
      } else {
        const errorText = await response.text();
        console.error('Backend update failed:', errorText);
        Alert.alert('Error', 'Failed to update name in backend. Please try again.');
      }
      
    } catch (error) {
      console.error('Error updating account:', error);
      Alert.alert('Error', 'Failed to update account. Please try again.');
    } finally {
      setUpdatingAccount(false);
    }
  };

  const updatePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    // For Google users, current password is not required
    const isGoogleUser = userInfo?.google_user || false;

    if (!isGoogleUser && !currentPassword.trim()) {
      Alert.alert('Error', 'Current password is required');
      return;
    }

    try {
      setUpdatingAccount(true);
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      const requestBody = {
        newPassword: newPassword.trim(),
        ...(isGoogleUser ? {} : { currentPassword: currentPassword.trim() })
      };

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_PASSWORD}`, {
        method: 'POST',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': userEmail
        },
        body: JSON.stringify(requestBody),
      });
      
      if (response.ok) {
        // Clear password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordSection(false);
        
        Alert.alert('Success', 'Password updated successfully!');
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to update password. Please try again.');
      }
      
    } catch (error) {
      console.error('Error updating password:', error);
      Alert.alert('Error', 'Failed to update password. Please try again.');
    } finally {
      setUpdatingAccount(false);
    }
  };

  const loadPantryUsers = async () => {
    console.log('DEBUG: loadPantryUsers called, joinedPantry =', joinedPantry);
    if (!joinedPantry) {
      console.log('DEBUG: No joinedPantry, returning early');
      return;
    }
    
    try {
      setLoadingPantryUsers(true);
      
      // Get all users from backend
      const response = await fetch(`${API_CONFIG.BASE_URL}/get-users`, {
        method: 'GET',
        headers: API_CONFIG.getHeaders(),
      });
      
      console.log('DEBUG: response.ok =', response.ok, 'status =', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('DEBUG: response data =', data);
        const allUsers = data.users || {};
        
        // Filter users who are in the same pantry
        const usersInPantry = [];
        console.log('DEBUG: joinedPantry =', joinedPantry);
        console.log('DEBUG: allUsers =', Object.keys(allUsers));
        for (const [email, userData] of Object.entries(allUsers)) {
          const userPantryName = (userData.pantryName || '').trim();
          const currentPantryName = (joinedPantry || '').trim();
          console.log(`DEBUG: Checking ${email}, pantryName: "${userPantryName}", joinedPantry: "${currentPantryName}", match: ${userPantryName === currentPantryName}`);
          if (userPantryName === currentPantryName && userPantryName !== '') {
            // Get profile image for each user
            try {
              const imageResponse = await fetch(`${API_CONFIG.BASE_URL}/get-profile-image`, {
                method: 'POST',
                headers: API_CONFIG.getHeaders(),
                body: JSON.stringify({ email }),
              });
              
              let profileImage = null;
              if (imageResponse.ok) {
                const imageData = await imageResponse.json();
                profileImage = imageData.profileImage;
              }
              
              usersInPantry.push({
                email,
                name: userData.name || email.split('@')[0],
                profileImage,
                isCurrentUser: email === user?.email,
              });
            } catch (err) {
              console.error(`Error loading image for ${email}:`, err);
              usersInPantry.push({
                email,
                name: userData.name || email.split('@')[0],
                profileImage: null,
                isCurrentUser: email === user?.email,
              });
            }
          }
        }
        
        // Sort to put current user first
        usersInPantry.sort((a, b) => {
          if (a.isCurrentUser) return -1;
          if (b.isCurrentUser) return 1;
          return a.name.localeCompare(b.name);
        });
        
        console.log('DEBUG: Final usersInPantry =', usersInPantry);
        setPantryUsers(usersInPantry);
      }
    } catch (error) {
      console.error('Error loading pantry users:', error);
      Alert.alert('Error', 'Failed to load pantry users');
    } finally {
      setLoadingPantryUsers(false);
    }
  };

  const showPantryUsersHandler = () => {
    console.log('DEBUG: showPantryUsersHandler called, joinedPantry =', joinedPantry);
    if (!joinedPantry || joinedPantry.trim() === '') {
      Alert.alert('Please wait', 'Loading pantry information...');
      return;
    }
    setShowPantryUsersModal(true);
    loadPantryUsers();
  };

  const loadPendingRequests = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) return;

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_PANTRY_REQUESTS}`, {
        method: 'GET',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': userEmail,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const loadUserRequests = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) return;

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_USER_REQUESTS}`, {
        method: 'GET',
        headers: {
          ...API_CONFIG.getHeaders(),
          'X-User-Email': userEmail,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading user requests:', error);
    }
  };

  const handleRequestResponse = async (requestId, action) => {
    try {
      setLoadingRequests(true);
      const userEmail = await AsyncStorage.getItem('userEmail');

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RESPOND_PANTRY_REQUEST}`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          requestId,
          action,
          email: userEmail,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success', data.message);
        loadPendingRequests(); // Refresh the list
        if (data.status === 'approved') {
          loadJoinedPantry(); // Refresh pantry info if someone was approved
        }
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to respond to request');
      }
    } catch (error) {
      console.error('Error responding to request:', error);
      Alert.alert('Error', 'Failed to respond to request');
    } finally {
      setLoadingRequests(false);
    }
  };

  const showRequestsHandler = () => {
    setShowRequestsModal(true);
    loadPendingRequests();
    loadUserRequests();
  };

  const loadPantryOwnership = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_PANTRY_OWNERSHIP}`, {
        method: 'GET',
        headers: API_CONFIG.getHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setPantryOwnership(data.owners || {});
        
        // Check if current user is owner of their current pantry
        const userEmail = await AsyncStorage.getItem('userEmail');
        if (userEmail && joinedPantry && data.owners && data.owners[joinedPantry]) {
          setIsOwner(data.owners[joinedPantry].email === userEmail);
        } else {
          setIsOwner(false);
        }
      }
    } catch (error) {
      console.error('Error loading pantry ownership:', error);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section - Full width like pantry header */}
      <View style={styles.meHeaderSection}>
        {/* Gradient-like overlay elements */}
        <View style={styles.meGradientOverlay1} />
        <View style={styles.meGradientOverlay2} />
        <View style={styles.meGradientOverlay3} />
        
        {/* Animated Background Circles */}
        <Animated.View style={[
          styles.meBackgroundCircle1,
          {
            transform: [
              {
                translateY: animatedValue1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -15],
                }),
              },
            ],
            opacity: animatedValue1.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.3, 0.6, 0.3],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meBackgroundCircle2,
          {
            transform: [
              {
                translateX: animatedValue2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20],
                }),
              },
            ],
            opacity: animatedValue2.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.2, 0.5, 0.2],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meBackgroundCircle3,
          {
            transform: [
              {
                translateY: animatedValue3.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 10],
                }),
              },
              {
                rotate: animatedValue3.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
            opacity: animatedValue3.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.1, 0.4, 0.1],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meBackgroundCircle4,
          {
            transform: [
              {
                translateX: animatedValue4.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -25],
                }),
              },
              {
                scale: animatedValue4.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 1.2, 1],
                }),
              },
            ],
            opacity: animatedValue4.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.2, 0.4, 0.2],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meBackgroundCircle5,
          {
            transform: [
              {
                translateY: animatedValue5.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -20],
                }),
              },
              {
                rotate: animatedValue5.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '-180deg'],
                }),
              },
            ],
            opacity: animatedValue5.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.15, 0.35, 0.15],
            }),
          },
        ]} />
        
        {/* Additional Bubble Circles */}
        <Animated.View style={[
          styles.meBubbleCircle1,
          {
            transform: [
              {
                translateY: animatedValue6.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -30],
                }),
              },
              {
                scale: animatedValue6.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.8, 1.1, 0.8],
                }),
              },
            ],
            opacity: animatedValue6.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.1, 0.3, 0.1],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meBubbleCircle2,
          {
            transform: [
              {
                translateX: animatedValue7.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 15],
                }),
              },
              {
                translateY: animatedValue7.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                }),
              },
            ],
            opacity: animatedValue7.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.08, 0.25, 0.08],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meBubbleCircle3,
          {
            transform: [
              {
                rotate: animatedValue8.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '120deg'],
                }),
              },
              {
                scale: animatedValue8.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 1.3, 1],
                }),
              },
            ],
            opacity: animatedValue8.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.05, 0.2, 0.05],
            }),
          },
        ]} />
        
        {/* More Small Bubble Circles */}
        <Animated.View style={[
          styles.meBubbleCircle4,
          {
            transform: [
              {
                translateY: animatedValue9.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -35],
                }),
              },
              {
                scale: animatedValue9.interpolate({
                  inputRange: [0, 0.3, 0.7, 1],
                  outputRange: [0.6, 1, 0.8, 0.6],
                }),
              },
            ],
            opacity: animatedValue9.interpolate({
              inputRange: [0, 0.4, 0.8, 1],
              outputRange: [0.05, 0.2, 0.15, 0.05],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meBubbleCircle5,
          {
            transform: [
              {
                translateX: animatedValue10.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -20],
                }),
              },
              {
                rotate: animatedValue10.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '90deg'],
                }),
              },
            ],
            opacity: animatedValue10.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.03, 0.15, 0.03],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meBubbleCircle6,
          {
            transform: [
              {
                translateY: animatedValue11.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 12],
                }),
              },
              {
                scale: animatedValue11.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.9, 1.4, 0.9],
                }),
              },
            ],
            opacity: animatedValue11.interpolate({
              inputRange: [0, 0.3, 0.7, 1],
              outputRange: [0.08, 0.25, 0.18, 0.08],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meBubbleCircle7,
          {
            transform: [
              {
                translateX: animatedValue12.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 18],
                }),
              },
              {
                translateY: animatedValue12.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -25],
                }),
              },
              {
                rotate: animatedValue12.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '-45deg'],
                }),
              },
            ],
            opacity: animatedValue12.interpolate({
              inputRange: [0, 0.4, 0.9, 1],
              outputRange: [0.04, 0.18, 0.12, 0.04],
            }),
          },
        ]} />
        
        {/* Even More Tiny Bubble Circles */}
        <Animated.View style={[
          styles.meTinyBubble1,
          {
            transform: [
              {
                translateY: animatedValue13.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -40],
                }),
              },
              {
                scale: animatedValue13.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0.5, 1.2, 0.7, 0.5],
                }),
              },
            ],
            opacity: animatedValue13.interpolate({
              inputRange: [0, 0.3, 0.7, 1],
              outputRange: [0.02, 0.15, 0.08, 0.02],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meTinyBubble2,
          {
            transform: [
              {
                translateX: animatedValue14.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 30],
                }),
              },
              {
                rotate: animatedValue14.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
            opacity: animatedValue14.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.03, 0.12, 0.03],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meTinyBubble3,
          {
            transform: [
              {
                translateY: animatedValue15.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20],
                }),
              },
              {
                scale: animatedValue15.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.8, 1.5, 0.8],
                }),
              },
            ],
            opacity: animatedValue15.interpolate({
              inputRange: [0, 0.4, 0.9, 1],
              outputRange: [0.04, 0.18, 0.10, 0.04],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meTinyBubble4,
          {
            transform: [
              {
                translateX: animatedValue16.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -15],
                }),
              },
              {
                translateY: animatedValue16.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -30],
                }),
              },
            ],
            opacity: animatedValue16.interpolate({
              inputRange: [0, 0.6, 1],
              outputRange: [0.05, 0.20, 0.05],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meTinyBubble5,
          {
            transform: [
              {
                rotate: animatedValue17.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '-270deg'],
                }),
              },
              {
                scale: animatedValue17.interpolate({
                  inputRange: [0, 0.3, 0.7, 1],
                  outputRange: [1, 0.6, 1.3, 1],
                }),
              },
            ],
            opacity: animatedValue17.interpolate({
              inputRange: [0, 0.4, 0.8, 1],
              outputRange: [0.06, 0.22, 0.14, 0.06],
            }),
          },
        ]} />
        
        {/* ULTIMATE EXTRA BUBBLE CIRCLES! */}
        <Animated.View style={[
          styles.meUltraBubble1,
          {
            transform: [
              {
                translateY: animatedValue18.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -50],
                }),
              },
              {
                scale: animatedValue18.interpolate({
                  inputRange: [0, 0.1, 0.4, 0.7, 1],
                  outputRange: [0.3, 1.5, 0.8, 1.2, 0.3],
                }),
              },
            ],
            opacity: animatedValue18.interpolate({
              inputRange: [0, 0.2, 0.8, 1],
              outputRange: [0.01, 0.12, 0.08, 0.01],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meUltraBubble2,
          {
            transform: [
              {
                translateX: animatedValue19.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 35],
                }),
              },
              {
                rotate: animatedValue19.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
            opacity: animatedValue19.interpolate({
              inputRange: [0, 0.3, 0.9, 1],
              outputRange: [0.02, 0.15, 0.10, 0.02],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meUltraBubble3,
          {
            transform: [
              {
                translateY: animatedValue20.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 25],
                }),
              },
              {
                scale: animatedValue20.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.6, 1.8, 0.6],
                }),
              },
            ],
            opacity: animatedValue20.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0.03, 0.18, 0.03],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meUltraBubble4,
          {
            transform: [
              {
                translateX: animatedValue21.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -40],
                }),
              },
              {
                translateY: animatedValue21.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -20],
                }),
              },
              {
                rotate: animatedValue21.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '-150deg'],
                }),
              },
            ],
            opacity: animatedValue21.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.04, 0.20, 0.04],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meUltraBubble5,
          {
            transform: [
              {
                scale: animatedValue22.interpolate({
                  inputRange: [0, 0.2, 0.6, 0.9, 1],
                  outputRange: [0.4, 1.3, 0.7, 1.6, 0.4],
                }),
              },
              {
                rotate: animatedValue22.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '720deg'],
                }),
              },
            ],
            opacity: animatedValue22.interpolate({
              inputRange: [0, 0.3, 0.7, 1],
              outputRange: [0.05, 0.25, 0.15, 0.05],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meUltraBubble6,
          {
            transform: [
              {
                translateY: animatedValue23.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -35],
                }),
              },
              {
                translateX: animatedValue23.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20],
                }),
              },
            ],
            opacity: animatedValue23.interpolate({
              inputRange: [0, 0.4, 0.8, 1],
              outputRange: [0.02, 0.14, 0.09, 0.02],
            }),
          },
        ]} />
        
        <Animated.View style={[
          styles.meUltraBubble7,
          {
            transform: [
              {
                scale: animatedValue24.interpolate({
                  inputRange: [0, 0.3, 0.7, 1],
                  outputRange: [0.2, 1.4, 0.9, 0.2],
                }),
              },
              {
                translateY: animatedValue24.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -45],
                }),
              },
            ],
            opacity: animatedValue24.interpolate({
              inputRange: [0, 0.2, 0.6, 1],
              outputRange: [0.06, 0.22, 0.16, 0.06],
            }),
          },
        ]} />
        
        <View style={styles.profileSection}>
          <View style={styles.profileWallpaper}>
            {/* Join Requests Notification Badge */}
            {isOwner && pendingRequests.length > 0 && (
              <TouchableOpacity 
                style={styles.profileNotificationBadge}
                onPress={showRequestsHandler}
                activeOpacity={0.7}
              >
                <Text style={styles.profileNotificationText}>!</Text>
                <Text style={styles.profileNotificationCount}>{pendingRequests.length}</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.avatar}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {(user?.name || userInfo?.name || user?.email?.charAt(0) || 'U').charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={styles.userName}>{userInfo?.name || user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{userInfo?.email || user?.email || 'user@example.com'}</Text>
            
            {/* Pantry Owner Status */}
            {isOwner && joinedPantry && (
              <Text style={styles.pantryOwnerBadge}>Pantry Owner • {joinedPantry}</Text>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Dietary Preferences Section */}
        <View style={styles.preferencesSection}>
          <Text style={styles.sectionTitle}>Dietary Preferences</Text>
          <View style={styles.preferencesGrid}>
            {['None', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Low-Carb', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Lactose-Free', 'Diabetic', 'Halal'].map((diet) => (
              <TouchableOpacity
                key={diet}
                style={[
                  styles.preferenceButton,
                  selectedDiets.includes(diet) && styles.preferenceButtonSelected
                ]}
                onPress={() => toggleDiet(diet)}
              >
                <Text style={[
                  styles.preferenceButtonText,
                  selectedDiets.includes(diet) && styles.preferenceButtonTextSelected
                ]}>
                  {diet}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Favorite Cuisines Section */}
        <View style={styles.preferencesSection}>
          <Text style={styles.sectionTitle}>Favorite Cuisines</Text>
          <View style={styles.preferencesGrid}>
            {[
              { name: 'Italian', emoji: '🇮🇹' },
              { name: 'Mexican', emoji: '🇲🇽' },
              { name: 'Asian', emoji: '🥢' },
              { name: 'Indian', emoji: '🇮🇳' },
              { name: 'American', emoji: '🇺🇸' },
              { name: 'French', emoji: '🇫🇷' },
              { name: 'Japanese', emoji: '🇯🇵' },
              { name: 'Thai', emoji: '🇹🇭' },
              { name: 'Chinese', emoji: '🇨🇳' },
              { name: 'Middle Eastern', emoji: '🧆' },
              { name: 'Spanish', emoji: '🇪🇸' }
            ].map((cuisine) => (
              <TouchableOpacity
                key={cuisine.name}
                style={[
                  styles.cuisineButton,
                  selectedCuisines.includes(cuisine.name) && styles.cuisineButtonSelected
                ]}
                onPress={() => toggleCuisine(cuisine.name)}
              >
                <Text style={styles.cuisineEmoji}>{cuisine.emoji}</Text>
                <Text style={[
                  styles.cuisineButtonText,
                  selectedCuisines.includes(cuisine.name) && styles.cuisineButtonTextSelected
                ]}>
                  {cuisine.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Settings Options */}
        <View style={styles.settingsSection}>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleEditAccount}
          >
            <View style={styles.settingIconContainer}>
              <Text style={styles.settingIconText}>Edit</Text>
            </View>
            <Text style={styles.settingLabel}>Edit Account</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setShowChartsModal(true)}
          >
            <View style={styles.settingIconContainer}>
              <Text style={styles.settingIconText}>Charts</Text>
            </View>
            <Text style={styles.settingLabel}>Pantry Charts</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>

          {/* Manage Join Requests - Only show for pantry owners */}
          {isOwner && joinedPantry && (
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={showRequestsHandler}
            >
              <View style={styles.settingIconContainer}>
                <Text style={styles.settingIconText}>Requests</Text>
              </View>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Manage Join Requests</Text>
                {pendingRequests.length > 0 && (
                  <View style={styles.requestBadge}>
                    <Text style={styles.requestBadgeText}>{pendingRequests.length}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setShowAboutModal(true)}
          >
            <View style={styles.settingIconContainer}>
              <Text style={styles.settingIconText}>About</Text>
            </View>
            <Text style={styles.settingLabel}>About Mireva</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>

        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutSection}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignout}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
      
      {/* About Mireva Modal */}
      <Modal
        visible={showAboutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.aboutModal}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowAboutModal(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            
            <Image
              source={images.mirevaLogo}
              style={styles.modalLogo}
            />
            
            <Text style={styles.modalTitle}>Mireva</Text>
            <Text style={styles.modalSubtitle}>Smart Pantry Management</Text>
            
            <Text style={styles.modalDescription}>
              Mireva - the intelligent pantry management app that helps you organize ingredients, reduce food waste, and discover amazing recipes.
            </Text>
            
            <View style={styles.modalFeatures}>
              <Text style={styles.featureItem}>• Smart ingredient tracking</Text>
              <Text style={styles.featureItem}>• AI-powered item scanning</Text>
              <Text style={styles.featureItem}>• Family pantry sharing</Text>
              <Text style={styles.featureItem}>• Personalized meal suggestions</Text>
            </View>
            
            <Text style={styles.modalFooter}>Made with care for food lovers</Text>
          </View>
        </View>
      </Modal>
      
      
      {/* Edit Account Modal */}
      <Modal
        visible={showEditAccountModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Account</Text>
            
            <View style={styles.editFormSection}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#A0AEC0"
                value={editName}
                onChangeText={setEditName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.editFormSection}>
              <Text style={styles.inputLabel}>Profile Photo</Text>
              <TouchableOpacity style={styles.photoEditButton} onPress={selectProfileImage}>
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>{(editName || 'U').charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.photoEditText}>Tap to change photo</Text>
              </TouchableOpacity>
            </View>

            {/* Password Section */}
            <View style={styles.editFormSection}>
              <TouchableOpacity 
                style={styles.passwordSectionHeader}
                onPress={() => setShowPasswordSection(!showPasswordSection)}
              >
                <Text style={styles.inputLabel}>Password</Text>
                <Text style={styles.passwordToggleIcon}>
                  {showPasswordSection ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
              
              {showPasswordSection && (
                <View style={styles.passwordSection}>
                  {!userInfo?.google_user && (
                    <View style={styles.passwordInputContainer}>
                      <Text style={styles.passwordInputLabel}>Current Password</Text>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Enter current password"
                        placeholderTextColor="#A0AEC0"
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  )}
                  
                  <View style={styles.passwordInputContainer}>
                    <Text style={styles.passwordInputLabel}>New Password</Text>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter new password (min 6 characters)"
                      placeholderTextColor="#A0AEC0"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  
                  <View style={styles.passwordInputContainer}>
                    <Text style={styles.passwordInputLabel}>Confirm New Password</Text>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Confirm new password"
                      placeholderTextColor="#A0AEC0"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <TouchableOpacity 
                    style={[styles.updatePasswordButton, updatingAccount && styles.updatePasswordButtonDisabled]} 
                    onPress={updatePassword}
                    disabled={updatingAccount}
                  >
                    {updatingAccount ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.updatePasswordButtonText}>Update Password</Text>
                    )}
                  </TouchableOpacity>

                  {userInfo?.google_user && (
                    <Text style={styles.googleUserNote}>
                      💡 As a Google user, you can set a password to also sign in with email/password
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Account Actions Section */}
            <View style={styles.editFormSection}>
              <Text style={styles.inputLabel}>Account Actions</Text>
              <View style={styles.accountActionsInEdit}>
                <TouchableOpacity 
                  style={styles.suspendButtonInEdit}
                  onPress={handleSuspendAccount}
                  disabled={accountActionLoading}
                >
                  {accountActionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <View style={styles.actionButtonIconSmall}>
                        <Text style={styles.actionButtonIconTextSmall}>Pause</Text>
                      </View>
                      <View style={styles.actionTextContainerSmall}>
                        <Text style={styles.suspendButtonTextSmall}>Suspend Account</Text>
                        <Text style={styles.suspendButtonDescriptionSmall}>Temporarily deactivate</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.deleteButtonInEdit}
                  onPress={handleDeleteAccount}
                  disabled={accountActionLoading}
                >
                  {accountActionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <View style={styles.actionButtonIconSmall}>
                        <Text style={styles.actionButtonIconTextSmall}>DELETE</Text>
                      </View>
                      <View style={styles.actionTextContainerSmall}>
                        <Text style={styles.deleteButtonTextSmall}>Delete Account</Text>
                        <Text style={styles.deleteButtonDescriptionSmall}>Permanently remove</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.accountWarningInEdit}>
                ⚠️ These actions are permanent. Please be certain before proceeding.
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => setShowEditAccountModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSaveButton, updatingAccount && styles.modalSaveButtonDisabled]} 
                onPress={updateAccountInfo}
                disabled={updatingAccount}
              >
                {updatingAccount ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Charts Modal */}
      <Modal
        visible={showChartsModal}
        animationType="slide"
        onRequestClose={() => setShowChartsModal(false)}
      >
        <ChartsScreen navigation={{ goBack: () => setShowChartsModal(false) }} />
      </Modal>

      {/* Pantry Users Modal */}
      <Modal
        visible={showPantryUsersModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPantryUsersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pantryUsersModal}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowPantryUsersModal(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.pantryUsersTitle}>{joinedPantry}</Text>
            <Text style={styles.pantryUsersSubtitle}>Pantry Members</Text>
            
            {loadingPantryUsers ? (
              <View style={styles.pantryUsersLoadingContainer}>
                <ActivityIndicator size="large" color="#2D6A4F" />
                <Text style={styles.pantryUsersLoadingText}>Loading members...</Text>
              </View>
            ) : (
              <ScrollView style={styles.pantryUsersList}>
                {pantryUsers.map((member, index) => (
                  <View key={member.email} style={styles.pantryUserItem}>
                    <View style={styles.pantryUserAvatar}>
                      {member.profileImage ? (
                        <Image source={{ uri: member.profileImage }} style={styles.pantryUserAvatarImage} />
                      ) : (
                        <Text style={styles.pantryUserAvatarText}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                      {member.isCurrentUser && (
                        <View style={styles.currentUserBadge}>
                          <Text style={styles.currentUserBadgeText}>You</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.pantryUserInfo}>
                      <Text style={styles.pantryUserName}>{member.name}</Text>
                      <Text style={styles.pantryUserEmail}>{member.email}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <View style={styles.pantryUsersSummary}>
              <Text style={styles.pantryUsersSummaryText}>
                {pantryUsers.length} {pantryUsers.length === 1 ? 'member' : 'members'} in this pantry
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pantry Requests Modal */}
      <Modal
        visible={showRequestsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRequestsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestsModal}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowRequestsModal(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.requestsModalTitle}>Pantry Requests</Text>
            
            <ScrollView style={styles.requestsScrollView}>
              {/* Pending Requests for Approval */}
              {pendingRequests.length > 0 && (
                <View style={styles.requestsSection}>
                  <Text style={styles.requestsSectionTitle}>Requests to Approve</Text>
                  {pendingRequests.map((request) => (
                    <View key={request.id} style={styles.requestItem}>
                      <View style={styles.requestInfo}>
                        <Text style={styles.requestName}>{request.requesterName}</Text>
                        <Text style={styles.requestEmail}>{request.requesterEmail}</Text>
                        <Text style={styles.requestDate}>
                          Requested: {new Date(request.requestedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity 
                          style={styles.approveButton}
                          onPress={() => handleRequestResponse(request.id, 'approve')}
                          disabled={loadingRequests}
                        >
                          <Text style={styles.approveButtonText}>✓ Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.rejectButton}
                          onPress={() => handleRequestResponse(request.id, 'reject')}
                          disabled={loadingRequests}
                        >
                          <Text style={styles.rejectButtonText}>✗ Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* User's Own Requests */}
              {userRequests.length > 0 && (
                <View style={styles.requestsSection}>
                  <Text style={styles.requestsSectionTitle}>Your Requests</Text>
                  {userRequests.map((request) => (
                    <View key={request.id} style={styles.userRequestItem}>
                      <Text style={styles.userRequestPantry}>{request.pantryName}</Text>
                      <Text style={styles.userRequestStatus}>
                        Status: {request.status === 'pending' ? '⏳ Pending' : 
                                request.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                      </Text>
                      <Text style={styles.userRequestDate}>
                        Requested: {new Date(request.requestedAt).toLocaleDateString()}
                      </Text>
                      {request.status === 'pending' && (
                        <Text style={styles.userRequestProgress}>
                          Approvals: {request.approvals?.length || 0} / {Math.ceil((request.pantryMembers?.length || 1) / 2)}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {pendingRequests.length === 0 && userRequests.length === 0 && (
                <View style={styles.noRequestsContainer}>
                  <Text style={styles.noRequestsText}>No pending requests</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  // Header Section - Full width edge-to-edge
  meHeaderSection: {
    height: 160,
    backgroundColor: '#0F3B2F',
    background: 'linear-gradient(135deg, #064E3B 0%, #052E22 50%, #041F17 100%)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 0,
    marginTop: 0,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
    borderRadius: 0,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meGradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6, 78, 59, 0.9)',
    zIndex: 1,
  },
  meGradientOverlay2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 46, 34, 0.6)',
    zIndex: 2,
  },
  meGradientOverlay3: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4, 31, 23, 0.3)',
    zIndex: 3,
  },
  // Animated Background Circles for Me Header
  meBackgroundCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
  },
  meBackgroundCircle2: {
    position: 'absolute',
    bottom: -40,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 1,
  },
  meBackgroundCircle3: {
    position: 'absolute',
    top: 30,
    left: '70%',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    zIndex: 1,
  },
  meBackgroundCircle4: {
    position: 'absolute',
    top: -20,
    left: '30%',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    zIndex: 1,
  },
  meBackgroundCircle5: {
    position: 'absolute',
    bottom: -10,
    right: -15,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    zIndex: 1,
  },
  // Additional Bubble Circles
  meBubbleCircle1: {
    position: 'absolute',
    top: 10,
    left: '15%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
  },
  meBubbleCircle2: {
    position: 'absolute',
    bottom: 20,
    left: '60%',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 1,
  },
  meBubbleCircle3: {
    position: 'absolute',
    top: 50,
    right: '25%',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    zIndex: 1,
  },
  meBubbleCircle4: {
    position: 'absolute',
    top: 5,
    left: '50%',
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    zIndex: 1,
  },
  meBubbleCircle5: {
    position: 'absolute',
    bottom: 5,
    right: '10%',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    zIndex: 1,
  },
  meBubbleCircle6: {
    position: 'absolute',
    top: 35,
    left: '5%',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    zIndex: 1,
  },
  meBubbleCircle7: {
    position: 'absolute',
    bottom: 30,
    right: '45%',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 1,
  },
  // Tiny Bubble Circles
  meTinyBubble1: {
    position: 'absolute',
    top: 15,
    left: '80%',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
  },
  meTinyBubble2: {
    position: 'absolute',
    bottom: 40,
    left: '25%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    zIndex: 1,
  },
  meTinyBubble3: {
    position: 'absolute',
    top: 60,
    left: '40%',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    zIndex: 1,
  },
  meTinyBubble4: {
    position: 'absolute',
    top: 25,
    right: '35%',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    zIndex: 1,
  },
  meTinyBubble5: {
    position: 'absolute',
    bottom: 15,
    right: '20%',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    zIndex: 1,
  },
  // ULTIMATE EXTRA BUBBLE CIRCLES! 🫧✨
  meUltraBubble1: {
    position: 'absolute',
    top: 8,
    left: '90%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 1,
  },
  meUltraBubble2: {
    position: 'absolute',
    bottom: 8,
    left: '8%',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 1,
  },
  meUltraBubble3: {
    position: 'absolute',
    top: 45,
    left: '85%',
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
    zIndex: 1,
  },
  meUltraBubble4: {
    position: 'absolute',
    top: 32,
    left: '12%',
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
  },
  meUltraBubble5: {
    position: 'absolute',
    top: 55,
    left: '55%',
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    zIndex: 1,
  },
  meUltraBubble6: {
    position: 'absolute',
    bottom: 25,
    right: '8%',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    zIndex: 1,
  },
  meUltraBubble7: {
    position: 'absolute',
    top: 18,
    left: '65%',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  profileSection: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    marginBottom: 0,
    marginHorizontal: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 0,
    overflow: 'visible',
    zIndex: 4,
    position: 'relative',
  },
  profileWallpaper: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    position: 'relative',
    zIndex: 5,
  },
  profileNotificationBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF4444',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileNotificationText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  profileNotificationCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    color: '#FF4444',
    fontSize: 10,
    fontWeight: '700',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  pantryOwnerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  userEmail: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '500',
    marginBottom: 12,
  },
  editAccountButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  editAccountButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F7FAFC',
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 15,
    width: 25,
  },
  settingIconContainer: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 15,
    minWidth: 50,
    alignItems: 'center',
  },
  settingIconText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    color: '#2D3748',
  },
  settingLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestBadge: {
    backgroundColor: '#E53E3E',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  requestBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  settingArrow: {
    fontSize: 20,
    color: '#A0AEC0',
  },
  signOutSection: {
    marginBottom: 20,
  },
  signOutButton: {
    backgroundColor: '#E53E3E',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  versionSection: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  versionText: {
    fontSize: 14,
    color: '#A0AEC0',
  },
  pantrySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 15,
  },
  joinedPantryCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    paddingRight: 15,
    borderWidth: 1,
    borderColor: '#81C784',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  pantryInfo: {
    flex: 1,
  },
  pantryLabel: {
    fontSize: 14,
    color: '#2D6A4F',
    marginBottom: 5,
  },
  pantryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D6A4F',
  },
  ownerBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D69E2E',
  },
  pantryTapHint: {
    fontSize: 12,
    color: '#81C784',
    marginTop: 2,
    fontStyle: 'italic',
  },
  leavePantryButton: {
    alignItems: 'center',
  },
  leavePantryIcon: {
    backgroundColor: '#E53E3E',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  leavePantryIconText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  noPantryCard: {
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  noPantryText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 15,
  },
  joinPantryButton: {
    backgroundColor: '#2D6A4F',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  joinPantryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  joinPantryForm: {
    width: '100%',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 15,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 20,
  },
  pantryInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#718096',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#2D6A4F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResults: {
    marginTop: 10,
    marginBottom: 15,
  },
  searchResultItem: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#81C784',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 8,
  },
  searchResultText: {
    color: '#2D6A4F',
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultSubtext: {
    color: '#81C784',
    fontSize: 12,
    marginTop: 2,
  },
  noResultsContainer: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
  },
  createNewText: {
    color: '#2D6A4F',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#2D6A4F',
    fontWeight: '500',
  },
  preferencesSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  preferencesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preferenceButton: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  preferenceButtonSelected: {
    backgroundColor: '#0A4B4C',
    borderColor: '#0A4B4C',
  },
  preferenceButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A5568',
  },
  preferenceButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cuisineButton: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    alignItems: 'center',
    minWidth: 65,
  },
  cuisineButtonSelected: {
    backgroundColor: '#0A4B4C',
    borderColor: '#0A4B4C',
  },
  cuisineEmoji: {
    fontSize: 14,
    marginBottom: 1,
  },
  cuisineButtonText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4A5568',
    textAlign: 'center',
  },
  cuisineButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  aboutModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    maxWidth: 350,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#4A5568',
    fontWeight: 'bold',
  },
  modalLogo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0A4B4C',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#48BB78',
    fontWeight: '600',
    marginBottom: 20,
  },
  modalDescription: {
    fontSize: 15,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  modalFeatures: {
    alignSelf: 'stretch',
    marginBottom: 25,
  },
  featureItem: {
    fontSize: 14,
    color: '#2D3748',
    marginBottom: 8,
    paddingLeft: 10,
  },
  modalFooter: {
    fontSize: 14,
    color: '#48BB78',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  accountActionsInEdit: {
    gap: 12,
    marginBottom: 16,
  },
  suspendButtonInEdit: {
    backgroundColor: '#ED8936',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButtonInEdit: {
    backgroundColor: '#E53E3E',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonIconSmall: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  actionButtonIconTextSmall: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  actionTextContainerSmall: {
    flex: 1,
  },
  suspendButtonTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  deleteButtonTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  suspendButtonDescriptionSmall: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  deleteButtonDescriptionSmall: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  accountWarningInEdit: {
    fontSize: 11,
    color: '#E53E3E',
    textAlign: 'center',
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 8,
  },
  // Edit Account Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  editFormSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#2D3748',
  },
  photoEditButton: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  photoEditText: {
    fontSize: 12,
    color: '#718096',
    marginTop: 8,
  },
  photoPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  photoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  photoPlaceholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  photoEditText: {
    fontSize: 14,
    color: '#2D6A4F',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Pantry Users Modal Styles
  pantryUsersModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    maxWidth: 400,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  pantryUsersTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 5,
    textAlign: 'center',
  },
  pantryUsersSubtitle: {
    fontSize: 16,
    color: '#718096',
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  pantryUsersLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  pantryUsersLoadingText: {
    fontSize: 14,
    color: '#718096',
    marginTop: 10,
  },
  pantryUsersList: {
    maxHeight: 400,
  },
  pantryUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pantryUserAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  pantryUserAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  pantryUserAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  currentUserBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#48BB78',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  currentUserBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  pantryUserInfo: {
    flex: 1,
  },
  pantryUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  pantryUserEmail: {
    fontSize: 13,
    color: '#718096',
  },
  pantryUsersSummary: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  pantryUsersSummaryText: {
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '500',
  },
  
  // Requests Button Styles
  requestsButton: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  requestsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D6A4F',
    textAlign: 'center',
  },
  requestsBadge: {
    color: '#E53E3E',
    fontWeight: 'bold',
  },

  // Requests Modal Styles
  requestsModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    maxWidth: 450,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  requestsModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D6A4F',
    marginBottom: 20,
    textAlign: 'center',
  },
  requestsScrollView: {
    maxHeight: 400,
  },
  requestsSection: {
    marginBottom: 25,
  },
  requestsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  requestItem: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  requestInfo: {
    marginBottom: 12,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  requestEmail: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: '#A0AEC0',
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#48BB78',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#E53E3E',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userRequestItem: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  userRequestPantry: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D6A4F',
    marginBottom: 6,
  },
  userRequestStatus: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 4,
  },
  userRequestDate: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 4,
  },
  userRequestProgress: {
    fontSize: 12,
    color: '#2D6A4F',
    fontWeight: '500',
  },
  noRequestsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noRequestsText: {
    fontSize: 16,
    color: '#718096',
    fontStyle: 'italic',
  },

  // Password Section Styles
  passwordSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  passwordToggleIcon: {
    fontSize: 16,
    color: '#2D6A4F',
    fontWeight: '600',
  },
  passwordSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  passwordInputContainer: {
    marginBottom: 16,
  },
  passwordInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 6,
  },
  passwordInput: {
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#2D3748',
  },
  updatePasswordButton: {
    backgroundColor: '#2D6A4F',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  updatePasswordButtonDisabled: {
    opacity: 0.6,
  },
  updatePasswordButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  googleUserNote: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
    marginTop: 8,
  },
});