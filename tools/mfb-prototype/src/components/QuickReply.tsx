import type { QuickReplyInteractive } from "../lib/mfbTypes";
import "./QuickReply.css";

export function QuickReplyBar({
  data,
  onSelect,
}: {
  data: QuickReplyInteractive;
  onSelect: (identifier: string, title: string) => void;
}) {
  return (
    <div className="qr-bar" role="group" aria-label="Quick replies">
      {data.quickReply.items.map((item) => (
        <button
          key={item.identifier}
          type="button"
          className="qr-chip"
          onClick={() => onSelect(item.identifier, item.title)}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}
