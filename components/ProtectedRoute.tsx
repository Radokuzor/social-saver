import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useSubscription from '../hooks/useSubscription';

type Props = {
  children: React.ReactNode;
};

export default function ProtectedRoute({ children }: Props) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isLoading, isActive } = useSubscription();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>Checking your subscription...</Text>
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={[styles.text, styles.title]}>Please sign in</Text>
        <Text style={styles.text}>You need an account to access this page.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/sign-in')}>
          <Text style={styles.buttonText}>Go to sign in</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!isActive) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={[styles.text, styles.title]}>Upgrade to continue</Text>
        <Text style={styles.text}>You need an active plan to access this feature.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/pricing')}>
          <Text style={styles.buttonText}>View plans</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  text: {
    color: '#111827',
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ec4899',
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
