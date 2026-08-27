import { useEffect, useMemo, useRef, useState } from "react";
import { Bubble } from "./components/Bubble";
import { Composer } from "./components/Composer";
import { QuickReplyBar } from "./components/QuickReply";
import type { OutboundMessage, QuickReplyInteractive } from "./lib/mfbTypes";
import {
  checkPennyHealth,
  getMfbPhone,
  sendPennyMessage,
  suggestsConfirmation,
} from "./lib/pennyClient";
import "./App.css";

const SHORTCUTS = ["WHY income", "WHY bills", "RULES", "HELP", "UNDO"] as const;

const CONFIRM_REPLIES: QuickReplyInteractive = {
  type: "quickReply",
  quickReply: {
    items: [
      { identifier: "yes", title: "YES" },
      { identifier: "no", title: "NO" },
      { identifier: "edit", title: "EDIT" },
    ],
  },
};

function pennyText(body: string): OutboundMessage {
  return { kind: "text", id: crypto.randomUUID(), body, from: "penny" };
}

function userText(body: string): OutboundMessage {
  return { kind: "text", id: crypto.randomUUID(), body, from: "user" };
}

export function LiveApp() {
  const [messages, setMessages] = useState<OutboundMessage[]>([
    pennyText(
      "Hey — I'm Penny. Ask about your runway, income, or bills. Try WHY income, or just ask in plain language.",
    ),
  ]);
  const [loading, setLoading] = useState(false);
  const [gatewayOk, setGatewayOk] = useState<boolean | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void checkPennyHealth().then(setGatewayOk);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const lastPennyText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.from === "penny" && m.kind === "text") return m.body;
    }
    return "";
  }, [messages]);

  const confirmBar = suggestsConfirmation(lastPennyText) ? CONFIRM_REPLIES : null;

  async function send(body: string) {
    if (!body.trim() || loading) return;
    setLastError(null);
    setMessages((prev) => [...prev, userText(body)]);
    setLoading(true);
    try {
      const reply = await sendPennyMessage(body);
      setMessages((prev) => [...prev, pennyText(reply.body)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLastError(message);
      setMessages((prev) => [
        ...prev,
        pennyText(
          message.includes("500") || message.includes("502") || message.includes("503")
            ? "I couldn't reach the Penny backend. Make sure API + SMS gateway are running (npm run api:dev, npm run sms:dev)."
            : `Error: ${message}`,
        ),
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearThread() {
    setMessages([
      pennyText(
        "Thread cleared. Ask about your finances — runway, income breakdown, memory rules, or corrections.",
      ),
    ]);
    setLastError(null);
  }

  return (
    <div className="app">
      <aside className="rail">
        <p className="eyebrow">Live · SMS gateway</p>
        <h1>Penny over Messages</h1>
        <p className="lede">
          Free-text chat wired to <code>@penny/sms-gateway</code> → Penny API → your household
          Situation and Memory.
        </p>
        <div
          className={`status-pill ${gatewayOk === null ? "wait" : gatewayOk ? "ok" : "err"}`}
        >
          {gatewayOk === null
            ? "Checking gateway…"
            : gatewayOk
              ? "SMS gateway connected"
              : "SMS gateway offline — run npm run sms:dev"}
        </div>
        <p className="lede" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
          Phone thread: <code>{getMfbPhone()}</code>
          <br />
          Set <code>PENNY_DEV_HOUSEHOLD_ID</code> in <code>src/.env</code> to use your linked
          accounts.
        </p>
        <button type="button" className="restart" onClick={clearThread}>
          Clear thread
        </button>
        {lastError ? (
          <div className="payload">
            <div className="payload-label">Last error</div>
            <pre>{lastError}</pre>
          </div>
        ) : null}
      </aside>

      <main className="phone">
        <header className="phone-header">
          <div className="avatar">P</div>
          <div>
            <div className="phone-title">Penny</div>
            <div className="phone-sub">Live · explore + execute</div>
          </div>
        </header>

        <div className="thread" ref={scroller}>
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          {loading ? <div className="typing">Penny is thinking…</div> : null}
        </div>

        {confirmBar ? (
          <QuickReplyBar
            data={confirmBar}
            onSelect={(_id, title) => void send(title)}
          />
        ) : (
          <div className="shortcuts">
            {SHORTCUTS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                className="shortcut"
                disabled={loading}
                onClick={() => void send(cmd)}
              >
                {cmd}
              </button>
            ))}
          </div>
        )}

        <Composer disabled={loading} onSend={(text) => void send(text)} />
      </main>
    </div>
  );
}
