# Public header regression

Public marketing pages use SiteNav and SiteChrome.module.scss in all 22 supported languages. Report pages intentionally use ReportHeader. The language disclosure is present on every public header. Labels come from the shared language context.

The header sets its own Geist typography because landing/FAQ wrappers override the body font. The primary action uses a short label (Audit gratuit / Free audit). An outlined account button retains its text on mobile. Long translated labels may wrap, but their complete text must fit inside the control. The session is verified with the same-origin account/session endpoint: a signed-out response links to registration, an authenticated profile links to the account, and loading or service errors retain the account entry. Login, invalidation, window focus and route changes refresh the state; cancelled requests cannot restore a revoked session.

Both actions have at least 44px targets. The account button reserves the space of both session labels so login and logout preserve its dimensions, including when text wraps. The obsolete `/dashboard` shortcut and its reserved slot have been removed. At 760px and below, the audit and account actions remain visible while a disclosure contains discovery links and preferences. The disclosure exposes aria-expanded and aria-controls, closes on navigation, and returns focus to its toggle on Escape. The nested language disclosure lists all 22 native language names and closes independently on Escape. The root reserves the vertical scrollbar, including on short pages.

## Run locally

Install dependencies with npm ci in apps/console-web and apps/playwright-service, then run npx playwright install chromium from the latter. Build/start console-web on localhost (npm run build, npm run start). From the repository root run:

```sh
node scripts/e2e/public-header.mjs
```

HEADER_BASE_URL optionally selects another local port. The harness refuses remote targets. No backend, real admin credential or audit submission is needed; synthetic session responses exercise the header's UI state.

The suite covers 280, 320, 390, 760, 761, 1100, 1101, 1182 and 1280px viewports, FR/EN, light/dark, signed-out and signed-in states, and the absence of the obsolete console shortcut. It checks complete action text, non-overlapping buttons and no header overflow. Action coordinates must remain identical between public routes and login/logout. It exercises both disclosures, all 22 language options, Escape/focus restoration and client navigation. Session responses are synthetic; no personal data or backend is needed. Native screenshots and geometry evidence are written to outputs/public-header.

SiteNav.dom.test.tsx covers localized destinations, session transitions, API failures, focus refresh, stale response cancellation, unmount cleanup and keyboard disclosure. Run npm test in apps/console-web.

The public visual group also runs `scripts/e2e/language-routing.mjs`: 66 server-rendered responses across all 22 languages (home, sign-in and example report), spoofed language-header replacement, and German/Bulgarian language switching with client navigation. Run Next with `--hostname 127.0.0.1`, as CI does, to catch origin normalization accidentally turning an internal locale rewrite into a second HTTP request.
