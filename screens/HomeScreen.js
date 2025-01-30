// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import Radar from 'react-native-radar';
import Mapbox, { MapView, Camera, LocationPuck } from '@rnmapbox/maps';

export default function HomeScreen() {
  const [currentLocation, setCurrentLocation] = useState(null);

  // ------------------------------
  //  Mapbox Token & Telemetry
  // ------------------------------
  useEffect(() => {
    Mapbox.setAccessToken('pk.eyJ1IjoidG90b2IxMjE3IiwiYSI6ImNsbXo4NHdocjA4dnEya215cjY0aWJ1cGkifQ.OMzA6Q8VnHLHZP-P8ACBRw');
    Mapbox.setTelemetryEnabled(false);
  }, []);

  useEffect(() => {
    // track once every 10s while in foreground
    const intervalId = setInterval(() => {
      Radar.trackOnce({ desiredAccuracy: 'high' })
        .then((result) => {
          if (result.location) {
            setCurrentLocation(result.location);
          }
        })
        .catch((err) => {
          console.log('Radar trackOnce error =>', err);
        });
    }, 10_000);

    return () => clearInterval(intervalId);
  }, []);

  // ------------------------------
  //  Sign out logic
  // ------------------------------
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log('Error signing out:', error);
    }
  };

  // ------------------------------
  //  Render
  // ------------------------------
  return (
    <View style={styles.container}>
      {/* Full-screen Map */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        attributionEnabled={false}
        logoEnabled={false}  
        scaleBarEnabled={false}
        compassEnabled={true}
        compassViewPosition={1}
        compassViewMargins={{ x: 15, y: 50 }}
        compassFadeWhenNorth={true}
        
      >
        {/* Camera that follows user location */}
        <Camera
          followUserLocation
          followZoomLevel={14}
        />
        {/* Shows a blue dot for user location */}
        <LocationPuck
          topImage="topImage"
          visible={true}
          scale={['interpolate', ['linear'], ['zoom'], 10, 1.0, 20, 4.0]}
          pulsing={{
            isEnabled: true,
            color: 'teal',
            radius: 50.0,
          }}
        />
      </MapView>

      {/* Current location text overlaid at bottom-right */}
      <View style={styles.locationInfo}>
        {currentLocation ? (
          <Text style={styles.locationText}>
            Lat: {currentLocation.latitude.toFixed(6)}{'\n'}
            Lng: {currentLocation.longitude.toFixed(6)}
          </Text>
        ) : (
          <Text style={styles.locationText}>No location yet...</Text>
        )}
      </View>

      {/* Sign out button overlaid at bottom-left */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

// ------------------------------
//  Styles
// ------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  locationInfo: {
    position: 'absolute',
    bottom: 40,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 8,
    borderRadius: 5,
  },
  locationText: {
    color: '#fff',
    textAlign: 'left',
  },
  signOutButton: {
    position: 'absolute',
    bottom: 40,
    left: 15,
    backgroundColor: '#f54242',
    borderRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
  },
});
