# Profile Section Issue - Fix Applied

## Problem

After setting an application to "disbursed", users could not see their "My Profile" section in the client dashboard.

## Root Cause

The issue was caused by two problems:

### 1. Missing INSERT RLS Policy
The `profiles` table only had SELECT and UPDATE RLS policies for users, but no INSERT policy. This prevented users from creating their own profile entries.

### 2. ProfileContext Seeding Failure
The `ProfileContext.tsx` was trying to seed profile data from loan applications using `.update()`, but this would fail if:
- The profile row didn't exist
- The profile row was empty
- The user didn't have INSERT permissions

When this failed silently, the profile data remained empty, causing the "My Profile" tab to appear broken or inaccessible.

## Solution Applied

### 1. Database Migration (013_fix_profiles_rls.sql)
Added proper RLS policies to the profiles table:

```sql
-- Add INSERT policy for users to create their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Update the existing UPDATE policy to include WITH CHECK
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### 2. Frontend Fix (ProfileContext.tsx)
Changed the profile seeding logic from `.update()` to `.upsert()`:

```typescript
// Before: Only worked if profile row existed
await supabase.from('profiles').update({...}).eq('id', user.id);

// After: Works whether profile exists or not
const { error: upsertError } = await supabase.from('profiles').upsert({
  id: user.id,
  first_name: p.firstName,
  // ... other fields
});

if (upsertError) {
  console.error('Failed to seed profile from application:', upsertError.message);
}
```

## How to Apply the Fix

### Step 1: Run Database Migration
1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from `supabase/migrations/013_fix_profiles_rls.sql`
3. Verify the policies were created successfully

### Step 2: Rebuild Frontend
```bash
npm run build
npm run deploy
```

## Verification

After applying the fix:

1. **Test Profile Access**
   - Log in as a user
   - Navigate to Client Dashboard
   - Click "My Profile" tab
   - Verify the profile loads correctly

2. **Test Profile Updates**
   - Edit profile information
   - Click "Save Profile"
   - Verify changes persist

3. **Test Profile Seeding**
   - For users with empty profiles, verify they're seeded from loan application data
   - Check console for any error messages

## Testing Scenarios

### Scenario 1: New User with Loan Application
- User signs up and submits loan application
- Profile is automatically seeded from application data
- User can access "My Profile" tab
- Profile displays correct information

### Scenario 2: User with Disbursed Loan
- User's loan is set to "disbursed"
- User can still access "My Profile" tab
- Profile data remains accessible
- User can update profile information

### Scenario 3: User Without Loan Application
- User signs up but hasn't submitted application
- Profile tab shows empty form
- User can manually fill in profile information
- Profile is saved correctly

## Files Modified

1. **Database Migration**
   - `supabase/migrations/013_fix_profiles_rls.sql` (NEW)

2. **Frontend**
   - `src/lib/ProfileContext.tsx` (MODIFIED)

## Additional Notes

- The fix ensures that profile data is always accessible regardless of loan status
- Users can now manage their profile information independently of loan lifecycle
- The upsert approach handles both new and existing profile entries gracefully
- Error logging added to help debug any future profile issues

## Related Files

- `src/components/ClientDashboard.tsx` - Uses ProfileContext
- `src/lib/ProfileContext.tsx` - Profile data management
- `supabase/migrations/001_admin_schema.sql` - Original profiles table
- `supabase/migrations/003_profile_details.sql` - Profile columns

---

**Issue Fixed**: October 12, 2026
**Status**: Ready for Deployment
