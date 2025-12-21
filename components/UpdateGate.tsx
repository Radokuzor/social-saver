import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, ensureApiBaseUrl } from '../services/api';

type GateStatus = 'checking' | 'ok' | 'blocked';

const OVERRIDE_APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION_OVERRIDE;
const APP_VERSION = (OVERRIDE_APP_VERSION || Constants.expoConfig?.version || '0.0.0').trim();

const storeLinks = {
  ios: 'https://apps.apple.com/us/app/social-saver-ai-organizer/id6755980746',
  android: 'https://play.google.com/store/apps/details?id=com.fourthwatchtech.socialsaver',
};

const compareVersions = (a: string, b: string) => {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
};

export default function UpdateGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GateStatus>('checking');
  const [requiredVersion, setRequiredVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const baseUrl = API_BASE_URL || ensureApiBaseUrl();
        const configUrl = __DEV__ ? `${baseUrl}/config?ts=${Date.now()}` : `${baseUrl}/config`;
        if (__DEV__) {
          console.info('[update-gate] checking', {
            platform: Platform.OS,
            appVersion: APP_VERSION,
            baseUrl,
            configUrl,
          });
        }
        const res = await fetch(configUrl);
        if (!res.ok) throw new Error('config fetch failed');
        const json = await res.json();
        const minVersion = Platform.OS === 'ios' ? json?.ios?.minVersion : json?.android?.minVersion;
        if (__DEV__) {
          console.info('[update-gate] config', {
            platform: Platform.OS,
            appVersion: APP_VERSION,
            minVersion,
            blocked: Boolean(minVersion && compareVersions(APP_VERSION, minVersion) < 0),
          });
        }
        if (minVersion && compareVersions(APP_VERSION, minVersion) < 0) {
          if (!cancelled) {
            setRequiredVersion(minVersion);
            setStatus('blocked');
          }
          return;
        }
      } catch (err) {
        // Soft-fail: allow app if config missing/unreachable
        console.warn('[update-gate] skipped:', err);
      }
      if (!cancelled) setStatus('ok');
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'blocked') {
    const storeUrl = Platform.OS === 'ios' ? storeLinks.ios : storeLinks.android;
    return (
      <View style={styles.blocker}>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.subtitle}>
          Please update to the latest version to continue.{requiredVersion ? ` (Min: v${requiredVersion})` : ''}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(storeUrl)} activeOpacity={0.9}>
          <Text style={styles.buttonText}>Update Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'checking') {
    return (
      <View style={styles.blocker}>
        <ActivityIndicator />
        <Text style={styles.subtitle}>Checking for updates...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  blocker: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center' },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
