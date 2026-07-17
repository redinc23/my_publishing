/**
 * Maps raw Supabase registration error messages to user-friendly copy.
 * Kept out of the 'use server' action module because Next.js requires all
 * exports from server-action files to be async server actions.
 */
export function toFriendlyRegisterError(message: string) {
  if (message.includes('User already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  if (message.includes('Password')) {
    return 'Password does not meet requirements. Please choose a stronger password.';
  }

  if (/email.*(invalid|validate)|invalid.*email/i.test(message)) {
    return 'Please use a valid email address that can receive email.';
  }

  if (
    /email rate limit exceeded|over_email_send_rate_limit|email.*quota|quota.*email|email.*temporarily unavailable|smtp|error sending/i.test(
      message
    )
  ) {
    return 'Verification email delivery is temporarily unavailable because the email provider is throttling messages. Please try again later.';
  }

  if (/too many requests|rate limit|security purposes/i.test(message)) {
    return 'Too many registration attempts. Please wait a minute and try again.';
  }

  return message;
}
