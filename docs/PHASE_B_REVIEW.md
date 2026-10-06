# Phase B: commits 1-11 review

Branch: phase-b/safety-net. Commits 1-9 and bridge/rename fixes were reviewed and pushed. Commits 10-11 are the current review checkpoint.

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
   Updated both Inngest jobs to call a server-only HTTP client using an explicitly configured .convex.site HTTP-action URL.
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

| Variable                          | Code/consumer                                    | Location                | Client-exposed?                     | Needed?                                                |
| --------------------------------- | ------------------------------------------------ | ----------------------- | ----------------------------------- | ------------------------------------------------------ |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | app/layout.js                                    | Vercel/local            | Yes, intentionally public           | Core auth                                              |
| NEXT_PUBLIC_CONVEX_URL            | components/convex-client-provider.jsx            | Vercel/local            | Yes, public deployment URL          | Core data                                              |
| CONVEX_HTTP_URL                   | lib/inngest/bridge.ts                            | Vercel/local            | No; server-only                     | Background bridge HTTP-action URL (.convex.site)       |
| CLERK_JWT_ISSUER_DOMAIN           | convex/auth.config.js                            | Convex                  | No                                  | Core Clerk/Convex auth                                 |
| INNGEST_BRIDGE_SECRET             | convex/lib/bridge_auth.ts; lib/inngest/bridge.ts | Convex and Vercel/local | No; server-only guard               | Background bridge                                      |
| GEMINI_API_KEY                    | lib/inngest/spending-insights.js                 | Vercel/local            | No; API-route import graph only     | Optional legacy insights                               |
| RESEND_API_KEY                    | convex/email.ts                                  | Convex only             | No; not accepted in bridge payloads | Required for email sending; configured in dev per user |
| CLERK_SECRET_KEY                  | Clerk SDK, implicit                              | Vercel/local            | No                                  | Core server auth                                       |
| INNGEST_SIGNING_KEY               | Inngest serve SDK, implicit                      | Vercel/local            | No                                  | Production Inngest requests                            |
| INNGEST_EVENT_KEY                 | Inngest SDK, implicit                            | Vercel/local            | No                                  | Optional; app does not publish events                  |
| CONVEX_DEPLOYMENT                 | Convex CLI                                       | Local tooling           | No                                  | Local CLI deployment selection                         |

Only the two NEXT_PUBLIC variables above are intentionally included in client code.
The report covers direct application reads and relevant standard SDK/tooling configuration, not every optional
environment override supported by transitive dependencies.

## Before activating this change

- Convex target deployment: CLERK_JWT_ISSUER_DOMAIN, INNGEST_BRIDGE_SECRET and RESEND_API_KEY (for email).
- Vercel target environment: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_CONVEX_URL,
  CLERK_SECRET_KEY, CONVEX_HTTP_URL, INNGEST_BRIDGE_SECRET and INNGEST_SIGNING_KEY.
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
Live deployment and dashboard configuration remain manual. Build and public-page Playwright
verification for commits 7-9 are reported below.
The public seed, middleware defects and expense participant authorization are still pending commits 4–6.
UI, schema, React 18 and money calculations were preserved.

Earlier checkpoint validation: npm run check passed with 52 tests across five test files.

## Bridge URL follow-up (before commit 4)

The jobs previously derived the HTTP-action URL by replacing .convex.cloud in NEXT_PUBLIC_CONVEX_URL.
They now require server-only CONVEX_HTTP_URL, set to the target deployment's HTTPS .convex.site URL.
Copy the HTTP Actions URL from that deployment's Convex dashboard; do not use the client .convex.cloud URL.
Set it in local server configuration and each matching Vercel preview/production environment.
The server-only import, hosted-domain validation and redirect rejection remain in place.
Two additional client cases cover missing explicit configuration and rejection of .convex.cloud;
the existing URL-selection test now uses different public and HTTP deployment names.

## Commit 4: remove public seeding

Deleted convex/seed.js, with no replacement endpoint and no live data deletion.
Two regression cases invoke seed:seedDatabase by its old function name, both anonymously and
with a registered identity, assert the module is missing, and verify no expenses, groups or settlements
were written. They failed against the old mutation, which created synthetic debts for existing users.
Regenerated api.d.ts offline using the installed Convex API template; only the removed seed import
and module entry are staged. Existing generated JavaScript/data-model/server line-ending noise is excluded.
Run npx convex dev after review, then npx convex run seed:seedDatabase '{}' must report a missing function.
The mock proves local removal, not that the old deployed function disappears before publishing.

