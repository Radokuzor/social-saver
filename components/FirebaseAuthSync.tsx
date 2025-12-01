import { useEffect } from 'react';
import useClerkFirebaseAuth from '../hooks/useClerkFirebaseAuth';

export default function FirebaseAuthSync() {
  const { error } = useClerkFirebaseAuth();

  useEffect(() => {
    if (error) {
      console.warn('[auth-sync] Firebase sync error:', error);
    }
  }, [error]);

  return null;
}
