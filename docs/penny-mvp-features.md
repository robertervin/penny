# Penny MVP Features

## Product Thesis

**Penny helps people build wealth without needing to become personal-finance experts.**

The MVP should deliver one core promise:

> **Connect your finances. Tell Penny what you want from life. Penny figures out what you should do next with your money — and explains why.**

Penny is not primarily a budgeting app, investment dashboard, retirement calculator, or stock picker.

It is a **goal-aware financial planning and money-routing assistant** that uses connected financial data to help users make better decisions.

---

## Initial Target Audiences

### 1. Everyday Wealth Builder

Someone who already thinks seriously about money and wealth building, but still spends too much time running calculations, comparing tradeoffs, evaluating large purchases, deciding where new cash should go, and checking whether their decisions still align with long-term goals.

They want Penny to automate analysis, not decision authority.

### 2. Guided Starter

Someone who earns decent money, saves responsibly, has limited financial expertise, does not want personal finance to become a hobby, suspects there are things they should be doing that they do not know about, and wants clear personalized guidance.

They want Penny to identify opportunities they would not know to ask about.

---

# Core MVP Jobs

Penny should do four things exceptionally well:

1. **Understand my money**
2. **Understand what I want**
3. **Tell me what I should do next**
4. **Let me ask “what if?”**

Everything else is secondary.

---

# MVP Principles

## 1. Penny recommends. The human acts.

Penny should not move money, execute trades, or change accounts in V1.

The flow is:

> **Recommend → explain → user decides → user executes**

Automation can come later after trust is earned.

## 2. Penny should be sophisticated so the user does not have to be.

The underlying system may use sophisticated planning logic, but the default user experience should be simple. Complexity should be available through progressive disclosure.

## 3. Penny never requires the user to know the right financial question.

A Guided Starter should not need to know to ask whether a Roth IRA, HSA, or higher 401(k) contribution makes sense. Penny should recognize when those questions are relevant.

## 4. Penny never silently assumes an important fact.

If a recommendation materially depends on something uncertain, Penny asks.

## 5. Important financial math should be deterministic.

The LLM explains the recommendation. It does not create the financial logic.

Penny should have three layers:

### Layer 1 — Financial State
Structured facts about the user.

### Layer 2 — Deterministic Planning Engine
Calculates cash flow, reserves, contribution priorities, projections, scenarios, and recommendation triggers.

### Layer 3 — Penny
Explains results, answers questions, and turns structured outputs into natural conversation.

---

# Core Onboarding Flow

## Stage 1 — Welcome

### Goal
Establish Penny's promise and trust model.

### Suggested experience

> # Build wealth without becoming a financial expert.
>
> Penny understands your finances, your goals, and the life you're trying to build — then helps you figure out what to do next with your money.

Set expectations:

- Understand where your money goes
- Help decide where new money should go
- Identify things worth changing
- Show how major decisions affect your future
- Never move money or make trades without you

---

## Stage 2 — Life Goals

### Goal
Understand what the user is trying to build before analyzing finances.

### Initial goal options

- Feel financially secure
- Buy a home
- Get married
- Have kids
- Travel / enjoy life
- Work less someday
- Retire early
- Start a business
- Build wealth
- Help family
- Something else

Then ask:

> **Which matters most right now?**

Penny should maintain a goal hierarchy, not just a flat list.

---

## Stage 3 — Connect Financial Accounts

Plaid is a core part of MVP onboarding.

### Accounts to connect

- Checking
- Savings
- Credit cards
- Brokerage
- Retirement accounts where supported
- Student loans
- Mortgage
- Other liabilities where supported

### Plaid data used in V1

- Transactions
- Account balances
- Investment holdings
- Investment transactions
- Liabilities

### History

Penny should request as much transaction history as the institution supports, ideally **6–24 months**, rather than relying on a short 30–90 day snapshot.

Cash-flow forecasting depends on identifying recurring income, recurring expenses, spending variability, annual expenses, vacations, subscriptions, transfers, debt payments, and one-time spending.

---

# Cash-Flow Engine

The cash-flow engine is one of the most important technical systems in V1.

Penny should understand financial movement rather than simply categorize transactions.

## Transaction classes

