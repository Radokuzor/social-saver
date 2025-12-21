import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { collection, deleteDoc, doc, getDoc, getDocs, increment, limit, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { ResizeMode, Video } from 'expo-av';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import useFirebaseAuth from '../../hooks/useFirebaseAuth';
import { db } from '../../services/firebase';
import { extractUrlMetadata } from '../../services/metadata';
import { uploadRemoteImageToStorage } from '../../services/storage';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

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
  previewThumbnail?: string | null;
  voteScore?: number;
  upvotes?: number;
  downvotes?: number;
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
  const [voteScore, setVoteScore] = useState(0);
  const [userVote, setUserVote] = useState<-1 | 0 | 1>(0);
  const [voteLoading, setVoteLoading] = useState(false);
  const formattedTitle = folder?.title ? capitalizeFolderName(folder.title) : (title as string) || 'Inspo Board';

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
          const scoreFromDoc = typeof data.voteScore === 'number'
            ? data.voteScore
            : (data.upvotes || 0) - (data.downvotes || 0);
          setVoteScore(scoreFromDoc);
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

  useEffect(() => {
    const fetchUserVote = async () => {
      if (!folder?.id || !uid) {
        setUserVote(0);
        return;
      }
      try {
        const voteSnap = await getDoc(doc(db, 'publicFolders', folder.id, 'votes', uid));
        if (voteSnap.exists()) {
          const value = (voteSnap.data() as any)?.value;
          if (value === 1 || value === -1) {
            setUserVote(value);
          } else {
            setUserVote(0);
          }
        } else {
          setUserVote(0);
        }
      } catch (err) {
        console.error('[public folder] fetch vote failed', err);
      }
    };
    void fetchUserVote();
  }, [folder?.id, uid]);

  const handleFollowToggle = async () => {
    if (!folder?.ownerUid || uid === folder.ownerUid) return;
    if (!uid) {
      Alert.alert('Sign in to follow', 'Create an account or log in to follow this creator.', [
        { text: 'OK', onPress: () => router.push('/sign-in') },
      ]);
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

  const handleVote = async (value: 1 | -1) => {
    if (!folder) return;
    if (!uid) {
      Alert.alert('Sign in to vote', 'Create an account or log in to vote on this inspo board.', [
        { text: 'OK', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    if (voteLoading) return;

    const prevVote = userVote;
    const nextVote = prevVote === value ? 0 : value;

    // Remove the previous vote, then apply the new one to keep counts accurate
    let upDelta = 0;
    let downDelta = 0;
    if (prevVote === 1) upDelta -= 1;
    if (prevVote === -1) downDelta -= 1;
    if (nextVote === 1) upDelta += 1;
    if (nextVote === -1) downDelta += 1;

    const scoreDelta = nextVote - prevVote;

    setVoteLoading(true);
    // Optimistically update UI so the buttons feel responsive.
    setUserVote(nextVote);
    setVoteScore((prevScore) => prevScore + scoreDelta);
    setFolder((prevFolder) =>
      prevFolder
        ? {
            ...prevFolder,
            upvotes: (prevFolder.upvotes || 0) + upDelta,
            downvotes: (prevFolder.downvotes || 0) + downDelta,
            voteScore: (prevFolder.voteScore || 0) + scoreDelta,
          }
        : prevFolder
    );

    try {
      const folderRef = doc(db, 'publicFolders', folder.id);
      const voteRef = doc(folderRef, 'votes', uid);

      await updateDoc(folderRef, {
        voteScore: increment(scoreDelta),
        upvotes: increment(upDelta),
        downvotes: increment(downDelta),
      });

      if (nextVote === 0) {
        await deleteDoc(voteRef);
      } else {
        await setDoc(voteRef, { value: nextVote, updatedAt: new Date() });
      }
    } catch (err) {
      console.error('[public folder] vote failed', err);
      setUserVote(prevVote);
      setVoteScore((prevScore) => prevScore - scoreDelta);
      setFolder((prevFolder) =>
        prevFolder
          ? {
              ...prevFolder,
              upvotes: (prevFolder.upvotes || 0) - upDelta,
              downvotes: (prevFolder.downvotes || 0) - downDelta,
              voteScore: (prevFolder.voteScore || 0) - scoreDelta,
            }
          : prevFolder
      );
      Alert.alert('Vote failed', 'Please try again in a moment.');
    } finally {
      setVoteLoading(false);
    }
  };

  const handleOpenItem = async (item: any) => {
    const targetUrl = item.url || item.mediaUrl || '';
    if (!targetUrl) return;

    const refreshThumbnailIfNeeded = async () => {
      try {
        const hasStableThumb = item.thumbnail && item.thumbnail.includes('firebasestorage.googleapis.com');
        if (hasStableThumb || !item.url) return;
        const metadata = await extractUrlMetadata(item.url);
        const candidate = metadata.image || metadata.logo || '';
        if (!candidate) return;
        // Upload under the current viewer to avoid owner-only storage permissions
        const uploaderId = uid || item.ownerUid || item.userId || folder?.ownerUid || 'anonymous';
        const uploaded = await uploadRemoteImageToStorage(candidate, uploaderId);
        if (!uploaded) return;
        // Update local UI immediately
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, thumbnail: uploaded } : i)));
        setFolder((prev) => (prev ? { ...prev, previewThumbnail: uploaded } : prev));

        // Best-effort persistence; may fail for non-owners depending on rules
        await updateDoc(doc(db, 'publicFolders', String(id), 'items', item.id), { thumbnail: uploaded, updatedAt: new Date() }).catch(() => {});
        await updateDoc(doc(db, 'items', item.id), { thumbnail: uploaded, updatedAt: new Date() }).catch(() => {});
        await updateDoc(doc(db, 'publicFolders', String(id)), { previewThumbnail: uploaded, updatedAt: new Date() }).catch(() => {});
      } catch (err) {
        console.warn('[public folder] thumbnail refresh failed', err);
      }
    };

    void refreshThumbnailIfNeeded();
    router.push({
      pathname: '/viewer',
      params: { itemId: item.id, publicFolderId: String(id), url: targetUrl, title: item.title || 'Content' },
    });
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
          title: formattedTitle,
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
              <Text style={styles.handle}>{handle ? `${formattedTitle} by @${handle}` : formattedTitle}</Text>
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
              <View style={styles.voteGroup}>
                <TouchableOpacity
                  style={[
                    styles.voteButton,
                    userVote === 1 && styles.voteButtonActiveUp,
                  ]}
                  onPress={() => handleVote(1)}
                  disabled={voteLoading}
                  activeOpacity={0.8}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <View pointerEvents="none">
                    <ChevronUp size={18} color={userVote === 1 ? '#16a34a' : '#22c55e'} strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>
                <Text style={styles.voteCount}>{voteScore}</Text>
                <TouchableOpacity
                  style={[
                    styles.voteButton,
                    userVote === -1 && styles.voteButtonActiveDown,
                  ]}
                  onPress={() => handleVote(-1)}
                  disabled={voteLoading}
                  activeOpacity={0.8}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <View pointerEvents="none">
                    <ChevronDown size={18} color={userVote === -1 ? '#dc2626' : '#ef4444'} strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>
              </View>
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
                  <PublicItemCard
                    item={item}
                    router={router}
                    publicFolderId={String(id)}
                    onRemove={uid === folder.ownerUid ? handleRemovePublicItem : undefined}
                    onOpen={handleOpenItem}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PublicItemCard({
  item,
  router,
  publicFolderId,
  onRemove,
  onOpen,
}: {
  item: any;
  router: ReturnType<typeof useRouter>;
  publicFolderId: string;
  onRemove?: (id: string) => void;
  onOpen?: (item: any) => void;
}) {
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
        if (onOpen) {
          onOpen(item);
          return;
        }
        if (targetUrl) {
          router.push({
            pathname: '/viewer',
            params: { itemId: item.id, publicFolderId, url: targetUrl, title: item.title || 'Content' },
          });
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
  voteGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  voteButtonActiveUp: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  voteButtonActiveDown: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  voteCount: {
    minWidth: 28,
    textAlign: 'center',
    fontWeight: '700',
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

function capitalizeFolderName(name: string) {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}
