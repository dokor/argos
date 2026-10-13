# Public header regression

All ten French marketing pages and six existing English counterparts use SiteNav and SiteChrome.module.scss. Report pages intentionally use ReportHeader. Guides without English content remain French; the language control is present on every public header. Labels come from the shared language context.

The header sets its own Geist typography because landing/FAQ wrappers override the body font. The primary action uses a short single-line label (Audit gratuit / Free audit). An outlined account button retains its text on mobile. The session is verified with the same-origin account/me endpoint: a 401 links to registration, an authenticated profile links to the account, and loading or service errors retain the account entry. Login, invalidation, window focus and route changes refresh the state; cancelled requests cannot restore a revoked session.

Both actions have stable widths and 44px targets. The obsolete `/dashboard` shortcut and its reserved slot have been removed; preferences contain only theme and language controls. At 760px and below, the audit and account actions remain visible while a disclosure contains discovery links and preferences. The disclosure exposes aria-expanded and aria-controls, closes on navigation, and returns focus to its toggle on Escape. The root reserves the vertical scrollbar, including on short pages.

## Run locally

Install dependencies with npm ci in apps/console-web and apps/playwright-service, then run npx playwright install chromium from the latter. Build/start console-web on localhost (npm run build, npm run start). From the repository root run:

```sh
node scripts/e2e/public-header.mjs
```

HEADER_BASE_URL optionally selects another local port. The harness refuses remote targets. No backend, real admin credential or audit submission is needed; synthetic session responses exercise the header's UI state.

The suite covers 280, 320, 390, 760, 761, 1100, 1101, 1182 and 1280px viewports, FR/EN, light/dark, signed-out and signed-in states (including unverified profiles), and the absence of the obsolete console shortcut. It checks that action labels stay on one line, their text remains visible, and the header never overflows. Action coordinates must remain identical between public routes and login/logout. It exercises mobile disclosure, Escape/focus restoration and client navigation. Session responses are synthetic; no personal data or backend is needed. Native screenshots and geometry evidence are written to outputs/public-header.

SiteNav.dom.test.tsx covers localized destinations, session transitions, API failures, focus refresh, stale response cancellation, unmount cleanup and keyboard disclosure. Run npm test in apps/console-web.
