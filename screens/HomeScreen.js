// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const [foregroundSubscription, setForegroundSubscription] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    // Start foreground updates when this screen mounts
    startForegroundTracking();
    // Cleanup on unmount
    return () => {
      foregroundSubscription?.remove();
    };
  }, []);

  const startForegroundTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', 'Foreground location permission not granted');
      return;
    }

    console.log('Starting foreground location updates...');

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 0,   // or set a number of meters
        timeInterval: 10000,   // or set in ms, ~10 seconds
      },
      async (location) => {
        console.log('Foreground location updated:', location.coords);
        setCurrentLocation(location.coords);

        try {
          const user = auth.currentUser;
          if (!user) return; // if somehow user is null, skip

          console.log('Updating Firestore with foreground location...');

          await setDoc(
            doc(db, 'users', user.uid),
            {
              location: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy,
                altitude: location.coords.altitude,
                heading: location.coords.heading,
                speed: location.coords.speed,
              },
              locationTimestamp: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (err) {
          console.log('Error updating Firestore in foreground:', err);
        }
      }
    );

    setForegroundSubscription(subscription);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Error', 'Could not sign out');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thank you for testing!</Text>
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