export type Bucket = "save" | "stabilize" | "goals" | "wealth" | "improve";
export type ProfileId = "maya" | "jordan";
export type Tier = "free" | "premium";

export type MathRow = { label: string; value: string; note?: string };

export type CategoryOption = { id: string; label: string; needsAmount?: boolean };

export type CardOption = {
  id: string;
  label: string;
  impact?: string;
  recommended?: boolean;
  needsAmount?: boolean;
};

export type Card = {
  id: string;
  bucket: Bucket;
  bucketLabel: string;
  title: string;
  why: string;
  primary: string;
  counter?: string;
  categories?: CategoryOption[];
  choices?: CardOption[];
  chips: string[];
  annualImpact: number;
  timeBoxed?: boolean;
  math: {
    inputs: MathRow[];
    formula: string;
    result: string;
    limitation: string;
    confidence: string;
  };
  rowanOpener: string;
};

export type Account = { name: string; inst: string; balance: number; kind: "asset" | "liability" };

export type Profile = {
  id: ProfileId;
  name: string;
  short: string;
  initials: string;
  archetype: string;
  rungNote: string;
  takeHome: number;
  essentials: number;
  discretionary: number;
  netWorth: number;
  netWorthDelta: number;
  spendMonth: number;
  budgetMonth: number;
  fico: number;
  accounts: Account[];
  cards: Card[];
  enrichment?: Card;
  emptyCopy: { title: string; body: string };
  teaserValue: number;
  teaserCount: number;
};

export const bucketClass: Record<Bucket, string> = {
  save: "save",
  stabilize: "stabilize",
  goals: "goals",
  wealth: "wealth",
  improve: "improve",
};

export const usd = (n: number, d = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: d, minimumFractionDigits: d });

