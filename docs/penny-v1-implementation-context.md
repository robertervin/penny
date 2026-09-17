# Penny V1 — Implementation Context

## Purpose

This document is a self-contained handoff for another LLM or engineer to begin implementing Penny V1 without needing the original product-discovery conversation.

It captures the current product vision, target user, MVP scope, UX direction, core architecture, V0/V1 build order, allocation-engine boundaries, design language, and acceptance criteria.

---

## 1. Product vision

Penny is a personal wealth-building and life-planning assistant.

> **Penny helps people build wealth and make better financial decisions without needing to become personal-finance experts.**

Most financial products tell users what happened. Penny should help answer:

> **What should I do next with my money, given the life I want?**

Long term, Penny should feel like:

> **A really smart financial friend who already knows your situation.**

Penny is not primarily a budgeting app, brokerage, retirement calculator, or finance dashboard. It is a **financial decision layer** that understands the household, the user's goals, and the tradeoffs between saving, investing, spending, and major life choices.

---

## 2. Core product principles

### Penny should be sophisticated so the user does not have to be

The financial engine can be complex. The UI should be calm and simple.

Default experience:
- one clear recommendation
- one simple explanation
- deeper reasoning only when requested
- detailed math only when requested

### Penny recommends; the human decides and acts

V1 should not automatically move money, trade, or execute recommendations.

Flow:

> Penny recommends → Penny explains → user decides → user acts.

### AI is the interface, not the source of financial truth

Use three layers:

1. **Financial State** — what Penny believes is true about the household.
2. **Deterministic Planning / Allocation Engine** — computes cash availability, goals, routing, scenarios, confidence, and recommendation order.
3. **Penny** — LLM/conversational layer that explains, asks follow-ups, and orchestrates structured UI.

The LLM must not silently invent financial state or do opaque financial math.

### The plan exists to fund the user's life

Penny should not always say “save more.”

Sometimes the right answer should be:

> “Yes, you can afford this.”

or:

> “You can afford it, but waiting four months is materially better.”

Penny should help users confidently save, invest, and spend.

### Quiet when nothing matters

Penny should not manufacture engagement.

Ideal state:

> **Everything looks good. Nothing needs your attention.**

Only surface something when it materially matters.

---

## 3. Initial target users

### Everyday Wealth Builder

- earns decent money
- already saves and invests
- reasonably financially literate
- wants help optimizing surplus, tradeoffs, and life decisions
- does not want another dashboard
- wants long-term optionality and clearer decisions

Core thought:

> “I’m doing pretty well. I want to know whether I’m making the best decisions.”

### Guided Starter

- W-2 employee
- decent income
- already saves
- often uses 401(k), sometimes HSA
- understands financial basics
- does not want to become a finance hobbyist
- often leaves surplus in savings because they do not know the best next destination

Core thought:

> “I save money. Now what?”

The strongest shared problem across early users is:

> **Tell me what to do with the money I have left over.**

---

## 4. Core V1 product promise

> **Penny tells you the next best thing to do with your money, based on your goals, and shows you why.**

A second major job:

> **Penny tells you whether a purchase or life decision fits your plan.**

V1 should support these five user-facing jobs:

1. Understand my finances automatically.
2. Tell me where my next dollar should go.
3. Tell me whether I am on track for my goals.
4. Tell me whether a purchase or decision fits my plan.
5. Explain the recommendation and let me explore alternatives.

---

## 5. High-level architecture

```text
Plaid + user inputs
        ↓
Financial ingestion
        ↓
Canonical Penny financial state
        ↓
Cash-flow interpretation
        ↓
Goals + employer benefits + preferences
        ↓
Deterministic allocation / planning engine
        ↓
Recommendations / routing / scenarios
        ↓
Penny conversation + structured UI
```

Important:

> **The conversation is an interface to the model, not the model itself.**

---

## 6. Build stages

### V0 — Understand

Goal:

> Penny can reconstruct the user's financial life accurately enough that the user says, “Yes, that is basically right.”

Build:
- Plaid connection
- normalized accounts
- transaction synchronization
- transfer handling
- credit-card payment handling
- income interpretation
- recurring expenses
- lifestyle spending
- financial-state model
- user confirmation
- missing-data/confidence system
- Available to Allocate

