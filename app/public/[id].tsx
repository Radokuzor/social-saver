import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { collection, deleteDoc, doc, getDoc, getDocs, increment, limit, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { ResizeMode, Video } from 'expo-av';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import useFirebaseAuth from '../../hooks/useFirebaseAuth';
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

interface PublicFolder {
  id: string;
  title: string;
  description?: string;
  ownerUid?: string;
  itemsCount?: number;
  followersCount?: number;
  isPublic?: boolean;
}

export default function PublicFolderScreen() {
  const { id, title } = useLocalSearchParams();
  const router = useRouter();
  const { uid } = useFirebaseAuth();
  const [folder, setFolder] = useState<PublicFolder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const ensureOwner = useCallback(async (itemList: any[] = []) => {
    if (folder?.ownerUid) return folder.ownerUid;
    let candidate: string | null = null;

    // Try from items
    const firstOwner = itemList.find((it) => it?.userId)?.userId;
    if (firstOwner) {
      candidate = firstOwner;
    } else {
      // Try from private folder doc
      try {
        const privateSnap = await getDoc(doc(db, 'folders', String(id)));
        if (privateSnap.exists()) {
          const data = privateSnap.data() as any;
          candidate = data?.userId || null;
        }
      } catch (err) {
        console.error('[public folder] fallback owner lookup failed', err);
      }
    }

    if (candidate) {
      setFolder((prev) => (prev ? { ...prev, ownerUid: candidate } : prev));
      updateDoc(doc(db, 'publicFolders', String(id)), { ownerUid: candidate }).catch(() => {});
    }
    return candidate;
  }, [folder?.ownerUid, id]);

  useEffect(() => {
    const loadFolder = async () => {
      if (!id) return;
      try {
        const folderSnap = await getDoc(doc(db, 'publicFolders', String(id)));
        if (folderSnap.exists()) {
          const data = folderSnap.data() as any;
          setFolder({ ...(data as PublicFolder), id: folderSnap.id });
        }
      } catch (err) {
        console.error('[public folder] load failed', err);
      }
    };

    const loadItems = async () => {
      if (!id) return;
      try {
        const itemsSnap = await getDocs(
          query(
            collection(db, 'publicFolders', String(id), 'items'),
            orderBy('createdAt', 'desc'),
            limit(100)
          )
        );
        const data = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setItems(data);

        // Fallback owner from items or private folder if missing
        if (!folder?.ownerUid) {
          void ensureOwner(data);
        }
      } catch (err) {
        console.error('[public folder] load items failed', err);
      }
    };

    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadFolder(), loadItems()]);
      setLoading(false);
    };

    void loadAll();
  }, [id, uid, folder?.ownerUid, ensureOwner]);

  useEffect(() => {
    const fetchOwnerMeta = async () => {
      if (!folder?.ownerUid) return;
      try {
        const userSnap = await getDoc(doc(db, 'users', folder.ownerUid));
        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
          setHandle(userData?.handle || null);
        }
        if (uid && uid !== folder.ownerUid) {
          const followSnap = await getDoc(doc(db, 'users', uid, 'following', folder.ownerUid));
          setIsFollowing(followSnap.exists());
        }
      } catch (err) {
        console.error('[public folder] owner meta failed', err);
      }
    };
    void fetchOwnerMeta();
  }, [folder?.ownerUid, uid]);

  const handleFollowToggle = async () => {
    if (!folder?.ownerUid || uid === folder.ownerUid) return;
    if (!uid) {
      Alert.alert('Sign in to follow', 'Create an account or log in to follow this creator.');
      return;
    }
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const target = folder.ownerUid;
      const followingRef = doc(db, 'users', uid, 'following', target);
      const followerRef = doc(db, 'users', target, 'followers', uid);
      if (isFollowing) {
        await Promise.all([
          deleteDoc(followingRef),
          deleteDoc(followerRef),
          updateDoc(doc(db, 'publicFolders', folder.id), { followersCount: increment(-1) }).catch(() => {})
        ]);
        setIsFollowing(false);
      } else {
        await Promise.all([
          setDoc(followingRef, { targetUid: target, createdAt: new Date() }),
          setDoc(followerRef, { uid, createdAt: new Date() }),
          updateDoc(doc(db, 'publicFolders', folder.id), { followersCount: increment(1) }).catch(() => {})
        ]);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('[public folder] follow toggle failed', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleRemovePublicItem = async (itemId: string) => {
    if (!folder || uid !== folder.ownerUid) return;
    Alert.alert('Remove from public', 'Hide this item from the public board?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const publicRef = doc(db, 'publicFolders', folder.id);
            await deleteDoc(doc(publicRef, 'items', itemId));
            await updateDoc(publicRef, { itemsCount: increment(-1), updatedAt: new Date() }).catch(() => {});
            setItems((prev) => prev.filter((i) => i.id !== itemId));
          } catch (err) {
            console.error('[public folder] remove item failed', err);
            Alert.alert('Remove failed', 'Could not remove this item from public view.');
          }
        },
      },
    ]);
  };

  const handleMakePrivate = async () => {
    if (!folder || uid !== folder.ownerUid) return;
    Alert.alert('Make private', 'This will remove the board from public discovery. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, make private',
        style: 'destructive',
        onPress: async () => {
          try {
            const folderId = folder.id;
            await updateDoc(doc(db, 'folders', folderId), { isPublic: false, updatedAt: new Date() }).catch(() => {});
            const publicRef = doc(db, 'publicFolders', folderId);
            const publicItemsSnap = await getDocs(collection(publicRef, 'items'));
            await Promise.all(publicItemsSnap.docs.map((d) => deleteDoc(d.ref)));
            await deleteDoc(publicRef);
            setItems([]);
            setFolder((prev) => (prev ? { ...prev, isPublic: false } : prev));
            Alert.alert('Removed', 'Board is now private.');
            router.back();
          } catch (err) {
            console.error('[public folder] make private failed', err);
            Alert.alert('Failed', 'Could not update visibility. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: (title as string) || 'Inspo Board',
          headerBackTitle: 'Back',
          headerTintColor: Colors.primary,
        }}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : !folder ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Board not found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.header}>
            <View style={styles.creatorRow}>
              <Text style={styles.handle}>{handle ? `@${handle}` : 'Creator'}</Text>
              {folder.ownerUid && uid !== folder.ownerUid ? (
                <TouchableOpacity
                  style={[styles.followButton, isFollowing && styles.followingButton]}
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {folder.ownerUid && uid === folder.ownerUid ? (
                <TouchableOpacity
                  style={[styles.followButton, styles.removeButton]}
                  onPress={handleMakePrivate}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.followButtonText]}>Remove from Public</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No items yet</Text>
        </View>
      ) : (
            <View style={styles.grid}>
              {items.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.delay(index * 80).springify()}
                >
                  <PublicItemCard item={item} router={router} onRemove={uid === folder.ownerUid ? handleRemovePublicItem : undefined} />
                </Animated.View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PublicItemCard({ item, router, onRemove }: { item: any; router: ReturnType<typeof useRouter>; onRemove?: (id: string) => void }) {
  const [videoError, setVideoError] = useState(false);

  const isVideo = item.type === 'video';
  const videoUri = isVideo ? (item.mediaUrl || item.url || '') : '';
  const imageUri = !isVideo ? (item.thumbnail || item.mediaUrl || '') : (item.thumbnail || '');
  const hasVideo = isVideo && !!videoUri && !videoError;
  const hasImage = !isVideo && !!imageUri;
  const targetUrl = item.url || item.mediaUrl || '';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => {
        if (targetUrl) {
          router.push({ pathname: '/viewer', params: { url: targetUrl, title: item.title || 'Content' } });
        }
      }}
      onLongPress={() => onRemove?.(item.id)}
      delayLongPress={400}
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
  header: {
    marginBottom: 16,
    gap: 8,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  meta: {
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 4,
  },
  handle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  followButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  removeButton: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  followingButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followingButtonText: {
    color: Colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
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
