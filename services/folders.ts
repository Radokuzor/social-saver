import { addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function getOrCreateFolder(userId: string, name: string) {
    const trimmed = (name || '').trim() || 'Unsorted';
    const foldersRef = collection(db, 'folders');
    const q = query(foldersRef, where('userId', '==', userId), where('name', '==', trimmed));
    const snap = await getDocs(q);
    if (!snap.empty) {
        return snap.docs[0].id;
    }
    console.log('[folders] creating new folder', { userId, name: trimmed });
    const docRef = await addDoc(foldersRef, {
        userId,
        name: trimmed,
        color: '#fdf2f8',
        icon: 'folder',
        itemCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
}
