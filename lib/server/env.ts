import 'server-only';

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See README → Environment variables.`);
  return value;
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL', process.env.DATABASE_URL || process.env.POSTGRES_URL);
  },
  /** Secret mixed into every PIN hash, so a leaked database alone can't be brute-forced. */
  get pinPepper() {
    const v = required('PIN_PEPPER', process.env.PIN_PEPPER);
    if (v.length < 32) throw new Error('PIN_PEPPER must be at least 32 characters.');
    return v;
  },
  /** Signups are closed unless an invite code is configured. */
  get signupCode() {
    return process.env.SIGNUP_CODE?.trim() || null;
  },
  get isProd() {
    return process.env.NODE_ENV === 'production';
  },
};
