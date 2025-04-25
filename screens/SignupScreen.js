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
  password: yup.string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: yup.string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
});

export default function SignupScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (data) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Registration failed');
      }

      await AsyncStorage.setItem('userEmail', data.email); // Save email

      Alert.alert(
        'Success',
        'Account created! You are now signed in.',
        [{ text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }) }]
      );

    } catch (error) {
      Alert.alert('Registration Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Create Account</Text>

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
              {...field}
              onChangeText={field.onChange}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {fieldState.error && <Text style={styles.error}>{fieldState.error.message}</Text>}
          </>
        )}
      />

      <Controller
        control={control}
        name="confirmPassword"
        render={({ field, fieldState }) => (
          <>
            <Input
              placeholder="Confirm Password"
              {...field}
              onChangeText={field.onChange}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {fieldState.error && <Text style={styles.error}>{fieldState.error.message}</Text>}
          </>
        )}
      />

      <Button
        title={loading ? "Creating Account..." : "Create Account"}
        onPress={handleSubmit(onSubmit)}
        disabled={loading}
      />

      <Button
        title="Already have an account? Sign In"
        onPress={() => navigation.navigate('Signin')}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  error: {
    color: '#f44336',
    fontSize: 14,
    marginTop: 5,
    marginBottom: 10,
  },
});
