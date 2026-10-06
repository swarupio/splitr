# Phase B: commits 1–3 review

Branch: `phase-b/safety-net`. Review checkpoint only: commits 4–11 have not started.

## Changes

1. Repaired the legacy ESLint flat-config incompatibility using the existing FlatCompat dependency.
   Added strict TypeScript with allowJs=true/checkJs=false and preserved the @/* alias.
   Added lint, typecheck, test and check scripts, Vitest, compatible convex-test and Node/React 18 types.
   Vitest has environment-file loading disabled. Existing production dependency versions are unchanged.
2. Added requireUser and requireMember in convex/lib/auth.ts using the existing schema and embedded membership.
   The current-user query now reuses requireUser.
3. Registered all three background data queries as internalQuery and the existing email action as internalAction.
   Added a POST /inngest-bridge HTTP action with four explicit operations, strict Zod request validation,
   authentication before parsing/dispatch, 401 for missing/wrong credentials, no-store responses and generic failures.
   Updated both Inngest jobs to call a server-only HTTP client using the same deployment's .convex.site domain.
   Credentials are carried only in the Authorization header, never forwarded as Convex function arguments.
   Removed debt/profile and email-provider logging from the touched functions.
   Added .env.example with empty placeholders and a comment for each variable; exempted only that template from ignores.

## Constant-time credential comparison

HTTP actions cannot use Node crypto directly. The bridge hashes each credential to a fixed-size SHA-256 value,
then compares via WebCrypto HMAC verification of a fixed message, rather than JavaScript string equality.
No credential, request body, header, or provider error is logged by the new bridge/email code.

Convex's WebCrypto HMAC implementation delegates verification to aws-lc-rs::hmac::verify, whose documentation
specifies constant-time verification:
- https://raw.githubusercontent.com/get-convex/convex-backend/main/crates/webcrypto/src/hmac.rs
- https://docs.rs/aws-lc-rs/latest/aws_lc_rs/hmac/fn.verify.html

This is source verification of the published runtime implementation, not a timing measurement of your deployment.

## Email dependency report

No UI calls sendEmail. Two existing scheduled jobs do:
- lib/inngest/payment-reminders.js: daily payment-reminder email.
- lib/inngest/spending-insights.js: monthly Gemini spending-insights email.

Because these jobs depend on the action, it was retained and made internal rather than deleted.
Previously, process.env.RESEND_API_KEY was read in lib/inngest/payment-reminders.js and lib/inngest/spending-insights.js.
These are server-side jobs imported by app/api/inngest/route.js; the key was not a NEXT_PUBLIC variable and no UI read it.
They forwarded the key to convex/email.js as the public action argument apiKey. Without a valid credential the argument
could be invalid or sending could fail; the jobs also incorrectly treated resolved failure results as success.

The retained internal action reads RESEND_API_KEY only from the Convex environment, never from arguments or client variables. If absent, it returns EMAIL_NOT_CONFIGURED and makes
no provider request. The bridge client treats that outcome as a failure rather than claiming mail was sent.
The user has a Resend account and reports RESEND_API_KEY is now configured in the Convex dev deployment.
No credential value or dashboard setting was inspected. Resend is required for email delivery, but not for the UI,
auth, data queries, tests, or bridge startup.

The action uses the exact sender Splitr <onboarding@resend.dev>. Resend restricts its resend.dev test sender
to the email address associated with your account. To reach other users, verify your own domain in Resend
and change the action's from address to an address on that verified domain. The sender is unchanged here;
no domain/address was guessed or configured.
Reference: https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

The monthly job still generates insights before attempting email when Gemini is configured; this phase does
not remove or redesign the existing scheduled jobs.

## Environment names and client exposure

No existing .env* file was inspected. No real values were written. Presence of your configured credentials
was accepted from your instruction, not checked by reading settings or values.

| Variable | Code/consumer | Location | Client-exposed? | Needed? |
| --- | --- | --- | --- | --- |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | app/layout.js | Vercel/local | Yes, intentionally public | Core auth |
| NEXT_PUBLIC_CONVEX_URL | components/convex-client-provider.jsx; lib/inngest/bridge.ts | Vercel/local | Yes, public deployment URL | Core data and bridge |
| CLERK_JWT_ISSUER_DOMAIN | convex/auth.config.js | Convex | No | Core Clerk/Convex auth |
| INNGEST_BRIDGE_SECRET | convex/lib/bridge_auth.ts; lib/inngest/bridge.ts | Convex and Vercel/local | No; server-only guard | Background bridge |
| GEMINI_API_KEY | lib/inngest/spending-insights.js | Vercel/local | No; API-route import graph only | Optional legacy insights |
| RESEND_API_KEY | convex/email.ts | Convex only | No; not accepted in bridge payloads | Required for email sending; configured in dev per user |
| CLERK_SECRET_KEY | Clerk SDK, implicit | Vercel/local | No | Core server auth |
| INNGEST_SIGNING_KEY | Inngest serve SDK, implicit | Vercel/local | No | Production Inngest requests |
| INNGEST_EVENT_KEY | Inngest SDK, implicit | Vercel/local | No | Optional; app does not publish events |
| CONVEX_DEPLOYMENT | Convex CLI | Local tooling | No | Local CLI deployment selection |

Only the two NEXT_PUBLIC variables above are intentionally included in client code.
The report covers direct application reads and relevant standard SDK/tooling configuration, not every optional
environment override supported by transitive dependencies.

## Before activating this change

- Convex target deployment: CLERK_JWT_ISSUER_DOMAIN, INNGEST_BRIDGE_SECRET and RESEND_API_KEY (for email).
- Vercel target environment: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_CONVEX_URL,
  CLERK_SECRET_KEY, INNGEST_BRIDGE_SECRET and INNGEST_SIGNING_KEY.
- Use the identical bridge credential on the two sides for each environment. You already configured local/dev;
  configure the matching production/preview values separately when deploying there.
- Set RESEND_API_KEY in each target Convex deployment, not just locally or in Vercel. You report it is set in dev.
  Verify a Resend domain and use a sender on that domain before emailing other users.
  GEMINI_API_KEY is needed for the legacy AI job; INNGEST_EVENT_KEY only for future event publishing.
- Publish the updated Convex functions and matching Next/Inngest code together after review. The previous job
  clients cannot invoke the newly internal queries. Regenerate normal Convex bindings when publishing.
  For this checkpoint the installed publisher API template was run offline; no Convex CLI or backend was contacted.

## Validation and limitations

npm run check must pass before and after each commit. Unit tests use synthetic identities/data and a mock backend;
no live Convex, Clerk, Inngest, Gemini or email requests are made.
Visibility regressions assert the actual Convex registration is internal. convex-test deliberately allows internal
calls, so this is not a claim that the emulator enforces production public/internal dispatch.
HTTP tests exercise missing/wrong credentials, authenticated-user bypass rejection, malformed credentials,
authentication-before-parsing, invalid operations/arguments, authorized data reads and safe handling of missing email configuration.
Client tests cover domain selection, bearer headers, no redirect forwarding, fail-closed configuration and response validation.
Provider results/errors are mocked.

There remains one pre-existing ESLint warning in convex/auth.config.js (anonymous default export), with no lint errors.
The dependency installation reported existing vulnerabilities; no broad npm audit fix or major update was applied.
Build, Playwright, live deployment and dashboard configuration are deferred to later approved steps.
The public seed, middleware defects and expense participant authorization are still pending commits 4–6.
UI, schema, React 18 and money calculations were preserved.

Checkpoint validation: npm run check passed with 52 tests across five test files.
