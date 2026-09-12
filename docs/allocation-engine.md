# Penny Allocation Engine

## Purpose

The Allocation Engine is the deterministic decision system at the center of Penny.

Its core job is:

> **Given everything Penny knows about a household, where should the next available dollar go — and how confident are we in that answer?**

The Allocation Engine should support:

- recurring monthly surplus
- lump-sum cash
- raises
- bonuses
- debt payoff events
- new recurring expenses
- major purchase scenarios
- changes to household goals
- changes to income
- changes to savings targets
- plan comparisons

The engine must produce recommendations that are:

- explainable
- auditable
- conservative
- goal-aware
- deterministic
- confidence-rated
- safe when data is incomplete

The LLM must **not** decide where money goes.

The LLM should only:

- explain engine outputs
- answer questions about engine outputs
- summarize tradeoffs
- ask for missing user inputs
- create understandable language around deterministic calculations

---

# Product Principle

The Allocation Engine should follow this principle:

> **Penny optimizes within what it knows. It asks when important information is missing. It shows tradeoffs when there is no objectively correct answer. And it never manufactures certainty.**

---

# High-Level Architecture

```text
Financial State
+ Goals
+ Preferences
+ Constraints
+ Tax / Policy Configuration
+ Data Confidence
        ↓
Allocation Engine
        ↓
Candidate Actions
        ↓
Safety Gates
        ↓
Eligibility Rules
        ↓
Hard-Priority Rules
        ↓
Opportunity Ranking
        ↓
Tranche Allocation
        ↓
Routing Plan
+ Next Best Move
+ Confidence
+ Alternatives
+ Missing Data
+ Explanation Inputs
```

---

# Core Engine Responsibilities

The Allocation Engine is responsible for:

1. determining whether money is actually available to allocate
2. protecting short-term liquidity
3. identifying mandatory or near-mandatory actions
4. generating feasible destinations for the next dollar
5. ranking those destinations
6. allocating cash incrementally until the next breakpoint
7. recalculating after each allocation
8. identifying the next best move
9. preserving the best alternative recommendation
10. returning confidence and supporting facts
11. stopping when critical information is missing
12. detecting incompatible goals
13. rerunning under scenario states

---

# Core Input Model

The exact implementation language can vary, but the engine should conceptually receive a structure similar to:

```json
{
  "household": {},
  "cash_flow": {},
  "accounts": [],
  "debts": [],
  "goals": [],
  "preferences": {},
  "benefits": {},
  "tax_context": {},
  "data_confidence": {},
  "scenario": null
}
```

---

# Financial State

## Household

Suggested fields:

```json
{
  "household_id": "uuid",
  "primary_user_age": 31,
  "spouse_age": 30,
  "marital_status": "married",
  "dependents": 0,
  "state": "MI",
  "employment_type": "w2",
  "spouse_employment_type": "w2"
}
```

---

# Cash Flow State

Suggested fields:

```json
{
  "monthly_take_home_income": 8200,
  "monthly_gross_income": 12000,
  "monthly_baseline_spending": 4200,
  "monthly_true_lifestyle_spending": 5100,
  "monthly_required_debt_service": 600,
  "monthly_goal_funding": 900,
  "monthly_variability_buffer": 300,
  "monthly_available_to_allocate": 1300,
  "cash_available_to_allocate": 5000,
  "confidence": "high"
}
```

---

# Account Model

Suggested account types:

- checking
- savings
- money_market
- brokerage
- 401k
- 403b
- 457
- traditional_ira
- roth_ira
- hsa
- pension
- other_investment

Suggested schema:

```json
{
  "account_id": "uuid",
  "type": "401k",
  "balance": 38000,
  "institution": "Fidelity",
  "tax_treatment": "tax_deferred",
  "liquidity": "restricted",
  "contribution_ytd": 4000,
  "annual_contribution_limit": 24500,
  "is_employer_plan": true,
  "data_source": "plaid",
  "confidence": "high"
}
```

---

# Debt Model

Suggested debt types:

- credit_card
- student_loan
- auto_loan
- personal_loan
- mortgage
- heloc
- other

