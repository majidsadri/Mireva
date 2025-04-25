import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Image } from 'react-native';

// Auth Screens
import SigninScreen from './screens/SigninScreen';
import SignupScreen from './screens/SignupScreen';

// Main Screens
import ProfileScreen from './screens/ProfileScreen';
import PantryScreen from './screens/PantryScreen';
import RecipeScreen from './screens/RecipeScreen';
import ToBuyScreen from './screens/ToBuyScreen';
import JournalScreen from './screens/JournalScreen';

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          let iconSource;

          switch (route.name) {
            case 'Recipes':
              iconSource = require('./assets/recipes.png');
              break;
            case 'Profile':
              iconSource = require('./assets/profile.png');
              break;
            case 'Pantry':
              iconSource = require('./assets/pantry.png');
              break;
            case 'To Buy':
              iconSource = require('./assets/tobuy.png');
              break;
            case 'Journal':
              iconSource = require('./assets/journal.png');
              break;
            default:
              iconSource = require('./assets/mireva-logo.png');
          }

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={iconSource}
                style={{
                  width: focused ? 48 : 40,
                  height: focused ? 48 : 40,
                  resizeMode: 'contain',
                  // Remove tintColor
                }}
              />
            </View>
          );          
        },
        tabBarStyle: {
          height: 80,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: '#fff',
          borderTopWidth: 0.5,
          borderTopColor: '#ddd',
        },
        tabBarShowLabel: false,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Recipes" component={RecipeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Pantry" component={PantryScreen} />
      <Tab.Screen name="To Buy" component={ToBuyScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <AuthStack.Navigator initialRouteName="Signin">
        <AuthStack.Screen name="Signin" component={SigninScreen} />
        <AuthStack.Screen name="Signup" component={SignupScreen} />
        <AuthStack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      </AuthStack.Navigator>
    </NavigationContainer>
  );
}
