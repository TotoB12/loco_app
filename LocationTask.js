// LocationTask.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getAuth } from 'firebase/auth';

const LOCATION_TRACKING = 'LOCATION_TRACKING';

TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  if (!data) {
    return;
  }

  const { locations } = data;
  if (!locations || locations.length === 0) return;

  const location = locations[0];
  if (!location) return;

  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.log('No user, skipping location update');
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
      },
      locationTimestamp: serverTimestamp(),
    }, { merge: true });

    console.log('Background location updated:', location.coords);
  } catch (e) {
    console.error('Error updating location in Firestore:', e);
  }
});

export async function startLocationTracking() {
  console.log('Requesting permissions...');

  const fgPermission = await Location.requestForegroundPermissionsAsync();
  if (fgPermission.status !== 'granted') {
    console.log('No foreground permission');
    return;
  }

  const bgPermission = await Location.requestBackgroundPermissionsAsync();
  if (bgPermission.status !== 'granted') {
    console.log('No background permission');
    return;
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING);
  if (hasStarted) {
    console.log('Already started background location tracking');
    return;
  }

  console.log('Starting location updates...');
  await Location.startLocationUpdatesAsync(LOCATION_TRACKING, {
    accuracy: Location.Accuracy.Balanced,
    // On Android, tries to get an update at least every minute:
    timeInterval: 60000,
    // Or if you want to rely on movement:
    // distanceInterval: 50,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Location Tracking',
      notificationBody: 'Tracking location in the background',
      notificationColor: '#fff',
    },
  });
}

export async function stopLocationTracking() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING);
  if (hasStarted) {
    console.log('Stopping location updates...');
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING);
  }
}
