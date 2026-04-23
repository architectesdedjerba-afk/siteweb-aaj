/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db, doc, onAuthStateChanged, onSnapshot, type User } from './firebase';
import type { UserProfile, Role } from '../types';
import { DEFAULT_ROLES } from './permissions';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isRepresentative: boolean;
  isActive: boolean;
  permissions: Record<string, boolean>;
  can: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  isRepresentative: false,
  isActive: false,
  permissions: {},
  can: () => false,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setRole(null);
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

  useEffect(() => {
    if (!profile?.role) {
      setRole(null);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'roles', profile.role),
      (snap) => {
        if (snap.exists()) {
          setRole({ id: snap.id, ...snap.data() } as Role);
        } else {
          const fallback = DEFAULT_ROLES.find((r) => r.id === profile.role);
          setRole(fallback ? { ...fallback } : null);
        }
      },
      (err) => {
        console.error('Role subscription error:', err);
        const fallback = DEFAULT_ROLES.find((r) => r.id === profile.role);
        setRole(fallback ? { ...fallback } : null);
      }
    );
    return unsubscribe;
  }, [profile?.role]);

  const isSuperAdmin = profile?.role === 'super-admin' || role?.isAllAccess === true;
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;
  const isRepresentative = profile?.role === 'representative' || isAdmin;
  const isActive = profile?.status === 'active';

  const permissions: Record<string, boolean> = role?.permissions || {};
  const can = (key: string): boolean => {
    if (isSuperAdmin) return true;
    return permissions[key] === true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        isAdmin,
        isSuperAdmin,
        isRepresentative,
        isActive,
        permissions,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
