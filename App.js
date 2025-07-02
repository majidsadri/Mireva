import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import MirevaScreen from './screens/MirevaScreen';
import MirevaScreenSimple from './screens/MirevaScreenSimple';
import ShopScreen from './screens/ShopScreen';
import CookScreen from './screens/CookScreen';
import LogScreen from './screens/LogScreen';
import MeScreen from './screens/MeScreen';
import ChartsScreen from './screens/ChartsScreen';
import SigninScreen from './screens/SigninScreen';
import SignupScreen from './screens/SignupScreen';
import ErrorBoundary from './ErrorBoundary';

const Tab = createBottomTabNavigator();

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
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsLoading(false);
    }
  };

  const handleSignin = (userData) => {
    setUser(userData);
    setShowSignup(false);
  };

  const handleSignup = (userData) => {
    setUser(userData);
    setShowSignup(false);
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
              return (
                <View style={{
                  width: 35,
                  height: 35,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Image
                    source={require('./assets/mireva-logo.png')}
                    style={{
                      width: 30,
                      height: 30,
                      resizeMode: 'contain',
                      opacity: focused ? 1.0 : 0.6,
                    }}
                  />
                </View>
              );
            }

            // Special handling for Me tab - custom person icon
            if (route.name === 'Me') {
              let iconBackgroundColor = focused ? '#2D6A4F' : '#E2E8F0';
              let iconBorderColor = focused ? '#2D6A4F' : '#9CA3AF';
              
              return (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {/* Person icon - head and shoulders */}
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
                </View>
              );
            }

            // Custom icons for Shop, Cook, and Log
            let iconBackgroundColor = focused ? '#2D6A4F' : '#E2E8F0';
            let iconBorderColor = focused ? '#2D6A4F' : '#9CA3AF';
            
            if (route.name === 'Shop') {
              // Shopping basket icon
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
                    {/* Shopping basket */}
                    <View style={{
                      width: 22,
                      height: 14,
                      borderWidth: 1.5,
                      borderColor: iconBorderColor,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      backgroundColor: iconBackgroundColor,
                      position: 'relative',
                    }}>
                      {/* Basket handle */}
                      <View style={{
                        position: 'absolute',
                        top: -3,
                        left: 4,
                        right: 4,
                        height: 3,
                        borderWidth: 1.5,
                        borderColor: iconBorderColor,
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                        borderBottomWidth: 0,
                        backgroundColor: 'transparent',
                      }} />
                      {/* Items in basket */}
                      <View style={{
                        position: 'absolute',
                        top: 3,
                        left: 3,
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: iconBorderColor,
                      }} />
                      <View style={{
                        position: 'absolute',
                        top: 3,
                        right: 3,
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: iconBorderColor,
                      }} />
                    </View>
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
        <Tab.Screen name="Log" component={LogScreen} />
        <Tab.Screen 
          name="Me" 
          children={() => <MeScreen user={user} onSignout={handleSignout} />} 
        />
        </Tab.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}