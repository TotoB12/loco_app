// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import Radar from 'react-native-radar';

export default function HomeScreen() {
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    // Optionally, get a quick "foreground" location update
    Radar.trackOnce()
      .then((result) => {
        if (result.location) {
          setCurrentLocation(result.location);
        }
      })
      .catch((err) => {
        console.log('Radar trackOnce error =>', err);
      });
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log('Error signing out:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thanks for testing!</Text>
      {currentLocation ? (
        <Text style={styles.text}>
          Foreground location:
          {'\n'}Lat: {currentLocation.latitude}, Lng: {currentLocation.longitude}
        </Text>
      ) : (
        <Text style={styles.text}>No location yet...</Text>
      )}
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

// Basic styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#212832',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 20,
  },
  text: {
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center'
  },
  button: {
    width: 150,
    height: 50,
    backgroundColor: '#f54242',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
  },
});
