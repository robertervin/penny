# Penny V0 — Implementation Plan

## Purpose

This is the bridge between the product vision in
[penny-v1-implementation-context.md](penny-v1-implementation-context.md) /
[allocation-engine.md](allocation-engine.md) and the code that exists today.

The vision docs describe where Penny is going. This document describes **what to build next, in what
order, against the current codebase** to complete **V0 — Understand**.

Scope: V0 only. V1 (Recommend) and beyond are out of scope except where a V0 decision constrains
them.

---

## V0 definition of done

From `penny-v1-implementation-context.md` §7, §34, §38.

For one real Plaid-connected household, Penny can produce a trustworthy financial-state snapshot
containing:

```text
recurring take-home income
baseline lifestyle spending
irregular lifestyle spending (annualized)
true lifestyle spending
required debt service
investment transfers
recurring monthly surplus
total cash
operating cash / safety cash / goal cash / unallocated cash
Monthly Available to Allocate
Available Cash to Allocate
```

Every material value carries **confidence** and an inspectable **calculation trace**, and the user
can correct it.

V0 is successful when the user says:

> Yes, that is basically my financial life.

V0 does **not** include recommendations, routing, the allocation engine, or scenarios.

---

## Where the code is today

The implemented slice is:

```text
Plaid Transactions sync → ledger → 90-day classified Situation → explore/memory via API + agent tools
```

There is no user-facing surface. The SMS gateway and the Messages-for-Business prototype have been
removed; the **desktop app is the day-one surface** and is built after V0. V0 therefore ships as
data, deterministic engines, and API — driven by tests, `tools/link-ui`, and `penny-mcp`.

### Assets that carry forward

| Asset | Why it matters for V0+ |
|---|---|
| EventBridge → SQS → workflow processor, idempotent via `processed_events` | The re-run substrate V4 (Monitor) needs |
| Raw Plaid snapshots in S3, `sync_attempts.payload_ref` | Reproducibility the allocation engine requires |
| `memory_rules` + `corrections` + undo | Already the confirmation layer: durable household corrections that re-trigger interpret |
| `src/agent` determinism boundary | LLM calls deterministic tools; matches the three-layer rule. `requiresConfirmation` + `interceptWrites` already implement propose-then-confirm for the app |
| `src/core/src/explore/` | Becomes "Show the math" / ad-hoc questions |
| Cents-based money math; Plaid normalization at the gateway | Correct foundations |

### Blockers

1. **Credit-card transactions are dropped from spending.** `defaultBucket()` in
   `src/core/src/interpret/classifyTransaction.ts` returns `skipped_non_depository` for any
   non-depository account, and `computeSituation()` skips that bucket. Card *purchases* never reach
   spending totals; a card *payment* out of checking usually slips past the transfer heuristic and
   lands in `operating_outflow`. Card spending is therefore represented only by the lumpy monthly
   payment, with no merchant detail — and a `debt_service` rule on that payment reclassifies ordinary
   lifestyle spending as debt service.
2. **Only the Transactions product is requested.** `PlaidLinkService.createLinkToken` requests
   `[Products.Transactions]`. No holdings, no APR, no minimum payments.
3. **No history depth.** No `days_requested`; interpret reads a fixed 90-day window
   (`INTERPRET_WINDOW_DAYS`). Annual insurance and vacations are invisible, so true lifestyle
   spending is not computable.
4. **No recurrence or income-stream detection.** `recurring_commitments` and `duplicate_candidates`
   are columns that are always empty. Payroll exists only via manual memory rules.
5. **No transfer pair matching.** String/channel heuristics only, so checking → brokerage can count
   as spending.
6. **Flat extrapolation.** Spending is `total / windowDays * 30`, with no baseline vs irregular
   split.
7. **No confidence metadata anywhere.**
8. **No cash buckets, reserve target, or Available to Allocate** — the V0 headline output.
9. **No goals, preferences, employer benefits, or policy config.**

---

## Naming decision

`Situation` is renamed to **`FinancialState`** throughout, to match the vision docs.

The *job* keeps its existing name: `interpret` remains the workflow that rebuilds financial state,
and `HouseholdInterpretRequested` is unchanged. Only the noun changes.

