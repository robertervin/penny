import type { InteractiveData, OutboundMessage, UserReply } from "../lib/mfbTypes";

type StepMessage =
  | { kind: "text"; body: string }
  | { kind: "interactive"; interactiveData: InteractiveData };

export type DemoStep = {
  id: string;
  messages: StepMessage[];
  next: (reply: UserReply) => string | null;
};

function text(body: string): OutboundMessage {
  return { kind: "text", id: crypto.randomUUID(), body, from: "penny" };
}

function interactive(data: InteractiveData): OutboundMessage {
  return {
    kind: "interactive",
    id: crypto.randomUUID(),
    from: "penny",
    interactiveData: data,
  };
}

/** Scripted first-link audit conversation for local MfB prototyping. */
export const AUDIT_DEMO: Record<string, DemoStep> = {
  start: {
    id: "start",
    messages: [
      {
        kind: "text",
        body: "Hey — I’m Penny. Your accounts are linked. I’ve got a quick intake (the audit), then a one-line plan. Ready?",
      },
      {
        kind: "interactive",
        interactiveData: {
          type: "quickReply",
          quickReply: {
            summaryText: "Start audit?",
            items: [
              { identifier: "start_yes", title: "Let’s go" },
              { identifier: "start_later", title: "Not now" },
            ],
          },
        },
      },
    ],
    next: (reply) => {
      if (reply.type === "quickReply" && reply.identifier === "start_yes") return "runway";
      if (reply.type === "quickReply" && reply.identifier === "start_later") return "bye";
      return "start";
    },
  },

  bye: {
    id: "bye",
    messages: [
      {
        kind: "text",
        body: "No rush. Message me anytime — I’ll keep your file warm.",
      },
    ],
    next: () => null,
  },

  runway: {
    id: "runway",
    messages: [
      {
        kind: "text",
        body: "Liquid cash looks like about **2.1 months** of bills (~$4,200/mo out). Target band is 3–6 months. You’re roughly **$3,800 short of 3 months**.",
      },
      {
        kind: "interactive",
        interactiveData: {
          type: "quickReply",
          quickReply: {
            items: [
              { identifier: "runway_ok", title: "Looks right" },
              { identifier: "runway_fix", title: "Fix my bills" },
              { identifier: "runway_why", title: "Why?" },
            ],
          },
        },
      },
    ],
    next: (reply) => {
      if (reply.type === "quickReply" && reply.identifier === "runway_ok") return "debt";
      if (reply.type === "quickReply" && reply.identifier === "runway_fix") return "must_pay_form";
      if (reply.type === "quickReply" && reply.identifier === "runway_why") return "runway_why";
      return "runway";
    },
  },

  runway_why: {
    id: "runway_why",
    messages: [
      {
        kind: "text",
        body: "I used checking + HYSA balances ÷ a 90-day median of outflows (transfers and card payments stripped). I didn’t count your credit limit as an emergency fund.",
      },
      {
        kind: "interactive",
        interactiveData: {
          type: "quickReply",
          quickReply: {
            items: [
              { identifier: "runway_ok", title: "Looks right" },
              { identifier: "runway_fix", title: "Fix my bills" },
            ],
          },
        },
      },
    ],
    next: (reply) => {
      if (reply.type === "quickReply" && reply.identifier === "runway_ok") return "debt";
      if (reply.type === "quickReply" && reply.identifier === "runway_fix") return "must_pay_form";
      return "runway_why";
    },
  },

  must_pay_form: {
    id: "must_pay_form",
    messages: [
      {
        kind: "interactive",
        interactiveData: {
          type: "form",
          receivedMessage: {
            title: "Must-pay per month",
            subtitle: "Tap to enter what you actually need to float",
          },
          form: {
            title: "Monthly must-pay",
            pages: [
              {
                pageIdentifier: "must_pay",
                type: "input",
                title: "What do you need each month?",
                subtitle: "Rent, food, minimums — your number",
                placeholder: "4200",
                inputType: "number",
              },
            ],
          },
        },
      },
    ],
    next: (reply) => {
      if (reply.type === "form" && reply.answers.must_pay) return "debt";
      return "must_pay_form";
    },
  },

  debt: {
    id: "debt",
    messages: [
      {
        kind: "text",
        body: "I see **$4,200** on a card that looks like it revolves. I’m treating it as **22% APR** until you correct it — quality data matters here.",
      },
      {
        kind: "interactive",
        interactiveData: {
          type: "listPicker",
          receivedMessage: {
            title: "Card terms",
            subtitle: "Choose how this balance works",
          },
          listPicker: {
            sections: [
              {
                title: "This card",
                items: [
                  {
                    identifier: "pay_in_full",
                    title: "I pay in full",
                    subtitle: "No interest — not a high-interest problem",
                  },
                  {
                    identifier: "set_apr",
                    title: "Set real APR…",
                    subtitle: "I’ll ask for the number next",
                  },
                  {
                    identifier: "promo_0",
                    title: "0% promo",
                    subtitle: "Tell me when it ends later",
                  },
                  {
                    identifier: "assume_22",
                    title: "Keep 22% for now",
                    subtitle: "Safe default",
                  },
                ],
              },
            ],
          },
        },
      },
    ],
    next: (reply) => {
      if (reply.type !== "listPicker" || reply.selections.length === 0) return "debt";
      const id = reply.selections[0]!.identifier;
      if (id === "set_apr") return "apr_form";
      return "goals";
    },
  },

  apr_form: {
    id: "apr_form",
    messages: [
      {
        kind: "interactive",
        interactiveData: {
          type: "form",
          receivedMessage: {
            title: "Card APR",
            subtitle: "Enter the rate from your statement",
          },
          form: {
            title: "APR",
            pages: [
              {
                pageIdentifier: "apr",
                type: "input",
                title: "APR %",
                placeholder: "19.99",
                inputType: "number",
              },
            ],
          },
        },
      },
    ],
    next: (reply) => (reply.type === "form" && reply.answers.apr ? "goals" : "apr_form"),
  },

  goals: {
    id: "goals",
    messages: [
      {
        kind: "text",
        body: "What should extra dollars work toward after we fix the floor and expensive debt?",
      },
      {
        kind: "interactive",
        interactiveData: {
          type: "listPicker",
          receivedMessage: {
            title: "Named goals",
            subtitle: "Pick one to start — you can add more later",
          },
          listPicker: {
            sections: [
              {
                title: "Goals",
                multipleSelection: false,
                items: [
                  {
                    identifier: "house",
                    title: "House / down payment",
                    subtitle: "Named pile in the HYSA",
                  },
                  {
                    identifier: "car",
                    title: "Car / replacement",
                    subtitle: "Sinking fund",
                  },
                  {
                    identifier: "cushion",
                    title: "Just a stronger cushion",
                    subtitle: "Fill 3–6 months",
                  },
                  {
                    identifier: "retirement",
                    title: "Retirement / match",
                    subtitle: "We’ll ask about the match next",
                  },
                ],
              },
            ],
          },
        },
      },
    ],
    next: (reply) => {
      if (reply.type === "listPicker" && reply.selections[0]) return "plan";
      return "goals";
    },
  },

  plan: {
    id: "plan",
    messages: [
      {
        kind: "text",
        body: "**Plan:** Keep ~1 month in checking. Put extra toward the card first. Then fill **Cushion** to 3 months in the HYSA (priced at 4%). Your named goal waits until that band is honest.\n\nOne move this week: set an extra **$200** card payment — or reply WHY for the waterfall.",
      },
      {
        kind: "interactive",
        interactiveData: {
          type: "quickReply",
          quickReply: {
            items: [
              { identifier: "plan_go", title: "GO" },
              { identifier: "plan_why", title: "WHY" },
              { identifier: "plan_restart", title: "Restart demo" },
            ],
          },
        },
      },
    ],
    next: (reply) => {
      if (reply.type === "quickReply" && reply.identifier === "plan_go") return "done_go";
      if (reply.type === "quickReply" && reply.identifier === "plan_why") return "waterfall";
      if (reply.type === "quickReply" && reply.identifier === "plan_restart") return "start";
      return "plan";
    },
  },

  waterfall: {
    id: "waterfall",
    messages: [
      {
        kind: "text",
        body: "Waterfall: operating float → toxic revolving debt → 3-month cushion (HYSA 4%) → employer match → named goal. Skipping ahead makes the house number fake.",
      },
      {
        kind: "interactive",
        interactiveData: {
          type: "quickReply",
          quickReply: {
            items: [
              { identifier: "plan_go", title: "GO" },
              { identifier: "plan_restart", title: "Restart demo" },
            ],
          },
        },
      },
    ],
    next: (reply) => {
      if (reply.type === "quickReply" && reply.identifier === "plan_go") return "done_go";
      if (reply.type === "quickReply" && reply.identifier === "plan_restart") return "start";
      return "waterfall";
    },
  },

  done_go: {
    id: "done_go",
    messages: [
      {
        kind: "text",
        body: "Locked. I’ll nudge you on that $200 and keep the file current when balances move. (Prototype ends here — later this PutEvents into the workflow processor.)",
      },
      {
        kind: "interactive",
        interactiveData: {
          type: "quickReply",
          quickReply: {
            items: [{ identifier: "plan_restart", title: "Restart demo" }],
          },
        },
      },
    ],
    next: (reply) =>
      reply.type === "quickReply" && reply.identifier === "plan_restart" ? "start" : null,
  },
};

export function materializeStep(stepId: string): OutboundMessage[] {
  const step = AUDIT_DEMO[stepId];
  if (!step) return [];
  return step.messages.map((m) => {
    if (m.kind === "text") return text(m.body);
    return interactive(m.interactiveData);
  });
}

export function advance(stepId: string, reply: UserReply): string | null {
  const step = AUDIT_DEMO[stepId];
  if (!step) return null;
  return step.next(reply);
}
