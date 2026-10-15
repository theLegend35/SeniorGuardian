const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resetEmailIssue(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!EMAIL.test(email)) return "Enter the email on your account.";
  return null;
}

export function resetPasswordIssue(password: string, confirm: string): string | null {
  if (password.length < 8) return "Use a password with at least 8 characters.";
  if (password !== confirm) return "Those passwords do not match.";
  return null;
}
