# Mobile app installation

Vynx is a progressive web app served over HTTPS. Install it through your browser’s menu or address bar. The site does not display an install button or intercept browser installation prompts.

- Android: use Chrome's Install app / Add to Home screen menu.
- iPhone / iPad: open the site in Safari, choose Share → Add to Home Screen, enable Open as Web App if offered, then Add.
- Desktop: Chrome and Edge offer installation through the address bar or menu.

The installed app opens in its own window. Installation does not enable push notifications or change wallet authentication.

## Offline behavior and privacy

The service worker caches an offline screen, bundled immutable Next.js assets, and explicitly listed public app icons. Live HTML, API responses, card data, wallet sessions, payments, booking details, and call tokens are never stored by the service worker. Offline navigation shows a reconnect screen; account actions, payments and calls require a connection. Cache activation deletes older Vynx caches, including the previous broad image cache, while preserving unrelated caches.

The worker registers only in production; development removes only Vynx's worker and caches. `/sw.js` is served without HTTP caching so updates are checked normally. Change the cache version when changing precached assets or the offline screen. Do not add authenticated endpoints or user uploads to the cache allowlist.

## Verification

Run `E2E_TEST_PATTERN=pwa.spec.ts npm run test:e2e` from `front`. These Chromium browser tests check production registration, manifest/icon responses, legacy cache removal, API/page cache exclusion, offline navigation, and reconnection. OS installation requires a physical-device check.

Before a mobile release, install the production HTTPS site on a physical Android device and iPhone, launch from the home screen, check offline recovery, then verify wallet handoff and a private Daily call. Those physical-device checks remain manual.
