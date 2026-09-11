# QuickBite Playwright Suite

A Playwright + TypeScript end-to-end test framework built on the Page
Object Model, testing a small, self-contained multi-market "QuickBite"
POS/kiosk ordering flow.

This project was built as a self-contained portfolio piece: it ships its
own tiny demo application (`demo-app/`) so every test in this repo
actually runs against something real, rather than pointing at a target
you'd have to stand up yourself.

## What's in here

- A Page Object Model covering a real four-screen flow (login, menu,
  checkout, confirmation), tested across three locale/market projects
  (US, UK, DE) in parallel.
- Deterministic, non-time-dependent tests for time-of-day-sensitive
  behavior (the breakfast/all-day daypart banner) and a feature flag (the
  combo upsell badge), using explicit overrides instead of relying on the
  clock.
- A small pure TypeScript utility (`src/utils/money.ts`) with its own
  fast unit tests (Vitest), kept deliberately separate from the Playwright
  suite so unit tests and end-to-end tests never compete for the same test
  runner.
- A CI pipeline that lints, typechecks, unit-tests, and end-to-end-tests
  every push and pull request.

## Quick start

```bash
npm install
npx playwright install chromium   # first time only

npm run test:unit       # fast unit tests (Vitest) — no browser needed
npm run test:e2e        # full Playwright suite against the bundled demo app
```

## Project layout

```
demo-app/                 Self-hosted fictional POS/kiosk app (static HTML/CSS/JS)
  data/menu.json           Market-specific menu items & pricing (US/UK/DE/PT/CA)
  index.html                Attendant login
  menu.html                  Menu, daypart banner, cart, combo upsell
  checkout.html                Payment method, order summary
  confirmation.html              Order number confirmation

src/
  pages/                   Page Object Model (BasePage + 4 concrete pages)
  utils/
    money.ts                 Pure cart-total and money-formatting helpers
    money.test.ts             Vitest unit tests for the above

tests/                     Playwright specs (login, checkout, daypart, feature flag)
scripts/                   Static file server (serves demo-app/)
playwright.config.ts       Playwright projects, webServer, baseURL
vitest.config.ts           Vitest config (src/**/*.test.ts only)
.github/workflows/ci.yml   Lint -> typecheck -> unit tests -> e2e
docker/Dockerfile           Containerized CI runner image
```

## Why the Page Objects look the way they do

Every screen has a Page Object extending a shared `BasePage`, and every
test talks to those Page Objects rather than to raw selectors. That
indirection is what lets a UI change (a renamed `data-testid`, a
restructured form) get fixed in exactly one place instead of in every
test that happens to touch that screen.

## Why the money utility is separate from the demo app's own logic

`src/utils/money.ts` deliberately mirrors, rather than imports from,
`demo-app/js/app.js`'s cart-total logic. The demo app is intentionally a
buildless, dependency-free vanilla-JS script (so it can be served as
plain static files with zero build step); `src/utils/money.ts` is real,
compiled TypeScript with its own unit tests, used both as fast-feedback
coverage for that pricing logic and, via `tests/checkout.spec.ts`, as the
single source of truth for the price string the end-to-end tests assert
against — so a price change only has to happen in one place.

## Extending this to a real application

1. Replace `demo-app/` and delete the `webServer` block in
   `playwright.config.ts`, setting `BASE_URL` to your real target instead.
2. Add/replace Page Objects under `src/pages/*.page.ts`, extending
   `BasePage`.
3. Add more pure TypeScript logic under `src/utils/` as it comes up, with
   its own `*.test.ts` file alongside it.

See `docs/ARCHITECTURE.md` for the module boundaries.