# Notification email

My Card → Profile includes a private notification email preference. A verified email linked to the authenticated Privy account takes priority (email login first, Google email as a fallback). For accounts without a verified Privy email, users can save or remove a manual address. The setting is stored independently of the creator card and is never included in public profile projections, card design, or local card drafts.

Privy addresses are read from the server-fetched user object after token verification and linked-wallet ownership verification. Browser-supplied email/source fields cannot set the Privy address. Verified Privy login synchronizes the address to the current wallet. If Privy email is later unlinked, the next Privy sign-in clears the synced address and restores any saved manual preference.

`GET /api/notification-email` reads only the signed-session wallet. `PUT` validates the address, request origin, body size, and expected wallet. Database row locks ensure a manual save cannot override a concurrently synced Privy email. Database tables and functions are accessible only to the server service role.

If the initial settings read fails, the email setup field remains available. Users can enter and save an address, with the server enforcing Privy email priority before accepting it. Retrying the read preserves an edited address; a verified Privy address takes priority when loading succeeds. The UI reports a saved address only after a successful server response.

Apply `supabase/migrations/020_notification_email.sql` before deploying the updated account and Privy sign-in routes. Saving a destination does not send email: email delivery and verification of manually entered addresses are not configured by this change. No emails or messages are sent during validation.
