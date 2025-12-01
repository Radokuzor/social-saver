import { useAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

export default function SignInScreen() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    if (isSignedIn) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, router]);

  const handleEmailAuth = async () => {
    if (!signInLoaded || !signUpLoaded || !email || !password) return;
    try {
      setEmailLoading(true);
      // Try sign-in first
      try {
        const res = await signIn?.create({
          identifier: email.trim(),
          password,
        });
        if (res?.status === 'complete') {
          await setActiveSignIn?.({ session: res.createdSessionId });
          router.replace('/(tabs)');
          return;
        }
        // If password first factor is needed, attempt it
        if (res?.status === 'needs_first_factor') {
          const attempt = await signIn?.attemptFirstFactor({
            strategy: 'password',
            password,
          });
          if (attempt?.status === 'complete') {
            await setActiveSignIn?.({ session: attempt.createdSessionId });
            router.replace('/(tabs)');
            return;
          }
        }
      } catch (signInErr: any) {
        // Fall through to sign-up on not-found or other sign-in errors
        console.warn('Sign in failed, trying sign up', signInErr);
      }

      // Sign up if sign-in didn't complete
      const res = await signUp?.create({
        emailAddress: email.trim(),
        password,
      });
      if (res?.status === 'complete') {
        await setActiveSignUp?.({ session: res.createdSessionId });
        router.replace('/(tabs)');
        return;
      }
      await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
      Alert.alert('Verify your email', 'Enter the 6-digit code we sent to your inbox.');
      return;
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.message || 'Email authentication failed.';
      Alert.alert('Authentication failed', msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verificationCode || !signUp) return;
    try {
      setEmailLoading(true);
      const attempt = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });
      if (attempt.status === 'complete') {
        await setActiveSignUp?.({ session: attempt.createdSessionId });
        router.replace('/(tabs)');
        return;
      }
      Alert.alert('Verification needed', 'Please complete verification steps.');
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.message || 'Invalid code. Please try again.';
      Alert.alert('Verification failed', msg);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1, width: '100%' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <Text style={styles.title}>Sign in / up</Text>
              <Text style={styles.subtitle}>Sign up or sign in with email and unique password</Text>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}> || </Text>
                <View style={styles.dividerLine} />
              </View>

              {pendingVerification ? (
                <>
                  <Text style={styles.verificationHint}>
                    We sent a code to {email || 'your email'}. Enter it below to finish creating your account.
                  </Text>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Verification code</Text>
                    <TextInput
                      style={styles.input}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      placeholder="6-digit code"
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.button, styles.emailButton, (!verificationCode || emailLoading) && styles.disabled]}
                    onPress={handleVerifyEmail}
                    disabled={!verificationCode || emailLoading}
                    activeOpacity={0.85}
                  >
                    {emailLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Verify and finish</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      placeholder="you@example.com"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="••••••••"
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.button, styles.emailButton, (!email || !password || emailLoading) && styles.disabled]}
                    onPress={handleEmailAuth}
                    disabled={!email || !password || emailLoading}
                    activeOpacity={0.85}
                  >
                    {emailLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>
                        Continue with Email
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 8,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  phoneButton: {
    backgroundColor: '#ec4899',
  },
  emailButton: {
    backgroundColor: '#111827',
  },
  formGroup: {
    width: '100%',
    gap: 6,
  },
  label: {
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  toggleText: {
    color: '#0ea5e9',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  verificationHint: {
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 8,
  },
});
