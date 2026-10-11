# Small invited-user test

Status: **suspended at the user’s request; not run**. No invitees or deployed test URL have been confirmed, no invitations have been sent, and no participant feedback has been received. Automated browser results are separate evidence, not invited-user feedback.

Use [the session script](session-script.md), [the invitation draft](invitation.md), and [the feedback record](feedback.md). Support: **40230@pm.me**.

## Scope and participants

Run four 20–30 minute sessions: two creators and two supporters, paired so each supporter tips a participating creator. Three participants can cover the same roles if one supporter tests both creator pages. Prefer people who did not build the app; include one person unfamiliar with wallet signing. Include a real iPhone/Safari and an Android/Chrome device when available, alongside desktop Chrome or Firefox. Record the actual device/browser/version, not an intended assignment.

The primary tasks are intentional wallet connection, alias registration, editing/publishing a creator card, visiting that card from another device, sending a test-token tip, confirming creator activity and signing out. Observe cancellation and retry without duplicate payment. Sponsorship is an optional follow-up after the core flow succeeds.

## Prepare the deployed test

1. Set the exact deployed URL and record its deployment/build identifier in the feedback record. Use an invite-only test cohort; do not publish an open recruitment link.
2. Verify that the deployed environment uses Solana devnet, the required database migrations and creator image storage are ready, support/disclosure links work, and error monitoring is enabled. Perform one live devnet owner smoke check of alias registration and a tip. Fixture browser tests do not establish deployed readiness.
3. Have the facilitator and participants prepare separate test wallets with enough devnet SOL for the displayed alias quote and wallet-paid fees, plus devnet USDC for USDC tips. Sponsored USDC tips depend on working Kora configuration. Do not buy tokens or send mainnet funds. If USDC sponsorship is unavailable, record that limitation and test SOL; do not count USDC as passed.
4. Choose unclaimed aliases of at least five characters to avoid unnecessary high test-token prices; use the quote actually displayed. Do not assume a fixed price. Have each creator publish a page before their paired supporter session.
5. Confirm participants are comfortable with anonymous notes and any screenshots they choose to share. Do not record audio/video by default. Keep identities and invitation addresses outside the repository; use P01–P04 in committed notes.

## Facilitate and triage

Give participants tasks from the script without explaining where to click. Ask them to describe what they expect; note when they ask for help. Label a task completed unaided, completed with help, blocked or not attempted. Record the first point of confusion, elapsed time, exact visible error and whether a transfer was already sent.

A **blocking issue** prevents a core task after one reasonable retry, requires intervention to recover an account/payment, or exposes private data or the wrong payment network/recipient. Stop payment testing on wrong-network, wrong-recipient or privacy/security concerns. After a sent payment, retry verification using its existing signature; do not send another transfer to resolve an unclear status.

Enter each distinct issue in the feedback record, deduplicate repeated reports and list all affected participant IDs. Preserve the participant's actual words separately from the facilitator's interpretation. Assign an owner and a concrete retest condition. Reproduce and fix confirmed blockers, then obtain an observed participant retest; an automated check alone does not resolve a usability blocker.

## Completion criteria

The roadmap item remains open until at least three invited people have actually completed observed sessions, their outcomes and feedback are recorded, and every blocking report has a severity, reproduction steps, owner and current status. A blocker may remain open after the study is completed; inviting more people or declaring the release ready requires a separate decision about those blockers. Report the number of participants and core tasks completed unaided, with help and blocked. Distinguish “no blockers reported in completed sessions” from “no sessions run.”
