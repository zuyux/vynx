# Accessibility verification

Run from `front`:

```sh
npx playwright install chromium
npm run test:a11y
```

The check builds the production app, starts a local server with a read-only database fixture, and uses Chromium with axe-core WCAG A/AA rules. It does not submit payments, connect a wallet, or write production data.

Coverage:

- Homepage, published alias card, dashboard, card editor, empty draft preview, sponsorship workspace, products, creator studio, alias claim, and public sponsorship page. Tickets and subscriptions are checked as redirects to products.
- All five editor sections, including labels, button names, radio keyboard selection, and contrast.
- Skip-to-content navigation, visible keyboard focus, checkout focus trapping, Escape dismissal, and focus restoration.
- Public cards and sponsorship forms in light and dark themes; light-theme tipping dialog, labels, Escape dismissal, and focus restoration.
- Mobile homepage at 390 × 844 with reduced motion: stationary hero card and no running browser animations.

Fixes include brighter secondary text, contrast-safe light-theme hints, a global skip link and focus indicator, checkout portal text color, checkout focus restoration, and reduced-motion support for CSS and Framer Motion. The portrait file input is opened through its visible button and excluded from the tab sequence.

Automated checks and browser keyboard tests cover the listed fixtures. They do not certify every user-supplied image, content combination, third-party wallet interface, or screen-reader/browser combination. A dedicated screen-reader review remains separate.

References: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).
