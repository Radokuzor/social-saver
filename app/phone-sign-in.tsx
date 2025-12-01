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
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
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
    if (!signInLoaded || !signUpLoaded || !formattedPhone) return;
    try {
      setIsSending(true);
      setError(null);

      // Try sign-in first
      try {
        const attempt = await signIn?.create({
          strategy: 'phone_code',
          identifier: formattedPhone,
        });
        if (attempt?.status === 'complete') {
          await setActive?.({ session: attempt.createdSessionId });
          router.replace('/(tabs)');
          return;
        }
        // If we need the code, stay in signin mode
        if (attempt?.status === 'needs_first_factor') {
          setMode('signin');
          return;
        }
      } catch (err) {
        // Fall back to sign-up flow
        const signUpAttempt = await signUp?.create({ phoneNumber: formattedPhone });
        await signUpAttempt?.preparePhoneNumberVerification({ strategy: 'phone_code' });
        setMode('signup');
        return;
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage || err?.message || 'Could not send code.';
      setError(message);
      const msgLower = typeof message === 'string' ? message.toLowerCase() : '';
      const rateLimited = msgLower.includes('too many') || msgLower.includes('rate limit') || msgLower.includes('limit exceeded');
      Alert.alert(
        'Send code failed',
        rateLimited ? 'Too many attempts. Please wait a bit before requesting another code.' : message
      );
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim() || (!signInLoaded && mode === 'signin') || (!signUpLoaded && mode === 'signup')) return;
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
      const msgLower = typeof message === 'string' ? message.toLowerCase() : '';
      const retriable =
        msgLower.includes('already been verified') ||
        msgLower.includes('expired') ||
        msgLower.includes('invalid') ||
        msgLower.includes('not found') ||
        msgLower.includes('verification failed');
      if (retriable) {
        setCode('');
        Alert.alert(
          'Code issue',
          'That code was invalid or already used. Please tap "Send code" to get a fresh one.'
        );
      } else {
        Alert.alert('Verification failed', message);
      }
    } finally {
      setIsVerifying(false);
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
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
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
