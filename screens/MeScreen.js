import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { API_CONFIG } from '../config';
import ChartsScreen from './ChartsScreen';

export default function MeScreen({ user, onSignout, onProfileImageUpdate }) {
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
          setUserInfo(data);
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
        // Create new pantry (immediate join)
        const response = await fetch(`${API_CONFIG.BASE_URL}/update-user-pantry`, {
          method: 'POST',
          headers: API_CONFIG.getHeaders(),
          body: JSON.stringify({
            email: userEmail,
            pantryName: pantryName.trim()
          }),
        });

        if (response.ok) {
          await AsyncStorage.setItem('joinedPantry', pantryName.trim());
          setJoinedPantry(pantryName.trim());
          
          // Update the stored userData to include the new pantry
          const storedUserData = await AsyncStorage.getItem('userData');
          if (storedUserData) {
            const userData = JSON.parse(storedUserData);
            userData.pantryName = pantryName.trim();
            await AsyncStorage.setItem('userData', JSON.stringify(userData));
          }
          
          setShowJoinPantry(false);
          setPantryName('');
          Alert.alert('Success', `You have created and joined "${pantryName.trim()}" pantry!`);
        } else {
          const errorData = await response.json();
          Alert.alert('Error', errorData.error || 'Failed to create pantry');
        }
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
      <ScrollView style={styles.content}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileWallpaper}>
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
          </View>
        </View>

        {/* Pantry Section */}
        <View style={styles.pantrySection}>
          <Text style={styles.sectionTitle}>Current Pantry</Text>
          
          {joinedPantry ? (
            <View>
              <View style={styles.joinedPantryCard}>
                <TouchableOpacity style={styles.pantryInfo} onPress={showPantryUsersHandler}>
                  <Text style={styles.pantryName}>
                    {joinedPantry}
                    {isOwner && <Text style={styles.ownerBadge}> Owner</Text>}
                  </Text>
                  <Text style={styles.pantryTapHint}>Tap to see members</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.leavePantryButton} onPress={handleLeavePantry}>
                  <View style={styles.leavePantryIcon}>
                    <Text style={styles.leavePantryIconText}>Leave</Text>
                  </View>
                </TouchableOpacity>
              </View>
              
              {/* Pantry Requests Button - Only show for owners */}
              {isOwner && (
                <TouchableOpacity style={styles.requestsButton} onPress={showRequestsHandler}>
                  <Text style={styles.requestsButtonText}>
                    Manage Join Requests
                    {pendingRequests.length > 0 && (
                      <Text style={styles.requestsBadge}> ({pendingRequests.length})</Text>
                    )}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.noPantryCard}>
              {!showJoinPantry ? (
                <>
                  <Text style={styles.noPantryText}>You haven't joined any pantry yet</Text>
                  <TouchableOpacity 
                    style={styles.joinPantryButton} 
                    onPress={() => setShowJoinPantry(true)}
                  >
                    <Text style={styles.joinPantryButtonText}>Join a Pantry</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.joinPantryForm}>
                  <Text style={styles.formTitle}>Join Pantry</Text>
                  <Text style={styles.helpText}>
                    Search for an existing pantry or create a new one:
                  </Text>
                  
                  <TextInput
                    style={styles.pantryInput}
                    placeholder="Search pantry name..."
                    placeholderTextColor="#999"
                    value={pantryName}
                    onChangeText={(text) => {
                      setPantryName(text);
                      searchPantries(text);
                    }}
                    autoCapitalize="words"
                  />
                  
                  {/* Search results */}
                  {pantryName.trim().length > 0 && (
                    <View style={styles.searchResults}>
                      {loadingPantries ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color="#2D6A4F" />
                          <Text style={styles.loadingText}>Searching...</Text>
                        </View>
                      ) : (
                        availablePantries
                          .filter(pantry => pantry.toLowerCase().includes(pantryName.toLowerCase().trim()))
                          .map((pantry, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.searchResultItem}
                              onPress={() => setPantryName(pantry)}
                            >
                              <Text style={styles.searchResultText}>{pantry}</Text>
                              <Text style={styles.searchResultSubtext}>Existing pantry</Text>
                            </TouchableOpacity>
                          ))
                      )}
                      {!loadingPantries && availablePantries.filter(pantry => pantry.toLowerCase().includes(pantryName.toLowerCase().trim())).length === 0 && (
                        <View style={styles.noResultsContainer}>
                          <Text style={styles.noResultsText}>No existing pantry found</Text>
                          <Text style={styles.createNewText}>Tap "Join" to create "{pantryName.trim()}"</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={styles.formButtons}>
                    <TouchableOpacity 
                      style={styles.cancelButton} 
                      onPress={() => {
                        setShowJoinPantry(false);
                        setPantryName('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.confirmButton, loading && styles.confirmButtonDisabled]} 
                      onPress={handleJoinPantry}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.confirmButtonText}>Join</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Dietary Preferences Section */}
        <View style={styles.preferencesSection}>
          <Text style={styles.sectionTitle}>Dietary Preferences</Text>
          <View style={styles.preferencesGrid}>
            {['None', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Mediterranean', 'Low-Carb', 'Gluten-Free', 'Dairy-Free', 'Diabetic', 'Halal'].map((diet) => (
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
              { name: 'Mediterranean', emoji: '🇬🇷' },
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
              source={require('../assets/mireva-logo.png')}
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  profileSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 0,
    overflow: 'hidden',
  },
  profileWallpaper: {
    alignItems: 'center',
    paddingVertical: 25,
    paddingHorizontal: 16,
    backgroundColor: '#1A4D3E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0F3028',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  userEmail: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '500',
    marginBottom: 16,
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
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
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
});