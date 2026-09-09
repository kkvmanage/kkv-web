export type IDProofCategory =
  | 'Aadhaar'
  | 'PAN'
  | 'Aadhaar + PAN'
  | 'Voter ID'
  | 'Driving Licence'
  | 'Passport'
  | 'Other';

export interface StructuredIDProof {
  type: 'AADHAAR' | 'PAN' | 'AADHAAR_PAN' | 'VOTER_ID' | 'DRIVING_LICENCE' | 'PASSPORT' | 'OTHER' | string;
  documentName?: string | null;
  documentNumber?: string | null;
  aadhaarNumber?: string | null;
  panNumber?: string | null;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  formattedValue?: string;
  normalizedValue?: string;
  structured?: StructuredIDProof;
}

/**
 * Validates 10-digit Indian Mobile Numbers.
 * - Must contain exactly 10 digits
 * - Numeric only
 * - Must start with 6, 7, 8, or 9
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  const cleanPhone = phone.replace(/\D/g, '');

  if (cleanPhone.length === 0) {
    return { isValid: false, error: 'Phone number is required.' };
  }

  if (cleanPhone.length !== 10) {
    return { isValid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    return { isValid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  return {
    isValid: true,
    normalizedValue: cleanPhone
  };
}

/**
 * Formats Phone Input as user types (accepts digits only, max 10 digits).
 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.slice(0, 10);
}

/**
 * Formats Aadhaar number input into "XXXX XXXX XXXX" (groups of 4 digits, max 12 digits).
 */
export function formatAadhaarInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  const parts = digits.match(/.{1,4}/g);
  return parts ? parts.join(' ') : digits;
}

/**
 * Masks sensitive Aadhaar number for public UI views.
 * Example: "1234 5678 9012" or "123456789012" -> "XXXX XXXX 9012"
 */
export function maskAadhaarNumber(idNumber: string): string {
  if (!idNumber) return '';
  const digits = idNumber.replace(/\D/g, '');
  if (digits.length >= 4) {
    const last4 = digits.slice(-4);
    return `XXXX XXXX ${last4}`;
  }
  if (idNumber.startsWith('XXXX')) {
    return idNumber;
  }
  return 'XXXX XXXX ****';
}

export function maskPANNumber(pan: string): string {
  if (!pan) return '';
  const clean = pan.trim().toUpperCase();
  if (clean.length === 10) {
    return `${clean.slice(0, 5)}****${clean.slice(9)}`;
  }
  return clean;
}

/**
 * Individual ID Validators according to exact rules
 */
export function validateAadhaarNumber(value: string): ValidationResult {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length !== 12) {
    return { isValid: false, error: 'Aadhaar number must contain exactly 12 digits.' };
  }
  const formatted = formatAadhaarInput(digits);
  return {
    isValid: true,
    formattedValue: formatted,
    normalizedValue: digits,
    structured: {
      type: 'AADHAAR',
      aadhaarNumber: digits,
      documentNumber: digits
    }
  };
}

export function validatePANNumber(value: string): ValidationResult {
  const cleanPan = (value || '').toUpperCase().replace(/\s/g, '');
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(cleanPan)) {
    return { isValid: false, error: 'Enter a valid PAN number.' };
  }
  return {
    isValid: true,
    formattedValue: cleanPan,
    normalizedValue: cleanPan,
    structured: {
      type: 'PAN',
      panNumber: cleanPan,
      documentNumber: cleanPan
    }
  };
}

export function validateVoterId(value: string): ValidationResult {
  const cleanVoter = (value || '').toUpperCase().trim();
  if (cleanVoter.length < 5 || !/^[A-Z0-9\-\s]+$/.test(cleanVoter)) {
    return { isValid: false, error: 'Enter a valid Voter ID.' };
  }
  return {
    isValid: true,
    formattedValue: cleanVoter,
    normalizedValue: cleanVoter,
    structured: {
      type: 'VOTER_ID',
      documentNumber: cleanVoter
    }
  };
}

