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
}> = {
    free: { dailySaves: 15, monthlySaves: 20, aiMonthly: 10 },
    plus: { monthlySaves: 100, aiMonthly: 25 }, // Basic
    pro: { monthlySaves: Infinity, aiMonthly: Infinity }, // Better
    business: { monthlySaves: Infinity, aiMonthly: Infinity }, // Best
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
    const snap = await getDoc(userRef);
    return snap.exists() ? snap.data() : null;
}

export function getPlanLimits(planId?: string) {
    if (!planId) return PLAN_LIMITS.free;
    return PLAN_LIMITS[planId] || PLAN_LIMITS.free;
}

export async function checkAndIncrementAiUsage(userId: string, planId?: string) {
    if (!userId) return;
    const limits = getPlanLimits(planId);
    if (!limits.aiMonthly || limits.aiMonthly === Infinity) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const usageSnap = await getDocs(query(
        collection(db, 'aiUsage'),
        where('userId', '==', userId),
        where('createdAt', '>=', monthStart)
    ));

    if (usageSnap.size >= limits.aiMonthly) {
        throw new Error(`AI limit reached for this month (${limits.aiMonthly}). Upgrade to continue.`);
    }

    await addDoc(collection(db, 'aiUsage'), {
        userId,
        createdAt: now,
    });
}