Suggested schema:

```json
{
  "debt_id": "uuid",
  "type": "student_loan",
  "balance": 12000,
  "apr": 0.057,
  "minimum_payment": 310,
  "remaining_term_months": 48,
  "prepayment_penalty": false,
  "confidence": "high"
}
```

---

# Employer Benefits Model

Suggested fields:

```json
{
  "retirement_plan": {
    "available": true,
    "employee_contribution_rate": 0.04,
    "employer_match_rate": 1.0,
    "employer_match_max_employee_rate": 0.06,
    "employer_match_vested": true
  },
  "hsa": {
    "eligible": true,
    "employee_contribution_ytd": 1500,
    "employer_contribution_annual": 1000
  }
}
```

---

# Goal Model

Goals must be real financial constraints, not simple tags.

Suggested schema:

```json
{
  "goal_id": "uuid",
  "type": "home_purchase",
  "name": "Buy a house",
  "target_amount": 80000,
  "current_funding": 25000,
  "target_date": "2030-06-01",
  "priority": "high",
  "date_flexibility": "medium",
  "amount_flexibility": "medium",
  "minimum_acceptable_amount": 60000,
  "minimum_acceptable_date": "2031-06-01"
}
```

Suggested priority values:

- critical
- high
- medium
- low

Suggested flexibility values:

- none
- low
- medium
- high

---

# Preference Model

Suggested fields:

```json
{
  "emergency_fund_months_target": 6,
  "liquidity_preference": "medium",
  "risk_tolerance": "medium_high",
  "retire_early_priority": "high",
  "home_priority": "medium",
  "debt_aversion": "medium",
  "spending_preference": "balanced",
  "wants_prescriptive_advice": true,
  "allows_execution": false
}
```

The engine should not assume that maximizing terminal wealth is always the goal.

---

# Data Confidence

Critical inputs should have confidence metadata.

Suggested values:

- verified
- high
- medium
- low
- unknown

Example:

```json
{
  "monthly_income": "high",
  "monthly_spending": "medium",
  "employer_match": "verified",
  "student_loan_apr": "high",
  "house_goal_target": "verified"
}
```

Critical low-confidence data may block a recommendation.

---

# Cash Buckets

Penny should divide cash conceptually into four buckets.

## Operating Cash

Money needed for:

- current bills
- pay-cycle timing
- short-term operating variability

## Safety Cash

Emergency reserve.

## Goal Cash

Money reserved for known near-term goals.

Examples:

- house
- wedding
- car
- travel
- renovation
- tax bill

## Unallocated Cash

Cash that is actually available for optimization.

Formula:

```text
Cash Balance
- Operating Cash Requirement
- Safety Cash Requirement
- Known Near-Term Goal Cash
= Available Cash to Allocate
```

---

# Monthly Available to Allocate

Suggested formula:

```text
Monthly Take-Home Income
- True Lifestyle Spending
- Required Debt Service
- Required Goal Funding
- Variability Buffer
= Monthly Available to Allocate
```

The calculation should be transparent and inspectable.

---

# Spending Definitions

The engine should maintain two spending concepts.

## Baseline Spending

Typical month-to-month cost of life.

Examples:

- housing
- groceries
- utilities
- transportation
- ordinary entertainment
- recurring subscriptions

## True Lifestyle Spending

Baseline spending plus annualized irregular lifestyle costs.

Examples:

- travel
- gifts
- annual insurance
- home maintenance
- periodic large purchases
- recurring annual subscriptions

Long-term planning should prefer True Lifestyle Spending.

---

# Stage A: Safety Gates

The engine should run safety gates before ranking optimization opportunities.

## Gate 1: Cash-Flow Solvency

Question:

> Is normal spending consistently greater than income?

If yes:

- do not recommend increased investing
- identify deficit
- preserve liquidity
- surface spending / income issue
- allow only mandatory obligations and safety restoration

Possible output:

```json
{
  "status": "blocked",
  "reason": "negative_cash_flow"
}
```

---

## Gate 2: Operating Cash

