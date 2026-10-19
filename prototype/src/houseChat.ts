import { type Profile, HOUSE_DOWN_PCT, usd } from "./data";

export type HousePlan = {
  saved: number | null;
  savedSource: "none" | "some" | "all" | null;
  price: number | null;
  months: number | null;
};

export type HouseTurn = {
  plan: HousePlan;
  text: string;
  table?: { h: string[]; rows: string[][] };
  chips: string[];
  openMortgage?: boolean;
};

export const emptyHousePlan = (): HousePlan => ({
  saved: null,
  savedSource: null,
  price: null,
  months: null,
});

export const houseOpener =
  "We'll build this from three things you know better than I do — how much is already for a house, what price you're aiming at, and when.\n\nI can see $12,180 in Ally. Nothing's labeled house. That's not a house fund unless you say so.\n\nStart anywhere. Or ask why I need one of them.";

export const houseComplete = (p: HousePlan) => p.saved !== null && p.price !== null && p.months !== null;

export function houseResume(plan: HousePlan): { text: string; chips: string[] } {
  if (houseComplete(plan)) {
    return {
      text: "Still here. Change saved, price, or when — or ask about the 10%, or emergency vs house vs 401(k).",
      chips: houseChips(plan),
    };
  }
  if (plan.saved !== null || plan.price !== null || plan.months !== null) {
    return {
      text: `Still building the house plan.\n\n${askNext(plan)}`,
      chips: houseChips(plan),
    };
  }
  return { text: houseOpener, chips: houseChips(plan) };
}

const monthsLabel = (m: number) => (m <= 24 ? "about 2 years" : m <= 48 ? "3–5 years" : "5+ years");

const complete = houseComplete;

export function houseChips(plan: HousePlan): string[] {
  if (complete(plan)) {
    return ["Why 10% down?", "Emergency vs house vs 401(k)", "Change the date", "Change the price", "Change what's saved"];
  }
  const chips: string[] = [];
  if (plan.saved === null) {
    chips.push("None of Ally is for a house", "All $12,180 in Ally");
  }
  if (plan.price === null) {
    chips.push("$300k–$400k", "I don't know what I can afford");
  }
  if (plan.months === null) {
    chips.push("3–5 years", "About 2 years");
  }
  chips.push("Why these three?");
  return chips;
}