### V1 — Recommend

Add the first high-confidence recommendation families:
- operating/safety cash
- excess cash
- uncaptured employer match
- high-interest debt
- simple near-term goal funding

Primary output:

> **Your Next Best Move**

### V2 — Route

Build complete Money Routing Plans across:
- safety
- employer match
- goals
- retirement accounts
- taxable investing
- debt

Use tranche allocation and breakpoints.

### V3 — Decide

Add scenarios:
- house
- car
- major purchase
- pay cut
- spouse stops working
- kids
- large home expense
- job loss

Also support:

> “Can I afford this?”

### V4 — Monitor

Re-run plans when financial state changes:
- paycheck changes
- debt disappears
- cash grows
- spending pattern changes
- large inflow
- goal timing changes

Only notify when the recommendation materially changes.

---

## 7. V0 definition of success

V0 is not successful because Plaid connected.

V0 is successful when Penny can estimate:

- recurring take-home income
- baseline lifestyle spending
- irregular lifestyle spending
- required debt service
- investment transfers
- recurring monthly surplus
- total cash
- operating cash
- safety cash
- goal cash
- unallocated cash

and the user says:

> **Yes, that is basically my financial life.**

---

## 8. Plaid / financial ingestion strategy

### Do not let the app depend directly on Plaid schemas

Use:

```text
Plaid
  ↓
Raw source payloads
  ↓
Normalization
  ↓
Penny canonical model
```

### Example Penny account taxonomy

```text
DEPOSITORY_CASH
CREDIT_CARD
TAXABLE_BROKERAGE
EMPLOYER_RETIREMENT
IRA_TRADITIONAL
IRA_ROTH
HSA
MORTGAGE
STUDENT_LOAN
OTHER_DEBT
UNKNOWN
```

Each account can contain:

```text
owner
liquidity
tax_treatment
purpose
include_in_cash_flow
include_in_net_worth
```

Ownership:

```text
mine
spouse
joint
unknown
```

### Transaction sync

Maintain:
- raw source transaction ID
- item/account IDs
- pending/posted state
- created/modified/removed state
- category/source metadata
- merchant/raw name
- dates
- amount
- counterparties where available

Support incremental synchronization.

---

## 9. Cash-flow interpretation

Every posted transaction should eventually receive a Penny-owned interpretation.

### Primary movement type

```text
INCOME
EXPENSE
TRANSFER
DEBT_PAYMENT
INVESTMENT_CONTRIBUTION
REFUND
OTHER
```

Correctly distinguishing movement type matters more than perfect merchant categorization.

### Transfers

Internal transfers must not become spending.

Examples:

```text
Checking → Savings
Checking → Brokerage
Checking → Credit card payment
```

Use deterministic transfer matching based on:
- opposite-signed or mirrored amounts
- same/nearly same amount
- close posting dates
- accounts belonging to the household
- category/source hints
- known financial counterparties

Persist transfer linkage.

### Credit cards

Credit-card purchase:
> Counts as spending.

Credit-card payment from checking:
> Does not count as spending again.

Avoid double counting.

### Income

Detect:
- salary/payroll
- bonus
- reimbursement
- tax refund
- dividends/interest
- other inflows

Each income stream should track:

```text
recurring
frequency
expected_amount_range
stability
```

A one-time bonus should not redefine normal monthly income.

### Expense behavior

Classify real expenses into:

```text
recurring_fixed
recurring_variable
irregular_recurring
one_off
unknown
```

Examples:

```text
rent                → recurring_fixed
groceries           → recurring_variable
annual insurance    → irregular_recurring
vacation            → irregular lifestyle
roof replacement    → one_off
```

---

## 10. Spending model

Maintain two spending concepts.

### Baseline Spending

What a normal month costs.

Examples:
- rent/mortgage
- utilities
- groceries
- normal dining
- transportation
- subscriptions

### True Lifestyle Spending

Baseline plus annualized irregular lifestyle costs.

Examples:
- vacations
- gifts
- maintenance
- annual insurance
- periodic household costs

