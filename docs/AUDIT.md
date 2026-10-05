# Splitr repository audit

Date: 2026-10-05. Baseline: a6ab1c6 on main. Read AGENTS.md, docs/PRD.md, docs/WORKFLOWS.md, docs/UPGRADE_PLAN.md first. Existing app audited in place; no fixes, installs, key-file reads, live backend calls, emails or AI calls. The only created file is docs/AUDIT.md. Earlier save attempts were denied; saving was retried after workspace access changed.

Evidence: source, lockfile peer metadata, imports/routes, Git history filenames. No .env* contents or deleted key-script contents opened. No known provider credential literals found in current non-env source; not a full historical/entropy scan. User reports deleted script keys revoked. No node_modules/.next; no application runtime/build/lint/browser verification. npm run check absent and waived. Registry queries failed; publisher docs used. Mobile findings are static 360px risks. Isolated Node VM query reproduction and arithmetic checks used synthetic data only.

## 1. Inventory

9 page routes, 1 API handler, 3 layouts, 32 components, 2 hooks, 6 lib files, 4 tables, 21 public Convex application functions.

### Routes and layouts
- app/page.jsx (/): marketing landing, hero/features/steps/testimonials.
- app/(auth)/sign-in/[[...sign-in]]/page.jsx: Clerk login.
- app/(auth)/sign-up/[[...sign-up]]/page.jsx: Clerk registration.
- app/(main)/dashboard/page.jsx: balances, year/month spending, groups.
- app/(main)/contacts/page.jsx: people/groups/create-group dialog via query param.
- app/(main)/expenses/new/page.jsx: individual/group expense tabs.
- app/(main)/groups/[id]/page.jsx: balances/members/expenses/settlements.
- app/(main)/person/[id]/page.jsx: personal pair history/balance.
- app/(main)/settlements/[type]/[id]/page.jsx: user/group settlement entry.
- app/api/inngest/route.js: GET/POST/PUT SDK handler for insights/reminders.
- app/layout.js: Clerk/Convex providers, Inter, Header, Sonner, metadata.
- app/(auth)/layout.js: centered auth shell.
- app/(main)/layout.jsx: client Authenticated wrapper, no redirect/loading/error.
- app/globals.css: Tailwind v4/theme/dark tokens/gradients.
- app/favicon.ico: metadata asset; favicon1.ico: extra unreferenced icon.

### Feature components
- components/convex-client-provider.jsx: Clerk auth bridge and Convex client.
- components/header.jsx: navigation/account controls/provisioning indicator.
- components/expense-list.jsx: expense/split cards and hard deletion.
- components/settlement-list.jsx: direction/date/note/payment cards.
- components/group-balances.jsx: own net and direct owes/owedBy lists.
- components/group-members.jsx: members/current-user/admin labels.
- app/(main)/contacts/components/create-group-modal.jsx: RHF/Zod group form and user search.
- app/(main)/dashboard/components/balance-summary.jsx: counterpart debt/credit links.
- app/(main)/dashboard/components/expense-summary.jsx: month/year totals and Recharts.
- app/(main)/dashboard/components/group-list.jsx: group links/balances; commented legacy version.
- app/(main)/expenses/new/components/expense-form.jsx: expense validation, selectors, writes.
- app/(main)/expenses/new/components/category-selector.jsx: local category state/default.
- app/(main)/expenses/new/components/group-selector.jsx: groups/member loading.
- app/(main)/expenses/new/components/participant-selector.jsx: personal counterpart search.
- app/(main)/expenses/new/components/split-selector.jsx: equal/percent/exact money calculations.
- app/(main)/settlements/[type]/[id]/components/settlement-form.jsx: payment direction/member/amount form.