export function takeHouseTurn(profile: Profile, prev: HousePlan, raw: string): HouseTurn {
  const t = raw.trim();
  const low = t.toLowerCase();
  const ally = profile.accounts.find((a) => a.name === "Savings")?.balance ?? 0;

  if (low.includes("why these three") || (low.includes("why") && low.includes("need") && !low.includes("10%"))) {
    return {
      plan: prev,
      text: "Pace is (down payment − saved) ÷ months. Missing any one, I can only shrug.\n\nSaved: so we don't count Ally twice — or miss a pile you already have.\nPrice: you name it, or Rocket Mortgage does. I won't invent one from rent.\nWhen: turns 'save more' into a monthly number.\n\nAny order. Type a number, a band, or a when.",
      chips: houseChips(prev),
    };
  }

  if (low.includes("10%") || low.includes("why 10")) {
    return {
      plan: prev,
      text: "It's a working assumption so we can do the pace — not a rule that you put 10% down. 20% doubles the target. 5% halves it. Say which and I'll rerun.",
      chips: houseChips(prev),
    };
  }

  if (low.includes("emergency") || (low.includes("401") && (low.includes("house") || low.includes("vs")))) {
    return {
      plan: prev,
      text: "Three buckets, three jobs.\n\nEmergency: about 3 months of bills, liquid, don't touch it for a down payment.\nHouse: a dated pile. High-yield savings is enough — not the 401(k).\nRetirement: stays in the 401(k).\n\nMixing them is how people get unlucky twice.",
      chips: houseChips(prev),
    };
  }

  const wantMortgage =
    low.includes("don't know what i can afford") ||
    low.includes("don't know what i can") ||
    low.includes("rocket mortgage") ||
    low.includes("what can i afford") ||
    (low.includes("don't know") && (low.includes("afford") || low.includes("price") || low.includes("yet")));

  if (wantMortgage && prev.price === null) {
    const rest = houseChips(prev).filter((c) => c !== "I don't know what I can afford" && c !== "$300k–$400k");
    return {
      plan: prev,
      text: "That's Rocket Mortgage — a real application with income, debts, credit. I won't approximate it from $1,450 rent.\n\nI'll open it. When you have a number, type it or tap a band.",
      chips: ["$300k–$400k", "Around $250k", "Open Rocket Mortgage again", ...rest],
      openMortgage: true,
    };
  }

  if (low.includes("open rocket mortgage")) {
    return {
      plan: prev,
      text: "Opening Rocket Mortgage. Come back with a number — I'll wait.",
      chips: houseChips(prev),
      openMortgage: true,
    };
  }

  const next: HousePlan = { ...prev };
  const heard: string[] = [];

  const savedHit = parseSaved(low, t, ally);
  if (savedHit && (low.includes("change the saved") || low.includes("already") || prev.saved === null || savedHit.force)) {
    next.saved = savedHit.saved;
    next.savedSource = savedHit.source;
    heard.push(savedHit.saved === 0 ? "nothing set aside yet" : `${usd(savedHit.saved)} already for a house`);
  } else if (savedHit && prev.saved === null) {
    next.saved = savedHit.saved;
    next.savedSource = savedHit.source;
    heard.push(savedHit.saved === 0 ? "nothing set aside yet" : `${usd(savedHit.saved)} already for a house`);
  }

  const priceHit = parsePrice(low, t);
  if (priceHit && (prev.price === null || low.includes("change the price") || low.includes("price"))) {
    next.price = priceHit;
    heard.push(`aiming at ${usd(priceHit)}`);
  } else if (priceHit && prev.price === null) {
    next.price = priceHit;
    heard.push(`aiming at ${usd(priceHit)}`);
  }

  const monthsHit = parseMonths(low);
  if (monthsHit && (prev.months === null || low.includes("change the date") || low.includes("year"))) {
    next.months = monthsHit;
    heard.push(`when: ${monthsLabel(monthsHit)}`);
  } else if (monthsHit && prev.months === null) {
    next.months = monthsHit;
    heard.push(`when: ${monthsLabel(monthsHit)}`);
  }

  if ((low.includes("change the date") || low.includes("change what's saved") || low.includes("change the saved")) && !monthsHit && !savedHit && !low.includes("change the price")) {
    if (low.includes("change the date")) {
      return {
        plan: prev,
        text: "Say about 2 years, 3–5, or 5+. Closest is enough.",
        chips: ["About 2 years", "3–5 years", "5+ years"],
      };
    }
    return {
      plan: prev,
      text: "None, some, or all of the $12,180 in Ally — or type a dollar amount.",
      chips: ["None of Ally is for a house", "All $12,180 in Ally"],
    };
  }

  if (low.includes("change the price") && !priceHit) {
    return {
      plan: prev,
      text: "Give me a number or a band. Or open Rocket Mortgage if you still don't know.",
      chips: ["Around $250k", "$300k–$400k", "$400k–$500k", "I don't know what I can afford"],
    };
  }

  if (!heard.length && !complete(next)) {
    return {
      plan: prev,
      text: "I didn't catch a saved amount, a price, or a when. Tap a chip, or type something like “none of it,” “around 350k,” or “in 3 years.”",
      chips: houseChips(prev),
    };
  }

  if (complete(next) && next.saved !== null && next.price !== null && next.months !== null && next.savedSource) {
    const view = analyze(profile, {
      saved: next.saved,
      savedSource: next.savedSource,
      price: next.price,
      months: next.months,
    });
    const ack = heard.length ? `Got it — ${heard.join(", ")}.\n\n` : "";
    return {
      plan: next,
      text: ack + view.text,
      table: view.table,
      chips: houseChips(next),
    };
  }

  const ack = heard.length ? `Got it — ${heard.join(", ")}.` : "Okay.";
  return {
    plan: next,
    text: `${ack}\n\n${askNext(next)}`,
    chips: houseChips(next),
  };
}

function parseSaved(low: string, raw: string, ally: number): { saved: number; source: "none" | "some" | "all"; force?: boolean } | null {
  if (
    low.includes("none of ally") ||
    low.includes("none yet") ||
    low.includes("nothing yet") ||
    low.includes("starting from zero") ||
    low === "none" ||
    low.includes("none of it")
  ) {
    return { saved: 0, source: "none", force: true };
  }
  if (low.includes("all $12,180") || low.includes("all 12180") || low.includes("all of ally") || low.includes("all of it") || low.includes("all $12180")) {
    return { saved: ally, source: "all", force: true };
  }
  if (/\byears?\b/.test(low) && !low.includes("saved") && !low.includes("aside")) return null;
  const n = parseMoney(raw);
  if (n !== null && n < 80000 && (low.includes("saved") || low.includes("aside") || low.includes("ally") || low.includes("some"))) {
    return { saved: Math.min(n, ally), source: n >= ally ? "all" : "some", force: true };
  }
  if (n !== null && n < 50000 && !looksLikePrice(low)) {
    return { saved: Math.min(n, ally), source: n >= ally ? "all" : n === 0 ? "none" : "some" };
  }
  return null;
}

function parsePrice(low: string, raw: string): number | null {
  if (low.includes("$300k–$400k") || low.includes("$300k-$400k") || low.includes("300k–400") || low.includes("300-400") || low.includes("300,000 – 400") || low.includes("$300,000")) {
    return 350000;
  }
  if (low.includes("$400k–$500k") || low.includes("400-500") || low.includes("$400,000")) {
    return 450000;
  }
  if (low.includes("around $250") || low.includes("250k") || low.includes("$250,000")) {
    return 250000;
  }
  if (low.includes("$500k+") || low.includes("500k+") || low.includes("$500,000+")) {
    return 600000;
  }
  const n = parseMoney(raw);
  if (n !== null && n >= 80000) return n;
  const k = low.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (k) {
    const v = Math.round(Number(k[1]) * 1000);
    if (v >= 80000) return v;
  }
  return null;
}