| Type | Example | Counts as lifestyle spending? |
|---|---|---|
| Income | Paycheck | No |
| Fixed essential | Rent | Yes |
| Variable essential | Groceries | Yes |
| Discretionary | Restaurants | Yes |
| Recurring discretionary | Streaming | Yes |
| Debt obligation | Student loan | Yes |
| Investment contribution | Brokerage transfer | No |
| Internal transfer | Checking → savings | No |
| Credit-card payment | Chase payment | No, if underlying transactions already counted |
| Irregular lifestyle | Vacation | Yes, annualized |
| Exceptional one-off | Roof replacement | Depends |
| Goal allocation | House fund transfer | No |

Avoid double-counting credit-card purchases plus card payments, transfers between owned accounts, and transfers into savings or investments.

---

# Two Spending Concepts

## Baseline Spending

What normal month-to-month life costs.

Example:

> **$5,200/month**

## True Lifestyle Spending

Baseline spending plus annualized irregular lifestyle costs such as vacations, annual insurance, gifts, home maintenance, annual subscriptions, and periodic large purchases.

Example:

> **$6,450/month**

This number is more useful for long-term planning and work-optional projections.

---

# Stage 4 — Confirm Penny's Understanding

Penny should never move directly from account connection to advice.

The flow is:

> **Connect → Analyze → Confirm → Recommend**

### Screen concept

> # Here's what I think your money looks like.
>
> Check my work before I build your plan.

Example:

| Metric | Estimate | Confidence |
|---|---:|---|
| Take-home income | ~$6,240/mo | High |
| Baseline spending | ~$3,850/mo | Medium |
| Fixed obligations | ~$1,720/mo | High |
| Irregular lifestyle spending | ~$640/mo | Medium |
| Monthly surplus | ~$1,750/mo | Medium |
| Cash | $24,850 | High |
| Investments | $62,300 | High |
| Debt | $18,200 | High |

Every meaningful estimate should be editable.

Users should be able to say:

- Looks right
- Something is wrong
- This is a transfer
- This was a one-time purchase
- This is recurring
- Ignore this
- Categorize this differently

This confirmation step is part of the trust architecture.

---

# Stage 5 — Fill Important Gaps

Plaid will not reliably provide every piece of information Penny needs.

Ask dynamically only for missing data.

## Likely user-supplied inputs

- Gross salary
- 401(k) contribution percentage
- Employer 401(k) match
- Employer retirement contributions
- HSA eligibility
- Employer HSA contribution
- Upcoming bonus
- Expected raise
- Major purchase plans
- Family plans
- Career plans
- Risk preferences
- Desired safety buffer
- Goal timing

---

# Stage 6 — Safety and Constraints

Before optimizing, Penny needs to understand what the user considers financially safe.

## Cash reserve

Offer:

- 3 months
- 6 months
- 9 months
- 12 months
- Help me decide

Penny can recommend a target, but the user confirms it.

## Upcoming major expenses

Ask about major plans in the next 1–5 years:

- House
- Car
- Wedding
- Kids
- Travel
- Renovation
- Starting a business
- Career break
- Other

---

# Core Internal Metric: Available to Allocate

This should be one of the foundational calculations in Penny.

## Monthly Available to Allocate

> Income  
> − true lifestyle spending  
> − required debt service  
> − planned near-term goal funding  
> − spending variability buffer  
> = **Available to Allocate**

## Cash Available to Allocate

> Cash balance  
> − safety reserve  
> − near-term known expenses  
> = **Available Cash to Allocate**

Every calculation must be explainable.

Users should always be able to tap:

> **How did you calculate this?**

---

# Stage 7 — Your Plan

This should not feel like another finance dashboard.

It should summarize what Penny understands and the resulting strategy.

### Example

> # Your Plan
>
> ## What you're building toward
>
> 🏠 Home in ~4 years  
> 👨‍👩‍👧 Family  
> 💼 Work becoming optional later
>
> ## Your financial foundation
>
> **Cash safety:** Strong  
> **Debt:** Manageable  
> **Retirement:** Needs attention  
> **Available to allocate:** ~$875/month
>
> ## Your Money Routing Plan
>
> 1. Maintain $14,000 safety reserve
> 2. Capture full 401(k) match
> 3. Put $500/month toward home fund
> 4. Invest remaining ~$375/month
>
> **How Penny decided this**

