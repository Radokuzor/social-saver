import { useAuth, useOAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { syncClerkUserToFirestore } from '../services/userProfile';

// This is CRITICAL - it completes the OAuth session when returning to the app
WebBrowser.maybeCompleteAuthSession();

const Colors = {
    primary: '#ec4899',
    primaryLight: '#f9a8d4',
    secondary: '#a855f7',
    background: '#ffffff',
    surface: '#fafafa',
    text: '#171717',
    textSecondary: '#737373',
    border: '#e5e5e5',
};

// Hook to warm up browser for better UX
export const useWarmUpBrowser = () => {
    useEffect(() => {
        void WebBrowser.warmUpAsync();
        return () => {
            void WebBrowser.coolDownAsync();
        };
    }, []);
};

export default function SignupScreen() {
    const router = useRouter();
    const { isSignedIn } = useAuth();
    const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
    const { user, isLoaded: userLoaded } = useUser();
    const [loadingGoogle, setLoadingGoogle] = useState(false);
    const [syncedUser, setSyncedUser] = useState(false);

    // Warm up the browser
    useWarmUpBrowser();

    // This useEffect handles navigation after successful sign-in
    useEffect(() => {
        const syncAndNav = async () => {
            try {
                if (user) {
                    await syncClerkUserToFirestore({
                        id: user.id,
                        email: user.primaryEmailAddress?.emailAddress || '',
                        firstName: user.firstName || '',
                        lastName: user.lastName || '',
                        birthday: (user as any).birthday || '',
                    });
                }
            } catch (err) {
                console.error('User sync failed', err);
            } finally {
                setSyncedUser(true);
                router.replace('/(tabs)/add');
            }
        };

        if (isSignedIn && userLoaded && !syncedUser) {
            syncAndNav();
        }
    }, [isSignedIn, userLoaded, user, syncedUser, router]);

    const handleGoogleSignup = useCallback(async () => {
        try {
            setLoadingGoogle(true);

            // Start the OAuth flow
            const { createdSessionId, setActive, signIn, signUp } = await startOAuthFlow();

            console.log('OAuth flow completed');
            console.log('Created session ID:', createdSessionId);
            console.log('SignIn status:', signIn?.status);
            console.log('SignUp status:', signUp?.status);
            console.log('setActive available:', !!setActive);

            if (createdSessionId && setActive) {
                // Set the session as active
                // Note: Code after setActive won't execute, navigation happens in useEffect
                await setActive({ session: createdSessionId });
                console.log('Session set as active');
            } else if (!createdSessionId) {
                // Handle cases where additional steps are needed (like MFA)
                if (signIn?.status === 'needs_first_factor' || signUp?.status === 'missing_requirements') {
                    Alert.alert('Additional Steps Required', 'Please complete the authentication process.');
                } else {
                    console.warn('No session ID created. signIn:', signIn, 'signUp:', signUp);
                    Alert.alert('Sign In Issue', 'Authentication completed but no session was created. Please try again.');
                }
            } else if (!setActive) {
                console.error('setActive is undefined');
                Alert.alert('Configuration Error', 'There was an issue with the authentication setup.');
            }
        } catch (error: any) {
            console.error('Google sign-in failed:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));

            // Show user-friendly error message
            const errorMessage = error?.errors?.[0]?.longMessage ||
                error?.message ||
                'Failed to sign in with Google. Please try again.';

            Alert.alert('Sign In Error', errorMessage);
        } finally {
            setLoadingGoogle(false);
        }
    }, [startOAuthFlow]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                    >
                        <ArrowLeft size={22} color={Colors.text} />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Create Account</Text>
                    <View style={{ width: 70 }} />
                </View>

                <View style={styles.content}>
                    <View style={styles.card}>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handleGoogleSignup}
                            activeOpacity={0.8}
                            disabled={loadingGoogle}
                        >
                            {loadingGoogle ? (
                                <ActivityIndicator color={Colors.text} />
                            ) : (
                                <Text style={styles.secondaryButtonText}>Continue with Google</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => router.back()} style={styles.loginHint}>
                        <Text style={styles.loginText}>Already have an account? Log in</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 20,
        gap: 12,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    secondaryButton: {
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        marginTop: 8,
    },
    secondaryButtonText: {
        color: Colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    loginHint: {
        marginTop: 16,
        alignItems: 'center',
        marginBottom: 20,
    },
    loginText: {
        color: Colors.textSecondary,
        fontWeight: '600',
    },
});
