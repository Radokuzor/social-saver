// hooks/useContent.ts
import { useAuth } from '@clerk/clerk-expo';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { useCallback, useState } from 'react';
import { analyzeContentWithAI } from '../services/ai';
import { db, storage } from '../services/firebase';
import { getOrCreateFolder } from '../services/folders';
import { extractUrlMetadata } from '../services/metadata';
import { imageToBase64, uploadMedia } from '../services/storage';
import { fetchUserProfile, getPlanLimits } from '../services/userProfile';

interface SaveContentParams {
    type: 'url' | 'image' | 'video';
    url?: string;
    mediaUri?: string;
    title: string;
    description: string;
    tags: string[];
    folderId?: string;
    folderName?: string;
    aiSuggestedFolders?: string[];
    aiCategory?: string;
    thumbnail?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

            console.log('[content] save start', { type: contentData.type, userId });

            // Determine plan and limits
            const profile = await fetchUserProfile(userId);
            const planId = profile?.subscription?.planId || 'free';
            const limits = getPlanLimits(planId);

            // Count existing items for limits
            const allItemsSnap = await getDocs(query(collection(db, 'items'), where('userId', '==', userId)));
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const counts = allItemsSnap.docs.reduce((acc, docSnap) => {
                const data = docSnap.data() as any;
                const created = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt;
                if (created && created >= startOfDay) acc.day += 1;
                if (created && created >= startOfMonth) acc.month += 1;
                return acc;
            }, { day: 0, month: 0 });

            if (limits.dailySaves && isFinite(limits.dailySaves) && counts.day >= limits.dailySaves) {
                throw new Error(`Daily save limit reached (${limits.dailySaves}). Upgrade to save more today.`);
            }
            if (limits.monthlySaves && isFinite(limits.monthlySaves) && counts.month >= limits.monthlySaves) {
                throw new Error(`Monthly save limit reached (${limits.monthlySaves}). Upgrade to save more this month.`);
            }

            let metadata: any = {};
            let mediaUrl = '';
            let thumbnail = contentData.thumbnail || '';
            let finalFolderId = contentData.folderId || null;

            // Pick folder with retry logic
            if (!finalFolderId) {
                const nameToUse =
                    contentData.folderName?.trim() ||
                    contentData.aiSuggestedFolders?.[0]?.trim() ||
                    contentData.aiCategory?.trim() ||
                    'Unsorted';

                let retries = 3;
                while (retries > 0) {
                    try {
                        finalFolderId = await getOrCreateFolder(userId, nameToUse);
                        break;
                    } catch (err) {
                        console.warn('[content] getOrCreateFolder failed, retrying', err);
                        retries--;
                        if (retries === 0) throw err;
                        await delay(1000);
                    }
                }
            }

            // If we still failed to assign a folder, enforce a default
            if (!finalFolderId) {
                console.warn('[content] No folderId resolved, forcing Unsorted');
                finalFolderId = await getOrCreateFolder(userId, 'Unsorted');
            }

