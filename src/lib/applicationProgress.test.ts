import { describe, it, expect } from 'vitest';
import { getProgressStep } from './applicationProgress';

describe('getProgressStep (client application state machine)', () => {
  it('step 1: freshly submitted', () => {
    expect(getProgressStep('pending')).toBe(1);
  });

  it('step 2: under admin review', () => {
    expect(getProgressStep('under_review')).toBe(2);
  });

  it('step 3: rejected — regardless of any downstream state', () => {
    expect(getProgressStep('rejected')).toBe(3);
    expect(getProgressStep('rejected', 'repaid', 'signed', 'accepted')).toBe(3);
  });

  it('step 4: approved, no contract yet', () => {
    expect(getProgressStep('approved')).toBe(4);
  });

  it('step 4: approved, contract generated but not yet signed', () => {
    expect(getProgressStep('approved', null, 'pending_signature')).toBe(4);
  });

  it('step 5: contract signed, mandate still awaiting bank/debtor', () => {
    expect(getProgressStep('approved', null, 'signed', 'mandate_submitted')).toBe(5);
    expect(getProgressStep('approved', null, 'signed', 'pending_bank')).toBe(5);
  });

  it('step 5: contract signed, mandate accepted but not yet disbursed', () => {
    expect(getProgressStep('approved', null, 'signed', 'accepted')).toBe(5);
  });

  it('step 5: contract signed, no mandate initiated at all yet', () => {
    expect(getProgressStep('approved', null, 'signed', undefined)).toBe(5);
  });

  it('step 6: funds disbursed', () => {
    expect(getProgressStep('approved', 'disbursed', 'signed', 'accepted')).toBe(6);
  });

  it('step 6: loan fully repaid', () => {
    expect(getProgressStep('approved', 'repaid', 'signed', 'accepted')).toBe(6);
  });

  it('disbursed/repaid lifecycle only advances to step 6 once the contract is actually signed', () => {
    // Regression guard: a stray "disbursed"/"repaid" lifecycle value on an
    // application whose contract isn't signed yet should not short-circuit
    // the tracker to the final step.
    expect(getProgressStep('approved', 'disbursed', 'pending_signature')).toBe(4);
    expect(getProgressStep('approved', 'disbursed')).toBe(4);
  });
});
