import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import MirevaScreen from './screens/MirevaScreen';
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
import { images } from './assets';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Mireva Tab Icon Component - Nice M Logo
function MirevaTabIcon({ focused }) {
  return (
    <View style={{
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <View style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        backgroundColor: focused ? '#2D6A4F' : '#F8F9FA',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: focused ? '#2D6A4F' : '#E2E8F0',
        shadowColor: focused ? '#2D6A4F' : '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: focused ? 0.3 : 0.1,
        shadowRadius: 4,
        elevation: focused ? 4 : 2,
      }}>
        <Text style={{
          fontSize: 24,
          fontWeight: '900',
          color: focused ? '#FFFFFF' : '#2D6A4F',
          fontFamily: 'System',
          letterSpacing: 0.5,
        }}>
          M
        </Text>
      </View>
    </View>
  );
}

// Removed Log Stack Navigator - Log is now accessed from Pantry/Mireva screen

// Note: Tab icons are custom drawn components, not using image assets
// Removed unused icons object that was referencing non-existent assets

export default function App() {
  console.log('=== APP COMPONENT RENDERING ===');
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [userProfileImage, setUserProfileImage] = useState(null);

  console.log('State initialized:', { user, isLoading, showSignup });

  useEffect(() => {
    console.log('useEffect running - will check auth status');
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('Checking auth status...');
      
      // Add timeout to prevent hanging
      const timeout = new Promise((resolve) => {
        setTimeout(() => {
          console.log('Auth check timeout reached');
          resolve(null);
        }, 3000); // 3 second timeout
      });
      
      const authCheck = AsyncStorage.getItem('userData');
      
      // Race between auth check and timeout
      const userData = await Promise.race([authCheck, timeout]);
      
      console.log('User data from storage:', userData);
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          // Don't await profile image loading - do it async
          loadUserProfileImage(parsedUser.email).catch(console.log);
        } catch (parseError) {
          console.error('Error parsing user data:', parseError);
        }
      }
      console.log('Setting isLoading to false');
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

  console.log('About to render, isLoading:', isLoading, 'user:', user);

  // Show loading screen while checking auth status
  if (isLoading) {
    console.log('Rendering loading screen');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2D6A4F', marginBottom: 20 }}>Mireva</Text>
        <ActivityIndicator size="large" color="#2D6A4F" />
        <Text style={{ fontSize: 14, color: '#666', marginTop: 20 }}>Loading...</Text>
      </View>
    );
  }

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

  // Create a Root Stack Navigator
  const RootStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {() => (
          <Tab.Navigator
          screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            // Special handling for Mireva tab - always show logo
            if (route.name === 'Mireva') {
              return <MirevaTabIcon focused={focused} />;
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
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      borderWidth: 2,
                      borderColor: iconBorderColor,
                      overflow: 'hidden',
                    }}>
                      <Image
                        source={{ uri: userProfileImage }}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 14,
                        }}
                      />
                    </View>
                  ) : user?.name ? (
                    // Show first letter of name
                    <View style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: iconBackgroundColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: iconBorderColor,
                    }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: 'bold',
                        color: focused ? '#FFFFFF' : '#6B7280',
                      }}>
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  ) : (
                    // Default person icon
                    <View style={{
                      width: 38,
                      height: 38,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {/* Head */}
                      <View style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: iconBackgroundColor,
                        marginBottom: 2,
                        borderWidth: 1.5,
                        borderColor: iconBorderColor,
                      }} />
                      {/* Shoulders/Body */}
                      <View style={{
                        width: 24,
                        height: 14,
                        borderTopLeftRadius: 12,
                        borderTopRightRadius: 12,
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
                    width: 38,
                    height: 38,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {/* Shopping cart body */}
                    <View style={{
                      width: 24,
                      height: 14,
                      borderWidth: 1.5,
                      borderColor: iconBorderColor,
                      borderRadius: 2,
                      backgroundColor: iconBackgroundColor,
                      position: 'relative',
                    }}>
                      {/* Cart handle */}
                      <View style={{
                        position: 'absolute',
                        left: -7,
                        top: -2,
                        width: 7,
                        height: 10,
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
                      bottom: 7,
                      left: 10,
                      width: 5,
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: iconBorderColor,
                    }} />
                    <View style={{
                      position: 'absolute',
                      bottom: 7,
                      right: 10,
                      width: 5,
                      height: 5,
                      borderRadius: 2.5,
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
                    width: 38,
                    height: 38,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {/* Cooking pan */}
                    <View style={{
                      width: 22,
                      height: 12,
                      borderWidth: 1.5,
                      borderColor: iconBorderColor,
                      borderRadius: 9,
                      backgroundColor: iconBackgroundColor,
                      position: 'relative',
                    }}>
                      {/* Pan handle */}
                      <View style={{
                        position: 'absolute',
                        right: -10,
                        top: 3,
                        width: 10,
                        height: 3,
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
        <Tab.Screen 
          name="Me" 
          children={() => <MeScreen user={user} onSignout={handleSignout} onProfileImageUpdate={setUserProfileImage} />} 
        />
          </Tab.Navigator>
        )}
      </Stack.Screen>
      <Stack.Screen name="Log" component={LogScreen} />
      <Stack.Screen name="SavedRecipes" component={SavedRecipesScreen} />
    </Stack.Navigator>
  );

  return (
    <ErrorBoundary>
      <NavigationContainer>
        <RootStack />
      </NavigationContainer>
    </ErrorBoundary>
  );
}