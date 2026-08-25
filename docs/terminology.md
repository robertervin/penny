# Penny terminology

Canonical product and architecture vocabulary. Prefer these names in docs, APIs, events, and code. Update this file when the model changes; do not invent parallel synonyms for the same concept.

**Doctrine:** Ledger is what the banks said. Situation is what Penny understands. Plan is where surplus goes. Audit is a thorough checkup. Watch is a checkup on one symptom. Explore is a conversation over the file.

---

## Core distinction

| Term | Meaning |
|---|---|
| **Client understanding** | Penny’s living model of this household: facts, inferences, goals, preferences, and open questions. Always on. Updated as money moves and as the person corrects her. |
| **Engagement** | How the person talks to that understanding (Messages, app, ChatGPT, etc.). |
| **Work** | Discrete jobs Penny runs against the understanding (audit, watch, explore answer, etc.). |

**Audit ⊂ work. Understanding ⊄ audit.**  
An audit *reads and may refresh* understanding, then *emits* recommendations. It does not *own* who the client is.

---

## 1. Client understanding (the durable file)

Collective name: **Client file** or **Household file**.

| Term | What it is | Not |
|---|---|---|
| **Household** | The economic unit Penny advises (one or more people, shared money story). | A single Plaid Item |
| **Profile** | Identity + prefs (who’s in the household, notification style, risk tone). | Balances |
| **Ledger** | Canonical money facts from institutions (accounts, balances, transactions). | Advice |
| **Situation** | Interpreted financial state derived from the ledger + corrections: runway, debt posture, income shape, liquidity map, recurring commitments. | A one-off report |
| **Goals** | Named destinations (cushion, house, car, retirement track). | Generic “save more” |
| **Policy** | Standing rules: waterfall order, HYSA 4% assumption, materiality, debt overrides. | A chat message |
| **Memory** | Decision memory: keep/cancel, “partner’s Netflix,” pay-in-full, APR, must-pay. | Raw Plaid JSON |
| **Open questions** | What Penny still needs from the human to raise confidence. | Findings |

**Situation** is the standing interpreted state. Runway, revolving cost, typical income, and duplicate *candidates* live on Situation. An audit *reports on* Situation; sync *feeds* the Ledger that Interpret turns into Situation.

---

## 2. Insights vs recommendations vs plans

| Term | Definition | Lifetime |
|---|---|---|
| **Observation** | Neutral fact or light inference with evidence (“two Netflix merchants”). | Ephemeral or logged |
| **Insight** | Explained observation (“this looks like the same job twice”). | Until dismissed or invalidated |
| **Opportunity** | Material, actionable improvement candidate with sized dollars / year-ahead. | Until taken, expired, or superseded |
| **Recommendation** | Penny’s advised next move on an opportunity (or ordered set), with framing. | Until accepted / rejected / superseded |
| **Plan** | Standing ordered intent for surplus (waterfall + active goals) — “where the next dollar goes.” | Durable; changes when Situation / Goals / Policy change |
| **Commitment** | Something the person accepted (extra $200 to card, 30-day experiment). | Tracked until done / canceled |

**Audit** produces a **packet** of Observations → Opportunities → Recommendations, and may refresh **Plan**.  
**Watch** may emit a single Opportunity without a full audit.  
**Explore** answers from Situation + Ledger; it should not invent Recommendations without the same engines.

Optional umbrella for Audit / Watch / Advise outputs: **Guidance**.

---

## 3. Jobs (capabilities)

Name the *work*, not the whole product, after these.

| Job | Trigger | Purpose |
|---|---|---|
| **Sync** | Link, webhook, schedule | Refresh Ledger from institutions |
| **Interpret** | After sync / on correction | Rebuild **Situation** (+ light Insights) |
| **Audit** | On-demand or scheduled | Comprehensive review of Situation vs Goals / Policy → Opportunities + Recommendations + Plan check |
| **Watch** | Continuous / cheap schedule | Narrow monitors (new recurrence, promo cliff, runway breach) → optional Opportunity |
| **Advise** | After audit / watch, or on ask | Turn Opportunities into framed Recommendations / update Plan |
| **Explore** | User question | Q&A / what-if over Client file (tool-using agent) |
| **Coach** | Commitment check-ins | Experiments, reminders, “did the $200 land?” |

Optional umbrella for Sync → Interpret: **Refresh**.

**Audit** is one feature: a comprehensive on-demand or scheduled review of the person’s financial situation with recommendations when possible. It is not synonymous with client understanding.

---

## 4. Engagement surfaces

| Term | Role |
|---|---|
| **Channel** | Messages for Business, SMS, app, ChatGPT, web sheet |
| **Thread** | A conversation instance on a channel |
| **Turn** | One user / Penny exchange |
| **Card / Interactive** | MfB-style quick reply, list picker, form |
| **Artifact** | Rich attachment: chart sheet, PDF summary, audit report view |

Channels **present** Guidance and **write** Memory / Goals. They do not compute Situation.

---

## 5. Runtime / engineering mapping

| Domain | Technical name | Notes |
|---|---|---|
| Client file store | `household`, `situation`, `goals`, `memory`, `policy` | Prefer these over `audit_*` for durable state |
| Institution pull | `sync` workflow | e.g. `PlaidSyncRequested` |
| Ledger write | `ingest` workflow | e.g. `PlaidSnapshotReady` |
| Rebuild understanding | `interpret` workflow | Situation builder |
| Full review job | `audit` workflow | Narrow job name — correct |
| Prioritize / frame actions | `advise` | May run inside or after audit |
| Background runner | **workflow processor** | `penny-workflow-processor` |

**Event naming pattern:** `{Domain}{Job}{Requested|Completed|…}`  
Examples: `PlaidSyncRequested`, `HouseholdInterpretRequested`, `HouseholdAuditRequested`, `GuidanceOpportunityRaised`.

Situation math (runway, income, debt posture) belongs to **Interpret / Situation**, not exclusively inside an `AuditEngine`. Audit *calls* that understanding.

---

## 6. Agent vocabulary

| Term | Meaning |
|---|---|
| **Advisor agent** | Product persona (“Penny”) — tone, framing, psychology rules |
| **Tools** | Read/write Client file, run jobs (`get_situation`, `run_audit`, `apply_correction`, `list_opportunities`) |
| **Grounding** | Answers must cite Situation / Ledger evidence |
| **Proposal** | Soft Recommendation the user hasn’t accepted |
| **Correction** | User edit to Memory / Policy / Goals → triggers Interpret (and maybe Advise) |

Proactive path: **Watch** → Opportunity → **Advise** → Recommendation → **Channel**.  
Exploratory path: **Explore** via tools; “what should I do?” may **run Audit** or **Advise**, not freehand invent a Plan.

---

## 7. Phrasing

| Prefer | Avoid |
|---|---|
| “Refresh your situation” | Treating sync as the whole product |
| “Run an audit” | “Audit mode” as the only home screen |
| “Your plan” (standing waterfall + goals) | “Your audit results” for the ongoing north star |
| “Opportunity” / “Recommendation” | “Finding” for everything |
| “Client file” / “Household file” | “The audit object” |
| “Memory” (they already told us) | Re-asking as if first meeting |

---

## 8. Build order (respecting this model)

1. **Interpret** — Situation builder  
2. **Audit** — job: Situation → Opportunities → Recommendations (+ Plan consistency)  
3. **Advise / Plan** — waterfall as Policy + Plan (reused by Audit and Watch)  
4. Channels render **Guidance**, not “the Audit UI” as the entire product  

When Penny grows Watch + Explore, add **jobs and channels** — do not fork a second brain named “non-audit.”
