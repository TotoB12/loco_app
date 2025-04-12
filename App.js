// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ref, onValue } from '@react-native-firebase/database';
import { auth, db } from './firebaseConfig';
import Radar from 'react-native-radar';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform, AppState } from 'react-native';

// Screens
import PermissionScreen from './screens/PermissionScreen';
import LoadingScreen from './screens/LoadingScreen';
import PhoneAuthScreen from './screens/PhoneAuthScreen';
import HomeScreen from './screens/HomeScreen';

const Stack = createStackNavigator();

export default function App() {
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [hasLocationPermissions, setHasLocationPermissions] = useState(false);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState('');
  const [user, setUser] = useState(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Function to check location permissions
  const checkLocationPermissions = async (isInitial = false) => {
    if (isInitial) setIsCheckingPermissions(true);
    try {
      let fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          setPermissionErrorMessage('App needs "While Using" location to function.');
          setHasLocationPermissions(false);
          return;
        }
      }

      let bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
          setPermissionErrorMessage('Please grant "Allow All the Time" location in Settings.');
          setHasLocationPermissions(false);
          return;
        }
      }

      setPermissionErrorMessage('');
      setHasLocationPermissions(true);
    } catch (err) {
      console.log('Error checking permissions =>', err);
      setPermissionErrorMessage('Error checking permissions. Please enable them in Settings.');
      setHasLocationPermissions(false);
    } finally {
      if (isInitial) setIsCheckingPermissions(false);
    }
  };

  // Permission checking with AppState listener
  useEffect(() => {
    // Initial check
    checkLocationPermissions(true);

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkLocationPermissions(false);
      }
    });

    // Cleanup listener
    return () => subscription.remove();
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

  // Auth Listener and Radar Trip Start
  useEffect(() => {
    let unsubscribeDb;
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = ref(db, `users/${currentUser.uid}`);
        unsubscribeDb = onValue(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const userData = snapshot.val();
              setOnboardingCompleted(!!userData.onboardingCompleted);
            } else {
              setOnboardingCompleted(false);
            }
            if (initializing) setInitializing(false);
          },
          (error) => {
            console.error('Error listening to user data:', error);
            setOnboardingCompleted(false);
            if (initializing) setInitializing(false);
          }
        );

        Radar.setUserId(currentUser.uid);
        Radar.setDescription(currentUser.phoneNumber || 'Radar User');
        Radar.setMetadata({ role: 'tester' });

        if (hasLocationPermissions) {
          Radar.setForegroundServiceOptions({
            text: 'Location tracking is active',
            title: 'Tracking in background',
            updatesOnly: false,
            importance: 2,
          });

          Radar.startTrip({
            tripOptions: { externalId: currentUser.uid },
            // trackingOptions: {
            //   desiredStoppedUpdateInterval: 120,
            //   fastestStoppedUpdateInterval: 60,
            //   desiredMovingUpdateInterval: 30,
            //   fastestMovingUpdateInterval: 15,
            //   desiredSyncInterval: 20,
            //   desiredAccuracy: 'high',
            //   stopDuration: 140,
            //   stopDistance: 70,
            //   replay: 'none',
            //   sync: 'all',
            //   useStoppedGeofence: false,
            //   showBlueBar: false,
            //   syncGeofences: false,
            //   syncGeofencesLimit: 0,
            //   beacons: false,
            //   foregroundServiceEnabled: true,
            // },
            trackingOptions: Radar.presetContinuous
          }).then((result) => {
            console.log('Radar trip started =>', result);
          }).catch((err) => {
            console.error('Error starting Radar trip:', err);
          });
        }
      } else {
        setOnboardingCompleted(false);
        if (unsubscribeDb) unsubscribeDb();
        Radar.stopTracking();
        if (initializing) setInitializing(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDb) unsubscribeDb();
    };
  }, [hasLocationPermissions]);

  // Conditional Rendering
  if (isCheckingPermissions || initializing || onboardingCompleted === null) {
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
        {user && onboardingCompleted ? (
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen
            name="PhoneAuth"
            component={PhoneAuthScreen}
            options={{ headerShown: false }}
          />
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