## Commit 5: middleware protection

Renamed middleware.js to middleware.ts and fixed the base-route matching and redirect invocation.
All six existing protected route families match their exact root and slash-delimited nested paths;
similar public prefixes are not accidentally protected. Public routes continue through.
31 tests use the installed Clerk route matcher with synthetic authentication:
12 anonymous redirects, 12 authenticated passes, and seven public-route passes.
All 12 anonymous cases failed before the fix. Redirect tests assert the actual returned Response.

Browser verification after starting Next: in a signed-out/private window, navigate directly to
/dashboard, /contacts, /dashboard/nested/detail and /contacts/nested/detail. Each must redirect to
Clerk sign-in rather than leave a blank shell. Also check /expenses/new and a real group URL.
The landing, sign-in and sign-up pages must remain accessible. Sign in and confirm dashboard and
contacts load normally, then open a valid nested group route. Repeat at 360px and desktop.
Nested dashboard/contacts example paths have no pages today; after sign-in they may correctly show 404.
The tests mock authentication, so real Clerk cookie handling and return navigation still need this check.

## Commit 6: expense creation authorization

expenses:createExpense remains the same public mutation. Its definition now lives in
convex/lib/expense_creation.ts as a plain exported object, consumed by the existing registration
in expenses.js; the old implementation was removed. No function is added, removed or renamed
in this commit, so no generated bindings are staged.
The new TypeScript implementation calls requireUser or requireMember directly.
Personal expenses must include the caller as payer or in splits. Payer and every participant must
have an existing users record, including when stale embedded group membership still references
a deleted user. For group expenses all parties must be in the group's embedded members array.
A group member may still organize an expense for other members without paying or participating.

19 new mutation tests: two authentication failures, 11 authorization/existence failures,
four valid caller-role cases, and two existing money-tolerance cases. Every rejection checks
that no expense was written. The original registration was exercised before the fix and failed;
the mock's nested runQuery path also failed to preserve synthetic auth, so that initial run
alone does not demonstrate successful debt forgery on a deployed backend.
The money validation and insert block were compared verbatim with the previous commit.
No calculations, validators, schema, existing expenses or other function implementations changed.

## Earlier commits 1-6 checkpoint validation

Post-commit npm run check totals: bridge follow-up 55, commit 4 57, commit 5 88, commit 6 107.
Nine test files now run; 54 cases were added from this session's 53-case baseline:
two bridge client cases, two seed cases, 31 middleware cases and 19 expense cases.
All checks include lint, strict TypeScript and Vitest. The existing auth.config.js lint warning remains.
No dependency additions, live backend calls, environment reads, secret inspection, browser test,
email delivery or AI requests were performed. Tests use synthetic data and mocked requests.
Existing generated-file line-ending noise is left unstaged. During this session api.d.ts also
gained the plain expense_creation helper module entry in the working tree; that is left unstaged
under the no-function-change rule for commit 6. Only commit 4 includes the regenerated
api.d.ts removal of the seed entry. No commits were amended; commits 1-6 were subsequently reviewed and pushed.

## Manual runtime verification after review

1. Set server-only CONVEX_HTTP_URL locally and in the matching Vercel environment to the exact
   HTTP Actions URL copied from the target Convex dashboard (HTTPS .convex.site).
   Keep NEXT_PUBLIC_CONVEX_URL as its separate .convex.cloud client URL.
   Both must refer to the intended same deployment, and the bridge secret must match on both sides.
   Restart Next/Inngest after changing server configuration.
2. Run npx convex dev on phase-b/safety-net and wait for successful function publication.
   Confirm convex/lib/expense_creation.ts passes real bundling with no path/type errors.
   Normal CLI codegen may add the plain helper module to api.d.ts; review that separately.
   Then run npx convex run seed:seedDatabase '{}': it must fail with function not found.
   Confirm the deployed Functions list has no seed mutation.
3. Use a secure HTTP client to POST to CONVEX_HTTP_URL/inngest-bridge with
   {"operation":"outstandingDebts"}. Without a bearer credential and with a wrong one expect
   401; with the correct bridge credential expect 200 and the validated array response.
   Verify the Next-side bridge client/job's data-fetch step reaches this same deployment.
   Do not activate the email step merely to test routing: existing jobs still send real emails.
   A public/client call to the internal Inngest queries or email action must remain unavailable.
4. Run npm run dev, then perform the signed-out and signed-in browser checks listed under commit 5.
   At 360px and desktop, save a normal personal expense with yourself as payer, another with
   yourself as participant, and a group expense with only group members. Confirm balances and
   supplied split amounts behave as before.