The routing plan is the core strategic artifact of Penny V1.

---

# The Money Routing Plan

The routing engine determines where the next available dollar should go.

It may consider:

1. Required liquidity
2. Emergency reserve
3. High-interest debt
4. Employer retirement match
5. Near-term goal funding
6. HSA
7. IRA / Roth IRA
8. Additional 401(k)
9. Brokerage
10. Lower-priority debt payoff
11. Lifestyle spending

The exact ordering should be personalized.

There should not be one universal financial flowchart.

---

# Stage 8 — Your Next Best Move

This is the primary home-screen experience.

Penny should generally surface **one primary recommendation**, not a long list of alerts.

### Example

> # Your next best move
>
> ## Increase your 401(k) contribution from 4% → 6%.
>
> Your employer matches contributions through 6%, so you're currently leaving part of that benefit unused.
>
> **Estimated paycheck impact:** −$94/month  
> **Employer money gained:** +$1,850/year
>
> Your current cash flow can support the change while keeping your house plan on track.
>
> **Why this comes first**  
> **What happens if I don't?**  
> **How do I change it?**  
> **Ask Penny**

---

# Recommendation Confidence

Penny must not sound equally certain about every recommendation.

Confidence should come from the recommendation engine, not the LLM.

| Confidence | Penny language | Example |
|---|---|---|
| Very High | “I recommend…” | Missing employer match |
| High | “I recommend…” | Very high-interest credit-card debt |
| Moderate | “I think your best option is…” | Roth vs. additional 401(k) |
| Low / preference-dependent | “Here are the tradeoffs…” | Pay 5% mortgage vs. invest |
| Highly uncertain | Model choices; do not recommend | Quit job / start business |

Recommendation output should include:

```text
recommendation
confidence
supporting_facts
assumptions
alternatives
calculated_effects
```

Penny turns this structured output into language.

---

# Initial Recommendation Library

V1 should intentionally constrain Penny to a small set of well-tested recommendation types.

## Suggested V1 recommendation types

### Cash reserve
- Cash below target
- Cash materially above target

### Employer benefits
- 401(k) contribution below employer match
- HSA opportunity
- Employer benefit being missed

### Debt
- High-interest revolving debt
- Debt payoff frees meaningful cash flow

### Cash-flow routing
- Large monthly surplus is unallocated
- Excess checking/savings can be redirected

### Goal funding
- House goal underfunded
- Major purchase goal overfunded
- Goal timeline requires adjustment

### Retirement / investing
- Savings rate inconsistent with user's stated goal
- New contributions should change account destination
- Current plan is already sufficient

### Life changes
- Income increase
- Income decrease
- New recurring expense
- Major debt payoff
- Large cash inflow
- Material spending change

### Major purchases
- Purchase materially changes liquidity
- Purchase materially changes long-term plan
- Alternative price points produce meaningfully different outcomes

Target: approximately **10–15 recommendation types** for initial MVP.

Each should have explicit financial logic and extensive tests.

---

# Stage 9 — Ask Penny

Every recommendation should be conversational.

The user should be able to ask:

- Why this?
- Why not another account?
- What if my goal changes?
- What if I want the house sooner?
- What if my income changes?
- What if I spend this money instead?

Changed assumptions should always go back through the deterministic planning engine.

The LLM should not improvise the financial result.

---

# Scenario Mode

What-if scenarios should be isolated from the user's baseline plan.

Example:

**Current Plan**

and

**Scenario: $750k House**

The user can ask:

- What if the house is $650k?
- What if my spouse stops working?
- What if we wait three years?
- What if we increase the down payment?
- What if I take a lower-paying job?

Nothing changes the real plan until the user explicitly chooses:

> **Adopt this scenario**

This should be reflected in the data model from the beginning.

---

# Recurring Product Experience

Penny should not demand daily attention.

The ideal normal state is:

> **Everything looks good.**
>
> Your plan has not materially changed.

When something matters:

> # I found something.
>
> Your checking balance has grown about $7,200 above your safety target over the last three months.
>
> I think you should consider moving approximately $5,000 toward your long-term investment plan.
>
> **Review recommendation**

Or:

> # Your finances changed.
>
> Your last three paychecks are about $430 higher than normal.
>
> **Is this a permanent raise?**