function parseMonths(low: string): number | null {
  if (low.includes("about 2 years") || low.includes("2 years") || low.includes("~2")) return 24;
  if (low.includes("3–5") || low.includes("3-5") || low.includes("3 to 5")) return 48;
  if (low.includes("5+ years") || low.includes("5+") || low.includes("five plus") || low.includes("5 years")) return 72;
  const y = low.match(/in\s+(\d+)\s+years?/);
  if (y) {
    const n = Number(y[1]);
    if (n <= 2) return 24;
    if (n <= 5) return 48;
    return 72;
  }
  return null;
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "");
  const m = cleaned.match(/\$?\s*(\d{1,7})(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!n && n !== 0) return null;
  return n;
}

function looksLikePrice(low: string): boolean {
  return low.includes("k") || low.includes("home") || low.includes("house") || low.includes("price") || low.includes("afford");
}

function askNext(plan: HousePlan): string {
  const skips: string[] = [];
  if (plan.saved === null) skips.push("how much is already saved");
  if (plan.price === null) skips.push("a price");
  if (plan.months === null) skips.push("a when");

  if (plan.saved === null) {
    const rest = skips.filter((s) => s !== "how much is already saved");
    const extra = rest.length ? ` You can also skip this and give me ${rest.join(" or ")}.` : "";
    return "How much of the $12,180 in Ally is for a house — none, some, or all?" + extra;
  }
  if (plan.price === null) {
    const extra = plan.months === null ? " You can also skip this and give me a when." : "";
    return "What price are you aiming at? A band is enough. If you don't know what you can afford, Rocket Mortgage can tell you — I won't guess from rent." + extra;
  }
  if (plan.months === null) {
    return "When are you hoping to buy — about 2 years, 3–5, or 5+? Closest is enough.";
  }
  return "Say if you want to change saved, price, or when.";
}

function analyze(
  profile: Profile,
  p: { saved: number; savedSource: "none" | "some" | "all"; price: number; months: number },
): { text: string; table: { h: string[]; rows: string[][] } } {
  const leftover = profile.discretionary;
  const essentials = profile.essentials;
  const ally = profile.accounts.find((a) => a.name === "Savings")?.balance ?? 0;
  const buffer = essentials * 3;
  const target = Math.round(p.price * HOUSE_DOWN_PCT);
  const gap = Math.max(0, target - p.saved);
  const need = gap / p.months;
  const onTrack = gap === 0 || leftover >= need;
  const monthsAtLeftover = leftover > 0 ? Math.ceil(gap / leftover) : 99;
  const hysaExtra = Math.round(p.saved * (0.035 - 0.0038));
  const allyLeft = Math.max(0, ally - p.saved);
  const bufferShort = p.savedSource === "all" || allyLeft < buffer;

  const pace = onTrack
    ? `You're on track. 10% down on ${usd(p.price)} is ${usd(target)}. You have ${usd(p.saved)}, leftover is ${usd(leftover)}/mo, and that covers the ${usd(Math.round(need))}/mo over ${monthsLabel(p.months)}. That's the one to celebrate.`
    : `Not on track at this date. 10% down on ${usd(p.price)} is ${usd(target)}. You have ${usd(p.saved)}, so ${usd(gap)} to go — ${usd(Math.round(need))}/mo over ${monthsLabel(p.months)}. Leftover is ${usd(leftover)}/mo. At that rate you'd get there in about ${monthsAtLeftover} months, or the price comes down.`;

  const park =
    p.saved > 0
      ? `\n\nThat ${usd(p.saved)} is in Ally at 0.38%. High-yield is the same kind of account at about 3.5% — about ${usd(hysaExtra)} more a year. Same-day access, FDIC-insured. Not the stock market.`
      : `\n\nNo house pile yet. Don't raid the ${usd(ally)} in Ally to start one if that's your buffer.`;

  const order = bufferShort
    ? `\n\nI'd keep about ${usd(buffer)} as emergency (3 months of bills) before treating Ally as a down payment. The 401(k) is retirement — don't pause it to catch a date.`
    : `\n\nKeep emergency (about 3 months of bills) separate from the house pile. 401(k) stays retirement. Leftover is what can feed the house.`;

  return {
    text: pace + park + order + "\n\n10% down is a working number, not a requirement. Change saved, price, or when anytime.",
    table: {
      h: ["", ""],
      rows: [
        ["Price (you)", usd(p.price)],
        ["10% down", usd(target)],
        ["Saved (you)", usd(p.saved)],
        ["Gap", usd(gap)],
        ["When (you)", monthsLabel(p.months)],
        ["Need / month", usd(Math.round(need))],
        ["Leftover", `${usd(leftover)} / mo`],
      ],
    },
  };
}
