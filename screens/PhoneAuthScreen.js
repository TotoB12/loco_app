// PhoneAuthScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth'; // Updated import
import { ref, get, set, update } from '@react-native-firebase/database'; // Updated import
import * as ImagePicker from 'expo-image-picker';
import { db } from '../firebaseConfig'; // Keep db from firebaseConfig

const { width: screenWidth } = Dimensions.get('window');

export default function PhoneAuthScreen() {
  const navigation = useNavigation();
  const [steps, setSteps] = useState(['phone', 'sms']);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [user, setUser] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const scrollViewRef = useRef(null);

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = ref(db, `users/${currentUser.uid}`);
        const userSnap = await get(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.val();
          if (userData.onboardingCompleted) {
            navigation.replace('Home');
          } else {
            const newSteps = [];
            if (!userData.firstName || !userData.lastName) newSteps.push('name');
            if (!userData.avatar) newSteps.push('avatar');
            newSteps.push('welcome');
            setSteps(newSteps);
            setCurrentIndex(0);
            scrollViewRef.current?.scrollTo({ x: 0, animated: false });
          }
        } else {
          setSteps(['name', 'avatar', 'welcome']);
          setCurrentIndex(0);
          scrollViewRef.current?.scrollTo({ x: 0, animated: false });
        }
      } else {
        setSteps(['phone', 'sms']);
        setCurrentIndex(0);
        scrollViewRef.current?.scrollTo({ x: 0, animated: false });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleNext = (nextStepIndex) => {
    if (nextStepIndex < steps.length) {
      setCurrentIndex(nextStepIndex);
      scrollViewRef.current?.scrollTo({ x: nextStepIndex * screenWidth, animated: true });
    }
  };

  const handlePhoneNext = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber}`;
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      setConfirmationResult(confirmation);
      handleNext(1);
    } catch (error) {
      Alert.alert('Error', 'Failed to send SMS code: ' + error.message);
    }
  };

  const handleSMSNext = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the SMS code');
      return;
    }
    try {
      await confirmationResult.confirm(code);
      // onAuthStateChanged will handle the next steps
    } catch (error) {
      Alert.alert('Error', 'Invalid SMS code: ' + error.message);
    }
  };

  const handleNameNext = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First and last names are required');
      return;
    }
    try {
      await set(ref(db, `users/${user.uid}`), {
        phoneNumber: user.phoneNumber,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        createdAt: Date.now(),
      });
      handleNext(steps.indexOf('name') + 1);
    } catch (error) {
      Alert.alert('Error', 'Failed to save names: ' + error.message);
    }
  };

  const handleAvatarNext = async (upload = false) => {
    if (upload && avatarUri) {
      setUploading(true);
      try {
        const avatarUrl = await uploadAvatar(avatarUri);
        await update(ref(db, `users/${user.uid}`), { avatar: avatarUrl });
      } catch (error) {
        Alert.alert('Error', 'Failed to upload avatar: ' + error.message);
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    handleNext(steps.indexOf('avatar') + 1);
  };

  const handleWelcomeNext = async () => {
    try {
      await update(ref(db, `users/${user.uid}`), { onboardingCompleted: true });
      navigation.replace('Home');
    } catch (error) {
      Alert.alert('Error', 'Failed to complete onboarding: ' + error.message);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your media library');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri) => {
    const IMGUR_CLIENT_ID = '4916641447bc9f6';
    const formData = new FormData();
    const uriParts = uri.split('.');
    const fileType = uriParts[uriParts.length - 1];
    formData.append('image', {
      uri,
      name: `avatar.${fileType}`,
      type: `image/${fileType}`,
    });

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
        Accept: 'application/json',
      },
      body: formData,
    });
    const result = await response.json();
    if (result.success) {
      return result.data.link;
    } else {
      throw new Error('Imgur upload failed');
    }
  };

  return (
    <ScrollView
      horizontal
      pagingEnabled
      scrollEnabled={false}
      ref={scrollViewRef}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {steps.map((step, index) => (
        <View key={step} style={styles.stepContainer}>
          {step === 'phone' && (
            <View style={styles.form}>
              <Text style={styles.title}>Enter Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+12345678900"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              <Button title="Next" onPress={handlePhoneNext} />
            </View>
          )}
          {step === 'sms' && (
            <View style={styles.form}>
              <Text style={styles.title}>Enter SMS Code</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
              />
              <Button title="Verify" onPress={handleSMSNext} />
            </View>
          )}
          {step === 'name' && (
            <View style={styles.form}>
              <Text style={styles.title}>Your Name</Text>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
              />
              <Button title="Next" onPress={handleNameNext} />
            </View>
          )}
          {step === 'avatar' && (
            <View style={styles.form}>
              <Text style={styles.title}>Add Profile Picture (Optional)</Text>
              {avatarUri && <Text>Image selected</Text>}
              {uploading && <ActivityIndicator size="small" color="#0000ff" />}
              <Button title="Select Image" onPress={pickImage} disabled={uploading} />
              <Button
                title="Upload"
                onPress={() => handleAvatarNext(true)}
                disabled={!avatarUri || uploading}
              />
              <Button title="Skip" onPress={() => handleAvatarNext(false)} disabled={uploading} />
            </View>
          )}
          {step === 'welcome' && (
            <View style={styles.form}>
              <Text style={styles.title}>You're all set! Welcome to Loco</Text>
              <Button title="Start" onPress={handleWelcomeNext} />
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  stepContainer: {
    width: screenWidth,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  form: {
    alignItems: 'center'
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center'
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
});