// app/(tabs)/index.tsx
import { useAuth, useUser } from '@clerk/clerk-expo';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useContent } from '../../hooks/userContent';

const { width, height } = Dimensions.get('window');
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

export default function HomeScreen() {
  const { getContent, deleteContent, subscribeToContent } = useContent();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadContent = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      setLoading(true);
      console.log('[home] fetching content');
      const data = await getContent();
      console.log('[home] fetched items', data?.length);
      setItems(data);
    } catch (err) {
      console.error('[home] Load items failed', err);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, getContent]);

  useEffect(() => {
    if (!isSignedIn) return;
    const unsub = subscribeToContent(setItems);
    return () => unsub && unsub();
  }, [isSignedIn, subscribeToContent]);

  const onRefresh = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      setRefreshing(true);
      await loadContent();
    } finally {
      setRefreshing(false);
    }
  }, [isSignedIn, loadContent]);

  const confirmDelete = (id: string) => {
    Alert.alert(
      'Delete item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContent(id);
              setItems(prev => prev.filter(i => i.id !== id));
            } catch (err) {
              console.error('Delete failed', err);
              Alert.alert('Delete failed', 'Could not delete this item. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Calculate which items are visible based on scroll position
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const viewportHeight = event.nativeEvent.layoutMeasurement.height;

    // Calculate visible range with some buffer (play videos slightly before they're fully visible)
    const bufferZone = CARD_HEIGHT; // Start loading one card height before visible
    const visibleStart = scrollY - bufferZone;
    const visibleEnd = scrollY + viewportHeight + bufferZone;

    const newVisibleIndices = new Set<number>();

    // Calculate which items are in view
    // Assuming 2 columns grid
    items.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const itemY = row * (CARD_HEIGHT + CARD_GAP);
      const itemEndY = itemY + CARD_HEIGHT;

      // Check if item is within visible range
      if (itemEndY >= visibleStart && itemY <= visibleEnd) {
        newVisibleIndices.add(index);
      }
    });

    setVisibleIndices(newVisibleIndices);
  }, [items]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.firstName || 'there'} ✨</Text>
          <Text style={styles.subtitle}>Your saved content</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton}>
            <Search size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Grid */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16} // Update every 16ms for smooth tracking
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No saved content yet
            </Text>
            <Text style={styles.emptyStateSubtext}>Start saving your favorite content!</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item, index) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(index * 100).springify()}
              >
                <ContentCard
                  item={item}
                  isVisible={visibleIndices.has(index)}
                  onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                  onLongPress={() => confirmDelete(item.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ContentCard({
  item,
  isVisible,
  onPress,
  onLongPress,
}: {
  item: any;
  isVisible: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const videoRef = useRef<Video>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const isVideo = item.type === 'video';
  const videoUri = isVideo ? (item.mediaUrl || item.url || '') : '';
  const imageUri = !isVideo ? (item.thumbnail || item.mediaUrl || '') : (item.thumbnail || '');
  const hasVideo = isVideo && !!videoUri && !videoError;
  const hasImage = !isVideo && !!imageUri;

  // Handle video play/pause based on visibility
  useEffect(() => {
    if (!hasVideo || !videoRef.current) return;

    const controlVideo = async () => {
      try {
        if (isVisible && isLoaded) {
          await videoRef.current?.playAsync();
        } else {
          await videoRef.current?.pauseAsync();
        }
      } catch (error) {
        console.log('Video control error:', error);
      }
    };

    controlVideo();
  }, [isVisible, isLoaded, hasVideo]);

  const handleVideoLoad = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoaded(true);
    }
  };
  const handleVideoError = (error: any) => {
    console.log('Video load error:', error);
    setVideoError(true);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => {
        if (hasVideo) {
          onPress();
        } else if (item.url) {
          WebBrowser.openBrowserAsync(item.url);
        }
      }}
      onLongPress={onLongPress}
    >
      {hasVideo ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={styles.cardImage}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          shouldPlay={false} // Control manually via useEffect
          onPlaybackStatusUpdate={handleVideoLoad}
          onError={handleVideoError}
          usePoster
          posterSource={{ uri: imageUri }}
          posterStyle={styles.cardImage}
        />
      ) : hasImage ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cardImage, styles.placeholder]}>
          <Text style={styles.placeholderText}>{item.type === 'url' ? '🔗' : '📁'}</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tags}>
            {item.tags.slice(0, 2).map((tag: string) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
    marginBottom: 8,
    lineHeight: 18,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
