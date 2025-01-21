// LocationTask.js

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig'; // Make sure this points to your db
import { getAuth } from 'firebase/auth'; // Only if you need currentUser from Firebase
import * as Location from 'expo-location';

const LOCATION_TRACKING = 'LOCATION_TRACKING';

// 1. Define the background task
TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (location) {
      try {
        // 2. Get the currently logged in user
        const auth = getAuth();
        const user = auth.currentUser; 
        // If user is logged out, do nothing
        if (!user) {
          console.log('No user, skipping location update');
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // 3. Send location data to Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(
          userRef,
          {
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              // You can store more data if you need:
              accuracy: location.coords.accuracy,
              altitude: location.coords.altitude,
              heading: location.coords.heading,
              speed: location.coords.speed
            },
            locationTimestamp: serverTimestamp(),
          },
          { merge: true }
        );

        console.log('Background location updated:', location.coords);
        // Return that we have new data
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (e) {
        console.error('Error updating location in Firestore:', e);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    }
  }

  // If no data, we return NoData
  return BackgroundFetch.BackgroundFetchResult.NoData;
});

export async function startLocationTracking() {
  console.log('Starting location tracking...');
  // Request permissions in case they haven't been granted yet:
  const fgPermission = await Location.requestForegroundPermissionsAsync();
  if (fgPermission.status !== 'granted') {
    console.log('Foreground location permission not granted');
    return;
  }

  const bgPermission = await Location.requestBackgroundPermissionsAsync();
  if (bgPermission.status !== 'granted') {
    console.log('Background location permission not granted');
    return;
  }

  // Check if task is already running
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING);
  if (hasStarted) {
    console.log('Already started background location updates');
    return;
  }

  // Start background location updates
  await Location.startLocationUpdatesAsync(LOCATION_TRACKING, {
    accuracy: Location.Accuracy.Balanced,  // or High if you need it
    // Optionally set the distance or time interval to reduce battery usage
    timeInterval: 60000, // Minimum time (ms) between updates ~ 1 minute
    // distanceInterval: 50, // Receive updates only when user moves 50 meters
    foregroundService: {
      notificationTitle: 'Location Tracking',
      notificationBody: 'We are tracking your location in the background',
      notificationColor: '#fff',
    },
    pausesUpdatesAutomatically: false,
    // On Android, set these to ensure the background service runs:
    showsBackgroundLocationIndicator: true,
  });

  // Also register the background fetch so iOS can schedule the task:
  await BackgroundFetch.registerTaskAsync(LOCATION_TRACKING, {
    minimumInterval: 60, // 1 minute
    stopOnTerminate: false,
    startOnBoot: true,
  });

  console.log('Background location tracking started');
}

export async function stopLocationTracking() {
  console.log('Stopping location tracking...');
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING);
  }
  // Unregister as well from background fetch
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING);
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(LOCATION_TRACKING);
  }
  console.log('Background location tracking stopped');
}
