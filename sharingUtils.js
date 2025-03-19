import { ref, update, get } from '@react-native-firebase/database';
import { db } from './firebaseConfig';

export const getSharingStatus = async (currentUid, targetUid) => {
  const sharingWithSnap = await get(ref(db, `users/${currentUid}/sharingWith/${targetUid}`));
  const receivingFromSnap = await get(ref(db, `users/${currentUid}/receivingFrom/${targetUid}`));
  return {
    amSharing: sharingWithSnap.exists(),
    amReceiving: receivingFromSnap.exists(),
  };
};

export const shareLocation = async (currentUid, targetUid) => {
  const updates = {};
  updates[`users/${currentUid}/sharingWith/${targetUid}`] = true;
  updates[`users/${targetUid}/receivingFrom/${currentUid}`] = true;
  await update(ref(db), updates);
};

export const stopSharingLocation = async (currentUid, targetUid) => {
  const updates = {};
  updates[`users/${currentUid}/sharingWith/${targetUid}`] = null;
  updates[`users/${targetUid}/receivingFrom/${currentUid}`] = null;
  await update(ref(db), updates);
};

export const stopReceivingLocation = async (currentUid, targetUid) => {
  const updates = {};
  updates[`users/${currentUid}/receivingFrom/${targetUid}`] = null;
  updates[`users/${targetUid}/sharingWith/${currentUid}`] = null;
  await update(ref(db), updates);
};