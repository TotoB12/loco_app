// screens/HomeScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Button,
  TextInput,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { ref, onValue, off, update, get } from 'firebase/database';
import Radar from 'react-native-radar';
import Mapbox, { MapView, LocationPuck, MarkerView, Camera, UserTrackingMode } from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { SearchBar, ListItem, Divider, Avatar } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import BottomSheet, { BottomSheetScrollView, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  shareLocation,
  stopSharingLocation,
  stopReceivingLocation,
} from '../sharingUtils';

import { COLORS } from '../colors';

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
   Small live components
------------------------- */
const LiveTimeAgo = ({ timestamp }) => {
  const [timeAgo, setTimeAgo] = useState(getTimeAgo(timestamp));
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo(timestamp));
    }, 2000);
    return () => clearInterval(interval);
  }, [timestamp]);
  return <Text>{timeAgo}</Text>;
};

const LiveDistance = ({ currentLocation, userLocation }) => {
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
    const interval = setInterval(calculateDistance, 2000);
    return () => clearInterval(interval);
  }, [currentLocation, userLocation]);
  return <Text style={styles.distanceText}>{distanceText}</Text>;
};

/* -------------------------
   Marker component (map)
------------------------- */
const UserMarker = ({ user, onPress }) => {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <View style={markerStyles.container}>
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
          size={30}
          containerStyle={
            !user.avatar || !user.avatar.link
              ? { backgroundColor: '#c2c2c2' }
              : {}
          }
        />
        <Text style={markerStyles.nameText}>{user.firstName}</Text>
      </View>
    </TouchableOpacity>
  );
};

const markerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'gray',
  },
  nameText: {
    color: 'black',
    marginLeft: 5,
    fontSize: 16,
  },
});

/* -------------------------
   Bottom Sheet User Item 
   (for map’s people list)
------------------------- */
const BottomSheetUserItem = ({ user, currentLocation, onPress }) => {
  return (
    <ListItem bottomDivider containerStyle={{ backgroundColor: 'transparent' }} onPress={onPress}>
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
        size={30}
        containerStyle={
          !user.avatar || !user.avatar.link
            ? { backgroundColor: '#c2c2c2' }
            : {}
        }
      />
      <ListItem.Content>
        <View style={styles.userItemHeader}>
          <ListItem.Title>
            {(`${user.firstName || ''} ${user.lastName || ''}`).trim()}
          </ListItem.Title>
          <LiveDistance currentLocation={currentLocation} userLocation={user.location} />
        </View>
        <ListItem.Subtitle>
          <LiveTimeAgo timestamp={user.locationTimestamp} />
        </ListItem.Subtitle>
      </ListItem.Content>
    </ListItem>
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
    <ListItem bottomDivider onPress={() => onPress(user)}>
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
        size={30}
        containerStyle={
          !user.avatar || !user.avatar.link
            ? { backgroundColor: '#c2c2c2' }
            : {}
        }
      />
      <ListItem.Content>
        <ListItem.Title>
          {(`${user.firstName || ''} ${user.lastName || ''}`).trim()}
        </ListItem.Title>
        <ListItem.Subtitle>{statusText}</ListItem.Subtitle>
      </ListItem.Content>
    </ListItem>
  );
};

/* -------------------------
   Sharing Options Dialog 
   (for People modal items only)
------------------------- */
function SharingDialog({ targetUser, sharingStatus, onShare, onStopSharing, onStopReceiving, onClose }) {
  let message = '';
  let actions = [];
  if (sharingStatus.amSharing && !sharingStatus.amReceiving) {
    message = `You are sharing your location with ${targetUser.firstName}`;
    actions.push({ title: 'Stop Sharing My Location', onPress: onStopSharing });
  } else if (!sharingStatus.amSharing && sharingStatus.amReceiving) {
    message = `${targetUser.firstName} is sharing their location`;
    actions.push({ title: 'Share My Location', onPress: onShare });
    actions.push({ title: `Remove ${targetUser.firstName}`, onPress: onStopReceiving });
  } else if (sharingStatus.amSharing && sharingStatus.amReceiving) {
    message = 'You are both sharing';
    actions.push({ title: 'Stop Sharing My Location', onPress: onStopSharing });
    actions.push({ title: `Remove ${targetUser.firstName}`, onPress: onStopReceiving });
  } else {
    message = 'Neither of you are sharing';
    actions.push({ title: 'Share My Location', onPress: onShare });
  }
  return (
    <View style={SharingStyles.dialogContainer}>
      <Text style={SharingStyles.dialogMessage}>{message}</Text>
      {actions.map((action, index) => (
        <View key={index} style={SharingStyles.buttonContainer}>
          <Button
            title={action.title}
            onPress={() => {
              action.onPress();
              onClose();
            }}
          />
        </View>
      ))}
      <View style={SharingStyles.buttonContainer}>
        <Button title="Cancel" onPress={onClose} />
      </View>
    </View>
  );
}

