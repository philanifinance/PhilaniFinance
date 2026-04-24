import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from './supabase';

export function useAdminAuth() {
  const { user, isAuthenticated } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkRole() {
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!cancelled) {
        setIsAdmin(
          !error && (data?.role === 'admin' || data?.role === 'owner')
        );
        setLoading(false);
      }
    }

    checkRole();
    return () => { cancelled = true; };
  }, [user]);

  return { isAdmin, isAuthenticated, user, loading };
}
