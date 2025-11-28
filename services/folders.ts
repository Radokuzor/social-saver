import { addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function getOrCreateFolder(userId: string, name: string) {
    const foldersRef = collection(db, 'folders');
    const q = query(foldersRef, where('userId', '==', userId), where('name', '==', name));
    const snap = await getDocs(q);
    if (!snap.empty) {
        return snap.docs[0].id;
    }
    const docRef = await addDoc(foldersRef, {
        userId,
        name,
        color: '#fdf2f8',
        icon: 'folder',
        itemCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
}
