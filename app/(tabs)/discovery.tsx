// app/(tabs)/discovery.tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { db } from '../../services/firebase';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARD_WIDTH = (width - (CARD_MARGIN * 3)) / 2;

const Colors = {
  primary: '#ec4899',
  secondary: '#a855f7',
  background: '#ffffff',
  surface: '#fafafa',
  text: '#171717',
  textSecondary: '#737373',
  border: '#e5e5e5',
};

// Shared palette with inspo board cards
const folderColors = [
  { bg: '#fdf2f8', border: '#fce7f3', icon: '#ec4899' }, // Pink
  { bg: '#faf5ff', border: '#f3e8ff', icon: '#a855f7' }, // Purple
  { bg: '#eff6ff', border: '#dbeafe', icon: '#3b82f6' }, // Blue
  { bg: '#f0fdfa', border: '#ccfbf1', icon: '#14b8a6' }, // Teal
  { bg: '#fef3c7', border: '#fde68a', icon: '#f59e0b' }, // Amber
  { bg: '#fee2e2', border: '#fecaca', icon: '#ef4444' }, // Red
];

interface PublicFolder {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  itemsCount?: number;
  updatedAt?: any;
}

export default function DiscoveryScreen() {
  const router = useRouter();
  const [boards, setBoards] = useState<PublicFolder[]>([]);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'publicFolders'), orderBy('updatedAt', 'desc'), limit(30));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        }));
        setBoards(data);
        setLoading(false);
      },
      (err) => {
        console.error('[discovery] load error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchPreviews = async () => {
      if (!boards.length) {
        setPreviews({});
        return;
      }
      try {
        const entries = await Promise.all(
          boards.map(async (board) => {
            const itemsRef = collection(db, 'publicFolders', board.id, 'items');
            const snap = await getDocs(query(itemsRef, orderBy('createdAt', 'desc'), limit(1)));
            const docSnap = snap.docs[0];
            const data = docSnap?.data() as any;
            const uri = data?.thumbnail || data?.mediaUrl || '';
            return [board.id, uri || null] as const;
          })
        );
        if (isMounted) {
          setPreviews(Object.fromEntries(entries));
        }
      } catch (err) {
        console.error('[discovery] preview fetch failed', err);
      }
    };
    fetchPreviews();
    return () => {
      isMounted = false;
    };
  }, [boards]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const q = query(collection(db, 'publicFolders'), orderBy('updatedAt', 'desc'), limit(30));
      const snap = await getDocs(q);
      const data = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
      }));
      setBoards(data);
    } catch (err) {
      console.error('[discovery] manual refresh failed', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Discover Inspo</Text>
          <Text style={styles.subtitle}>Public boards from the community.</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={Colors.primary} />
        ) : boards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No public boards yet</Text>
            <Text style={styles.emptyStateSubtext}>Make a folder public and your inspo will show up here.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {boards.map((board, index) => (
              <Animated.View
                key={board.id}
                entering={FadeInDown.delay(index * 80).springify()}
              >
                <PublicBoardCard
                  board={board}
                  index={index}
                  previewUri={previews[board.id]}
                  onPress={() => router.push({ pathname: '/public/[id]', params: { id: board.id, title: board.title } })}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PublicBoardCard({
  board,
  index,
  previewUri,
  onPress,
}: {
  board: PublicFolder;
  index: number;
  previewUri?: string | null;
  onPress: () => void;
}) {
  const colorIndex = index % folderColors.length;
  const colors = folderColors[colorIndex];
  const description = board.description || 'Inspo from the community';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={[styles.previewContainer, { backgroundColor: colors.border }]}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewPlaceholderText}>✨</Text>
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{board.title || 'Untitled board'}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>{description}</Text>
        <Text style={styles.cardMeta}>
          {board.itemsCount || 0} {board.itemsCount === 1 ? 'item' : 'items'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: CARD_MARGIN,
    paddingBottom: 80,
  },
  header: {
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 18,
    marginBottom: CARD_MARGIN,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  previewContainer: {
    height: 140,
    backgroundColor: Colors.surface,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholderText: {
    fontSize: 28,
    color: Colors.textSecondary,
  },
  cardContent: {
    padding: 12,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  cardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 32,
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
