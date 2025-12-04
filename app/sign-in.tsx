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
  const [isSignUp, setIsSignUp] = useState(true);
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

      if (!isSignUp) {
        // Sign in flow
        try {
          await signIn(trimmed, password);
          router.replace('/(tabs)');
          return;
        } catch (signInErr: any) {
          if (signInErr?.code === 'auth/user-not-found') {
            throw new Error('No account found. Switch to "Create Account" to sign up.');
          }
          if (signInErr?.code === 'auth/wrong-password') {
            throw new Error('Incorrect password. Please try again.');
          }
          throw signInErr;
        }
      } else {
        // Sign up flow
        const cleanedHandle = handle.trim().replace(/^@/, '');
        if (!cleanedHandle) {
          throw new Error('Please choose a unique handle.');
        }
        if (!phone.trim()) {
          throw new Error('Please provide a phone number.');
        }

        await ensureHandleAvailable(cleanedHandle);
        const newUser = await signUp(trimmed, password, cleanedHandle);
        await claimHandleAndPhone(newUser?.uid || '', cleanedHandle, phone, trimmed);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed.';
      Alert.alert('Error', msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp((prev) => !prev);
    if (isSignUp) {
      setHandle('');
      setPhone('');
    }
  };

  const submitDisabled =
    !email ||
    !password ||
    emailLoading ||
    (isSignUp && (!handle.trim() || !phone.trim()));

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text style={styles.subtitle}>
                {isSignUp ? 'Sign up to get started' : 'Sign in to continue'}
              </Text>
            </View>

            <View style={styles.card}>
              {isSignUp ? (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Handle</Text>
                    <TextInput
                      style={styles.input}
                      value={handle}
                      onChangeText={setHandle}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="@yourhandle"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholder="(555) 123-4567"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </>
              ) : null}

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
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <TouchableOpacity
                style={[styles.button, submitDisabled && styles.disabled]}
                onPress={handleEmailAuth}
                disabled={submitDisabled}
                activeOpacity={0.8}
              >
                {emailLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </Text>
                <TouchableOpacity onPress={toggleMode} activeOpacity={0.7}>
                  <Text style={styles.toggleLink}>
                    {isSignUp ? 'Sign In' : 'Create Account'}
                  </Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#f8fafc',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    alignSelf: 'center',
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  toggleText: {
    fontSize: 14,
    color: '#64748b',
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
});
