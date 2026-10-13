# English and Spanish

The app uses `next-intl` with English at existing URLs and Spanish at `/es` and `/es/...`. `proxy.ts` redirects unprefixed requests according to `VYNX_LOCALE`, then the device's `Accept-Language` preferences. Unsupported languages fall back to English. Explicit Spanish URLs always render Spanish.

The footer's ES / EN buttons save the selection for a year and preserve the current page, query string, and hash. Only an explicit language selection writes this preference; ordinary Spanish requests and Link prefetches cannot overwrite it. `/en/...` canonicalizes to the existing English URL. API endpoints and static assets remain unprefixed.

The proxy rewrites Spanish URLs to existing pages and sets the request locale header. This keeps route files and authentication boundaries shared. Never trust a client-supplied locale or destination header: the proxy overwrites both. `en` and `es` are reserved creator aliases.

## Adding copy

`messages/source.json` maps stable message IDs to English source text. `messages/en.json` and `messages/es.json` contain matching `app` catalogs. Append a new message ID and translations to all three files; don't renumber existing IDs. Keep `{v0}`, `{v1}`, etc. unchanged in both translations. Both locales must have the same keys.

Use `useCopy()` in synchronous React components and `await getCopy()` in async server components. Call `t('English source text')` for product copy and `t('Hello, {v0}.', {v0: name})` for interpolated messages. The adapter preserves whitespace around inline elements and uses next-intl to format interpolation. Known API messages are translated where they are displayed; API error codes and request payloads remain unchanged. Unrecognized text falls back to the original with interpolation preserved.

Use the shared `i18n/link` and `i18n/navigation` wrappers for links and client navigation. `t.href(path)` also builds a localized internal URL. Never translate protocol values, identifiers, wallet addresses, signatures, URLs, time zone names, or creator-authored content. Pass `t.locale` into `Intl` date/number formatters and localized session label helpers. Fumadocs and the calendar receive their own locale configuration.

The global error boundary uses the catalogs directly because the root provider may have failed. The offline HTML variants are cached separately by the service worker. Keep their short strings in sync with the catalogs when changing offline copy.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`
- `E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/i18n.spec.ts` against a running app

The language tests cover device detection, cookie precedence, explicit URLs, deep links, query/hash preservation, API/asset exclusions, interpolation, dates, catalog parity, and switching after Spanish links have been prefetched.
