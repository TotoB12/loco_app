// HomeScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from '@react-native-firebase/auth';
import { ref, onValue, update, get } from '@react-native-firebase/database';
import { auth, db } from '../firebaseConfig';
import Radar from 'react-native-radar';
import Mapbox, { MapView, LocationPuck, MarkerView, Camera, UserTrackingMode } from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { SearchBar, ListItem, Divider, Avatar, Card, Icon } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import BottomSheet, { BottomSheetScrollView, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { showLocation } from 'react-native-map-link';
import { Accelerometer } from 'expo-sensors';
import ConfettiCannon from 'react-native-confetti-cannon';

import {
  shareLocation,
  stopSharingLocation,
  stopReceivingLocation,
} from '../sharingUtils';

import { COLORS } from '../colors';
import AnimatedUserMarker from './AnimatedUserMarker';

const SHAKE_THRESHOLD = 1.7; // Experiment with this value
const MIN_TIME_BETWEEN_SHAKES_MS = 3000; // Prevent multiple triggers

/* -------------------------
   Utility Functions
------------------------- */
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - timestamp) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds} sec. ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} min. ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hr. ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 52) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  const diffInYears = Math.floor(diffInWeeks / 52);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

function getDistanceFromLatLonInMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const deg2rad = (deg) => deg * (Math.PI / 180);
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
    Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* -------------------------
   Live Components
------------------------- */
const LiveTimeAgo = ({ timestamp }) => {
  const [timeAgo, setTimeAgo] = useState(getTimeAgo(timestamp));
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo(timestamp));
    }, 1000); // Update every second for smoother changes
    return () => clearInterval(interval);
  }, [timestamp]);
  return <Text>{timeAgo}</Text>;
};

const LiveDistance = ({ currentLocation, userLocation, textStyle = styles.distanceText }) => {
  const [distanceText, setDistanceText] = useState("");
  useEffect(() => {
    const calculateDistance = () => {
      if (currentLocation && userLocation) {
        const distance = getDistanceFromLatLonInMiles(
          currentLocation.latitude,
          currentLocation.longitude,
          userLocation.latitude,
          userLocation.longitude
        );
        setDistanceText(distance.toFixed(1) + ' mi');
      } else {
        setDistanceText("");
      }
    };
    calculateDistance();
    const interval = setInterval(calculateDistance, 1000); // Update every second
    return () => clearInterval(interval);
  }, [currentLocation, userLocation]);
  return <Text style={textStyle}>{distanceText}</Text>;
};

/* -------------------------
   Bottom Sheet User Item 
   (for map’s people list)
------------------------- */
const BottomSheetUserItem = ({ user, currentLocation, onPress }) => {
  return (
    <View>
      <ListItem
        containerStyle={{ backgroundColor: 'transparent', paddingLeft: 20, paddingRight: 20 }}
        onPress={onPress}
      >
        <Avatar
          rounded
          source={
            user.avatar && user.avatar.link
              ? { uri: user.avatar.link }
              : { uri: "data:image/png" }
          }
          icon={
            !user.avatar || !user.avatar.link
              ? { name: 'person-outline', type: 'material', size: 24 }
              : undefined
          }
          size={40}
          containerStyle={
            !user.avatar || !user.avatar.link
              ? { backgroundColor: '#c2c2c2' }
              : {}
          }
        />
        <View style={{ flex: 1 }}>
          <View style={styles.userItemHeader}>
            <Text style={styles.userNameText}>
              {(`${user.firstName || ''} ${user.lastName || ''}`).trim()}
            </Text>
            <LiveDistance currentLocation={currentLocation} userLocation={user.location} textStyle={styles.distanceText} />
          </View>
          <Text style={styles.timestampText}>
            <LiveTimeAgo timestamp={user.locationTimestamp} />
          </Text>
        </View>
      </ListItem>
      <Divider style={{ width: '80%', alignSelf: 'center' }} />
    </View>
  );
};

/* -------------------------
   Social User Item 
   (for People modal – with sharing status text)
------------------------- */
const SocialUserItem = ({ user, sharingWithIds, receivingFromIds, onPress }) => {
  const [statusText, setStatusText] = useState('');
  useEffect(() => {
    const amSharing = sharingWithIds.includes(user.uid);
    const amReceiving = receivingFromIds.includes(user.uid);
    let text = '';
    if (amSharing && amReceiving) {
      text = 'Both of you are sharing';
    } else if (amSharing && !amReceiving) {
      text = 'Receiving your location';
    } else if (!amSharing && amReceiving) {
      text = 'Is sharing with you';
    } else {
      text = 'Neither of you are sharing';
    }
    setStatusText(text);
  }, [user, sharingWithIds, receivingFromIds]);
  return (
    <View>
      <ListItem onPress={() => onPress(user)}>
        <Avatar
          rounded
          source={
            user.avatar && user.avatar.link
              ? { uri: user.avatar.link }
              : { uri: "data:image/png" }
          }
          icon={
            !user.avatar || !user.avatar.link
              ? { name: 'person-outline', type: 'material', size: 26 }
              : undefined
          }
          size={40}
          containerStyle={
            !user.avatar || !user.avatar.link
              ? { backgroundColor: '#c2c2c2' }
              : {}
          }
        />
        <View style={{ flex: 1 }}>
          <View style={styles.userItemHeader}>
            <Text style={styles.userNameText}>
              {(`${user.firstName || ''} ${user.lastName || ''}`).trim()}
            </Text>
          </View>
          <Text style={styles.timestampText}>{statusText}</Text>
        </View>
      </ListItem>
      <Divider style={{ width: '80%', alignSelf: 'center' }} />
    </View>
  );
};