export const maya: Profile = {
  id: "maya",
  name: "Maya Chen",
  short: "Independent Saver · Ordered",
  initials: "MC",
  archetype: "Ordered, on the edge of Stable",
  rungNote: "Three months of bills is already in Ally — at 0.38%. Buffer exists. Rate is the miss. No goals named yet.",
  takeHome: 5820,
  essentials: 3240,
  discretionary: 412,
  netWorth: 39220,
  netWorthDelta: 640,
  spendMonth: 4128,
  budgetMonth: 4200,
  fico: 741,
  accounts: [
    { name: "Checking", inst: "Chase ·4412", balance: 2240, kind: "asset" },
    { name: "Savings", inst: "Ally ·2291 · 0.38% APY", balance: 12180, kind: "asset" },
    { name: "401(k)", inst: "Fidelity", balance: 24800, kind: "asset" },
    { name: "Car loan", inst: "Toyota Financial", balance: 0, kind: "liability" },
  ],
  teaserCount: 4,
  teaserValue: 168 + 374 + 132,
  cards: [
    {
      id: "peacock",
      bucket: "save",
      bucketLabel: "Save money",
      title: "Peacock is free until Sept 24. Still using it?",
      why: "$13.99 starts the 24th if you keep it — cancel by the 23rd and you still have it through the 24th.",
      primary: "Keep it",
      timeBoxed: true,
      choices: [
        { id: "keep", label: "Keep it", impact: "$13.99 starts the 24th" },
        { id: "cancel", label: "Cancel so I'm not charged", impact: "No charge. You keep it through the 24th." },
      ],
      annualImpact: 13.99 * 12,
      chips: ["How do you know it's a trial?", "What happens if I cancel?", "Show me the math"],
      math: {
        inputs: [
          { label: "Peacock", value: "$0.00", note: "Chase ·4412 · Aug 25 (trial auth)" },
          { label: "First paid charge if kept", value: "$13.99", note: "Sept 24 · merchant plan price" },
          { label: "Prior forgotten trial", value: "None on this card" },
        ],
        formula: "annual_cost_if_kept = 13.99 × 12 = $167.88",
        result: "Keep it: $13.99 starts the 24th. Cancel by the 23rd: no charge, access through the 24th.",
        limitation: "We can see the date and the price. We can't see whether you've actually used Peacock.",
        confidence: "0.94 → action card",
      },
      rowanOpener:
        "Peacock put a $0 hold on your Chase card on Aug 25 — that's how a trial usually shows up. First real charge is $13.99 on Sept 24 if you keep it. I don't know if you've watched anything. If you have, keep it. If you haven't, cancel so the charge never posts.",
    },
    {
      id: "idle-cash",
      bucket: "save",
      bucketLabel: "Save money",
      title: "Your $12,000 could earn about $374 more a year",
      why: "Ally is paying almost nothing for money you already saved.",
      primary: "Open high-yield savings (5 min)",
      annualImpact: 374,
      choices: [
        {
          id: "hysa",
          label: "Open high-yield savings",
          impact: "About $374 more a year. Same-day access.",
          recommended: true,
        },
        { id: "leave", label: "Leave it in Ally", impact: "Keep 0.38% — about $46 a year." },
      ],
      chips: ["What is high-yield savings?", "Is this safe?", "Show me the math", "Is this my emergency fund?"],
      math: {
        inputs: [
          { label: "Ally savings", value: "$12,180.00" },
          { label: "Current APY", value: "0.38%", note: "regular savings" },
          { label: "High-yield savings now", value: "3.50%" },
          { label: "Leave in checking", value: "$2,240", note: "a couple of weeks of bills" },
        ],
        formula: "on $12,000\nnow = 12,000 × 0.0038 = $45.60 / year\nhigh-yield = 12,000 × 0.035 = $420.00 / year\nextra = 420.00 − 45.60 = $374.40 / year",
        result: "First step is open the account. Then you can move the $12,000. The $2,240 in checking stays put.",
        limitation: "Only do this if the $12,000 isn't already spoken for — taxes, a closing, a trip. Rocket Money opens the account with a partner bank. Same FDIC protection as Ally.",
        confidence: "0.91 → action card",
      },
      rowanOpener:
        "You already did the hard part — you saved $12,000. Ally is just paying almost nothing for it. High-yield savings is still a savings account: you can get the money the same day, it's FDIC-insured, and it's not the stock market. Rocket Money can open one in about 5 minutes. Then you move the $12,000. I'd leave it as a cushion until you name a goal for it.",
    },
    {
      id: "apple-music",
      bucket: "save",
      bucketLabel: "Save money",
      title: "Spotify and Apple Music — about $132 a year if one is extra",
      why: "One of these might be extra — or both might be real. We can't tell from the charges.",
      primary: "Both are real",
      choices: [
        { id: "both", label: "Both are real", impact: "We'll leave them." },
        { id: "extra", label: "One is extra", impact: "We'll sort out which." },
        { id: "unsure", label: "Not sure", impact: "We'll figure it out together." },
      ],
      annualImpact: 131.88,
      chips: ["Could this be a bundle?", "Who uses which?", "Show me the math", "I want to drop one"],
      math: {
        inputs: [
          { label: "Spotify Family", value: "$19.99", note: "Chase ·4412 · Aug 14, Sep 14" },
          { label: "Apple Music Individual", value: "$10.99", note: "Chase ·4412 · Aug 22, Sep 22" },
          { label: "If one is extra", value: "$131.88 / year" },
        ],
        formula: "possible_savings = 10.99 × 12 = $131.88\n(or 19.99 × 12 = $239.88 if Spotify is the extra one)",
        result: "This is a flag, not a cancel. You tell us whether one is leftover, bundled, or both for real.",
        limitation: "We can see two music bills. We can't see bundles, family sharing, or who's listening.",
        confidence: "0.62 → medium. Observation, not a cancel.",
      },
      rowanOpener:
        "Two music charges this month. I don't know if one is bundled into a phone plan, if two people need two apps, or if one is leftover. That's why this isn't a cancel. Tell me what's going on and I'll help from there.",
    },
  ],
  enrichment: {
    id: "ally-transfer",
    bucket: "improve",
    bucketLabel: "A quick question",
    title: "What is this $1,450 to Ally?",
    why: "$1,450 on the 2nd is already spending — one label puts it on the right budget.",
    primary: "Got it",
    categories: [
      { id: "rent", label: "Rent" },
      { id: "mortgage", label: "Mortgage" },
      { id: "person", label: "Paying a person" },
      { id: "other", label: "Something else" },
    ],
    annualImpact: 0,
    chips: ["Why do you need this?", "What if I pick wrong?", "Show me the math"],
    math: {
      inputs: [
        { label: "ACH to Ally", value: "$1,450.00", note: "2nd of each month · 12 months" },
        { label: "Linked Ally ·2291", value: "No matching deposit" },
        { label: "Current category", value: "Uncategorized" },
      ],
      formula: "It's spending we can see. Ally doesn't say what for.\nYour label is the category.",
      result: "One label. Then it sits on the right budget.",
      limitation: "We can see it leave Chase. It does not land in your linked Ally ·2291, and Ally doesn't say what it's for.",
      confidence: "0.54 → question, not a recommendation",
    },
    rowanOpener:
      "On the 2nd every month, $1,450 leaves checking for an Ally account that isn't your linked savings. It's already in spending — Uncategorized. Ally is a bank, so the charge doesn't say rent or a person. One label and it hits the right budget. That's the only reason I'm asking.",
  },
  emptyCopy: {
    title: "You're good this week.",
    body: "Looked on Tuesday. No surprise charges. Peacock still turns paid on the 24th — that's the one on the calendar.",
  },
};

