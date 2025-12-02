import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    return cred.user;
  }, []);

  const signOut = useCallback(() => firebaseSignOut(auth), []);

  const getIdToken = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    return token || null;
  }, []);

  return useMemo(
    () => ({
      user,
      uid: user?.uid || null,
      loading,
      signIn,
      signUp,
      signOut,
      getIdToken,
    }),
    [user, loading, signIn, signUp, signOut, getIdToken]
  );
}

export default useFirebaseAuth;