export function validateDrivingLicence(value: string): ValidationResult {
  const cleanDl = (value || '').toUpperCase().trim();
  if (cleanDl.length < 8 || !/^[A-Z0-9\-\s]+$/.test(cleanDl)) {
    return { isValid: false, error: 'Enter a valid Driving Licence Number.' };
  }
  return {
    isValid: true,
    formattedValue: cleanDl,
    normalizedValue: cleanDl,
    structured: {
      type: 'DRIVING_LICENCE',
      documentNumber: cleanDl
    }
  };
}

export function validatePassport(value: string): ValidationResult {
  const cleanPass = (value || '').toUpperCase().trim();
  const passRegex = /^[A-Z]{1}[0-9]{7,8}$/;
  if (!passRegex.test(cleanPass)) {
    return { isValid: false, error: 'Enter a valid Passport Number.' };
  }
  return {
    isValid: true,
    formattedValue: cleanPass,
    normalizedValue: cleanPass,
    structured: {
      type: 'PASSPORT',
      documentNumber: cleanPass
    }
  };
}

export function validateOtherDocument(name: string, num: string): {
  isValid: boolean;
  nameError?: string;
  numError?: string;
  structured?: StructuredIDProof;
} {
  const cleanName = (name || '').trim();
  const cleanNum = (num || '').toUpperCase().trim();

  let isValid = true;
  let nameError: string | undefined = undefined;
  let numError: string | undefined = undefined;

  if (!cleanName) {
    isValid = false;
    nameError = 'Document Name is required.';
  }

  if (!cleanNum) {
    isValid = false;
    numError = 'Document Number / ID is required.';
  }

  return {
    isValid,
    nameError,
    numError,
    structured: isValid ? {
      type: 'OTHER',
      documentName: cleanName,
      documentNumber: cleanNum
    } : undefined
  };
}

/**
 * Dynamic ID Proof Number Validation based on ID Proof Type.
 */
export function validateIDProof(idProofType: string, idNumber: string, extraPan?: string, docName?: string): ValidationResult {
  const type = (idProofType || '').trim().toLowerCase();

  if (type.includes('aadhaar + pan') || (type.includes('aadhaar') && type.includes('pan'))) {
    const aRes = validateAadhaarNumber(idNumber);
    const pRes = validatePANNumber(extraPan || '');
    if (!aRes.isValid) return aRes;
    if (!pRes.isValid) return pRes;
    return {
      isValid: true,
      formattedValue: `${aRes.formattedValue} / ${pRes.formattedValue}`,
      normalizedValue: `${aRes.normalizedValue}_${pRes.normalizedValue}`,
      structured: {
        type: 'AADHAAR_PAN',
        aadhaarNumber: aRes.normalizedValue,
        panNumber: pRes.normalizedValue
      }
    };
  }

  if (type.includes('aadhaar')) {
    return validateAadhaarNumber(idNumber);
  }

  if (type.includes('pan')) {
    return validatePANNumber(idNumber);
  }

  if (type.includes('voter')) {
    return validateVoterId(idNumber);
  }

  if (type.includes('driving') || type.includes('licence') || type.includes('license')) {
    return validateDrivingLicence(idNumber);
  }

  if (type.includes('passport')) {
    return validatePassport(idNumber);
  }

  if (type.includes('other')) {
    const oRes = validateOtherDocument(docName || '', idNumber);
    if (!oRes.isValid) {
      return { isValid: false, error: oRes.nameError || oRes.numError || 'Document details required.' };
    }
    return {
      isValid: true,
      formattedValue: `${docName}: ${idNumber}`,
      normalizedValue: idNumber,
      structured: oRes.structured
    };
  }

  // Fallback
  if (!idNumber || idNumber.trim().length < 3) {
    return { isValid: false, error: 'Enter a valid ID Proof Number.' };
  }

  return {
    isValid: true,
    formattedValue: idNumber.trim(),
    normalizedValue: idNumber.trim(),
    structured: {
      type: idProofType.toUpperCase().replace(/\s+/g, '_'),
      documentNumber: idNumber.trim()
    }
  };
}

/**
 * Format ID Proof display string for tables/lists.
 */