Question:

> Does the household have enough cash to safely make it through upcoming bills and pay cycles?

If no:

- preserve cash
- do not allocate excess to investing
- recommend rebuilding operating cash

---

## Gate 3: Required Obligations

Question:

> Are all required minimum debt payments and known mandatory expenses funded?

If no:

- fund required obligation first

---

## Gate 4: Starter Emergency Buffer

The engine should distinguish:

- starter reserve
- full reserve target

A household should not necessarily delay all high-value opportunities until a full 6-month reserve exists.

Suggested concept:

```text
Starter Reserve:
minimum amount required before meaningful optimization can occur

Full Reserve:
user-confirmed target
```

Possible starter reserve policy:

```text
max(
  1 month essential spending,
  upcoming known obligations,
  minimum policy floor
)
```

Exact policy should be configurable.

---

## Gate 5: Known Near-Term Obligation

Examples:

- tax bill
- wedding deposit
- car replacement
- medical expense
- planned move

If required cash is not funded:

- reserve necessary amount before allocating to long-term accounts

---

## Gate 6: Data Quality

If missing or uncertain data could materially change the recommendation:

- stop
- request information

Example:

```json
{
  "status": "insufficient_information",
  "missing_inputs": [
    "employer_401k_match",
    "student_loan_apr"
  ],
  "why_needed": "Either input could change the highest-priority recommendation."
}
```

---

# Stage B: Candidate Generation

Once safety gates pass, generate all eligible uses of the next dollar.

Initial candidate actions:

1. maintain cash
2. build emergency reserve
3. capture employer 401(k) match
4. pay high-cost debt
5. fund near-term goal
6. fund HSA
7. fund IRA / Roth IRA
8. increase workplace retirement contribution
9. fund taxable brokerage
10. accelerate moderate-cost debt
11. accelerate mortgage
12. increase discretionary spending

Not every candidate is eligible for every household.

---

# Candidate Eligibility

Every candidate action should implement:

```text
isEligible(financialState, policyConfig) -> boolean
```

It should also return:

```text
whyEligible
whyNotEligible
missingInputs
nextBreakpoint
```

Example for Roth IRA:

```text
eligible if:
- account / contribution legally available
- contribution capacity remains
- liquidity needs are satisfied
- user has investable surplus
- tax / income eligibility is known
```

---

# Hard Rules vs. Preference-Dependent Decisions

## Hard / High-Confidence Opportunities

Examples:

- uncaptured employer match
- extreme-interest revolving debt
- insufficient operating cash
- insufficient starter reserve
- known near-term obligation not funded
- obvious excess unallocated cash

These can support strong recommendation language.

---

## Preference-Dependent Decisions

Examples:

- 5% mortgage vs investing
- Roth vs additional traditional 401(k)
- additional 401(k) vs brokerage
- low-interest student debt vs investing
- earlier retirement vs nicer house
- higher savings vs more lifestyle spending

These should:

- compare tradeoffs
- use user preferences
- use lower confidence
- preserve best alternative
- avoid false certainty

---

# Candidate Evaluation Dimensions

Each eligible candidate may be evaluated across:

- financial value
- certainty
- goal alignment
- urgency
- tax value
- liquidity impact
- risk
- optionality
- user preference alignment
- data confidence

Important:

> Do not rely on one naive weighted score.

Use:

1. hard-priority rules
2. eligibility rules
3. policy tiers
4. ranking within comparable candidates

Some actions should dominate others regardless of soft preference scoring.

---

# Allocation by Tranches

The engine should allocate incrementally, not send all available money to one destination.

Core loop:

```text
1. Build current state
2. Generate eligible candidates
3. Rank candidates
4. Select top candidate
5. Allocate only until that candidate's next breakpoint
6. Update financial state
7. Re-run candidate generation
8. Continue until no allocatable cash remains
```

---

# Breakpoints

Each action must define the next breakpoint.

Examples:

## Employer Match

Breakpoint:

```text
employee contribution rate required to capture full match
```

## Emergency Reserve

Breakpoint:

```text
full reserve target
```