/* -------------------------
   Main HomeScreen Component
------------------------- */
export default function HomeScreen() {
  /* --- Map & location state --- */
  const [currentLocation, setCurrentLocation] = useState(null);
  const cameraRef = useRef(null);
  const initialCameraCentered = useRef(false);
  const [tracking, setTracking] = useState(false);

  /* --- Modal & UI state --- */
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

  /* --- Real‑time sharing list states --- */
  const [sharingWithIds, setSharingWithIds] = useState([]);
  const [receivingFromIds, setReceivingFromIds] = useState([]);
  const [sharingWithData, setSharingWithData] = useState({}); // keyed by uid
  const [receivingFromData, setReceivingFromData] = useState({}); // keyed by uid

  /* --- Selected user states --- */
  // For main bottom sheet (user info modal on map)
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  // For People modal (sharing options)
  const [selectedSocialUser, setSelectedSocialUser] = useState(null);
  const [selectedUserLocationName, setSelectedUserLocationName] = useState("");
  // These sharing status objects are computed in real time
  const [userSharingStatus, setUserSharingStatus] = useState({ amSharing: false, amReceiving: false });

  /* --- Mapbox setup --- */
  useEffect(() => {
    Mapbox.setAccessToken('pk.eyJ1IjoidG90b2IxMjE3IiwiYSI6ImNsbXo4NHdocjA4dnEya215cjY0aWJ1cGkifQ.OMzA6Q8VnHLHZP-P8ACBRw');
    Mapbox.setTelemetryEnabled(false);
  }, []);

  /* --- Radar foreground tracking --- */
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
        animationMode: 'none',
        animationDuration: 0,
      });
      initialCameraCentered.current = true;
    }
  }, [currentLocation]);

  /* --- Real‑time sharing lists subscriptions --- */
  // "sharingWith" list (users you are sharing your location with)
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const sharingWithRef = ref(db, `users/${currentUser.uid}/sharingWith`);
    const unsubscribe = onValue(sharingWithRef, (snapshot) => {
      const data = snapshot.val() || {};
      // Always force a new array reference so the dependent effect fires
      setSharingWithIds(Object.keys(data));
    });
    return () => unsubscribe();
  }, []);

  // "receivingFrom" list (users sharing with you)
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
    // Unsubscribe from any uid no longer in sharingWithIds.
    Object.keys(sharingWithListenersRef.current).forEach((uid) => {
      if (!sharingWithIds.includes(uid)) {
        // Unsubscribe from this user’s listener
        sharingWithListenersRef.current[uid]();
        delete sharingWithListenersRef.current[uid];
        // Remove the user's data from state
        setSharingWithData((prev) => {
          const newData = { ...prev };
          delete newData[uid];
          return newData;
        });
      }
    });
    // For each uid in sharingWithIds, attach a listener if not already attached.
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
    // No cleanup here so we don't remove listeners unnecessarily.
  }, [sharingWithIds]);

  // Cleanup all sharingWith listeners when the component unmounts
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

  /* --- Compute markers from receivingFrom users --- */
  const markers = useMemo(() => {
    return Object.values(receivingFromData).filter((user) => user.location);
  }, [receivingFromData]);

  /* --- Search Users (excluding self) --- */
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

  /* --- Settings modal: fetch current profile data --- */
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

  /* --- Update sharing status for the main user info modal --- */
  useEffect(() => {
    if (selectedUserInfo) {
      setUserSharingStatus({
        amSharing: sharingWithIds.includes(selectedUserInfo.uid),
        amReceiving: receivingFromIds.includes(selectedUserInfo.uid)
      });
    }
  }, [selectedUserInfo, sharingWithIds, receivingFromIds]);

  /* --- Handlers for People modal (social user items) --- */
  const handleSocialUserPress = (user) => {
    // When a People modal user item is tapped, only open the sharing options modal.
    setSelectedSocialUser(user);
  };

  /* --- Handlers for main bottom sheet user items --- */
  const bottomSheetRef = useRef(null);
  const userInfoModalRef = useRef(null);
  const snapPoints = useMemo(() => ['10%', '32%', '80%'], []);
  const openUserInfo = (user) => {
    // Center map on user’s location and open the user info modal.
    if (tracking) {
      setTracking(false);
      setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: [user.location.longitude, user.location.latitude],
          animationMode: 'flyTo',
          animationDuration: 1000,
        });
      }, 150);
    } else {
      cameraRef.current?.setCamera({
        centerCoordinate: [user.location.longitude, user.location.latitude],
        animationMode: 'flyTo',
        animationDuration: 1000,
      });
    }
    bottomSheetRef.current?.close();
    setSelectedUserInfo(user);
  };

  const closeUserInfo = () => {
    userInfoModalRef.current?.dismiss();
    setSelectedUserInfo(null);
    bottomSheetRef.current?.snapToIndex(1);
  };

  useEffect(() => {
    if (selectedUserInfo && userInfoModalRef.current) {
      userInfoModalRef.current.present();
    }
  }, [selectedUserInfo]);

  /* --- Toggle tracking --- */
  const toggleTracking = () => {
    if (!tracking) {
      setTracking(true);
      if (currentLocation) {
        cameraRef.current?.setCamera({
          centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
          zoomLevel: 16,
          animationMode: 'flyTo',
          animationDuration: 1000,
        });
      }
    } else {
      setTracking(false);
    }
  };

  /* --- Name validation and update --- */
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

  /* --- Sign out --- */
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log('Error signing out:', error);
    }
  };

  /* --- Image upload handlers (unchanged) --- */
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

  /* --- Reverse geocoding for user info modal --- */
  const fetchReverseGeocode = async (lat, lon) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
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
    if (selectedUserInfo) {
      const loc = selectedUserInfo.location || null;
      if (loc) {
        fetchReverseGeocode(loc.latitude, loc.longitude);
      }
    }
  }, [selectedUserInfo]);

  /* --- Handlers for toggling sharing in user info modal --- */
  const handleToggleShare = async () => {
    if (!selectedUserInfo) return;
    if (userSharingStatus.amSharing) {
      await stopSharingLocation(auth.currentUser.uid, selectedUserInfo.uid);
    } else {
      await shareLocation(auth.currentUser.uid, selectedUserInfo.uid);
    }
  };

  const handleRemoveSharing = async () => {
    if (!selectedUserInfo) return;
    await stopReceivingLocation(auth.currentUser.uid, selectedUserInfo.uid);
    setTimeout(() => {
      if (!receivingFromIds.includes(selectedUserInfo.uid)) {
        closeUserInfo();
      }
    }, 500);
  };

  /* --- Compute sharing status for People modal item --- */
  const socialUserSharingStatus = selectedSocialUser
    ? {
      amSharing: sharingWithIds.includes(selectedSocialUser.uid),
      amReceiving: receivingFromIds.includes(selectedSocialUser.uid),
    }
    : { amSharing: false, amReceiving: false };

  /* -------------------------
     Render
  ------------------------- */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <View style={styles.container}>
          {/* Full-screen Map */}
          <MapView
            style={StyleSheet.absoluteFillObject}
            attributionEnabled={false}
            logoEnabled={false}
            scaleBarEnabled={false}
            compassEnabled={true}
            compassViewPosition={0}
            compassViewMargins={{ x: 15, y: 64 }}
            compassFadeWhenNorth={false}
          >
            <LocationPuck
              topImage="topImage"
              visible={true}
              scale={['interpolate', ['linear'], ['zoom'], 10, 1.0, 20, 4.0]}
              pulsing={{
                isEnabled: true,
                color: 'teal',
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
              <MarkerView
                key={user.uid}
                id={user.uid}
                coordinate={[user.location.longitude, user.location.latitude]}
                allowOverlapWithPuck={true}
                allowOverlap={true}
              >
                <UserMarker user={user} onPress={() => openUserInfo(user)} />
              </MarkerView>
            ))}
          </MapView>

          {/* Top row with Settings and People buttons */}
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowSettings(true)}>
              <MaterialIcons name="settings" size={24} color="black" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowSocial(true)}>
              <FontAwesome5 name="user-friends" size={20} color="black" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.trackButton, tracking && styles.trackButtonActive]}
            onPress={toggleTracking}
          >
            <MaterialIcons name="my-location" size={24} color={tracking ? '#fff' : '#000'} />
          </TouchableOpacity>

          {/* ------------- Settings Modal ------------- */}
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
                <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
                  <Text style={styles.logoutButtonText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>

          {/* ------------- People (Social) Modal ------------- */}
          <Modal
            animationType="slide"
            transparent={false}
            visible={showSocial}
            onRequestClose={() => setShowSocial(false)}
          >
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>People</Text>
                <TouchableOpacity onPress={() => setShowSocial(false)}>
                  <MaterialIcons name="close" size={28} color="#000" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScroll}>
                <SearchBar
                  placeholder="Search..."
                  onChangeText={setSearch}
                  value={search}
                  platform="default"
                  containerStyle={styles.searchContainer}
                  inputContainerStyle={styles.searchInputContainer}
                  inputStyle={styles.searchInput}
                />
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
                          <ListItem.Title>Sharing With</ListItem.Title>
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
                        <Text style={{ margin: 10, textAlign: 'center' }}>
                          You are not sharing your location yet.
                        </Text>
                      )}
                    </ListItem.Accordion>
                    <Divider style={{ width: '100%' }} insetType="middle" width={1} orientation="horizontal" />
                    <ListItem.Accordion
                      content={
                        <ListItem.Content>
                          <ListItem.Title>Receiving Locations</ListItem.Title>
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
                        <Text style={{ margin: 10, textAlign: 'center' }}>
                          Nobody has shared with you yet.
                        </Text>
                      )}
                    </ListItem.Accordion>
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* ------------- Sharing Options Modal (for People modal items) ------------- */}
          {selectedSocialUser && (
            <Modal
              animationType="fade"
              transparent={true}
              visible={!!selectedSocialUser}
              onRequestClose={() => setSelectedSocialUser(null)}
            >
              <View style={dialogStyles.overlay}>
                <View style={dialogStyles.dialogBox}>
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
              </View>
            </Modal>
          )}

          {/* ------------- Main Bottom Sheet (for users sharing with you) ------------- */}
          <BottomSheet
            ref={bottomSheetRef}
            index={1}
            snapPoints={snapPoints}
            enablePanDownToClose={false}
            backgroundStyle={{ borderRadius: 20 }}
          >
            <BottomSheetScrollView contentContainerStyle={styles.bottomSheetContent}>
              <Text style={styles.bottomSheetTitle}>People</Text>
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

          {/* ------------- User Info Bottom Sheet Modal (for map items) ------------- */}
          <BottomSheetModal
            ref={userInfoModalRef}
            index={0}
            snapPoints={['32%', '80%']}
            onDismiss={closeUserInfo}
            backgroundStyle={{ borderRadius: 20 }}
          >
            {selectedUserInfo && (
              <BottomSheetView style={{ padding: 20 }}>
                <View style={styles.userInfoHeader}>
                  <Text style={styles.userInfoName}>
                    {(`${selectedUserInfo.firstName || ''} ${selectedUserInfo.lastName || ''}`).trim()}
                  </Text>
                  <TouchableOpacity style={styles.userInfoCloseButton} onPress={closeUserInfo}>
                    <MaterialIcons name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.userInfoLocation}>
                  {selectedUserLocationName ? selectedUserLocationName : "Loading location..."}
                </Text>
                <Text style={styles.userInfoTimestamp}>
                  <LiveTimeAgo timestamp={selectedUserInfo.locationTimestamp} />
                </Text>
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
                        Remove {selectedUserInfo.firstName}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </BottomSheetView>
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
    backgroundColor: '#00ADB5',
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
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 0,
    marginBottom: 20,
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
  bottomSheetContent: {
    backgroundColor: 'white',
    paddingBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 10,
    paddingLeft: 20,
    textAlign: 'left',
  },
  userItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    textAlign: 'right',
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
  userInfoButtonsContainer: {
    flexDirection: 'column',
    justifyContent: 'space-around',
    padding: 5,
    backgroundColor: COLORS.white,
    borderRadius: 10,
  },
  userInfoButton: {
    // backgroundColor: "red",
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
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    marginHorizontal: 20,
    width: '80%',
  },
});

const SharingStyles = StyleSheet.create({
  dialogContainer: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  dialogMessage: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonContainer: {
    marginVertical: 5,
    width: '100%',
  },
});
