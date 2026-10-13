import { describe, it, expect } from 'vitest';
import {
  mapNuPayStatusGrouping, isGatewayErrorCode, mapAccountType, mapFrequency,
  deriveCollectionDay, formatDebtorPhone, formatZarAmount, describeResponseCode,
  randsToCents, centsToRands, toCompactDate, mapInstalmentStatus, mapInstalmentReportStatus,
} from './nupay.ts';

describe('mapNuPayStatusGrouping', () => {
  it('maps the documented Pending group to pending_bank', () => {
    for (const s of ['Pending Auth', 'Posted', 'Requested', 'Queued', 'Extracted']) {
      expect(mapNuPayStatusGrouping(s)).toBe('pending_bank');
    }
  });

  it('maps the documented Rejected group to rejected', () => {
    for (const s of ['Expired', 'No Response', 'Not Authorized', 'Rejected', 'Suspended']) {
      expect(mapNuPayStatusGrouping(s)).toBe('rejected');
    }
  });

  it('maps the documented Active group to accepted', () => {
    for (const s of ['Accepted', 'Active', 'Completed']) {
      expect(mapNuPayStatusGrouping(s)).toBe('accepted');
    }
  });

  it('keeps a specifically cancelled mandate distinguishable from a generic rejection', () => {
    expect(mapNuPayStatusGrouping('Cancelled')).toBe('cancelled');
  });

  it('prefers the explicit mandateStatusGrouping field when both are given', () => {
    expect(mapNuPayStatusGrouping('something unrecognised', 'Active')).toBe('accepted');
    expect(mapNuPayStatusGrouping('something unrecognised', 'Pending')).toBe('pending_bank');
  });

  it('is case/whitespace insensitive', () => {
    expect(mapNuPayStatusGrouping('  accepted  ')).toBe('accepted');
    expect(mapNuPayStatusGrouping('REJECTED')).toBe('rejected');
  });

  it('treats a non-empty but undocumented status (e.g. a gateway "Failed") as rejected, never a silent pending', () => {
    // Regression test: this used to default to "pending_bank", which made a
    // request that actually failed show as "At Bank" / awaiting approval.
    expect(mapNuPayStatusGrouping('Failed')).toBe('rejected');
    expect(mapNuPayStatusGrouping('something else entirely')).toBe('rejected');
  });

  it('only defaults to pending_bank when there is truly no information at all', () => {
    expect(mapNuPayStatusGrouping('')).toBe('pending_bank');
  });
});

describe('isGatewayErrorCode', () => {
  it('recognises the 500xxx NuPay/CAPI error code shape', () => {
    expect(isGatewayErrorCode('500002')).toBe(true);
    expect(isGatewayErrorCode('500016')).toBe(true);
    expect(isGatewayErrorCode('500082')).toBe(true);
  });

  it('does not flag the success code', () => {
    expect(isGatewayErrorCode('500000')).toBe(false);
  });

  it('does not flag DebiCheck bank response codes (900xxx/901xxx)', () => {
    expect(isGatewayErrorCode('900000')).toBe(false);
    expect(isGatewayErrorCode('901111')).toBe(false);
  });

  it('handles missing/empty input safely', () => {
    expect(isGatewayErrorCode(undefined)).toBe(false);
    expect(isGatewayErrorCode(null)).toBe(false);
    expect(isGatewayErrorCode('')).toBe(false);
  });
});

describe('mapAccountType', () => {
  it('maps the app\'s account type strings to NuPay\'s numeric codes', () => {
    expect(mapAccountType('cheque')).toBe('01');
    expect(mapAccountType('savings')).toBe('02');
    expect(mapAccountType('transmission')).toBe('03');
  });

  it('is case insensitive and defaults to current/cheque for unknown input', () => {
    expect(mapAccountType('SAVINGS')).toBe('02');
    expect(mapAccountType('unknown')).toBe('01');
  });
});

describe('mapFrequency', () => {
  it('maps weekly and monthly directly', () => {
    expect(mapFrequency('weekly')).toBe('WEEK');
    expect(mapFrequency('monthly')).toBe('MNTH');
  });

  it('models a once-off debit as a single MNTH instalment (NuPay has no ONCE code)', () => {
    expect(mapFrequency('once-off')).toBe('MNTH');
  });
});

describe('deriveCollectionDay', () => {
  it('derives Monday=01..Sunday=07 for weekly frequency', () => {
    // 2026-10-12 is a Monday
    expect(deriveCollectionDay('WEEK', '2026-10-12')).toBe('01');
    // 2026-10-18 is a Sunday
    expect(deriveCollectionDay('WEEK', '2026-10-18')).toBe('07');
  });

  it('derives the day-of-month for monthly frequency', () => {
    expect(deriveCollectionDay('MNTH', '2026-10-15')).toBe('15');
  });

  it('derives 99 ("last day") when the date is the last day of the month', () => {
    expect(deriveCollectionDay('MNTH', '2026-04-30')).toBe('99');
    expect(deriveCollectionDay('MNTH', '2026-02-28')).toBe('99');
  });
});

