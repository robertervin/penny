import { useState } from "react";
import "./Composer.css";

type Props = {
  disabled?: boolean;
  onSend: (text: string) => void;
};

export function Composer({ disabled, onSend }: Props) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        type="text"
        className="composer-input"
        placeholder="Message Penny…"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="composer-send" disabled={disabled || !text.trim()}>
        Send
      </button>
    </form>
  );
}