### UI primitives (all under components/ui/)
- avatar.jsx: Radix avatar/image/fallback.
- badge.jsx: CVA/Slot badge.
- button.jsx: variants and button/Slot.
- calendar.jsx: Day Picker v8 calendar.
- card.jsx: card/header/title/description/action/content/footer.
- command.jsx: cmdk search/list/dialog.
- dialog.jsx: Radix modal/portal/overlay/title/close.
- input.jsx: native input styling.
- label.jsx: Radix label.
- popover.jsx: root/trigger/content/anchor.
radio-group.jsx: radio root/items/indicator.
- select.jsx: dropdown trigger/items/scroll controls.
- slider.jsx: range/thumb styling.
- sonner.jsx: theme-aware unused toaster.
- tabs.jsx: root/list/trigger/content.
- textarea.jsx: multiline field.

### Hooks
- hooks/use-convex-query.js: query result mirrored to effect state plus mutation state/toasts.
- hooks/use-store-user.jsx: provision authenticated user and combine auth/readiness state.

### Libraries
- lib/utils.js: cn using clsx/tailwind-merge.
- lib/expense-categories.js: icons/catalog/getCategoryById/getAllCategories/getCategoryIcon.
- lib/landing.js: marketing features/steps/testimonials.
- lib/inngest/client.js: shared Inngest client.
- lib/inngest/payment-reminders.js: daily personal debt emails.
- lib/inngest/spending-insights.js: monthly Gemini HTML insights emailed automatically.

### Convex tables
- users:5: name/email/tokenIdentifier/image; by_token/by_email/search_name/search_email.
- expenses:17: decimal amount/single payer/category/date/embedded splits/paid flag/group/creator; by_group/by_user_and_group/by_date.
- settlements:39: decimal payment/payer/receiver/date/note/group/relatedExpenseIds/creator; by_group/by_user_and_group/by_receiver_and_group/by_date.
- groups:55: name/description/creator/embedded user members role/joinedAt; no indexes.

### Convex functions (all public)
- users.js:5 store mutation: identity-based provisioning/name update.
- users.js:42 getCurrentUser query: identity/token lookup.
- users.js:65 searchUsers query: global name/email directory.
- contacts.js:9 getAllContacts query: personal counterpart and member groups.
- contacts.js:85 createGroup mutation: creator admin and existing-user members.
- dashboard.js:5 getUserBalances query: personal debt/payment aggregation.
- dashboard.js:88 getTotalSpent query: year share sum.
- dashboard.js:126 getMonthlySpending query: monthly share sums.
- dashboard.js:189 getUserGroups query: member groups and net balances.
- expenses.js:6 createExpense mutation: stores supplied totals/splits.
- expenses.js:72 getExpensesBetweenUsers query: personal pair rows/profile/net.
- expenses.js:171 deleteExpense mutation: hard expense/related settlement deletion.
- groups.js:5 getGroupOrMembers query: member groups/details.
- groups.js:80 getGroupExpenses query: histories/profiles/raw pair balances.
- settlements.js:9 createSettlement mutation: immediately effective payment.
- settlements.js:66 getSettlementData query: personal/group payment form balances.
- inngest.js:6 getUsersWithOutstandingDebts query: all users and personal debts/emails.
- inngest.js:122 getUsersWithExpenses query: all recent spender profiles.
- inngest.js:169 getUserMonthlyExpenses query: any selected user's recent spending.
- email.js:6 sendEmail action: supplied content/key to Resend.
- seed.js:8 seedDatabase mutation: sample data for first three users if no expenses.
Local seed helpers: createGroups:66, createOneOnOneExpenses:122, createGroupExpenses:217, createSettlements:380. Inngest nested getUser:25 caches reads.
Generated api.js/api.d.ts expose references; dataModel.d.ts derives schema types; server.js/server.d.ts expose query/mutation/action/internalQuery/internalMutation/internalAction/httpAction builders, not product endpoints. auth.config.js configures Clerk issuer/audience. convex/tsconfig.json allows JS/strict but not checkJs. README is generic.

Other config: middleware attempts Clerk protection; components.json shadcn JS/new-york/RSC; jsconfig aliases; next.config compiler option; postcss Tailwind plugin; eslint flat config. README stale. Public used hero/testimonials/logo3/logo-s; logo/logo1/logo2 unreferenced. No ledger directory, test suites, ADRs, migrations or CI.

