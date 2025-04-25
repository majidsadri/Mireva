import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Input from './Input';
import Button from './Button';

const API_URL = "https://c8f8-18-215-164-114.ngrok-free.app";

const schema = yup.object().shape({
  email: yup.string().email('Please enter a valid email').required('Email is required'),
  password: yup.string().required('Password is required').min(6, 'Password must be at least 6 characters'),
});

export default function SigninScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data) => {
    try {
      setLoading(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

      const response = await fetch(`${API_URL}/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || `Server Error: ${response.status}`);
      }

      await AsyncStorage.setItem('userEmail', responseData.email); // Save email

      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Profile', userData: responseData } }],
      });

    } catch (error) {
      console.error("🚨 Sign-in error:", error);
      Alert.alert('Sign In Failed', error.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Sign In</Text>

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <>
            <Input
              placeholder="Email"
              {...field}
              onChangeText={field.onChange}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            {fieldState.error && <Text style={styles.error}>{fieldState.error.message}</Text>}
          </>
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <>
            <Input
              placeholder="Password"
              secureTextEntry
              {...field}
              onChangeText={field.onChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {fieldState.error && <Text style={styles.error}>{fieldState.error.message}</Text>}
          </>
        )}
      />

      <Button
        title={loading ? "Signing in..." : "Sign In"}
        onPress={handleSubmit(onSubmit)}
        disabled={loading}
      />

      <Button
        title="Create an account"
        onPress={() => navigation.navigate('Signup')}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { fontSize: 26, textAlign: 'center', marginBottom: 20 },
  error: { color: 'red', marginBottom: 10 },
});
