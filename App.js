// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, update } from 'firebase/database';

import { auth, db } from './firebaseConfig';
import Radar from 'react-native-radar';

import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

// Screens
import PermissionScreen from './screens/PermissionScreen';
import LoadingScreen from './screens/LoadingScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';

const Stack = createStackNavigator();

export default function App() {
  // ----------------------------
  // 1) State for Location Perms
  // ----------------------------
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [hasLocationPermissions, setHasLocationPermissions] = useState(false);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState('');

  // ----------------------------
  // 2) State for Auth
  // ----------------------------
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // ----------------------------
  // 3) Check Location Perms
  //    On First Mount
  // ----------------------------
  useEffect(() => {
    (async () => {
      try {
        // 1) Request Foreground
        let fg = await Location.getForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          fg = await Location.requestForegroundPermissionsAsync();
          if (fg.status !== 'granted') {
            setPermissionErrorMessage(
              'App needs "While Using" location to function.'
            );
            setHasLocationPermissions(false);
            setIsCheckingPermissions(false);
            return;
          }
        }

        // 2) Request Background
        let bg = await Location.getBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
          bg = await Location.requestBackgroundPermissionsAsync();
        }

        if (bg.status !== 'granted') {
          // iOS may not grant 'Always' automatically. The user may have to manually enable it in Settings.
          setPermissionErrorMessage(
            'Please grant "Allow All the Time" location in Settings.'
          );
          setHasLocationPermissions(false);
        } else {
          setPermissionErrorMessage('');
          setHasLocationPermissions(true);
        }
      } catch (err) {
        console.log('Error checking permissions =>', err);
        setPermissionErrorMessage(
          'Error checking permissions. Please enable them in Settings.'
        );
        setHasLocationPermissions(false);
      } finally {
        setIsCheckingPermissions(false);
      }
    })();
  }, []);

  // ----------------------------
  // 4) Radar Setup
  //    But Only If We Have Perms
  // ----------------------------
  useEffect(() => {
    if (!hasLocationPermissions) return;

    // Initialize Radar
    Radar.initialize('prj_live_pk_2bb1459eda8faeaf64aa70990ca689ee231f5b42');
    Radar.setLogLevel('debug'); // Remove or set to 'none' in production

    Radar.on('error', (err) => {
      console.error('Radar error =>', err);
    });

    // Cleanup
    return () => {
      Radar.off('location');
      Radar.off('error');
    };
  }, [hasLocationPermissions]);

  // ----------------------------
  // 5) Auth Listener
  // ----------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setInitializing(false);

      if (currentUser) {
        Radar.setUserId(currentUser.uid);
        Radar.setDescription(currentUser.email || 'Radar User');
        Radar.setMetadata({ role: 'tester' });

        // Request location permissions in two stages (foreground, then background)
        try {
          const fgStatus = await Radar.requestPermissions(false);
          console.log('Foreground perms =>', fgStatus);

          if (fgStatus === 'GRANTED_FOREGROUND') {
            const bgStatus = await Radar.requestPermissions(true);
            console.log('Background perms =>', bgStatus);
          }
        } catch (err) {
          console.error('Error requesting Radar permissions =>', err);
        }

        // Start custom tracking (only if we have perms)
        if (hasLocationPermissions) {
          // Configure the foreground notification on Android
          Radar.setForegroundServiceOptions({
            text: 'Location tracking is active',
            title: 'Tracking in background',
            updatesOnly: false,
            importance: 2,
          });

          // Radar.startTrackingCustom({
          //   desiredStoppedUpdateInterval: 60, // every 60s when "stopped"
          //   fastestStoppedUpdateInterval: 60,
          //   desiredMovingUpdateInterval: 60,  // every 60s when "moving"
          //   fastestMovingUpdateInterval: 30,  // won't go faster than 30s
          //   desiredSyncInterval: 20,          // sync to Radar server every 20s
          //   desiredAccuracy: 'high',
          //   stopDuration: 140,                // how long before considered "stopped"
          //   stopDistance: 70,                 // how far to move before "moving"
          //   replay: 'none',                   // do not replay offline updates
          //   sync: 'all',                      // sync all location updates
          //   useStoppedGeofence: false,
          //   showBlueBar: false,               // iOS: if true, user sees blue bar
          //   foregroundServiceEnabled: true,   // Android: show a persistent notif
          // });

          Radar.startTrip({
            tripOptions: {
              externalId: currentUser.uid,
              // mode: 'car'
            },
            trackingOptions: {
              desiredStoppedUpdateInterval: 120,
              fastestStoppedUpdateInterval: 60,
              desiredMovingUpdateInterval: 30,
              fastestMovingUpdateInterval: 15,
              desiredSyncInterval: 20,
              desiredAccuracy: "high",
              stopDuration: 140,
              stopDistance: 70,
              replay: "none",
              sync: "all",
              useStoppedGeofence: false,
              showBlueBar: false,
              syncGeofences: false,
              syncGeofencesLimit: 0,
              beacons: false,
              foregroundServiceEnabled: true
            }
          }).then((result) => {
            console.log('Radar trip started =>', result);
          });
        }
      } else {
        Radar.stopTracking();
      }
    });

    return () => unsubscribe();
  }, [hasLocationPermissions]);

  // ----------------------------
  // 6) Conditional Rendering
  // ----------------------------

  // 6a) If still checking perms, show spinner
  if (isCheckingPermissions) {
    return <LoadingScreen />;
  }

  // 6b) If we do NOT have location perms, block with a custom screen
  if (!hasLocationPermissions) {
    return (
      <PermissionBlockedScreen
        errorMessage={permissionErrorMessage}
        onOpenSettings={openAppSettings}
      />
    );
  }

  // 6c) If still initializing auth, show spinner
  if (initializing) {
    return <LoadingScreen />;
  }

  // 6d) If we have perms and have done auth check, show normal navigation
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Signup"
              component={SignupScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Helper function to open App Settings:
function openAppSettings() {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    // Replace "com.yourcompany.yourapp" with your actual Android package name
    IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: 'package:com.antoninbeliard.loco' }
    );
  }
}

// Minimal “blocked permissions” screen:
function PermissionBlockedScreen({ errorMessage, onOpenSettings }) {
  return (
    <PermissionScreen
      title="Location Needed"
      message={errorMessage}
      buttonText="Open Settings"
      onPressButton={onOpenSettings}
    />
  );
}
