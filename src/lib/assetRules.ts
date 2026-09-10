/**
 * Cross-field business rules for the Asset form, lifted out of AddAssetModal and
 * EditAssetModal (two identical copies) in Step 2 of "refactoring v2.md".
 *
 * The rule pair is: Listed=Audited implies Verification=Yes, and turning Verification
 * on stamps today's date unless the user already picked one. Both helpers take the
 * whole form state and return a new one so the call sites stay `setFormData(prev => ...)`.
 */

/** Verification is held as the string 'Yes'/'No' while in the form; it only becomes a boolean on save. */
export type VerificationFields = {
  verification: string;
  verificationDate: string;
};

export type ListedFields = VerificationFields & {
  listed: string;
};

/** Today as YYYY-MM-DD, matching the value an `<input type="date">` carries. */
export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Verification -> Yes stamps today (unless a date is already set); -> No clears the date.
 * Note it clears on *any* non-'Yes' value, which is what the modals did.
 */
export function applyVerificationChange<T extends VerificationFields>(prev: T, value: string): T {
  return {
    ...prev,
    verification: value,
    verificationDate: value === 'Yes' ? (prev.verificationDate || todayIso()) : '',
  };
}

/**
 * Listed -> Audited forces Verification=Yes and stamps today (unless already set).
 * Any other value leaves verification and its date exactly as they were — Non-Listed
 * does not undo a verification the user made deliberately.
 */
export function applyListedChange<T extends ListedFields>(prev: T, value: string): T {
  return {
    ...prev,
    listed: value,
    verification: value === 'Audited' ? 'Yes' : prev.verification,
    verificationDate: value === 'Audited' ? (prev.verificationDate || todayIso()) : prev.verificationDate,
  };
}
