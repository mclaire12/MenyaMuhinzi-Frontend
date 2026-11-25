/** "The verification code is incorrect. 3 attempt(s) remaining." → 3; anything else → null. */
export function attemptsRemaining(message: string): number | null {
  const match = /incorrect\D*(\d+)\s*attempt/i.exec(message);
  return match ? Number(match[1]) : null;
}

/** The email carries a 6-digit numeric code. */
export function isVerificationCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}
