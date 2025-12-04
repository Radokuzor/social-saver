// hooks/useFolders.ts
import useFirebaseAuth from './useFirebaseAuth';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import { db } from '../services/firebase';

export interface FolderDoc {
    id: string;
    userId: string;
    name: string;
    color?: string;
    icon?: string;
    itemCount?: number;
    colorIndex?: number;
}

export function useFolders() {
    const { uid: userId } = useFirebaseAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getFolders = useCallback(async (): Promise<FolderDoc[]> => {
        if (!userId) throw new Error('User not authenticated');
        try {
            setLoading(true);
            setError(null);
            const q = query(collection(db, 'folders'), where('userId', '==', userId));
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load folders';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const createFolder = useCallback(async (name: string) => {
        if (!userId) throw new Error('User not authenticated');
        try {
            setLoading(true);
            setError(null);
            const trimmed = name.trim();
            const lowered = trimmed.toLowerCase();
            const docRef = await addDoc(collection(db, 'folders'), {
                userId,
                name: trimmed,
                nameLower: lowered,
                color: '#fdf2f8',
                icon: 'folder',
                itemCount: 0,
                isPublic: true,
                collaborators: [],
                colorIndex: Math.floor(Math.random() * 6), // Random color index 0-5
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            return docRef.id;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create folder';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const deleteFolder = useCallback(async (folderId: string) => {
        if (!userId) throw new Error('User not authenticated');
        const deletePublicMirror = async () => {
            try {
                const publicRef = doc(db, 'publicFolders', folderId);
                const publicItemsSnap = await getDocs(collection(publicRef, 'items'));
                await Promise.all(publicItemsSnap.docs.map((d) => deleteDoc(d.ref)));
                await deleteDoc(publicRef);
            } catch (err) {
                console.warn('[folders] delete public mirror failed', err);
            }
        };
        try {
            setLoading(true);
            setError(null);
            await deleteDoc(doc(db, 'folders', folderId));
            await deletePublicMirror();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete folder';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const subscribeToFolders = useCallback((onUpdate: (folders: FolderDoc[]) => void) => {
        if (!userId) return () => {};
        const q = query(collection(db, 'folders'), where('userId', '==', userId));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const data = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
                onUpdate(data);
            },
            (err) => {
                console.error('[folders] subscribe error', err);
                setError(err.message);
            }
        );
        return unsub;
    }, [userId]);

    return { getFolders, createFolder, deleteFolder, subscribeToFolders, loading, error };
}