Long-term planning should rely more heavily on True Lifestyle Spending.

---

## 11. Cash buckets

Do not treat cash as one undifferentiated balance.

Use:

```text
Operating Cash
Safety Cash
Goal Cash
Unallocated Cash
```

Example:

```text
Total cash                  $25,000
- Operating float            $4,000
- Emergency reserve         $12,000
- House fund                 $5,000
-----------------------------------
Available cash to allocate   $4,000
```

---

## 12. Available to Allocate

This is a core Penny metric.

### Monthly

```text
Income
- true lifestyle spending
- required debt service
- planned near-term goal funding
- variability buffer
=
Monthly Available to Allocate
```

### Cash

```text
Cash balance
- safety reserve
- operating cash
- near-term known expenses
- goal cash
=
Available Cash to Allocate
```

Users must be able to ask:

> “How did you calculate this?”

---

## 13. Confirmation layer

Plaid data is not automatically trusted truth.

Penny should show:

> **Here’s what I think your financial life looks like. Check my work.**

Users should be able to correct:
- transfer vs expense
- recurring vs one-time
- ownership
- account purpose
- income source
- cash earmarks
- goal funding
- unusual transactions

Corrections should persist.

When useful, create durable household-specific rules.

Example:

> “That recurring $1,100 Venmo payment is rent.”

Example:

> “Transfers to Fidelity are investments.”

Penny should improve for the household over time.

---

## 14. Confidence and missing data

Important financial fields should have confidence metadata.

Example:

```text
Income                  High
Cash balance            Verified
Lifestyle spending      Medium
Mortgage payment        High
401(k) match            Unknown
```

If missing information could materially change a recommendation, ask rather than guess.

Example:

```text
status: insufficient_information

missing_inputs:
- employer_match
- student_loan_apr
```

---

## 15. Allocation engine

Core question:

> **Given everything Penny knows about this household, where should the next available dollar go, and how confident are we in that answer?**

Use two stages.

### Stage A — Safety gates

Before optimizing:
- cash-flow solvency
- operating cash
- required obligations
- starter reserve
- known near-term expenses
- critical missing information

Do not necessarily require a full six-month reserve before every other action. A starter reserve and full reserve can be different.

### Stage B — Candidate generation

Possible destinations:

```text
maintain operating cash
build starter reserve
build full emergency reserve
capture employer match
pay high-cost debt
fund near-term goal
fund HSA
fund IRA/Roth IRA
additional workplace retirement
taxable brokerage
moderate debt
mortgage
discretionary spending
```

Including discretionary spending is intentional.

---

## 16. Hard vs preference-dependent decisions

### High-confidence / near-dominant

Examples:
- missed employer match
- very high-interest debt
- insufficient operating cash
- insufficient starter reserve
- known near-term obligation
- obvious excess cash

### Preference-dependent

Examples:
- additional 401(k) vs brokerage
- Roth vs traditional
- mortgage prepayment vs investing
- earlier retirement vs larger home
- moderate student loan vs investing

For preference-dependent decisions, explain tradeoffs instead of pretending there is one universal answer.

---

## 17. Tranche allocation

Do not allocate all surplus to one winner.

Allocate until a breakpoint, update state, then re-run.

Example:

```text
$1,000 available

First $120  → 401(k) match
Next $400   → House goal
Next $300   → Roth IRA
Remaining   → Brokerage
```

Loop:

```text
Generate candidates
→ Rank
→ Allocate until breakpoint
→ Update state
→ Re-run
```

Breakpoints include:
- employer match fully captured
- reserve target reached
- goal monthly requirement met
- HSA/IRA limit reached
- debt paid off

---

## 18. Recommendation confidence

Suggested language:

### Very High / High
> “I recommend…”

Examples:
- missing employer match
- 25% credit-card debt

### Moderate
> “I think your best option is…”

Example:
- brokerage vs additional 401(k)

### Preference-dependent
> “Here are the tradeoffs…”

Example:
- investing vs 5% mortgage prepayment

### Highly uncertain
Do not recommend. Model options instead.

Important:

> **The LLM must never choose confidence. The deterministic engine does.**

