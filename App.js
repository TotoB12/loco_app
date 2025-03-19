// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ref, update } from '@react-native-firebase/database';
import { auth, db } from './firebaseConfig';
import Radar from 'react-native-radar';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

// Screens
import PermissionScreen from './screens/PermissionScreen';
import LoadingScreen from './screens/LoadingScreen';
import PhoneAuthScreen from './screens/PhoneAuthScreen'; // Replace LoginScreen and SignupScreen
import HomeScreen from './screens/HomeScreen';

const Stack = createStackNavigator();

export default function App() {
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [hasLocationPermissions, setHasLocationPermissions] = useState(false);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState('');
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Check Location Permissions
  useEffect(() => {
    (async () => {
      try {
        let fg = await Location.getForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          fg = await Location.requestForegroundPermissionsAsync();
          if (fg.status !== 'granted') {
            setPermissionErrorMessage('App needs "While Using" location to function.');
            setHasLocationPermissions(false);
            setIsCheckingPermissions(false);
            return;
          }
        }

        let bg = await Location.getBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
          bg = await Location.requestBackgroundPermissionsAsync();
        }

        if (bg.status !== 'granted') {
          setPermissionErrorMessage('Please grant "Allow All the Time" location in Settings.');
          setHasLocationPermissions(false);
        } else {
          setPermissionErrorMessage('');
          setHasLocationPermissions(true);
        }
      } catch (err) {
        console.log('Error checking permissions =>', err);
        setPermissionErrorMessage('Error checking permissions. Please enable them in Settings.');
        setHasLocationPermissions(false);
      } finally {
        setIsCheckingPermissions(false);
      }
    })();
  }, []);

  // Radar Setup
  useEffect(() => {
    if (!hasLocationPermissions) return;

    Radar.initialize('prj_live_pk_2bb1459eda8faeaf64aa70990ca689ee231f5b42');
    Radar.setLogLevel('debug'); // Set to 'none' in production

    Radar.on('error', (err) => {
      console.error('Radar error =>', err);
    });

    return () => {
      Radar.off('location');
      Radar.off('error');
    };
  }, [hasLocationPermissions]);

  // Auth Listener and Radar Trip
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      setInitializing(false);

      if (currentUser) {
        Radar.setUserId(currentUser.uid);
        Radar.setDescription(currentUser.phoneNumber || 'Radar User');
        Radar.setMetadata({ role: 'tester' });

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

        if (hasLocationPermissions) {
          Radar.setForegroundServiceOptions({
            text: 'Location tracking is active',
            title: 'Tracking in background',
            updatesOnly: false,
            importance: 2,
          });

          Radar.startTrip({
            tripOptions: {
              externalId: currentUser.uid,
            },
            trackingOptions: {
              desiredStoppedUpdateInterval: 120,
              fastestStoppedUpdateInterval: 60,
              desiredMovingUpdateInterval: 30,
              fastestMovingUpdateInterval: 15,
              desiredSyncInterval: 20,
              desiredAccuracy: 'high',
              stopDuration: 140,
              stopDistance: 70,
              replay: 'none',
              sync: 'all',
              useStoppedGeofence: false,
              showBlueBar: false,
              syncGeofences: false,
              syncGeofencesLimit: 0,
              beacons: false,
              foregroundServiceEnabled: true,
            },
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

  // Conditional Rendering
  if (isCheckingPermissions || initializing) {
    return <LoadingScreen />;
  }

  if (!hasLocationPermissions) {
    return (
      <PermissionBlockedScreen
        errorMessage={permissionErrorMessage}
        onOpenSettings={openAppSettings}
      />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function openAppSettings() {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: 'package:com.antoninbeliard.loco' }
    );
  }
}

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