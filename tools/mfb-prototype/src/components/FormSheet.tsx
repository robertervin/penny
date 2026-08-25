import { useState } from "react";
import type { FormInteractive } from "../lib/mfbTypes";
import "./Sheet.css";

export function FormSheet({
  data,
  onClose,
  onSubmit,
}: {
  data: FormInteractive;
  onClose: () => void;
  onSubmit: (answers: Record<string, string>) => void;
}) {
  const [pageIdx, setPageIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const page = data.form.pages[pageIdx]!;
  const value = answers[page.pageIdentifier] ?? "";

  const canNext = value.trim().length > 0;
  const last = pageIdx >= data.form.pages.length - 1;

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet">
        <header className="sheet-header">
          <button type="button" className="sheet-link" onClick={onClose}>
            Cancel
          </button>
          <h2>{data.form.title}</h2>
          <button
            type="button"
            className="sheet-link strong"
            disabled={!canNext}
            onClick={() => {
              if (!last) {
                setPageIdx((i) => i + 1);
                return;
              }
              onSubmit(answers);
            }}
          >
            {last ? "Done" : "Next"}
          </button>
        </header>
        <div className="sheet-body form-body">
          <h3>{page.title}</h3>
          {page.subtitle ? <p className="sheet-sub">{page.subtitle}</p> : null}
          {page.type === "input" ? (
            <input
              className="form-input"
              autoFocus
              inputMode={page.inputType === "number" ? "decimal" : "text"}
              placeholder={page.placeholder}
              value={value}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [page.pageIdentifier]: e.target.value }))
              }
            />
          ) : (
            <ul className="form-options">
              {(page.options ?? []).map((opt) => (
                <li key={opt.identifier}>
                  <button
                    type="button"
                    className={`sheet-item ${value === opt.identifier ? "on" : ""}`}
                    onClick={() =>
                      setAnswers((a) => ({
                        ...a,
                        [page.pageIdentifier]: opt.identifier,
                      }))
                    }
                  >
                    {opt.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