## Goal Funding

Breakpoint:

```text
required monthly contribution to remain on target
```

## HSA

Breakpoint:

```text
annual legal contribution capacity remaining
```

## IRA

Breakpoint:

```text
annual legal contribution capacity remaining
```

## Debt

Breakpoint:

```text
debt balance paid off
```

## Brokerage

Often has no legal breakpoint.

---

# Example Tranche Allocation

Input:

```text
Available to Allocate: $1,000/month
```

Possible result:

```text
$0–$120
→ Increase 401(k) to capture full match

$120–$520
→ Fund house goal

$520–$820
→ Roth IRA

$820–$1,000
→ Brokerage
```

The user may only see the top recommendation initially.

The engine should retain the full routing sequence.

---

# Recurring Cash and Lump Sums

Use the same engine for both.

## Recurring Surplus

Example:

```text
$700/month available
```

Possible route:

```text
$200 → 401(k)
$300 → house fund
$200 → Roth IRA
```

## Lump Sum

Example:

```text
$15,000 bonus
```

Possible route:

```text
$3,000 → complete emergency reserve
$5,000 → house goal
$7,000 → long-term investing
```

---

# Event-Driven Rerouting

The engine should rerun when material financial state changes.

Examples:

## Raise

```text
monthly_available_to_allocate += net_raise
```

## Debt Payoff

```text
monthly_required_debt_service -= old_payment
monthly_available_to_allocate += old_payment
```

## New Child

Possible effects:

- spending increase
- insurance change
- goal changes
- reserve target increase
- reduced future income

## New House Goal

Add goal and rerun.

## Large Purchase

Reduce cash and/or increase debt, then rerun.

## Income Loss

Reduce income, rerun safety gates immediately.

---

# Goal Funding Logic

Suggested simplified calculation:

```text
Remaining Goal Funding
= Target Amount - Current Funding

Required Monthly Funding
= Remaining Goal Funding / Remaining Months
```

More advanced implementations may include:

- expected return on goal assets
- contribution timing
- taxes
- inflation
- funding uncertainty

For early MVP, conservative simple calculations are acceptable if clearly explained.

---

# Incompatible Goal Detection

If:

```text
required goal funding
+ required obligations
+ safety requirements
> available income
```

the engine should not fake a solution.

Return:

```json
{
  "status": "goal_conflict",
  "conflicting_goals": [
    "home_purchase",
    "retirement_savings"
  ]
}
```

Penny should then explain tradeoffs.

Example:

> Your current cash flow cannot fully support both the four-year house target and your current long-term investing plan.

Possible alternatives:

- delay goal
- reduce target
- reduce another goal contribution
- increase income
- reduce spending
- accept a later financial independence date

---

# Debt Policy

Do not hardcode debt logic across the application.

Use a versioned policy configuration.

Example:

```json
{
  "debt_policy": {
    "very_high_apr_threshold": 0.15,
    "high_apr_threshold": 0.09,
    "medium_apr_threshold": 0.05
  }
}
```

The exact values above are placeholders and should be treated as configurable product policy.

Suggested behavior:

## Very High APR

Strongly prioritize.

## High APR

Usually prioritize before discretionary long-term investing.

## Medium APR

Compare against:

- liquidity
- tax-advantaged capacity
- user goals
- guaranteed return
- risk tolerance

## Low APR

Usually lower priority.

## Mortgage

Treat as preference-dependent unless unusually expensive or required for liquidity/risk reasons.

---

# Tax / Contribution Policy Layer

Tax and contribution rules should be versioned by tax year.

Example:

```json
{
  "tax_year": 2026,
  "401k_limit": null,
  "ira_limit": null,
  "hsa_individual_limit": null,
  "hsa_family_limit": null,
  "roth_income_limits": {},
  "catch_up_rules": {},
  "tax_brackets": {}
}
```

Do not hardcode these values throughout application logic.

Load policy configuration through one centralized source.

---

# Recommendation Confidence Framework

Suggested confidence values:

- very_high
- high
- moderate
- low
- insufficient_information

---

## Very High Confidence

