const KEY = 'vynx:google-sign-in:v1';
const MAX_AGE = 10 * 60_000;

// This records navigation intent only; the server still verifies the session.
export function googleSignInPending() {
  try {
    const started = Number(sessionStorage.getItem(KEY));
    const age = Date.now() - started;
    return started > 0 && age >= 0 && age < MAX_AGE;
  } catch { return false; }
}

export function beginGoogleSignIn() {
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch {}
}

export function clearGoogleSignIn() {
  try { sessionStorage.removeItem(KEY); } catch {}
}