## 2. Money handling

Stored amounts are v.number() in schema.js:19 (expense), :27 (split), :40 (payment); floating-point major units, not integer paise. No currency field.

### Monetary sites
- expense-form.jsx:35,100,320,332,344 parseFloat; :103-116 split copy/reduce/tolerance .01; :127-135 submission; :175-180 numeric input.
- split-selector.jsx:31,38,43,49,55,62 division/defaults; :70-76,105-111,142-148 sums; :96 percent multiplication; :125 exact parsing, :208 percentage parsing; :133 percent; :161-162 .01 tolerance; :183,204,214,229,236,251,257,272,273 toFixed; :227 max.
- settlement-form.jsx:22,53,89 parsing; :67-73,109-115 decimal writes; :156,165,295,297 money display; :219,223-225,388,392-394 dollar inputs.
- expenses.js:9,17 argument number; :43-48 split sum/tolerance; :53-63 insertion; :134-149 pair balance; :194-220 deletes alter payment history.
- settlements.js:11,23,46-54 number validation/storage; :97-120 expense totals; :124-146 unscoped settlement apply/clamp; :160 net; :177-194 group debts; :204-217 clamp payments; :234 net.
- groups.js:113-143 totals/pair ledger; :146-172 reciprocal netting, not multi-party simplification.
- dashboard.js:19-81 personal gross totals/person nets/sorting; :110-117 annual shares; :148-178 monthly; :210-252 group totals/payment application.
- inngest.js:30-101 debtor netting; :193-205 user share selection.
- seed.js:136-195 personal decimal fixtures; :231-350 group fixtures; :203,366 expense inserts; :413,423,434,447 payments/inserts.
- spending-insights.js:32-39 monetary/category sums.
- payment-reminders.js:26 dollar toFixed.
- dashboard/page.jsx:76,80,104,122 toFixed; :83,130 dollar zero.
- balance-summary.jsx:41,70.
- expense-summary.jsx:31-37 chart amounts; :54,60,72 formatting.
- group-list.jsx:20-21 zero/sign; :47 dollars.
- person/[id]/page.jsx:38 default; :92-108 zero/sign/format.
- expense-list.jsx:118,178-179.
- settlement-list.jsx:89.
- group-balances.jsx:44-51 amount sorting; :53-56 exact zero; :74,76,77,117,148 display.

### Correctness findings
1. Actual handler VM repro: A owes B 50; A pays C 30. getSettlementData A/B shows 20 owing (expected 50). settlements.js:124-146 includes all payer settlements but never filters receiver to selected pair.
2. Equal 10/3 stores 3.3333333333333335; displayed three 3.33 sum9.99. No deterministic remainder-paise allocation; FR1 unmet.
3. Group backend net=owed-owing positive means other owes caller; UI settlement-form.jsx:264-265,294-298 labels it "You owe": reversed.
4. Clamp-to-zero settlement form conflicts with signed balance readers on overpayments; dashboard gross totals disagree with net person lists for reciprocal debts.
5. createExpense does not validate positive/finite/safe amount, nonnegative/unique splits, enum split type, payer/participant existence/membership, or paid flags; personal writes do not require caller participation. Sum .01 tolerance is insufficient.
6. deleteExpense hard-deletes expenses and linked payments; no revisions/activity; violates FR5.
7. Payer default captures missing currentUser before async arrival; no later setValue. Invalid amount leaves stale splits; input/payer changes reset customized splits. Dollar labels contradict INR.

## 3. Auth and authorization

All listed 21 endpoints are public. Most use getCurrentUser via internal.users.getCurrentUser, but helper is public query. Generated JS internal/api both anyApi proxies; namespace does not change registration, and generated TS internal filtering disagrees. No requireMember/active status helpers.

