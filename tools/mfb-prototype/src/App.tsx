import { useState } from "react";
import { DemoApp } from "./DemoApp";
import { LiveApp } from "./LiveApp";
import "./App.css";

type Mode = "live" | "demo";

export default function App() {
  const [mode, setMode] = useState<Mode>("live");

  return (
    <>
      <div className="mode-bar">
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === "live" ? "active" : ""}
            onClick={() => setMode("live")}
          >
            Live finances
          </button>
          <button
            type="button"
            className={mode === "demo" ? "active" : ""}
            onClick={() => setMode("demo")}
          >
            Scripted audit
          </button>
        </div>
      </div>
      {mode === "live" ? <LiveApp /> : <DemoApp />}
    </>
  );
}
