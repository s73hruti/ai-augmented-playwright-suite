# Architecture

## Layers

```
tests/*.spec.ts               src/utils/money.test.ts
  - imports Page Objects        - imports src/utils/money.ts directly
  - imports formatMoney()         - no browser involved at all
  - drives a real browser
        |
        v
src/pages/*.page.ts (Page Object Model)
  BasePage -> LoginPage, MenuPage, CheckoutPage, ConfirmationPage
        | drives
        v
demo-app/ (static HTML/CSS/JS, self-hosted via
scripts/static-server.ts + Playwright webServer)
```

Two independent test runners, on purpose: Playwright (`tests/`, driving a
real browser against the demo app) and Vitest (`src/**/*.test.ts`,
running pure TypeScript functions with no browser at all). They're kept
apart by `vitest.config.ts`'s `include` pattern and by never putting a
`*.test.ts` file inside Playwright's `testDir` — letting either
runner accidentally pick up the other's files is a fast way to get
confusing, hard-to-debug failures.

## Design decisions worth calling out

**Page Objects, not raw selectors in tests.** Every test talks to a
`LoginPage`/`MenuPage`/`CheckoutPage`/`ConfirmationPage` method, never to
a `page.locator(...)` directly. When a screen's markup changes, exactly
one file needs to change to fix every test that touches it.

**Deterministic overrides for anything time- or flag-dependent.** The
daypart banner and combo upsell badge both depend on "what time is it"
and "is this feature flag on" — behavior that, tested naively,
would make the suite flaky depending on when and where it runs. Both are
driven through explicit query-string/state overrides instead
(`gotoForMarket(market, { daypart, comboFlag })`), so a test asserting
"the breakfast banner shows" passes identically at 3am or 3pm.

**A pure, dependency-free utility instead of testing through the UI for
everything.** `sumCartTotal`/`formatMoney` in `src/utils/money.ts` have no
DOM, no network, no Page Object — just inputs and outputs. That
makes them fast to test exhaustively (edge cases, rounding, multiple
currencies) with Vitest in milliseconds, instead of relying only on
slower, broader end-to-end tests to catch a pricing bug.

**The demo app is real, not a fixture.** `demo-app/` is a small,
dependency-free static app with its own client-side state (localStorage
cart/session), market-specific data, and daypart/feature-flag logic —
not a mocked API. Every Page Object method drives real DOM interactions
against it.