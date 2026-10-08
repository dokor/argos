# Public header regression (#357)

All ten French marketing pages and six existing English counterparts use SiteNav and SiteChrome.module.scss. Report pages intentionally use ReportHeader. Guides without English content remain French; the language control is present on every public header. Labels come from the shared language context.

The header sets its own Geist typography because landing/FAQ wrappers override the body font. Geist uses optional display to avoid a late font swap. Stable logo/link columns and a reserved admin slot prevent language, active-state or cookie hydration from moving controls. Below 560px the admin action uses an accessible dashboard icon. The root reserves the vertical scrollbar, including on short pages.

## Run locally

Install dependencies with npm ci in apps/console-web and apps/playwright-service, then run npx playwright install chromium from the latter. Build/start console-web on localhost (npm run build, npm run start). From the repository root run:

```sh
node scripts/e2e/public-header.mjs
```

HEADER_BASE_URL optionally selects another local port. The harness refuses remote targets. No backend, real admin credential or audit submission is needed; a synthetic argos_admin cookie only exercises the header's UI state.

The suite covers 1280, 390 and 320px viewports, FR/EN, light/dark, visitor/admin, exact element coordinates between routes and states, client navigation, active links, actual language/theme toggles, short/tall content, delayed fonts and admin hydration. It also visits either side of the 560/900px breakpoints. Native screenshots and geometry evidence are written to outputs/public-header. Within each viewport/language/theme/admin state, header pixels are compared between routes after neutralizing only the intended active-link decoration. Compositor rounding is allowed on at most 0.2% of pixels with a maximum channel delta of 20/255; all element coordinates must match exactly. No screenshot baseline from another OS/font renderer is needed. CI retains captures for review, including on failure.
