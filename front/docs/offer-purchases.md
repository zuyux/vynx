# Offer details and Vynx payments

Offer URLs are optional HTTPS pages for additional information. Every public offer row opens a Vynx dialog; the separate **More details** link never serves as a checkout button. Monthly offers retain their existing Vynx invoices and renewal tracking.

Apply `supabase/migrations/021_offer_purchases.sql` before using one-time checkout. One-time purchases snapshot the published offer and price, pay the verified creator wallet directly in devnet USDC, and save a private receipt. The paying wallet must approve each transfer. The wallet covers network fees and token-account creation; this checkout does not use the sponsored tip endpoint.

The server reads the published offer and rejects stale prices, self-purchases, unauthorized receipts, and mismatched payment signatures. It verifies the finalized transaction's exact prepared message, payer, recipient, mint, amount, and purchase memo. Local storage preserves the purchase reference before submission and blocks another transfer after an uncertain wallet result. Expired quote recovery checks complete finalized payer history before allowing a replacement.

One-time session checkout records payment only; it does not create or reserve a private call. Customers arrange that session with the creator. Digital delivery and refunds are also arranged with the creator. Monthly bookings continue to reserve their weekly sessions automatically.
