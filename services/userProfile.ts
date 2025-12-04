import { addDoc, collection, getDoc, getDocs, query, where } from 'firebase/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

interface ClerkUserData {
    id: string;
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    birthday?: string | null;
}

export const PLAN_LIMITS: Record<string, {
    dailySaves?: number;
    monthlySaves?: number;
    aiMonthly?: number;
    aiDaily?: number;
}> = {
    free: { dailySaves: 5, monthlySaves: 20, aiMonthly: 10, aiDaily: 3 },
    plus: { monthlySaves: 100, aiMonthly: 25, aiDaily: 10 }, // Basic
    pro: { monthlySaves: Infinity, aiMonthly: Infinity, aiDaily: Infinity }, // Better
    business: { monthlySaves: Infinity, aiMonthly: Infinity, aiDaily: Infinity }, // Best
};

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
    const subRef = doc(db, 'users', userId, 'meta', 'subscription');
    const [userSnap, subSnap] = await Promise.all([getDoc(userRef), getDoc(subRef)]);
    const base = userSnap.exists() ? userSnap.data() : {};
    const sub = subSnap.exists() ? { subscription: subSnap.data() } : {};
    return { ...base, ...sub };
}

export function getPlanLimits(planId?: string) {
    if (!planId) return PLAN_LIMITS.free;
    return PLAN_LIMITS[planId] || PLAN_LIMITS.free;
}

export async function claimHandleAndPhone(
    userId: string,
    handle: string,
    phoneNumber: string
) {
    if (!userId) throw new Error('Missing user id');
    const trimmed = (handle || '').trim();
    const canonical = trimmed.replace(/^@/, '').toLowerCase();
    if (!canonical) throw new Error('Handle is required');
    if (!phoneNumber.trim()) throw new Error('Phone number is required');

    // Ensure handle is unique
    const handlesRef = collection(db, 'users');
    const q = query(handlesRef, where('handleLower', '==', canonical));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const conflict = snap.docs.find((d) => d.id !== userId);
        if (conflict) {
            throw new Error('Handle is already taken. Please choose another.');
        }
    }

    const userRef = doc(db, 'users', userId);
    await setDoc(
        userRef,
        {
            handle: trimmed,
            handleLower: canonical,
            phoneNumber: phoneNumber.trim(),
            updatedAt: new Date(),
        },
        { merge: true }
    );
}

export async function ensureHandleAvailable(handle: string, excludeUserId?: string) {
    const trimmed = (handle || '').trim();
    const canonical = trimmed.replace(/^@/, '').toLowerCase();
    if (!canonical) throw new Error('Handle is required');

    const handlesRef = collection(db, 'users');
    const q = query(handlesRef, where('handleLower', '==', canonical));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const conflict = snap.docs.find((d) => d.id !== excludeUserId);
        if (conflict) {
            throw new Error('Handle is already taken. Please choose another.');
        }
    }
}

export async function checkAndIncrementAiUsage(userId: string, planId?: string) {
    if (!userId) return;
    const limits = getPlanLimits(planId);
    if ((!limits.aiMonthly || limits.aiMonthly === Infinity) && (!limits.aiDaily || limits.aiDaily === Infinity)) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const usageSnap = await getDocs(query(
        collection(db, 'aiUsage'),
        where('userId', '==', userId),
        where('createdAt', '>=', monthStart)
    ));

    const dayCount = usageSnap.docs.reduce((count, docSnap) => {
        const created = docSnap.data().createdAt?.toDate ? docSnap.data().createdAt.toDate() : docSnap.data().createdAt;
        return created && created >= dayStart ? count + 1 : count;
    }, 0);

    if (limits.aiMonthly && isFinite(limits.aiMonthly) && usageSnap.size >= limits.aiMonthly) {
        throw new Error(`AI limit reached for this month (${limits.aiMonthly}). Upgrade to continue.`);
    }
    if (limits.aiDaily && isFinite(limits.aiDaily) && dayCount >= limits.aiDaily) {
        throw new Error(`AI daily limit reached (${limits.aiDaily}). Upgrade to continue.`);
    }

    await addDoc(collection(db, 'aiUsage'), {
        userId,
        createdAt: now,
    });
}