If yes, Penny updates the plan and recommends how to use the additional income.

---

# Data Ownership

| Data | Plaid | Penny inference | User |
|---|---:|---:|---:|
| Account balances | ✓ | | confirm |
| Transactions | ✓ | | |
| Transaction categories | ✓ | refine | correct |
| Recurring expenses | possible | ✓ | correct |
| Take-home income | | ✓ | confirm |
| Gross salary | | | ✓ |
| Investment holdings | ✓ | | fill gaps |
| Investment transactions | ✓ | | |
| Loan balances | ✓ | | |
| APR | where supported | | fill gaps |
| 401(k) contribution % | | | ✓ |
| Employer match | | | ✓ |
| HSA eligibility | | | ✓ |
| Goals | | | ✓ |
| Life plans | | | ✓ |
| Risk preferences | | | ✓ |
| Safety reserve | recommend | | decide |
| Spending baseline | | ✓ | confirm |
| Available to Allocate | | deterministic | |
| Recommendation | | deterministic | |
| Explanation | | LLM | |

---

# V1 Non-Goals

## No stock picking

Do not recommend individual securities.

Penny may identify concentration risk, excessive speculation, and alignment issues, but it should not become a stock-tip engine.

## No autonomous execution

No transfers, trades, account changes, or contribution changes.

The user executes actions.

## No opaque AI financial logic

Financial calculations must come from deterministic code.

## No hyper-precise FI claims

Avoid:

> You will retire at 47.3.

Prefer:

> Under your current assumptions, work could become optional around age 47–50.

## No full budgeting product

Penny must deeply understand cash flow, but does not need to compete with traditional budgeting apps on transaction-category management.

The question is:

> **How much money is truly available, and what should happen to it?**

## No advanced tax optimization in initial V1

Defer:

- tax-loss harvesting automation
- Roth conversion ladders
- detailed tax-lot optimization
- estate planning
- advanced Social Security optimization

---

# Trust Architecture

Trust is a product feature.

Penny should earn trust through:

## Confirmed inputs
Important inferred values are confirmed before advice.

## Transparent calculations
Users can inspect how a number was calculated.

## Recommendation confidence
Penny communicates uncertainty honestly.

## Progressive disclosure
Default:

> Recommendation + concise reason

Available on demand:

- assumptions
- math
- charts
- alternatives
- sources / methodology
- scenario comparison

## Conversation
Users can challenge every recommendation.

## No execution
Penny advises; the user acts.

---

# MVP Success Criteria

The first version should be considered successful if Penny can reliably do these five things:

## 1. Understand someone's financial situation quickly

Target:

> A useful financial model within roughly 10 minutes of onboarding.

## 2. Produce a personalized Money Routing Plan

The user should understand and broadly agree with the routing logic.

## 3. Find one genuinely useful thing the user did not already know

The first “wow” moment should be:

> **Penny found something useful in my actual finances.**

## 4. Answer “why?” convincingly

Every recommendation must be understandable and grounded in transparent math.

## 5. Recalculate when something important changes

Examples:

- raise
- debt paid off
- house timeline moves
- large purchase
- income loss
- new baby
- large cash inflow

The user should not need to rebuild their financial plan manually.

---

# Primary MVP Experience

> **Connect your finances → Penny learns your real cash flow → you confirm Penny's understanding → Penny builds your Money Routing Plan → Penny tells you the next best move → you can challenge the recommendation or simulate a different decision.**

---

# Product North Star

Penny should not primarily answer:

> **How am I doing?**

It should answer:

> # **What should I do next, given where I want my life to go?**

---

# Next Design / Engineering Work

The next major specification should define the **Money Routing Engine** in detail.

That work should include:

1. Exact prioritization logic
2. Recommendation trigger rules
3. Required inputs for each recommendation
4. Confidence rules
5. Missing-data handling
6. Cash reserve logic
7. Debt prioritization logic
8. Employer-match logic
9. HSA / IRA / 401(k) routing logic
10. Brokerage routing logic
11. Goal-funding logic
12. Scenario-engine assumptions
13. Projection methodology
14. Explanation templates
15. Unit and integration test cases

The Money Routing Engine is the intellectual heart of Penny V1.
