import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

const Input = ({ style, ...props }) => {
  return <TextInput style={[styles.input, style]} {...props} />;
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 16,
  },
});

export default Input;
