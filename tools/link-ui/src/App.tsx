import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";
import "./App.css";

type Session = { personId: string; householdId: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

function LinkButton({
  session,
  onLinked,
}: {
  session: Session;
  onLinked: () => void;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    api<{ link_token: string }>("/api/plaid/link-token", {
      method: "POST",
      body: JSON.stringify({
        person_id: session.personId,
        household_id: session.householdId,
      }),
    })
      .then((data) => setLinkToken(data.link_token))
      .catch((e: Error) => setError(e.message));
  }, [session]);

  const onSuccess: PlaidLinkOnSuccess = useCallback(
    async (public_token, metadata) => {
      if (!public_token) return;
      setLinking(true);
      setError(null);
      try {
        await api("/api/plaid/exchange", {
          method: "POST",
          body: JSON.stringify({
            public_token: public_token,
            person_id: session.personId,
            household_id: session.householdId,
            institution: metadata.institution
              ? {
                  institution_id: metadata.institution.institution_id,
                  name: metadata.institution.name,
                }
              : undefined,
          }),
        });
        onLinked();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Exchange failed");
      } finally {
        setLinking(false);
      }
    },
    [session, onLinked],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  return (
    <div className="link-actions">
      <button
        type="button"
        className="primary"
        disabled={!ready || linking || !linkToken}
        onClick={() => open()}
      >
        {linking ? "Linking…" : "Connect with Plaid"}
      </button>
      {error ? <p className="error">{error}</p> : null}
      {!linkToken && !error ? <p className="muted">Preparing Link…</p> : null}
    </div>
  );
}

type Status = {
  items: Array<{
    id: string;
    institution_name: string | null;
    status: string;
    last_synced_at: string | null;
  }>;
  ledger: {
    accounts: number;
    transactions: number;
    latestBalanceAt: string | null;
  };
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const refreshStatus = useCallback(async (householdId: string) => {
    const data = await api<Status>(`/api/household/${householdId}/status`);
    setStatus(data);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("penny.session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Session;
        setSession(parsed);
        void refreshStatus(parsed.householdId);
        return;
      } catch {
        localStorage.removeItem("penny.session");
      }
    }
    api<{ personId: string; householdId: string }>("/api/session/bootstrap", {
      method: "POST",
    })
      .then((s) => {
        setSession(s);
        localStorage.setItem("penny.session", JSON.stringify(s));
        return refreshStatus(s.householdId);
      })
      .catch((e: Error) => setBootError(e.message));
  }, [refreshStatus]);

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Penny · local</p>
        <h1>Link your accounts</h1>
        <p className="lede">
          Connect institutions through Plaid. We store tokens encrypted, enqueue a sync, and
          fill the ledger for mining insights.
        </p>
      </header>

      {bootError ? <p className="error">{bootError}</p> : null}

      {session ? (
        <>
          <section className="card">
            <h2>Session</h2>
            <dl className="ids">
              <div>
                <dt>Household</dt>
                <dd>{session.householdId}</dd>
              </div>
              <div>
                <dt>Person</dt>
                <dd>{session.personId}</dd>
              </div>
            </dl>
            <LinkButton
              session={session}
              onLinked={() => void refreshStatus(session.householdId)}
            />
          </section>

          {status ? (
            <section className="card">
              <h2>Ledger status</h2>
              <ul className="stats">
                <li>
                  <strong>{status.ledger.accounts}</strong> accounts
                </li>
                <li>
                  <strong>{status.ledger.transactions}</strong> transactions
                </li>
              </ul>
              {status.items.length > 0 ? (
                <ul className="items">
                  {status.items.map((item) => (
                    <li key={item.id}>
                      {item.institution_name ?? "Institution"} · {item.status}
                      {item.last_synced_at
                        ? ` · synced ${new Date(item.last_synced_at).toLocaleString()}`
                        : " · sync pending"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No linked items yet.</p>
              )}
              <p className="hint">
                After linking, ensure the workflow processor is running to ingest sync events.
              </p>
            </section>
          ) : null}
        </>
      ) : (
        <p className="muted">Starting session…</p>
      )}
    </div>
  );
}