Used when:

- recommendation is near-dominant
- inputs are verified/high-confidence
- little meaningful preference ambiguity exists

Examples:

- capture employer match
- pay extreme-interest credit-card debt
- restore operating liquidity

Suggested language:

> I recommend...

---

## High Confidence

Used when:

- recommendation is strongly supported
- assumptions are limited
- reasonable alternatives are clearly weaker

Suggested language:

> I recommend...

---

## Moderate Confidence

Used when:

- multiple reasonable options exist
- tax or future-return assumptions matter
- user preferences influence outcome

Suggested language:

> I think your best option is...

---

## Low Confidence

Used when:

- outcome is highly preference-dependent
- forecast uncertainty is meaningful
- competing alternatives are similarly reasonable

Suggested language:

> Here are the tradeoffs...

---

## Insufficient Information

Used when:

- critical input is missing
- bad input could reverse recommendation

Suggested behavior:

Ask for missing information.

---

# Recommendation Schema

Suggested internal object:

```json
{
  "recommendation_id": "uuid",
  "type": "capture_401k_match",

  "action": {
    "account_id": "uuid",
    "account_type": "401k",
    "current_contribution_rate": 0.04,
    "recommended_contribution_rate": 0.06,
    "monthly_cash_flow_effect": -94
  },

  "confidence": "very_high",

  "reason_codes": [
    "uncaptured_employer_match",
    "adequate_emergency_reserve",
    "goal_funding_remains_on_track"
  ],

  "supporting_facts": [],

  "assumptions": [],

  "alternatives": [
    {
      "type": "increase_house_fund",
      "rank": 2,
      "reason_not_selected": "employer_match_has_higher_near-certain_value"
    }
  ],

  "plan_effects": {
    "employer_match_gain_annual": 1850,
    "house_goal_status": "on_track"
  },

  "required_user_action": true
}
```

---

# Full Routing Plan Schema

Suggested internal representation:

```json
{
  "monthly_available_to_allocate": 1000,

  "routing_tranches": [
    {
      "start_amount": 0,
      "end_amount": 120,
      "destination": "401k",
      "reason": "capture_employer_match",
      "confidence": "very_high"
    },
    {
      "start_amount": 120,
      "end_amount": 520,
      "destination": "home_goal",
      "reason": "maintain_goal_schedule",
      "confidence": "high"
    },
    {
      "start_amount": 520,
      "end_amount": 820,
      "destination": "roth_ira",
      "reason": "long_term_tax_advantaged_savings",
      "confidence": "moderate"
    },
    {
      "start_amount": 820,
      "end_amount": 1000,
      "destination": "brokerage",
      "reason": "remaining_long_term_surplus",
      "confidence": "moderate"
    }
  ]
}
```

---

# Preserve the Runner-Up

Every recommendation should retain the next-best alternative.

This supports:

> Why X instead of Y?

Suggested structure:

```json
{
  "winner": "capture_401k_match",
  "runner_up": "fund_home_goal",
  "why_winner": [
    "captures employer dollars",
    "house goal remains on schedule"
  ]
}
```

The conversational layer should not have to reconstruct this comparison.

---

# Missing Data as a First-Class Output

The engine must be allowed to stop.

Example:

```json
{
  "status": "insufficient_information",
  "missing_inputs": [
    {
      "field": "employer_match",
      "reason": "Could change whether workplace retirement is the highest-priority destination."
    },
    {
      "field": "student_loan_apr",
      "reason": "Could make debt repayment higher priority than investing."
    }
  ]
}
```

---

# Scenario Mode

Scenario mode should clone the current financial state.

```text
Baseline State
    ↓ clone
Scenario State
    ↓
Apply Scenario Changes
    ↓
Allocation Engine
    ↓
Scenario Routing Plan
```

Example:

```text
Current plan
vs.
$700k house scenario
```

The engine should output comparable metrics:

- monthly available to allocate
- cash reserve months
- monthly investing
- goal status
- debt service
- projected work-optional range
- tradeoffs

The baseline plan must not change unless the user explicitly adopts the scenario.

