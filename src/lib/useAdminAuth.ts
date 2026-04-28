import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from './supabase';

export type UserRole = 'user' | 'admin' | 'owner' | null;

export function useAdminAuth() {
  const auth = useAuth();
  const { user } = auth;
  const [role, setRole] = useState<UserRole>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkRole() {
      if (!user) {
        if (!cancelled) {
          setRole(null);
          setRoleLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!cancelled) {
        if (!error && data?.role) {
          setRole(data.role as UserRole);
        } else {
          setRole('user');
        }
        setRoleLoading(false);
      }
    }

    checkRole();
    return () => { cancelled = true; };
  }, [user]);

  const isAdmin = role === 'admin' || role === 'owner';
  const isOwner = role === 'owner';

  return {
    ...auth,
    role,
    isAdmin,
    isOwner,
    roleLoading,
    loading: auth.loading || roleLoading,
  };
}
