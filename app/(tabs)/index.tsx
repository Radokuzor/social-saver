// app/(tabs)/index.tsx - Enhanced with debugging
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useContent } from '../../hooks/userContent';
import { useTheme } from '../../contexts/ThemeProvider';
import useFirebaseAuth from '../../hooks/useFirebaseAuth';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = 16;
const CARD_GAP = 12;
const CARD_WIDTH = (width - (HORIZONTAL_PADDING * 2) - CARD_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

export default function HomeScreen() {
  const { getContent, deleteContent } = useContent();
  const { uid, user } = useFirebaseAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[home] 🚀 Starting content load...');
      console.log('[home] Auth status:', { isSignedIn: !!uid, userId: uid });

      const data = await getContent();
      console.log('[home] ✅ Content loaded:', data?.length, 'items');

      setItems(data);
    } catch (err: any) {
      console.error('[home] ❌ Load items failed:', err);
      console.error('[home] Error details:', {
        message: err?.message,
        code: err?.code,
        stack: err?.stack?.substring(0, 200),
      });

      Alert.alert(
        'Failed to Load Content',
        `Error: ${err?.message || 'Unknown error'}\n\nCheck console for details.`,
        [{ text: 'OK' }],
      );
    } finally {
      setLoading(false);
    }
  }, [uid, getContent]);

  useEffect(() => {
    console.log('[home] 🎬 Component mounted');
      console.log('[home] Initial auth state:', { isSignedIn: !!uid, userId: uid });
  }, []);

  useEffect(() => {
    console.log('[home] 🔄 Auth state changed:', { isSignedIn: !!uid, userId: uid });
    if (uid) {
      loadContent();
    } else {
      setItems([]);
    }
  }, [uid, loadContent]);

  useFocusEffect(
    useCallback(() => {
      console.log('[home] 👁️ Screen focused');
      if (!uid) {
        console.log('[home] User not signed in, skipping load');
        setItems([]);
        return;
      }
      let mounted = true;
      (async () => {
        try {
          console.log('[home] Loading on focus...');
          const data = await getContent();
          if (mounted) {
            console.log('[home] Setting items on focus:', data?.length);
            setItems(data);
          }
        } catch (err) {
          console.error('[home] load on focus failed', err);
        }
      })();
      return () => {
        mounted = false;
        console.log('[home] 👋 Screen unfocused');
      };
    }, [uid, getContent]),
  );

  const onRefresh = useCallback(async () => {
    if (!uid) return;
    try {
      setRefreshing(true);
      await loadContent();
    } finally {
      setRefreshing(false);
    }
  }, [uid, loadContent]);

  useFocusEffect(
    useCallback(() => {
      setShowSearch(false);
      setSearch('');
      return () => {};
    }, []),
  );

  const filteredItems = React.useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
      return title.includes(q) || desc.includes(q) || tags.includes(q);
    });
  }, [items, search]);

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
              setItems((prev) => prev.filter((i) => i.id !== id));
            } catch (err) {
              console.error('Delete failed', err);
              Alert.alert('Delete failed', 'Could not delete this item. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const viewportHeight = event.nativeEvent.layoutMeasurement.height;

    const bufferZone = CARD_HEIGHT;
    const visibleStart = scrollY - bufferZone;
    const visibleEnd = scrollY + viewportHeight + bufferZone;

    const newVisibleIndices = new Set<number>();

    items.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const itemY = row * (CARD_HEIGHT + CARD_GAP);
      const itemEndY = itemY + CARD_HEIGHT;

      if (itemEndY >= visibleStart && itemY <= visibleEnd) {
        newVisibleIndices.add(index);
      }
    });

    setVisibleIndices(newVisibleIndices);
  }, [items]);

  const handleOpenContent = useCallback(
    (item: any) => {
      const targetUrl = item.url || item.mediaUrl || '';
      if (targetUrl) {
        router.push({ pathname: '/viewer', params: { url: targetUrl, title: item.title || 'Content' } });
      }
    },
    [router],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.text }]}>
            Hello, {(user?.displayName || user?.email || 'there')} ✨
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your saved content
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconButton, styles.searchButton]}
            onPress={() => {
              setShowSearch((prev) => !prev);
              if (showSearch) setSearch('');
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View pointerEvents="none">
              <Search size={24} color={colors.text} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by title, description, or tags"
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            autoFocus
          />
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.subtitle, { marginTop: 12, color: colors.textSecondary }]}>
              Loading your content...
            </Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {search.trim() ? 'No items match your search' : 'No saved content yet'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
            {search.trim() ? 'Try a different keyword' : 'Start saving your favorite content!'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredItems.map((item, index) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(index * 100).springify()}
              >
                <ContentCard
                  item={item}
                  isVisible={visibleIndices.has(index)}
                  onPress={() => handleOpenContent(item)}
                  onLongPress={() => confirmDelete(item.id)}
                  styles={styles}
                  colors={colors}
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
  styles,
  colors,
}: {
  item: any;
  isVisible: boolean;
  onPress: () => void;
  onLongPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: any;
}) {
  const videoRef = useRef<Video>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const isVideo = item.type === 'video';
  const videoUri = isVideo ? (item.mediaUrl || item.url || '') : '';
  const imageUri = !isVideo
    ? (item.thumbnail || item.mediaUrl || item.metadata?.image || '')
    : (item.thumbnail || item.metadata?.image || '');
  const hasVideo = isVideo && !!videoUri && !videoError;
  const hasImage = !isVideo && !!imageUri;

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
      style={[styles.card, { backgroundColor: colors.background, shadowColor: colors.text }]}
      activeOpacity={0.8}
      onPress={onPress}
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
          shouldPlay={false}
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
              <View key={tag} style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
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
    color: palette.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: palette.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
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
    backgroundColor: palette.background,
    borderRadius: 16,
    marginBottom: CARD_GAP,
    overflow: 'hidden',
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: CARD_HEIGHT,
    backgroundColor: palette.surface,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 8,
    lineHeight: 18,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: palette.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '600',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  placeholderText: {
    fontSize: 32,
    color: palette.textSecondary,
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
    color: palette.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
  },
});
