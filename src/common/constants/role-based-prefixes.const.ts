/**
 * Seed list of role-based local-part prefixes.
 *
 * A "role-based" address (e.g. admin@, info@, support@) belongs to a function
 * rather than an individual person. Used to seed the `RoleBasedPrefix` table
 * and as an in-memory fallback.
 */
export const ROLE_BASED_PREFIXES: string[] = [
  'admin',
  'info',
  'support',
  'sales',
  'billing',
  'hr',
  'abuse',
  'postmaster',
  'webmaster',
  'contact',
  'office',
  'help',
  'hello',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'marketing',
  'press',
  'security',
  'privacy',
  'legal',
  'finance',
  'accounting',
  'jobs',
  'career',
  'careers',
];