---

# Initial Recommendation Families

The first implementation should focus on six families.

---

# Family 1: Cash Reserve / Excess Cash

## Inputs

Required:

- current cash
- baseline spending
- essential spending
- reserve target
- operating cash requirement
- known near-term expenses

## Recommendations

Possible:

- rebuild operating cash
- build starter reserve
- build full reserve
- maintain current reserve
- allocate excess cash elsewhere

## High-Confidence Cases

- cash below operating requirement
- cash below starter reserve
- cash materially above reserve plus known needs

## Example

```text
Cash: $22,000
Safety target: $12,000
Near-term obligations: $3,000
Operating buffer: $2,000

Available Cash to Allocate:
$5,000
```

---

# Family 2: 401(k) Employer Match

## Inputs

Required:

- employee contribution rate
- employer match formula
- gross eligible compensation
- contribution limit status
- cash-flow capacity
- safety gate status

## Recommendation

If user is below the contribution needed to capture the full employer match:

- calculate incremental employee contribution
- calculate estimated paycheck impact
- calculate employer dollars gained
- confirm goals remain feasible
- recommend increasing contribution

## Confidence

Usually:

```text
very_high
```

if employer match is verified.

## Blockers

- negative cash flow
- operating cash shortage
- critical near-term obligation
- match data missing

---

# Family 3: High-Interest Debt

## Inputs

Required:

- balance
- APR
- minimum payment
- debt type
- prepayment constraints
- cash reserve
- employer match availability

## Recommendation

Compare debt repayment against available opportunities using policy tiers.

Extreme-interest debt should usually dominate discretionary investing.

## Confidence

May be:

- very_high
- high
- moderate

depending on APR and competing opportunities.

---

# Family 4: Near-Term Goal Funding

## Inputs

Required:

- target amount
- current funding
- target date
- goal priority
- flexibility
- expected cash needed
- monthly available to allocate

## Calculation

```text
remaining_amount = target_amount - current_funding

required_monthly_contribution
= remaining_amount / remaining_months
```

## Recommendation

If current contribution is below target requirement:

- increase contribution
- identify conflict if insufficient cash exists
- offer scenario alternatives

---

# Family 5: Unallocated Recurring Cash Flow

## Inputs

Required:

- validated monthly income
- validated true lifestyle spending
- required debt service
- required goal funding
- variability buffer
- existing routing

## Recommendation

If recurring surplus is present but not allocated:

- send surplus through full tranche-ranking loop
- generate Money Routing Plan
- surface first action

This is one of the highest-value Penny use cases.

---

# Family 6: Long-Term Account Routing

Initial candidate accounts:

- HSA
- IRA / Roth IRA
- additional 401(k)
- brokerage

## Inputs

Required:

- contribution capacity
- employer plan details
- tax context
- liquidity preference
- goal horizon
- early-retirement / work-optional goals
- known upcoming spending
- account availability

## Important

Do not assume one universal priority.

Examples:

A user with a near-term house goal may require more liquidity.

A user optimizing for early work optionality may value accessible brokerage assets differently from someone planning a traditional retirement.

## Confidence

Usually:

```text
moderate
```

unless one option has clearly dominant benefits.

---

# Initial Routing Algorithm Pseudocode

```python
def build_routing_plan(state, policy):
    validate_state(state)

    gate_result = run_safety_gates(state, policy)

    if gate_result.blocked:
        return gate_result

    remaining_monthly = state.cash_flow.monthly_available_to_allocate
    remaining_lump_sum = state.cash_flow.cash_available_to_allocate

    plan = []

    while remaining_monthly > 0 or remaining_lump_sum > 0:
        candidates = generate_candidates(state, policy)

        if not candidates:
            break

        candidates = evaluate_eligibility(candidates, state, policy)

        missing = collect_material_missing_inputs(candidates)

        if missing:
            return insufficient_information(missing)

        ranked = rank_candidates(candidates, state, policy)

        winner = ranked[0]

        allocation = allocate_until_breakpoint(
            winner,
            remaining_monthly,
            remaining_lump_sum,
            state,
            policy
        )

        plan.append(allocation)

        state = apply_allocation_to_state(state, allocation)

        remaining_monthly -= allocation.monthly_amount
        remaining_lump_sum -= allocation.lump_sum_amount

    return build_plan_output(plan, state)
```

