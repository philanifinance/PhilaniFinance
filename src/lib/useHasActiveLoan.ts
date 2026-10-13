import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Whether this client has any disbursed-but-not-yet-repaid loan, across
// ALL of their applications — not just whichever one happens to be most
// recent. Used to gate every entry point into the application flow
// (navbar, hero CTA, dashboard button), not just the dashboard's own
// "New Application" button, which previously was the only thing checking
// this and could be bypassed via the navbar.
export function useHasActiveLoan(user: User | null) {
  const [hasActiveLoan, setHasActiveLoan] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setHasActiveLoan(false);
      return;
    }
    const { data } = await supabase
      .from('loan_applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('loan_lifecycle', 'disbursed')
      .limit(1);
    setHasActiveLoan(!!data && data.length > 0);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { hasActiveLoan, refreshHasActiveLoan: refresh };
}
