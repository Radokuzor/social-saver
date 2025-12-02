import { onSnapshot, doc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/firebase';
import useFirebaseAuth from './useFirebaseAuth';

export type SubscriptionInfo = {
  planId: string | null;
  planName: string | null;
  billingCycle: string | null;
  status: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
};

export function useSubscription() {
  const { uid, user } = useFirebaseAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    planId: null,
    planName: null,
    billingCycle: null,
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setSubscription({
        planId: null,
        planName: null,
        billingCycle: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    const userRef = doc(db, 'users', uid);
    const metaSubRef = doc(db, 'users', uid, 'meta', 'subscription');
    const legacySubscriptionDocRef = doc(db, 'users', uid, 'subscription', 'current');

    const applyData = (sub: any) => {
      if (!sub) {
        setIsLoading(false);
        return;
      }
      setSubscription({
        planId: sub.planId || null,
        planName: sub.planName || null,
        billingCycle: sub.billingCycle || null,
        status: sub.status || null,
        currentPeriodEnd: sub.currentPeriodEnd?.toDate ? sub.currentPeriodEnd.toDate() : sub.currentPeriodEnd || null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? null,
        stripeCustomerId: sub.stripeCustomerId || null,
        stripeSubscriptionId: sub.stripeSubscriptionId || null,
      });
      setIsLoading(false);
    };

    const unsubUserDoc = onSnapshot(
      userRef,
      (snap) => applyData((snap.data() as any)?.subscription),
      (err) => {
        setError(err.message);
        setIsLoading(false);
      }
    );

    const unsubMeta = onSnapshot(
      metaSubRef,
      (snap) => applyData(snap.data()),
      (err) => {
        setError(err.message);
        setIsLoading(false);
      }
    );

    const unsubLegacy = onSnapshot(
      legacySubscriptionDocRef,
      (snap) => applyData(snap.data()),
      (err) => {
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => {
      unsubUserDoc();
      unsubMeta();
      unsubLegacy();
    };
  }, [uid]);

  const derived = useMemo(() => {
    const isActive = subscription.status === 'active';
    const isPro = isActive && subscription.planId === 'pro';
    return { isActive, isPro };
  }, [subscription]);

  return {
    subscription,
    isLoading,
    error,
    ...derived,
  };
}

export default useSubscription;
