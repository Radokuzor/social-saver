// hooks/useFolders.ts
import { useAuth } from '@clerk/clerk-expo';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
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
    const { userId } = useAuth();
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
            const docRef = await addDoc(collection(db, 'folders'), {
                userId,
                name,
                color: '#fdf2f8',
                icon: 'folder',
                itemCount: 0,
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

    return { getFolders, createFolder, loading, error };
}