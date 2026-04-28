import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export interface ProfileData {
  firstName: string;
  lastName: string;
  idNumber: string;
  mobileNumber: string;
  email: string;
  employerName: string;
  monthlyIncome: string;
  payDate: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
}

const emptyProfile: ProfileData = {
  firstName: '', lastName: '', idNumber: '', mobileNumber: '', email: '',
  employerName: '', monthlyIncome: '', payDate: '',
  bankName: '', accountNumber: '', accountType: '',
};

interface ProfileContextType {
  profile: ProfileData;
  profileLoaded: boolean;
  refreshProfile: () => Promise<void>;
  saveProfile: (data: ProfileData) => void;
  updateProfile: (data: ProfileData) => Promise<{ error: string | null }>;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: emptyProfile,
  profileLoaded: false,
  refreshProfile: async () => {},
  saveProfile: () => {},
  updateProfile: async () => ({ error: null }),
});

export function useProfile() {
  return useContext(ProfileContext);
}

interface Props {
  user: User | null;
  children: ReactNode;
}

function rowToProfile(row: Record<string, unknown>, fallbackEmail: string): ProfileData {
  return {
    firstName: (row.first_name as string) || '',
    lastName: (row.last_name as string) || '',
    idNumber: (row.id_number as string) || '',
    mobileNumber: (row.mobile_number as string) || '',
    email: (row.email as string) || fallbackEmail,
    employerName: (row.employer_name as string) || '',
    monthlyIncome: row.monthly_income ? String(row.monthly_income) : '',
    payDate: (row.pay_date as string) || '',
    bankName: (row.bank_name as string) || '',
    accountNumber: (row.account_number as string) || '',
    accountType: (row.account_type as string) || '',
  };
}

function hasProfileData(p: ProfileData): boolean {
  return !!(p.firstName || p.lastName || p.idNumber);
}

export function ProfileProvider({ user, children }: Props) {
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(emptyProfile);
      setProfileLoaded(false);
      return;
    }

    const fallbackEmail = user.email || '';

    // 1. Try profiles table first (source of truth for editable data)
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('first_name, last_name, id_number, mobile_number, email, employer_name, monthly_income, pay_date, bank_name, account_number, account_type')
      .eq('id', user.id)
      .single();

    if (profileRow) {
      const p = rowToProfile(profileRow, fallbackEmail);
      if (hasProfileData(p)) {
        setProfile(p);
        setProfileLoaded(true);
        return;
      }
    }

    // 2. Fallback: most recent loan application
    const { data: appRow } = await supabase
      .from('loan_applications')
      .select('first_name, last_name, id_number, mobile_number, email, employer_name, monthly_income, pay_date, bank_name, account_number, account_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (appRow) {
      const p = rowToProfile(appRow, fallbackEmail);
      setProfile(p);
      // Also seed the profiles table so future loads are faster
      await supabase.from('profiles').update({
        first_name: p.firstName,
        last_name: p.lastName,
        id_number: p.idNumber,
        mobile_number: p.mobileNumber,
        email: p.email,
        employer_name: p.employerName,
        monthly_income: parseInt(p.monthlyIncome, 10) || 0,
        pay_date: p.payDate,
        bank_name: p.bankName,
        account_number: p.accountNumber,
        account_type: p.accountType,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    } else {
      setProfile({ ...emptyProfile, email: fallbackEmail });
    }
    setProfileLoaded(true);
  }, [user]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // In-memory only (used when submitting an application)
  const saveProfile = useCallback((data: ProfileData) => {
    setProfile(data);
  }, []);

  // Persist to profiles table
  const updateProfile = useCallback(async (data: ProfileData): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };

    const { error: dbErr } = await supabase.from('profiles').update({
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      id_number: data.idNumber.trim(),
      mobile_number: data.mobileNumber.trim(),
      email: data.email.trim(),
      employer_name: data.employerName.trim(),
      monthly_income: parseInt(data.monthlyIncome, 10) || 0,
      pay_date: data.payDate,
      bank_name: data.bankName,
      account_number: data.accountNumber.trim(),
      account_type: data.accountType,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    if (dbErr) return { error: dbErr.message };

    setProfile(data);
    return { error: null };
  }, [user]);

  return (
    <ProfileContext.Provider value={{ profile, profileLoaded, refreshProfile, saveProfile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