---

## 19. Recommendation object

Persist recommendations as structured objects.

Example:

```json
{
  "recommendation_id": "...",
  "type": "EXCESS_CASH_TO_BROKERAGE",
  "action": {
    "amount": 800,
    "destination_account_id": "..."
  },
  "confidence": "HIGH",
  "reason_codes": [
    "SAFETY_RESERVE_FUNDED",
    "NEAR_TERM_GOALS_FUNDED",
    "LONG_TERM_CAPITAL_AVAILABLE"
  ],
  "supporting_facts": [],
  "assumptions": [],
  "alternatives": [],
  "plan_effects": {},
  "required_user_action": "TRANSFER_FUNDS"
}
```

Persist the runner-up recommendation too so Penny can answer:

> “Why this instead of X?”

---

## 20. Scenario engine

Scenarios clone the baseline plan.

They must never silently alter the current plan.

```text
Current Plan
        ↓ clone
Scenario
        ↓ modify
Re-run allocation/planning engine
        ↓
Compare
```

Scenario operations:
- save
- rename
- update
- compare
- discard
- adopt as current plan

---

## 21. “Can I afford this?” flow

This should be part of the product direction.

Input can include:

```text
purchase amount
timing
optional financing
optional recurring cost
```

Example:

> “Can I spend $3,500 on a trip this summer?”

Penny temporarily models the purchase, re-runs the plan, and might return:

```text
Yes — this fits your plan.

✓ Safety reserve remains intact
✓ House goal remains on track
✓ Long-term investing is delayed less than one month
```

Offer:

```text
See the impact
Show the math
Try a different amount
```

This is a scenario, not a mutation to the baseline plan.

---

## 22. UX direction

The current UX direction is:

> **Chat-primary, not chat-only.**

This fits Penny better than a traditional financial dashboard because the core value is:
- recommendation
- explanation
- follow-up
- scenario exploration
- tradeoff discussion

However, the persistent financial plan must exist outside chat.

### Primary navigation

Keep it intentionally small:

```text
Penny
Plan
Scenarios
```

Avoid making Accounts, Transactions, Investing, Goals, Budget, or Insights primary navigation. Those reflect software architecture rather than the user's job.

---

## 23. Penny page

This is the primary product experience.

Example:

```text
Penny:
Everything looks good. I found one thing worth considering.

[ Recommendation Card ]

Move $800 to your brokerage account

You have more cash than your current plan requires.

High confidence

[ Why? ] [ Compare options ] [ Not now ]
```

Then the user asks:

> Can I afford a $3,500 trip this summer?

Penny returns a structured affordability card:

```text
Yes — this fits your plan.

✓ Safety reserve remains intact
✓ Home goal stays on track
✓ Investing delayed less than one month

[ See the impact ]
```

---

## 24. Progressive disclosure

Critical UX pattern:

### Level 1 — Default
Simple recommendation or answer.

### Level 2 — Why?
Short explanation.

### Level 3 — Show the math
Detailed calculations and assumptions.

### Level 4 — Full plan / scenario
Persistent structured workspace.

Do not expose detailed finance data until the user asks for it.

---

## 25. Plan page

The Plan page answers:

> **What does Penny currently believe about my financial life, and what strategy are we following?**

Suggested structure:

### Header

```text
Your Plan
Last updated today
Everything is on track
```

### What you're working toward

```text
Home down payment       On track
Family / future kids    Accounted for
Work optionality        ~47–50
Travel / lifestyle      Supported
```

Each row can expand.

### Money routing strategy

```text
Every extra $1,000 currently goes:

$150 → 401(k)
$250 → HSA / retirement
$600 → Brokerage
```

Actions:

```text
Why this order?
Change priorities
```

### Financial foundation

Compact values:
- cash reserve
- monthly lifestyle spending
- Available to Allocate
- debt
- invested assets

Each can expand to calculation detail.

### Assumptions & preferences

Examples:
- target reserve
- house target
- work optionality goal
- risk tolerance
- liquidity preference

Action:

```text
Edit plan assumptions
```

The Plan page should feel calm and inspectable, not like a KPI dashboard.