export const houseIntentMaya: Card = {
  id: "house-intent",
  bucket: "goals",
  bucketLabel: "Reach goals",
  title: "Saving for a house? You pay $1,450 a month in rent",
  why: "If a house is on your list, we can check the pace from what you tell us.",
  primary: "Yes",
  counter: "Not right now",
  annualImpact: 0,
  chips: ["Why are you asking?", "What happens if I say yes?"],
  math: {
    inputs: [{ label: "Rent", value: "$1,450 / mo", note: "you just labeled this" }],
    formula: "Yes → Rowan, not more cards.\nNo → rent stays on the budget.",
    result: "One clear question. The rest is a conversation.",
    limitation: "We don't know if you want a house. That's why this is a question.",
    confidence: "0.70 → question, not a recommendation",
  },
  rowanOpener:
    "If you say yes, we talk — saved, price, when, in any order. I can see $12,180 in Ally and I won't assume it's for a house. If you don't know what you can afford, that's Rocket Mortgage, not me inventing a number from rent.",
};

export const ROCKET_MORTGAGE_URL = "https://www.rocketmortgage.com/";
export const HOUSE_DOWN_PCT = 0.1;

export const jordan: Profile = {
  id: "jordan",
  name: "Jordan Hale",
  short: "Strategic Planner · Growing",
  initials: "JH",
  archetype: "Growing — surplus is deployed, analysis is the cost",
  rungNote: "3+ months liquid, match not fully captured, house on pace. Wants monitoring and what-ifs.",
  takeHome: 9400,
  essentials: 5100,
  discretionary: 1240,
  netWorth: 412400,
  netWorthDelta: 2800,
  spendMonth: 6380,
  budgetMonth: 6500,
  fico: 798,
  accounts: [
    { name: "Checking", inst: "Schwab ·1008", balance: 8400, kind: "asset" },
    { name: "Emergency", inst: "Ally HYSA ·4410 · 3.5% APY", balance: 24000, kind: "asset" },
    { name: "House fund", inst: "Vanguard brokerage", balance: 62000, kind: "asset" },
    { name: "401(k)", inst: "Fidelity", balance: 186000, kind: "asset" },
    { name: "HSA", inst: "HealthEquity cash", balance: 6400, kind: "asset" },
    { name: "Brokerage", inst: "Vanguard taxable", balance: 125600, kind: "asset" },
  ],
  teaserCount: 3,
  teaserValue: 3160 + 112,
  cards: [
    {
      id: "match",
      bucket: "wealth",
      bucketLabel: "Build wealth",
      title: "You're missing $3,160 a year of free money from work",
      why: "Increase your 401(k) contributions from your current 4% and unlock $3,160 worth of match a year from your employer. No impact to your house fund target.",
      primary: "Raise to 6%",
      annualImpact: 3160,
      choices: [
        {
          id: "raise6",
          label: "Raise to 6%",
          impact: "Invest an additional ~$184/mo and unlock $3,160/yr more in match",
          recommended: true,
        },
        { id: "raise5", label: "Raise to 5%", impact: "Invest an additional ~$92/mo and unlock $1,580/yr more in match" },
      ],
      chips: ["What is this free money?", "Can I afford 6%?", "This number looks wrong", "Max 401k vs delay the house"],
      math: {
        inputs: [
          { label: "Salary", value: "$158,000" },
          { label: "You put in", value: "4% = $6,320 / yr" },
          { label: "Work adds the same, up to", value: "6%" },
          { label: "Work adds today", value: "$6,320" },
          { label: "Work would add at 6%", value: "$9,480" },
        ],
        formula: "you're missing = 158,000 × 0.02 = $3,160 / yr\nextra from your paycheck = $263.33 / mo before tax\ntake-home ≈ 263.33 × (1 − 0.30) = $184.33 / mo",
        result: "Go to 6%. No impact to your house fund target — $900/mo still covers the $857 it needs.",
        limitation: "The 4% and 6% are from your last pay stub. If that's wrong, tell Rowan.",
        confidence: "0.93 → action card",
      },
      rowanOpener:
        "You put 4% in. Work will match what you put in, up to 6% — free money. The last 2% is $3,160 a year you're not getting. Going to 6% is about $184 more a month from your paycheck. No impact to your house fund target.",
    },
    {
      id: "windfall",
      bucket: "goals",
      bucketLabel: "Reach goals",
      title: "You received $3,200 on Sept 12 — here's where it could go",
      why: "",
      primary: "Send $3,200 to house fund",
      annualImpact: 3200,
      timeBoxed: true,
      choices: [
        {
          id: "house",
          label: "House fund",
          impact: "Meet your goal ~4 months sooner",
          recommended: true,
        },
        { id: "ira", label: "IRA", impact: "Fund your retirement" },
        { id: "hysa", label: "High Interest Ally Account", impact: "About $112 a year" },
      ],
      chips: ["Why the house fund?", "Why not retirement?", "Can I split it?", "Show me the math"],
      math: {
        inputs: [
          { label: "Schwab deposit", value: "$3,200.00", note: "Sept 12 · not on payday cadence" },
          { label: "House remaining", value: "$18,000.00" },
          { label: "House required", value: "$857.14 / mo", note: "21 months to the house fund target, June 2028" },
          { label: "Ally HYSA", value: "3.50%" },
        ],
        formula: "months_pulled_in = 3,200 ÷ 857.14 ≈ 3.7 months, about 4\nHYSA yield on $3,200 = 3,200 × 0.035 = $112 / yr — house fund target unchanged",
        result: "House fund first — about 4 months sooner. This $3,200 is post-tax, so retirement means an IRA, not the 401(k).",
        limitation: "Ranked against your house fund target. This deposit is post-tax, so it doesn't go in the 401(k).",
        confidence: "0.88 → action card with confirm",
      },
      rowanOpener:
        "$3,200 hit Schwab on the 12th — not a paycheck. House fund is the pick: about 4 months sooner on your house fund target. It's post-tax money, so retirement means an IRA, not the 401(k). The high-interest Ally account is about $112 a year and doesn't move the house fund. Split it if you want both — slower, not wrong.",
    },
    {
      id: "hsa",
      bucket: "wealth",
      bucketLabel: "Build wealth",
      title: "Invest $5,400 sitting in HSA cash",
      why: "$6,400 in cash against about $340 a year in claims — your plan lets you invest anything over $1,000.",
      primary: "Invest the extra $5,400",
      annualImpact: 448,
      choices: [
        {
          id: "invest",
          label: "Invest the extra $5,400",
          impact: "$1,000 stays cash for bills",
          recommended: true,
        },
        { id: "cash", label: "Keep it all in cash", impact: "Ready if a big bill shows up" },
      ],
      chips: ["Why would I invest an HSA?", "What if I need it for a doctor?", "Is this like a 401(k)?", "Show me the math"],
      math: {
        inputs: [
          { label: "HSA cash", value: "$6,400.00" },
          { label: "Medical spend, 24-mo avg", value: "$340 / yr" },
          { label: "Invest threshold", value: "$1,000" },
          { label: "Cash to keep", value: "$1,000", note: "~3 years of your medical spend" },
        ],
        formula: "investable = 6,400 − 1,000 = $5,400\nillustrative 7% = $378 / yr — not a fund pick",
        result: "Plan offers investing above $1,000. Not a fund pick.",
        limitation: "I won't name a fund. Allocation help is a different product, and a different legal line.",
        confidence: "0.86 → guided handoff",
      },
      rowanOpener:
        "An HSA is allowed to invest. Most people never hear that. Cash in yours has sat for two years while you spend about $340 a year on medical. Keep ~$1,000 cash for bills. The other $5,400 can grow inside the same tax-free medical wrapper. I won't name a fund — HealthEquity will show you that.",
    },
  ],
  emptyCopy: {
    title: "Quiet week.",
    body: "Looked Tuesday. Cash flow's fine. House is on pace ($900 vs $857). The leftover free money from work is still there whenever you want it — no deadline.",
  },
};
