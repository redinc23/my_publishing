import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Choose New Password',
  description: 'Create a new password from your secure MANGU Publishers reset link.',
};

export default function ResetPasswordConfirmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
