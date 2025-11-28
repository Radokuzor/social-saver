// hooks/useContent.ts
import { useAuth } from '@clerk/clerk-expo';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { useCallback, useState } from 'react';
import { analyzeContentWithAI } from '../services/ai';
import { db, storage } from '../services/firebase';
import { getOrCreateFolder } from '../services/folders';
import { extractUrlMetadata } from '../services/metadata';
import { imageToBase64, uploadMedia } from '../services/storage';

interface SaveContentParams {
    type: 'url' | 'image' | 'video';
    url?: string;
    mediaUri?: string;
    title: string;
    description: string;
    tags: string[];
    folderId?: string; // if known
    folderName?: string; // fallback name to create/find
    aiSuggestedFolders?: string[];
    aiCategory?: string;
    thumbnail?: string;
}

export function useContent() {
    const { userId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const saveContent = useCallback(async (contentData: SaveContentParams) => {
        try {
            setLoading(true);
            setError(null);

            if (!userId) {
                throw new Error('User not authenticated');
            }

            let metadata = {};
            let mediaUrl = '';
            let thumbnail = contentData.thumbnail || '';
            let finalFolderId = contentData.folderId || null;

            // Pick folder
            if (!finalFolderId) {
                const nameToUse =
                    contentData.folderName ||
                    contentData.aiSuggestedFolders?.[0] ||
                    contentData.aiCategory ||
                    'Unsorted';
                finalFolderId = await getOrCreateFolder(userId, nameToUse);
            }

            // Handle URL content
            if (contentData.type === 'url' && contentData.url) {
                const urlMetadata = await extractUrlMetadata(contentData.url);
                metadata = urlMetadata;
                thumbnail = urlMetadata.image || '';
            }

            // Handle media content (image/video)
            if ((contentData.type === 'image' || contentData.type === 'video') && contentData.mediaUri) {
                mediaUrl = await uploadMedia(
                    { uri: contentData.mediaUri, type: `${contentData.type}/jpeg` },
                    userId
                );
                thumbnail = mediaUrl;
            }

            // Save to Firestore
            const docRef = await addDoc(collection(db, 'items'), {
                userId,
                type: contentData.type,
                url: contentData.url || '',
                mediaUrl,
                title: contentData.title,
                description: contentData.description,
                thumbnail,
                tags: contentData.tags,
                folderId: finalFolderId || null,
                aiSuggestedFolders: contentData.aiSuggestedFolders || [],
                aiCategory: contentData.aiCategory || '',
                metadata,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            console.log('Content saved successfully with ID:', docRef.id);
            return docRef.id;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save content';
            console.error('Save content error:', errorMessage);
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const getContent = useCallback(async (folderId?: string) => {
        try {
            setLoading(true);
            setError(null);

            if (!userId) {
                throw new Error('User not authenticated');
            }

            const q = folderId
                ? query(
                    collection(db, 'items'),
                    where('userId', '==', userId),
                    where('folderId', '==', folderId)
                )
                : query(
                    collection(db, 'items'),
                    where('userId', '==', userId)
                );

            const querySnapshot = await getDocs(q);
            const items = querySnapshot.docs.map(doc => {
                const data = doc.data() as any;
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
                };
            }).sort((a, b) => {
                const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bDate - aDate;
            });

            return items;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch content';
            console.error('Get content error:', errorMessage);
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const updateContent = useCallback(async (itemId: string, updates: Partial<SaveContentParams>) => {
        try {
            setLoading(true);
            setError(null);

            if (!userId) {
                throw new Error('User not authenticated');
            }

            const itemRef = doc(db, 'items', itemId);
            await updateDoc(itemRef, {
                ...updates,
                updatedAt: new Date(),
            });

            console.log('Content updated successfully');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update content';
            console.error('Update content error:', errorMessage);
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const deleteContent = useCallback(async (itemId: string) => {
        try {
            setLoading(true);
            setError(null);

            if (!userId) {
                throw new Error('User not authenticated');
            }

            const itemRef = doc(db, 'items', itemId);
            try {
                const snap = await getDoc(itemRef);
                const data = snap.data() as any;
                if (data?.mediaUrl) {
                    const mediaRef = ref(storage, data.mediaUrl);
                    await deleteObject(mediaRef);
                }
            } catch (cleanupErr) {
                console.warn('Media cleanup skipped', cleanupErr);
            }
            await deleteDoc(itemRef);

            console.log('Content deleted successfully');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete content';
            console.error('Delete content error:', errorMessage);
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const analyzeContent = useCallback(async (
        type: 'url' | 'image' | 'video',
        urlOrUri: string
    ) => {
        try {
            setLoading(true);
            setError(null);

            let analysisResult;

            if (type === 'url') {
                // First get metadata
                const metadata = await extractUrlMetadata(urlOrUri);
                // Then analyze with AI
                analysisResult = await analyzeContentWithAI({
                    type: 'url',
                    metadata,
                    url: urlOrUri
                });
            } else if (type === 'image') {
                // Convert image to base64
                const base64 = await imageToBase64(urlOrUri);
                // Analyze with AI
                analysisResult = await analyzeContentWithAI({
                    type: 'image',
                    imageBase64: base64
                });
            } else {
                // Video analysis
                analysisResult = await analyzeContentWithAI({
                    type: 'video',
                    url: urlOrUri
                });
            }

            return analysisResult;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to analyze content';
            console.error('Analyze content error:', errorMessage);
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const subscribeToContent = useCallback((onUpdate: (items: any[]) => void, folderId?: string) => {
        if (!userId) return () => { };

        const q = folderId
            ? query(
                collection(db, 'items'),
                where('userId', '==', userId),
                where('folderId', '==', folderId)
            )
            : query(
                collection(db, 'items'),
                where('userId', '==', userId)
            );

        const unsub = onSnapshot(q, (snapshot) => {
            const mapped = snapshot.docs.map(doc => {
                const data = doc.data() as any;
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
                };
            }).sort((a, b) => {
                const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bDate - aDate;
            });
            onUpdate(mapped);
        }, (err) => {
            console.error('Subscribe content error:', err);
            setError(err.message);
        });

        return unsub;
    }, [userId]);

    return {
        saveContent,
        getContent,
        updateContent,
        deleteContent,
        analyzeContent,
        subscribeToContent,
        loading,
        error,
    };
}
