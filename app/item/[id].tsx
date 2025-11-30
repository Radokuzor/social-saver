import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ResizeMode, Video } from 'expo-av';
import { Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const Colors = {
  primary: '#ec4899',
  background: '#ffffff',
  surface: '#fafafa',
  text: '#171717',
  textSecondary: '#737373',
  border: '#e5e5e5',
};

export default function ItemDetail() {
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'items', String(id)));
        if (snap.exists()) {
          setItem({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error('Load item failed', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.title}>Item not found</Text>
      </SafeAreaView>
    );
  }

  const isVideo = item.type === 'video';
  const videoUri = isVideo ? (item.mediaUrl || item.url || '') : '';
  const imageUri = !isVideo
    ? (item.thumbnail || item.mediaUrl || item.metadata?.image || '')
    : (item.thumbnail || item.metadata?.image || '');
  const hasVideo = isVideo && !!videoUri;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: item.title || 'Item' }} />
      <View style={styles.mediaContainer}>
        {hasVideo ? (
          <Video
            source={{ uri: videoUri }}
            style={styles.media}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            isLooping
          />
        ) : imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.media} resizeMode="contain" />
        ) : (
          <View style={[styles.media, styles.placeholder]}>
            <Text style={styles.placeholderText}>No media</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
        {item.url ? (
          <TouchableOpacity style={styles.linkButton} onPress={() => WebBrowser.openBrowserAsync(item.url)}>
            <Text style={styles.linkText}>Open Link</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mediaContainer: {
    width: '100%',
    height: 300,
    backgroundColor: Colors.surface,
  },
  media: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  linkButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  linkText: {
    color: '#fff',
    fontWeight: '700',
  },
});
