import { useAuth, useUser } from '@clerk/clerk-expo';
import { FirebaseError } from 'firebase/app';
import { onAuthStateChanged, signInWithCustomToken, signOut, User as FirebaseUser } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { auth } from '../lib/firebase';
import { fetchWithAuth } from '../services/api';

type FirebaseTokenResponse = {
  firebaseCustomToken: string;
  userId: string;
};

export function useClerkFirebaseAuth() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => setFirebaseUser(next));
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const syncFirebase = async () => {
      if (!isSignedIn) {
        setError(null);
        setIsLoading(false);
        try {
          if (auth.currentUser) {
            await signOut(auth);
          }
        } catch {
          // ignore sign-out errors
        }
        setFirebaseUser(null);
        return;
      }

      if (auth.currentUser && user?.id && auth.currentUser.uid === user.id) {
        setFirebaseUser(auth.currentUser);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const clerkToken = await getToken();
        const response = await fetchWithAuth('/auth/firebase-token', clerkToken, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          const message = response.status === 401 ? 'Invalid session. Please sign in again.' : 'Could not fetch Firebase token.';
          throw new Error(message);
        }

        const data = (await response.json()) as FirebaseTokenResponse;
        await signInWithCustomToken(auth, data.firebaseCustomToken);
      } catch (err: any) {
        if (cancelled) return;
        const message =
          err instanceof FirebaseError
            ? err.message
            : err?.message || 'Could not sync authentication.';
        setError(message);
        try {
          await signOut(auth);
        } catch {
          // ignore sign-out errors
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void syncFirebase();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, user?.id]);

  return useMemo(
    () => ({
      isLoading,
      clerkUser: user,
      firebaseUser,
      error,
    }),
    [isLoading, user, firebaseUser, error]
  );
}

export default useClerkFirebaseAuth;