`docs/terminology.md` described the previous model (`Audit` / `Watch` / `Advise` / `Coach` jobs,
`Guidance` umbrella) and has been deleted. `Audit` does not appear in the new vision and the new
navigation is Penny / Plan / Scenarios. Stage 0 writes its replacement before any new code lands, so
subsequent work isn't named against a retired model.

---

## Work stages

Stages are dependency-ordered. Each is independently shippable and testable.

---

### Stage 0 — Naming and doc reconciliation

No behaviour change. Do this first so nothing downstream is named against the old model.

**0.1 Rename `Situation` → `FinancialState`**

Migration `008_rename_situation_to_financial_state.sql` (`007` removed the SMS channel):

```text
situations                    → financial_states
```

Code:

| Current | New |
|---|---|
| `computeSituation()` | `computeFinancialState()` |
| `computeSituationForHousehold()` | `computeFinancialStateForHousehold()` |
| `SituationMetrics` | `FinancialStateMetrics` |
| `SituationRow`, `SituationComputeInput` | `FinancialStateRow`, `FinancialStateComputeInput` |
| `src/core/src/interpret/computeSituation.ts` | `computeFinancialState.ts` |
| `src/api/src/mappers/situation.ts` | `financialState.ts` |
| `GET /api/household/:id/situation` | `.../financial-state` |
| `GET /api/household/:id/situation/breakdown` | `.../financial-state/breakdown` |
| `get_situation`, `get_situation_breakdown` (agent tools) | `get_financial_state`, `get_financial_state_breakdown` |
| `PennyApiClient.getSituation*` | `getFinancialState*` |

No back-compat aliases — there is a single local household and one first-party frontend
(`tools/link-ui`), updated in the same change.

**0.2 Write the replacement `docs/terminology.md`**

The old file is deleted. The new one covers only the current model.

Retire: `Audit`, `Watch`, `Coach`, `Guidance`, `Situation`.

Add: `Financial State`, `Confidence`, `Provenance`, `Cash buckets`, `Available to Allocate`,
`Goals`, `Preferences`, `Employer Benefits`, `Policy`, `Money Routing Plan`, `Recommendation`,
`Next Best Move`, `Scenario`.

Keep: `Ledger`, `Household`, `Memory`, `Correction`, `Sync`, `Interpret`, `Explore`, `Channel`,
`Thread`, `Turn`.

Update the terminology link and package table in `README.md`.

**Exit:** tests green, Link UI works against renamed routes, terminology doc describes only the
current model.

---

### Stage 1 — Ingestion depth

Nothing downstream can be correct without this. It is also the only stage that requires user action
(re-linking institutions).

**1.1 Request full transaction history**

Add to `PlaidLinkService.createLinkToken`:

```ts
transactions: { days_requested: 730 }
```

730 days is the Plaid maximum. Institutions vary in what they actually return; record what was
received so downstream metrics know their real window.

**1.2 Add Plaid products: Investments and Liabilities**

Needed for debt prioritization (APR, minimum payment) and long-term account routing (holdings,
contribution YTD).

```ts
products: [Products.Transactions]
required_if_supported_products: [Products.Liabilities, Products.Investments]
```

Using `required_if_supported_products` rather than `products` avoids excluding institutions that
don't support them.

New tables:

```text
securities        ticker, name, type, cusip/isin, close_price, as_of
holdings          account_id, security_id, quantity, cost_basis_cents,
                  value_cents, as_of, sync_attempt_id
liabilities       account_id, kind, apr_percent, minimum_payment_cents,
                  next_payment_due_date, origination_date, original_principal_cents,
                  remaining_term_months, is_overdue, as_of
```

Extend the sync workflow to call `investmentsHoldingsGet` and `liabilitiesGet` where the item
supports them, and persist alongside the existing balance snapshot.

> **Requires re-link.** Products are fixed at link time. The existing Chase and Huntington items
> must be re-linked (or run through Plaid update mode) to gain Investments/Liabilities.

**1.3 Plaid webhook handler**

`webhook_events` exists in the schema with no reader or writer. Add `POST /api/plaid/webhook`
handling:

| Webhook | Action |
|---|---|
| `SYNC_UPDATES_AVAILABLE` | publish `PlaidSyncRequested` (incremental) |
| `HISTORICAL_UPDATE_AVAILABLE` | publish `PlaidSyncRequested` (backfill) |
| `DEFAULT_UPDATE` | publish `PlaidSyncRequested` (incremental) |
| `ITEM_LOGIN_REQUIRED` | mark item `status = reauth_required` |

