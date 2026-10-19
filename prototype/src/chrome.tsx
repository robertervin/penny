import type { ReactNode } from "react";

export function IconHome({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}
export function IconBudget({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? "2.2" : "1.8"}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v16" />
    </svg>
  );
}
export function IconSpark({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M18 14.5 19 17l2.5 1L19 19.5 18 22l-1-2.5L14.5 19 17 18l1-3.5Z" />
    </svg>
  );
}
export function IconGoals({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? "2.2" : "1.8"}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}
export function IconMore({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r={on ? 1.8 : 1.5} />
      <circle cx="12" cy="12" r={on ? 1.8 : 1.5} />
      <circle cx="18" cy="12" r={on ? 1.8 : 1.5} />
    </svg>
  );
}

export function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" />
    </svg>
  );
}

export function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="phone">
      <div className="notch" />
      {children}
    </div>
  );
}
