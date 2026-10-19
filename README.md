# Recommendations

A ranked feed of action cards inside Rocket Money, with **Rowan** as the chat behind them. Not a chatbot. Not another dashboard.

Its job: tell a member the next best thing to do with their money, show them why, and do it for them where we can.

This is the product-leader brief. The long strategy, card inventory, quality bar, and sources live in [`STRATEGY.md`](STRATEGY.md).

---

## The bet

Rocket Money’s conversion moment — “we found your forgotten subscriptions” — is a one-time discovery. After the member has cleaned house, the reason to keep paying gets thinner.

Recommendations turns that into a **recurring** discovery, on rails no competitor has: we can see the ledger, show the math, cancel, move money, and notice the next thing unprompted.

**What we want to prove in 90 days:** a member shown a specific, dollar-quantified, one-tap recommendation acts on it at a rate no dashboard has, and the act is worth more than the subscription.

People already ask AI about money. They will not act on it blind. Personalized advice looks priced for someone else. Rocket Money already cancels, negotiates, and saves — Recommendations is the intelligence layer on those rails.

---

## Who it is for

We are not building for power users. Two members, one product, different card mixes.

**Independent Saver (Maya)** — Ordered, on the edge of Stable. Earns and saves, but has no sequencing. Idle competence: money sitting at 0.38%, no named goals. She needs one next step in plain English, not a lesson. She will answer two questions to unlock a real recommendation. She will abandon a questionnaire.

**Strategic Planner (Jordan)** — Growing. Already understands the tradeoffs; the cost is the Sunday spreadsheet. He needs the number and the delta, then a tap. Tutoring on the card is condescension. A quiet week that says “I checked, nothing needs you” is worth real money to him.

Both want the same thing: **be right, show me why, don’t waste my attention.**

---

## How it works

Three product rules:

1. **Cards are for mutually distinct recommendations.** Title carries the dollar or the deadline. One line of why. When we have an opinion, show options with a **Recommended** mark — destinations and impact, not a single prescribed tap. No card ships that only informs.
2. **Rowan is for conversation.** Information-gathering, objections, “why would I invest an HSA?”, house planning that can happen in any order. Not a second product. No Rowan tab.
3. **Quiet is a feature.** Three live cards max. Empty week is designed. Filling the feed to look busy would destroy the product.

The member always confirms. Numbers come from a deterministic engine against the ledger — the language model narrates, it never invents a figure. We never recommend a specific security.

**In the app:** one card on Home, above net worth. A Recs tab for the rest. Push only for time-boxed cards (trial converting, cash-flow collision, windfall).

---

## What members see

A clickable prototype is in [`prototype/`](prototype/). Two synthetic members whose numbers reconcile.

```bash
cd prototype && npm install && npm run dev
```

Open http://127.0.0.1:5173/. Switch **Maya** and **Jordan** in the studio.

**Maya — Independent Saver**

- Peacock trial: keep vs cancel. We cannot see if she watched; there is no recommended pick.
- $12,000 in Ally at 0.38%: open high-yield (recommended) or leave it.
- Two music bills: is one extra? Not a cancel — we don’t know enough.
- $1,450 unlabeled ACH: one question, then it hits the right budget. If it’s rent, we ask whether a house is on the list — we do not invent a house plan from rent.
- House: saved, price, and when live in **Rowan**, any order. Affordability is Rocket Mortgage, not a guess. Then an on-track check from her numbers.

**Jordan — Strategic Planner**

- Missing $3,160/year of free money from work: raise to 6% (recommended) or 5%. Skip is swipe.
- $3,200 landed off-cycle: house fund (recommended), 401(k), or Ally — ranked against June 2028.
- $5,400 idle in HSA cash: invest the extra (recommended) or keep cash. Teaching stays in Rowan.
- Ask Rowan: “max 401k vs delay the house.”

Free teaser: counts and dollars visible; actions, math, and Rowan locked. Quiet week is a designed empty state.

---

## How we ship

| Phase | Prove | Ships | Exit |
| --- | --- | --- | --- |
| **1 — 90 days** | The card | Save + Stabilize on data we already have. Home slot + Recs tab. Rowan on a card. Holdout. | ≥25% action rate on money-moving cards. Zero math errors. No caused overdrafts. |
| **2 — 6 months** | The loop | Goals, idle cash, enrichment (earn the question). Global Rowan + what-if. Free teaser + impact ledger. | Questions get answered. Free → Premium lift. |
| **3 — 12 months** | The ladder | Wealth bucket, gated on legal. Premium+ what-if. Household. | Verified value per member well above the annual price. |

**Tiers.** Free sees a real dollar teaser (“4 recommendations, worth $X a year”) and one unlocked card a month. Premium is the feed, the tap, the math, Rowan. Premium+ is what-if and denser monitoring for Jordan.

Completed actions land on an **impact ledger** — the renewal argument, in the member’s own numbers.

---

## What we need

1. **Fund Phase 1** — a squad on Save and Stabilize. No new data partnerships.
2. **A permanent holdout** — without it we will credit ourselves for work the existing app already does.
3. **A legal read on the wealth bucket before Phase 3.** Recommended v1 line: plan mechanics, never security selection (raise a 401(k) contribution to capture a documented match; move cash to the member’s own savings). “Put it in an index fund” does not ship. This is not settled; it is the question that changes the roadmap.
4. **Rank by member value even when it costs us.** Cancel vs negotiate will sometimes pick the cheaper-for-us path. Decide that once, in writing.

The ChatGPT objection: a general assistant cannot see the ledger, cannot cancel, and will never notice anything on its own. Recommendations is proactive and executing. That is the product.

If high-confidence cards land under ~10% action rate, the premise is wrong — members do not want to be told what to do — and the answer is a Rowan-first product. Name that early rather than filling the feed.
