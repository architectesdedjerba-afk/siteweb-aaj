/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isRepresentative: boolean;
  isActive: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  isRepresentative: false,
  isActive: false,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Profile subscription error:', err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  const isSuperAdmin = profile?.role === 'super-admin';
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;
  const isRepresentative = profile?.role === 'representative' || isAdmin;
  const isActive = profile?.status === 'active';

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, isAdmin, isSuperAdmin, isRepresentative, isActive }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
