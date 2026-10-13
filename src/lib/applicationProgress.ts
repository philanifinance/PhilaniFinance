// The client-facing application state machine: given an application's
// decision status plus the state of its downstream contract/DebiCheck
// mandate/disbursement, which step of the 6-step tracker is "current".
//
// Extracted out of ClientDashboard.tsx (a pure function with no UI
// dependencies) so it can be unit tested without dragging in the whole
// component tree (React, Supabase client init, etc).

export type ApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export function getProgressStep(
  status: ApplicationStatus,
  lifecycle?: string | null,
  contractStatus?: string,
  mandateStatus?: string,
): number {
  if (status === 'pending') return 1;
  if (status === 'under_review') return 2;
  if (status === 'rejected') return 3;  // decision step, red
  if (status === 'approved') {
    if (!contractStatus || contractStatus === 'pending_signature') return 4;
    if (contractStatus === 'signed') {
      if (mandateStatus && ['mandate_submitted', 'pending_bank'].includes(mandateStatus)) return 5;
      if (lifecycle === 'disbursed' || lifecycle === 'repaid') return 6;
      return 5;
    }
    return 4;
  }
  return 3;
}
