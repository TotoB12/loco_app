// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';

// Radar import
import Radar from 'react-native-radar';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);

  // -----------------------------------------------
  // 1. SETUP RADAR EVENT LISTENERS (ONE-TIME)
  // -----------------------------------------------
  useEffect(() => {
    // Initialize Radar
    Radar.initialize('prj_live_pk_2bb1459eda8faeaf64aa70990ca689ee231f5b42');
    Radar.setLogLevel('debug'); // Remove or set to 'none' in production

    // Listen for location updates
    Radar.on('location', async (result) => {
      console.log('Radar location event =>', result);

      // If user is logged in, push location to Firestore
      const currentUser = auth.currentUser;
      if (currentUser && result.location) {
        await setDoc(
          doc(db, 'users', currentUser.uid),
          {
            location: {
              latitude: result.location.latitude,
              longitude: result.location.longitude,
            },
            locationTimestamp: serverTimestamp(),
          },
          { merge: true }
        );
      }
    });

    // Listen for Radar errors
    Radar.on('error', (err) => {
      console.error('Radar error =>', err);
    });

    // Cleanup on unmount
    return () => {
      Radar.off('location');
      Radar.off('error');
    };
  }, []);

  // -----------------------------------------------
  // 2. AUTH STATE LISTENER
  // -----------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Identify user to Radar
        Radar.setUserId(currentUser.uid);
        Radar.setDescription(currentUser.email || 'Radar User');
        Radar.setMetadata({
          role: 'tester'
        });

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


        // Configure the foreground notification on Android
        Radar.setForegroundServiceOptions({
          text: 'Location tracking is active',
          title: 'Tracking in background',
          updatesOnly: false,
          importance: 2,
        });

        // -----------------------------------------------
        // START CUSTOM TRACKING EVERY 60s
        // -----------------------------------------------
        Radar.startTrackingCustom({
          desiredStoppedUpdateInterval: 60, // every 60s when "stopped"
          fastestStoppedUpdateInterval: 60,
          desiredMovingUpdateInterval: 60,  // every 60s when "moving"
          fastestMovingUpdateInterval: 30,  // won't go faster than 30s
          desiredSyncInterval: 20,          // sync to Radar server every 20s
          desiredAccuracy: 'high',
          stopDuration: 140,                // how long before considered "stopped"
          stopDistance: 70,                 // how far to move before "moving"
          replay: 'none',                   // do not replay offline updates
          sync: 'all',                      // sync all location updates
          useStoppedGeofence: false,
          showBlueBar: false,               // iOS: if true, user sees blue bar
          foregroundServiceEnabled: true,   // Android: show a persistent notif
        });
      } else {
        // If user logs out, stop tracking
        Radar.stopTracking();
      }
    });
    return () => unsubscribe();
  }, []);

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