This also fixes the failure seen during local testing, where Huntington's initial sync returned
balances but zero transactions because Plaid had not finished its historical pull. Verify the raw
body signature before acting on it.

**1.4 Account normalization**

`accounts.type` / `accounts.subtype` currently store raw Plaid strings, and interpret branches on
`"depository"` / `"credit"`. Introduce the Penny taxonomy from
`penny-v1-implementation-context.md` §8:

```text
DEPOSITORY_CASH  CREDIT_CARD  TAXABLE_BROKERAGE  EMPLOYER_RETIREMENT
IRA_TRADITIONAL  IRA_ROTH     HSA                MORTGAGE
STUDENT_LOAN     OTHER_DEBT   UNKNOWN
```

Add per-account attributes:

```text
penny_type          (taxonomy above)
owner               mine | spouse | joint | unknown
liquidity           liquid | restricted | illiquid
tax_treatment       taxable | tax_deferred | tax_free | n/a
purpose             operating | savings | investing | debt | unknown
include_in_cash_flow
include_in_net_worth
```

Keep `plaid_type` / `plaid_subtype` alongside for debugging and re-derivation. `include_in_runway`
is superseded by `include_in_cash_flow` plus the cash-bucket model in Stage 7.

**Exit:** a re-linked household has ≥12 months of transactions, holdings and liability rows where
supported, normalized account types, and webhook-driven incremental sync.

---

### Stage 2 — Money-movement correctness

Vision docs §9 / Phase 3. Fixes the credit-card defect and stops double counting.

**2.1 Replace buckets with movement types**

`ClassifiedBucket` becomes a movement type plus an independent set of flags:

```text
INCOME  EXPENSE  TRANSFER  DEBT_PAYMENT  INVESTMENT_CONTRIBUTION  REFUND  OTHER
```

Correct movement typing matters more than merchant categorization. The memory-rule overlay keeps its
current precedence (override → rule → heuristic → default); only the target vocabulary changes.

**2.2 Count credit-card purchases as spending**

- Delete the `skipped_non_depository` short-circuit for credit accounts.
- Card purchase → `EXPENSE`.
- Card payment from a household depository account → `DEBT_PAYMENT`, and excluded from lifestyle
  spending because the underlying purchases are already counted.
- Interest and fees → `EXPENSE`.

This is the single highest-value correctness fix in V0. For the current test household, Chase is
credit cards holding 103 of 185 transactions.

**2.3 Deterministic transfer pair matching**

Replace the string heuristics with real pairing. Candidate criteria:

- opposite-signed or mirrored amounts
- same or near-same absolute amount (tolerance for fees)
- posting dates within a small window (±3–5 days)
- both accounts belong to the household
- category / `payment_channel` hints as tiebreakers

Persist linkage so it is inspectable and correctable:

```text
transfer_links   id, household_id, from_transaction_id, to_transaction_id,
                 match_method, confidence, created_at
```

Covers checking → savings, checking → brokerage, checking → card.

**2.4 Investment contribution detection**

A transfer whose counterparty account is `TAXABLE_BROKERAGE`, `EMPLOYER_RETIREMENT`, `IRA_*`, or
`HSA` becomes `INVESTMENT_CONTRIBUTION`, not spending. Where the destination is not a linked
account, fall back to known-counterparty name matching and mark lower confidence.

**2.5 Refunds and reimbursements**

Negative-amount expenses matching a prior expense at the same merchant within a window become
`REFUND` and net against that merchant rather than counting as income.

**Exit:** for the test household, total spending reconciles against card statements; no
transfer, card payment, or brokerage contribution appears as lifestyle spending; unit tests cover
each movement type.

---

### Stage 3 — Recurrence and income streams

Vision docs Phase 4. Populates the two columns that have always been empty.

**3.1 Recurrence detection**

Group by normalized merchant / raw name, then detect cadence from inter-arrival clustering:

```text
weekly  biweekly  semimonthly  monthly  quarterly  semiannual  annual  irregular
```

Record cadence, amount stability (mean/variance), occurrence count, last seen, and next expected
date. Populate `recurring_commitments`.

