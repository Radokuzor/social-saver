import { useEffect } from 'react';
import { SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

export default function LegacySignupRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/sign-in');
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </SafeAreaView>
  );
}