5. For adversarial expense checks, use disposable dev accounts A/B/C and a group containing A/B.
   The browser UI may prevent invalid choices before submission, so also use the Convex dev
   function runner/CLI with synthetic arguments. The installed CLI supports:
   npx convex run expenses:createExpense '<expense JSON>' --identity '<identity JSON>'
   The identity JSON must use the matching dev user's tokenIdentifier; omit --identity to test
   anonymous rejection. Arguments keep the legacy shape:
   description, amount, date, paidByUserId, splitType, splits [{userId,amount,paid}], optional groupId.
   For example, use amount 10 and one split of amount 10; substitute actual dev document IDs.
   As A, personal B-paid/C-split must reject; group C-paid/B-split and B-paid/C-split must reject.
   As C, any A/B group expense must reject. As A, personal A-paid/B-split and B-paid/A-split,
   and group B-paid/A-split must succeed. Confirm rejected calls leave no new expense.
   CLI identity simulation verifies the deployed handler; browser checks verify actual Clerk auth.
   If exercising deleted-user references, use disposable fixtures only; do not delete live users.

The earlier commits 1-6 checkpoint was reviewed and pushed. Commits 7-9 are covered below;
commits 10-11 await review. Broader authorization fixes and integer-money migration remain separate work.

## Commit 7: repository hygiene

Added the minimal .gitattributes rule '* text=auto eol=lf'; no renormalization was run.
.gitignore now covers browser-test output as well as environment files, Next output, dependencies,
coverage and Clerk config. Only .env.example is exempted from environment ignores.
The example was replaced from a known 11-variable, empty-value template without reading any
existing .env file. Each comment states where the variable belongs; source env reads were compared
against the template names, with Clerk/Inngest SDK and Convex CLI variables included.

Search-confirmed removals: unused components/ui/sonner.jsx; direct dependencies @clerk/backend,
@clerk/themes, @google/genai, @radix-ui/react-scroll-area, dotenv, ingest, svix and next-themes;
commented GroupList/deleteGroup implementations; dashboard useMutation/Trash2/toast/CreditCard;
SettlementList useState/Link; ParticipantSelector useUser; unused settlement paymentType watch;
unreachable GroupSelector loading branch; SettlementList debug logging of payment data.
The active Sonner toaster and legacy GoogleGenerativeAI job remain. Clerk dependencies that are
still needed transitively remain installed. Assets with uncertain external use remain untouched.
No Convex function was added or removed, and no generated files were staged.

## Commit 8: complete tooling

Added development-only Prettier, fast-check and @playwright/test: the existing stack had no
formatter, property generator or browser-test runner. Added Prettier configuration and explicit-path
format/format:check scripts. Only files touched by this session were formatted; no repo-wide rewrite.
Ignored environment files and local config in formatter input.
Two property tests call the actual expense mutation for 100 seeded examples each:
personal caller involvement and group caller/payer/all-participant membership, checking stored
caller identity on success and no expense writes on denial.
Added one public landing-page Playwright smoke spec, run in Chromium at 360px and desktop.
It checks status, title, heading, CTA and anchor navigation using dummy configuration.
It does not verify real Clerk/Convex connectivity.
README now documents npm-only commands, the deliberate two-terminal dev setup and incremental formatting.

## Commit 9: pull-request CI

.github/workflows/ci.yml runs npm ci, lint, typecheck, Vitest and npm run build for every PR.
It uses pull_request (not pull_request_target), Node 24, read-only contents permission and no
persisted checkout credential. It uses documented current official checkout/setup-node actions.
A full-history git diff of the PR base/head SHAs detects app/, components/ or e2e/ changes;
--no-renames ensures deletions and moves out of these paths also trigger browser checks.
Only matching PRs install Chromium and run Playwright. No real application secrets are supplied.

The build needs NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and NEXT_PUBLIC_CONVEX_URL because the root
providers instantiate Clerk and Convex. CI also supplies CLERK_SECRET_KEY for the server
middleware used by the smoke server. CONVEX_HTTP_URL and INNGEST_BRIDGE_SECRET are harmless
test placeholders for matching server configuration; no bridge call is made during build/smoke.
The public Clerk placeholder uses the production key format but encodes clerk.example.test,
not a real instance. The fake secret is sk_live_placeholder. Production-shaped dummy keys avoid
the SDK's development-browser handshake; no live credentials or authentication are used. API providers and live deployment configuration are not needed for these checks.
CI and NEXT_TELEMETRY_DISABLED are tooling controls, not mandatory production application settings.
The Inter font is downloaded by next/font/google during a fresh build, so the runner needs
network access to Google's font endpoints as well as npm and Playwright downloads.