Amount stability drives the `recurring_fixed` vs `recurring_variable` split in 3.3, and annual /
semiannual cadence is what makes true lifestyle spending possible in Stage 4.

**3.2 Income streams**

```text
income_streams   id, household_id, account_id, label, source_type,
                 recurring, frequency, expected_amount_min_cents,
                 expected_amount_max_cents, stability, confidence,
                 last_seen_at, is_active
```

`source_type`: `salary | bonus | reimbursement | tax_refund | dividend | interest | other`.

A one-time bonus must not redefine normal monthly income — only `recurring` streams contribute to
recurring take-home. This replaces payroll-by-manual-memory-rule; existing `payroll` rules become
confirmations that raise a detected stream's confidence.

**3.3 Expense behaviour classes**

```text
recurring_fixed  recurring_variable  irregular_recurring  one_off  unknown
```

**Exit:** detected income streams and recurring commitments for the test household, hand-checked
against the real history.

---

### Stage 4 — Spending model

Vision docs §10.

- **Baseline spending** — `recurring_fixed` + `recurring_variable`, normalized monthly, computed
  over a trailing ~3 months.
- **True lifestyle spending** — baseline plus annualized `irregular_recurring`, computed over the
  longest reliable window (target 12–24 months, depends on Stage 1.1).
- **One-offs** are excluded from both and surfaced separately for user confirmation, since
  "exceptional" is a judgement the user has to make.

Replace the single `INTERPRET_WINDOW_DAYS` constant: each metric declares the window it needs, and
records the window actually available so confidence can degrade when history is short.

**Exit:** baseline and true lifestyle spending differ in the expected direction and the gap is
explainable line by line.

---

### Stage 5 — Confidence and provenance

Vision docs §14. Build the primitive early; populate it as metrics land.

```ts
type Confidence = "verified" | "high" | "medium" | "low" | "unknown";
```

- `verified` — user confirmed, or directly from institution
- `high` / `medium` / `low` — inference quality, degraded by short history or thin sample
- `unknown` — no basis

Every material field of `FinancialState` carries confidence plus provenance (`plaid` / `inferred` /
`user_confirmed`) and a **calculation trace**: the inputs and intermediate steps that produced it.
The trace is what answers "How did you calculate this?" without the LLM reconstructing arithmetic.

Add the blocking output shape now, since Stage 7 and V1 both depend on it:

```json
{
  "status": "insufficient_information",
  "missing_inputs": [
    { "field": "employer_match", "reason": "..." }
  ]
}
```

**Exit:** every metric in the V0 output carries confidence, provenance, and a trace; a metric
computed from 2 months of history reports lower confidence than one computed from 18.

---

### Stage 6 — Household inputs

Plaid cannot supply these, and Stage 7 needs them. Ask only for what is missing.

```text
goals               id, household_id, type, name, target_amount_cents,
                    current_funding_cents, target_date, priority,
                    date_flexibility, amount_flexibility,
                    minimum_acceptable_amount_cents, minimum_acceptable_date

preferences         household_id, emergency_fund_months_target,
                    liquidity_preference, risk_tolerance, debt_aversion,
                    spending_preference, wants_prescriptive_advice,
                    allows_execution

employer_benefits   id, household_id, person_id, retirement_plan_available,
                    employee_contribution_rate, employer_match_rate,
                    employer_match_max_employee_rate, match_vested,
                    hsa_eligible, hsa_employee_contribution_ytd_cents,
                    hsa_employer_contribution_annual_cents
```

**Policy configuration** — versioned, loaded through one module, never scattered as inline
thresholds (`allocation-engine.md`, "Policy Configuration"):

```text
src/core/src/policy/
  reserve-policy.json      ← V0 needs this one
  debt-policy.json         ← V1
  tax-policy-2026.json     ← V1
  routing-policy.json      ← V2
```

V0 uses only `reserve-policy.json` (starter reserve floor, full reserve months, operating-cash
policy). Creating the loader and the directory now prevents thresholds from leaking into metric code
later.

**Exit:** goals, preferences, and benefits are readable and writable via API; reserve policy is
loaded from config with no hardcoded thresholds in metric code.

---

### Stage 7 — Cash buckets and Available to Allocate

The V0 headline output. Vision docs §11, §12.

**7.1 Cash buckets**

