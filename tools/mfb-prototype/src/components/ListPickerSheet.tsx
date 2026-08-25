import { useState } from "react";
import type { ListPickerInteractive } from "../lib/mfbTypes";
import "./Sheet.css";

export function ListPickerSheet({
  data,
  onClose,
  onSubmit,
}: {
  data: ListPickerInteractive;
  onClose: () => void;
  onSubmit: (selections: Array<{ identifier: string; title: string }>) => void;
}) {
  const multi = data.listPicker.sections.some((s) => s.multipleSelection);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(multi ? prev : []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const flat = data.listPicker.sections.flatMap((s) =>
    s.items.map((i) => ({ ...i, section: s.title })),
  );

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet">
        <header className="sheet-header">
          <button type="button" className="sheet-link" onClick={onClose}>
            Cancel
          </button>
          <h2>{data.receivedMessage.title}</h2>
          <button
            type="button"
            className="sheet-link strong"
            disabled={selected.size === 0}
            onClick={() => {
              const selections = flat
                .filter((i) => selected.has(i.identifier))
                .map((i) => ({ identifier: i.identifier, title: i.title }));
              onSubmit(selections);
            }}
          >
            Done
          </button>
        </header>
        {data.receivedMessage.subtitle ? (
          <p className="sheet-sub">{data.receivedMessage.subtitle}</p>
        ) : null}
        <div className="sheet-body">
          {data.listPicker.sections.map((section) => (
            <section key={section.title} className="sheet-section">
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => {
                  const on = selected.has(item.identifier);
                  return (
                    <li key={item.identifier}>
                      <button
                        type="button"
                        className={`sheet-item ${on ? "on" : ""}`}
                        onClick={() => toggle(item.identifier)}
                      >
                        <div>
                          <div className="sheet-item-title">{item.title}</div>
                          {item.subtitle ? (
                            <div className="sheet-item-sub">{item.subtitle}</div>
                          ) : null}
                        </div>
                        <span className={`check ${on ? "on" : ""}`} aria-hidden>
                          {on ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