Publisher references for the workflow and browser-server setup:

- https://github.com/actions/checkout
- https://github.com/actions/setup-node
- https://playwright.dev/docs/test-webserver
- https://playwright.dev/docs/ci-intro

## Production configuration checklist (commits 1-9)

Set these on the target **production Convex deployment**:

- CLERK_JWT_ISSUER_DOMAIN: production Clerk JWT issuer.
- INNGEST_BRIDGE_SECRET: server-only bridge credential, identical to Vercel's value for this deployment.
- RESEND_API_KEY: required if the retained email action/jobs are enabled.

Set these in the matching **Vercel Production environment**:

- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: production Clerk publishable key.
- CLERK_SECRET_KEY: production Clerk server key.
- NEXT_PUBLIC_CONVEX_URL: production Convex .convex.cloud client URL.
- CONVEX_HTTP_URL: that same deployment's .convex.site HTTP Actions URL, server-only.
- INNGEST_BRIDGE_SECRET: identical to the production Convex bridge credential.
- INNGEST_SIGNING_KEY: production Inngest request verification key.
- GEMINI_API_KEY: required if the retained monthly AI insights job is enabled.
- INNGEST_EVENT_KEY: optional; needed only if event publishing is enabled (not currently used).
- NEXT_TELEMETRY_DISABLED: optional; set 1 if desired.

CONVEX_DEPLOYMENT is local CLI configuration, not a production runtime variable.
If choosing a Vercel build command that also runs convex deploy, supply that deployment's
CONVEX_DEPLOY_KEY separately to the deploy tool; this CI/build command does not deploy Convex
and does not require it. Publish Convex separately with the supported CLI/dashboard workflow.
Use corresponding Preview/local settings for their own deployments; never point dummy CI values
at production. Production Resend delivery to other users still requires a verified sender domain;
the current onboarding@resend.dev sender is restricted and was not changed in this session.

## Manual checks after the commit 9 review

1. Review the three new commits, then push/open the PR. Confirm the GitHub Actions install,
   lint, typecheck, tests and build steps are green. This PR touches app/components/e2e, so the
   Chromium install and both smoke viewport runs must also execute.
2. On a later docs-only PR, confirm build/checks still run while the two browser steps skip.
   CI is not claimed green until GitHub has actually run it.
3. Use the documented two-terminal development setup. Confirm npx convex dev still publishes
   successfully, and Next serves landing/sign-in plus the authenticated dashboard.
4. At 360px and desktop, inspect the landing anchor link, dashboard groups, participant/group
   selectors and settlement list/form. Confirm their rendered behavior matches before cleanup.
   Confirm the browser console no longer logs settlement contents.
5. Confirm .clerk and local environment files remain ignored. Use git diff after your local
   Convex watcher runs; generated bindings should not be included in this checkpoint.
6. Apply the production settings above when deploying, then perform the real Clerk/Convex,
   bridge authentication and expense-denial checks in the earlier manual section.
7. Stop here. Next.js advisory evaluation/15.5-only patch and the selected-pair settlement
   reproduction/fix were deferred at that checkpoint; their results now appear below.

The initial smoke verification found two test-configuration issues: Clerk rewrites to localhost,
so the server and browser now both use localhost; test-shaped Clerk keys force a development-browser
handshake to the fake domain. The installed SDK was checked with network calls blocked:
fake test-format keys returned dev-browser-missing handshake, while fake production-format keys
returned signed-out. CI and smoke builds now use the latter format, still with the reserved
example.test host and placeholder secret. No production middleware/auth logic was bypassed.

## Commits 7-9 verification results and checkpoint

- npm run check passed after commit 7 with 107 tests and after commit 8 with 109 tests;
  commit 9 verification uses the same 109 tests across ten files.
- Two new property cases generate 200 deterministic examples; no money logic was added.
- One public-page smoke spec passed both mobile (360x800) and desktop (1280x800) Chromium runs.
- npm run build passed locally on Next 15.5.9 / React 18.3.1 / Node 24.14.0.
  Build and browser verification ran in a temporary tracked-source copy with node_modules linked,
  no .env files, no .clerk directory, no untracked local configuration and only dummy settings.
  The build warned about the existing unsupported reactCompiler option. The temporary copy also
  warned about parent lockfile workspace-root inference; neither warning stopped the build.
