/**
 * Seed list of known disposable / throwaway email domains.
 *
 * These are used to seed the `DisposableDomain` table and act as an in-memory
 * fallback if the database is empty or unreachable. Extend the list at runtime
 * by inserting rows into the `DisposableDomain` table.
 */
export const DISPOSABLE_DOMAINS: string[] = [
  'mailinator.com',
  'yopmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'trashmail.com',
  'throwaway.email',
  'dispostable.com',
  'fakeinbox.com',
  'sharklasers.com',
  'getnada.com',
  'maildrop.cc',
  'mintemail.com',
  'temp-mail.org',
];
