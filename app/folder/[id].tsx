import { ResizeMode, Video } from 'expo-av';
import { useLocalSearchParams, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useContent } from '../../hooks/userContent';
import { db } from '../../services/firebase';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = 16;
const CARD_GAP = 12;
const CARD_WIDTH = (width - (HORIZONTAL_PADDING * 2) - CARD_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

const Colors = {
  primary: '#ec4899',
  background: '#ffffff',
  surface: '#fafafa',
  text: '#171717',
  textSecondary: '#737373',
  border: '#e5e5e5',
};

export default function FolderItems() {
  const { id, name } = useLocalSearchParams();
  const { getContent } = useContent();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getContent(String(id));
        setItems(data);
      } catch (err) {
        console.error('Load folder items failed', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, getContent]);

  useEffect(() => {
    const loadFolderMeta = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'folders', String(id)));
        if (snap.exists()) {
          const data = snap.data() as any;
          setIsPublic(data?.isPublic !== false);
        }
      } catch (err) {
        console.error('Load folder meta failed', err);
      }
    };
    loadFolderMeta();
  }, [id]);

  const handleToggleVisibility = async (value: boolean) => {
    if (!id || savingVisibility) return;
    const prev = isPublic;
    setIsPublic(value);
    setSavingVisibility(true);
    try {
      await updateDoc(doc(db, 'folders', String(id)), {
        isPublic: value,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('Update folder visibility failed', err);
      setIsPublic(prev);
    } finally {
      setSavingVisibility(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: name ? String(name) : 'Folder' }} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.visibilityCard}>
            <View>
              <Text style={styles.visibilityLabel}>Folder visibility</Text>
              <Text style={styles.visibilityHelper}>
                Public folders are discoverable and new items mirror to the public feed. Private folders stay hidden.
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={handleToggleVisibility}
              trackColor={{ false: '#d4d4d4', true: Colors.primary }}
              thumbColor="#ffffff"
            />
          </View>
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No items in this folder</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.delay(index * 100).springify()}
                >
                  <FolderContentCard item={item} />
                </Animated.View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FolderContentCard({ item }: { item: any }) {
  const [videoError, setVideoError] = useState(false);

  const isVideo = item.type === 'video';
  const videoUri = isVideo ? (item.mediaUrl || item.url || '') : '';
  const imageUri = !isVideo ? (item.thumbnail || item.mediaUrl || '') : (item.thumbnail || '');
  const hasVideo = isVideo && !!videoUri && !videoError;
  const hasImage = !isVideo && !!imageUri;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => {
        if (item.url) {
          WebBrowser.openBrowserAsync(item.url);
        }
      }}
    >
      {hasVideo ? (
        <Video
          source={{ uri: videoUri }}
          style={styles.cardImage}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          shouldPlay={false}
          onError={() => setVideoError(true)}
          usePoster
          posterSource={{ uri: imageUri }}
          posterStyle={styles.cardImage}
        />
      ) : hasImage ? (
        <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.placeholder]}>
          <Text style={styles.placeholderText}>🔗</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title || 'Untitled'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 12,
    paddingBottom: 80,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  visibilityCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  visibilityLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  visibilityHelper: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    maxWidth: width - (HORIZONTAL_PADDING * 2) - 80,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.background,
    borderRadius: 16,
    marginBottom: CARD_GAP,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: CARD_HEIGHT,
    backgroundColor: Colors.surface,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  placeholderText: {
    fontSize: 32,
    color: Colors.textSecondary,
  },
});
