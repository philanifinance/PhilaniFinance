export function validateSaId(id: string): { valid: boolean; message: string } {
  if (!/^\d{13}$/.test(id)) {
    return { valid: false, message: 'ID number must be exactly 13 digits.' };
  }

  // Extract date of birth
  const year = parseInt(id.substring(0, 2), 10);
  const month = parseInt(id.substring(2, 4), 10);
  const day = parseInt(id.substring(4, 6), 10);

  if (month < 1 || month > 12) {
    return { valid: false, message: 'ID number contains an invalid month.' };
  }
  if (day < 1 || day > 31) {
    return { valid: false, message: 'ID number contains an invalid day.' };
  }

  // Citizenship digit: 0 = SA citizen, 1 = permanent resident
  const citizenship = parseInt(id[10], 10);
  if (citizenship !== 0 && citizenship !== 1) {
    return { valid: false, message: 'ID number has an invalid citizenship digit.' };
  }

  // Luhn algorithm check digit
  const digits = id.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    if (i % 2 === 0) {
      sum += digits[i];
    } else {
      const doubled = digits[i] * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  if (checkDigit !== digits[12]) {
    return { valid: false, message: 'ID number failed the Luhn checksum. Please check your ID number.' };
  }

  // Estimate century for display
  const currentYear = new Date().getFullYear() % 100;
  const fullYear = year <= currentYear ? 2000 + year : 1900 + year;

  return { valid: true, message: `Valid SA ID. Date of birth: ${day}/${month}/${fullYear}` };
}