```text
Operating Cash    from pay-cycle timing + upcoming known bills
Safety Cash       preferences.emergency_fund_months_target × essential spending,
                  floored by reserve-policy starter reserve
Goal Cash         near-term goal funding already set aside
Unallocated Cash  the remainder
```

Track the **starter reserve** and **full reserve** separately — `allocation-engine.md` Gate 4 is
explicit that a household should not have every opportunity blocked until a full six-month reserve
exists.

**7.2 Monthly Available to Allocate**

```text
recurring take-home income
- true lifestyle spending
- required debt service
- planned near-term goal funding
- variability buffer
= Monthly Available to Allocate
```

**7.3 Available Cash to Allocate**

```text
cash balance
- safety reserve
- operating cash
- near-term known expenses
- goal cash
= Available Cash to Allocate
```

**7.4 Traces**

Both figures store their full input set per Stage 5, and are exposed through a deterministic agent
tool so "How did you calculate this?" is answered from stored values.

**Exit:** both figures computed for the test household with a line-by-line derivation the user can
read.

---

### Stage 8 — Confirmation experience

Vision docs Stage 4, §13. "Here's what I think your money looks like. Check my work."

**8.1 Review endpoint**

`GET /api/household/:id/financial-state/review` returns the confirmable estimate table — each row a
metric with value, confidence, provenance, and trace.

**8.2 Correction surface**

- Expose **transaction overrides**: the table and read path exist, but there is no write path today.
- Add metric-level overrides ("my take-home is actually X"), stored as corrections so they persist
  and re-trigger interpret.
- Support the correction verbs from §13: transfer vs expense, recurring vs one-time, ownership,
  account purpose, income source, cash earmark, ignore.
- Offer rule promotion when a correction generalizes ("transfers to Fidelity are investments"),
  reusing the existing `memory_rules` machinery.

**8.3 Surface**

Out of scope for V0. The desktop app is the day-one surface and is built after the data work lands;
V0 proves the review and correction API through tests and `tools/link-ui`.

**Exit:** every V0 metric is correctable, corrections persist across re-interpret, and generalizable
corrections become rules.

---

### Stage 9 — V0 acceptance test

Vision docs §34. This is the gate, not an afterthought.

1. Hand-label the real Chase + Huntington history into the §34 categories:

```text
A recurring take-home income
B baseline lifestyle spending
C irregular lifestyle spending
D exceptional one-offs
E required debt service
F transfers / investing
G recurring monthly surplus
H allocatable cash
```

2. Commit the labels as a fixture and assert Penny's reconstruction against them with tolerance
   bands, not exact equality.
3. Track per-category drift over time so later changes can't silently regress interpretation.

**Exit:** the fixture passes within tolerance, and the user agrees the reconstruction is basically
right.

---

## Cross-cutting rules

- **Determinism boundary holds.** Every new metric gets a deterministic tool. The LLM never does
  financial arithmetic in prose. This is what the `run_explore_query` tool already models.
- **No hardcoded policy.** Thresholds live in `src/core/src/policy/`.
- **Reproducibility.** Persist enough state that any computed figure can be regenerated from a
  stored snapshot plus a policy version.
- **Confidence over guessing.** If a missing input would materially change a downstream
  recommendation, return `insufficient_information` rather than assuming.
- **Migrations are forward-only.** Next number is `008`. There is one local household and no
  external API consumers, so back-compat shims are not warranted.
- **No user-facing surface in V0.** Correctness is proven by tests and API responses, not screens.

---

## Open questions

1. **Re-link vs fresh start.** Investments and Liabilities require re-linking Chase and Huntington.
   Re-link in place, or reset the local database and start clean once ingestion is correct?
2. **Reserve policy defaults.** What starter reserve floor and full reserve months should
   `reserve-policy.json` ship with before the user has set preferences?
3. **Spouse / joint ownership.** The account model has an `owner` field and the household model
   assumes multiple people. Is V0 single-person, with joint ownership deferred?

---

## Out of scope for V0

Recommendations, candidate generation, safety gates, tranche allocation, the Money Routing Plan,
Next Best Move, confidence-rated recommendation objects, scenarios, projections, and affordability
checks. All land in V1+ and are specified in [allocation-engine.md](allocation-engine.md).

V0 exists so those are worth building: the quality of "move $800 to brokerage" depends entirely on
whether Penny correctly knows that $800 is available.
