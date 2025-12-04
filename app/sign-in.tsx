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
import useFirebaseAuth from '../hooks/useFirebaseAuth';
import { claimHandleAndPhone, ensureHandleAvailable } from '../services/userProfile';

export default function SignInScreen() {
  const router = useRouter();
  const { user, signIn, signUp } = useFirebaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [phone, setPhone] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user, router]);

  const handleEmailAuth = async () => {
    if (!email || !password) return;
    try {
      setEmailLoading(true);
      const trimmed = email.trim();
      try {
        await signIn(trimmed, password);
        router.replace('/(tabs)');
        return;
      } catch (signInErr: any) {
        // Only create an account if the user truly does not exist; otherwise surface the error
        if (signInErr?.code === 'auth/user-not-found') {
          const cleanedHandle = handle.trim().replace(/^@/, '');
          if (!cleanedHandle) {
            throw new Error('Please choose a unique handle to sign up.');
          }
          if (!phone.trim()) {
            throw new Error('Please provide a phone number to sign up.');
          }

          await ensureHandleAvailable(cleanedHandle);
          const newUser = await signUp(trimmed, password, cleanedHandle);
          await claimHandleAndPhone(newUser?.uid || '', cleanedHandle, phone);
          router.replace('/(tabs)');
          return;
        }
        if (signInErr?.code === 'auth/wrong-password') {
          throw new Error('Incorrect password. Please try again or reset your password.');
        }
        throw signInErr;
      }
    } catch (err: any) {
      const msg = err?.message || 'Email authentication failed.';
      Alert.alert('Authentication failed', msg);
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
              <Text style={styles.title}>Sign in or create an account</Text>
              <Text style={styles.subtitle}>
                Use your email and password. If no account exists, we&apos;ll create one automatically.
                New accounts require a unique handle and phone number.
                If you already signed up, just enter your existing password to sign in.
              </Text>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Handle</Text>
                <TextInput
                  style={styles.input}
                  value={handle}
                  onChangeText={setHandle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="@yourhandle"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="555-123-4567"
                />
              </View>
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
  disabled: {
    opacity: 0.6,
  },
});
