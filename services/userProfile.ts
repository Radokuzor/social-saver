import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getDoc } from 'firebase/firestore';

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

export async function saveUserSubscription(userId: string, data: {
    planId: string;
    planName: string;
    billingCycle: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
}) {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
        subscription: {
            planId: data.planId,
            planName: data.planName,
            billingCycle: data.billingCycle,
            stripeCustomerId: data.stripeCustomerId || '',
            stripeSubscriptionId: data.stripeSubscriptionId || '',
            updatedAt: new Date(),
        },
        updatedAt: new Date(),
    }, { merge: true });
}

export async function fetchUserProfile(userId: string) {
    if (!userId) return null;
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    return snap.exists() ? snap.data() : null;
}
