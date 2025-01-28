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

  // --- SETUP RADAR EVENT LISTENERS ONE TIME ---
  useEffect(() => {
    // 1) Initialize Radar
    Radar.initialize('prj_live_pk_2bb1459eda8faeaf64aa70990ca689ee231f5b42');
    // 2) (Optional) Set log level to debug while developing
    Radar.setLogLevel('debug');

    // 3) Listen for location updates from Radar
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

    // 4) Listen for errors
    Radar.on('error', (err) => {
      console.error('Radar error =>', err);
    });

    // Cleanup on unmount
    return () => {
      Radar.off('location');
      Radar.off('error');
    };
  }, []);

  // --- AUTH STATE LISTENER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Identify user
        Radar.setUserId(currentUser.uid);
        Radar.setDescription(currentUser.email || 'Radar User');
        // Optionally store metadata:
        Radar.setMetadata({
          // e.g., user role or anything you want
          role: 'tester'
        });

        // Ensure location permissions
        // For best user experience, request foreground first, then background
        // (iOS requires two separate calls.)
        try {
          const fgStatus = await Radar.requestPermissions(false); // request foreground
          console.log('Foreground perms =>', fgStatus);

          if (fgStatus === 'GRANTED_FOREGROUND') {
            // Now request background
            const bgStatus = await Radar.requestPermissions(true); // request background
            console.log('Background perms =>', bgStatus);
          }
        } catch (err) {
          console.error('Error requesting Radar permissions =>', err);
        }

        // Start background tracking
        // Use a preset or custom options. For 1-min intervals, use custom:
        Radar.setForegroundServiceOptions({
          text: 'We are tracking your location in the background',
          title: 'Background Location Active',
          updatesOnly: false, // set to true if you only want the notification shown during movement
          importance: 2, // NotificationManager.IMPORTANCE_DEFAULT = 3, maybe set 2 if you want lower
        });

        Radar.startTrackingCustom({
          desiredStoppedUpdateInterval: 0,     // 0 means "shutdown" when stopped
          fastestStoppedUpdateInterval: 0,
          desiredMovingUpdateInterval: 60,     // 60 seconds
          fastestMovingUpdateInterval: 30,     // no faster than 30 sec
          desiredSyncInterval: 20,            // sync with server every 20 sec
          desiredAccuracy: 'high',
          stopDuration: 140,
          stopDistance: 70,
          replay: 'none',    // do not replay offline updates, or 'stops' if you want to
          sync: 'all',       // sync all location updates to server
          useStoppedGeofence: false,
          showBlueBar: false, // if set to true on iOS, you'll see the blue bar for background usage
          foregroundServiceEnabled: true, // show a notification on Android
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
