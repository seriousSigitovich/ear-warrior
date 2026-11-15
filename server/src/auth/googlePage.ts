// Spec 022 R4. The page the browser shows after Google. Chrome may refuse a custom-scheme redirect that is not
// a user gesture, so there is always a visible button; the script is only the seamless path.
export type ReturnError = 'cancelled' | 'unverified_email' | 'expired' | 'google_failed' | 'google_disabled';
export type ReturnOutcome = { ticket: string } | { error: ReturnError };

const COPY: Record<ReturnError, { title: string; hint: string }> = {
  cancelled: { title: 'Sign-in cancelled', hint: 'Nothing changed. You can try again from the app, or use an email code.' },
  unverified_email: {
    title: "Google hasn't verified that email",
    hint: 'Verify it in your Google account, or sign in with an email code instead.',
  },
  expired: { title: 'That sign-in took too long', hint: 'Go back to the app and tap "Continue with Google" to try again.' },
  google_failed: { title: "Google sign-in didn't work", hint: 'Go back and try again, or sign in with an email code.' },
  google_disabled: { title: "Google sign-in isn't available right now", hint: 'Use the email code instead — you can keep practising either way.' },
};

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function returnPage(outcome: ReturnOutcome): string {
  const ok = 'ticket' in outcome;
  const link = ok
    ? `earwarrior://sign-in?ticket=${encodeURIComponent(outcome.ticket)}`
    : `earwarrior://sign-in?error=${encodeURIComponent(outcome.error)}`;
  const title = ok ? 'Signed in with Google' : COPY[outcome.error].title;
  const hint = ok ? 'Return to Ear Warrior to finish.' : COPY[outcome.error].hint;
  const label = ok ? 'Return to Ear Warrior' : 'Back to Ear Warrior';
  const attr = escapeHtml(link);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Ear Warrior</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#161826;color:#f1ead8;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}
h1{font-size:22px;margin:0 0 8px}p{margin:0 0 24px;opacity:.8}a{display:inline-block;background:#f1ead8;color:#161826;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none}</style>
</head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(hint)}</p>
<a href="${attr}">${label}</a></main>
<script>setTimeout(function(){location.href=${JSON.stringify(link).replace(/</g, '\\u003c')};},50);</script></body></html>`;
}
