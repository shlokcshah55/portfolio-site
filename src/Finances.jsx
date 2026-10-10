import { useEffect, useRef, useState } from "react";
import "./Finances.css";

/* The gate is client-side only: anything in this bundle is readable by
   a determined visitor, so treat it as a lock on a drawer rather than a
   vault. The password itself is never shipped, only its SHA-256 hash.

   To change it, run in a browser console on this site:
     crypto.subtle.digest("SHA-256", new TextEncoder().encode("new password"))
       .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")))
   and paste the result here. */
const PASSWORD_HASH =
  "d9fb92e3bbe65be1f1aad4a82eef4567f7a1ebe2cd110c8049b9698be7a70c88";

/* Staying unlocked for the tab's lifetime means closing and reopening
   the safe doesn't ask again. */
const UNLOCK_KEY = "finances-unlocked";

/* Rows behind the door, newest first. */
const LEDGER = [
  { date: "2026-10", label: "Runway", value: "Comfortable" },
  { date: "2026-10", label: "Side projects", value: "Break-even" },
  { date: "2026-09", label: "Savings rate", value: "Above target" },
];

const sha256Hex = async (text) => {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const readUnlocked = () => {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
};

export default function Finances({ onClose, closing, style }) {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [password, setPassword] = useState("");
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus();
  }, [unlocked]);

  const submit = async (event) => {
    event.preventDefault();
    if (checking || !password) return;
    setChecking(true);
    const matches = (await sha256Hex(password)) === PASSWORD_HASH;
    setChecking(false);
    if (matches) {
      try {
        sessionStorage.setItem(UNLOCK_KEY, "1");
      } catch {
        /* Private mode: the unlock just won't survive a reopen. */
      }
      setUnlocked(true);
      return;
    }
    setPassword("");
    setShake(true);
  };

  return (
    <div
      className={`finances-view ${closing ? "is-closing" : ""}`}
      style={style}
    >
      <button type="button" className="finances-back" onClick={onClose}>
        <span aria-hidden="true">&larr;</span> Back
      </button>

      <div className="finances-stage">
        <img
          className={`finances-safe ${unlocked ? "is-open" : ""}`}
          src="/safe.png"
          alt=""
          draggable="false"
        />

        {unlocked ? (
          <section className="ledger" aria-label="Finances">
            <h2 className="ledger__title">Finances</h2>
            <ul className="ledger__rows">
              {LEDGER.map((row) => (
                <li key={`${row.date}-${row.label}`} className="ledger__row">
                  <span className="ledger__date">{row.date}</span>
                  <span className="ledger__label">{row.label}</span>
                  <span className="ledger__value">{row.value}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <form
            className={`lock ${shake ? "is-shaking" : ""}`}
            onSubmit={submit}
            onAnimationEnd={() => setShake(false)}
          >
            <label className="lock__label" htmlFor="finances-password">
              Enter the combination
            </label>
            <div className="lock__field">
              <input
                ref={inputRef}
                id="finances-password"
                className="lock__input"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={shake || undefined}
              />
              <button
                type="submit"
                className="lock__button"
                disabled={checking || !password}
              >
                Open
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
