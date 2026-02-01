import { useEffect, useState, useCallback } from 'react';
import { auth, provider } from '../firebase/firebase';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    }, (err) => {
      setError(err as Error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signInWithPopup(auth, provider);
      setUser(res.user);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fbSignOut(auth);
      setUser(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { user, loading, error, signInWithGoogle, signOut };
}
