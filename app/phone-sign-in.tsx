import { useAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Mode = 'signin' | 'signup';

export default function PhoneSignInScreen() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn, isLoaded: signInLoaded, setActive } = useSignIn();
  const { signUp, isLoaded: signUpLoaded, setActive: setActiveSignUp } = useSignUp();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<Mode>('signin');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, router]);

  const formattedPhone = useMemo(() => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('+')) {
      return `+${trimmed.replace(/[^\d]/g, '')}`;
    }
    return `+1${trimmed.replace(/[^\d]/g, '')}`;
  }, [phoneNumber]);

  const sendCode = async () => {
    if (!signInLoaded || !signUpLoaded) return;
    try {
      setIsSending(true);
      setError(null);

      try {
        const attempt = await signIn?.create({
          strategy: 'phone_code',
          phone: formattedPhone,
        });
        if (attempt?.status === 'needs_first_factor') {
          setMode('signin');
          setIsSending(false);
          setError(null);
          return;
        }
      } catch (err) {
        const signUpAttempt = await signUp?.create({ phoneNumber: formattedPhone });
        await signUpAttempt?.preparePhoneNumberVerification({ strategy: 'phone_code' });
        setMode('signup');
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage || err?.message || 'Could not send code.';
      setError(message);
      Alert.alert('Send code failed', message);
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) return;
    try {
      setIsVerifying(true);
      setError(null);

      if (mode === 'signin') {
        const attempt = await signIn?.attemptFirstFactor({
          strategy: 'phone_code',
          code: code.trim(),
        });
        if (attempt?.status === 'complete') {
          await setActive?.({ session: attempt.createdSessionId });
          router.replace('/(tabs)');
          return;
        }
        throw new Error('Additional verification required.');
      } else {
        const attempt = await signUp?.attemptPhoneNumberVerification({ code: code.trim() });
        if (attempt?.status === 'complete') {
          await setActiveSignUp?.({ session: attempt.createdSessionId });
          router.replace('/(tabs)');
          return;
        }
        throw new Error('Verification failed. Please try again.');
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage || err?.message || 'Could not verify code.';
      setError(message);
      Alert.alert('Verification failed', message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.subtitle}>We will text you a one-time code.</Text>

        <TextInput
          style={styles.input}
          placeholder="+1 555 555 5555"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />

        <TouchableOpacity
          style={[styles.button, (!formattedPhone || isSending) && styles.buttonDisabled]}
          onPress={sendCode}
          disabled={!formattedPhone || isSending}
        >
          {isSending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="6-digit code"
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          value={code}
          onChangeText={setCode}
        />

        <TouchableOpacity
          style={[styles.button, (!code || isVerifying) && styles.buttonDisabled]}
          onPress={verifyCode}
          disabled={!code || isVerifying}
        >
          {isVerifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
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
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  error: {
    color: '#dc2626',
    marginTop: 4,
  },
});