- Touched-file format:check passed. Prettier 3.9.9, fast-check 4.10.2 and Playwright 1.63.0
  are development dependencies; Next and React versions were unchanged.
- No generated Convex files were staged in commits 7-9. No live Convex deployment or real
  Clerk, Inngest, AI or email operation was invoked. No environment-file contents were read.
- Existing Convex auth.config.js still has one lint warning and no lint errors.
- GitHub Actions itself remains unverified until the reviewed commits are pushed and a PR runs.
  Commits 1-9 have since been reviewed and pushed; the current checkpoint is commits 10-11.

## Commit 10: conditional Next.js security patch

Upgraded Next.js from 15.5.9 to exactly 15.5.27, the official September 30, 2026
maintenance security release. React and React DOM remain 18.3.1. Only Next.js and
its required transitive packages are updated; no broad dependency update or audit fix.

The installed version falls in the affected range of the official
[dynamic route middleware bypass advisory](https://github.com/vercel/next.js/security/advisories/GHSA-492v-c6pp-mqqv),
which is fixed starting in 15.5.16. Splitr uses middleware to protect nested dynamic routes,
so the advisory is relevant; this is an applicability assessment, not an exploit reproduction.
The [official September release](https://nextjs.org/blog/september-2026-security-release)
provides the later cumulative patch, 15.5.27. No Next 16 or React upgrade is included.

Validation uses the same isolated tracked-source copy and dummy settings described above,
without copying environment files, .clerk or local configuration. npm run check passed with 109 tests across ten files. npm run build passed on
Next 15.5.27; the existing reactCompiler and temporary-copy workspace-root warnings remain.
The public-page smoke spec passed both Chromium runs (360x800 and 1280x800).
The required post-commit check uses the same suite. No Convex functions were added or
removed, and no generated bindings are staged.

## Commit 11: selected-pair settlement correction

The new regression was run before editing production code: two cases failed with
20 instead of 50, for both A viewing B and B viewing A after A paid C 30. Five
control cases already passed. After the fix, all seven pass.

Only the settlement application loop inside getSettlementData changed: subtract
a personal payment only if payer and receiver are the two selected users, in the
corresponding direction. Existing arithmetic, clamps, expense calculation, group
branch and schema remain unchanged. This narrow legacy JavaScript edit follows
the explicit function-only scope; no helper/function or generated binding was added.

Seven new unit cases cover both views of the third-party regression, both views
of a valid A-to-B payment (50 becomes 20), both views of group-payment isolation,
and anonymous rejection of the registered public query. For authenticated balance
cases, convex-test does not propagate identity into the nested runQuery; the test
resolves only that caller lookup through the real requireUser helper and executes
the actual handler with the real emulator database/indexes. Runtime integration
therefore still needs the manual checks below.

npm run check passes with 116 tests across eleven files (seven added), plus the
existing one lint warning in auth.config.js. Post-commit checks are required for
all three new commits. The security patch also passed its production build and
one smoke spec at two Chromium viewports. No new browser tests were added.

## Manual verification for commits 10-11

1. In a second terminal, run npx convex dev against your development deployment.
   Confirm functions publish successfully, including the updated settlements module,
   with no module-path, schema or runtime error. Generated bindings are not part of
   these commits; inspect their local watcher changes separately.
2. Run npm run dev and verify the public landing/sign-in pages at 360px and desktop.
   Signed out, check dashboard, contacts and nested protected routes redirect to
   sign-in; signed in, check they load normally. Verify a dynamic group/person/
   settlement page also loads with your real Clerk/Convex configuration.
3. Using disposable development users A, B and C, create a personal expense paid
   by B with an unpaid A split of 50. Record a personal A-to-C payment of 30.
   As A, open /settlements/user/<B-id>: it must show owing 50. As B, open
   /settlements/user/<A-id>: it must show owed 50. Refresh each page.
4. Record a personal A-to-B payment of 30. The same pages must now show 20
   in the corresponding direction. On a separate clean personal fixture, confirm
   a group-scoped payment does not alter the personal balance. Confirm an existing
   group settlement page still renders its previous balances and payment form.
5. With your configured environment, run npm run build then npm run test:e2e.
   Confirm the production build and both smoke viewport runs. After review/push,
   confirm the PR CI checks; local dummy verification does not establish live
   Clerk/Convex integration or prove an exploit reproduction.

All work stops at this checkpoint. No Phase D schema, settlement status/sign,
clamping or money-engine changes are included. No decision is required to implement
these two scoped fixes; review and approval are the next step.