/* -------------------------
   Sharing Options Dialog 
   (for People modal items only)
------------------------- */
function SharingDialog({ targetUser, sharingStatus, onShare, onStopSharing, onStopReceiving, onClose }) {
  let message = '';
  let actions = [];
  const userName = (`${targetUser.firstName || ''} ${targetUser.lastName || ''}`).trim() || 'this user';
  if (sharingStatus.amSharing && !sharingStatus.amReceiving) {
    message = `You are sharing your location with ${userName}`;
    actions.push({ title: 'Stop Sharing My Location', onPress: onStopSharing, color: 'red' });
  } else if (!sharingStatus.amSharing && sharingStatus.amReceiving) {
    message = `${userName} is sharing their location`;
    actions.push({ title: 'Share My Location', onPress: onShare, color: COLORS.black });
    actions.push({ title: `Remove ${userName}`, onPress: onStopReceiving, color: 'red' });
  } else if (sharingStatus.amSharing && sharingStatus.amReceiving) {
    message = 'You are both sharing';
    actions.push({ title: 'Stop Sharing My Location', onPress: onStopSharing, color: 'red' });
    actions.push({ title: `Remove ${userName}`, onPress: onStopReceiving, color: 'red' });
  } else {
    message = 'Neither of you are sharing';
    actions.push({ title: 'Share My Location', onPress: onShare, color: COLORS.black });
  }

  return (
    <View style={SharingStyles.dialogContainer}>
      <Text style={SharingStyles.dialogTitle}>{userName}</Text>
      <Text style={SharingStyles.dialogMessage}>{message}</Text>
      <View style={SharingStyles.buttonsContainer}>
        {actions.map((action, index) => (
          <React.Fragment key={index}>
            {index > 0 && <Divider style={SharingStyles.divider} />}
            <TouchableOpacity
              style={SharingStyles.button}
              onPress={() => {
                action.onPress();
                onClose();
              }}
            >
              <Text style={[SharingStyles.buttonText, { color: action.color }]}>
                {action.title}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
        <Divider style={SharingStyles.divider} />
        <TouchableOpacity
          style={SharingStyles.button}
          onPress={onClose}
        >
          <Text style={[SharingStyles.buttonText, { color: '#888' }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* -------------------------
   Main HomeScreen Component
------------------------- */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

  // Map & location state
  const [currentLocation, setCurrentLocation] = useState(null);
  const cameraRef = useRef(null);
  const initialCameraCentered = useRef(false);
  const [tracking, setTracking] = useState(false);
  const [heading, setHeading] = useState(0);

  const [followingUserId, setFollowingUserId] = useState(null);
  const [isUpdatingCamera, setIsUpdatingCamera] = useState(false);

  // Modal & UI state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFirstName, setSettingsFirstName] = useState('');
  const [settingsLastName, setSettingsLastName] = useState('');
  const [firstNameError, setFirstNameError] = useState(false);
  const [lastNameError, setLastNameError] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [avatarData, setAvatarData] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [showSocial, setShowSocial] = useState(false);
  const [expanded1, setExpanded1] = useState(false);
  const [expanded2, setExpanded2] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Real-time sharing list states
  const [sharingWithIds, setSharingWithIds] = useState([]);
  const [receivingFromIds, setReceivingFromIds] = useState([]);
  const [sharingWithData, setSharingWithData] = useState({});
  const [receivingFromData, setReceivingFromData] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return { ... (receivingFromData[selectedUserId] || {}), ... (sharingWithData[selectedUserId] || {}) };
  }, [selectedUserId, receivingFromData, sharingWithData]);

  // Animated fade for the People modal sharing options dialog
  const [fadeAnim] = useState(new Animated.Value(0));
  const [selectedSocialUser, setSelectedSocialUser] = useState(null);
  useEffect(() => {
    if (selectedSocialUser) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [selectedSocialUser]);

  const BOTTOM_SHEET_PERCENTAGE = 0.32;
  const bottomInset = screenHeight * BOTTOM_SHEET_PERCENTAGE;

  const confettiRef = useRef(null);

  const lastShakeTime = useRef(0);
  const lastAcceleration = useRef({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    let subscription;
    const _subscribe = () => {
      Accelerometer.setUpdateInterval(100); // Check ~10 times/sec
      subscription = Accelerometer.addListener(accelerometerData => {
        const { x, y, z } = accelerometerData;
        const now = Date.now();

        // Calculate the change in acceleration
        const deltaX = Math.abs(lastAcceleration.current.x - x);
        const deltaY = Math.abs(lastAcceleration.current.y - y);
        const deltaZ = Math.abs(lastAcceleration.current.z - z);

        // Simple shake detection: sum of changes above threshold
        const accelerationChange = deltaX + deltaY + deltaZ;

        if (
          accelerationChange > SHAKE_THRESHOLD &&
          now - lastShakeTime.current > MIN_TIME_BETWEEN_SHAKES_MS
        ) {
          console.log('Shake detected!');
          lastShakeTime.current = now;

          // Trigger confetti
          confettiRef.current?.start();
        }

        lastAcceleration.current = { x, y, z };
      });
    };

    const _unsubscribe = () => {
      subscription && subscription.remove();
      subscription = null;
    };

    _subscribe();

    // Cleanup on unmount
    return () => _unsubscribe();
  }, []);

  const updateCameraToUser = (user) => {
    if (!user || !user.location) return;
    setIsUpdatingCamera(true);
    cameraRef.current?.setCamera({
      centerCoordinate: [user.location.longitude, user.location.latitude],
      zoomLevel: 16,
      padding: { paddingTop: 0, paddingRight: 0, paddingBottom: bottomInset, paddingLeft: 0 },
      animationMode: 'easeTo',
      animationDuration: 1000,
    });
    setTimeout(() => setIsUpdatingCamera(false), 1100);
  };

  useEffect(() => {
    if (!showSocial) {
      setSearch('');
      setExpanded1(true);
      setExpanded2(false);
    }
  }, [showSocial]);

  useEffect(() => {
    Mapbox.setAccessToken('pk.eyJ1IjoidG90b2IxMjE3IiwiYSI6ImNsbXo4NHdocjA4dnEya215cjY0aWJ1cGkifQ.OMzA6Q8VnHLHZP-P8ACBRw');
    Mapbox.setTelemetryEnabled(false);
  }, []);

  // Radar foreground tracking
  useEffect(() => {
    const trackLocation = () => {
      Radar.trackOnce({ desiredAccuracy: 'high' })
        .then((result) => {
          if (result.location) {
            setCurrentLocation(result.location);
          }
        })
        .catch((err) => {
          console.log('Radar trackOnce error =>', err);
        });
    };
    trackLocation();
    const intervalId = setInterval(trackLocation, 10000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (currentLocation && !initialCameraCentered.current) {
      cameraRef.current?.setCamera({
        centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
        zoomLevel: 16,
        padding: { paddingTop: 0, paddingRight: 0, paddingBottom: bottomInset, paddingLeft: 0 },
        animationMode: 'none',
        animationDuration: 0,
      });
      initialCameraCentered.current = true;
    }
  }, [currentLocation]);

  // Real‑time sharing lists subscriptions
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const sharingWithRef = ref(db, `users/${currentUser.uid}/sharingWith`);
    const unsubscribe = onValue(sharingWithRef, (snapshot) => {
      const data = snapshot.val() || {};
      setSharingWithIds(Object.keys(data));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const receivingFromRef = ref(db, `users/${currentUser.uid}/receivingFrom`);
    const unsubscribe = onValue(receivingFromRef, (snapshot) => {
      const data = snapshot.val() || {};
      setReceivingFromIds(Object.keys(data));
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to each user in "sharingWith"
  const sharingWithListenersRef = useRef({});
  useEffect(() => {
    Object.keys(sharingWithListenersRef.current).forEach((uid) => {
      if (!sharingWithIds.includes(uid)) {
        sharingWithListenersRef.current[uid]();
        delete sharingWithListenersRef.current[uid];
        setSharingWithData((prev) => {
          const newData = { ...prev };
          delete newData[uid];
          return newData;
        });
      }
    });
    sharingWithIds.forEach((uid) => {
      if (!sharingWithListenersRef.current[uid]) {
        const userRef = ref(db, `users/${uid}`);
        const unsubscribe = onValue(userRef, (snapshot) => {
          const userData = snapshot.val();
          setSharingWithData((prev) => ({ ...prev, [uid]: { uid, ...userData } }));
        });
        sharingWithListenersRef.current[uid] = unsubscribe;
      }
    });
  }, [sharingWithIds]);

  useEffect(() => {
    return () => {
      Object.values(sharingWithListenersRef.current).forEach((unsubscribe) => unsubscribe());
      sharingWithListenersRef.current = {};
    };
  }, []);

  // Subscribe to each user in "receivingFrom"
  const receivingFromListenersRef = useRef({});
  useEffect(() => {
    Object.keys(receivingFromListenersRef.current).forEach((uid) => {
      if (!receivingFromIds.includes(uid)) {
        receivingFromListenersRef.current[uid]();
        delete receivingFromListenersRef.current[uid];
        setReceivingFromData((prev) => {
          const newData = { ...prev };
          delete newData[uid];
          return newData;
        });
      }
    });
    receivingFromIds.forEach((uid) => {
      if (!receivingFromListenersRef.current[uid]) {
        const userRef = ref(db, `users/${uid}`);
        const unsubscribe = onValue(userRef, (snapshot) => {
          const userData = snapshot.val();
          setReceivingFromData((prev) => ({ ...prev, [uid]: { uid, ...userData } }));
        });
        receivingFromListenersRef.current[uid] = unsubscribe;
      }
    });
  }, [receivingFromIds]);

  useEffect(() => {
    return () => {
      Object.values(receivingFromListenersRef.current).forEach((unsubscribe) => unsubscribe());
      receivingFromListenersRef.current = {};
    };
  }, []);

  // Compute markers from receivingFrom users
  const markers = useMemo(() => {
    return Object.values(receivingFromData).filter((user) => user.location);
  }, [receivingFromData]);

  // Search Users (excluding self)
  useEffect(() => {
    if (search.trim().length > 0) {
      const currentUser = auth.currentUser;
      const usersRef = ref(db, 'users');
      get(usersRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const usersData = snapshot.val();
            const searchLower = search.toLowerCase();
            let results = [];
            for (const uid in usersData) {
              if (currentUser && uid === currentUser.uid) continue;
              const user = usersData[uid];
              const fullName = ((user.firstName || '') + ' ' + (user.lastName || '')).trim().toLowerCase();
              const email = (user.email || '').toLowerCase();
              if (fullName.includes(searchLower) || email.includes(searchLower)) {
                results.push({ uid, ...user });
              }
            }
            setSearchResults(results);
          } else {
            setSearchResults([]);
          }
        })
        .catch((err) => {
          console.error('Error fetching users:', err);
          setSearchResults([]);
        });
    } else {
      setSearchResults([]);
    }
  }, [search]);

  // Settings modal: fetch current profile data
  useEffect(() => {
    if (showSettings) {
      setFirstNameError(false);
      setLastNameError(false);
      const user = auth.currentUser;
      if (user) {
        get(ref(db, 'users/' + user.uid))
          .then((snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              setSettingsFirstName(data.firstName || '');
              setSettingsLastName(data.lastName || '');
              if (data.avatar) {
                setAvatarData(data.avatar);
                setAvatarUri(data.avatar.link || null);
              } else {
                setAvatarData(null);
                setAvatarUri(null);
              }
            }
          })
          .catch((err) => {
            console.log('Error fetching settings data:', err);
          });
      }
    }
  }, [showSettings]);

  // If a user is open in the modal and they stop sharing, close the modal
  useEffect(() => {
    if (selectedUserId && !receivingFromIds.includes(selectedUserId) && !sharingWithIds.includes(selectedUserId)) {
      closeUserInfo();
    }
  }, [selectedUserId, receivingFromIds, sharingWithIds]);

  // Compute sharing status for the modal using selectedUserId
  const userSharingStatus = useMemo(() => {
    if (!selectedUserId) return { amSharing: false, amReceiving: false };
    return {
      amSharing: sharingWithIds.includes(selectedUserId),
      amReceiving: receivingFromIds.includes(selectedUserId)
    };
  }, [selectedUserId, sharingWithIds, receivingFromIds]);

  useEffect(() => {
    if (followingUserId && selectedUser && selectedUser.uid === followingUserId) {
      updateCameraToUser(selectedUser);
    }
  }, [selectedUser?.location?.latitude, selectedUser?.location?.longitude, followingUserId]);

  // Reverse geocode for user info modal: update whenever the selected user's location changes
  const [selectedUserLocationName, setSelectedUserLocationName] = useState("");
  const fetchReverseGeocode = async (lat, lon) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            'User-Agent': 'loco_app/1.0 (loco@totob12.com)'
          }
        }
      );
      const data = await response.json();
      if (data && data.display_name) {
        setSelectedUserLocationName(data.display_name);
      } else {
        setSelectedUserLocationName("Location not found");
      }
    } catch (error) {
      console.error("Error fetching reverse geocode:", error);
      setSelectedUserLocationName("Error fetching location");
    }
  };

  useEffect(() => {
    if (selectedUser && selectedUser.location) {
      fetchReverseGeocode(selectedUser.location.latitude, selectedUser.location.longitude);
    }
  }, [selectedUser?.location?.latitude, selectedUser?.location?.longitude, selectedUser?.locationTimestamp]);

  // Handlers for People modal (social user items)
  const handleSocialUserPress = (user) => {
    setSelectedSocialUser(user);
  };

  // Handlers for main bottom sheet user items
  // **Modified openUserInfo to Initiate Following**
  const bottomSheetRef = useRef(null);
  const userInfoModalRef = useRef(null);
  const snapPoints = useMemo(() => ['10%', '45%', '80%'], []);
  const openUserInfo = (user) => {
    setSelectedUserId(user.uid);
    setFollowingUserId(user.uid); // Start following the user
    updateCameraToUser(user); // Initial camera move
    bottomSheetRef.current?.close();
  };

  // **Modified closeUserInfo to Stop Following**
  const closeUserInfo = () => {
    userInfoModalRef.current?.dismiss();
    setSelectedUserId(null);
    setFollowingUserId(null); // Stop following
    bottomSheetRef.current?.snapToIndex(1);
  };

  useEffect(() => {
    if (selectedUser && userInfoModalRef.current) {
      userInfoModalRef.current.present();
    }
  }, [selectedUser]);

  const handleCameraChanged = (event) => {
    setHeading(event.properties.heading);
    if (!isUpdatingCamera && followingUserId) {
      setFollowingUserId(null); // Stop following if user interacts with the map
    }
  };

  // Toggle tracking
  const toggleTracking = () => {
    if (!tracking) {
      setTracking(true);
      if (currentLocation) {
        cameraRef.current?.setCamera({
          centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
          zoomLevel: 16,
          padding: { paddingTop: 0, paddingRight: 0, paddingBottom: bottomInset, paddingLeft: 0 },
          animationMode: 'flyTo',
          animationDuration: 1000,
        });
      }
    } else {
      setTracking(false);
    }
  };

  // Toggle heading
  const resetHeading = () => {
    cameraRef.current?.setCamera({
      heading: 0,
      animationDuration: 300,
    });
  };

  // Name validation and update
  const validateName = (name) => {
    const regex = /^[A-Za-z]+$/;
    return name.trim().length > 0 && name.length <= 20 && regex.test(name);
  };

  const handleFirstNameChange = (text) => {
    setSettingsFirstName(text);
    if (validateName(text)) {
      setFirstNameError(false);
      const user = auth.currentUser;
      if (user) {
        update(ref(db, 'users/' + user.uid), { firstName: text }).catch((err) =>
          console.log('Error updating first name:', err)
        );
      }
    } else {
      setFirstNameError(true);
    }
  };

  const handleLastNameChange = (text) => {
    setSettingsLastName(text);
    if (validateName(text)) {
      setLastNameError(false);
      const user = auth.currentUser;
      if (user) {
        update(ref(db, 'users/' + user.uid), { lastName: text }).catch((err) =>
          console.log('Error updating last name:', err)
        );
      }
    } else {
      setLastNameError(true);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log('Error signing out:', error);
    }
  };

  // Image upload handlers (unchanged)
  const IMGUR_CLIENT_ID = '4916641447bc9f6';

  const deleteImgurImage = async (deleteHash) => {
    try {
      const authHeader = 'Client-ID ' + IMGUR_CLIENT_ID;
      const response = await fetch(`https://api.imgur.com/3/image/${deleteHash}`, {
        method: 'DELETE',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });
      const result = await response.json();
      if (result.success) {
        console.log('Old avatar deleted successfully from Imgur');
      } else {
        console.error('Failed to delete old avatar from Imgur:', result);
      }
    } catch (error) {
      console.error('Error deleting old avatar:', error);
    }
  };

  const resizeImageIfNeeded = async (uri, width, height) => {
    if (width <= 500 && height <= 500) {
      return uri;
    }
    const maxDimension = 1000;
    const scaleFactor = Math.min(maxDimension / width, maxDimension / height);
    const newWidth = Math.round(width * scaleFactor);
    const newHeight = Math.round(height * scaleFactor);
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: newWidth, height: newHeight } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  };

  const uploadImage = async (uri) => {
    try {
      setUploading(true);
      let formData = new FormData();
      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      formData.append('image', {
        uri: uri,
        name: `avatar.${fileType}`,
        type: `image/${fileType}`,
      });
      const authHeader = 'Client-ID ' + IMGUR_CLIENT_ID;
      const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        if (avatarData && avatarData.deletehash) {
          await deleteImgurImage(avatarData.deletehash);
        }
        const currentUser = auth.currentUser;
        if (currentUser) {
          await update(ref(db, 'users/' + currentUser.uid), { avatar: result.data });
          setAvatarData(result.data);
          setAvatarUri(result.data.link);
          Alert.alert('Success', 'Avatar updated successfully.');
        } else {
          Alert.alert('Error', 'User not logged in.');
        }
      } else {
        console.error('Imgur upload failed:', result);
        Alert.alert('Upload failed', 'Failed to upload image to Imgur.');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'An error occurred while uploading the image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access the media library is required!');
      return;
    }
    let pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!pickerResult.canceled) {
      const asset = pickerResult.assets[0];
      const resizedUri = await resizeImageIfNeeded(asset.uri, asset.width, asset.height);
      await uploadImage(resizedUri);
    }
  };

  const handleRemovePicture = async () => {
    if (!avatarData || !avatarData.deletehash) {
      Alert.alert('No avatar', 'No avatar to remove.');
      return;
    }
    try {
      setUploading(true);
      await deleteImgurImage(avatarData.deletehash);
      const currentUser = auth.currentUser;
      if (currentUser) {
        await update(ref(db, 'users/' + currentUser.uid), { avatar: null });
        setAvatarData(null);
        setAvatarUri(null);
        Alert.alert('Success', 'Avatar removed successfully.');
      } else {
        Alert.alert('Error', 'User not logged in.');
      }
    } catch (error) {
      console.error('Error removing avatar:', error);
      Alert.alert('Error', 'An error occurred while removing the avatar.');
    } finally {
      setUploading(false);
    }
  };

  // Handlers for toggling sharing in user info modal
  const handleToggleShare = async () => {
    if (!selectedUser) return;
    if (userSharingStatus.amSharing) {
      await stopSharingLocation(auth.currentUser.uid, selectedUser.uid);
    } else {
      await shareLocation(auth.currentUser.uid, selectedUser.uid);
    }
  };

  const handleRemoveSharing = async () => {
    if (!selectedUser) return;
    await stopReceivingLocation(auth.currentUser.uid, selectedUser.uid);
    setTimeout(() => {
      if (!receivingFromIds.includes(selectedUser.uid)) {
        closeUserInfo();
      }
    }, 500);
  };

  // Sharing status for People modal item
  const socialUserSharingStatus = selectedSocialUser
    ? {
      amSharing: sharingWithIds.includes(selectedSocialUser.uid),
      amReceiving: receivingFromIds.includes(selectedSocialUser.uid),
    }
    : { amSharing: false, amReceiving: false };

  const handleDirections = () => {
    if (!selectedUser || !selectedUser.location) return;
    const { latitude, longitude } = selectedUser.location;
    showLocation({
      latitude: latitude,
      longitude: longitude,
      title: `${selectedUser.firstName || 'User'} ${selectedUser.lastName || ''}`,
      dialogTitle: 'This is the dialog Title',
    });
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <View style={styles.container}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, pointerEvents: 'none' }}>
            <ConfettiCannon
              ref={confettiRef}
              count={200} // Number of confetti pieces
              origin={{ x: screenWidth / 2, y: -10 }} // Start from center-top
              autoStart={false} // Don't start automatically
              fadeOut={true} // Fade out at the end
              explosionSpeed={400} // How fast they explode outwards
              fallSpeed={3000} // How fast they fall down
            />
          </View>
          <MapView
            style={StyleSheet.absoluteFillObject}
            attributionEnabled={false}
            logoEnabled={false}
            scaleBarEnabled={false}
            compassEnabled={false}
            pitchEnabled={false}
            onCameraChanged={handleCameraChanged}
          >
            <LocationPuck
              topImage="topImage"
              visible={true}
              pulsing={{
                isEnabled: true,
                color: COLORS.navy,
                radius: 50.0,
              }}
            />
            <Camera
              ref={cameraRef}
              zoomLevel={16}
              followUserLocation={tracking}
              followUserMode={UserTrackingMode.Follow}
              followZoomLevel={16}
              onUserTrackingModeChange={(event) => {
                if (!event.nativeEvent.payload.followUserLocation && tracking) {
                  setTracking(false);
                }
              }}
            />
            {markers.map((user) => (
              <AnimatedUserMarker
                key={user.uid}
                user={user}
                onPress={() => openUserInfo(user)}
              />
            ))}
          </MapView>

          {/* Top row with Settings and People buttons */}
          <View style={[styles.topRow, { top: insets.top }]}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowSettings(true)}>
              <MaterialIcons name="settings" size={24} color="black" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowSocial(true)}>
              <FontAwesome5 name="user-friends" size={20} color="black" />
            </TouchableOpacity>
          </View>

          {/* Second row with location tracking and compass buttons */}
          <View style={[styles.topRow, { top: insets.top + 55 }]}>
            <TouchableOpacity style={styles.iconButton} onPress={resetHeading}>
              <FontAwesome5
                name="compass"
                size={24}
                color="black"
                style={{ transform: [{ rotate: `${-heading - 45}deg` }] }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, tracking && styles.trackButtonActive]}
              onPress={toggleTracking}
            >
              <MaterialIcons name="my-location" size={24} color={tracking ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          {/* Settings Modal */}
          <Modal
            animationType="slide"
            transparent={false}
            visible={showSettings}
            onRequestClose={() => setShowSettings(false)}
          >
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Settings</Text>
                <TouchableOpacity onPress={() => setShowSettings(false)}>
                  <MaterialIcons name="close" size={28} color="#000" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScroll}>
                <View style={styles.currentLocationContainer}>
                  {currentLocation ? (
                    <Text style={styles.currentLocationText}>
                      {currentLocation.latitude.toFixed(6)} {currentLocation.longitude.toFixed(6)}
                    </Text>
                  ) : (
                    <Text style={styles.currentLocationText}>No location yet...</Text>
                  )}
                </View>
                <View style={styles.avatarContainer}>
                  <Avatar
                    size={100}
                    rounded
                    source={avatarUri ? { uri: avatarUri } : { uri: "data:image/png" }}
                    icon={!avatarUri ? { name: 'person', type: 'material' } : undefined}
                    containerStyle={styles.avatar}
                  />
                  {uploading && (
                    <ActivityIndicator style={{ marginVertical: 10 }} size="small" color="#00ADB5" />
                  )}
                  <View style={styles.avatarButtonsContainer}>
                    <TouchableOpacity style={styles.avatarButton} onPress={handleSelectImage} disabled={uploading}>
                      <Text style={styles.avatarButtonText}>{avatarUri ? 'Replace Image' : 'Select Image'}</Text>
                    </TouchableOpacity>
                    {avatarUri && (
                      <TouchableOpacity style={styles.avatarButton} onPress={handleRemovePicture} disabled={uploading}>
                        <Text style={styles.avatarButtonText}>Remove Picture</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={[styles.input, firstNameError && styles.errorInput]}
                  placeholder="First Name"
                  value={settingsFirstName}
                  onChangeText={handleFirstNameChange}
                />
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={[styles.input, lastNameError && styles.errorInput]}
                  placeholder="Last Name"
                  value={settingsLastName}
                  onChangeText={handleLastNameChange}
                />
              </ScrollView>
              <View style={styles.modalFooter}>
                <Text>Don't login to multiple phone, this will break.</Text>
                <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
                  <Text style={styles.logoutButtonText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>

          {/* People (Social) Modal */}
          <Modal
            animationType="slide"
            transparent={false}
            visible={showSocial}
            onRequestClose={() => setShowSocial(false)}
          >
            <SafeAreaView style={styles.modalContainer}>
              {selectedSocialUser && (
                <Animated.View style={[dialogStyles.overlay, { opacity: fadeAnim }]}>
                  <TouchableOpacity
                    style={dialogStyles.overlay}
                    onPress={() => setSelectedSocialUser(null)}
                    activeOpacity={1}
                  >
                    <View style={dialogStyles.dialogBox} onStartShouldSetResponder={() => true}>
                      <SharingDialog
                        targetUser={selectedSocialUser}
                        sharingStatus={socialUserSharingStatus}
                        onShare={async () => {
                          await shareLocation(auth.currentUser.uid, selectedSocialUser.uid);
                        }}
                        onStopSharing={async () => {
                          await stopSharingLocation(auth.currentUser.uid, selectedSocialUser.uid);
                        }}
                        onStopReceiving={async () => {
                          await stopReceivingLocation(auth.currentUser.uid, selectedSocialUser.uid);
                        }}
                        onClose={() => setSelectedSocialUser(null)}
                      />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>People</Text>
                <TouchableOpacity onPress={() => setShowSocial(false)}>
                  <MaterialIcons name="close" size={28} color="#000" />
                </TouchableOpacity>
              </View>
              <View style={styles.searchContainer}>
                <SearchBar
                  placeholder="Search..."
                  onChangeText={setSearch}
                  value={search}
                  platform="default"
                  containerStyle={{ backgroundColor: 'transparent', borderTopWidth: 0, borderBottomWidth: 0 }}
                  inputContainerStyle={styles.searchInputContainer}
                  inputStyle={styles.searchInput}
                />
              </View>

              <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScroll}>
                {search.trim().length > 0 ? (
                  <>
                    {searchResults.length > 0 ? (
                      searchResults.map((user) => (
                        <SocialUserItem
                          key={user.uid}
                          user={user}
                          sharingWithIds={sharingWithIds}
                          receivingFromIds={receivingFromIds}
                          onPress={handleSocialUserPress}
                        />
                      ))
                    ) : (
                      <Text style={{ textAlign: 'center', marginTop: 20 }}>No users found.</Text>
                    )}
                  </>
                ) : (
                  <>
                    <ListItem.Accordion
                      content={
                        <ListItem.Content>
                          <ListItem.Title>Receiving Locations ({receivingFromIds.length})</ListItem.Title>
                        </ListItem.Content>
                      }
                      isExpanded={expanded2}
                      onPress={() => setExpanded2(!expanded2)}
                    >
                      {Object.values(receivingFromData).length > 0 ? (
                        Object.values(receivingFromData).map((user) => (
                          <SocialUserItem
                            key={user.uid}
                            user={user}
                            sharingWithIds={sharingWithIds}
                            receivingFromIds={receivingFromIds}
                            onPress={handleSocialUserPress}
                          />
                        ))
                      ) : (
                        <Text style={{ margin: 20, textAlign: 'center' }}>
                          Nobody has shared with you yet.
                        </Text>
                      )}
                    </ListItem.Accordion>
                    <Divider style={{ width: '100%' }} insetType="middle" width={1} orientation="horizontal" />
                    <ListItem.Accordion
                      content={
                        <ListItem.Content>
                          <ListItem.Title>Sharing With ({sharingWithIds.length})</ListItem.Title>
                        </ListItem.Content>
                      }
                      isExpanded={expanded1}
                      onPress={() => setExpanded1(!expanded1)}
                    >
                      {Object.values(sharingWithData).length > 0 ? (
                        Object.values(sharingWithData).map((user) => (
                          <SocialUserItem
                            key={user.uid}
                            user={user}
                            sharingWithIds={sharingWithIds}
                            receivingFromIds={receivingFromIds}
                            onPress={handleSocialUserPress}
                          />
                        ))
                      ) : (
                        <Text style={{ margin: 20, textAlign: 'center' }}>
                          You are not sharing your location yet.
                        </Text>
                      )}
                    </ListItem.Accordion>
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* Main Bottom Sheet */}
          <BottomSheet
            ref={bottomSheetRef}
            index={1}
            snapPoints={snapPoints}
            enableDynamicSizing={false}
            enablePanDownToClose={false}
            backgroundStyle={{ borderRadius: 20 }}
          >
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>People</Text>
            </View>
            <Divider style={{ width: '100%' }} />
            <BottomSheetScrollView contentContainerStyle={styles.bottomSheetContent}>
              {Object.values(receivingFromData).length > 0 ? (
                Object.values(receivingFromData).map((user) => (
                  <BottomSheetUserItem
                    key={user.uid}
                    user={user}
                    currentLocation={currentLocation}
                    onPress={() => openUserInfo(user)}
                  />
                ))
              ) : (
                <Text style={{ textAlign: 'center', padding: 20 }}>
                  No one is sharing location with you.
                </Text>
              )}
            </BottomSheetScrollView>
          </BottomSheet>

          {/* User Info Bottom Sheet Modal */}
          <BottomSheetModal
            ref={userInfoModalRef}
            index={0}
            snapPoints={['45%', '80%']}
            enableDynamicSizing={false}
            onDismiss={closeUserInfo}
            backgroundStyle={{ borderRadius: 20 }}
          >
            {selectedUser && (
              <BottomSheetScrollView style={{ paddingLeft: 20, paddingRight: 20 }}>
                <View style={styles.userInfoHeader}>
                  <Text style={styles.userInfoName}>
                    {(`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`).trim()}
                  </Text>
                  <TouchableOpacity style={styles.userInfoCloseButton} onPress={closeUserInfo}>
                    <MaterialIcons name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.userInfoLocation}>
                  {selectedUserLocationName ? selectedUserLocationName : "Loading location..."}
                </Text>
                <Text style={styles.userInfoTimestamp}>
                  <LiveTimeAgo timestamp={selectedUser.locationTimestamp} />
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10, alignItems: 'stretch' }}>
                  <TouchableOpacity style={{ flex: 1, marginRight: 5 }}
                    onPress={() => Alert.alert('Notifications', 'This feature is coming soon!')}
                  >
                    <Card containerStyle={[styles.cardOptionContainer, { flex: 1 }]}>
                      <View style={styles.cardContent}>
                        <View style={[styles.iconCircle, { backgroundColor: COLORS.green }]}>
                          <Icon name="notifications" size={26} color="white" />
                        </View>
                        <Text style={styles.cardTitle}>Notifications</Text>
                      </View>
                    </Card>
                  </TouchableOpacity>

                  <TouchableOpacity style={{ flex: 1, marginLeft: 5 }} onPress={handleDirections}>
                    <Card containerStyle={[styles.cardOptionContainer, { flex: 1 }]}>
                      <View style={styles.cardContent}>
                        <View style={[styles.iconCircle, { backgroundColor: COLORS.navy }]}>
                          <Icon name="directions" size={26} color="white" />
                        </View>
                        <View>
                          <Text style={styles.cardTitle}>Directions</Text>
                          <LiveDistance
                            currentLocation={currentLocation}
                            userLocation={selectedUser.location}
                            textStyle={styles.cardSubtitle}
                          />
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                </View>

                <View style={styles.userInfoButtonsContainer}>
                  <TouchableOpacity style={styles.userInfoButton} onPress={handleToggleShare}>
                    <Text style={[styles.userInfoButtonText, { color: userSharingStatus.amSharing ? "red" : COLORS.black }]}>
                      {userSharingStatus.amSharing ? "Stop Sharing My Location" : "Share My Location"}
                    </Text>
                  </TouchableOpacity>
                  <Divider style={{ width: '100%', marginVertical: 5 }} />
                  {userSharingStatus.amReceiving && (
                    <TouchableOpacity style={styles.userInfoButton} onPress={handleRemoveSharing}>
                      <Text style={styles.userInfoButtonText}>
                        Remove {selectedUser.firstName}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </BottomSheetScrollView>
            )}
          </BottomSheetModal>
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

/* -------------------------
   Styles
------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    zIndex: 999,
  },
  iconButton: {
    width: 47,
    height: 47,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  trackButton: {
    position: 'absolute',
    top: 64,
    right: 15,
    width: 47,
    height: 47,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 999,
  },
  trackButtonActive: {
    backgroundColor: COLORS.blue,
  },
  currentLocationContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  currentLocationText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#000',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalScroll: {
    flexGrow: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  errorInput: {
    borderColor: 'red',
  },
  label: {
    fontSize: 16,
    color: '#000',
    marginBottom: 5,
    marginTop: 15,
  },
  searchContainer: {
    paddingHorizontal: 10,
  },
  searchInputContainer: {
    backgroundColor: '#eee',
    borderRadius: 5,
  },
  searchInput: {
    color: '#000',
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatar: {
    backgroundColor: '#ccc',
  },
  avatarButtonsContainer: {
    flexDirection: 'row',
    marginTop: 10,
  },
  avatarButton: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  avatarButtonText: {
    color: '#fff',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#f54242',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  bottomSheetHeader: {
    paddingBottom: 14,
    paddingLeft: 20,
  },
  bottomSheetTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  bottomSheetContent: {
    backgroundColor: 'white',
    paddingBottom: 20,
  },
  userItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 5,
  },
  userNameText: {
    fontSize: 16,
    color: '#000',
  },
  distanceText: {
    fontSize: 14,
    color: '#888',
  },
  timestampText: {
    fontSize: 14,
    color: '#888',
  },
  userInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInfoName: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  userInfoCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfoLocation: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  userInfoTimestamp: {
    fontSize: 14,
    color: '#555',
    marginBottom: 15,
  },
  cardOptionContainer: {
    width: '100%',
    margin: 0,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    height: 'auto',
  },
  cardContent: {
    alignItems: 'left',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  cardSubtitle: {
    marginTop: 5,
    fontSize: 14,
    color: '#888',
  },
  userInfoButtonsContainer: {
    padding: 5,
    backgroundColor: COLORS.white,
    borderRadius: 10,
  },
  userInfoButton: {
    padding: 5,
    borderRadius: 5,
    marginVertical: 5,
    alignItems: 'center',
  },
  userInfoButtonText: {
    color: "red",
    fontSize: 16,
  },
});

const dialogStyles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dialogBox: {
    borderRadius: 8,
    width: '80%',
  },
});

const SharingStyles = StyleSheet.create({
  dialogContainer: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 8,
    alignItems: 'stretch',
  },
  dialogTitle: {
    alignSelf: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 10,
  },
  dialogMessage: {
    fontSize: 16,
    color: '#555',
    marginBottom: 15,
  },
  buttonsContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  button: {
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
  },
  divider: {
    width: '100%',
    marginVertical: 5,
  },
});
