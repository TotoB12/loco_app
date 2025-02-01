// screens/SignupScreen.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';

import { auth, db } from '../firebaseConfig';

export default function SignupScreen({ navigation }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSignup = async () => {
        try {
            if (!firstName || !lastName || !email || !password) {
                Alert.alert('Error', 'Please fill in all fields');
                return;
            }
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email.trim(),
                password
            );
            const user = userCredential.user;
            // Save user data to the Realtime Database
            await set(ref(db, 'users/' + user.uid), {
                createdAt: { ".sv": "timestamp" },
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
            });
            Alert.alert('Success', 'Account created successfully');
        } catch (error) {
            Alert.alert('Signup Error', error.message);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.inner}>
                    <Text style={styles.title}>Sign Up</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="First Name"
                        placeholderTextColor="#999"
                        value={firstName}
                        onChangeText={setFirstName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Last Name"
                        placeholderTextColor="#999"
                        value={lastName}
                        onChangeText={setLastName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#999"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#999"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <TouchableOpacity style={styles.button} onPress={handleSignup}>
                        <Text style={styles.buttonText}>Create Account</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={{ marginTop: 20, color: '#0275d8' }}>
                            Already have an account? Log in
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
    },
    inner: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        color: '#fff',
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        width: '100%',
        height: 50,
        backgroundColor: '#333',
        borderRadius: 5,
        paddingHorizontal: 15,
        color: '#fff',
        marginBottom: 15,
    },
    button: {
        height: 50,
        backgroundColor: '#00ADB5',
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
    },
});