describe('formatDebtorPhone', () => {
  it('converts a local 0-prefixed SA mobile number to NuPay\'s required +27-dash format', () => {
    expect(formatDebtorPhone('0821234567')).toBe('+27-821234567');
  });

  it('normalises a number already carrying a country code, with or without a leading +', () => {
    expect(formatDebtorPhone('+27821234567')).toBe('+27-821234567');
    expect(formatDebtorPhone('27821234567')).toBe('+27-821234567');
  });

  it('strips spaces, dashes and other punctuation before normalising', () => {
    expect(formatDebtorPhone('082 123 4567')).toBe('+27-821234567');
    expect(formatDebtorPhone('(082) 123-4567')).toBe('+27-821234567');
  });
});

describe('formatZarAmount', () => {
  it('always renders exactly two decimal places', () => {
    expect(formatZarAmount(500)).toBe('500.00');
    expect(formatZarAmount(2675.5)).toBe('2675.50');
  });
});

describe('randsToCents / centsToRands', () => {
  it('converts rands to cents for the Instalment Maintenance webservice', () => {
    expect(randsToCents(500)).toBe(50000);
    expect(randsToCents(1.5)).toBe(150);
  });

  it('converts cents back to whole rands, rounded — the schema\'s amount columns are INTEGER (whole rands only), so cents-level precision from NuPay cannot be stored exactly', () => {
    expect(centsToRands(50000)).toBe(500);
    expect(centsToRands(12345)).toBe(123); // R123.45 rounds down to R123, not stored as a fraction
    expect(centsToRands(12355)).toBe(124); // R123.55 rounds up to R124
  });
});

describe('toCompactDate', () => {
  it('strips dashes for the YYYYMMDD format several NuPay webservices require', () => {
    expect(toCompactDate('2026-10-13')).toBe('20261013');
  });
});

describe('mapInstalmentStatus', () => {
  it('maps the documented single-letter instalment status codes', () => {
    expect(mapInstalmentStatus('X')).toBe('collected');
    expect(mapInstalmentStatus('H')).toBe('failed');
    expect(mapInstalmentStatus('P')).toBe('pending');
    expect(mapInstalmentStatus('I')).toBe('pending');
    expect(mapInstalmentStatus('C')).toBe('cancelled');
  });

  it('is case insensitive and defaults unknown/missing codes to pending rather than throwing', () => {
    expect(mapInstalmentStatus('x')).toBe('collected');
    expect(mapInstalmentStatus(undefined)).toBe('pending');
    expect(mapInstalmentStatus(null)).toBe('pending');
    expect(mapInstalmentStatus('?')).toBe('pending');
  });
});

describe('mapInstalmentReportStatus', () => {
  // The Reporting webservice uses a completely different status vocabulary
  // from the Instalment Maintenance webservice's single-letter codes above
  // — confirmed by a live response returning "Cancelled" with statusCode
  // "500105", which mapInstalmentStatus (the wrong mapper) would have
  // silently defaulted to "pending".
  it('maps the documented human-readable status strings', () => {
    expect(mapInstalmentReportStatus('Successful')).toBe('collected');
    expect(mapInstalmentReportStatus('Failed')).toBe('failed');
    expect(mapInstalmentReportStatus('In Tracking')).toBe('pending');
    expect(mapInstalmentReportStatus('Pending (Future)')).toBe('pending');
  });

  it('maps "Cancelled" and "Disputed", observed live but absent from the documented value list', () => {
    expect(mapInstalmentReportStatus('Cancelled')).toBe('cancelled');
    expect(mapInstalmentReportStatus('Disputed')).toBe('failed');
  });

  it('is case insensitive and defaults unrecognised values to pending', () => {
    expect(mapInstalmentReportStatus('SUCCESSFUL')).toBe('collected');
    expect(mapInstalmentReportStatus('something new')).toBe('pending');
    expect(mapInstalmentReportStatus(undefined)).toBe('pending');
  });
});

describe('describeResponseCode', () => {
  it('resolves known codes to a human description', () => {
    expect(describeResponseCode('500000')).toBe('Success');
    expect(describeResponseCode('NRSP')).toMatch(/respond/i);
  });

  it('returns undefined for unknown/missing codes rather than throwing', () => {
    expect(describeResponseCode('999999999')).toBeUndefined();
    expect(describeResponseCode(undefined)).toBeUndefined();
    expect(describeResponseCode(null)).toBeUndefined();
  });
});
