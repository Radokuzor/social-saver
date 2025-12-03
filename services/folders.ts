import { addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function getOrCreateFolder(userId: string, name: string) {
    const trimmed = (name || '').trim() || 'Unsorted';
    const lowered = trimmed.toLowerCase();
    const foldersRef = collection(db, 'folders');

    // Fetch user's folders and find case-insensitive match to avoid duplicates (Makeup vs makeup)
    const snap = await getDocs(query(foldersRef, where('userId', '==', userId)));
    const existing = snap.docs.find(doc => {
        const data = doc.data() as any;
        return (data.nameLower || (data.name || '')).toLowerCase() === lowered;
    });
    if (existing) {
        return existing.id;
    }

    console.log('[folders] creating new folder', { userId, name: trimmed });
    const docRef = await addDoc(foldersRef, {
        userId,
        name: trimmed,
        nameLower: lowered,
        color: '#fdf2f8',
        icon: 'folder',
        itemCount: 0,
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
}
