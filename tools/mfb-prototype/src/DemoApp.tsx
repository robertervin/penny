import { useEffect, useMemo, useRef, useState } from "react";
import { advance, materializeStep } from "./demo/auditScript";
import { Bubble } from "./components/Bubble";
import { FormSheet } from "./components/FormSheet";
import { ListPickerSheet } from "./components/ListPickerSheet";
import { QuickReplyBar } from "./components/QuickReply";
import type {
  FormInteractive,
  ListPickerInteractive,
  OutboundMessage,
  QuickReplyInteractive,
  UserReply,
} from "./lib/mfbTypes";
import "./App.css";

type SheetState =
  | { type: "listPicker"; data: ListPickerInteractive; messageId: string }
  | { type: "form"; data: FormInteractive; messageId: string }
  | null;

export function DemoApp() {
  const [stepId, setStepId] = useState("start");
  const [messages, setMessages] = useState<OutboundMessage[]>(() => materializeStep("start"));
  const [sheet, setSheet] = useState<SheetState>(null);
  const [lastPayload, setLastPayload] = useState<unknown>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, sheet]);

  const activeQuickReply = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.kind === "interactive" && m.interactiveData.type === "quickReply") {
        return m.interactiveData;
      }
      if (m.from === "user") break;
    }
    return null as QuickReplyInteractive | null;
  }, [messages]);

  function appendUser(text: string) {
    setMessages((prev) => [
      ...prev,
      { kind: "text", id: crypto.randomUUID(), body: text, from: "user" },
    ]);
  }

  function handleReply(reply: UserReply, displayText: string) {
    setLastPayload({ userReply: reply, at: new Date().toISOString() });
    appendUser(displayText);
    setSheet(null);

    const next = advance(stepId, reply);
    if (!next) return;
    const nextMessages = materializeStep(next);
    setStepId(next);
    window.setTimeout(() => {
      setMessages((prev) => [...prev, ...nextMessages]);
      const interactive = nextMessages.find((m) => m.kind === "interactive");
      if (interactive && interactive.kind === "interactive") {
        setLastPayload({
          outboundInteractiveData: interactive.interactiveData,
          step: next,
        });
      }
    }, 350);
  }

  function onBubbleActivate(message: OutboundMessage) {
    if (message.kind !== "interactive") return;
    const data = message.interactiveData;
    if (data.type === "listPicker") {
      setSheet({ type: "listPicker", data, messageId: message.id });
      setLastPayload({ outboundInteractiveData: data });
    } else if (data.type === "form") {
      setSheet({ type: "form", data, messageId: message.id });
      setLastPayload({ outboundInteractiveData: data });
    }
  }

  function restart() {
    setStepId("start");
    setMessages(materializeStep("start"));
    setSheet(null);
    setLastPayload(null);
  }

  return (
    <div className="app">
      <aside className="rail">
        <p className="eyebrow">Scripted demo</p>
        <h1>Audit walkthrough</h1>
        <p className="lede">
          Original MfB-shaped audit script with quick replies, list pickers, and forms — no live
          data.
        </p>
        <button type="button" className="restart" onClick={restart}>
          Restart audit demo
        </button>
        <div className="payload">
          <div className="payload-label">Last interactive / reply JSON</div>
          <pre>{lastPayload ? JSON.stringify(lastPayload, null, 2) : "—"}</pre>
        </div>
      </aside>

      <main className="phone">
        <header className="phone-header">
          <div className="avatar">P</div>
          <div>
            <div className="phone-title">Penny</div>
            <div className="phone-sub">Business · scripted demo</div>
          </div>
        </header>

        <div className="thread" ref={scroller}>
          {messages.map((m) => {
            if (m.kind === "interactive" && m.interactiveData.type !== "quickReply") {
              return (
                <button
                  key={m.id}
                  type="button"
                  className="interactive-hit"
                  onClick={() => onBubbleActivate(m)}
                >
                  <Bubble message={m} />
                </button>
              );
            }
            return <Bubble key={m.id} message={m} />;
          })}
        </div>

        {activeQuickReply ? (
          <QuickReplyBar
            data={activeQuickReply}
            onSelect={(identifier, title) =>
              handleReply({ type: "quickReply", identifier, title }, title)
            }
          />
        ) : (
          <div className="composer-disabled">Use the controls Penny sends — scripted demo only</div>
        )}
      </main>

      {sheet?.type === "listPicker" ? (
        <ListPickerSheet
          data={sheet.data}
          onClose={() => setSheet(null)}
          onSubmit={(selections) =>
            handleReply(
              { type: "listPicker", selections },
              selections.map((s) => s.title).join(", "),
            )
          }
        />
      ) : null}

      {sheet?.type === "form" ? (
        <FormSheet
          data={sheet.data}
          onClose={() => setSheet(null)}
          onSubmit={(answers) => {
            const label = Object.entries(answers)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            handleReply({ type: "form", answers }, label);
          }}
        />
      ) : null}
    </div>
  );
}
