/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, type QueryConstraint, db } from './firebase';

export function useFirestoreCollection<T>(
  path: string,
  constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
): { data: T[]; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, path), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
      },
      (err) => {
        console.error(`Firestore subscription error (${path}):`, err);
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { data, loading, error };
}