---

# Candidate Interface

Each candidate should conceptually expose:

```python
class AllocationCandidate:
    type

    def is_eligible(state, policy):
        ...

    def required_inputs():
        ...

    def missing_inputs(state):
        ...

    def confidence(state, policy):
        ...

    def priority_tier(state, policy):
        ...

    def rank_features(state, policy):
        ...

    def next_breakpoint(state, policy):
        ...

    def allocate(max_monthly, max_lump_sum, state, policy):
        ...

    def apply_to_state(state, allocation):
        ...

    def explanation_inputs(state, allocation):
        ...
```

---

# Suggested Priority Tiers

Avoid one flat score.

Example:

## Tier 0 — Required

- maintain operating liquidity
- required obligations
- critical near-term expenses

## Tier 1 — Near-Dominant Opportunities

- employer match
- very high-interest debt
- starter emergency reserve

## Tier 2 — Goal Protection

- high-priority near-term goals
- full reserve target if needed
- high-cost debt

## Tier 3 — Long-Term Optimization

- HSA
- IRA / Roth
- additional 401(k)
- brokerage
- medium-cost debt

## Tier 4 — Preference-Dependent Uses

- mortgage acceleration
- low-rate debt acceleration
- additional cash reserves
- increased discretionary spending

Within tiers, use comparison logic and user preferences.

---

# Explainability Requirements

Every allocation must be able to answer:

1. What should I do?
2. Why?
3. Why now?
4. Why this instead of the next-best option?
5. What assumptions are you using?
6. What happens if I do nothing?
7. What happens to my goals?
8. What data could change this recommendation?
9. How confident are you?
10. How is this calculated?

---

# Auditability

Every recommendation should be reproducible.

Persist:

- financial-state snapshot
- policy version
- engine version
- relevant data-confidence values
- candidate set
- winner
- runner-up
- assumptions
- recommendation object
- timestamp

Example:

```json
{
  "engine_version": "0.1.0",
  "policy_version": "2026.1",
  "financial_state_snapshot_id": "uuid",
  "generated_at": "2026-09-12T00:00:00Z"
}
```

This is important for trust, debugging, and future compliance needs.

---

# Policy Configuration

Use centralized versioned configuration.

Suggested categories:

```text
policy/
  debt-policy.json
  tax-policy-2026.json
  reserve-policy.json
  routing-policy.json
  confidence-policy.json
```

Do not scatter policy thresholds throughout application code.

---

# Failure Modes to Avoid

## 1. Treating all cash as investable

Incorrect.

Cash may be:

- operating
- emergency
- goal-specific

## 2. Double-counting transfers as spending

Avoid:

- credit-card payment + underlying purchases
- checking → savings
- checking → brokerage

## 3. Universal financial waterfall

Do not enforce one rigid order for all households.

## 4. False precision

Avoid:

> this choice is worth exactly $183,418 over your lifetime

unless methodology genuinely supports that precision.

## 5. LLM-generated financial logic

Never allow conversation output to change the deterministic recommendation logic.

## 6. Recommending around missing critical facts

Ask first.

## 7. Always optimizing for maximum wealth

The engine must respect:

- liquidity
- lifestyle
- house goals
- family goals
- work preferences
- spending priorities

## 8. Ignoring incompatible goals

Explicitly detect and surface conflicts.

---

# Initial Test Cases

Implementation should begin with deterministic fixtures.

---

## Test 1 — Missing Employer Match

State:

```text
Monthly surplus: $800
Cash reserve: healthy
401(k) contribution: 3%
Employer match: unknown
No high-interest debt
```

Expected:

```text
status = insufficient_information
missing = employer_match
```

Do not recommend Roth / brokerage until match is known.

---

## Test 2 — Uncaptured Employer Match

State:

