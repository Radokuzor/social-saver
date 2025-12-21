import { ResizeMode, Video } from 'expo-av';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { Menu } from 'lucide-react-native';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import useFirebaseAuth from '../../hooks/useFirebaseAuth';
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
  const { getContent, deleteContent } = useContent();
  const router = useRouter();
  const { uid } = useFirebaseAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [ownerHandle, setOwnerHandle] = useState<string | null>(null);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [collaborators, setCollaborators] = useState<Array<{ uid: string; handle?: string; email?: string }>>([]);
  const [collabInput, setCollabInput] = useState('');
  const [collabLoading, setCollabLoading] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const navigation = useNavigation();

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
          setOwnerUid(data?.userId || null);
          const collabs = Array.isArray(data?.collaborators) ? data.collaborators : [];
          setCollaboratorIds(collabs);
          if (data?.userId) {
            const ownerSnap = await getDoc(doc(db, 'users', data.userId));
            if (ownerSnap.exists()) {
              const ownerData = ownerSnap.data() as any;
              setOwnerHandle(ownerData?.handle || null);
            }
          }
        }
      } catch (err) {
        console.error('Load folder meta failed', err);
      }
    };
    loadFolderMeta();
  }, [id]);

  useEffect(() => {
    const loadProfiles = async () => {
      if (!collaboratorIds.length) {
        setCollaborators([]);
        return;
      }
      try {
        const profiles = await Promise.all(
          collaboratorIds.map(async (cid) => {
            const snap = await getDoc(doc(db, 'users', cid));
            const data = snap.exists() ? (snap.data() as any) : null;
            return { uid: cid, handle: data?.handle, email: data?.email };
          })
        );
        setCollaborators(profiles);
      } catch (err) {
        console.error('Load collaborator profiles failed', err);
      }
    };
    loadProfiles();
  }, [collaboratorIds]);

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

  const isOwner = useMemo(() => uid && ownerUid && uid === ownerUid, [uid, ownerUid]);
  const handleDeleteItem = async (itemId: string) => {
    if (!isOwner) return;
    Alert.alert('Delete item', 'This will remove it from your board (and public mirror). Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContent(itemId);
            setItems((prev) => prev.filter((i) => i.id !== itemId));
          } catch (err) {
            console.error('Delete item failed', err);
            Alert.alert('Delete failed', 'Could not delete this item. Please try again.');
          }
        },
      },
    ]);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setShowMenu((prev) => !prev)}
          style={{ paddingHorizontal: 10, paddingVertical: 6 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Menu size={20} color={Colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleAddCollaborator = async () => {
    if (!id || !isOwner) return;
    const raw = collabInput.trim();
    if (!raw) return;
    setCollabError(null);
    setCollabLoading(true);
    try {
      const normalized = raw.replace(/^@/, '').toLowerCase();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('handleLower', '==', normalized));
      const snap = await getDocs(q);
      if (snap.empty) {
        setCollabError('No user found with that handle');
        return;
      }
      const userDoc = snap.docs[0];
      const targetUid = userDoc.id;
      if (targetUid === ownerUid) {
        setCollabError('You are already the owner');
        return;
      }
      if (collaboratorIds.includes(targetUid)) {
        setCollabError('Already a collaborator');
        return;
      }
      await updateDoc(doc(db, 'folders', String(id)), {
        collaborators: arrayUnion(targetUid),
        updatedAt: new Date(),
      });
      setCollaboratorIds((prev) => [...prev, targetUid]);
      setCollabInput('');
    } catch (err) {
      console.error('Add collaborator failed', err);
      setCollabError('Failed to add collaborator. Try again.');
    } finally {
      setCollabLoading(false);
    }
  };

  const handleRemoveCollaborator = async (targetUid: string) => {
    if (!id || !isOwner) return;
    Alert.alert('Remove collaborator', 'They will lose access to edit this board.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'folders', String(id)), {
              collaborators: arrayRemove(targetUid),
              updatedAt: new Date(),
            });
            setCollaboratorIds((prev) => prev.filter((c) => c !== targetUid));
          } catch (err) {
            console.error('Remove collaborator failed', err);
            Alert.alert('Error', 'Could not remove collaborator. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: name ? capitalizeFolderName(String(name)) : 'Folder',
          headerBackTitle: 'Back',
          // headerBackTitleVisible: true,
          headerTintColor: Colors.primary,
        }}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {showMenu ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 10 }}>
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
              <View style={styles.collabCard}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.visibilityLabel}>Collaborators</Text>
                  <Text style={styles.visibilityHelper}>
                    Add teammates by @handle. Collaborators can add items; public mirroring still uses this folder.
                  </Text>
                  {isOwner ? (
                    <View style={styles.collabInputRow}>
                      <TextInput
                        style={styles.collabInput}
                        placeholder="@handle"
                        autoCapitalize="none"
                        value={collabInput}
                        onChangeText={setCollabInput}
                        editable={!collabLoading}
                      />
                      <TouchableOpacity
                        style={[styles.collabAddButton, collabLoading && { opacity: 0.6 }]}
                        onPress={handleAddCollaborator}
                        disabled={collabLoading}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.collabAddButtonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {collabError ? <Text style={styles.collabError}>{collabError}</Text> : null}
                  <View style={styles.collabList}>
                    <View style={styles.collabPill}>
                      <Text style={styles.collabPillText}>{ownerHandle ? `@${ownerHandle}` : 'Owner'}</Text>
                      <Text style={styles.collabPillHandle}>{ownerUid === uid ? 'You' : 'Owner'}</Text>
                    </View>
                    {collaborators.map((c) => (
                      <View key={c.uid} style={styles.collabPillRow}>
                        <View style={styles.collabPill}>
                          <Text style={styles.collabPillText}>{c.handle ? `@${c.handle}` : 'Collaborator'}</Text>
                        </View>
                        {isOwner ? (
                          <TouchableOpacity onPress={() => handleRemoveCollaborator(c.uid)} style={styles.removeCollabButton}>
                            <Text style={styles.removeCollabText}>Remove</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </Animated.View>
          ) : null}
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
                  <FolderContentCard item={item} onDelete={isOwner ? handleDeleteItem : undefined} />
                </Animated.View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FolderContentCard({ item, onDelete }: { item: any; onDelete?: (id: string) => void }) {
  const [videoError, setVideoError] = useState(false);
  const router = useRouter();
  const { id: folderRouteId } = useLocalSearchParams();

  const isVideo = item.type === 'video';
  const videoUri = isVideo ? (item.mediaUrl || item.url || '') : '';
  const imageUri = !isVideo ? (item.thumbnail || item.mediaUrl || '') : (item.thumbnail || '');
  const hasVideo = isVideo && !!videoUri && !videoError;
  const hasImage = !isVideo && !!imageUri;
  const targetUrl = item.url || item.mediaUrl || '';
  const folderParam = item.folderId || (folderRouteId ? String(folderRouteId) : '');

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => {
        if (targetUrl) {
          router.push({ pathname: '/viewer', params: { itemId: item.id, folderId: folderParam, url: targetUrl, title: item.title || 'Content' } });
        }
      }}
      onLongPress={() => onDelete?.(item.id)}
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

function capitalizeFolderName(name: string) {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
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
  collabCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  collabInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collabInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  collabAddButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  collabAddButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  collabError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  collabList: {
    gap: 8,
    marginTop: 8,
  },
  collabPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  collabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  collabPillText: {
    color: Colors.text,
    fontWeight: '700',
  },
  collabPillHandle: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  removeCollabButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeCollabText: {
    color: Colors.textSecondary,
    fontWeight: '600',
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
