import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null,
        session: session ?? null,
        loading: false,
      });
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user ?? null,
        session: session ?? null,
        loading: false,
      });
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error, data };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!state.user,
  };
}
