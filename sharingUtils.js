// sharingUtils.js
import { ref, update, get } from 'firebase/database';
import { db } from './firebaseConfig';

/**
 * Returns the sharing status between the current user and a target user.
 * @param {string} currentUid – Your UID.
 * @param {string} targetUid – The target user's UID.
 * @returns {Promise<{amSharing: boolean, amReceiving: boolean}>}
 */
export const getSharingStatus = async (currentUid, targetUid) => {
  try {
    // Check whether targetUid is in your sharingWith and receivingFrom lists.
    const sharingWithSnap = await get(ref(db, `users/${currentUid}/sharingWith/${targetUid}`));
    const receivingFromSnap = await get(ref(db, `users/${currentUid}/receivingFrom/${targetUid}`));
    return {
      amSharing: sharingWithSnap.exists(),
      amReceiving: receivingFromSnap.exists(),
    };
  } catch (error) {
    console.error('Error fetching sharing status:', error);
    return { amSharing: false, amReceiving: false };
  }
};

/**
 * Begins sharing your location with the target user.
 */
export const shareLocation = async (currentUid, targetUid) => {
  try {
    const updates = {};
    // Add targetUid to your sharingWith list…
    updates[`users/${currentUid}/sharingWith/${targetUid}`] = true;
    // …and add your uid to the target's receivingFrom list.
    updates[`users/${targetUid}/receivingFrom/${currentUid}`] = true;
    await update(ref(db), updates);
  } catch (error) {
    console.error('Error sharing location:', error);
  }
};

/**
 * Stops sharing your location with the target user.
 */
export const stopSharingLocation = async (currentUid, targetUid) => {
  try {
    const updates = {};
    // Remove targetUid from your sharingWith list…
    updates[`users/${currentUid}/sharingWith/${targetUid}`] = null;
    // …and remove your uid from the target's receivingFrom list.
    updates[`users/${targetUid}/receivingFrom/${currentUid}`] = null;
    await update(ref(db), updates);
  } catch (error) {
    console.error('Error stopping sharing location:', error);
  }
};

/**
 * Stops receiving the target user's location.
 */
export const stopReceivingLocation = async (currentUid, targetUid) => {
  try {
    const updates = {};
    // Remove targetUid from your receivingFrom list…
    updates[`users/${currentUid}/receivingFrom/${targetUid}`] = null;
    // …and remove your uid from the target's sharingWith list.
    updates[`users/${targetUid}/sharingWith/${currentUid}`] = null;
    await update(ref(db), updates);
  } catch (error) {
    console.error('Error stopping receiving location:', error);
  }
};