### Authorization by endpoint
- store: direct identity, owns token record; no group applicable; missing identity email/name can conflict with required schema.
- getCurrentUser: identity+registered token; own full document/token identifier.
- searchUsers: current-user auth, global directory/email results, no relationship/consent/cap/rate limit.
- getAllContacts: current-user auth; personal caller involvement and group membership filters.
- createGroup: current-user auth; creator included admin, supplied user existence; enrolls without invite consent.
- getUserBalances: auth and personal caller involvement.
- getTotalSpent/getMonthlySpending: auth and payer/split involvement, not current group-membership check.
- getUserGroups: auth and group-membership filter.
- createExpense: auth; creator membership for group only; payer/splits nonmember possible; personal unrelated debt forging possible.
- getExpensesBetweenUsers: auth/no self; both expense involvement and settlement endpoints filtered; unrelated known user's profile still returned.
- deleteExpense: auth+creator/payer; no current group check; globally changes referenced settlements without party/group ownership.
- getGroupOrMembers: auth + member-filtered group list/details.
- getGroupExpenses: auth + explicit group membership.
- createSettlement: auth+caller payer/receiver; both group membership when provided; no personal target existence/relatedExpense ownership, receiver confirmation or idempotency.
- getSettlementData: auth; group membership checked; user target string lacks typed ID/relationship; bad settlement pair filtering.
- getUsersWithOutstandingDebts: NO auth, all users/emails/debt details.
- getUsersWithExpenses: NO auth, all recent spender identities/emails.
- getUserMonthlyExpenses: NO auth, arbitrary user private descriptions/dates/categories/shares including group data.
- sendEmail: NO auth; caller provides key, content and recipient; this is not proof of using server-owned key without possessing one.
- seedDatabase: NO auth or admin/dev gate; first three existing users receive artificial debts if table empty.
No auth failure tests.

Middleware.js:4-10 slash-before-wildcard excludes canonical /dashboard and /contacts. :18 returns redirectToSignIn function instead of invoking it. No auth.protect/server gate; client Authenticated shell is blank for visitors and cannot secure Convex direct calls. API Inngest protection delegated to SDK signing.

Sources: https://clerk.com/docs/reference/nextjs/app-router/auth ; https://docs.convex.dev/api/modules/server

## 4. Security

### Environment usage (names only)
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY app/layout.js:23: intentionally public.
- NEXT_PUBLIC_CONVEX_URL provider:7/payment-reminders:6/spending-insights:6: intentionally public deployment locator.
- CLERK_JWT_ISSUER_DOMAIN auth.config.js:5: issuer.
- GEMINI_API_KEY spending-insights.js:9: server job key.
- RESEND_API_KEY reminder:51/insights:80: server key sent as public action arg.
Clerk secret/redirect and Inngest signing env settings may be implicitly consumed; presence/values not inspected. .env.example absent from tracked filenames; .gitignore:34 ignores all .env* without example exemption.

History filenames: db8f9f8 added test-key.js/list-models.js; a6ab1c6 deleted. No historical contents opened; user says revoked. Deletion not history erasure; no full history credential guarantee.
Current common credential-pattern scan found no recognized secret literals; not exhaustive.
Public Inngest query exposure is confirmed.
email.js:12-15 accepts key in action payload; potential platform step/log retention not established.
PII logs: inngest.js:105 user/debts; settlement-list.jsx:18 complete settlements/notes; email.js:26,30 provider response/errors.
Email names unescaped reminder:25,36; insights:76; generated HTML unvalidated :67,78. Email markup injection risk, no browser XSS exploit claimed.
Gemini prompt includes unfiltered expense descriptions; no explicit email/UPI field but free text may contain PII/prompt injection. No output schema, confirmation, timeout/fallback.
Auto daily/monthly emails conflict with PRD drafts; no consent/unsubscribe/per-pair cooldown; whole reminder batch one retriable step may duplicate successful sends. Resolved {success:false} email result is ignored by callers.
Inngest serve relies on signing; don't claim route insecure solely because no Clerk guard. Production signing not verified. https://www.inngest.com/docs/platform/signing-keys
No configured app CSP/custom headers, rate limiting or ledger idempotency; provider runtime headers unknown.

## 5. Dead code and duplication

