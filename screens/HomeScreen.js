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
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { get, ref, update } from 'firebase/database';
import Radar from 'react-native-radar';
import Mapbox, { MapView, LocationPuck } from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { SearchBar, ListItem, Divider } from '@rneui/themed';

export default function HomeScreen() {
  const [currentLocation, setCurrentLocation] = useState(null);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFirstName, setSettingsFirstName] = useState('');
  const [settingsLastName, setSettingsLastName] = useState('');
  const [firstNameError, setFirstNameError] = useState(false);
  const [lastNameError, setLastNameError] = useState(false);

  // Social (People) modal state
  const [showSocial, setShowSocial] = useState(false);
  // Accordion expansion state
  const [expanded1, setExpanded1] = useState(false);
  const [expanded2, setExpanded2] = useState(true);
  // Search text state (currently non-functional)
  const [search, setSearch] = useState('');

  // ------------------------------
  //  Mapbox Token & Telemetry
  // ------------------------------
  useEffect(() => {
    Mapbox.setAccessToken(
      'pk.eyJ1IjoidG90b2IxMjE3IiwiYSI6ImNsbXo4NHdocjA4dnEya215cjY0aWJ1cGkifQ.OMzA6Q8VnHLHZP-P8ACBRw'
    );
    Mapbox.setTelemetryEnabled(false);
  }, []);

  // ------------------------------
  //  Radar foreground tracking
  // ------------------------------
  useEffect(() => {
    // Track once every 10 seconds while in foreground
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
  //  When Settings modal opens:
  //    - Reset error states
  //    - Fetch current profile data from the DB
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
            }
          })
          .catch((err) => {
            console.log('Error fetching settings data:', err);
          });
      }
    }
  }, [showSettings]);

  // ------------------------------
  //  Validation function: only letters allowed, no spaces.
  // ------------------------------
  const validateName = (name) => {
    // Only letters, no spaces; must be non-empty and max 20 characters.
    const regex = /^[A-Za-z]+$/;
    return name.trim().length > 0 && name.length <= 20 && regex.test(name);
  };

  // ------------------------------
  //  Handlers for text input changes (update DB if valid)
  // ------------------------------
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
  //  Sign out logic
  // ------------------------------
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log('Error signing out:', error);
    }
  };

  // ------------------------------
  //  Render
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
        {/* Settings Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowSettings(true)}
        >
          <MaterialIcons name="settings" size={24} color="black" />
        </TouchableOpacity>

        {/* Friends Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowSocial(true)}
        >
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

      {/* ------------- Redesigned Settings Modal ------------- */}
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
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalScroll}
          >
            <TextInput
              style={[styles.input, firstNameError && styles.errorInput]}
              placeholder="First Name"
              value={settingsFirstName}
              onChangeText={handleFirstNameChange}
            />
            <TextInput
              style={[styles.input, lastNameError && styles.errorInput]}
              placeholder="Last Name"
              value={settingsLastName}
              onChangeText={handleLastNameChange}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ------------- Redesigned People (Social) Modal ------------- */}
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
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalScroll}
          >
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

            {/* divider */}
            <Divider
              style={{ width: "100%" }}
              insetType="middle"
              subHeaderStyle={{}}
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
//  Styles
// ------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Container for the two top icons
  topRow: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    zIndex: 999, // Ensure the icons appear above the map.
  },
  // White circular background for each icon
  iconButton: {
    width: 47,
    height: 47,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    // Optional shadow on iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    // Optional elevation on Android
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
  // ----- Redesigned Modal Styles -----
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
  // Reuse your existing input styles:
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
  // Styles for the SearchBar components in the social modal
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
});