```text
Monthly surplus: $800
Cash reserve: healthy
401(k): 3%
Employer match: 100% through 5%
No high-interest debt
House goal: on track
```

Expected:

```text
top recommendation = increase 401(k) to 5%
confidence = very_high
```

Remaining surplus should reroute after breakpoint.

---

## Test 3 — Credit-Card Debt

State:

```text
Monthly surplus: $600
Healthy starter reserve
Credit-card balance: $5,000
APR: 24%
401(k) match already captured
```

Expected:

```text
top recommendation = pay credit-card debt
confidence = very_high/high
```

---

## Test 4 — House Goal Conflict

State:

```text
Monthly surplus: $800
House goal requires: $1,100/month
Retirement plan currently receives additional $400/month
Goal priority: high
```

Expected:

```text
status = goal_conflict
```

Penny should present tradeoffs rather than pretending both goals can remain unchanged.

---

## Test 5 — Excess Cash

State:

```text
Cash: $30,000
Operating requirement: $4,000
Emergency reserve target: $15,000
Known goal cash: $5,000
```

Expected:

```text
available_cash_to_allocate = $6,000
```

Engine should route the $6,000.

---

## Test 6 — Paid-Off Loan

Before:

```text
Student-loan payment: $350/month
Monthly available to allocate: $500
```

After payoff:

```text
Monthly available to allocate: $850
```

Expected:

Engine reruns and produces updated routing plan.

---

## Test 7 — Early-Retirement Liquidity

State:

```text
Retirement accounts already heavily funded
User goal: work optional at 45
Upcoming liquidity needs: low
Additional $1,000/month available
```

Expected:

Do not blindly route 100% into restricted retirement accounts.

Brokerage should be evaluated as a meaningful candidate.

Confidence may be moderate.

---

## Test 8 — Near-Term Home Purchase

State:

```text
Home purchase in 18 months
Down-payment shortfall: $18,000
Monthly surplus: $1,500
401(k) match captured
No high-interest debt
```

Expected:

Near-term home funding should rank above additional discretionary long-term investing.

---

## Test 9 — Negative Cash Flow

State:

```text
Income: $5,000/month
True lifestyle spending: $5,300/month
Debt minimums: $400/month
```

Expected:

```text
status = blocked
reason = negative_cash_flow
```

Do not recommend increased investing.

---

## Test 10 — User Is Already On Track

State:

```text
All safety gates pass
Goals fully funded
Employer match captured
No expensive debt
Long-term contribution plan already meets user's goals
Extra discretionary $300/month
```

Expected:

Engine should be allowed to say:

> No urgent change is required.

It may present optional tradeoffs rather than forcing another optimization.

---

# Implementation Order

Suggested build sequence:

## Phase 1

Build:

- financial state schema
- policy configuration
- confidence model
- safety gates
- missing-data system

## Phase 2

Build recommendation families:

1. cash reserve / excess cash
2. employer match
3. high-interest debt

## Phase 3

Add:

4. near-term goals
5. recurring unallocated cash flow

## Phase 4

Add:

6. long-term account routing

## Phase 5

Build:

- tranche allocation loop
- runner-up preservation
- explanation payload
- audit snapshots

## Phase 6

Build:

- scenario cloning
- state comparison
- goal-conflict outputs

---

# MVP Definition of Done

The Allocation Engine MVP is complete when it can reliably:

1. determine how much recurring and lump-sum money is available to allocate
2. protect required liquidity
3. detect missing critical information
4. rank the first six recommendation families
5. allocate money across multiple breakpoints
6. produce a full Money Routing Plan
7. identify one Next Best Move
8. preserve the runner-up alternative
9. assign a recommendation confidence level
10. expose assumptions and supporting facts
11. detect incompatible goals
12. rerun when state changes
13. run safely in isolated scenario mode
14. reproduce every recommendation from a saved state + policy version

---

# Core Engineering Rule

The engine should always be able to explain:

> **Why did Penny tell this household to put this dollar here instead of somewhere else?**

If that answer cannot be reconstructed deterministically from the stored state and policy configuration, the recommendation should not be produced.