Confirmed unused: UI sonner wrapper; next-themes only reachable there. logo/logo1/logo2 and favicon1 unreferenced (external use unknown). Commented deleteGroup groups.js:194-233 and old group-list:57-143. Dashboard unused useMutation/Trash2/toast/CreditCard; settlement-list unused useState/Link; participant-selector unused useUser; settlement form unused paymentType watch. GroupSelector loading block71-75 unreachable after early36-38 return. Key scripts already deleted. README wrong page.js/Geist/multiple package managers.
Seed has no app consumer but is public endpoint/CLI utility, NOT unreachable.
Direct unused dependency candidates: @clerk/backend,@clerk/themes,@google/genai,@radix-ui/react-scroll-area,dotenv,ingest,svix. Clerk backend/svix may remain transitive. next-themes only unused toaster; @eslint/eslintrc/autoprefixer unused config but adapter could repair lint. React DOM/PostCSS/Tailwind are framework dependencies, not unused. tw-animate-css imported CSS.
Repeated balance derivation in dashboard/expenses/groups/settlements/inngest; split and tolerance duplicated in UI/backend. Search selection and forms/list lookups duplicated; supplied avatar URLs discarded. Current-user queries repeated (Convex may deduplicate subscriptions).
All nine pages have entry/navigation; no proven unreachable page. No index /groups,/expenses,/settlements, no editExpense/deleteGroup implementation. /app was superseded request, not audit requirement.

## 6. Dependency health

Lockfile, not installed runtime:
Next15.5.9, React/DOM18.3.1. DayPicker8.10.1 peers React16/17/18 and date-fns2/3; date-fns3.6 fits. History a68dde3 calendar React18 downgrade. Clerk Nextjs6.13 peers Next13/14/15; 00b1080 downgrade from Next16 for Clerk. No React change authorized.
Convex1.23; RHF7.70/resolvers5.2.2/Zod3.25.76 compatible RHF peer.
ESLint9.23 + config-next15.2.3 vs Next15.5.9; eslint config spreads legacy object not iterable; exact publisher source confirms. next lint deprecated15.5.
Tailwind4.1.3 vs PostCSS plugin4.0.15 with nested Tailwind4.0.15: version skew, no proven runtime failure.
Radix avatar1.1.4/dialog1.1.15/label2.1.3/popover1.1.7/radio1.2.4/select2.1.7/slider1.2.4/slot1.2/tabs1.1.4 all accept React18. cmdk1.1.1,Sonner2.0.3,lucide0.487,spinners0.15,Recharts2.15.4 used.
Inngest3.35/Resend4.8 used; ingest1.0 unused/different. Legacy Google SDK0.24.1 used/new genai1.35 unused. Google deprecates legacy family.
PostCSS8.5.3/autoprefixer10.4.21/eslintrc3.3.1; TypeScript5.8.3 transitive but no direct declaration/root config/script. No tests/format/CI tooling.

