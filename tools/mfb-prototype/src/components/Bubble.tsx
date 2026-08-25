import { RichText } from "./RichText";
import type { OutboundMessage } from "../lib/mfbTypes";
import "./Bubble.css";

export function Bubble({ message }: { message: OutboundMessage }) {
  const mine = message.from === "user";
  const body =
    message.kind === "text"
      ? message.body
      : message.interactiveData.type === "quickReply"
        ? "(quick replies below)"
        : message.interactiveData.type === "listPicker"
          ? message.interactiveData.receivedMessage.title
          : message.interactiveData.receivedMessage.title;

  const subtitle =
    message.kind === "interactive" && message.interactiveData.type !== "quickReply"
      ? message.interactiveData.receivedMessage.subtitle
      : undefined;

  if (message.kind === "interactive" && message.interactiveData.type === "quickReply") {
    return null; // chips render separately
  }

  return (
    <div className={`row ${mine ? "mine" : "theirs"}`}>
      <div className={`bubble ${mine ? "bubble-mine" : "bubble-theirs"}`}>
        <div className="bubble-title">
          <RichText text={body} />
        </div>
        {subtitle ? <div className="bubble-sub">{subtitle}</div> : null}
        {message.kind === "interactive" ? (
          <div className="bubble-cta">Tap to open</div>
        ) : null}
      </div>
    </div>
  );
}
