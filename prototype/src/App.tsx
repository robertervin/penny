import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  type Card,
  type Profile,
  type ProfileId,
  type Tier,
  bucketClass,
  houseIntentMaya,
  jordan,
  maya,
  ROCKET_MORTGAGE_URL,
  usd,
} from "./data";
import { IconBell, IconBudget, IconGoals, IconHome, IconMore, IconProfile, IconSpark, Phone } from "./chrome";
import {
  type HousePlan,
  emptyHousePlan,
  houseChips,
  houseComplete,
  houseOpener,
  houseResume,
  takeHouseTurn,
} from "./houseChat";

type Tab = "home" | "budget" | "recs" | "goals" | "more";
type Stack =
  | { name: "none" }
  | { name: "rowan"; card?: Card; seed?: string; mode?: "house" }
  | { name: "paywall" };

type LedgerItem = { id: string; label: string; value: string };

const now = "9:41";

function RecCard({
  card,
  locked,
  compact,
  full,
  preview,
  onOpen,
  onPrimary,
  onCounter,
  onChat,
}: {
  card: Card;
  locked?: boolean;
  compact?: boolean;
  full?: boolean;
  preview?: boolean;
  onOpen?: () => void;
  onPrimary?: (category?: string) => void;
  onCounter?: () => void;
  onChat?: () => void;
}) {
  const [category, setCategory] = useState("");
  const [choice, setChoice] = useState("");
  const [amount, setAmount] = useState("");
  const isCategorize = Boolean(card.categories?.length);
  const isChoices = Boolean(card.choices?.length);
  const amountChoice = card.choices?.find((c) => c.id === choice && c.needsAmount);

  return (
    <article className={`card ${locked ? "locked" : ""} ${full ? "rec-card-full" : ""} ${preview ? "rec-card-preview" : ""}`} onClick={locked ? undefined : onOpen} style={{ cursor: onOpen && !locked ? "pointer" : "default" }}>
      <div className="rec-head">
        <span className={`pill ${bucketClass[card.bucket]}`}>{card.bucketLabel}</span>
        {card.timeBoxed ? <span className="badge">DUE</span> : null}
      </div>
      <h3 className="rec-title">{card.title}</h3>
      {!compact && card.why ? <p className="rec-why">{card.why}</p> : null}
      {!locked && !compact && !preview && (onPrimary || onCounter || onChat) ? (
        <>
          {isCategorize ? (
            <div className="cat-field">
              <label className="cat-label" htmlFor={`cat-${card.id}`}>
                Category
              </label>
              <select
                id={`cat-${card.id}`}
                value={category}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {card.categories?.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                disabled={!category}
                onClick={(e) => {
                  e.stopPropagation();
                  onPrimary?.(category);
                }}
              >
                {card.primary}
              </button>
            </div>
          ) : isChoices ? (
            <div className="choice-list">
              {card.choices?.map((opt) => (
                <button
                  key={opt.id}
                  className={`btn btn-choice ${choice === opt.id ? "on" : ""} ${opt.recommended ? "recommended" : ""}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (opt.needsAmount) {
                      setChoice(opt.id);
                      return;
                    }
                    onPrimary?.(opt.id);
                  }}
                >
                  <span className="choice-head">
                    <span className="choice-label">{opt.label}</span>
                    {opt.recommended ? <span className="choice-rec">Recommended</span> : null}
                  </span>
                  {opt.impact ? <span className="choice-impact">{opt.impact}</span> : null}
                </button>
              ))}
              {amountChoice ? (
                <div className="cat-field" style={{ marginTop: 4 }}>
                  <label className="cat-label" htmlFor={`amt-${card.id}`}>
                    Amount
                  </label>
                  <input
                    id={`amt-${card.id}`}
                    inputMode="numeric"
                    placeholder="e.g. 5000"
                    value={amount}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={!amount}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrimary?.(`${choice}:${amount}`);
                    }}
                  >
                    Save
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="btn-row">
              <button
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrimary?.();
                }}
              >
                {card.primary}
              </button>
              {card.counter ? (
                <button
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCounter?.();
                  }}
                >
                  {card.counter}
                </button>
              ) : null}
            </div>
          )}
          {onChat ? (
            <button
              className="chat-this"
              onClick={(e) => {
                e.stopPropagation();
                onChat();
              }}
            >
              Chat about this
            </button>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function SwipeDeck({
  cards,
  onSkip,
  onAccept,
  onPrimary,
  onCounter,
  onChat,
  onNeedCategory,
}: {
  cards: Card[];
  onSkip: (c: Card) => void;
  onAccept: (c: Card) => void;
  onPrimary: (c: Card, category?: string) => void;
  onCounter: (c: Card) => void;
  onChat: (c: Card) => void;
  onNeedCategory?: () => void;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const holding = useRef(false);
  const flying = useRef(false);
  const top = cards[0];

  if (!top) return null;

  const settle = () => {
    holding.current = false;
    flying.current = false;
    posRef.current = { x: 0, y: 0 };
    setPos({ x: 0, y: 0 });
    setDragging(false);
  };

  const commit = (dir: "left" | "right") => {
    if (flying.current) return;
    if (dir === "right" && (top.categories?.length || top.choices?.length)) {
      settle();
      onNeedCategory?.();
      return;
    }
    flying.current = true;
    holding.current = false;
    setDragging(false);
    const next = { x: dir === "right" ? 460 : -460, y: 20 };
    posRef.current = next;
    setPos(next);
    window.setTimeout(() => {
      if (dir === "right") onAccept(top);
      else onSkip(top);
      settle();
    }, 220);
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (flying.current) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, select, .cat-field, .choice-list, input")) return;
    holding.current = true;
    start.current = { x: e.clientX, y: e.clientY };
    posRef.current = { x: 0, y: 0 };
    setPos({ x: 0, y: 0 });
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!holding.current || flying.current) return;
    const next = {
      x: e.clientX - start.current.x,
      y: (e.clientY - start.current.y) * 0.22,
    };
    posRef.current = next;
    setPos(next);
  };

  const onUp = () => {
    if (flying.current) return;
    if (!holding.current) return;
    holding.current = false;
    const x = posRef.current.x;
    if (x > 108) commit("right");
    else if (x < -108) commit("left");
    else settle();
  };

  const rot = pos.x / 18;
  const yes = Math.max(0, Math.min(1, pos.x / 120));
  const no = Math.max(0, Math.min(1, -pos.x / 120));
  const behind = cards.slice(1, 3);

  return (
    <div className="deck">
      <div className="deck-stack">
        {behind
          .map((c, i) => (
            <div
              key={c.id}
              className="deck-card behind"
              style={{
                transform: `scale(${0.97 - i * 0.03}) translateY(${10 + i * 8}px)`,
              }}
            >
              <RecCard card={c} full />
            </div>
          ))
          .reverse()}
        <div
          className="deck-card"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={settle}
          onLostPointerCapture={() => {
            if (holding.current && !flying.current) settle();
          }}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg)`,
            transition: dragging ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
            zIndex: 3,
            cursor: dragging ? "grabbing" : "grab",
          }}
        >
          <div className="stamp yes" style={{ opacity: yes }}>
            DO IT
          </div>
          <div className="stamp no" style={{ opacity: no }}>
            SKIP
          </div>
          <RecCard
            key={top.id}
            card={top}
            full
            onPrimary={(category) => onPrimary(top, category)}
            onCounter={() => onCounter(top)}
            onChat={() => onChat(top)}
          />
        </div>
      </div>
    </div>
  );
}

function Status() {
  return (
    <div className="status-bar">
      <span>{now}</span>
      <span>LTE ████</span>
    </div>
  );
}

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: typeof IconHome }[] = [
    { id: "home", label: "Home", icon: IconHome },
    { id: "budget", label: "Budget", icon: IconBudget },
    { id: "recs", label: "Recs", icon: IconSpark },
    { id: "goals", label: "Goals", icon: IconGoals },
    { id: "more", label: "More", icon: IconMore },
  ];
  return (
    <nav className="tabbar">
      {items.map((it) => {
        const on = tab === it.id;
        const Icon = it.icon;
        return (
          <button key={it.id} className={`tab ${on ? "on" : ""}`} onClick={() => onTab(it.id)}>
            <Icon on={on} />
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

function Top({ title }: { title?: string }) {
  return (
    <div className="topbar">
      <button className="top-icon" aria-label="Profile">
        <IconProfile />
      </button>
      <div className="top-title">{title ?? "Rocket Money"}</div>
      <button className="top-icon" aria-label="Notifications">
        <IconBell />
      </button>
    </div>
  );
}

type Msg = { who: "rowan" | "me"; text: string; table?: { h: string[]; rows: string[][] } };

function rowanReply(profile: Profile, card: Card | undefined, q: string): Msg {
  const t = q.toLowerCase();

  if (t.includes("show me the math") && card) {
    return {
      who: "rowan",
      text: `${card.math.formula}\n\n${card.math.result}\n\nLimitation: ${card.math.limitation}`,
      table: {
        h: ["Input", "Value"],
        rows: card.math.inputs.map((r) => [r.label, r.value]),
      },
    };
  }

  if (card?.id === "apple-music" && (t.includes("bundle") || t.includes("who uses") || t.includes("who's using") || t.includes("drop one") || t.includes("going on") || t.includes("family cover") || t.includes("downgrade") || t.includes("one is extra") || t.includes("not sure"))) {
    return {
      who: "rowan",
      text: "I won't cancel anything from here. Two charges isn't the same as two mistakes.\n\nCould be a phone bundle. Could be two people. Could be one leftover from last year.\n\nIf you tell me which of those it is — or that you actually want to drop one — I'll help with the next step. If both are real, we leave it.",
    };
  }

  if (t.includes("max") && (t.includes("401") || t.includes("house"))) {
    return {
      who: "rowan",
      text: "You can max the 401(k) and push the house a year. Doable. Not free — it's a preference.",
      table: {
        h: ["", "Keep date", "Max 401k, house 2029"],
        rows: [
          ["401(k) you put in", "$6,320/yr", "$24,500/yr"],
          ["Work adds", "$6,320", "$9,480"],
          ["Take-home hit", "—", "~$1,061/mo"],
          ["House contribution", "$900/mo", "$545/mo"],
          ["House date", "Jun 2028", "Jun 2029"],
          ["Discretionary left", "$1,240", "$535"],
        ],
      },
    };
  }

  if (t.includes("afford") && card?.id === "match") {
    return {
      who: "rowan",
      text: "Yes. $184 a month from leftover of $1,240. House at $900 still covers the $857 you need. Raising to 6% has no impact to your house fund target.",
    };
  }

  if (card?.id === "match" && (t.includes("free money") || t.includes("what is a match") || t.includes("what is match"))) {
    return {
      who: "rowan",
      text: "Your work puts in money when you do. You put 4% of pay into retirement, they put in the same, up to 6%. That extra from them is free — people call it a match.\n\nYou're not getting the last 2% yet. That's $3,160 a year. Raising yours to 6% is how you turn it on.",
    };
  }

  if (card?.id === "match" && (t.includes("looks wrong") || t.includes("formula") || t.includes("number looks"))) {
    return {
      who: "rowan",
      text: "I used 4% in and 6% from work, from your last pay stub. If the plan changed, say so. I won't raise anything from here.",
    };
  }

  if (t.includes("why do you need") || t.includes("why does this change") || t.includes("either way") || t.includes("what happens after")) {
    return {
      who: "rowan",
      text: "It's already spending. Ally just doesn't say what for, so it's sitting in Uncategorized. Your label is how it gets on the right budget. If it's rent, I'll ask whether a house is even on your mind — I won't turn rent into a house price.",
    };
  }

  if (t.includes("pick wrong") || t.includes("change it") || t.includes("wrong categor")) {
    return {
      who: "rowan",
      text: "Wrong is fixable. Guessing from here isn't. Pick the closest one. You can recategorize later.",
    };
  }

  if (
    (card?.id === "windfall" || (!card && profile.id === "jordan")) &&
    (t.includes("ranking") || t.includes("why not") || t.includes("split") || t.includes("house fund") || t.includes("why the house"))
  ) {
    return {
      who: "rowan",
      text: "For this $3,200:\n1. House fund — about 4 months sooner. That's the pick because you already have a house fund target.\n2. IRA — this is post-tax money, so it doesn't belong in the 401(k). It still funds retirement.\n3. High-interest Ally — about $112 a year. No impact to your house fund target.\n\nNo high-rate debt, so the house fund wins. Split it if you want both; it's slower, not wrong.",
    };
  }

  if (card?.id === "idle-cash" && (t.includes("what is") || t.includes("high-yield") || t.includes("hysa"))) {
    return {
      who: "rowan",
      text: "It's a savings account that pays more than a regular one. Same idea as Ally — you put money in, you take it out when you need it. Banks are offering about 3.5% right now vs Ally's 0.38%. Not the stock market. Not a lockup. FDIC-insured, same as a normal bank. Rocket Money can open one in about 5 minutes with a partner bank.",
    };
  }

  if (card?.id === "idle-cash" && (t.includes("safe") || t.includes("scam") || t.includes("trust"))) {
    return {
      who: "rowan",
      text: "It's a bank account, not an app balance. FDIC-insured up to $250,000, same protection Ally has. You can pull the money the same day. Rocket Money doesn't keep it — we help you open the account, then the money sits at the bank. If this feels off, don't do it. Chat with me first.",
    };
  }

  if (card?.id === "idle-cash" && (t.includes("emergency") || t.includes("buffer"))) {
    return {
      who: "rowan",
      text: "Yes. $12,000 covers about 3.7 months of bills ($3,240 × 3). That's a real cushion. The problem isn't that it's sitting there — it's that Ally is paying 0.38% for it.",
    };
  }

  if (card?.id === "house-intent" && (t.includes("why are you asking") || t.includes("why ask"))) {
    return {
      who: "rowan",
      text: "Because I don't know. Rent is $1,450. That doesn't mean you're saving for a house. If you are — or want to start — we talk: saved, price, when, in any order. If not, we stop.",
    };
  }

  if (card?.id === "house-intent" && (t.includes("say yes") || t.includes("what happens"))) {
    return {
      who: "rowan",
      text: "You and I talk it through. What's already saved, a price, a when — any order, and you can ask why I need each one. I can see $12,180 in Ally; I won't assume it's for a house. If you don't know what you can afford, that's Rocket Mortgage, not me guessing from rent. Once I have those three I can tell you if leftover of $412 gets you there.",
    };
  }

  if (card?.id === "idle-cash" && (t.includes("house") || t.includes("better than") || t.includes("goal"))) {
    return {
      who: "rowan",
      text: "You don't have a house goal set — and I won't invent one from this $12,000. It's savings. Open the high-yield account so it earns 3.5%. If you later want a house, you tell me. I won't spend it for you.",
    };
  }

  if (t.includes("leave in checking") || t.includes("how much should i leave")) {
    return {
      who: "rowan",
      text: "Leave the $2,240 in checking — a couple of weeks of bills. Open the high-yield account, then move the $12,000. Ally at 0.38% is the miss, not checking.",
    };
  }

  if (card?.id === "hsa" && (t.includes("why would i invest") || t.includes("invest an hsa") || t.includes("why invest"))) {
    return {
      who: "rowan",
      text: "Most people never hear this: an HSA can invest, not just hold cash.\n\nCash sits. Investing the extra means that money can grow — still for medical later, still tax-free if you use it that way. You spend about $340 a year, so most of the $6,400 isn't working.\n\nKeep about $1,000 cash for near-term bills. HealthEquity lets you invest anything over that. I won't pick a fund.",
    };
  }

  if (card?.id === "hsa" && (t.includes("doctor") || t.includes("need it") || t.includes("cash should") || t.includes("medical"))) {
    return {
      who: "rowan",
      text: "Keep about $1,000 cash — that's three years of your $340 medical average, and HealthEquity's floor to invest. A normal doctor visit doesn't need $6,400 sitting idle. If a big bill lands, you can sell investments inside the HSA. I'm not telling you to drain cash to zero.",
    };
  }

  if (card?.id === "hsa" && (t.includes("401") || t.includes("like a") || t.includes("different") || t.includes("tax"))) {
    return {
      who: "rowan",
      text: "Same idea as a 401(k) — money can be invested — different job. 401(k) is retirement, and you're still missing free money from work there. HSA is medical: tax-free in, growth, and qualified spend. This card is only about cash sitting in the HSA. Not a fund pick.",
    };
  }

  if (t.includes("trial") || t.includes("how do you know")) {
    return {
      who: "rowan",
      text: "Aug 25 was a $0 hold from Peacock — that's how trials usually show up. First real charge is $13.99 on Sept 24. That's all I used. I don't know if you've watched anything.",
    };
  }

  if (t.includes("cancel today") || t.includes("if i cancel") || t.includes("what happens if i cancel")) {
    return {
      who: "rowan",
      text: "Cancel and you keep Peacock through the 24th. The $13.99 never posts. The cancellation usually takes a few days, so tap by the 23rd to be safe. If you're still watching, keep it — that's the first question, not cancel.",
    };
  }

  if (t.includes("only raise 1%") || t.includes("raise 1") || t.includes("raise to 5") || t.includes("only raise")) {
    return {
      who: "rowan",
      text: "5% gets half the leftover free money: $1,580 a year. Paycheck dips about $92 a month. Still leaves $1,580 on the table. 6% is the one that actually finishes the job.",
    };
  }

  if (card?.rowanOpener && (t.includes("explain") || t === "hi")) {
    return { who: "rowan", text: card.rowanOpener };
  }

  if (card) {
    return {
      who: "rowan",
      text: "I can show the math, what I skipped, or a what-if. Tap a chip — I won't reread the card at you.",
    };
  }

  if (profile.id === "jordan") {
    return {
      who: "rowan",
      text: "Watching: $3,160 of free money from work you're not taking, the $3,200 from the 12th, and $6,400 sitting in HSA cash. Ask 'max 401k vs delay the house' if you want the table.",
    };
  }
  return {
    who: "rowan",
    text: "Live cards: Peacock by the 23rd, Ally paying 0.38% on $12,000, and that $1,450 Ally transfer I won't categorize for you. I won't invent a fourth.",
  };
}

export default function App() {
  const [profileId, setProfileId] = useState<ProfileId>("maya");
  const [tier, setTier] = useState<Tier>("premium");
  const [quiet, setQuiet] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Stack>({ name: "none" });
  const [toast, setToast] = useState<string | null>(null);
  const [answeredEnrichment, setAnsweredEnrichment] = useState<string | null>(null);
  const [houseIntent, setHouseIntent] = useState<"yes" | "no" | null>(null);
  const [housePlan, setHousePlan] = useState<HousePlan>(emptyHousePlan);
  const [houseChipList, setHouseChipList] = useState<string[]>(() => houseChips(emptyHousePlan()));
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");

  const base = profileId === "maya" ? maya : jordan;

  const liveCards = useMemo(() => {
    let cards = [...base.cards];
    if (profileId === "maya" && !answeredEnrichment && base.enrichment) {
      cards = [...cards, base.enrichment];
    }
    if (profileId === "maya" && answeredEnrichment === "rent" && !houseIntent) {
      cards = [...cards, houseIntentMaya];
    }
    if (quiet) cards = [];
    return cards.filter((c) => !dismissed.includes(c.id));
  }, [base, profileId, answeredEnrichment, houseIntent, quiet, dismissed]);

  const topCard = liveCards[0];

  const flash = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(null), 2400);
  };

  const openRowan = (card?: Card, seed?: string) => {
    const opener: Msg[] = [];
    if (card) opener.push({ who: "rowan", text: card.rowanOpener });
    else opener.push(rowanReply(base, undefined, "hi"));
    if (seed) {
      opener.push({ who: "me", text: seed });
      opener.push(rowanReply(base, card, seed));
    }
    setMsgs(opener);
    setDraft("");
    setStack({ name: "rowan", card, seed });
  };

  const openHouseChat = (resume = false) => {
    const start = resume ? houseResume(housePlan) : { text: houseOpener, chips: houseChips(emptyHousePlan()) };
    if (!resume) setHousePlan(emptyHousePlan());
    setHouseChipList(start.chips);
    setMsgs([{ who: "rowan", text: start.text }]);
    setDraft("");
    setStack({ name: "rowan", mode: "house" });
  };

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    const houseMode = stack.name === "rowan" && stack.mode === "house";
    if (houseMode) {
      const turn = takeHouseTurn(base, housePlan, q);
      setHousePlan(turn.plan);
      setHouseChipList(turn.chips);
      if (turn.openMortgage) {
        window.open(ROCKET_MORTGAGE_URL, "_blank", "noopener,noreferrer");
      }
      setMsgs((m) => [...m, { who: "me", text: q }, { who: "rowan", text: turn.text, table: turn.table }]);
      setDraft("");
      return;
    }
    const card = stack.name === "rowan" ? stack.card : undefined;
    setMsgs((m) => [...m, { who: "me", text: q }, rowanReply(base, card, q)]);
    setDraft("");
  };

  const act = (card: Card, category?: string) => {
    if (tier === "free") {
      setStack({ name: "paywall" });
      return;
    }
    if (card.choices?.length && !category) {
      flash("Pick an option.");
      return;
    }
    if (card.id === "ally-transfer") {
      if (!category) {
        flash("Pick a category first.");
        return;
      }
      setAnsweredEnrichment(category);
      setDismissed((d) => [...d, card.id]);
      if (category === "rent") {
        flash("Got it — rent. $1,450 will sit on housing.");
      } else if (category === "mortgage") {
        flash("Got it — mortgage. $1,450 will sit on housing.");
      } else if (category === "person") {
        flash("Got it. I'll treat it as money you send.");
      } else {
        flash("Saved. It's on the right budget.");
      }
      setStack({ name: "none" });
      return;
    }
    if (card.id === "peacock") {
      setDismissed((d) => [...d, card.id]);
      if (category === "cancel") {
        setLedger((l) => [
          { id: card.id, label: "Cancel Peacock before first charge", value: `${usd(card.annualImpact, 2)} / yr` },
          ...l,
        ]);
        flash("We'll cancel before you're charged. You keep it through the 24th.");
      } else {
        flash("Got it. Peacock stays. $13.99 posts on the 24th.");
      }
      setStack({ name: "none" });
      return;
    }
    if (card.id === "apple-music") {
      if (category === "both") {
        setDismissed((d) => [...d, card.id]);
        flash("Got it. Both stay.");
        setStack({ name: "none" });
        return;
      }
      openRowan(card, category === "extra" ? "One is extra" : "Not sure");
      return;
    }
    if (card.id === "house-intent") {
      setHouseIntent("yes");
      setDismissed((d) => [...d, card.id]);
      openHouseChat();
      return;
    }
    if (card.id === "idle-cash") {
      setDismissed((d) => [...d, card.id]);
      if (category === "hysa") {
        setLedger((l) => [
          { id: card.id, label: "Open high-yield savings", value: `${usd(card.annualImpact)} / yr` },
          ...l,
        ]);
        flash("Opening high-yield savings — about 5 minutes.");
      } else {
        flash("Left in Ally. 0.38% stays.");
      }
      setStack({ name: "none" });
      return;
    }
    if (card.id === "match") {
      setDismissed((d) => [...d, card.id]);
      if (category === "raise6") {
        setLedger((l) => [{ id: card.id, label: "Raise 401(k) to 6%", value: `${usd(3160)} / yr` }, ...l]);
        flash("Next: Fidelity. Raise to 6% so work adds the rest.");
      } else if (category === "raise5") {
        setLedger((l) => [{ id: card.id, label: "Raise 401(k) to 5%", value: `${usd(1580)} / yr` }, ...l]);
        flash("5% gets half. Work still isn't adding the last $1,580.");
      } else {
        flash("Got it.");
      }
      setStack({ name: "none" });
      return;
    }
    if (card.id === "windfall") {
      setDismissed((d) => [...d, card.id]);
      if (category === "house") {
        setLedger((l) => [{ id: card.id, label: "Send $3,200 to house fund", value: "~4 mo sooner" }, ...l]);
        flash("Sending $3,200 to the house fund. About 4 months sooner.");
      } else if (category === "ira") {
        setLedger((l) => [{ id: card.id, label: "Send $3,200 to IRA", value: "Retirement" }, ...l]);
        flash("Sending $3,200 to your IRA. No impact to your house fund target.");
      } else if (category === "hysa") {
        setLedger((l) => [{ id: card.id, label: "$3,200 in high-interest Ally", value: `${usd(112)} / yr` }, ...l]);
        flash("Parking $3,200 in the high-interest Ally account. About $112 a year. No impact to your house fund target.");
      } else {
        flash("Got it.");
      }
      setStack({ name: "none" });
      return;
    }
    if (card.id === "hsa") {
      setDismissed((d) => [...d, card.id]);
      if (category === "invest") {
        setLedger((l) => [{ id: card.id, label: "Invest extra HSA cash", value: `${usd(448)} / yr` }, ...l]);
        flash("Opening HealthEquity investing. $1,000 stays cash.");
      } else {
        flash("Kept in cash. Ready if a bill shows up.");
      }
      setStack({ name: "none" });
      return;
    }
    setDismissed((d) => [...d, card.id]);
    setLedger((l) => [
      {
        id: card.id,
        label: card.primary,
        value: card.annualImpact >= 1000 ? `${usd(card.annualImpact)} / yr` : `${usd(card.annualImpact, 2)} / yr`,
      },
      ...l,
    ]);
    flash("Done. It's on your impact ledger.");
    setStack({ name: "none" });
  };

  const counter = (card: Card) => {
    if (card.id === "house-intent") {
      setHouseIntent("no");
      setDismissed((d) => [...d, card.id]);
      flash("Got it. Rent stays on the budget.");
      setStack({ name: "none" });
      return;
    }
    setDismissed((d) => [...d, card.id]);
    flash(card.counter ? `Noted: ${card.counter.toLowerCase()}.` : "Dismissed.");
    setStack({ name: "none" });
  };

  const skip = (card: Card) => {
    setDismissed((d) => [...d, card.id]);
    setStack({ name: "none" });
  };

  const goTab = (t: Tab) => {
    setStack({ name: "none" });
    setTab(t);
  };

  const switchProfile = (id: ProfileId) => {
    setProfileId(id);
    setStack({ name: "none" });
    setTab("home");
    setAnsweredEnrichment(null);
    setHouseIntent(null);
    setHousePlan(emptyHousePlan());
    setHouseChipList(houseChips(emptyHousePlan()));
    setDismissed([]);
    setLedger([]);
    setQuiet(false);
  };

  return (
    <div className="studio">
      <aside className="studio-side">
        <div className="studio-kicker">Rocket Money prototype</div>
        <h1>Recommendations + Rowan</h1>
        <p className="lede">
          Two members, same app chrome. Cards are for mutually distinct recommendations — options with an opinion, when we have one. Rowan is for talking about a card, or gathering a plan that isn't a recommendation yet.
        </p>

        <div className="control-block">
          <h2>Member</h2>
          <div className="seg">
            <button className={profileId === "maya" ? "on" : ""} onClick={() => switchProfile("maya")}>
              Maya
            </button>
            <button className={profileId === "jordan" ? "on" : ""} onClick={() => switchProfile("jordan")}>
              Jordan
            </button>
          </div>
          <p className="hint">
            <strong style={{ color: "#fff" }}>{base.name}.</strong> {base.rungNote}
          </p>
        </div>

        <div className="control-block">
          <h2>Surface</h2>
          <div className="seg">
            <button className={tier === "premium" ? "on" : ""} onClick={() => { setTier("premium"); setStack({ name: "none" }); }}>
              Premium
            </button>
            <button className={tier === "free" ? "on" : ""} onClick={() => { setTier("free"); setQuiet(false); setStack({ name: "none" }); setTab("recs"); }}>
              Free teaser
            </button>
          </div>
          <div className="seg" style={{ marginTop: 8 }}>
            <button className={!quiet ? "on" : ""} onClick={() => { setQuiet(false); setStack({ name: "none" }); }}>
              Live week
            </button>
            <button className={quiet ? "on" : ""} onClick={() => { setQuiet(true); setTier("premium"); setStack({ name: "none" }); setTab("recs"); }}>
              Quiet week
            </button>
          </div>
          <p className="hint">Quiet week is a designed deliverable, not a broken feed. Best on Jordan.</p>
        </div>

        <div className="control-block">
          <h2>Walk this</h2>
          <ol className="checklist">
            <li>
              <strong>Home</strong> — native dashboard, one Recommendations slot above net worth.
            </li>
            <li>
              <strong>Recommendations</strong> — swipe the deck. Right does the action, left skips. Keep going until the stack is empty.
            </li>
            <li>
              <strong>Chat about this</strong> — the card comes with you. Common questions live next to the composer.
            </li>
            <li>
              <strong>Maya · rent → house</strong> — categorize the $1,450 as Rent, then Yes. Saved, price, and when live in Rowan, any order.
            </li>
            <li>
              <strong>Jordan · options</strong> — $3,200, the 401(k), and HSA cash all show where money could go, with one marked Recommended.
            </li>
            <li>
              <strong>Jordan + Ask Rowan</strong> — type “max 401k vs delay the house”.
            </li>
          </ol>
        </div>
      </aside>

      <div className="stage">
        <Phone>
          <Status />
          <div className="app-body">
            {stack.name === "none" ? (
              tab === "recs" ? (
                <Recs
                  profile={base}
                  tier={tier}
                  quiet={quiet}
                  cards={liveCards}
                  ledger={ledger}
                  onSkip={skip}
                  onPrimary={act}
                  onCounter={counter}
                  onChat={(c) => {
                    if (tier === "free") setStack({ name: "paywall" });
                    else openRowan(c);
                  }}
                  onAsk={() => {
                    if (tier === "free") setStack({ name: "paywall" });
                    else if (profileId === "maya" && houseIntent === "yes") openHouseChat(true);
                    else openRowan(undefined);
                  }}
                  onPaywall={() => setStack({ name: "paywall" })}
                />
              ) : (
                <div className="scroll">
                  {tab === "home" && (
                    <Home
                      profile={base}
                      tier={tier}
                      top={topCard}
                      quiet={quiet}
                      ledger={ledger}
                      onOpenRecs={() => goTab("recs")}
                      onPaywall={() => setStack({ name: "paywall" })}
                    />
                  )}
                  {tab === "budget" && (
                    <Placeholder
                      title="Budget"
                      body="Existing Rocket Money surface. Recommendations does not replace it — it sits beside it."
                    />
                  )}
                  {tab === "goals" && (
                    <Goals
                      profile={base}
                      houseIntent={houseIntent}
                      housePlan={housePlan}
                    />
                  )}
                  {tab === "more" && (
                    <Placeholder
                      title="More"
                      body="Settings, appearance, account sharing — unchanged. Rowan is not a tab."
                    />
                  )}
                </div>
              )
            ) : stack.name === "rowan" ? (
              <RowanSheet
                card={stack.card}
                mode={stack.mode}
                chips={stack.mode === "house" ? houseChipList : undefined}
                msgs={msgs}
                draft={draft}
                setDraft={setDraft}
                onBack={() => setStack({ name: "none" })}
                onSend={() => send(draft)}
                onChip={(c) => send(c)}
              />
            ) : (
              <Paywall
                profile={base}
                onBack={() => setStack({ name: "none" })}
                onUnlock={() => {
                  setTier("premium");
                  setStack({ name: "none" });
                  goTab("recs");
                }}
              />
            )}
            {toast ? <div className="toast">{toast}</div> : null}
          </div>
          {stack.name === "none" ? <TabBar tab={tab} onTab={goTab} /> : null}
        </Phone>
      </div>
    </div>
  );
}

function Home({
  profile,
  tier,
  top,
  quiet,
  ledger,
  onOpenRecs,
  onPaywall,
}: {
  profile: Profile;
  tier: Tier;
  top?: Card;
  quiet: boolean;
  ledger: LedgerItem[];
  onOpenRecs: () => void;
  onPaywall: () => void;
}) {
  return (
    <>
      <Top />
      <div className="section-title" style={{ marginTop: 14 }}>
        Recommendations
      </div>
      {quiet || !top ? (
        <div className="card" onClick={onOpenRecs} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="rowan-face">R</div>
            <div>
              <div style={{ fontWeight: 700 }}>You're good this week</div>
              <div className="h-label" style={{ marginTop: 2 }}>
                Rowan checked Tuesday
              </div>
            </div>
          </div>
        </div>
      ) : tier === "free" ? (
        <div className="card" onClick={onPaywall} style={{ cursor: "pointer" }}>
          <div className="pill save">Recommendations</div>
          <h3 className="rec-title" style={{ marginTop: 8 }}>
            {profile.teaserCount} recommendations, worth {usd(Math.round(profile.teaserValue))} a year
          </h3>
          <p className="rec-why">Top item is locked on Free. Premium includes the action, the math, and Rowan.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }}>
            See them
          </button>
        </div>
      ) : (
        <RecCard card={top} compact onOpen={onOpenRecs} />
      )}

      <div className="section-title">Net worth</div>
      <div className="card">
        <div className="networth-row">
          <div>
            <div className="h-label">Total</div>
            <div className="h1 money">{usd(profile.netWorth)}</div>
          </div>
          <div className="delta">+{usd(profile.netWorthDelta)} this month</div>
        </div>
        <div className="accounts">
          {profile.accounts
            .filter((a) => a.balance !== 0)
            .map((a) => (
              <div className="acct" key={a.name}>
                <div>
                  <div className="name">{a.name}</div>
                  <div className="inst">{a.inst}</div>
                </div>
                <div className="money" style={{ fontWeight: 700 }}>
                  {usd(a.balance)}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="section-title">Spending</div>
      <div className="spend-grid">
        <div className="card spend-cell">
          <div className="h-label">This month</div>
          <div className="n money">{usd(profile.spendMonth)}</div>
        </div>
        <div className="card spend-cell">
          <div className="h-label">Budget</div>
          <div className="n money">{usd(profile.budgetMonth)}</div>
        </div>
      </div>

      {ledger.length ? (
        <>
          <div className="section-title">Impact this year</div>
          <div className="card">
            {ledger.map((l) => (
              <div className="ledger-item" key={l.id}>
                <span>{l.label}</span>
                <strong>{l.value}</strong>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p className="ai-note" style={{ marginTop: 16 }}>
        FICO {profile.fico} · {profile.short}
      </p>
    </>
  );
}

function Recs({
  profile,
  tier,
  quiet,
  cards,
  ledger,
  onSkip,
  onPrimary,
  onCounter,
  onChat,
  onAsk,
  onPaywall,
}: {
  profile: Profile;
  tier: Tier;
  quiet: boolean;
  cards: Card[];
  ledger: LedgerItem[];
  onSkip: (c: Card) => void;
  onPrimary: (c: Card, category?: string) => void;
  onCounter: (c: Card) => void;
  onChat: (c: Card) => void;
  onAsk: () => void;
  onPaywall: () => void;
}) {
  const empty = quiet || (tier === "premium" && cards.length === 0);
  return (
    <div className="recs-screen">
      <Top title="Recommendations" />
      <div className="recs-sub">
        <span className="h-label">
          {empty ? profile.archetype : `${cards.length} left`}
        </span>
      </div>

      {empty ? (
        <div className="card empty" style={{ marginTop: 8 }}>
          <div className="rowan-face">R</div>
          <h2>{quiet ? profile.emptyCopy.title : "You're through them."}</h2>
          <p className="rec-why">
            {quiet
              ? profile.emptyCopy.body
              : "That's every recommendation in the deck. Ask Rowan if you want to go back over one."}
          </p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onAsk}>
            Ask Rowan anyway
          </button>
        </div>
      ) : tier === "free" ? (
        <div style={{ marginTop: 8 }}>
          <div className="card">
            <h3 className="rec-title">
              {profile.teaserCount} recommendations, worth {usd(Math.round(profile.teaserValue))} a year
            </h3>
            <p className="rec-why">Amounts and buckets are visible. Actions, math, and Rowan are Premium.</p>
          </div>
          <div className="lock-overlay" style={{ marginTop: 12 }}>
            {cards.slice(0, 3).map((c) => (
              <RecCard key={c.id} card={c} locked compact />
            ))}
            <div className="lock-cta">
              <button className="btn btn-primary" onClick={onPaywall}>
                Unlock with Premium
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <SwipeDeck
            cards={cards}
            onSkip={onSkip}
            onAccept={onPrimary}
            onPrimary={onPrimary}
            onCounter={onCounter}
            onChat={onChat}
            onNeedCategory={() => onPrimary(cards[0])}
          />
          <p className="swipe-hint">
            {cards[0]?.categories?.length
              ? "Pick a category · swipe left to skip"
              : cards[0]?.choices?.length
                ? "Tap an option · swipe left to skip"
                : "Swipe right to do it · left to skip"}
          </p>
        </>
      )}

      {ledger.length ? (
        <div className="card recs-ledger">
          {ledger.map((l) => (
            <div className="ledger-item" key={l.id}>
              <span>{l.label}</span>
              <strong>{l.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RowanSheet({
  card,
  mode,
  chips,
  msgs,
  draft,
  setDraft,
  onBack,
  onSend,
  onChip,
}: {
  card?: Card;
  mode?: "house";
  chips?: string[];
  msgs: Msg[];
  draft: string;
  setDraft: (s: string) => void;
  onBack: () => void;
  onSend: () => void;
  onChip: (c: string) => void;
}) {
  const shown = chips ?? card?.chips ?? ["Max 401k vs delay the house", "What are you watching?", "Show me the ranking"];
  const house = mode === "house";
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs]);
  return (
    <div className="sheet chat">
      <div className="nav-row">
        <button className="back" onClick={onBack}>
          ‹
        </button>
        <div>
          <div className="nav-title">Rowan</div>
          <div className="h-label">{house ? "Saving for a house" : card ? "About this recommendation" : "Ask anything"}</div>
        </div>
      </div>
      {card && !house ? (
        <div className="rowan-card">
          <RecCard card={card} preview />
        </div>
      ) : null}
      <div className="chat-log">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.who}`}>
            <div className="who">{m.who === "rowan" ? "Rowan" : "You"}</div>
            {m.text}
            {m.table ? (
              <table className="table">
                {m.table.h.some(Boolean) ? (
                  <thead>
                    <tr>
                      {m.table.h.map((h, hi) => (
                        <th key={hi}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {m.table.rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((cell, ci) => (
                        <td key={ci}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <div className="composer">
        <div className="chips composer-chips">
          {shown.map((c) => (
            <button key={c} className="chip" onClick={() => onChip(c)}>
              {c}
            </button>
          ))}
        </div>
        <form
          className="composer-row"
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={house ? "Saved, a price, a when…" : "Ask your own question…"} />
          <button className="send" type="submit">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function Paywall({ profile, onBack, onUnlock }: { profile: Profile; onBack: () => void; onUnlock: () => void }) {
  return (
    <div className="sheet">
      <div className="nav-row">
        <button className="back" onClick={onBack}>
          ‹
        </button>
        <div className="nav-title">Premium</div>
      </div>
      <div className="scroll">
        <div className="h-label">Not unlock features</div>
        <h2 className="h1" style={{ fontSize: 26, margin: "8px 0 12px" }}>
          Unlock {usd(Math.round(profile.teaserValue))} a year
        </h2>
        <p className="rec-why">
          {profile.teaserCount} recommendations from {profile.name.split(" ")[0]}'s own accounts. Actions, the math trace, and Rowan are included with Premium.
        </p>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="ledger-item">
            <span>The action on each card</span>
            <strong>Premium</strong>
          </div>
          <div className="ledger-item">
            <span>Show me the math</span>
            <strong>Premium</strong>
          </div>
          <div className="ledger-item">
            <span>Ask Rowan</span>
            <strong>Premium</strong>
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onUnlock}>
          Continue with Premium
        </button>
        <p className="ai-note">Prototype only — no payment.</p>
      </div>
    </div>
  );
}

function Goals({
  profile,
  houseIntent,
  housePlan,
}: {
  profile: Profile;
  houseIntent?: "yes" | "no" | null;
  housePlan: HousePlan;
}) {
  const mayaish = profile.id === "maya";
  const ready = houseComplete(housePlan);
  const when =
    housePlan.months == null ? "" : housePlan.months <= 24 ? "in about 2 years" : housePlan.months <= 48 ? "in 3–5 years" : "in 5+ years";
  return (
    <>
      <Top title="Goals" />
      {mayaish ? (
        <div className="card">
          {ready && housePlan.price != null ? (
            <>
              <div className="h-label">House</div>
              <h3 className="rec-title">
                {usd(housePlan.price)} {when}
              </h3>
              <p className="rec-why">
                {housePlan.saved != null ? `${usd(housePlan.saved)} set aside. ` : ""}
                Price and date came from you. 10% down is the working number we use to check the pace.
              </p>
            </>
          ) : houseIntent === "yes" ? (
            <>
              <div className="h-label">House</div>
              <h3 className="rec-title">In progress with Rowan</h3>
              <p className="rec-why">
                You're naming what's already saved, a price, and a when. Nothing's locked until those three are in.
              </p>
            </>
          ) : (
            <>
              <h3 className="rec-title">No goals yet</h3>
              <p className="rec-why">
                You've got savings. Nothing's named. If you want a house — or anything else — we'll set it from what you tell us, not from a guess.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="h-label">House</div>
          <h3 className="rec-title">$80,000 house fund by June 2028</h3>
          <p className="rec-why">Saved $62,000 · $900/mo against $857 required. On pace.</p>
        </div>
      )}
    </>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <>
      <Top title={title} />
      <div className="placeholder">{body}</div>
    </>
  );
}