### Source compatibility
Input/Textarea/Button and primitives plain functions without forwardRef; RHF refs/Radix asChild ref depend on React18 forwarding. Source risk to registration/focus/anchors; mounted Next renderer needs runtime verification, not blanket all-forms-broken claim. Restore compatible wrappers, not React upgrade.
next.config reactCompiler top-level invalid for exact Next15.5.9 experimental option; babel plugin absent.
Contacts useSearchParams no local/ancestor Suspense; authenticated wrapper affects reachability: build risk, not confirmed failure.
Publisher references:
- [Publisher reference](https://react.dev/reference/react/forwardRef)
- [Publisher reference](https://raw.githubusercontent.com/vercel/next.js/v15.2.3/packages/eslint-config-next/core-web-vitals.js)
- [Publisher reference](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/reactCompiler)
- [Publisher reference](https://raw.githubusercontent.com/vercel/next.js/v15.5.9/packages/next/src/server/config-shared.ts)
- [Publisher reference](https://nextjs.org/docs/15/app/api-reference/functions/use-search-params)
- [Publisher reference](https://ai.google.dev/gemini-api/docs/libraries)

Next15.5.9 trails publisher Sept30 maintenance15.5.27; recommend same-major security applicability review/patch, not major React upgrade. Do not assume every advisory exploitable: remote-image SSRF requires configured remote patterns (absent); Aug Windows RCE requires both router families (only app found); Sept22 upstream RCE affects16 not15.
- [Publisher reference](https://nextjs.org/blog/security-update-2025-12-11)
- [Publisher reference](https://nextjs.org/blog/september-2026-security-release)
- [Publisher reference](https://nextjs.org/blog/august-2026-security-release)
- [Publisher reference](https://nextjs.org/blog/nextjs-security-update-september-22-2026)
Registry lookups unavailable; no exhaustive latest/vulnerability claims.

## 7. Performance

### Unbounded reads
- contacts20,27,64: caller paid/all personal/all groups.
- dashboard11,41,100,138,194,208,243: global expense/payment/year scans, groups, group history, unindexed settlements.
- expenses85,92,129,194: unbounded personal histories, pair settlement table filtering, deletion full settlement scan.
- groups14,95,100: all groups, unbounded group expense/history.
- settlements86,93,129,136,174,202: unbounded payer/group histories, filter ignores group index.
- users82,88: uncapped two search results/dedup.
- inngest8,15,21,124,139,146,182: all users/global history, recent range repeated per user.
- seed12,22: collect for emptiness/select first3.

Existing by_group/by_receiver/by_date settlement indexes underused. Group embedded membership and expense split arrays lack queryable membership/participant indexes; normalize with migration, don't invent array index. Future group/date and party/date access paths, cap search.
Group ledger O(members²), full histories returned; null user at groups105-106/outsider ledger crash. Inngest O(users × expenses/settlements) and repeated recent scans.
Live form/query client components legitimately interactive. Presentation group-members/settlement-list/group-balances could receive current user rather than query it. Already directive-free group-list/balance-summary still client graph from dashboard; isolate server static shell rather than remove all client.
Mirrored useConvexQuery extra renders/stale data; catch misses render query errors. Eager Recharts/root Convex on public screens; big364/428-line forms; no bundle/LCP measurements. Hero has next/image priority/dimensions.

## 8. Accessibility and UX

Existing loaders on dashboard/contacts/group/person/settlement, empty expense/settlement/group/contact cards, form errors/toasts/submit state, search min/search/no results. Missing query error/retry, invalid IDs/not-member UI, shell loading/redirect, provisioning catch (store hook24-28), form currentUser null UI, delete pending/undo. No app error/loading/not-found files/custom boundary.
Query hook try/catch covers setState, not useQuery render errors. Duplicate mutation/form error toasts.
Payer async default unset; group mode schema optional group, submit count not selection. Group/person AddExpense loses context.
Settlement clickable div268-275 not keyboard choice; reversed labels, no confirmation/UPI.
Missing accessible names remove buttons group171-176/participant80-85/mobile dashboard58-60; expense delete has sr-only correct.
Payer select no label association; category label id target nonexistent; date/group/participant/split fields and sliders missing appropriate associations; errors not consistently described/announced.
Sizes36/default,32/small,40/large/header,32/delete/calendar miss project>=44px (not blanket WCAG minimum-target violation).
Link wraps Button in header50-61 nested interactive; alt Vehiql24 wrong; avatar semantics and chart table alternative need work. Sonner may supply live behavior; no unsupported claim all toasts inaccessible.
Dark tokens no mounted provider/toggle; hardcoded colors. Contrast/focus not measured.
360px static risks: split min name120+gaps+100input+slider within padded card narrow area; unconditional2-column chart totals; nowrap expense/settlement rows; wide fixed logo/auth header; action pair no wrapping; long names/email/headings; modal no maxheight scrolling. Positive one-column responsive grids and stacked heading/hero CTA. Not browser-tested.

## 9. Ranked remediation (future only)

1. **P0** — restrict Inngest queries/seed service/admin boundary+denial tests1-2d.
2. **P0** — pair filtering/overpayment signed semantics+ABC test0.5-1.5d.
3. **P0** — payer/participant/caller/group/relatedExpense authorization and numeric invariants1-3d.
4. **P0** — pure integer paise engine/property tests+backward-safe legacy migration4-8d plus data review.
5. **P0** — middleware base route/invoked protection/auth states0.5-1d.
6. **P0** — settlement signs and proposed-confirmed-rejected/cancelled/receiver-only state2-4d.
7. **P0** — soft delete/revisions/payment evidence/member checks2-4d plus migration.
8. **P0** — security applicability triage/same-major Next patch0.5-1.5d.
9. **P0** — PII logs/credential payload/AI minimization/escaped consented reminder drafts1-3d plus UX.
10. **P1** — React18 compatible refs with form/trigger checks0.5-1.5d.
11. **P1** — lint repair/allowJs strict TS/scripts/tests/Prettier/CI1-3d.
12. **P1** — indexed bounded reads/normalized membership/query caps2-5d.
13. **P1** — query state/error boundaries/provision retry1-2d.
14. **P1** — incremental strict TS folders/reduce forms/typed public-internal5-10d.
15. **P1** — dead code/deps/env metadata/README/versions/config cleanup0.5-1.5d.
16. **P2** — INR formatting/context-preserving forms/default payer1-2d.
17. **P2** — keyboard/labels/44px/chart/errors1-3d.
18. **P2** — 360 long content/themes/modals1-3d.
19. **P2** — marketing correction<0.5d; explanation algorithm after ledger3-6d.
No fixes performed; estimates overlap; schema migrate widen/migrate/narrow ADR/dryrun preserving live data.

## 10. Mapping to PRD

Keep means preserve sound existing behavior with fixes; rewrite means incremental feature replacement not repo rewrite; missing future feature not dead code.
- Clerk auth/bridge -> MVP/F1: KEEP repair gates/provisioning; profile UPI/currency missing.
- Tailwind/shadcn -> mobile/accessibility/themes: KEEP restore refs/tokens.
- Landing -> product intro: KEEP layout/REWRITE unsupported claims.
- Group create/search ->F1: KEEP shell/REWRITE model boundary add types/currency/guests/invites.
- Global search -> participants: REWRITE privacy/caps.
- Manual expense ->F2: KEEP UX/REWRITE money validation add notes/shares/multiple payers.
- Decimal storage/split UI -> FR1: REWRITE pure ledger/migration.
- Personal/group balances ->FR2: KEEP views/REWRITE derived engine.
- Bilateral net ->D3/FR3,4: REWRITE/EXTEND actual simplification/trails; no min-payments currently.
- Record settlement ->F5/FR9: REWRITE confirmation/status/UPI/QR.
- Hard delete ->FR5: DELETE destructive path after softdelete/revisions replacement.
- History tabs -> activity/revisions: KEEP extend.
- Monthly chart -> analytics notD8: KEEP correct money/a11y/bundle.
- Daily auto-email ->D5/FR10: DELETE auto sending/REWRITE confirmed drafts/cooldowns.
- Monthly Gemini email ->notD1/D2: DELETE auto pipeline unless separately approved; not expense parsing.
- Seed ->dev utility: RESTRICT or DELETE after fixture decision.
Guest/invite/claim tokens/F7/FR7: MISSING future.
SayItD1/F3/FR8: MISSING future.
Receipt claimD2/F4: MISSING future.
DisputesD6/F6: MISSING future.
Cross-group pairD7: MISSING (current pair excludes groups).
TripWrappedD8: MISSING (monthly personal chart not trip).
FX/recurring/PWA/offline/CSV: MISSING defer to v1.2.
- Unused toaster/assets/commented endpoints -> DELETE separately authorized; key scripts already gone.

FR1-10 none certified: floats conservation; no tested zero sums; no multi-party min/explanations; no revisions/softdelete; partial auth with public/forged attribution gaps; no guest tokens; no parsing fallback; no settlement states; no nudge cooldown.
