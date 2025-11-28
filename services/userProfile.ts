import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

interface ClerkUserData {
    id: string;
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    birthday?: string | null;
}

export async function syncClerkUserToFirestore(user: ClerkUserData) {
    if (!user.id) return;

    const userRef = doc(db, 'users', user.id);
    await setDoc(
        userRef,
        {
            email: user.email || '',
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            birthday: user.birthday || '',
            updatedAt: new Date(),
            createdAt: new Date(),
        },
        { merge: true }
    );
}