export function formatIdProofDisplay(idProof: string, idNumber: string): string {
  if (!idNumber) return '';
  const proofType = (idProof || '').trim().toLowerCase();
  if (proofType.includes('aadhaar')) {
    return maskAadhaarNumber(idNumber);
  }
  return idNumber;
}

/**
 * Safe logging helper that masks sensitive Aadhaar data before printing to console/logs.
 */
export function maskSensitiveObject<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  const copy: Record<string, any> = { ...data };
  if (copy['idProof'] && String(copy['idProof']).toLowerCase().includes('aadhaar') && copy['idNumber']) {
    copy['idNumber'] = maskAadhaarNumber(String(copy['idNumber']));
  }
  return copy as T;
}

/**
 * Parses existing customer record into clean ID proof state variables:
 * - idProof
 * - idNumber (Aadhaar number or single document number)
 * - extraPan (PAN number for Aadhaar + PAN)
 * - docName (Document name for Other)
 */
export function parseCustomerKYC(customer: any): {
  idProof: string;
  idNumber: string;
  extraPan: string;
  docName: string;
} {
  if (!customer) {
    return { idProof: 'Aadhaar', idNumber: '', extraPan: '', docName: '' };
  }

  const rawProof = customer.idProof || customer.idProofType || 'Aadhaar';
  const typeLower = rawProof.trim().toLowerCase();

  let idNumber = customer.idNumber || customer.idProofNumber || '';
  let extraPan = customer.panNumber || customer.extraPan || '';
  let docName = customer.otherIdName || customer.docName || '';

  // Case 1: Aadhaar + PAN
  if (typeLower.includes('aadhaar + pan') || (typeLower.includes('aadhaar') && typeLower.includes('pan'))) {
    let aadhaar = customer.aadhaarNumber || '';
    let pan = customer.panNumber || customer.extraPan || '';

    if (!aadhaar || !pan) {
      if (idNumber.includes('/')) {
        const parts = idNumber.split('/').map((p: string) => p.trim());
        if (!aadhaar && parts[0]) aadhaar = parts[0];
        if (!pan && parts[1]) pan = parts[1];
      } else {
        const aMatch = idNumber.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
        if (aMatch && !aadhaar) aadhaar = aMatch[0];

        const pMatch = idNumber.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/i);
        if (pMatch && !pan) pan = pMatch[0];
      }
    }

    // Fallback if idNumber holds single number
    if (!aadhaar && idNumber.replace(/\D/g, '').length === 12) {
      aadhaar = idNumber;
    }
    if (!pan && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(idNumber.trim())) {
      pan = idNumber;
    }

    return {
      idProof: 'Aadhaar + PAN',
      idNumber: formatAadhaarInput(aadhaar),
      extraPan: (pan || '').toUpperCase().trim(),
      docName: ''
    };
  }

  // Case 2: Aadhaar single
  if (typeLower === 'aadhaar') {
    const aadhaar = customer.aadhaarNumber || idNumber;
    return {
      idProof: 'Aadhaar',
      idNumber: formatAadhaarInput(aadhaar),
      extraPan: (customer.panNumber || '').toUpperCase().trim(),
      docName: ''
    };
  }

  // Case 3: PAN single
  if (typeLower === 'pan') {
    const pan = customer.panNumber || idNumber;
    return {
      idProof: 'PAN',
      idNumber: (pan || '').toUpperCase().trim(),
      extraPan: (pan || '').toUpperCase().trim(),
      docName: ''
    };
  }

  // Case 4: Other
  if (typeLower.includes('other')) {
    if (!docName && idNumber.includes(':')) {
      const parts = idNumber.split(':').map((p: string) => p.trim());
      docName = parts[0] || '';
      idNumber = parts[1] || idNumber;
    }
    return {
      idProof: 'Other',
      idNumber: idNumber.trim(),
      extraPan: '',
      docName: docName.trim()
    };
  }

  return {
    idProof: rawProof,
    idNumber: idNumber.trim(),
    extraPan: extraPan.trim(),
    docName: docName.trim()
  };
}
