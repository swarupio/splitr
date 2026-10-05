# Splitr — Product Requirements Document

Status: v1 draft · Owner: Swarup · Audience: humans and coding agents (Codex CLI)

---

## 1. One-line pitch

**Splitr is the shared ledger that explains itself and settles over UPI.**
Add an expense in five seconds, split a receipt item by item with friends who don't even have accounts, and see *why* each payment is being asked for, then pay with one tap.

## 2. Problem

Existing split apps (Splitwise and clones) fail in predictable ways:

| Pain | What happens today |
|---|---|
| Slow entry | Many taps per expense, so people stop logging and the ledger rots |
| Receipts | Item-level splitting (shared starters, one person's drink) is manual and painful |
| Friction to join | Everyone must sign up before they can see what they owe |
| Opaque settlement | "Simplified debts" tells you to pay someone you never ate with, with no explanation, so people distrust it |
| Settling is detached | The app records a payment but does not help make it (in India: UPI) |
| Awkwardness | Asking for money is socially uncomfortable; reminders feel rude |
| Trust | Silent edits and deletes cause fights; no dispute path |
| Paywalls/ads | Daily expense limits, ads, upsells |

## 3. Target users

- **Primary:** friend groups, flatmates and trip groups in India (students and early-career), 18–30, phone-first, UPI-native, WhatsApp-native.
- **Secondary:** couples, small events (birthday, farewell, hackathon team expenses).

Persona anchor: *"Four friends on a Goa trip. One person pays for most things. Nobody wants to do math. Two people don't want to install anything."*

## 4. Product principles

1. **Capture beats features.** If adding an expense takes more than ~5 seconds, we lost.
2. **Explain every number.** Any balance or suggested payment can be traced to the expenses that caused it.
3. **No account needed to participate.** Guests can claim items and settle via a link.
4. **We never hold money.** UPI deep links and QR only. No wallet, no custody, no bank integration.
5. **Edits are visible, never silent.** Append-only history; disputes are first-class.
6. **Money is integers.** Minor units (paise) everywhere. No floats, ever.
7. **Free and ad-free core.** No expense limits.

## 5. Differentiators (the "unique" part)

### D1. "Say it" quick add
Type or dictate: `dinner 1260 paid by me, split with Ayush Pramit, Pushkar skipped`.
- Parsed into a structured **draft** (amount, payer, participants, split method, category, date).
- Always shown for confirmation. Never auto-saved.
- Works with a deterministic fallback parser when the AI service is unavailable or rate-limited.

### D2. Claim links for receipts
Photograph a receipt → items extracted (editable) → share a link → each person taps the items they had; shared items split among claimers; tax/tip/service charge allocated proportionally.
- Guests open the link with no signup (name only).
- Organizer sees live claim progress and unclaimed items; can finalize and the expense is created.

### D3. Explainable settlement ("Why this payment?")
Debt simplification suggests the minimum set of payments. Each suggestion has an **explanation trail**: the expenses and balances that produced it, shown as a short readable story plus a graph view.
- Users can switch simplification **off** per group.

### D4. UPI-native settle up
- "Pay ₹420 to Ayush" → opens UPI intent link (`upi://pay?...`) and shows a QR fallback.
- Payment is recorded as **proposed**; the receiver **confirms** ("Got it") or rejects. We do not claim to verify bank transfers.
- Cash and "other" methods supported the same way.

### D5. Gentle nudges
- AI-assisted reminder drafts in selectable tone (friendly / neutral / playful), delivered via share sheet / WhatsApp deep link. No auto-sending, no spam.
- Per-person nudge cooldown to avoid harassment.

### D6. Trust layer: revisions and disputes
- Every expense edit creates a new revision with author, time, optional reason, and a diff.
- Any member can **dispute** an expense (short thread, status open/resolved). Disputed expenses are flagged but still counted unless the group chooses otherwise.
- Full activity feed.

### D7. Cross-group pair net
Between two people who share several groups, show the **single net amount** across all groups and offer one combined settlement.

### D8. Trip Wrapped
At the end of a trip/event group: total spend, per-person paid vs. owed, category breakdown, biggest expense, "carried the group" and "most reliable payer" style stats (kept light and non-shaming), shareable image/card.

## 6. Scope

### MVP (must ship)
- Auth, profile (name, UPI ID optional), default currency INR.
- Groups with types (trip, home, event, other); invite via link; **guest members**; guest → account claim.
- Expenses: equal / exact / percent / shares splits; multiple payers; categories; date; notes; edit/delete with revisions.
- Pure, tested ledger engine (splits, rounding, balances, simplification with explanations).
- Balances per group and per pair; Settle up with UPI deep link + QR + confirm flow.
- Activity feed.
- Responsive, mobile-first UI; light/dark.

### v1.1
- D1 Say it (text first, voice via browser speech API second).
- D2 Receipt claim links.
- D6 Disputes.
- D5 Nudges.

### v1.2
- D7 Cross-group pair net.
- D8 Trip Wrapped.
- Multi-currency with stored FX rate per expense.
- Recurring expenses (rent, subscriptions).
- PWA install, offline queue for adding expenses.
- CSV export.

### Non-goals
- Holding, moving or verifying money; bank/UPI APIs; payment processing.
- Credit, lending, interest.
- Ads, paid tiers, expense caps.
- Native mobile apps (PWA only).

## 7. Core user flows

**F1 First-run:** sign in → create group (name, type) → add members by name (guests) or invite link → add first expense.
**F2 Add expense (manual):** group → "+" → amount → payer (default me) → participants (default all) → split method (default equal) → save. Target: ≤ 4 taps after typing amount.
**F3 Say it:** group → text box → draft card with editable chips → confirm.
**F4 Receipt claim:** "+" → scan → review items/tax/tip → share link → members claim → organizer finalizes → expense created.
**F5 Settle:** balances → suggestion with "Why?" → Pay via UPI → mark as paid → receiver confirms.
**F6 Dispute:** expense → "Something's off" → note → thread → resolve (author edits, or raiser withdraws).
**F7 Guest join:** open invite/claim link → enter name → participate; later "Save my history" converts guest to account.

## 8. Functional requirements (testable)

- **FR-1** Splits always sum exactly to the expense total. Remainder paise are distributed deterministically (largest-remainder, ties by stable member order).
- **FR-2** Sum of all balances in a group is exactly 0.
- **FR-3** Simplification never increases the number of payments versus the raw debt graph and never changes any member's net balance.
- **FR-4** Every suggested payment has an explanation listing contributing expenses with amounts.
- **FR-5** Expense edit creates a revision; previous revisions are readable; delete is soft.
- **FR-6** All mutations verify the caller is an active member of the group (or holds a valid claim token for claim actions).
- **FR-7** Guests act only via scoped tokens; tokens are unguessable, revocable, and expire.
- **FR-8** AI features degrade gracefully: failure shows the manual form prefilled with whatever was parsed.
- **FR-9** Settlement states: `proposed → confirmed | rejected`. Only the receiver can confirm/reject; the payer can cancel while proposed.
- **FR-10** Nudges rate-limited per (sender, receiver, group).

## 9. Data model (Convex, conceptual)

All amounts: integer minor units + ISO currency code.

- `users` — authId, name, email, avatarUrl, upiId?, defaultCurrency
- `groups` — name, type, currency, simplifyDebts, createdBy, archivedAt?
- `members` — groupId, userId?, displayName, status (`active|guest|left`), role (`owner|member`), claimTokenHash?
- `expenses` — groupId, currentRevision, status (`active|deleted`), createdBy, createdAt
- `expenseRevisions` — expenseId, version, title, totalMinor, currency, fxRate?, date, category, note?, payers[{memberId, amountMinor}], splitMethod, shares[{memberId, owedMinor}], source (`manual|say_it|receipt`), editedBy, reason?
- `receiptSessions` — groupId, expenseId?, imageStorageId?, items[{id, name, priceMinor, qty}], charges[{label, amountMinor}], claims[{itemId, memberId, weight}], shareTokenHash, status (`open|finalized|cancelled`)
- `settlements` — groupId?, fromMemberId, toMemberId, amountMinor, currency, method (`upi|cash|other`), status, upiRef?, createdAt, resolvedAt?
- `disputes` — expenseId, raisedBy, status, messages[{memberId, text, at}]
- `activity` — groupId, actorMemberId, type, payload, createdAt
- `nudges` — groupId, fromMemberId, toMemberId, createdAt

Balances are **derived** from non-deleted expense revisions and confirmed settlements by pure functions. Cache only if profiling proves it necessary.

## 10. Non-functional requirements

- **Performance:** LCP < 2.0 s on mid-range Android over 4G; group page interactive < 1 s after data; bundle budget tracked in CI.
- **Accessibility:** WCAG 2.2 AA; keyboard navigable; no color-only meaning; large tap targets.
- **Security/privacy:** server-side auth checks on every function; secrets never in the repo or client bundle; AI inputs minimized (no emails/UPI IDs sent to AI); receipt images deleted after finalization or 7 days.
- **Reliability:** optimistic UI with rollback; idempotent mutations for retries.
- **Observability:** structured error logging, no PII in logs.
- **i18n-ready:** strings externalized; English first, Hindi/Marathi later.

## 11. Success metrics

- Median time to add an expense ≤ 8 s (manual), ≤ 5 s (Say it).
- ≥ 60% of settle-ups initiated via UPI link complete within 24 h.
- ≥ 30% of members in active groups joined as guests first (validates no-signup friction).
- Dispute rate < 3% of expenses; ≥ 80% resolved in 48 h.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM mis-parses amounts | Always confirm draft; validate with Zod; amounts echoed prominently |
| OCR errors on receipts | Editable item list; totals reconciliation check |
| UPI deep links differ across apps | Test matrix; QR fallback; copy-UPI-ID fallback |
| Guest token leakage | Hashed tokens, expiry, revoke, scope to one group/session |
| Scope creep | Phase gates in `docs/WORKFLOWS.md`; D-features after MVP |

## 13. Open questions

- Auth provider final choice (Clerk vs Convex Auth).
- AI provider and model for parsing/OCR (decide in Phase 7 after cost/latency test).
- Whether "dispute freezes balance impact" should be a group setting.