---

## 26. Scenarios page

The Scenarios page answers:

> **What alternate futures am I considering, and how do they compare?**

Top:

```text
Scenarios
Explore changes without affecting your current plan.
```

Saved scenario examples:

```text
$700k house next year
Take a $40k pay cut
One-income household
```

Each preview should show only the largest effects.

Example:

```text
$700k house next year

Monthly investing: -$1,050
Monthly housing: +$1,300
Work optionality: ~2 years later
```

Actions:

```text
Open
Compare
Delete
```

Primary action:

```text
+ Explore a new scenario
```

---

## 27. Scenario mode in conversation

When exploring a scenario in chat, show persistent context:

```text
Exploring: $700k house next year
Your current plan has not changed.
```

The user can ask:

```text
What if the house were $625k?
What if we waited two years?
What if my spouse stopped working?
```

Actions:

```text
Save scenario
Adopt as current plan
Discard
```

---

## 28. Structured UI inside chat

Chat should orchestrate purpose-built components instead of returning walls of text.

Potential components:

```text
RecommendationCard
AffordabilityCard
ScenarioCard
ScenarioComparison
GoalProjection
MoneyRoutingCard
CalculationDisclosure
MissingInformationPrompt
PlanChangeCard
```

> **Chat is orchestrating UI.**

It is not replacing UI.

---

## 29. Design language

Penny's brand identity is a copper-colored penny/coin character with a cute, simple face.

The mascot should feel:
- friendly
- smart
- approachable
- mature enough for serious financial decisions
- not childish
- not overused

Use Penny more like an assistant avatar than a large marketing illustration.

### Light palette

```text
Primary copper        #B86F44
Deep copper           #8F4F2E
Warm cream bg         #F6F0E8
Soft parchment        #EDE3D6
Primary text          #2B2724
Secondary text        #746B63
Positive green        #4F755F
Warning amber         #C18A42
```

### Dark palette

```text
Background            #171412
Surface               #211C19
Copper accent         #D89467
Primary text          warm off-white
Secondary text        muted warm gray
Positive green        muted/desaturated
```

Copper is the brand color. Green is semantic.

### Visual principles

The UI should feel:
- calm
- warm
- sparse
- trustworthy
- conversational
- mature
- slightly charming

Avoid:
- giant dashboards
- too many cards
- KPI walls
- bright mint fintech gradients
- gamification
- mascot overload
- motivational slogans
- “brighter future” marketing copy inside the product

One key principle:

> **Only one thing should feel loud at a time.**

---

## 30. Initial recommendation families

Focus on getting these exceptionally good:

1. Cash reserve / excess cash
2. 401(k) employer match
3. High-interest debt
4. Near-term goal funding
5. Unallocated recurring cash flow
6. Long-term account routing

Do not try to support every financial strategy immediately.

---

## 31. V1 non-goals

Do not make V1 about:

- individual-stock recommendations
- security picking
- autonomous money movement
- autonomous trading
- advanced tax-loss harvesting
- Roth conversion ladders
- advanced estate planning
- detailed Social Security optimization
- full YNAB-style budgeting
- giant transaction dashboards
- hyper-precise FI claims such as “47.3 years old”
- opaque AI-generated financial math

V1 should primarily answer:

> **Which account / goal should receive the next dollar?**

Not:

> **Which individual security should I buy?**

---

## 32. Trust architecture

Trust comes from:
- confirmed inputs
- visible assumptions
- deterministic calculations
- confidence levels
- source/provenance
- scenario isolation
- persistent user corrections
- progressive disclosure
- no automatic execution
- ability to ask “Why?”
- ability to compare alternatives

Core engineering rule:

> **If Penny cannot deterministically explain why this household was told to put this dollar here instead of somewhere else, the recommendation should not be produced.**

---

## 33. Suggested implementation order

### Phase 1 — Core domain model

Implement:
- User
- Household
- Account
- Transaction
- Holding
- Debt
- IncomeStream
- Goal
- Preference
- EmployerBenefit / retirement-plan data
- FinancialStateSnapshot

### Phase 2 — Plaid ingestion

