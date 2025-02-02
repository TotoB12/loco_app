// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { get, ref, update } from 'firebase/database';
import Radar from 'react-native-radar';
import Mapbox, { MapView, LocationPuck } from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { SearchBar, ListItem, Divider, Avatar } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export default function HomeScreen() {
  // ------------------------------
  // State variables
  // ------------------------------
  const [currentLocation, setCurrentLocation] = useState(null);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFirstName, setSettingsFirstName] = useState('');
  const [settingsLastName, setSettingsLastName] = useState('');
  const [firstNameError, setFirstNameError] = useState(false);
  const [lastNameError, setLastNameError] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [avatarData, setAvatarData] = useState(null); // NEW: full avatar object from the DB
  const [uploading, setUploading] = useState(false);

  // Social (People) modal state
  const [showSocial, setShowSocial] = useState(false);
  const [expanded1, setExpanded1] = useState(false);
  const [expanded2, setExpanded2] = useState(true);
  const [search, setSearch] = useState('');

  // Set your Imgur client ID here (replace with your actual client ID)
  const IMGUR_CLIENT_ID = '4916641447bc9f6';

  // ------------------------------
  // Mapbox Token & Telemetry
  // ------------------------------
  useEffect(() => {
    Mapbox.setAccessToken(
      'pk.eyJ1IjoidG90b2IxMjE3IiwiYSI6ImNsbXo4NHdocjA4dnEya215cjY0aWJ1cGkifQ.OMzA6Q8VnHLHZP-P8ACBRw'
    );
    Mapbox.setTelemetryEnabled(false);
  }, []);

  // ------------------------------
  // Radar foreground tracking
  // ------------------------------
  useEffect(() => {
    // Track location once every 10 seconds when in foreground
    const intervalId = setInterval(() => {
      Radar.trackOnce({ desiredAccuracy: 'high' })
        .then((result) => {
          if (result.location) {
            setCurrentLocation(result.location);
          }
        })
        .catch((err) => {
          console.log('Radar trackOnce error =>', err);
        });
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // ------------------------------
  // When Settings modal opens:
  //   - Reset error states
  //   - Fetch current profile data from the DB
  // ------------------------------
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

  // ------------------------------
  // Validation for Name Fields
  // ------------------------------
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

  // ------------------------------
  // Sign Out Logic
  // ------------------------------
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log('Error signing out:', error);
    }
  };

  // ------------------------------
  // New: Delete an image from Imgur using its deletehash
  // ------------------------------
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
    // Check if the image already fits within the 1000x1000 limit.
    if (width <= 500 && height <= 500) {
      return uri;
    }

    // Calculate the scale factor to maintain aspect ratio
    const maxDimension = 1000;
    const scaleFactor = Math.min(maxDimension / width, maxDimension / height);
    const newWidth = Math.round(width * scaleFactor);
    const newHeight = Math.round(height * scaleFactor);

    // Use ImageManipulator to resize the image
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: newWidth, height: newHeight } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  };

  // ------------------------------
  // New: Upload image to Imgur and update the DB
  // ------------------------------
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
        // If a previous avatar exists, delete it first
        if (avatarData && avatarData.deletehash) {
          await deleteImgurImage(avatarData.deletehash);
        }
        const currentUser = auth.currentUser;
        if (currentUser) {
          // Update the user's record with the entire Imgur response data
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

  // ------------------------------
  // New: Handle image selection using expo-image-picker
  // ------------------------------
  const handleSelectImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access the media library is required!');
      return;
    }

    let pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!pickerResult.canceled) {
      // The picker result includes an assets array; get the first asset.
      const asset = pickerResult.assets[0];
      // Use the asset's width and height from the picker result
      const resizedUri = await resizeImageIfNeeded(asset.uri, asset.width, asset.height);
      await uploadImage(resizedUri);
    }
  };

  // ------------------------------
  // New: Handle removing the current profile picture
  // ------------------------------
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

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <View style={styles.container}>
      {/* Full-screen Map */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        attributionEnabled={false}
        logoEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={true}
        compassViewPosition={1}
        compassViewMargins={{ x: 15, y: 64 }}
        compassFadeWhenNorth={false}
      >
        {/* Shows a blue dot for user location */}
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
      </MapView>

      {/* Top row with Settings (left) and Friends (right) buttons */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.iconButton} onPress={() => setShowSettings(true)}>
          <MaterialIcons name="settings" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => setShowSocial(true)}>
          <FontAwesome5 name="user-friends" size={20} color="black" />
        </TouchableOpacity>
      </View>

      {/* Current location text overlaid at bottom-right */}
      <View style={styles.locationInfo}>
        {currentLocation ? (
          <Text style={styles.locationText}>
            Lat: {currentLocation.latitude.toFixed(6)}
            {'\n'}Lng: {currentLocation.longitude.toFixed(6)}
          </Text>
        ) : (
          <Text style={styles.locationText}>No location yet...</Text>
        )}
      </View>

      {/* Sign out button overlaid at bottom-left */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Log Out</Text>
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
            <View style={styles.avatarContainer}>
              <Avatar
                size={100}
                rounded
                source={avatarUri ? { uri: avatarUri } : null}
                icon={!avatarUri ? { name: 'person', type: 'material' } : undefined}
                containerStyle={styles.avatar}
              />
              {uploading && (
                <ActivityIndicator
                  style={{ marginVertical: 10 }}
                  size="small"
                  color="#00ADB5"
                />
              )}
              <View style={styles.avatarButtonsContainer}>
                <TouchableOpacity
                  style={styles.avatarButton}
                  onPress={handleSelectImage}
                  disabled={uploading}
                >
                  <Text style={styles.avatarButtonText}>Select Image</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.avatarButton}
                  onPress={handleRemovePicture}
                  disabled={uploading}
                >
                  <Text style={styles.avatarButtonText}>Remove Picture</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* First Name Field */}
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={[styles.input, firstNameError && styles.errorInput]}
              placeholder="First Name"
              value={settingsFirstName}
              onChangeText={handleFirstNameChange}
            />

            {/* Last Name Field */}
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={[styles.input, lastNameError && styles.errorInput]}
              placeholder="Last Name"
              value={settingsLastName}
              onChangeText={handleLastNameChange}
            />
          </ScrollView>
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
            <ListItem.Accordion
              content={
                <ListItem.Content>
                  <ListItem.Title>Sharing With</ListItem.Title>
                </ListItem.Content>
              }
              animation="default"
              isExpanded={expanded1}
              onPress={() => setExpanded1(!expanded1)}
            >
              <ListItem bottomDivider>
                <ListItem.Content>
                  <ListItem.Title>User 1</ListItem.Title>
                </ListItem.Content>
              </ListItem>
            </ListItem.Accordion>

            <Divider
              style={{ width: '100%' }}
              insetType="middle"
              width={1}
              orientation="horizontal"
            />

            <ListItem.Accordion
              content={
                <ListItem.Content>
                  <ListItem.Title>Receiving Locations</ListItem.Title>
                </ListItem.Content>
              }
              isExpanded={expanded2}
              onPress={() => setExpanded2(!expanded2)}
            >
              <ListItem bottomDivider>
                <ListItem.Content>
                  <ListItem.Title>User 2</ListItem.Title>
                </ListItem.Content>
              </ListItem>
            </ListItem.Accordion>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ------------------------------
// Styles
// ------------------------------
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
  locationInfo: {
    position: 'absolute',
    bottom: 40,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 8,
    borderRadius: 5,
  },
  locationText: {
    color: '#fff',
    textAlign: 'left',
  },
  signOutButton: {
    position: 'absolute',
    bottom: 40,
    left: 15,
    backgroundColor: '#f54242',
    borderRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
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
    backgroundColor: '#00ADB5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  avatarButtonText: {
    color: '#fff',
  },
});
