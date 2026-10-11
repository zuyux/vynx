# Browser compatibility checks

Test date: October 10, 2026. Tests use a production Next.js build, isolated Postgres/PostgREST, deterministic Solana RPC and signed fixture wallets. They do not exercise a real Phantom extension, mobile wallet deep links, or live devnet.

## Coverage

The reproducible Playwright matrix uses installed Google Chrome (desktop and Pixel 7 emulation), Playwright Firefox, and Playwright WebKit (desktop and iPhone 13 emulation). Public pages, disclosures, creator cards, sponsorship offers, editor, preview and dashboards are checked for horizontal overflow at 320, 375, 430, 768 and 1280 pixels. The default application suite exercises the legacy devnet alias-claim flow and also checks publication, reload persistence, image upload, USDC tipping, payment recovery, cancellation, signed authentication, privacy, logout and database authorization.

An additional WebDriver BiDi smoke run used installed Firefox 157.0 to check all seven public/disclosure routes, navigation and script errors at the same five widths. The full signed-wallet suite uses Playwright Firefox 155.0.

Playwright reports browser versions in the layout test output. The HTML report and retained failure traces are local artifacts in `front/playwright-report/` and `front/test-results/`.

## Verified results

| Browser project | Version | Result |
| --- | --- | --- |
| Chrome desktop | 155.0.8059.39 | 13 scenarios verified |
| Firefox desktop (Playwright) | 155.0 | 13 scenarios verified |
| WebKit desktop | 26.6 | 13 scenarios verified |
| Chrome, Pixel 7 emulation | 155.0.8059.39 | 13 scenarios verified |
| WebKit, iPhone 13 emulation | 26.6 | 13 scenarios verified |
| Installed Firefox, WebDriver BiDi smoke | 157.0 | Seven routes at five widths; navigation and script checks passed |

All 65 distinct default-matrix scenarios were verified. The full run passed 59; six stale-test/streaming-selector failures were corrected, and the affected ten-scenario flow matrix then passed in all projects. Corrections isolate shared rate limits, follow the current user-facing cancellation/save messages and public image paths, and wait for visible streamed content before measuring it. A further five scenarios passed for sponsored on-chain registration, publication and confirmation recovery, one per browser project. In total, 70 distinct browser scenarios were verified. No application compatibility defect was found in these tested flows.

## Reproduce

```bash
cd front
npx playwright install --with-deps chromium firefox webkit
# Install Google Chrome separately; the matrix uses channel: chrome.
npm run test:browsers
# On-chain sponsored registration/publication across the same matrix:
# Requires chain/target/deploy/vynx_alias.so and chain dependencies.
E2E_CROSS_BROWSER=1 E2E_GREP='browser registers a one-character' npm run test:e2e:registry
# Restore the production build with your own environment after fixture testing.
npm run build
```

Docker is required. Tests run serially and reset the isolated request-limit ledger before each scenario because every scenario shares the same loopback client address. Rate limits remain enforced within a scenario. The reset fixture refuses non-local database URLs.

## Limits and remaining device checks

Playwright WebKit is an engine test, not a test of the installed Safari application. Its patched Firefox also differs from system Firefox. See [Playwright browser support](https://playwright.dev/docs/browsers). Mobile emulation tests responsive layout and browser behavior, not real device performance or wallet-app handoff.

Before marking actual Safari/device coverage complete, run the main flow in current Safari on macOS and an iPhone: connect a real wallet, sign in, claim, edit/publish, view the public page, tip, recover a pending payment and log out. Verify keyboard/input behavior, rotation, virtual-keyboard occlusion, scrolling in the tip dialog, and return navigation from Phantom. Repeat wallet handoff on Android Chrome. No macOS or physical devices were available in this Linux workspace.