Implement:
- account linking
- item storage
- cursor/incremental sync
- raw payload storage
- account normalization
- transaction normalization
- pending → posted reconciliation
- reconnect/error handling

### Phase 3 — Money movement intelligence

Implement:
- internal transfer matching
- credit-card payment handling
- investment transfer detection
- income detection
- refunds/reimbursements
- debt payments

Prioritize correctness over merchant categorization.

### Phase 4 — Spending interpretation

Implement:
- recurrence
- fixed vs variable
- irregular recurring
- one-off
- baseline spending
- true lifestyle spending
- persistent user-correction rules

### Phase 5 — Financial-state confirmation

Build:

> **Here’s what I think your financial life looks like. Check my work.**

Allow corrections and durable rules.

### Phase 6 — Available to Allocate

Implement:
- operating cash
- safety reserve
- goal cash
- unallocated cash
- recurring monthly surplus
- lump-sum allocatable cash

### Phase 7 — First allocation rules

Implement:
- starter reserve
- full reserve
- employer match
- high-interest debt
- simple goal funding
- excess-cash recommendation

### Phase 8 — Penny chat interface

Implement:
- conversation
- structured recommendation cards
- “Why?”
- “Show the math”
- user follow-up
- financial-state retrieval
- deterministic engine calls

### Phase 9 — Plan page

Implement:
- goals
- routing strategy
- financial foundation
- assumptions/preferences

### Phase 10 — Scenarios

Implement:
- clone baseline
- mutate scenario
- re-run engine
- compare
- save
- discard
- adopt

---

## 34. V0 acceptance test

Use one real user's transaction history.

Manually establish:

```text
A. recurring take-home income
B. baseline lifestyle spending
C. irregular lifestyle spending
D. exceptional one-offs
E. required debt service
F. transfers/investing
G. recurring monthly surplus
H. allocatable cash
```

Then compare Penny's reconstruction.

It does not need to be perfect. It needs to be trustworthy enough that the user says:

> **Yeah, that is basically right.**

---

## 35. V1 acceptance test

For a real household, Penny should:

1. reconstruct the financial state
2. identify Available to Allocate
3. identify at least one useful recommendation
4. explain why it is recommended
5. show the next-best alternative
6. answer “What happens if I don’t?”
7. let the user explore one scenario
8. leave the baseline plan unchanged unless explicitly adopted

---

## 36. MVP success criteria

The first meaningful version should:

1. understand a household quickly enough that setup feels reasonable
2. build a Money Routing Plan the user agrees with
3. find one genuinely useful thing the user did not already know
4. explain the reasoning convincingly
5. update when important facts change
6. reduce the user's mental burden around money

---

## 37. Product north star

Penny should not primarily answer:

> **How am I doing?**

It should answer:

> **What should I do next, given where I want my life to go?**

And when the user wants to spend:

> **Can I do this without hurting the plan?**

---

## 38. Recommended first engineering milestone

Do not begin by building every screen.

Start here:

> **Take one real Plaid-connected household and produce a trustworthy financial-state snapshot.**

Specifically:

```text
monthly recurring income
baseline spending
true lifestyle spending
required debt service
cash balance
cash buckets
monthly Available to Allocate
Available Cash to Allocate
```

Then build a confirmation experience around it.

Only after this should recommendation logic become the focus.

The quality of:

> “Move $800 to brokerage.”

depends entirely on whether Penny correctly knows:

> “You actually have $800 available.”

---

## 39. Related artifacts

If available in the implementation workspace, also provide:

```text
README.md
allocation-engine.md
```

`allocation-engine.md` contains deeper implementation detail for the routing engine.

This document is intentionally self-contained so implementation can still begin without those files.

---

## 40. Final implementation principle

The product should feel simple because the system underneath is rigorous.

The user might see:

```text
Penny:
I found one thing worth doing.

Move $800 to your brokerage account.

[Why?] [Compare]
```

Behind that message should exist:
- real connected data
- normalized household state
- cash-flow understanding
- goals
- safety rules
- account constraints
- deterministic allocation logic
- recommendation confidence
- alternatives
- scenario support
- auditability

> **Simple on the surface. Deep underneath.**
