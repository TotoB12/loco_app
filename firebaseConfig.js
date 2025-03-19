// firebaseConfig.js
import authModule from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

// Export auth and database instances
export const auth = authModule();
export const db = database();