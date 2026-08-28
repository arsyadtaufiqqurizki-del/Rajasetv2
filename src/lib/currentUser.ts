type DisplayNameUser = {
  user_metadata?: { full_name?: string | null } | null;
  email?: string | null;
} | null | undefined;

/** Full name from user metadata, else the email's local part, else a fallback. Single source of truth so attribution matches everywhere it's shown (report history rows and exported PDFs). */
export function resolveUserDisplayName(user: DisplayNameUser): string {
  return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown User';
}
