import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import MirevaScreen from './screens/MirevaScreen';
import MirevaScreenSimple from './screens/MirevaScreenSimple';
import ShopScreen from './screens/ShopScreen';
import CookScreen from './screens/CookScreen';
import LogScreen from './screens/LogScreen';
import SavedRecipesScreen from './screens/SavedRecipesScreen';
import MeScreen from './screens/MeScreen';
import ChartsScreen from './screens/ChartsScreen';
import SigninScreen from './screens/SigninScreen';
import SignupScreen from './screens/SignupScreen';
import ErrorBoundary from './ErrorBoundary';
import { API_CONFIG } from './config';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Log Stack Navigator
function LogStack() {
  return (
    
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="LogMain" component={LogScreen} />
      <Stack.Screen name="SavedRecipes" component={SavedRecipesScreen} />
    </Stack.Navigator>
  );
}

// Import icons explicitly
const icons = {
  mireva: require('./assets/mireva-logo.png'),
  shop: require('./assets/tobuy.png'),
  cook: require('./assets/recipes.png'),
  log: require('./assets/journal.png'),
  me: require('./assets/profile.png'),
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [userProfileImage, setUserProfileImage] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if there's a stored user
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        await loadUserProfileImage(parsedUser.email);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsLoading(false);
    }
  };

  const loadUserProfileImage = async (email) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/get-profile-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ email }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.profileImage) {
          setUserProfileImage(data.profileImage);
        }
      }
    } catch (error) {
      console.log('Error loading user profile image:', error);
    }
  };

  const handleSignin = async (userData) => {
    setUser(userData);
    setShowSignup(false);
    if (userData.email) {
      await loadUserProfileImage(userData.email);
    }
  };

  const handleSignup = async (userData) => {
    setUser(userData);
    setShowSignup(false);
    if (userData.email) {
      await loadUserProfileImage(userData.email);
    }
  };

  const handleSignout = async () => {
    try {
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('userEmail');
      setUser(null);
      setShowSignup(false);
    } catch (error) {
      console.error('Error signing out:', error);
      setUser(null);
      setShowSignup(false);
    }
  };

  const handleGoToSignup = () => {
    setShowSignup(true);
  };

  const handleBackToSignin = () => {
    setShowSignup(false);
  };

  // Show auth screens if not authenticated
  if (!user) {
    if (showSignup) {
      return (
        <SignupScreen 
          onSignup={handleSignup} 
          onBackToSignin={handleBackToSignin} 
        />
      );
    } else {
      return (
        <SigninScreen 
          onSignin={handleSignin} 
          onGoToSignup={handleGoToSignup} 
        />
      );
    }
  }

  return (
    <ErrorBoundary>
      <NavigationContainer>
        <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            // Special handling for Mireva tab - always show logo
            if (route.name === 'Mireva') {
              // Try to load image, fallback to custom icon if it fails
              const [imageError, setImageError] = React.useState(false);
              
              if (!imageError) {
                return (
                  <View style={{
                    width: 35,
                    height: 35,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Image
                      source={icons.mireva}
                      style={{
                        width: 30,
                        height: 30,
                        resizeMode: 'contain',
                        opacity: focused ? 1.0 : 0.6,
                      }}
                      onError={() => setImageError(true)}
                    />
                  </View>
                );
              }
              
              // Fallback: Custom "M" icon
              return (
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: focused ? '#2D6A4F' : '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: focused ? '#2D6A4F' : '#9CA3AF',
                }}>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: focused ? '#FFFFFF' : '#6B7280',
                  }}>
                    M
                  </Text>
                </View>
              );
            }

            // Special handling for Me tab - profile image or custom person icon
            if (route.name === 'Me') {
              let iconBackgroundColor = focused ? '#2D6A4F' : '#E2E8F0';
              let iconBorderColor = focused ? '#2D6A4F' : '#9CA3AF';
              
              return (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {userProfileImage ? (
                    // Show profile image
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: iconBorderColor,
                      overflow: 'hidden',
                    }}>
                      <Image
                        source={{ uri: userProfileImage }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                        }}
                      />
                    </View>
                  ) : user?.name ? (
                    // Show first letter of name
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: iconBackgroundColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: iconBorderColor,
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: focused ? '#FFFFFF' : '#6B7280',
                      }}>
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  ) : (
                    // Default person icon
                    <View style={{
                      width: 32,
                      height: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {/* Head */}
                      <View style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: iconBackgroundColor,
                        marginBottom: 2,
                        borderWidth: 1.5,
                        borderColor: iconBorderColor,
                      }} />
                      {/* Shoulders/Body */}
                      <View style={{
                        width: 20,
                        height: 12,
                        borderTopLeftRadius: 10,
                        borderTopRightRadius: 10,
                        backgroundColor: iconBackgroundColor,
                        borderWidth: 1.5,
                        borderColor: iconBorderColor,
                        borderBottomWidth: 0,
                      }} />
                    </View>
                  )}
                </View>
              );
            }

            // Custom icons for Shop, Cook, and Log
            let iconBackgroundColor = focused ? '#2D6A4F' : '#E2E8F0';
            let iconBorderColor = focused ? '#2D6A4F' : '#9CA3AF';
            
            if (route.name === 'Shop') {
              // Shopping cart icon
              return (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {/* Shopping cart body */}
                    <View style={{
                      width: 20,
                      height: 12,
                      borderWidth: 1.5,
                      borderColor: iconBorderColor,
                      borderRadius: 2,
                      backgroundColor: iconBackgroundColor,
                      position: 'relative',
                    }}>
                      {/* Cart handle */}
                      <View style={{
                        position: 'absolute',
                        left: -6,
                        top: -2,
                        width: 6,
                        height: 8,
                        borderWidth: 1.5,
                        borderColor: iconBorderColor,
                        borderRightWidth: 0,
                        borderTopLeftRadius: 4,
                        borderBottomLeftRadius: 4,
                        backgroundColor: 'transparent',
                      }} />
                      {/* Items in cart */}
                      <View style={{
                        position: 'absolute',
                        top: 2,
                        left: 2,
                        width: 3,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: iconBorderColor,
                      }} />
                      <View style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 3,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: iconBorderColor,
                      }} />
                    </View>
                    {/* Cart wheels */}
                    <View style={{
                      position: 'absolute',
                      bottom: 6,
                      left: 8,
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: iconBorderColor,
                    }} />
                    <View style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 8,
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: iconBorderColor,
                    }} />
                  </View>
                </View>
              );
            }

            if (route.name === 'Cook') {
              // Chef's hat and pan icon
              return (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {/* Cooking pan */}
                    <View style={{
                      width: 18,
                      height: 10,
                      borderWidth: 1.5,
                      borderColor: iconBorderColor,
                      borderRadius: 9,
                      backgroundColor: iconBackgroundColor,
                      position: 'relative',
                    }}>
                      {/* Pan handle */}
                      <View style={{
                        position: 'absolute',
                        right: -8,
                        top: 2,
                        width: 8,
                        height: 2,
                        borderRadius: 1,
                        backgroundColor: iconBorderColor,
                      }} />
                      {/* Food in pan */}
                      <View style={{
                        position: 'absolute',
                        top: 2,
                        left: 3,
                        width: 3,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: iconBorderColor,
                      }} />
                      <View style={{
                        position: 'absolute',
                        top: 2,
                        right: 3,
                        width: 3,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: iconBorderColor,
                      }} />
                    </View>
                    {/* Steam lines */}
                    <View style={{
                      position: 'absolute',
                      top: 4,
                      left: 8,
                      width: 1,
                      height: 6,
                      backgroundColor: iconBorderColor,
                      borderRadius: 0.5,
                    }} />
                    <View style={{
                      position: 'absolute',
                      top: 4,
                      left: 12,
                      width: 1,
                      height: 6,
                      backgroundColor: iconBorderColor,
                      borderRadius: 0.5,
                    }} />
                    <View style={{
                      position: 'absolute',
                      top: 4,
                      left: 16,
                      width: 1,
                      height: 6,
                      backgroundColor: iconBorderColor,
                      borderRadius: 0.5,
                    }} />
                  </View>
                </View>
              );
            }

            if (route.name === 'Log') {
              // Food journal/notebook icon
              return (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {/* Journal/book */}
                    <View style={{
                      width: 20,
                      height: 16,
                      borderWidth: 1.5,
                      borderColor: iconBorderColor,
                      borderRadius: 2,
                      backgroundColor: iconBackgroundColor,
                      position: 'relative',
                    }}>
                      {/* Bookmark */}
                      <View style={{
                        position: 'absolute',
                        top: -1.5,
                        right: 3,
                        width: 4,
                        height: 8,
                        backgroundColor: iconBorderColor,
                      }}>
                        <View style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          width: 0,
                          height: 0,
                          borderLeftWidth: 2,
                          borderRightWidth: 2,
                          borderTopWidth: 3,
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                          borderTopColor: iconBorderColor,
                        }} />
                      </View>
                      {/* Journal lines/food entries */}
                      <View style={{
                        position: 'absolute',
                        top: 3,
                        left: 3,
                        right: 8,
                        height: 1,
                        backgroundColor: iconBorderColor,
                      }} />
                      <View style={{
                        position: 'absolute',
                        top: 6,
                        left: 3,
                        right: 8,
                        height: 1,
                        backgroundColor: iconBorderColor,
                      }} />
                      <View style={{
                        position: 'absolute',
                        top: 9,
                        left: 3,
                        right: 8,
                        height: 1,
                        backgroundColor: iconBorderColor,
                      }} />
                      {/* Small food icon */}
                      <View style={{
                        position: 'absolute',
                        top: 3,
                        right: 3,
                        width: 3,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: iconBorderColor,
                      }} />
                    </View>
                  </View>
                </View>
              );
            }

            // Fallback (shouldn't reach here)
            return <View style={{ width: 32, height: 32 }} />;
          },
          tabBarActiveTintColor: '#2D6A4F',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarStyle: {
            height: 85,
            paddingBottom: 20,
            paddingTop: 12,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 6,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Mireva" component={MirevaScreen} />
        <Tab.Screen name="Shop" component={ShopScreen} />
        <Tab.Screen name="Cook" component={CookScreen} />
        <Tab.Screen name="Log" component={LogStack} />
        <Tab.Screen 
          name="Me" 
          children={() => <MeScreen user={user} onSignout={handleSignout} onProfileImageUpdate={setUserProfileImage} />} 
        />
        </Tab.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}