            // Handle URL content with timeout
            if (contentData.type === 'url' && contentData.url) {
                try {
                    const urlMetadata = await Promise.race([
                        extractUrlMetadata(contentData.url),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('Metadata timeout')), 10000)
                        ),
                    ]);
                    metadata = urlMetadata;
                    thumbnail = urlMetadata.image || thumbnail;
                } catch (metadataError) {
                    console.warn('[content] Metadata extraction failed, continuing', metadataError);
                    metadata = { url: contentData.url };
                }
            }

            // Handle media content with retry
            if ((contentData.type === 'image' || contentData.type === 'video') && contentData.mediaUri) {
                let uploadRetries = 3;
                while (uploadRetries > 0) {
                    try {
                        mediaUrl = await uploadMedia(
                            { uri: contentData.mediaUri, type: `${contentData.type}/jpeg` },
                            userId
                        );
                        thumbnail = mediaUrl;
                        break;
                    } catch (uploadErr) {
                        console.warn('[content] upload failed, retrying', uploadErr);
                        uploadRetries--;
                        if (uploadRetries === 0) throw uploadErr;
                        await delay(2000);
                    }
                }
            }

            // Save to Firestore with retry logic
            let saveRetries = 3;
            let docRef;

            while (saveRetries > 0) {
                try {
                    docRef = await addDoc(collection(db, 'items'), {
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
                    break;
                } catch (saveErr: any) {
                    console.error('[content] save attempt failed', saveErr);
                    saveRetries--;
                    if (saveRetries === 0 || saveErr?.code === 'permission-denied') {
                        throw saveErr;
                    }
                    await delay(1500);
                }
            }

            if (!docRef) {
                throw new Error('Failed to save content after retries');
            }

            console.log('[content] saved with ID:', docRef.id);
            return docRef.id;
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to save content';
            console.error('[content] Save content error:', err);
            setError(errorMessage);
            throw new Error(errorMessage);
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

            let retries = 3;
            let querySnapshot;

            while (retries > 0) {
                try {
                    querySnapshot = await getDocs(q);
                    break;
                } catch (fetchErr: any) {
                    console.error('[content] getDocs failed', fetchErr);
                    retries--;
                    if (retries === 0 || fetchErr?.code === 'permission-denied') {
                        throw fetchErr;
                    }
                    await delay(1000);
                }
            }

            if (!querySnapshot) {
                throw new Error('Failed to fetch content');
            }

            const items = querySnapshot.docs.map(docSnap => {
                const data = docSnap.data() as any;
                return {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
                };
            }).sort((a, b) => {
                const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bDate - aDate;
            });

            console.log('[content] fetched items', items.length);
            return items;
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to fetch content';
            console.error('[content] Get content error:', err);
            setError(errorMessage);
            throw new Error(errorMessage);
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

            let retries = 3;
            while (retries > 0) {
                try {
                    await updateDoc(itemRef, {
                        ...updates,
                        updatedAt: new Date(),
                    });
                    break;
                } catch (updateErr: any) {
                    console.error('[content] update failed', updateErr);
                    retries--;
                    if (retries === 0 || updateErr?.code === 'permission-denied') {
                        throw updateErr;
                    }
                    await delay(1000);
                }
            }

            console.log('[content] updated', itemId);
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to update content';
            console.error('[content] Update content error:', err);
            setError(errorMessage);
            throw new Error(errorMessage);
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

            // Try to cleanup media first (non-blocking)
            try {
                const snap = await getDoc(itemRef);
                const data = snap.data() as any;
                if (data?.mediaUrl) {
                    const mediaRef = ref(storage, data.mediaUrl);
                    await deleteObject(mediaRef).catch(err =>
                        console.warn('[content] Media cleanup failed:', err)
                    );
                }
            } catch (cleanupErr) {
                console.warn('[content] Media cleanup skipped:', cleanupErr);
            }

            // Delete document with retry
            let retries = 3;
            while (retries > 0) {
                try {
                    await deleteDoc(itemRef);
                    break;
                } catch (deleteErr: any) {
                    console.error('[content] delete failed', deleteErr);
                    retries--;
                    if (retries === 0 || deleteErr?.code === 'permission-denied') {
                        throw deleteErr;
                    }
                    await delay(1000);
                }
            }

            console.log('[content] deleted', itemId);
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to delete content';
            console.error('[content] Delete content error:', err);
            setError(errorMessage);
            throw new Error(errorMessage);
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
                const metadata = await extractUrlMetadata(urlOrUri);
                analysisResult = await analyzeContentWithAI({
                    type: 'url',
                    metadata,
                    url: urlOrUri
                });
            } else if (type === 'image') {
                const base64 = await imageToBase64(urlOrUri);
                analysisResult = await analyzeContentWithAI({
                    type: 'image',
                    imageBase64: base64
                });
            } else {
                analysisResult = await analyzeContentWithAI({
                    type: 'video',
                    url: urlOrUri
                });
            }

            return analysisResult;
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to analyze content';
            console.error('[content] Analyze content error:', err);
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    return {
        saveContent,
        getContent,
        updateContent,
        deleteContent,
        analyzeContent,
        loading,
        error,
    };
}
