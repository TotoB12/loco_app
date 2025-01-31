// screens/PermissionScreen.js
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function PermissionScreen({
  title = 'Permissions Required',
  message = 'We need location permissions.',
  buttonText = 'Open Settings',
  onPressButton,
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onPressButton && (
        <Button title={buttonText} onPress={onPressButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#212832',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
});
