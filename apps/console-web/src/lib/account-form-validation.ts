export type AccountField = "name" | "email" | "password";
export type AccountFieldErrors = Partial<Record<AccountField, "name_invalid" | "password_policy" | "email_invalid">>;

/** Match AccountAuthService.displayName: UTF-16 length, Java whitespace and ISO controls. */
export function validDisplayName(value: string): boolean {
  return value.length > 0 && value.length <= 100
    && !/^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]*$/.test(value)
    && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}

/** Java counts Unicode code points, not UTF-16 units. Never trim a password. */
export function validNewPassword(value: string): boolean {
  const length = Array.from(value).length;
  return length >= 15 && length <= 128;
}

export function accountFormErrors(mode: string, name: string, password: string): AccountFieldErrors {
  const errors: AccountFieldErrors = {};
  if (mode === "register" && !validDisplayName(name)) errors.name = "name_invalid";
  if ((mode === "register" || mode === "reset") && !validNewPassword(password)) errors.password = "password_policy";
  return errors;
}
