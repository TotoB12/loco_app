// screens/LoadingScreen.js
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      {/* Simple spinner in the center */}
      <ActivityIndicator size="large" color="#00ADB5" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#212832',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
